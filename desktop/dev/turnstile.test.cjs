// ©2026 thinkany llc. All rights reserved.
// TURNSTILE TEST: `node desktop/dev/turnstile.test.cjs`.
//
// The Cloudflare client behind Connect Cloudflare Turnstile (desktop/turnstile.cjs),
// driven against a fetch double: the token check (with and without an account listing),
// the one-widget-per-site rule (create, reuse, update hostnames, read the secret back),
// the hand-pasted secret check, and the words each refusal gets. Then the wiring pins:
// the toggle's new name everywhere, the publish hook, the endpoint's verify.
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const T = require("../turnstile.cjs");

let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const D = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(D, f), "utf8");

// A Cloudflare double: records calls, answers by route, and can be told to refuse.
function cfFetch(state = {}) {
  const calls = [];
  const widgets = state.widgets || [];
  const f = async (url, init = {}) => {
    const u = String(url); const m = init.method || "GET"; const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url: u, method: m, body, auth: init.headers && init.headers.authorization });
    const reply = (status, obj) => ({ ok: status < 300, status, json: async () => obj });
    if (state.refuse === "token") return reply(401, { success: false, errors: [{ code: 10000, message: "Authentication error" }] });
    if (u.startsWith("https://challenges.cloudflare.com/turnstile/v0/siteverify")) {
      if (body.secret === T.TEST_KEYS.secretPass) return reply(200, { success: true });
      if (body.secret === "real-secret") return reply(200, { success: false, "error-codes": ["invalid-input-response"] });
      return reply(200, { success: false, "error-codes": ["invalid-input-secret"] });
    }
    if (/\/accounts\?/.test(u)) return state.noAccounts ? reply(200, { success: true, result: [] }) : reply(200, { success: true, result: [{ id: "acct-1", name: "Rob's studio" }] });
    if (/\/accounts\/[^/]+$/.test(u)) return reply(200, { success: true, result: { id: "acct-1", name: "Rob's studio" } });
    if (/\/challenges\/widgets\?/.test(u)) {
      if (state.refuse === "permission") return reply(403, { success: false, errors: [{ code: 9109, message: "Unauthorized to access requested resource" }] });
      return reply(200, { success: true, result: widgets.map((w) => ({ ...w, secret: undefined })) });
    }
    if (m === "POST" && /\/challenges\/widgets$/.test(u)) {
      if (state.refuse === "limit") return reply(400, { success: false, errors: [{ code: 1, message: "You have reached the maximum number of widgets" }] });
      if (state.refuse === "hostname") return reply(400, { success: false, errors: [{ code: 1, message: "invalid domain" }] });
      const w = { sitekey: "0xNEW", secret: "0xNEWSECRET", name: body.name, domains: body.domains, mode: body.mode };
      widgets.push(w); return reply(200, { success: true, result: w });
    }
    if (m === "PUT" && /\/challenges\/widgets\/[^/]+$/.test(u)) { const w = widgets.find((x) => u.endsWith(encodeURIComponent(x.sitekey))); Object.assign(w, { domains: body.domains }); return reply(200, { success: true, result: { ...w, secret: undefined } }); }
    if (m === "GET" && /\/challenges\/widgets\/[^/]+$/.test(u)) { const w = widgets.find((x) => u.endsWith(encodeURIComponent(x.sitekey))); return reply(200, { success: true, result: state.hideSecret ? { ...w, secret: undefined } : w }); }
    if (m === "POST" && /rotate_secret$/.test(u)) return reply(200, { success: true, result: { sitekey: "0xOLD", secret: "0xROTATED" } });
    return reply(404, { success: false, errors: [{ code: 0, message: "no route " + u }] });
  };
  f.calls = calls; f.widgets = widgets;
  return f;
}

(async () => {
  // ---- the token check ----------------------------------------------------------
  {
    const f = cfFetch();
    const v = await T.validateToken("tok", { fetch: f });
    ok(v.ok && v.accountId === "acct-1" && v.accountName === "Rob's studio", "a token that lists accounts resolves the first account and its name");
    ok(f.calls.every((c) => c.auth === "Bearer tok"), "every call carries the token as a bearer");
    ok(f.calls.some((c) => /challenges\/widgets\?/.test(c.url)), "and the check reads that account's widgets, the one thing the token is for");
    const r = await T.validateToken("tok", { fetch: cfFetch({ refuse: "token" }) });
    ok(!r.ok && /Turnstile: Edit/.test(r.error), "a refused token says how to make the right one");
    const p = await T.validateToken("tok", { fetch: cfFetch({ refuse: "permission" }) });
    ok(!p.ok && /can't manage Turnstile widgets/.test(p.error), "a token without the permission says so");
    const n = await T.validateToken("tok", { fetch: cfFetch({ noAccounts: true }) });
    ok(!n.ok && n.needsAccountId && /Account ID/.test(n.error), "a token that can't list accounts asks for the account id");
    const w = await T.validateToken("tok", { accountId: "acct-9", fetch: cfFetch() });
    ok(w.ok && w.accountId === "acct-9", "with an account id given the listing is skipped");
    ok(!(await T.validateToken("", { fetch: cfFetch() })).ok, "an empty token is refused before any call");
  }
  // ---- one widget per site ------------------------------------------------------
  {
    const f = cfFetch();
    const a = await T.ensureWidget({ token: "tok", accountId: "acct-1", name: "thinkany:client-site", hostnames: ["https://client-site.vercel.app/", "client.com", "CLIENT.com", "localhost"], fetch: f });
    ok(a.created && a.sitekey === "0xNEW" && a.secret === "0xNEWSECRET", "no widget of that name → created, with the secret from the create response");
    const made = f.calls.find((c) => c.method === "POST");
    ok(made.body.mode === "managed" && made.body.region === "world", "managed mode, world region");
    ok(JSON.stringify(made.body.domains) === JSON.stringify(["client-site.vercel.app", "client.com"]), "hostnames are bare, deduplicated case-insensitively, and never localhost");
    const b = await T.ensureWidget({ token: "tok", accountId: "acct-1", name: "thinkany:client-site", hostnames: ["client.com", "client-site.vercel.app"], fetch: f });
    ok(!b.created && !b.updated && b.sitekey === "0xNEW" && b.secret === "0xNEWSECRET", "the same hostnames (any order) → reused, secret read back from the widget's route");
    const c = await T.ensureWidget({ token: "tok", accountId: "acct-1", name: "thinkany:client-site", hostnames: ["client.com", "client-site.vercel.app", "www.client.com"], fetch: f });
    ok(!c.created && c.updated && c.hostnames.includes("www.client.com"), "a new hostname → the widget is updated, not a second one made");
    ok(f.calls.filter((x) => x.method === "POST" && /widgets$/.test(x.url)).length === 1, "still exactly one create across three publishes");
    const hidden = cfFetch({ widgets: [{ sitekey: "0xOLD", secret: "hidden", name: "thinkany:client-site", domains: ["client.com"], mode: "managed" }], hideSecret: true });
    const d = await T.ensureWidget({ token: "tok", accountId: "acct-1", name: "thinkany:client-site", hostnames: ["client.com"], fetch: hidden });
    ok(d.secret === "0xROTATED" && hidden.calls.some((x) => /rotate_secret$/.test(x.url) && x.body.invalidate_immediately === false), "a widget whose secret can't be read is rotated with a grace period");
    for (const [refuse, re] of [["limit", /widget limit/], ["hostname", /didn't accept the hostname/], ["token", /Turnstile: Edit/]]) {
      let err = null; try { await T.ensureWidget({ token: "tok", accountId: "acct-1", name: "x", hostnames: ["client.com"], fetch: cfFetch({ refuse }) }); } catch (e) { err = e; }
      ok(err && re.test(err.message), `a ${refuse} refusal gets its own words`);
    }
    let none = null; try { await T.ensureWidget({ token: "tok", accountId: "acct-1", name: "x", hostnames: ["localhost"], fetch: cfFetch() }); } catch (e) { none = e; }
    ok(none && /no address/.test(none.message), "a site with no real address yet is refused before Cloudflare is asked");
    ok(T.hostnamesFor(Array.from({ length: 14 }, (_, i) => `h${i}.com`)).length === 10, "at most ten hostnames per widget (Cloudflare's cap)");
  }
  // ---- the hand-pasted secret -----------------------------------------------------
  {
    const f = cfFetch();
    ok((await T.verifySecret(T.TEST_KEYS.secretPass, { fetch: f })).ok, "Cloudflare's always-pass test secret passes");
    ok((await T.verifySecret("real-secret", { fetch: f })).ok, "a real secret passes even though the dummy token is refused");
    const bad = await T.verifySecret("nope", { fetch: f });
    ok(!bad.ok && /secret key/.test(bad.error), "a wrong secret is told apart from a wrong token");
    ok(f.calls.every((c) => !c.auth), "siteverify carries no bearer token");
    ok((await T.verifySecret("", { fetch: f })).ok === false, "an empty secret is refused before any call");
  }

  // ---- wiring pins ------------------------------------------------------------------
  const main = read("main.cjs"), shell = read("shell.js"), copy = read("copy.js"), preload = read("preload.cjs"), publish = read("publish.cjs");
  const forms = fs.readFileSync(path.join(D, "..", "api", "forms.js"), "utf8");
  const blocks = fs.readFileSync(path.join(D, "..", "site", "src", "lib", "builtin-blocks.tsx"), "utf8");
  const formsTs = fs.readFileSync(path.join(D, "..", "site", "src", "lib", "forms.ts"), "utf8");
  const siteTs = fs.readFileSync(path.join(D, "..", "site", "src", "lib", "site.ts"), "utf8");
  const wp = read("wp-import.cjs");
  ok(!/recaptcha/i.test(copy), "no reCAPTCHA left in the copy: the protection is Turnstile");
  ok(/formTurnstile: "Spam protection"/.test(copy) && /S\.formTurnstile\)/.test(shell) && /turnstile: rcCb\.checked/.test(shell), "the per-form toggle is Spam protection, saved as `turnstile`");
  ok(/draft\.turnstile != null \? draft\.turnstile : draft\.recaptcha/.test(shell), "a form saved under the old name still shows its toggle on");
  ok(/turnstile: !!\(f\.turnstile != null \? f\.turnstile : f\.recaptcha\)/.test(main) && /turnstile: !!\(d\.turnstile != null \? d\.turnstile : d\.recaptcha\)/.test(main), "main reads the old key and writes the new one");
  ok(/turnstile: z\.boolean\(\)\.default\(false\)/.test(formsTs) && /obj\.turnstile == null && obj\.recaptcha/.test(formsTs), "the site's schema does the same");
  ok(/turnstile: false \}, skipped \}/.test(wp), "the WordPress importer writes the new name");
  ok(/turnstileSiteKey: z\.string\(\)\.default\(""\)/.test(siteTs), "site.json carries the public site key");
  ok(/def\.turnstile && turnstileSiteKey\(\)/.test(blocks) && /cf-turnstile/.test(blocks) && /data-action=\{turnstileAction\(def\.id\)\}/.test(blocks), "the Form block renders the widget slot for a protected form, stamped with the form's action");
  ok(/window\.__taFormsPreview\|\|window\.__taTurnstile/.test(blocks), "the script loads once per page and never in the design surface's preview");
  ok(/1x00000000000000000000AA/.test(blocks) && /env\?\.DEV/.test(blocks), "the dev server shows the widget with Cloudflare's always-pass test key");
  ok(/TURNSTILE_SECRET/.test(forms) && /siteverify/.test(forms) && /return reply\(200, \{ ok: true \}\);\n  if \(!\(await turnstilePasses/.test(forms.replace(/\r/g, "")) || /if \(!\(await turnstilePasses\(\{ \.\.\.def, id \}, body, req\)\)\) return reply\(200, \{ ok: true \}\);/.test(forms), "the endpoint drops a failed check quietly, like the honeypot");
  ok(/warnedNoSecret/.test(forms) && /delivering unchecked/.test(forms), "no secret: deliver anyway, say so once");
  ok(/prepareSiteEnv/.test(publish) && /extraEnv = prepareSiteEnv \? await prepareSiteEnv\(\{ url, projectId: project\.id, projectName: project\.name \}\) : null/.test(publish), "publish runs the protection hook once the site's address is known");
  ok(publish.indexOf("prepareSiteEnv(") < publish.indexOf("collectFiles(projectDir)"), "and before the upload, so the site key it writes ships");
  ok(/TURNSTILE_SECRET: w\.secret/.test(main) && /TURNSTILE_SECRET: "" \}/.test(main) && /step: "protect"/.test(main), "main hands the secret to the site's env, clears it when off, and reports on its own row");
  ok(/name: `thinkany:\$\{vercelName \|\| projectName\}`/.test(main), "the widget is named after the site's Vercel project");
  ok(/protect: "Spam protection"/.test(shell), "the publish drawer labels that row");
  for (const h of ["turnstile:status", "turnstile:save", "turnstile:clear", "site:formsProtection", "site:saveFormsProtection"]) ok(main.includes(`ipcMain.handle("${h}"`), `IPC ${h} exists`);
  ok(/getTurnstileStatus|saveTurnstileToken|clearTurnstileToken|getFormsProtection|saveFormsProtection/.test(preload), "preload exposes the calls");
  ok(/keyShape: "cloudflare"/.test(shell) && /cloudflare: \/\^\[A-Za-z0-9_-\]\{36,64\}\$\//.test(main), "the Keys card takes a copied token from the clipboard like the library keys");
  ok(/placeholder: COPY\.licenses\.turnstileAccountIdPlaceholder, required: true/.test(shell) && /extraInput\.hidden = !opts\.extraField\.required/.test(shell), "the Account ID is asked for from the start: a Turnstile-only token can't list accounts (seen live 2026-09-13)");
  ok(/const fieldEls = extraInput \? \[wrap, extraInput\] : \[wrap\]/.test(shell) && /body\.append\(\.\.\.fieldEls, saveBtn, msg\)/.test(shell) && /ownFold\.append\(\.\.\.fieldEls, saveBtn, msg\)/.test(shell) && !/wrap\.after\(extraInput\)/.test(shell),
    "the second field is appended with the key field, not inserted beside a field that is not in the page yet (the bug seen live)");
  ok(/if \(extraMissing\(\)\) \{ msg\.textContent = opts\.extraField\.missing \|\| COPY\.licenses\.needAccountId/.test(shell), "a pasted token without the id asks for the id instead of failing");
  ok(/Copy your <b>Account ID<\/b> too/.test(copy), "and the steps say to copy it");
  ok(/function renderFormsProtection/.test(shell) && /renderFormsProtection\(ctx\.protection/.test(shell), "the Forms tab has the Spam protection section beneath Delivery");
  const rfp = shell.slice(shell.indexOf("function renderFormsProtection"), shell.indexOf("// The Forms tab: a collapsible Forms section"));
  ok(/manageBtn\.hidden = !saved\.tokenConnected/.test(rfp) && /ownToggle\.hidden = saved\.tokenConnected/.test(rfp) && /openKeys\.hidden = saved\.tokenConnected/.test(rfp),
    "connected: a Manage-your-connection button to the drawer and no manual-keys offer; not connected: a Connect button and the manual keys");
  ok(/manage: "Manage your Turnstile connection"/.test(copy), "with that wording");
  ok(/const SETUP_ORDER = \["claude", "figma", "research", "media", "turnstile"\]/.test(shell), "the setup walk-through ends with a Cloudflare Turnstile card");
  const stepDef = shell.slice(shell.indexOf('id: "turnstile"'), shell.indexOf("const SETUP_STEPS ="));
  ok(/keyShape: "cloudflare"/.test(stepDef) && /keyShape: "cloudflareAccount"/.test(stepDef) && /required: true/.test(stepDef) && /onConnected: \(res\) => done\(res \? "connected" : null\)/.test(stepDef),
    "that card is the drawer's row: token + Account ID, clipboard-filled, and it reports to the stepper");
  ok(/turnstileTitle: "Spam protection for forms"/.test(copy) && /you can connect it later under Keys & Licenses/.test(/turnstileDesc: "([^"]+)"/.exec(copy)[1]), "its copy says it is optional and where to find it later");
  ok(/TURNSTILE_SECRET\|CLOUDFLARE_API_TOKEN/.test(read("logger.cjs")), "the log redacts the new secrets");
  ok(!/—/.test(copy.slice(copy.indexOf("protection: {"), copy.indexOf("delivery: {"))) && !/—/.test(copy.slice(copy.indexOf("turnstileLabel:"), copy.indexOf("videoGroup:"))), "no em-dashes in the new copy");

  console.log(`turnstile: ${checks} checks pass.`);
})().catch((e) => { console.error(e); process.exit(1); });
