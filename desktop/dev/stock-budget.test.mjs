// ©2026 thinkany llc. All rights reserved.
// stock-budget.test.mjs — the per-request cascade, both budget windows, and the credit
// ledger. Stubbed fetch, no live keys: run with `node desktop/dev/stock-budget.test.mjs`.
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stock-"));
process.env.IMAGE_USAGE_FILE = path.join(tmp, "usage.json");

const mod = await import("../../scripts/lib/stock-budget.mjs");
const { cascade, budgetLeft, api, readUsage, writeUsage, BudgetError, recordCredit } = mod;

let calls = [];
const src = (id, behaviour) => ({ id, key: () => "k", label: id, run: behaviour });

// --- cascade: falls through on empty results ---------------------------------
calls = [];
let out = await cascade(
  [src("a"), src("b"), src("c")],
  async (s) => { calls.push(s.id); return { source: s.id, results: s.id === "c" ? [{ id: 1 }] : [] }; },
);
assert.deepEqual(calls, ["a", "b", "c"], "empty results should spill to the next library");
assert.equal(out.source, "c", "the library with a match answers");

// --- cascade: falls through on a transient error, reports a hard one ----------
calls = [];
out = await cascade(
  [src("a"), src("b")],
  async (s) => {
    calls.push(s.id);
    if (s.id === "a") throw new Error("Pexels search: HTTP 429 (rate limit)");
    return { source: s.id, results: [{ id: 2 }] };
  },
);
assert.deepEqual(calls, ["a", "b"], "a 429 should spill");
assert.equal(out.source, "b");

await assert.rejects(
  () => cascade([src("a"), src("b")], async (s) => { throw new Error(`${s.id} search: HTTP 401 (the key was rejected)`); }),
  /401/,
  "a rejected key is reported, not swallowed",
);

// --- cascade: nothing anywhere -> null ---------------------------------------
out = await cascade([src("a"), src("b")], async () => ({ results: [] }));
assert.equal(out, null, "no match anywhere returns null (caller uses a placeholder)");

// --- cascade: skips libraries with no key ------------------------------------
calls = [];
const nokey = { id: "x", key: () => "", label: "x" };
await cascade([nokey, src("b")], async (s) => { calls.push(s.id); return { source: s.id, results: [{ id: 3 }] }; });
assert.deepEqual(calls, ["b"], "an unconnected library is skipped");

// --- budget: hour-window library ---------------------------------------------
const HOUR = 3600000, now = Date.now();
writeUsage("unsplash", { hourStart: now - (now % HOUR), limit: 50, remaining: 1 });
assert.equal(budgetLeft("unsplash"), false, "remaining at/below RESERVE = spent");
writeUsage("unsplash", { hourStart: now - (now % HOUR), limit: 50, remaining: 40 });
assert.equal(budgetLeft("unsplash"), true, "headroom = usable");
// A stale previous hour must not carry its low count forward.
writeUsage("unsplash", { hourStart: now - (now % HOUR) - HOUR, limit: 50, remaining: 0 });
assert.equal(budgetLeft("unsplash"), true, "last hour's exhaustion doesn't carry over");

// --- budget: reset-header library (Pixabay, a rolling minute) ----------------
writeUsage("pixabay", { resetAt: Date.now() + 30000, limit: 100, remaining: 1 });
assert.equal(budgetLeft("pixabay"), false, "inside the window with no remaining = spent");
writeUsage("pixabay", { resetAt: Date.now() - 1000, limit: 100, remaining: 0 });
assert.equal(budgetLeft("pixabay"), true, "past the reset time = a fresh window");

// --- api(): records the reset window from the header -------------------------
const realFetch = globalThis.fetch;
globalThis.fetch = async () => new Response("{}", {
  status: 200,
  headers: { "x-ratelimit-limit": "100", "x-ratelimit-remaining": "97", "x-ratelimit-reset": "42" },
});
writeUsage("pixabay", {});
await api("pixabay", "Pixabay", "https://example.test/", {});
const pu = readUsage("pixabay");
assert.equal(pu.remaining, 97, "remaining is stored from the header");
assert.ok(pu.resetAt > Date.now() + 35000 && pu.resetAt < Date.now() + 45000, "resetAt tracks X-RateLimit-Reset seconds");

// api() refuses once spent, rather than making the call
writeUsage("pixabay", { resetAt: Date.now() + 30000, limit: 100, remaining: 0 });
await assert.rejects(() => api("pixabay", "Pixabay", "https://example.test/", {}), BudgetError, "a spent window throws BudgetError");
globalThis.fetch = realFetch;

// --- recordCredit: image + video ledgers stay separate -----------------------
const root = fs.mkdtempSync(path.join(os.tmpdir(), "proj-"));
recordCredit(root, "hero.avif", { source: "unsplash.com", free: true }, "images");
recordCredit(root, "loop.mp4", { source: "pexels.com", free: true }, "video");
const imgs = JSON.parse(fs.readFileSync(path.join(root, "public", "images", "credits.json"), "utf8"));
const vids = JSON.parse(fs.readFileSync(path.join(root, "public", "video", "credits.json"), "utf8"));
assert.equal(imgs.length, 1, "image credits land in public/images");
assert.equal(vids.length, 1, "video credits land in public/video");
assert.equal(vids[0].file, "loop.mp4");
// re-recording the same file replaces rather than duplicates
recordCredit(root, "hero.avif", { source: "pexels.com", free: true }, "images");
assert.equal(JSON.parse(fs.readFileSync(path.join(root, "public", "images", "credits.json"), "utf8")).length, 1, "a re-take replaces its credit row");

console.log("all cascade + budget assertions passed");
