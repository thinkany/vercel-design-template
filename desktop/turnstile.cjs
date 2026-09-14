// ©2026 thinkany llc. All rights reserved.
// Cloudflare Turnstile, the app's side: the designer pastes ONE API token (Turnstile:
// Edit on their account) and from then on the app makes and keeps the widget for each
// site it publishes. This module is the Cloudflare client behind that (token check,
// widget lookup / create / update, secret check), with `fetch` injectable so it runs
// offline under desktop/dev/turnstile.test.cjs. See docs/turnstile-spec.md.
//
// Nothing here logs a token, a secret or a site key.

const API = "https://api.cloudflare.com/client/v4";
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Cloudflare's published test keys: no account needed, any hostname (localhost too).
// The site's dev server shows the widget with the always-pass pair when the project has
// no real key yet, and the harness drives the block route with the always-block one.
const TEST_KEYS = {
  siteKeyPass: "1x00000000000000000000AA",
  siteKeyBlock: "2x00000000000000000000AB",
  siteKeyInteractive: "3x00000000000000000000FF",
  secretPass: "1x0000000000000000000000000000000AA",
  secretFail: "2x0000000000000000000000000000000AA",
  dummyToken: "XXXX.DUMMY.TOKEN.XXXX",
};

// What the app shows for each way Cloudflare can say no.
const MSG = {
  refused: "Cloudflare didn't accept that token. Make a new one with the Turnstile: Edit permission on your account.",
  cantManage: "This token can't manage Turnstile widgets. Make a new one with Turnstile: Edit on your account, not a template.",
  needsAccount: "That token can't list your accounts. Paste your Account ID too (it is in the dashboard's address after dash.cloudflare.com/, and on any site's Overview page).",
  limit: "This Cloudflare account has reached its Turnstile widget limit. Remove a widget you no longer use in Cloudflare, or paste this site's keys by hand.",
  hostname: (h) => `Cloudflare didn't accept the hostname ${h}. Check the site's address in the Publish panel.`,
  unreachable: (why) => `Couldn't reach Cloudflare: ${why}`,
  secretOk: "That secret key works.",
  secretBad: "That doesn't look like this widget's secret key. Copy it again from the widget's page in Cloudflare.",
};

class TurnstileError extends Error {
  constructor(message, code = "cloudflare") { super(message); this.code = code; }
}

async function cf(token, method, route, body, fetchImpl) {
  const f = fetchImpl || globalThis.fetch;
  let res;
  try {
    res = await f(`${API}${route}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  } catch (e) { throw new TurnstileError(MSG.unreachable(e.message), "network"); }
  let j = null; try { j = await res.json(); } catch { /* not JSON */ }
  const errors = (j && Array.isArray(j.errors) ? j.errors : []).map((e) => ({ code: e && e.code, message: (e && e.message) || "" }));
  if (res.status === 401 || res.status === 403 || errors.some((e) => e.code === 10000 || e.code === 9109 || /authentication|authorization|permission/i.test(e.message))) {
    // 401: the token itself is refused. 403 on a widgets route: it exists but lacks the permission.
    throw new TurnstileError(res.status === 401 ? MSG.refused : MSG.cantManage, res.status === 401 ? "refused" : "permission");
  }
  if (!res.ok || !j || j.success === false) {
    const first = errors[0] || {};
    if (/limit|maximum|quota|too many/i.test(first.message)) throw new TurnstileError(MSG.limit, "limit");
    const host = /hostname|domain/i.test(first.message) && body && Array.isArray(body.domains) ? body.domains.join(", ") : null;
    if (host) throw new TurnstileError(MSG.hostname(host), "hostname");
    throw new TurnstileError(`Cloudflare answered ${res.status}${first.message ? `: ${first.message}` : ""}.`, "cloudflare");
  }
  return j.result;
}

// A pasted token: which account is it for, and can it see widgets there? Resolves
// { ok, accountId, accountName } or { ok:false, error, needsAccountId }.
async function validateToken(token, { accountId = "", fetch: f } = {}) {
  const t = String(token || "").trim();
  if (!t) return { ok: false, error: "Paste the Cloudflare API token first." };
  let id = String(accountId || "").trim(), name = "";
  if (!id) {
    try {
      const accounts = await cf(t, "GET", "/accounts?per_page=50", null, f);
      const list = Array.isArray(accounts) ? accounts : [];
      if (!list.length) return { ok: false, error: MSG.needsAccount, needsAccountId: true };
      id = list[0].id; name = list[0].name || "";
    } catch (e) {
      if (e.code === "refused") return { ok: false, error: e.message };
      return { ok: false, error: MSG.needsAccount, needsAccountId: true };
    }
  }
  try {
    await cf(t, "GET", `/accounts/${encodeURIComponent(id)}/challenges/widgets?per_page=1`, null, f);
  } catch (e) { return { ok: false, error: e.message, needsAccountId: !accountId && e.code !== "refused" }; }
  if (!name) { try { const a = await cf(t, "GET", `/accounts/${encodeURIComponent(id)}`, null, f); name = (a && a.name) || ""; } catch { /* the name is a nicety */ } }
  return { ok: true, accountId: id, accountName: name };
}

const cleanHost = (h) => String(h || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
// The hostnames a widget should carry: the site's addresses, deduplicated, at most
// ten (Cloudflare's cap per widget), no localhost.
function hostnamesFor(list) {
  const out = [];
  for (const h of (list || []).map(cleanHost)) if (h && !/^(localhost|127\.0\.0\.1)$/.test(h) && !out.includes(h)) out.push(h);
  return out.slice(0, 10);
}

// The one widget per site, by name. Creates it when missing (Cloudflare returns the
// secret only on create, so it is read back from the widget's own route otherwise),
// updates its hostnames when they moved. Resolves { sitekey, secret, hostnames, created, updated }.
async function ensureWidget({ token, accountId, name, hostnames, fetch: f }) {
  const acct = `/accounts/${encodeURIComponent(accountId)}/challenges/widgets`;
  const wanted = hostnamesFor(hostnames);
  if (!wanted.length) throw new TurnstileError("The site has no address yet to protect.", "hostname");
  const list = await cf(token, "GET", `${acct}?per_page=100`, null, f);
  const found = (Array.isArray(list) ? list : []).find((w) => w && w.name === name);
  if (!found) {
    const made = await cf(token, "POST", acct, { name, domains: wanted, mode: "managed", region: "world" }, f);
    return { sitekey: made.sitekey, secret: made.secret, hostnames: wanted, created: true, updated: false };
  }
  const have = (Array.isArray(found.domains) ? found.domains : []).map(cleanHost);
  const same = have.length === wanted.length && wanted.every((h) => have.includes(h));
  let w = found;
  if (!same) w = await cf(token, "PUT", `${acct}/${encodeURIComponent(found.sitekey)}`, { name, domains: wanted, mode: found.mode || "managed" }, f);
  let secret = w && w.secret;
  if (!secret) { const one = await cf(token, "GET", `${acct}/${encodeURIComponent(found.sitekey)}`, null, f); secret = one && one.secret; }
  if (!secret) {
    // Some tokens never see the secret on read; a rotation with a grace period hands it over.
    const rot = await cf(token, "POST", `${acct}/${encodeURIComponent(found.sitekey)}/rotate_secret`, { invalidate_immediately: false }, f);
    secret = rot && rot.secret;
  }
  if (!secret) throw new TurnstileError("Cloudflare returned the widget without its secret key.", "cloudflare");
  return { sitekey: found.sitekey, secret, hostnames: wanted, created: false, updated: !same };
}

// The hand-pasted fallback: is this a widget's secret? siteverify with a dummy token
// tells a bad secret ("invalid-input-secret") from a bad token ("invalid-input-response").
async function verifySecret(secret, { fetch: f } = {}) {
  const s = String(secret || "").trim();
  if (!s) return { ok: false, error: "Paste the secret key first." };
  try {
    const res = await (f || globalThis.fetch)(SITEVERIFY, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret: s, response: TEST_KEYS.dummyToken }) });
    const j = await res.json();
    const codes = Array.isArray(j["error-codes"]) ? j["error-codes"] : [];
    if (j.success === true) return { ok: true, message: MSG.secretOk };
    if (codes.includes("invalid-input-secret") || codes.includes("missing-input-secret")) return { ok: false, error: MSG.secretBad };
    return { ok: true, message: MSG.secretOk }; // the secret was accepted; only the dummy token was refused
  } catch (e) { return { ok: false, error: MSG.unreachable(e.message) }; }
}

// The published site's check, shared with api/forms.js in spirit (that file is CORE and
// self-contained; this copy serves the app's own tests and any future relay).
async function verifyToken({ secret, token, remoteip, action, fetch: f }) {
  const res = await (f || globalThis.fetch)(SITEVERIFY, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret, response: token, remoteip }) });
  const j = await res.json();
  return { pass: j.success === true && (!action || !j.action || j.action === action), codes: j["error-codes"] || [] };
}

module.exports = { validateToken, ensureWidget, verifySecret, verifyToken, hostnamesFor, TEST_KEYS, MSG, TurnstileError };
