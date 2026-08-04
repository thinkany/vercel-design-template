// ©2026 thinkany llc. All rights reserved.
/**
 * handler.test.mjs — offline test of the derive ENDPOINT (license gate + wiring),
 * no Vercel runtime, no network. Drives `handler()` with a mock req/res and the
 * committed capture fixture. Verifies the three gate outcomes + body parsing +
 * both auth header forms. (The derive OUTPUT itself is locked by
 * conformance.test.mjs; here we only care about the HTTP shell.)
 *
 *   node cloud-export/handler.test.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { handler } from "./derive.mjs";

const bundle = JSON.parse(
  await readFile(fileURLToPath(new URL("./fixtures/capture-v00.json", import.meta.url)), "utf8")
);

// Minimal Node-style response double.
function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b; },
  };
}
async function call({ headers = {}, body = bundle }) {
  const res = mockRes();
  await handler({ method: "POST", headers, body }, res);
  let json = null;
  try { json = JSON.parse(res.body); } catch {}
  return { res, json };
}

let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.error("  ✗ " + msg); } else console.log("  ✓ " + msg); };

const KEY = "test-license-key-123";

// 1. No server key configured → 503 misconfig (not 401).
delete process.env.DERIVE_LICENSE_KEY;
{
  const { res, json } = await call({ headers: { "x-license-key": KEY } });
  ok(res.statusCode === 503, `unconfigured server → 503 (got ${res.statusCode})`);
  ok(/not configured/i.test(json?.error || ""), "503 explains the misconfig");
}

// From here the server IS configured.
process.env.DERIVE_LICENSE_KEY = KEY;

// 2. Missing / wrong license → 401.
ok((await call({ headers: {} })).res.statusCode === 401, "no license header → 401");
ok((await call({ headers: { "x-license-key": "nope" } })).res.statusCode === 401, "wrong license → 401");

// 3. Correct license via x-license-key → 200 + a real BuildSpec.
{
  const { res, json } = await call({ headers: { "x-license-key": KEY } });
  ok(res.statusCode === 200, `valid license → 200 (got ${res.statusCode})`);
  ok((res.headers["content-type"] || "").includes("application/json"), "200 sets json content-type");
  ok(json?.contract === 1 && Array.isArray(json.blocks), "200 body is a BuildSpec (contract:1, blocks[])");
  ok(json.blocks.length === bundle.blocks.length ? true : json.blocks.length > 0, `derived ${json?.blocks?.length} block(s)`);
}

// 4. Correct license via `authorization: Bearer …` → 200.
ok((await call({ headers: { authorization: `Bearer ${KEY}` } })).res.statusCode === 200, "Bearer authorization → 200");

// 5. Raw string body (Vercel may not pre-parse) → 200.
ok((await call({ headers: { "x-license-key": KEY }, body: JSON.stringify(bundle) })).res.statusCode === 200, "string body parsed → 200");

// 6. Malformed body with a valid key → 400 (not 500).
ok((await call({ headers: { "x-license-key": KEY }, body: "{not json" })).res.statusCode === 400, "bad body → 400");

if (failed) { console.error(`\n✗ HANDLER TESTS FAILED — ${failed} assertion(s)`); process.exit(1); }
console.log("\n✓ HANDLER TESTS PASSED — gate (503/401/200) + body parsing + both auth forms.");
