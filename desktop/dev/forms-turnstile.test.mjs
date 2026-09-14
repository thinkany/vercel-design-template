// ©2026 thinkany llc. All rights reserved.
// FORMS ENDPOINT + TURNSTILE TEST: `node desktop/dev/forms-turnstile.test.mjs`.
//
// Drives api/forms.js in-process with a temp project and a fetch double standing in
// for Cloudflare's siteverify and the mail provider. The rules under test: a protected
// form's failed check is dropped quietly (200, nothing sent), a pass delivers, a token
// minted for another form is dropped, no secret delivers anyway, an outage fails open,
// and a form saved under the old `recaptcha` name is still protected.
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const proj = fs.mkdtempSync(path.join(os.tmpdir(), "forms-ts-"));
fs.mkdirSync(path.join(proj, "content", "forms"), { recursive: true });
const form = (id, extra) => fs.writeFileSync(path.join(proj, "content", "forms", `${id}.json`), JSON.stringify({ name: "Contact", fields: [{ id: "email", type: "email", label: "Email", required: true }], recipients: "rob@example.com", ...extra }));
form("contact", { turnstile: true });
form("open", { turnstile: false });
form("legacy", { recaptcha: true });
process.chdir(proj);
process.env.FORMS_PROVIDER = "resend"; process.env.FORMS_PROVIDER_KEY = "re_test"; process.env.FORMS_FROM = "Website <forms@example.com>";

const { default: handler } = await import(path.join(HERE, "..", "..", "api", "forms.js"));

// The double: siteverify answers by token; anything else is the provider, which "sends".
const log = { verify: [], sent: 0, outage: false };
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes("challenges.cloudflare.com/turnstile/v0/siteverify")) {
    if (log.outage) throw new Error("ECONNRESET");
    const b = JSON.parse(init.body); log.verify.push(b);
    const pass = b.response === "good-token" || b.response === "other-form-token";
    return { ok: true, status: 200, json: async () => (pass ? { success: true, action: b.response === "other-form-token" ? "newsletter" : "contact" } : { success: false, "error-codes": ["invalid-input-response"] }) };
  }
  log.sent++;
  return { ok: true, status: 200, json: async () => ({ id: "msg" }), text: async () => "" };
};

function req(body, headers = {}) {
  const res = { statusCode: 200, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(o) { this.body = o; return this; }, end() { return this; } };
  return handler({ method: "POST", headers: { accept: "application/json", "content-type": "application/json", "x-forwarded-for": "203.0.113.9, 10.0.0.1", ...headers }, body: { _t: Date.now() - 10000, email: "a@b.co", ...body } }, res).then(() => res);
}
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const reset = () => { log.verify.length = 0; log.sent = 0; log.outage = false; };

// ---- no secret in the environment: deliver, warn once ---------------------------------
delete process.env.TURNSTILE_SECRET;
{
  reset();
  const r = await req({ form: "contact" });
  ok(r.statusCode === 200 && r.body.ok && log.sent === 1 && log.verify.length === 0, "protection on but no secret: delivered without a check (the publish panel is where that is said)");
}
// ---- with the secret ---------------------------------------------------------------------
process.env.TURNSTILE_SECRET = "0xSECRET";
{
  reset();
  const r = await req({ form: "contact", "cf-turnstile-response": "good-token" });
  ok(r.statusCode === 200 && r.body.ok && log.sent === 1, "a passing token delivers");
  ok(log.verify[0].secret === "0xSECRET" && log.verify[0].response === "good-token" && log.verify[0].remoteip === "203.0.113.9", "siteverify gets the secret, the token and the visitor's ip (first hop)");
  reset();
  const bad = await req({ form: "contact", "cf-turnstile-response": "bad-token" });
  ok(bad.statusCode === 200 && bad.body.ok && log.sent === 0, "a failed check answers ok and sends nothing, exactly like the honeypot");
  reset();
  const none = await req({ form: "contact" });
  ok(none.statusCode === 200 && none.body.ok && log.sent === 0 && log.verify.length === 0, "no token at all on a protected form: dropped without asking Cloudflare");
  reset();
  const other = await req({ form: "contact", "cf-turnstile-response": "other-form-token" });
  ok(other.statusCode === 200 && other.body.ok && log.sent === 0, "a token minted for another form (action mismatch) is dropped");
  reset();
  const open = await req({ form: "open" });
  ok(open.statusCode === 200 && open.body.ok && log.sent === 1 && log.verify.length === 0, "a form with protection off is never checked");
  reset();
  const legacy = await req({ form: "legacy" });
  ok(legacy.statusCode === 200 && legacy.body.ok && log.sent === 0, "a form saved under the old `recaptcha` name is still protected");
  reset(); log.outage = true;
  const out = await req({ form: "contact", "cf-turnstile-response": "good-token" });
  ok(out.statusCode === 200 && out.body.ok && log.sent === 1, "Cloudflare unreachable: fail open, the message is delivered");
  reset();
  const hp = await req({ form: "contact", "cf-turnstile-response": "good-token", website: "spam" });
  ok(hp.body.ok && log.sent === 0 && log.verify.length === 0, "the honeypot still runs first, before any Cloudflare call");
}
console.log(`forms-turnstile: ${checks} checks pass.`);
