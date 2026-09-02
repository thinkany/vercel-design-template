// Electron main process (CommonJS on purpose).
//
// Kept as .cjs so `require("electron")` returns the real main-process API.
// (An ESM entry made Electron resolve the npm stub, nulling app/ipcMain;
// createRequire didn't help. Launched with ELECTRON_RUN_AS_NODE unset — the
// harness exports it, which otherwise forces plain-Node mode.)
//
// APP vs PROJECT: this app is the pristine, distributable template source +
// toolchain. Design work happens in a SEPARATE project folder, which is what
// Vite serves and what the agent's cwd targets — so branding never touches the
// app itself. desktop/ lives only on the `electron` branch; the scaffolded
// project comes from the clean `main` branch.

const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog, Menu, nativeImage } = require("electron");

// The package name is "@figma/my-make-file"; force the product name so the macOS
// app menu (About / Hide / Quit …) and the About panel read "thinkany design".
// Must run before app is ready / the default menu is built. Covers both the dev
// run (app.getName() would otherwise fall back to package.json "name") and any
// path the packaged bundle name doesn't already override. Safe to rename: userData
// is pinned below so the display name no longer dictates where state is stored.
app.setName("thinkany design");
const { spawn, execSync, execFileSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const http = require("node:http");

// Sign in with Vercel (OAuth public client + PKCE). The client_id is public; the
// loopback redirect + fixed port are registered on the Vercel app.
const VERCEL_CLIENT_ID = "cl_cREhcnsVM9e9YNFHHBAlZ0u9IoDIcjRP";
const VERCEL_OAUTH_PORT = 9789;
const VERCEL_REDIRECT_URI = `http://127.0.0.1:${VERCEL_OAUTH_PORT}/callback`;

// ⚠ Pin userData to a STABLE id — never derive it from the display name.
// Electron defaults userData to `<appData>/<app.getName()>`, so the setName above
// would silently relocate it to `.../thinkany design/` and strand every stored
// secret + setting (anthropic-key.enc, derive-license.enc, company-profile-default
// .json, global-copy-rules.json, ui-state.json, project.json). Pinning it here
// keeps state put across renames AND upgrades (auto-update / DMG reinstall both
// preserve userData as long as this path is stable). The safeStorage keychain
// entry is keyed by appId (design.thinkany.app), so the .enc files stay decryptable
// regardless of folder. This id is load-bearing — NEVER change it (same rule as appId).
const USER_DATA_ID = "@figma/my-make-file";
app.setPath("userData", path.join(app.getPath("appData"), USER_DATA_ID));

const { TEMPLATE_EXCLUDE } = require("./template-exclude.cjs");
const { startCaptureBridge, stopCaptureBridge } = require("./capture-bridge.cjs");
const vercel = require("./publish.cjs");
const { validateCards } = require("./intake/cards.cjs");
const { createEmptyBrief, applyAnswers } = require("./intake/brief.cjs");
// Design-variety: the curated lens deck + sampler run SERVER-side (derive.thinkany.design/
// api/direction). This client POSTs signals and gets back { direction (lensLabel stamped),
// block (server-rendered) } or the knob-panel meta — async, degrades safely. See
// docs/design-variety-cloud-spec.md.
const { sampleDirection, directionMeta, recordDirection, resetMetaCache } = require("./direction-client.cjs");
const references = require("./intake/references.cjs");
const ingestRefs = require("./intake/ingest.cjs");
// Licensed design-process skills (/design, /design-brief, /promote-blocks, …): fetched
// from derive with the Design license, cached encrypted, and spliced into a turn in
// agent:prompt so the model gets the playbook while the scaffold only carries stubs.
const { createSkillsClient } = require("./skills-client.cjs");
let skillsClient = null; // built once userData is pinned + the app is ready (safeStorage)

const appRoot = path.resolve(__dirname, ".."); // the Electron app / template source (git worktree in dev; Resources/app when packaged)

// The app code is packed into an asar archive, but anything that must exist as a
// REAL file on disk is listed in build.asarUnpack and lands in a sibling
// `app.asar.unpacked/` tree. Paths derived from __dirname still say `app.asar`,
// so route them through this: spawned executables (desktop/bin), files we copy
// out (desktop/template), scripts the agent runs (scripts/), and node_modules.
// In dev (no asar in the path) it's an identity function.
function unpacked(p) {
  return p.includes(`${path.sep}app.asar${path.sep}`)
    ? p.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`)
    : p;
}

// Put desktop/bin on PATH so the agent's Bash finds `ta-export` — the stable
// CLI for the app-owned export tooling, which the exporters resolve from the
// app bundle (appRoot/scripts) and run against the current project. The agent
// (agent.mjs) runs in this process, so its tool subprocesses inherit this env.
// Idempotent across reloads.
// Give the agent's Bash a `node`. A Finder-launched packaged app has NO node on
// PATH, so `ta-export` (shebang `#!/usr/bin/env node`) and the design-from-brief
// scripts (`node scripts/*.mjs`) would fail. The `node` shim in BIN_DIR uses the
// app's own Electron binary as Node — but PREFERS a real node from the original
// PATH when present, so dev behavior (nvm node) is unchanged. Set the two env
// vars the shim reads BEFORE we prepend BIN_DIR (so TA_ORIG_PATH is node-free of
// our shim).
process.env.TA_NODE_BIN = process.execPath; // the Electron binary (run as Node via the shim)
if (!process.env.TA_ORIG_PATH) process.env.TA_ORIG_PATH = process.env.PATH || "";

const BIN_DIR = unpacked(path.join(__dirname, "bin"));
if (!(process.env.PATH || "").split(path.delimiter).includes(BIN_DIR)) {
  process.env.PATH = `${BIN_DIR}${path.delimiter}${process.env.PATH || ""}`;
}

// `ta-export reconstruct` POSTs the raw capture to the cloud derive (the IP runs
// there, never in the app). Default the client to the production endpoint; the
// agent's Bash inherits this env. A shell-provided DERIVE_ENDPOINT (set before
// launch) wins, since this only fills when unset — handy for pointing at a local
// derive. The license key is provided separately and stays unset here, so
// desktop/.env.local (DERIVE_LICENSE_KEY) supplies it for now via loadEnvLocal;
// app-managed license comes later (IP plan step 4).
if (!process.env.DERIVE_ENDPOINT) {
  process.env.DERIVE_ENDPOINT = "https://derive.thinkany.design/api/derive";
}

// Minimal zero-dep loader for desktop/.env.local (untracked) so a dev key never
// has to be exported into the shell that launches the app.
function loadEnvLocal() {
  const p = path.join(__dirname, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

// ---- API key storage --------------------------------------------------------
// Entered in-app and persisted encrypted via the OS keychain (safeStorage)
// under userData — never written into a project.
function keyFilePath() {
  return path.join(app.getPath("userData"), "anthropic-key.enc");
}
function loadStoredKey() {
  try {
    const p = keyFilePath();
    if (!fs.existsSync(p)) return null;
    const buf = fs.readFileSync(p);
    if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(buf);
    return buf.toString("utf8");
  } catch {
    return null;
  }
}
function storeKey(key) {
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(key)
    : Buffer.from(key, "utf8");
  fs.writeFileSync(keyFilePath(), data);
}
function removeStoredKey() {
  try {
    fs.unlinkSync(keyFilePath());
  } catch {
    /* already gone */
  }
}
async function validateKey(key) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    });
    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, error: "That key was rejected (401). Double-check it." };
    return { ok: false, error: `Unexpected response from the API (${res.status}).` };
  } catch (e) {
    return { ok: false, error: `Couldn't reach the API: ${e.message}` };
  }
}

// ---- Derive license (Figma export) ------------------------------------------
// Same shape as the API key: entered in-app, persisted encrypted via the OS
// keychain, and injected as DERIVE_LICENSE_KEY so `ta-export reconstruct` (run by
// the agent) can present it to the cloud derive. Gates the crown-jewel IP.
function licenseFilePath() {
  return path.join(app.getPath("userData"), "derive-license.enc");
}
function loadStoredLicense() {
  try {
    const p = licenseFilePath();
    if (!fs.existsSync(p)) return null;
    const buf = fs.readFileSync(p);
    if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(buf);
    return buf.toString("utf8");
  } catch {
    return null;
  }
}
function storeLicense(key) {
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(key)
    : Buffer.from(key, "utf8");
  fs.writeFileSync(licenseFilePath(), data);
}
function removeStoredLicense() {
  try {
    fs.unlinkSync(licenseFilePath());
  } catch {
    /* already gone */
  }
}
// Validate against the live derive service without a dedicated endpoint: POST a
// minimal (empty) CaptureBundle. A valid key derives it (200); a bad key is
// rejected before the body is read (401); an unconfigured server is 503.
async function validateLicense(key) {
  const endpoint = process.env.DERIVE_ENDPOINT;
  if (!endpoint) return { ok: false, error: "No derive endpoint is configured." };
  const probe = { contract: 1, variation: "v00", views: [], widths: {}, brand: { colorVars: {}, fontVars: {} }, pages: [], blocks: [], assets: [] };
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-license-key": key },
      body: JSON.stringify(probe),
    });
    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, error: "That license key was rejected." };
    if (res.status === 503) return { ok: false, error: "The license service isn't configured yet." };
    return { ok: false, error: `Unexpected response from the license service (${res.status}).` };
  } catch (e) {
    return { ok: false, error: `Couldn't reach the license service: ${e.message}` };
  }
}

// ---- Design license (Design / Research / Director bundle) -------------------
// Its OWN key (DESIGN_LICENSE_KEY), a SEPARATE Vercel env from the Figma export's
// DERIVE_LICENSE_KEY. Same encrypted-keychain shape; validated against /api/direction;
// injected into env on boot so researchLicensed()/varietyLicensed() and
// direction-client.cjs all see it.
function designLicenseFilePath() { return path.join(app.getPath("userData"), "design-license.enc"); }
function loadStoredDesignLicense() {
  try {
    const p = designLicenseFilePath();
    if (!fs.existsSync(p)) return null;
    const buf = fs.readFileSync(p);
    if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(buf);
    return buf.toString("utf8");
  } catch { return null; }
}
function storeDesignLicense(key) {
  const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(key) : Buffer.from(key, "utf8");
  fs.writeFileSync(designLicenseFilePath(), data);
}
function removeStoredDesignLicense() { try { fs.unlinkSync(designLicenseFilePath()); } catch { /* already gone */ } }
// /api/direction lives beside /api/derive on the same host.
function directionEndpoint() {
  if (process.env.DIRECTION_ENDPOINT) return process.env.DIRECTION_ENDPOINT;
  return (process.env.DERIVE_ENDPOINT || "https://derive.thinkany.design/api/derive").replace(/\/api\/derive\/?$/, "/api/direction");
}
// Validate by POSTing the cheapest op (meta): 200 valid, 401 rejected, 503 unconfigured.
async function validateDesignLicense(key) {
  try {
    const res = await fetch(directionEndpoint(), { method: "POST", headers: { "content-type": "application/json", "x-license-key": key }, body: JSON.stringify({ op: "meta" }) });
    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, error: "That license key was rejected." };
    if (res.status === 503) return { ok: false, error: "The license service isn't configured yet." };
    return { ok: false, error: `Unexpected response from the license service (${res.status}).` };
  } catch (e) { return { ok: false, error: `Couldn't reach the license service: ${e.message}` }; }
}

// ---- Vercel token + scope (in-app Publish) ----------------------------------
// Same encrypted-secret shape as the API key / license: entered in-app, persisted
// via the OS keychain under userData. Unlike those, it's used ONLY by the main
// process's publish handlers (never a subprocess), so it stays in a module var and
// out of process.env. The chosen team scope is public identity, not a secret →
// plain JSON alongside it.
// `vercelAuth` holds one of:
//   { kind: "token", token }                              — a pasted access token
//   { kind: "oauth", accessToken, refreshToken, expiresAt } — Sign in with Vercel
// Persisted (encrypted) as JSON. A legacy plain-string file is read as a pasted token.
let vercelAuth = null;
function vercelTokenFilePath() {
  return path.join(app.getPath("userData"), "vercel-token.enc");
}
function readVercelAuthRaw() {
  try {
    const p = vercelTokenFilePath();
    if (!fs.existsSync(p)) return null;
    const buf = fs.readFileSync(p);
    if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(buf);
    return buf.toString("utf8");
  } catch {
    return null;
  }
}
function parseVercelAuth(raw) {
  if (!raw) return null;
  try { const o = JSON.parse(raw); if (o && o.kind) return o; } catch { /* not JSON */ }
  return { kind: "token", token: raw }; // legacy: a bare pasted token string
}
function loadVercelAuth() { return parseVercelAuth(readVercelAuthRaw()); }
function storeVercelAuth(obj) {
  const data = JSON.stringify(obj);
  const enc = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(data) : Buffer.from(data, "utf8");
  fs.writeFileSync(vercelTokenFilePath(), enc);
  vercelAuth = obj;
}
function removeStoredVercelToken() {
  try { fs.unlinkSync(vercelTokenFilePath()); } catch { /* already gone */ }
}
// A valid access token for API calls: refreshes an expired OAuth token lazily.
// Returns null if not connected or a refresh fails (caller reports "connect first").
async function vercelAccessToken() {
  if (!vercelAuth) return null;
  if (vercelAuth.kind === "token") return vercelAuth.token;
  if (vercelAuth.kind === "oauth") {
    if (Date.now() < (vercelAuth.expiresAt || 0) - 60000) return vercelAuth.accessToken; // 1-min skew
    if (!vercelAuth.refreshToken) return null;
    const r = await vercel.refreshOAuthToken({ clientId: VERCEL_CLIENT_ID, refreshToken: vercelAuth.refreshToken });
    if (!r.ok) return null;
    storeVercelAuth({ ...vercelAuth, accessToken: r.accessToken, refreshToken: r.refreshToken, expiresAt: Date.now() + r.expiresIn * 1000 });
    return vercelAuth.accessToken;
  }
  return null;
}
function b64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
// The little page shown in the browser after the redirect, so the user knows to
// return to the app.
function oauthResultPage(ok, message) {
  const title = ok ? "Connected to Vercel" : "Couldn't connect";
  const body = ok ? "You can close this tab and return to thinkany design." : (message || "Something went wrong. Return to thinkany design and try again.");
  return `<!doctype html><meta charset="utf-8"><title>${title}</title><style>body{font:15px -apple-system,system-ui,sans-serif;color:#1a1a1a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#fafafa}.c{max-width:340px;text-align:center;padding:28px}h1{font-size:17px;margin:0 0 8px}p{color:#555;margin:0}</style><div class="c"><h1>${title}</h1><p>${body}</p></div>`;
}
// Run the full Sign in with Vercel flow: PKCE, a one-shot loopback listener on the
// registered port, open the authorize URL, catch the code, exchange it (no secret).
// Resolves { ok, accessToken, refreshToken, expiresIn } or { ok:false, error }.
function runVercelOAuth() {
  const codeVerifier = crypto.randomBytes(43).toString("hex");
  const codeChallenge = b64url(crypto.createHash("sha256").update(codeVerifier).digest());
  const state = crypto.randomBytes(24).toString("hex");
  const authUrl = "https://vercel.com/oauth/authorize?" + new URLSearchParams({
    client_id: VERCEL_CLIENT_ID,
    redirect_uri: VERCEL_REDIRECT_URI,
    response_type: "code",
    scope: "openid offline_access",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  }).toString();

  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { server.close(); } catch { /* already closing */ }
      resolve(result);
    };
    const server = http.createServer(async (req, res) => {
      let parsed;
      try { parsed = new URL(req.url, VERCEL_REDIRECT_URI); } catch { res.writeHead(400); res.end(); return; }
      if (parsed.pathname !== "/callback") { res.writeHead(404); res.end(); return; }
      console.log("[vercel-oauth] callback:", parsed.search); // surface Vercel's real response
      const code = parsed.searchParams.get("code");
      const retState = parsed.searchParams.get("state");
      const err = parsed.searchParams.get("error");
      const errDesc = parsed.searchParams.get("error_description");
      const reply = (ok, msg) => { res.writeHead(200, { "content-type": "text/html" }); res.end(oauthResultPage(ok, msg)); };
      if (err) {
        const detail = errDesc ? `${err}: ${errDesc}` : err;
        reply(false, detail);
        return finish({ ok: false, error: `Vercel returned "${detail}".` });
      }
      if (retState !== state) { reply(false, "State mismatch."); return finish({ ok: false, error: "Authorization response didn't match (state mismatch)." }); }
      if (!code) { reply(false, "No authorization code was returned."); return finish({ ok: false, error: "No authorization code was returned." }); }
      try {
        const ex = await vercel.exchangeOAuthCode({ clientId: VERCEL_CLIENT_ID, code, codeVerifier, redirectUri: VERCEL_REDIRECT_URI });
        reply(ex.ok, ex.ok ? null : ex.error);
        finish(ex);
      } catch (e) {
        reply(false, e.message);
        finish({ ok: false, error: e.message });
      }
    });
    server.on("error", (e) => finish({ ok: false, error: e.code === "EADDRINUSE" ? `Port ${VERCEL_OAUTH_PORT} is in use — close whatever is using it and try again.` : e.message }));
    server.listen(VERCEL_OAUTH_PORT, "127.0.0.1", () => { shell.openExternal(authUrl); });
    timer = setTimeout(() => finish({ ok: false, error: "Timed out waiting for authorization (5 min)." }), 5 * 60 * 1000);
  });
}

function vercelScopeFile() {
  return path.join(app.getPath("userData"), "vercel-scope.json");
}
function loadVercelScope() {
  try { return JSON.parse(fs.readFileSync(vercelScopeFile(), "utf8")) || {}; }
  catch { return {}; }
}
function saveVercelScope(scope) {
  fs.writeFileSync(vercelScopeFile(), JSON.stringify(scope || {}, null, 2));
}
function clearVercelScope() {
  try { fs.unlinkSync(vercelScopeFile()); } catch { /* already gone */ }
}

// ---- Per-project publish record ---------------------------------------------
// Non-secret linkage (project name, live URL, last deploy), stored in the project
// alongside sessions/voice/research. Per the spec: the gate password is NOT kept
// here — only a set/not-set flag — so publish.json never carries a credential.
function publishFile(dir) { return path.join(dir, ".thinkany", "publish.json"); }
function loadPublish(dir) {
  if (!dir) return {};
  try { return JSON.parse(fs.readFileSync(publishFile(dir), "utf8")) || {}; }
  catch { return {}; }
}
function savePublish(dir, obj) {
  if (!dir) return;
  fs.mkdirSync(path.join(dir, ".thinkany"), { recursive: true });
  fs.writeFileSync(publishFile(dir), JSON.stringify(obj || {}, null, 2));
}

// Read the project's committed .env (public VITE_* brand config) into a map, so we
// can map VITE_CLIENT_NAME/VITE_PROJECT_NAME → the gate's CLIENT_NAME/PROJECT_TITLE.
function readProjectEnv(dir) {
  const out = {};
  try {
    for (const line of fs.readFileSync(path.join(dir, ".env"), "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      out[k] = v;
    }
  } catch { /* no .env */ }
  return out;
}
// Upsert a single KEY="value" into a project's .env, preserving everything else
// (comments, order, other keys). Appends the key if it isn't present yet.
function upsertProjectEnv(dir, key, value) {
  const envPath = path.join(dir, ".env");
  let env = "";
  try { env = fs.readFileSync(envPath, "utf8"); } catch { /* fresh — start empty */ }
  const line = `${key}="${String(value).replace(/"/g, "")}"`;
  const re = new RegExp(`^${key}=.*$`, "m");
  env = re.test(env) ? env.replace(re, line) : (env.replace(/\s*$/, "") + `\n${line}\n`);
  fs.writeFileSync(envPath, env);
}

// Save an uploaded brand logo ({ filename, mime, b64 }) into the open project's
// public/images and wire it into .env (VITE_BRAND_LOGO) so the scaffold's header/
// footer render it automatically. Returns a light { src, filename } descriptor for
// the Brief (never the base64), or null if there's no project / bad payload.
const LOGO_EXT_BY_MIME = {
  "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/avif": ".avif", "image/svg+xml": ".svg",
};
function saveDesignLogo(raw) {
  if (!currentProject || !raw || !raw.b64) return null;
  try {
    const ext = LOGO_EXT_BY_MIME[raw.mime] || path.extname(raw.filename || "").toLowerCase() || ".png";
    const dir = path.join(currentProject, "public", "images");
    fs.mkdirSync(dir, { recursive: true });
    // Drop any prior logo.* so a re-upload in a different format leaves no orphan.
    for (const e of Object.values(LOGO_EXT_BY_MIME)) {
      try { fs.unlinkSync(path.join(dir, "logo" + e)); } catch { /* not there */ }
    }
    const fname = "logo" + ext;
    fs.writeFileSync(path.join(dir, fname), Buffer.from(raw.b64, "base64"));
    const src = "/images/" + fname;
    upsertProjectEnv(currentProject, "VITE_BRAND_LOGO", src);
    return { src, filename: raw.filename || fname };
  } catch { return null; }
}

// A DNS-safe Vercel project name from the client/project/folder name.
// Accents are FOLDED to their plain letters first (ō→o, é→e, ñ→n) via NFKD +
// stripping combining marks, so "mōr" becomes "mor" and not "m-r".
function deriveProjectName(dir) {
  const env = readProjectEnv(dir);
  const raw = env.VITE_CLIENT_NAME || env.VITE_PROJECT_NAME || path.basename(dir) || "preview";
  const slug = String(raw)
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 52);
  return slug || "preview";
}
function gateEnvFor(dir) {
  const env = readProjectEnv(dir);
  return {
    CLIENT_NAME: env.VITE_CLIENT_NAME || path.basename(dir) || "Preview",
    PROJECT_TITLE: env.VITE_PROJECT_NAME || "",
  };
}

// ---- Site build (the public website) -----------------------------------------
// A project is site-ready once a design has been PROMOTED (/promote-blocks): the
// site target exists, content/site.json pins a real variation, and there's a home
// page to render. Before that the Site publish stays off with a plain reason.
function siteReady(dir) {
  try {
    if (!fs.existsSync(path.join(dir, "site", "astro.config.mjs"))) return { ready: false, reason: "no-site" };
    const sj = JSON.parse(fs.readFileSync(path.join(dir, "content", "site.json"), "utf8"));
    if (!sj.design || sj.design === "v00") return { ready: false, reason: "not-promoted" };
    if (!fs.existsSync(path.join(dir, "content", "pages", "home.json"))) return { ready: false, reason: "no-home" };
    return { ready: true, design: sj.design };
  } catch {
    return { ready: false, reason: "not-promoted" };
  }
}
// The deps the site build needs, guaranteed in the PROJECT's package.json (Vercel
// installs from it). Locally they come from the app's node_modules regardless, but
// package.json is designer-owned (REVIEW tier) so a project scaffolded before the
// site target never received them. Versions come from the bundled scaffold
// package.json (the same ones a fresh scaffold gets); scripts too. Idempotent.
const SITE_DEP_KEYS = ["astro", "@astrojs/react", "@astrojs/sitemap", "vite"];
const SITE_SCRIPTS = { "site:dev": "astro dev --root site", "site:build": "astro build --root site", "site:preview": "astro preview --root site" };
const SITE_BUILD_SCRIPT_DEPS = ["sharp"];
function ensureSiteDeps(dir) {
  const pkgPath = path.join(dir, "package.json");
  let pkg, scaffold;
  try { pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")); } catch { return { changed: false }; }
  try { scaffold = JSON.parse(fs.readFileSync(path.join(__dirname, "build", "scaffold-package.json"), "utf8")); } catch { return { changed: false }; }
  let changed = false;
  pkg.dependencies = pkg.dependencies || {};
  for (const k of SITE_DEP_KEYS) {
    const want = scaffold.dependencies && scaffold.dependencies[k];
    if (want && pkg.dependencies[k] !== want) { pkg.dependencies[k] = want; changed = true; }
  }
  pkg.scripts = pkg.scripts || {};
  for (const [k, v] of Object.entries(SITE_SCRIPTS)) {
    if (!pkg.scripts[k]) { pkg.scripts[k] = v; changed = true; }
  }
  // pnpm 10 (Vercel's default) refuses to run a dependency's install script unless
  // the package approves it, and fails the install outright (ERR_PNPM_IGNORED_BUILDS).
  // Astro pulls in sharp for its image service; approve it here so the site builds.
  pkg.pnpm = pkg.pnpm || {};
  const approved = new Set(pkg.pnpm.onlyBuiltDependencies || []);
  for (const dep of SITE_BUILD_SCRIPT_DEPS) {
    if (!approved.has(dep)) { approved.add(dep); changed = true; }
  }
  pkg.pnpm.onlyBuiltDependencies = [...approved];
  if (changed) fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  // pnpm 11 (the scaffold's packageManager, honored by Vercel) reads build approvals
  // from pnpm-workspace.yaml only; the package.json field above serves older pnpm.
  if (ensurePnpmWorkspaceApprovals(dir, SITE_BUILD_SCRIPT_DEPS)) changed = true;
  return { changed };
}
// Allow `deps` to run install scripts in the project's pnpm-workspace.yaml, which
// is where pnpm 10+ reads settings (the scaffold pins pnpm 11; Vercel honors it).
// pnpm 11 syntax: an `allowBuilds:` map of `name: true`. Minimal, line-based: the
// file is the scaffold's and holds settings only. Created when absent.
function ensurePnpmWorkspaceApprovals(dir, deps) {
  const p = path.join(dir, "pnpm-workspace.yaml");
  let text = "";
  try { text = fs.readFileSync(p, "utf8"); } catch { /* absent */ }
  const before = text;
  const keyRe = /^allowBuilds:[ \t]*$/m;
  if (!keyRe.test(text)) {
    text = text.replace(/\s*$/, "") + (text.trim() ? "\n" : "") + "allowBuilds:\n";
  }
  for (const dep of deps) {
    const esc = dep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`^[ \\t]+'?${esc}'?:[ \\t]*true`, "m").test(text)) continue;
    text = text.replace(keyRe, (m) => `${m}\n  ${dep}: true`);
  }
  if (!text.endsWith("\n")) text += "\n";
  if (text !== before) { fs.writeFileSync(p, text); return true; }
  return false;
}
// After a site publish, the canonical URL in content/site.json follows the live
// address so local builds (and llms.txt / sitemap) agree with production.
function setSiteUrl(dir, url) {
  try {
    const p = path.join(dir, "content", "site.json");
    const sj = JSON.parse(fs.readFileSync(p, "utf8"));
    if (sj.url === url) return;
    sj.url = url;
    fs.writeFileSync(p, JSON.stringify(sj, null, 2) + "\n");
  } catch { /* no site.json → nothing to pin */ }
}

// ---- Project (workspace) storage --------------------------------------------
function projectConfigPath() {
  return path.join(app.getPath("userData"), "project.json");
}
function loadProjectPath() {
  try {
    const cfg = JSON.parse(fs.readFileSync(projectConfigPath(), "utf8"));
    if (cfg && cfg.path && fs.existsSync(cfg.path)) return cfg.path;
  } catch {
    /* none yet */
  }
  return null;
}
function saveProjectPath(p) {
  fs.writeFileSync(projectConfigPath(), JSON.stringify({ path: p }, null, 2));
  addRecentProject(p);
}
// Most-recently-opened list (for the Switch Projects drawer). Newest first, deduped.
function addRecentProject(dir) {
  if (!dir) return;
  const prev = (loadUiState().recentProjects || []).filter((x) => x && x !== dir);
  setUiState({ recentProjects: [dir, ...prev].slice(0, 8) });
}
// Read a project's identity from its committed .env (folder names aren't reliable
// identifiers). Returns { client, project } (either may be empty).
function readProjectMeta(dir) {
  let client = "", project = "", company = "";
  try {
    const env = fs.readFileSync(path.join(dir, ".env"), "utf8");
    const get = (k) => {
      const m = env.match(new RegExp("^\\s*" + k + "\\s*=\\s*(.*)$", "m"));
      return m ? m[1].trim().replace(/^["']|["']$/g, "").trim() : "";
    };
    client = get("VITE_CLIENT_NAME");
    project = get("VITE_PROJECT_NAME");
    company = get("VITE_COMPANY_NAME");
  } catch {
    /* no .env yet */
  }
  return { client, project, company };
}
function clearProjectPath() {
  try {
    fs.unlinkSync(projectConfigPath());
  } catch {
    /* already gone */
  }
}

// ---- Session history (project-scoped) ---------------------------------------
// New sessions start empty; when the user leaves a project or quits, the current
// session is archived into the PROJECT (portable, self-contained) and listed in
// the Claude drawer. Reopening one restores its chat (parsed transcript) AND
// resumes its model context (SDK `resume: sessionId`). The SDK already persists
// each session's transcript at ~/.claude/projects/<encoded-cwd>/<id>.jsonl; we
// copy that into the project so history travels with it and survives ~/.claude
// being cleared.
let currentSessionId = null; // tracked from agent:prompt so quit can archive it

function sessionsDir(project) { return path.join(project, ".thinkany", "sessions"); }
function sessionsIndexPath(project) { return path.join(sessionsDir(project), "index.json"); }
function loadSessionsIndex(project) {
  try { return JSON.parse(fs.readFileSync(sessionsIndexPath(project), "utf8")) || []; }
  catch { return []; }
}
function saveSessionsIndex(project, arr) {
  fs.mkdirSync(sessionsDir(project), { recursive: true });
  fs.writeFileSync(sessionsIndexPath(project), JSON.stringify(arr, null, 2));
}

// The SDK encodes a project dir as its cwd with every non-alphanumeric char → "-".
function sdkProjectDir(cwd) {
  return path.join(app.getPath("home"), ".claude", "projects", cwd.replace(/[^A-Za-z0-9]/g, "-"));
}
// Find a session's SDK transcript by id (scan project dirs — robust to encoding).
function findSdkTranscript(sessionId) {
  const base = path.join(app.getPath("home"), ".claude", "projects");
  try {
    for (const dir of fs.readdirSync(base)) {
      const p = path.join(base, dir, sessionId + ".jsonl");
      if (fs.existsSync(p)) return p;
    }
  } catch { /* none */ }
  return null;
}

function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.filter((b) => b && b.type === "text").map((b) => b.text || "").join("");
  return "";
}
// Turn a transcript JSONL into a clean chat: real user prompts + assistant prose.
// Skips injected/meta user turns (isMeta, or <command-*>/<system-reminder>… wrappers,
// all of which start with "<"), tool_result user turns, and thinking/tool_use blocks.
function parseTranscript(jsonl) {
  const messages = [];
  let title = "";
  for (const line of String(jsonl).split("\n")) {
    if (!line.trim()) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.type === "ai-title" && o.aiTitle) { title = o.aiTitle; continue; }
    if (o.type === "user") {
      if (o.isMeta) continue;
      const text = extractText(o.message && o.message.content).trim();
      if (!text || text.startsWith("<")) continue; // command/system wrappers + tool_results
      messages.push({ role: "user", text });
    } else if (o.type === "assistant") {
      const text = extractText(o.message && o.message.content).trim();
      if (!text) continue; // thinking/tool_use-only turns
      messages.push({ role: "assistant", text });
    }
  }
  if (!title) {
    const firstUser = messages.find((m) => m.role === "user");
    title = firstUser ? firstUser.text.replace(/\s+/g, " ").slice(0, 60) : "Untitled session";
  }
  return { title, messages };
}

// Archive the given session into the project. Idempotent per sessionId (refreshes
// an existing entry); skips sessions with no real messages. Returns the record.
function archiveSession(project, sessionId) {
  if (!project || !sessionId) return null;
  const src = findSdkTranscript(sessionId);
  if (!src) return null;
  let jsonl; try { jsonl = fs.readFileSync(src, "utf8"); } catch { return null; }
  const { title, messages } = parseTranscript(jsonl);
  if (!messages.length) return null; // nothing worth keeping
  fs.mkdirSync(sessionsDir(project), { recursive: true });
  const idx = loadSessionsIndex(project);
  let rec = idx.find((s) => s.sessionId === sessionId);
  if (!rec) {
    const createdAt = new Date().toISOString();
    const stamp = createdAt.replace(/[:.]/g, "-").replace("T", "_").slice(0, 17);
    rec = { id: sessionId, sessionId, createdAt, title, file: `${stamp}-${sessionId.slice(0, 8)}.jsonl` };
    idx.unshift(rec);
  } else {
    rec.title = title; // refresh title/content on re-archive
  }
  fs.copyFileSync(src, path.join(sessionsDir(project), rec.file));
  saveSessionsIndex(project, idx);
  return rec;
}

// Before resuming a copied-in session, make sure its transcript is where the SDK
// looks (copy our portable copy back if ~/.claude was cleared / project moved).
function ensureSdkTranscript(project, rec) {
  const dest = path.join(sdkProjectDir(project), rec.sessionId + ".jsonl");
  if (fs.existsSync(dest)) return;
  const copy = path.join(sessionsDir(project), rec.file);
  if (!fs.existsSync(copy)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(copy, dest);
}

// Delete one archived session (its copied transcript + index entry). Leaves the
// SDK's own ~/.claude transcript alone (that's the SDK's, not ours).
function deleteSession(project, id) {
  const idx = loadSessionsIndex(project);
  const rec = idx.find((s) => s.id === id);
  if (rec) { try { fs.unlinkSync(path.join(sessionsDir(project), rec.file)); } catch { /* gone */ } }
  saveSessionsIndex(project, idx.filter((s) => s.id !== id));
}
function deleteAllSessions(project) {
  for (const rec of loadSessionsIndex(project)) {
    try { fs.unlinkSync(path.join(sessionsDir(project), rec.file)); } catch { /* gone */ }
  }
  saveSessionsIndex(project, []);
}

// ---- UI state: remember the last-used folder per dialog ----------------------
function uiStatePath() {
  return path.join(app.getPath("userData"), "ui-state.json");
}
function loadUiState() {
  try {
    return JSON.parse(fs.readFileSync(uiStatePath(), "utf8")) || {};
  } catch {
    return {};
  }
}
// Directory to open a dialog in (the remembered one, if it still exists).
function lastDir(key) {
  const v = loadUiState()[key];
  return v && fs.existsSync(v) ? v : undefined;
}
function setUiState(patch) {
  try {
    fs.writeFileSync(uiStatePath(), JSON.stringify({ ...loadUiState(), ...patch }, null, 2));
  } catch {
    /* best effort */
  }
}
// Remember the *parent* folder of a chosen path, so the dialog reopens where
// the user was browsing.
function rememberDir(key, chosenPath) {
  if (chosenPath) setUiState({ [key]: path.dirname(chosenPath) });
}

// A project has an "active design" once setup has created a working variation
// (src/variations/<id>/). Before that, a fresh scaffold has only the base
// blueprint — which the app hides behind a welcome placeholder rather than
// showing the template's blueprint dashboard mid-setup.
//
// `previewReady` gates when the LIVE PREVIEW opens. The variation folder exists
// from the moment setup copies the base (before the styleguide has any client
// colors), so opening on folder-existence pops a blank preview mid-setup. Instead
// the styleguide flow writes `previewReady:false` when it creates the variation
// and flips it to true once the color palette is written — so the browser opens
// on real content. Backward-compatible: an existing variation.json with no field
// (or true) reads as ready, so already-set-up designs open normally.
function detectDesign(projectDir) {
  try {
    const ids = fs
      .readdirSync(path.join(projectDir, "src", "variations"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    if (ids.length) {
      const id = ids[0];
      // Default NOT ready. A variation folder can exist for a moment during setup
      // (`mkdir v01 && cp -R base…`) BEFORE its variation.json is written — opening
      // then pops a blank preview. Only a READABLE variation.json makes it ready
      // (and only if it doesn't say previewReady:false). Every real, set-up
      // variation has a variation.json, so an already-configured design with the
      // field absent still reads as ready.
      let previewReady = false;
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(projectDir, "src", "variations", id, "variation.json"), "utf8"));
        previewReady = meta.previewReady !== false;
      } catch {
        /* folder exists but no/unreadable variation.json yet → still being created */
      }
      return { active: true, variationId: id, previewReady };
    }
  } catch {
    /* no variations dir yet = fresh */
  }
  return { active: false, variationId: null, previewReady: false };
}

// Vite and its deps WRITE into the node_modules root at runtime — the `.vite-temp`
// config bundle and the `.vite` dep-optimization cache. In a packaged build the
// bundled node_modules lives INSIDE the signed, immutable .app (Contents/Resources/
// app/node_modules); writing there breaks the code-signature seal, and macOS then
// refuses to open the app ("damaged … move to Trash"). So on a packaged build we
// materialize a WRITABLE copy of the bundled node_modules under userData — once per
// app version, via an APFS clone (`cp -Rc`, copy-on-write: near-instant, no extra
// disk) — and run Vite + link every project against THAT. Dev builds run from the
// writable worktree node_modules directly.
let _modulesRoot = null;
function modulesRoot() {
  if (_modulesRoot) return _modulesRoot;
  const bundled = unpacked(path.join(appRoot, "node_modules"));
  if (!app.isPackaged) { _modulesRoot = bundled; return bundled; }
  const runtimeDir = path.join(app.getPath("userData"), "runtime");
  const dest = path.join(runtimeDir, "node_modules");
  const stamp = path.join(runtimeDir, "node_modules.version");
  const want = app.getVersion();
  let have = null;
  try { have = fs.readFileSync(stamp, "utf8").trim(); } catch { /* first run */ }
  if (have !== want || !fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(runtimeDir, { recursive: true });
    // APFS copy-on-write clone (same volume as the .app); deep-copy fallback off-APFS.
    try { execFileSync("/bin/cp", ["-Rc", bundled, dest]); }
    catch { fs.cpSync(bundled, dest, { recursive: true, verbatimSymlinks: true }); }
    fs.writeFileSync(stamp, want);
  }
  _modulesRoot = dest;
  return dest;
}

// Point a project folder at the app's writable deps (modulesRoot) so Vite runs
// without a per-project `npm install`. CRUCIAL: also REPOINT a stale symlink. A
// project scaffolded by an OLDER app version carries `node_modules` → that app's
// BUNDLE node_modules; opening it here and running Vite would make Vite write
// .vite-temp / .vite into that SIGNED bundle and break its code signature (macOS
// then says "damaged, move to Trash"). So if node_modules is a symlink pointing
// anywhere other than the current modulesRoot, replace it. Never touch a REAL
// node_modules directory (a project that has its own installed deps).
function linkNodeModules(projectDir) {
  const projModules = path.join(projectDir, "node_modules");
  const want = modulesRoot();
  let info = null;
  try { info = fs.lstatSync(projModules); } catch { /* missing */ }
  if (info && info.isSymbolicLink()) {
    let cur = null;
    try { cur = fs.readlinkSync(projModules); } catch { /* unreadable link */ }
    if (cur === want) return;                       // already points at the clone
    try { fs.unlinkSync(projModules); } catch {}    // stale/broken link → drop it
    info = null;
  }
  if (!info) fs.symlinkSync(want, projModules, "dir");
  // else: a real node_modules directory — leave it alone.
}

// Scaffold a pristine project into targetDir, then link node_modules.
//
// Two sources, same result (identical file-for-file):
//   • Dev (unpackaged): export the clean `main` branch with `git archive main`
//     — the worktree has the git repo, no snapshot needed.
//   • Packaged (.app): a bundled template snapshot at desktop/template/ (built
//     by build/make-template.cjs before electron-builder) — a packaged app has
//     no git repo, so we copy that pristine dir instead.
// TEMPLATE_EXCLUDE (app-internal IP) is stripped in dev via tar --exclude and,
// in both modes, re-stripped as belt-and-suspenders after materializing.
function scaffoldProject(targetDir) {
  const bundledTemplate = unpacked(path.join(appRoot, "desktop", "template"));
  if (app.isPackaged || fs.existsSync(bundledTemplate)) {
    // Copy from the bundled snapshot (packaged, or dev after a `predist` build).
    fs.cpSync(bundledTemplate, targetDir, { recursive: true });
  } else {
    const excludes = TEMPLATE_EXCLUDE
      .map((p) => `--exclude="${p}" --exclude="${p}/*"`)
      .join(" ");
    execSync(`git -C "${appRoot}" archive main | tar -x ${excludes} -C "${targetDir}"`, { stdio: "pipe" });
    // The archived root package.json + CLAUDE.md are the ELECTRON app's; swap in the clean
    // scaffold ones. (The bundled-snapshot branch above already carries the swapped copies
    // from make-template.)
    const scaffoldPkg = path.join(appRoot, "desktop", "build", "scaffold-package.json");
    if (fs.existsSync(scaffoldPkg)) fs.copyFileSync(scaffoldPkg, path.join(targetDir, "package.json"));
    const scaffoldClaude = path.join(appRoot, "desktop", "build", "scaffold-CLAUDE.md");
    if (fs.existsSync(scaffoldClaude)) fs.copyFileSync(scaffoldClaude, path.join(targetDir, "CLAUDE.md"));
  }
  // Guarantee nothing on the exclude list survived, regardless of source/variant.
  for (const p of TEMPLATE_EXCLUDE) {
    fs.rmSync(path.join(targetDir, p), { recursive: true, force: true });
  }
  linkNodeModules(targetDir);
}

// Refresh the app-owned FRAMEWORK files (the CORE tier) in an EXISTING project from
// the bundled template snapshot — run on every project open. This is what makes a new
// .dmg carry new command/onboarding/chrome behavior into projects that were scaffolded
// by an older build, WITHOUT the designer running `/upgrade`: the app owns framework
// files, the designer owns their work. Diff-only (writes just what changed → no Vite
// churn when already current); the manifest's KEEP tier (their `.env`, `src/variations/**`,
// pages/menu, palette) is never touched, and REVIEW files (package.json) are left to
// manual `/upgrade`. Best-effort + silent: it must never block or fail opening a project.
async function refreshFrameworkFiles(projectDir) {
  try {
    if (!projectDir) return null;
    // Only our template projects — the version marker gates it so we never overlay
    // template files onto an unrelated folder someone opened by mistake.
    if (!fs.existsSync(path.join(projectDir, "public", "version.json"))) return null;
    const snapshot = unpacked(path.join(appRoot, "desktop", "template"));
    if (!fs.existsSync(snapshot)) return null; // dev without a built snapshot → skip
    const enginePath = path.join(snapshot, "scripts", "upgrade.mjs");
    const { runRefresh } = await import(pathToFileURL(enginePath).href);
    if (typeof runRefresh !== "function") return null; // older snapshot engine
    const report = await runRefresh({ targetDir: projectDir, source: snapshot });
    if (report && report.changed && report.changed.length) {
      console.log(`[main] framework refresh: ${report.changed.length} file(s) updated in ${path.basename(projectDir)} (v${report.fromVersion ?? "?"} → v${report.toVersion ?? "?"})`);
    }
    return report;
  } catch (e) {
    console.error("[main] framework refresh failed:", e.message);
    return null;
  }
}

let currentProject = null;
let currentModel = null; // agent model override; null = SDK default
let viteProc = null;
let viteUrl = null;
let mainWindow = null;

// List the models this API key can use (same endpoint as key validation).
async function fetchModels() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "No API key." };
  try {
    const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    });
    if (!res.ok) return { ok: false, error: `Models request failed (${res.status}).` };
    const json = await res.json();
    const models = (json.data || []).map((m) => ({ id: m.id, name: m.display_name || m.id }));
    return { ok: true, models };
  } catch (e) {
    return { ok: false, error: `Couldn't reach the API: ${e.message}` };
  }
}

// Kill the WHOLE Vite process tree, not just the direct child. In dev we spawn
// `npm run dev`; a bare viteProc.kill() signals npm but leaves the `vite` child npm
// spawned ORPHANED, still holding its port. That orphan is why a later project's
// Vite drifts off 5173 (and why stale servers pile up across crashes). We spawn Vite
// detached (its own process group), so a negative-pid signal takes down npm + vite
// together.
function killTree(proc) {
  const pid = proc && proc.pid;
  if (!pid) return;
  if (process.platform === "win32") {
    try { spawn("taskkill", ["/pid", String(pid), "/T", "/F"]); } catch { /* best-effort */ }
    return;
  }
  try { process.kill(-pid, "SIGTERM"); }   // -pid = the process group (npm + vite)
  catch { try { proc.kill(); } catch { /* already gone */ } } // fall back to the child
  // Escalate if the group is still alive a beat later. Targets the OLD group's pid,
  // so a freshly spawned Vite (different pid/group) is never hit.
  setTimeout(() => { try { process.kill(-pid, "SIGKILL"); } catch { /* gone */ } }, 2500);
}

function stopVite() {
  if (viteProc) {
    killTree(viteProc);
    viteProc = null;
  }
  clearVitePidFile(); // we killed it ourselves → no orphan to reap next boot
  viteUrl = null;
}

// ---- Site dev server (the public website's live preview) --------------------
// The site target (site/, Astro) gets its own dev server beside Vite, on its own
// port, so the browser can show a "Site" tab next to Home + Style guide. Astro's
// CLI runs under the app's Electron-as-Node (same as the packaged Vite launch) from
// the app's node_modules, so neither dev nor a Finder-launched .app needs a system
// node. Started only when the project is site-ready (see siteReady), and again the
// moment a promotion lands mid-session. Stopped with Vite.
let siteProc = null;
let siteUrl = null;
function astroCli() { return path.join(modulesRoot(), "astro", "astro.js"); }
function stopSite() {
  if (siteProc) { killTree(siteProc); siteProc = null; }
  siteUrl = null;
}
function startSiteFor(projectDir) {
  stopSite();
  return new Promise((resolve, reject) => {
    siteProc = spawn(process.execPath, [astroCli(), "dev", "--root", "site"], {
      cwd: projectDir,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", FORCE_COLOR: "0" },
      detached: process.platform !== "win32",
    });
    let settled = false;
    const onLine = (text) => {
      // "┃ Local    http://localhost:4321/" (Astro picks the next port when 4321 is busy)
      const m = text.match(/https?:\/\/localhost:\d+/);
      if (m && !settled) {
        settled = true;
        siteUrl = m[0];
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("site:ready", siteUrl);
        resolve(siteUrl);
      }
    };
    siteProc.stdout.on("data", (b) => { const t = b.toString(); process.stdout.write(`[site] ${t}`); onLine(t); });
    siteProc.stderr.on("data", (b) => { const t = b.toString(); process.stderr.write(`[site] ${t}`); onLine(t); });
    siteProc.on("exit", (code) => { if (!settled) reject(new Error(`Astro exited before it was ready (code ${code})`)); siteProc = null; });
    setTimeout(() => { if (!settled) reject(new Error("Timed out waiting for the site server (60s)")); }, 60000);
  });
}
// Start the site server when (and only when) the project is site-ready and it isn't
// already up. Safe to call often (project open, after every agent turn).
function maybeStartSite(projectDir) {
  if (!projectDir || projectDir !== currentProject) return;
  if (siteProc || !siteReady(projectDir).ready) return;
  startSiteFor(projectDir).catch((e) => console.error("[main] site server failed:", e.message));
}
// A one-shot production build of the site (what Vercel will run), so a broken
// block or content fails HERE with the real message, not on Vercel five minutes
// later. Returns { ok, log } — log is the tail of the build output.
function buildSite(projectDir) {
  return new Promise((resolve) => {
    let out = "";
    const p = spawn(process.execPath, [astroCli(), "build", "--root", "site"], {
      cwd: projectDir,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NO_COLOR: "1", FORCE_COLOR: "0" },
    });
    p.stdout.on("data", (b) => { out += b.toString(); });
    p.stderr.on("data", (b) => { out += b.toString(); });
    p.on("exit", (code) => {
      // Strip ANSI (Astro colors even with NO_COLOR in places) and the route-tree
      // glyphs, then pull the readable error block: the first line that names the
      // problem plus its indented detail lines (the field issues), up to the stack.
      const clean = out.replace(/\x1b\[[0-9;]*m/g, "").replace(/[\u2502\u2514\u251c\u2500\u2503]+/g, " ");
      const lines = clean.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim());
      let error = null;
      if (code !== 0) {
        const i = lines.findIndex((l) => /invalid props|unknown block|\[[A-Za-z]+Error\]|Error:|is invalid|Cannot|failed/.test(l) && !/^\s*at /.test(l));
        if (i >= 0) {
          let head = lines[i];
          // "22:16:14   /about.html content/pages/about.json blocks[0]: …" → from the content path on
          const j = head.search(/(content\/|site\/|\[[A-Za-z]+Error\]|Error:)/);
          if (j > 0) head = head.slice(j);
          const detail = [];
          for (let k = i + 1; k < lines.length && /^\s{2,}/.test(lines[k]) && !/^\s*(at |Stack trace)/.test(lines[k]); k++) detail.push(lines[k].trim());
          error = [head.trim(), ...detail].join("\n");
        } else error = "The site build failed.";
      }
      resolve({ ok: code === 0, log: lines.slice(-40).join("\n"), error });
    });
  });
}

// A normal quit runs stopVite(), but a FORCE-QUIT (or crash) skips it, orphaning the
// Vite process group — it keeps holding its port + the project's .vite dep-optimize
// cache, so the NEXT launch's fresh Vite contends with it and can stall before it ever
// prints its ready URL. We record the spawned group's pid to disk; on boot we reap that
// stale group (if it's still alive and still looks like our Vite) before starting anew.
function vitePidFilePath() { return path.join(app.getPath("userData"), "vite.pid"); }
function recordVitePid(pid) { try { fs.writeFileSync(vitePidFilePath(), String(pid)); } catch { /* best-effort */ } }
function clearVitePidFile() { try { fs.unlinkSync(vitePidFilePath()); } catch { /* already gone */ } }
function reapStaleVite() {
  let pid;
  try { pid = parseInt(fs.readFileSync(vitePidFilePath(), "utf8").trim(), 10); } catch { return; }
  clearVitePidFile();
  if (!pid || Number.isNaN(pid)) return;
  if (process.platform === "win32") {
    try { spawn("taskkill", ["/pid", String(pid), "/T", "/F"]); } catch { /* best-effort */ }
    return;
  }
  try { process.kill(pid, 0); } catch { return; } // not alive → nothing to reap
  // Guard against a recycled pid: only signal if it's actually a node/vite process.
  let cmd = "";
  try { cmd = execFileSync("ps", ["-o", "command=", "-p", String(pid)]).toString(); } catch { return; }
  if (!/vite|node|electron/i.test(cmd)) return;
  console.log(`[main] reaping stale Vite (pid ${pid}) orphaned by a previous session`);
  try { process.kill(-pid, "SIGTERM"); } catch { try { process.kill(pid, "SIGTERM"); } catch { /* gone */ } }
  setTimeout(() => { try { process.kill(-pid, "SIGKILL"); } catch { /* gone */ } }, 1500);
}

let viteHealing = false;

// Start Vite for a project dir; resolve with the URL Vite prints (parsed, not
// hardcoded, since the port varies) and push a 'vite:ready' event to the UI.
// How to launch Vite depends on whether we're packaged:
//   • Dev: `npm run dev` — the launching shell has npm + node on PATH.
//   • Packaged (.app from Finder): there is NO npm and often NO system node on
//     PATH. Electron ships its own Node, so run Vite's JS entry directly with
//     the Electron binary in Node mode (ELECTRON_RUN_AS_NODE=1, set ONLY for
//     this child so the main process stays a normal Electron app). Vite +
//     esbuild resolve from the project's node_modules (a symlink to the app's).
function viteLaunch(projectDir) {
  if (!app.isPackaged) {
    return { cmd: "npm", args: ["run", "dev"], env: process.env, shell: process.platform === "win32" };
  }
  const viteBin = path.join(modulesRoot(), "vite", "bin", "vite.js");
  return {
    cmd: process.execPath,
    args: [viteBin],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    shell: false,
  };
}

function startViteFor(projectDir) {
  stopVite();
  return new Promise((resolve, reject) => {
    const launch = viteLaunch(projectDir);
    viteProc = spawn(launch.cmd, launch.args, {
      cwd: projectDir,
      env: launch.env,
      shell: launch.shell,
      // Own process group (POSIX) so killTree() can take down npm + its vite child
      // together. Windows uses taskkill /T instead, so detached isn't needed there.
      detached: process.platform !== "win32",
    });
    recordVitePid(viteProc.pid); // so a force-quit orphan can be reaped next boot
    let settled = false;
    // Tailwind v4's IN-PROCESS config reload can fail in this spawned Vite on an
    // .env change ("failed to load config … createResolver"), leaving the server
    // stuck so the live preview never updates mid-setup. A FRESH start always
    // works, so when Vite reports a failed restart, kill it and respawn clean.
    // Guarded so a burst of failure lines triggers a single heal.
    const heal = (text) => {
      if (viteHealing || !/server restart failed|failed to load config from/i.test(text)) return;
      viteHealing = true;
      console.error("[main] Vite config-reload failed — restarting it cleanly.");
      startViteFor(projectDir).finally(() => { viteHealing = false; });
    };
    viteProc.stdout.on("data", (buf) => {
      const text = buf.toString();
      process.stdout.write(`[vite] ${text}`);
      const m = text.match(/https?:\/\/localhost:\d+/);
      if (m && !settled) {
        settled = true;
        viteUrl = m[0];
        // The native capture bridge loads whatever URL the export scripts pass,
        // so hand them THIS project's actual Vite base (port varies) instead of
        // the hardcoded :5173 default.
        process.env.TA_PREVIEW_URL = viteUrl;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("vite:ready", viteUrl);
        }
        resolve(viteUrl);
      }
      heal(text);
    });
    viteProc.stderr.on("data", (b) => {
      const text = b.toString();
      process.stderr.write(`[vite] ${text}`);
      heal(text);
    });
    viteProc.on("exit", (code) => {
      if (!settled) reject(new Error(`Vite exited before it was ready (code ${code})`));
    });
    setTimeout(() => {
      if (!settled) reject(new Error("Timed out waiting for Vite (60s)"));
    }, 60000);
  });
}

// Preview webviews (the embedded tabbed browser) block popups by default, so a
// dashboard link with target="_blank" (e.g. "View Design ↗") does nothing. Route
// those new-window requests to the renderer, which opens them as a new app tab —
// keeping the template's standard-web links working inside the app browser.
app.on("web-contents-created", (_e, contents) => {
  if (contents.getType() !== "webview") return;
  contents.setWindowOpenHandler(({ url }) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("preview:open-url", url);
    return { action: "deny" };
  });
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    title: "thinkany design",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      // contextIsolation + sandbox stay at their secure defaults (true).
      webviewTag: true, // the preview pane uses <webview> for a real tabbed browser
      // Dev-only flag the preload reads synchronously → the renderer loads the (unshipped)
      // narration pacing harness only when running unpackaged. Never present in a built app.
      additionalArguments: app.isPackaged ? [] : ["--ta-dev"],
    },
  });
  mainWindow.loadFile(path.join(__dirname, "shell.html"));
}

// ---- Copy voice (tone + rules) ----------------------------------------------
// Per-project TONE + rules (a project file, travels with the design) plus GLOBAL
// rules (app-level, every project). Effective rules = declineGlobal ? project
// rules : (global ∪ project). Handed to the agent per turn (agent.mjs appends it
// to the system prompt). Nothing set by default — empty tone + empty rules.
function globalRulesFile() { return path.join(app.getPath("userData"), "global-copy-rules.json"); }
function loadGlobalRules() {
  try { const j = JSON.parse(fs.readFileSync(globalRulesFile(), "utf8")); return Array.isArray(j.rules) ? j.rules : []; }
  catch { return []; }
}
function saveGlobalRules(rules) {
  fs.writeFileSync(globalRulesFile(), JSON.stringify({ rules: (rules || []).map((r) => String(r).trim()).filter(Boolean) }, null, 2));
}
function projectVoiceFile(dir) { return path.join(dir, ".thinkany", "copy-voice.json"); }
function loadProjectVoice(dir) {
  const empty = { tone: "", rules: [], declineGlobal: false };
  if (!dir) return empty;
  try {
    const v = JSON.parse(fs.readFileSync(projectVoiceFile(dir), "utf8"));
    return { tone: String(v.tone || ""), rules: Array.isArray(v.rules) ? v.rules : [], declineGlobal: !!v.declineGlobal };
  } catch { return empty; }
}
function saveProjectVoice(dir, v) {
  if (!dir) return;
  fs.mkdirSync(path.join(dir, ".thinkany"), { recursive: true });
  fs.writeFileSync(projectVoiceFile(dir), JSON.stringify({
    tone: String((v && v.tone) || "").trim(),
    rules: ((v && v.rules) || []).map((r) => String(r).trim()).filter(Boolean),
    declineGlobal: !!(v && v.declineGlobal),
  }, null, 2));
}
// The resolved voice handed to the agent for this project (deduped, trimmed).
function effectiveVoice(dir) {
  const pv = loadProjectVoice(dir);
  const merged = pv.declineGlobal ? pv.rules : [...loadGlobalRules(), ...pv.rules];
  const seen = new Set(); const rules = [];
  for (const r of merged) { const t = String(r).trim(); const k = t.toLowerCase(); if (t && !seen.has(k)) { seen.add(k); rules.push(t); } }
  return { tone: pv.tone.trim(), rules };
}

// ---- Competitor research (licensed + gated) ---------------------------------
// A licensed enhancement: when active, /design-brief studies comparable sites and
// synthesizes a conventions report to ground the layout. Gated on BOTH a license
// AND an on/off toggle (global default + per-project override). Dark by default.
//
// The ONE license for the Design/Research/Director bundle (Rob 2026-08-23): design-variety
// (lens/reroll), field Research, and the Art Director all gate on DESIGN_LICENSE_KEY — a
// SEPARATE Vercel env key from the Figma export's DERIVE_LICENSE_KEY. It's also the key the
// app sends to derive.thinkany.design/api/direction (see direction-client.cjs), so the app
// gate and the cloud auth are now the same key. Presence check here; the cloud does the real
// validation. Unset → the whole bundle stays dark.
function researchLicensed() {
  return !!(process.env.DESIGN_LICENSE_KEY && process.env.DESIGN_LICENSE_KEY.trim());
}
// A stable, anonymous per-install id — the "designer" identity the cloud design-variety
// endpoint keys anti-repetition memory on (lever 3, §9), so variety compounds across ALL of
// this designer's projects. Persisted under the PINNED userData (survives app rename/upgrade,
// per the userData-pinning gotcha) so the memory isn't stranded. Not a secret, not PII — a
// random id. (Forward-compatible with the licensing-activation installation id.)
let _designerId = null;
function designerId() {
  if (_designerId) return _designerId;
  const file = path.join(app.getPath("userData"), "installation-id.json");
  try { _designerId = JSON.parse(fs.readFileSync(file, "utf8")).id; } catch {}
  if (!_designerId) {
    _designerId = crypto.randomUUID();
    try { fs.writeFileSync(file, JSON.stringify({ id: _designerId, createdAt: new Date().toISOString() }, null, 2)); } catch {}
  }
  return _designerId;
}
// Global settings: userData/design-research.json = { enabled, broad }.
// `broad` = the "look beyond competitors" (multi-axis: function/aesthetic/region) mode.
function researchGlobalFile() { return path.join(app.getPath("userData"), "design-research.json"); }
function loadResearchGlobalObj() {
  try { return JSON.parse(fs.readFileSync(researchGlobalFile(), "utf8")) || {}; }
  catch { return {}; } // global defaults OFF (dark launch)
}
function saveResearchGlobalObj(o) { fs.writeFileSync(researchGlobalFile(), JSON.stringify(o, null, 2)); }
function loadResearchGlobal() { return !!loadResearchGlobalObj().enabled; }
function loadBroadGlobal() { return !!loadResearchGlobalObj().broad; }
function saveResearchGlobal(enabled) { const o = loadResearchGlobalObj(); o.enabled = !!enabled; saveResearchGlobalObj(o); }
function saveBroadGlobal(broad) { const o = loadResearchGlobalObj(); o.broad = !!broad; saveResearchGlobalObj(o); }

// Per-VARIATION overrides: <project>/.thinkany/design-research.json =
//   { variations: {<id>:bool}, broadVariations: {<id>:bool} }. One design direction can
// research (and go broad) while another designs straight away. Active variation = the app's
// working variation (detectDesign). Writes MERGE so research + broad never clobber each other.
function researchProjectFile(dir) { return path.join(dir, ".thinkany", "design-research.json"); }
function loadResearchProjectObj(dir) {
  try { return JSON.parse(fs.readFileSync(researchProjectFile(dir), "utf8")) || {}; }
  catch { return {}; }
}
function activeVariationId(dir) {
  try { return detectDesign(dir).variationId; } catch { return null; }
}
// A variation override: true|false = force; null = inherit global.
function loadVarOverride(dir, key) {
  const id = activeVariationId(dir);
  if (!id) return null;
  const map = loadResearchProjectObj(dir)[key];
  const v = map && typeof map === "object" ? map[id] : undefined;
  return v === true || v === false ? v : null;
}
function saveVarOverride(dir, key, enabled) {
  const id = activeVariationId(dir);
  if (!id) return;
  const obj = loadResearchProjectObj(dir);
  const map = obj[key] && typeof obj[key] === "object" ? obj[key] : {};
  if (enabled === true || enabled === false) map[id] = enabled; else delete map[id];
  obj[key] = map;
  fs.mkdirSync(path.join(dir, ".thinkany"), { recursive: true });
  fs.writeFileSync(researchProjectFile(dir), JSON.stringify(obj, null, 2));
}
const loadResearchVariation = (dir) => loadVarOverride(dir, "variations");
const loadBroadVariation = (dir) => loadVarOverride(dir, "broadVariations");
const saveResearchVariation = (dir, e) => saveVarOverride(dir, "variations", e);
const saveBroadVariation = (dir, e) => saveVarOverride(dir, "broadVariations", e);

// Toggle values (ignore license): the active variation's override wins over the global default.
function researchToggle(dir) { const v = dir ? loadResearchVariation(dir) : null; return v === null ? loadResearchGlobal() : v; }
function broadToggle(dir) { const v = dir ? loadBroadVariation(dir) : null; return v === null ? loadBroadGlobal() : v; }
// Active = licensed AND toggled on. Broad only matters when research itself is active.
function researchActive(dir) { return researchLicensed() && researchToggle(dir); }
function broadActive(dir) { return researchActive(dir) && broadToggle(dir); }

// ---- Agent IPC (cwd = current project) --------------------------------------
// Pending AskUserQuestion prompts: the agent's canUseTool awaits a renderer
// answer through these. Keyed by an incrementing id.
const pendingAsks = new Map();
let askSeq = 0;

// Pending `intake` tool calls (the rich, in-pane onboarding channel — ticket T2).
// Mirrors pendingAsks: the agent's intake MCP tool awaits a renderer answer through
// these, keyed by an incrementing id.
const pendingIntakes = new Map();
let intakeSeq = 0;
// The Brief accumulated across a Get-Designing intake (T5). Reset when a flow
// begins (intake:begin); each answered batch folds in via its cards' `field`s.
let intakeBrief = null;

// The live Agent SDK query for the in-flight turn, so agent:interrupt can stop it
// (the designer hitting Back mid-intake). runPrompt sets it via onQuery and clears
// it (onQuery(null)) when the turn ends.
let activeQuery = null;

ipcMain.handle("agent:prompt", async (event, { prompt, sessionId, reviewMode, model: turnModel }) => {
  if (!currentProject) {
    event.sender.send("agent:event", { type: "error", message: "No project is open." });
    return { sessionId };
  }
  // A licensed skill command ("/design-brief …") becomes its playbook here, so the
  // SDK never expands the scaffold's stub. Unlicensed (no cache) → falls through
  // and the stub does its job: it tells the designer the skill needs the app.
  const expanded = skillsClient && skillsClient.expandPrompt(prompt);
  if (expanded) prompt = expanded.prompt;
  const { runPrompt } = await import(pathToFileURL(path.join(__dirname, "agent.mjs")).href);
  const onEvent = (evt) => {
    if (!event.sender.isDestroyed()) event.sender.send("agent:event", evt);
  };
  // Bridge: send the questions to the renderer, resolve when it answers.
  const askQuestion = (questions) =>
    new Promise((resolve, reject) => {
      const id = ++askSeq;
      pendingAsks.set(id, { resolve, reject });
      if (!event.sender.isDestroyed()) event.sender.send("agent:ask", { id, questions });
      else reject(new Error("window closed"));
    });
  // Bridge: validate the intake cards, send them to the pane, resolve when the
  // designer submits (agent:intakeAnswer). Validating here — BEFORE the round-trip —
  // is what makes a bad card spec fail loud (rejects the tool call) instead of
  // hanging the turn with a broken pane.
  const askIntake = (cards) =>
    new Promise((resolve, reject) => {
      const v = validateCards(cards);
      if (!v.ok) { reject(new Error("invalid intake cards: " + v.errors.join(" | "))); return; }
      if (event.sender.isDestroyed()) { reject(new Error("window closed")); return; }
      const id = ++intakeSeq;
      pendingIntakes.set(id, { resolve, reject, cards });
      event.sender.send("agent:intake", { id, cards });
    });
  // Bridge (Phase 3): the Art Director's read-only `suggest` tool forwards its structured
  // suggestions to the renderer, which renders them as Apply-able cards. Non-blocking.
  const onSuggest = (suggestions) => {
    if (!event.sender.isDestroyed()) event.sender.send("agent:suggestions", { suggestions: suggestions || [] });
  };
  // Tell the /design-brief flow whether the licensed research layer is active, via
  // an env var the agent's Bash inherits (same channel as TA_CAPTURE_* etc.).
  process.env.TA_DESIGN_RESEARCH = researchActive(currentProject) ? "on" : "off";
  process.env.TA_DESIGN_RESEARCH_BROAD = broadActive(currentProject) ? "on" : "off";
  // Image mode: "placeholder" = don't source images, hold each spot with an FPO
  // block; else "on" (the normal gather-into-public/ flow). Same env channel.
  process.env.TA_DESIGN_IMAGES = loadImagesPlaceholder() ? "placeholder" : "on";
  // Accessibility mode: "aa" = build to WCAG AA (§4d rules + apply-brand --aa contrast gate);
  // "off" (default) = author freely, palette untouched. Opt-in — same env channel.
  process.env.TA_DESIGN_A11Y = a11yModeOn() ? "aa" : "off";
  // A per-turn model override (turnModel) lets a specific turn run on a cheaper/faster model
  // without changing the user's global pick — e.g. design BUILDS run on Sonnet (high output, low
  // reasoning need) while the rest of the session stays on whatever they chose.
  const result = await runPrompt({ prompt, sessionId, cwd: currentProject, onEvent, askQuestion, askIntake, onSuggest, model: turnModel || currentModel, copyVoice: effectiveVoice(currentProject), onQuery: (q) => { activeQuery = q; }, reviewMode });
  // A review turn is an isolated, fresh session (its own Art Director persona); it must
  // not become the tracked chat session, or the next chat turn would resume the critique.
  if (!reviewMode && result && result.sessionId) currentSessionId = result.sessionId; // so quit can archive it
  maybeStartSite(currentProject); // a /promote-blocks turn makes the project site-ready mid-session
  return result;
});

// ---- Site content (the Site rail) --------------------------------------------
// The rail edits the site as FILES, no model turn: content/site.json (nav, url),
// content/pages/*.json (title, slug, SEO, the ordered block instances and their
// props). Astro's dev server watches content/, so a save shows in the Site tab at
// once; the build check on publish is the validator of last resort.
function siteContentDir(dir) { return path.join(dir, "content"); }
function pageFile(dir, id) { return path.join(siteContentDir(dir), "pages", `${id}.json`); }
function readJsonFile(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } }

// The block registry, read from site/blocks/index.ts without executing it: the
// keys content refers to, plus each block's name/description from its file.
function readBlockRegistry(dir) {
  const idx = path.join(dir, "site", "blocks", "index.ts");
  let src = "";
  try { src = fs.readFileSync(idx, "utf8"); } catch { return []; }
  const imports = {};
  for (const m of src.matchAll(/import\s*\{\s*([A-Za-z0-9_]+)\s*\}\s*from\s*["']\.\/([^"']+)["']/g)) imports[m[1]] = m[2];
  const body = (src.match(/export const blocks[^=]*=\s*\{([\s\S]*?)\n\};/) || [])[1] || "";
  const out = [];
  for (const line of body.split("\n")) {
    const t = line.trim().replace(/,$/, "");
    if (!t || t.startsWith("//")) continue;
    let key, ident;
    const m = t.match(/^(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_-]+))\s*:\s*([A-Za-z0-9_]+)$/);
    if (m) { key = m[1] || m[2] || m[3]; ident = m[4]; }
    else if (/^[A-Za-z0-9_]+$/.test(t)) { key = t; ident = t; }
    else continue;
    const entry = { key, name: key, description: "" };
    const file = imports[ident];
    if (file) {
      const fsrc = readTextSafe(path.join(dir, "site", "blocks", file + (file.endsWith(".tsx") ? "" : ".tsx")));
      const nm = fsrc.match(/name:\s*"([^"]+)"/); const ds = fsrc.match(/description:\s*"([^"]+)"/);
      if (nm) entry.name = nm[1];
      if (ds) entry.description = ds[1];
    }
    out.push(entry);
  }
  return out;
}
function readTextSafe(p) { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } }

function readSiteContent(dir) {
  const r = siteReady(dir);
  const site = readJsonFile(path.join(siteContentDir(dir), "site.json")) || {};
  const pagesDir = path.join(siteContentDir(dir), "pages");
  let pages = [];
  try {
    pages = fs.readdirSync(pagesDir).filter((f) => f.endsWith(".json")).sort().map((f) => {
      const id = f.replace(/\.json$/, "");
      const data = readJsonFile(path.join(pagesDir, f)) || {};
      return { id, title: data.title || id, slug: data.slug ?? (id === "home" ? "" : id), seo: data.seo || {}, blocks: Array.isArray(data.blocks) ? data.blocks : [] };
    });
  } catch { /* no pages dir */ }
  // Home first, then alphabetical.
  pages.sort((a, b) => (a.id === "home" ? -1 : b.id === "home" ? 1 : a.title.localeCompare(b.title)));
  let posts = 0;
  try { posts = fs.readdirSync(path.join(siteContentDir(dir), "posts")).filter((f) => /\.mdx?$/.test(f)).length; } catch {}
  const pub = loadPublish(dir);
  return {
    ready: r.ready, reason: r.ready ? null : r.reason, design: r.design || site.design || null,
    site: { url: site.url || null, nav: Array.isArray(site.nav) ? site.nav : [], footerLinks: Array.isArray(site.footerLinks) ? site.footerLinks : [] },
    pages, posts, blocks: readBlockRegistry(dir), liveUrl: (pub.site && pub.site.url) || null, previewUrl: siteUrl,
  };
}
function slugifyId(s) {
  return String(s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
function validPageId(id) { return typeof id === "string" && /^[a-z0-9][a-z0-9-]*$/.test(id); }

ipcMain.handle("site:content", () => {
  if (!currentProject) return { ready: false, reason: "no-project", pages: [], blocks: [], site: { nav: [], footerLinks: [] } };
  return readSiteContent(currentProject);
});
// Save a page. `data` is the whole page document ({ title, slug, seo, blocks });
// the block props are written as given, the build validates them.
ipcMain.handle("site:savePage", (_e, { id, data } = {}) => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  if (!validPageId(id)) return { ok: false, error: "Bad page id." };
  if (!data || typeof data !== "object" || typeof data.title !== "string" || !data.title.trim()) return { ok: false, error: "A page needs a title." };
  const doc = {
    title: data.title.trim(),
    slug: id === "home" ? "" : slugifyId(data.slug ?? id),
    seo: data.seo && typeof data.seo === "object" ? data.seo : {},
    blocks: Array.isArray(data.blocks) ? data.blocks.filter((b) => b && typeof b.type === "string").map((b) => ({ type: b.type, props: b.props && typeof b.props === "object" ? b.props : {} })) : [],
  };
  // Drop empty SEO strings so defaults apply.
  for (const k of Object.keys(doc.seo)) if (doc.seo[k] === "" || doc.seo[k] == null) delete doc.seo[k];
  try {
    fs.mkdirSync(path.dirname(pageFile(currentProject, id)), { recursive: true });
    fs.writeFileSync(pageFile(currentProject, id), JSON.stringify(doc, null, 2) + "\n");
    return { ok: true, page: { id, ...doc } };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle("site:createPage", (_e, { title } = {}) => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  const t = String(title || "").trim();
  if (!t) return { ok: false, error: "Give the page a title." };
  let id = slugifyId(t) || "page";
  if (id === "blog") id = "blog-page"; // /blog is the posts index
  let n = 2; const base = id;
  while (fs.existsSync(pageFile(currentProject, id))) id = `${base}-${n++}`;
  const doc = { title: t, slug: id, seo: {}, blocks: [] };
  try {
    fs.mkdirSync(path.dirname(pageFile(currentProject, id)), { recursive: true });
    fs.writeFileSync(pageFile(currentProject, id), JSON.stringify(doc, null, 2) + "\n");
    return { ok: true, page: { id, ...doc } };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle("site:deletePage", (_e, { id } = {}) => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  if (!validPageId(id) || id === "home") return { ok: false, error: "The home page can't be deleted." };
  try { fs.rmSync(pageFile(currentProject, id), { force: true }); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
});
// Site-level settings: nav + footer links (the pinned design + url are managed by
// promotion and publishing, so they're preserved, never edited here).
ipcMain.handle("site:saveSite", (_e, { nav, footerLinks } = {}) => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  const p = path.join(siteContentDir(currentProject), "site.json");
  const cur = readJsonFile(p) || { design: "v00", url: "https://example.com" };
  const clean = (arr, sub) => (Array.isArray(arr) ? arr : [])
    .filter((l) => l && typeof l.label === "string" && l.label.trim() && typeof l.href === "string" && l.href.trim())
    .map((l) => ({ label: l.label.trim(), href: l.href.trim(), ...(sub && Array.isArray(l.links) && l.links.length ? { links: clean(l.links, false) } : {}) }));
  const next = { ...cur, nav: clean(nav, true), footerLinks: clean(footerLinks, false) };
  try { fs.writeFileSync(p, JSON.stringify(next, null, 2) + "\n"); return { ok: true, site: next }; }
  catch (e) { return { ok: false, error: e.message }; }
});

// ---- Posts (content/posts/*.md) ----------------------------------------------
// Markdown with a small, fixed frontmatter (title, date, description, image, tags,
// draft, seo.*). Read and written here without a YAML dependency: scalars, quoted
// strings, `[a, b]` lists, `key.sub` for the seo group. Anything else in an
// existing file's frontmatter is preserved as-is (unknown lines round-trip).
function postsDir(dir) { return path.join(siteContentDir(dir), "posts"); }
function postFile(dir, id) { return path.join(postsDir(dir), `${id}.md`); }
function fmUnquote(v) {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"'))) { try { return JSON.parse(t); } catch { return t.slice(1, -1); } }
  if (t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1).replace(/''/g, "'");
  return t;
}
// One scalar: booleans, else an (un)quoted string. Numbers stay strings (dates,
// zip codes) since every field here is text or a date the schema coerces.
function fmScalar(v) {
  const t = v.trim();
  if (t === "true" || t === "false") return t === "true";
  return fmUnquote(t);
}
function parseFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: md, unknown: [] };
  const data = {}; const unknown = [];
  let group = null;
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const nested = raw.match(/^\s+([A-Za-z_][\w-]*):\s*(.*)$/);
    if (group && nested) { data[group][nested[1]] = fmScalar(nested[2]); continue; }
    group = null;
    const kv = raw.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) { unknown.push(raw); continue; }
    const [, key, val] = kv;
    if (val === "") { group = key; data[key] = {}; continue; }
    const list = val.match(/^\[(.*)\]$/);
    if (list) data[key] = list[1].split(",").map((x) => fmUnquote(x)).filter((x) => x !== "");
    else data[key] = fmScalar(val);
  }
  return { data, body: m[2], unknown };
}
function fmQuote(v) {
  const s = String(v);
  return /^[A-Za-z0-9 .,!?()'&/-]*$/.test(s) && !/^(true|false|null|~|\d.*)$/.test(s) && !/^\s|\s$|:/.test(s) ? s : JSON.stringify(s);
}
function serializeFrontmatter(data, unknown = []) {
  const lines = [];
  const ORDER = ["title", "date", "description", "image", "tags", "draft"];
  for (const k of ORDER) {
    const v = data[k];
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) { if (v.length) lines.push(`${k}: [${v.map(fmQuote).join(", ")}]`); }
    else if (typeof v === "boolean") { if (v) lines.push(`${k}: true`); }
    else lines.push(`${k}: ${fmQuote(v)}`);
  }
  const seo = data.seo && typeof data.seo === "object" ? Object.entries(data.seo).filter(([, v]) => v !== "" && v != null && v !== false) : [];
  if (seo.length) { lines.push("seo:"); for (const [k, v] of seo) lines.push(`  ${k}: ${typeof v === "boolean" ? v : fmQuote(v)}`); }
  for (const u of unknown) lines.push(u);
  return `---\n${lines.join("\n")}\n---\n`;
}
function readPosts(dir) {
  let files = [];
  try { files = fs.readdirSync(postsDir(dir)).filter((f) => /\.mdx?$/.test(f)); } catch { return []; }
  const posts = files.map((f) => {
    const id = f.replace(/\.mdx?$/, "");
    const { data, body } = parseFrontmatter(readTextSafe(path.join(postsDir(dir), f)));
    return { id, file: f, title: data.title || id, date: data.date || "", description: data.description || "", image: data.image || "", tags: Array.isArray(data.tags) ? data.tags : [], draft: !!data.draft, seo: data.seo || {}, body };
  });
  posts.sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.title.localeCompare(b.title));
  return posts;
}
function todayIso() { return new Date().toISOString().slice(0, 10); }

ipcMain.handle("site:posts", () => (currentProject ? readPosts(currentProject) : []));
ipcMain.handle("site:savePost", (_e, { id, data } = {}) => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  if (!validPageId(id)) return { ok: false, error: "Bad post id." };
  if (!data || typeof data.title !== "string" || !data.title.trim()) return { ok: false, error: "A post needs a title." };
  const p = postFile(currentProject, id);
  const existing = fs.existsSync(p) ? parseFrontmatter(readTextSafe(p)) : { unknown: [] };
  const fm = {
    title: data.title.trim(),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(data.date || "")) ? data.date : todayIso(),
    description: typeof data.description === "string" ? data.description.trim() : "",
    image: typeof data.image === "string" ? data.image.trim() : "",
    tags: Array.isArray(data.tags) ? data.tags.map((t) => String(t).trim()).filter(Boolean) : [],
    draft: !!data.draft,
    seo: data.seo && typeof data.seo === "object" ? data.seo : {},
  };
  const body = typeof data.body === "string" ? data.body.replace(/^\s*\n/, "").replace(/\s*$/, "") + "\n" : "\n";
  try {
    fs.mkdirSync(postsDir(currentProject), { recursive: true });
    fs.writeFileSync(p, serializeFrontmatter(fm, existing.unknown) + "\n" + body);
    return { ok: true, post: { id, ...fm, body } };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle("site:createPost", (_e, { title } = {}) => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  const t = String(title || "").trim();
  if (!t) return { ok: false, error: "Give the post a title." };
  let id = slugifyId(t) || "post"; const base = id; let n = 2;
  while (fs.existsSync(postFile(currentProject, id))) id = `${base}-${n++}`;
  const fm = { title: t, date: todayIso(), description: "", image: "", tags: [], draft: true, seo: {} };
  try {
    fs.mkdirSync(postsDir(currentProject), { recursive: true });
    fs.writeFileSync(postFile(currentProject, id), serializeFrontmatter(fm) + "\n\n");
    return { ok: true, post: { id, ...fm, body: "" } };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle("site:deletePost", (_e, { id } = {}) => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  if (!validPageId(id)) return { ok: false, error: "Bad post id." };
  try { fs.rmSync(postFile(currentProject, id), { force: true }); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
});

// ---- Content types (content/types.json + content/<key>/*.json) ---------------
// Designer-defined types, declared as data and rendered by the site's generic
// routes (site/src/pages/[type]). The CMS edits the declarations and the entries;
// the site build validates entries against the fields.
const TYPE_FIELD_KINDS = ["text", "textarea", "richtext", "number", "boolean", "date", "image", "select", "list", "link", "reference"];
function typesFile(dir) { return path.join(siteContentDir(dir), "types.json"); }
function readTypes(dir) {
  const j = readJsonFile(typesFile(dir));
  return j && Array.isArray(j.types) ? j.types : [];
}
function entryDir(dir, key) { return path.join(siteContentDir(dir), key); }
function entryFile(dir, key, id) { return path.join(entryDir(dir, key), `${id}.json`); }
function validTypeKey(k) { return typeof k === "string" && /^[a-z][a-z0-9-]*$/.test(k) && !["pages", "posts", "site", "types", "collections"].includes(k); }
// Shape-check a type declaration (mirrors site/src/lib/types.ts typeDef).
function cleanType(t) {
  if (!t || typeof t !== "object") return { error: "Bad type." };
  const key = String(t.key || "").trim();
  if (!validTypeKey(key)) return { error: `"${key}" isn't a usable type key (lowercase letters, digits, dashes; not a built-in).` };
  const label = String(t.label || "").trim(); if (!label) return { error: "A type needs a label." };
  const pathv = String(t.path || `/${key}`).trim();
  if (!/^\/[a-z0-9-]*$/.test(pathv)) return { error: `"${pathv}" isn't a usable path (like /products).` };
  const fields = [];
  const seen = new Set();
  for (const f of Array.isArray(t.fields) ? t.fields : []) {
    const fk = String(f.key || "").trim();
    if (!/^[a-z][a-zA-Z0-9]*$/.test(fk)) return { error: `Field key "${fk}" must be camelCase (like priceLabel).` };
    if (["title", "slug", "seo", "blocks"].includes(fk)) return { error: `"${fk}" is reserved on every entry.` };
    if (seen.has(fk)) return { error: `Field "${fk}" is listed twice.` }; seen.add(fk);
    if (!TYPE_FIELD_KINDS.includes(f.kind)) return { error: `Field "${fk}" has an unknown kind.` };
    const out = { key: fk, label: String(f.label || fk).trim(), kind: f.kind, required: !!f.required };
    if (f.kind === "select") out.options = (Array.isArray(f.options) ? f.options : []).map((o) => String(o).trim()).filter(Boolean);
    if (f.kind === "reference" && f.reference) out.reference = String(f.reference).trim();
    if (f.hint) out.hint = String(f.hint).trim();
    fields.push(out);
  }
  const template = (Array.isArray(t.template) ? t.template : []).filter((b) => b && typeof b.type === "string").map((b) => ({ type: b.type, props: b.props && typeof b.props === "object" ? b.props : {} }));
  const out = { key, label, ...(t.singular ? { singular: String(t.singular).trim() } : {}), path: pathv, fields, template };
  if (t.index) out.index = { ...(t.index.title ? { title: String(t.index.title).trim() } : {}), ...(t.index.description ? { description: String(t.index.description).trim() } : {}) };
  return { type: out };
}
function writeTypes(dir, types) {
  fs.mkdirSync(siteContentDir(dir), { recursive: true });
  fs.writeFileSync(typesFile(dir), JSON.stringify({ types }, null, 2) + "\n");
}
function readEntries(dir, key) {
  let files = [];
  try { files = fs.readdirSync(entryDir(dir, key)).filter((f) => f.endsWith(".json")).sort(); } catch { return []; }
  return files.map((f) => { const id = f.replace(/\.json$/, ""); const data = readJsonFile(path.join(entryDir(dir, key), f)) || {}; return { id, ...data, title: data.title || id }; });
}

ipcMain.handle("site:types", () => {
  if (!currentProject) return { types: [], entries: {} };
  const types = readTypes(currentProject);
  const entries = {};
  for (const t of types) entries[t.key] = readEntries(currentProject, t.key);
  return { types, entries };
});
// Save one type (create or replace by key). The folder is created so the
// collection loader has something to read.
ipcMain.handle("site:saveType", (_e, { type } = {}) => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  const r = cleanType(type); if (r.error) return { ok: false, error: r.error };
  const types = readTypes(currentProject);
  const i = types.findIndex((t) => t.key === r.type.key);
  if (i >= 0) types[i] = r.type; else types.push(r.type);
  try { writeTypes(currentProject, types); fs.mkdirSync(entryDir(currentProject, r.type.key), { recursive: true }); return { ok: true, type: r.type }; }
  catch (e) { return { ok: false, error: e.message }; }
});
// Remove a type declaration. Its entries stay on disk (never destructive here);
// they are simply no longer built.
ipcMain.handle("site:deleteType", (_e, { key } = {}) => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  const types = readTypes(currentProject).filter((t) => t.key !== key);
  try { writeTypes(currentProject, types); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle("site:saveEntry", (_e, { key, id, data } = {}) => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  if (!validTypeKey(key) || !validPageId(id)) return { ok: false, error: "Bad type or entry id." };
  if (!data || typeof data.title !== "string" || !data.title.trim()) return { ok: false, error: "An entry needs a title." };
  const t = readTypes(currentProject).find((x) => x.key === key);
  if (!t) return { ok: false, error: "Unknown type." };
  const doc = { title: data.title.trim(), slug: slugifyId(data.slug || id) || id };
  if (data.seo && typeof data.seo === "object") { doc.seo = {}; for (const [k, v] of Object.entries(data.seo)) if (v !== "" && v != null && v !== false) doc.seo[k] = v; if (!Object.keys(doc.seo).length) delete doc.seo; }
  for (const f of t.fields) {
    let v = data[f.key];
    if (v === "" || v == null) continue;
    if (f.kind === "number") { v = Number(v); if (Number.isNaN(v)) continue; }
    else if (f.kind === "boolean") v = !!v;
    else if (f.kind === "list") v = (Array.isArray(v) ? v : String(v).split("\n")).map((x) => String(x).trim()).filter(Boolean);
    else if (f.kind === "image") { if (!v.src) continue; v = { src: String(v.src).trim(), alt: String(v.alt || "").trim() }; }
    else if (f.kind === "link") { if (!v.href) continue; v = { label: String(v.label || "").trim(), href: String(v.href).trim() }; }
    else v = String(v);
    doc[f.key] = v;
  }
  if (Array.isArray(data.blocks) && data.blocks.length) doc.blocks = data.blocks.filter((b) => b && typeof b.type === "string").map((b) => ({ type: b.type, props: b.props && typeof b.props === "object" ? b.props : {} }));
  try { fs.mkdirSync(entryDir(currentProject, key), { recursive: true }); fs.writeFileSync(entryFile(currentProject, key, id), JSON.stringify(doc, null, 2) + "\n"); return { ok: true, entry: { id, ...doc } }; }
  catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle("site:createEntry", (_e, { key, title } = {}) => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  if (!validTypeKey(key)) return { ok: false, error: "Bad type." };
  const t = String(title || "").trim(); if (!t) return { ok: false, error: "Give it a title." };
  let id = slugifyId(t) || "entry"; const base = id; let n = 2;
  while (fs.existsSync(entryFile(currentProject, key, id))) id = `${base}-${n++}`;
  const doc = { title: t, slug: id };
  try { fs.mkdirSync(entryDir(currentProject, key), { recursive: true }); fs.writeFileSync(entryFile(currentProject, key, id), JSON.stringify(doc, null, 2) + "\n"); return { ok: true, entry: { id, ...doc } }; }
  catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle("site:deleteEntry", (_e, { key, id } = {}) => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  if (!validTypeKey(key) || !validPageId(id)) return { ok: false, error: "Bad type or entry id." };
  try { fs.rmSync(entryFile(currentProject, key, id), { force: true }); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
});

// ---- Media (public/images) ---------------------------------------------------
// The project's images, as the CMS image picker sees them: every file under
// public/images (the folder the design's assets already live in), with size and
// dimensions, addressed by the same "/images/…" path the site serves. Uploads
// copy a chosen file in under a safe, unique name; no external service (the Blob
// adapter is a later phase).
const MEDIA_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg"]);
function mediaDir(dir) { return path.join(dir, "public", "images"); }
function listMedia(dir) {
  const root = mediaDir(dir);
  const out = [];
  const walk = (d, rel) => {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const abs = path.join(d, e.name); const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { walk(abs, r); continue; }
      if (!MEDIA_EXT.has(path.extname(e.name).toLowerCase())) continue;
      let size = 0, width = 0, height = 0, mtime = 0;
      try { const st = fs.statSync(abs); size = st.size; mtime = st.mtimeMs; } catch {}
      if (!/\.svg$/i.test(e.name)) { try { const sz = nativeImage.createFromPath(abs).getSize(); width = sz.width; height = sz.height; } catch {} }
      out.push({ rel: r, name: e.name, url: `/images/${r}`, file: pathToFileURL(abs).href, size, width, height, mtime });
    }
  };
  walk(root, "");
  out.sort((a, b) => b.mtime - a.mtime);
  return out;
}
// A file name safe for a URL and unique in the folder ("My Photo (1).JPG" → my-photo-1.jpg).
function mediaName(dir, original) {
  const ext = path.extname(original).toLowerCase();
  const base = slugifyId(path.basename(original, path.extname(original))) || "image";
  let name = base + ext; let n = 2;
  while (fs.existsSync(path.join(mediaDir(dir), name))) name = `${base}-${n++}${ext}`;
  return name;
}
ipcMain.handle("media:list", () => (currentProject ? listMedia(currentProject) : []));
// Uploads become AVIF (auto-oriented, metadata stripped, at most MEDIA_MAX_WIDTH
// wide, never upscaled) via the conversion worker; a designer never has to know
// what a file format is. sharp's shipped libvips encodes AVIF (and decodes HEIC),
// so no extra library. Files already AVIF pass through, SVG (a vector) and GIF
// (animation) too. A failed conversion falls back to copying the original.
// Defaults; a project can adjust them in the CMS Settings tab (.thinkany/cms.json).
const MEDIA_MAX_WIDTH = 2400;
const MEDIA_QUALITY = 55; // AVIF: ~55% smaller than WebP q82 on photos at this setting
const MEDIA_OUT_EXT = ".avif";
// ---- CMS settings (per project) ----------------------------------------------
function cmsSettingsPath(dir) { return path.join(dir, ".thinkany", "cms.json"); }
function cmsDefaults() { return { media: { quality: MEDIA_QUALITY, maxWidth: MEDIA_MAX_WIDTH } }; }
function loadCmsSettings(dir) {
  const d = cmsDefaults();
  const j = dir ? readJsonFile(cmsSettingsPath(dir)) : null;
  if (j && j.media) {
    const q = Number(j.media.quality), w = Number(j.media.maxWidth);
    if (q >= 20 && q <= 95) d.media.quality = Math.round(q);
    if (w >= 800 && w <= 6000) d.media.maxWidth = Math.round(w);
  }
  return d;
}
function saveCmsSettings(dir, patch) {
  const cur = loadCmsSettings(dir);
  const next = { ...cur, media: { ...cur.media, ...(patch && patch.media ? patch.media : {}) } };
  const q = Number(next.media.quality), w = Number(next.media.maxWidth);
  next.media.quality = Math.min(95, Math.max(20, Math.round(Number.isFinite(q) ? q : MEDIA_QUALITY)));
  next.media.maxWidth = Math.min(6000, Math.max(800, Math.round(Number.isFinite(w) ? w : MEDIA_MAX_WIDTH)));
  fs.mkdirSync(path.dirname(cmsSettingsPath(dir)), { recursive: true });
  fs.writeFileSync(cmsSettingsPath(dir), JSON.stringify(next, null, 2) + "\n");
  return next;
}
ipcMain.handle("cms:getSettings", () => ({ ...loadCmsSettings(currentProject), defaults: cmsDefaults() }));
ipcMain.handle("cms:setSettings", (_e, patch) => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  try { return { ok: true, ...saveCmsSettings(currentProject, patch || {}) }; } catch (e) { return { ok: false, error: e.message }; }
});
const MEDIA_CONVERT = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".heic", ".heif"]);
function convertImage(inPath, outPath, { maxWidth = MEDIA_MAX_WIDTH, quality = MEDIA_QUALITY } = {}) {
  return new Promise((resolve) => {
    // The worker is a real file (asarUnpack) since a child process reads it from disk.
    const p = spawn(process.execPath, [unpacked(path.join(__dirname, "media-convert.cjs")), inPath, outPath, String(maxWidth), String(quality)], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_PATH: unpacked(path.join(appRoot, "node_modules")) },
    });
    let out = ""; p.stdout.on("data", (b) => { out += b.toString(); });
    p.on("exit", () => { try { resolve(JSON.parse(out)); } catch { resolve({ ok: false, error: "conversion failed" }); } });
    p.on("error", (e) => resolve({ ok: false, error: e.message }));
  });
}
ipcMain.handle("media:upload", async () => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "Add images",
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "tif", "tiff", "heic", "heif"] }],
  });
  if (res.canceled || !res.filePaths.length) return { ok: true, added: [] };
  fs.mkdirSync(mediaDir(currentProject), { recursive: true });
  const settings = loadCmsSettings(currentProject).media;
  const added = [];
  for (const src of res.filePaths) {
    const ext = path.extname(src).toLowerCase();
    const base = path.basename(src, path.extname(src));
    try {
      if (MEDIA_CONVERT.has(ext)) {
        const name = mediaName(currentProject, base + MEDIA_OUT_EXT);
        const r = await convertImage(src, path.join(mediaDir(currentProject), name), settings);
        if (r.ok) { added.push(name); continue; }
        console.warn(`[media] conversion failed for ${path.basename(src)}: ${r.error}; copying the original`);
        if (!MEDIA_EXT.has(ext)) continue; // a format the site can't serve anyway
      }
      if (!MEDIA_EXT.has(ext)) continue;
      const name = mediaName(currentProject, path.basename(src));
      fs.copyFileSync(src, path.join(mediaDir(currentProject), name)); added.push(name);
    } catch (e) { return { ok: false, error: e.message, added: added.map((n) => `/images/${n}`) }; }
  }
  return { ok: true, added: added.map((n) => `/images/${n}`) };
});
ipcMain.handle("media:delete", (_e, { rel } = {}) => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  if (typeof rel !== "string" || rel.includes("..") || path.isAbsolute(rel)) return { ok: false, error: "Bad path." };
  try { fs.rmSync(path.join(mediaDir(currentProject), rel), { force: true }); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
});

// ---- Site IPC ----------------------------------------------------------------
ipcMain.handle("site:status", () => {
  if (!currentProject) return { ready: false, reason: "no-project", url: null };
  const r = siteReady(currentProject);
  return { ready: r.ready, reason: r.ready ? null : r.reason, url: siteUrl, running: !!siteProc };
});
ipcMain.handle("site:start", async () => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  const r = siteReady(currentProject);
  if (!r.ready) return { ok: false, error: r.reason };
  if (siteProc && siteUrl) return { ok: true, url: siteUrl };
  try { return { ok: true, url: await startSiteFor(currentProject) }; }
  catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle("site:build", async () => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  const r = siteReady(currentProject);
  if (!r.ready) return { ok: false, error: r.reason };
  return buildSite(currentProject);
});

// The SITE publish: the public website, its own Vercel project ("<name>-site"), no
// gate, SITE_URL baked in. Guarantees the site deps in package.json first (Vercel
// installs from it), and pins content/site.json's url to the live address after.
async function publishSite(event, token) {
  const r = siteReady(currentProject);
  if (!r.ready) {
    const why = { "no-site": "This project has no site target yet.", "not-promoted": "Promote the approved design first (/promote-blocks), then publish the site.", "no-home": "The site has no home page yet." }[r.reason] || "The site isn't ready to publish.";
    return { ok: false, error: why };
  }
  const scope = loadVercelScope();
  const rec = loadPublish(currentProject);
  const site = rec.site || {};
  const projectName = site.projectName || `${deriveProjectName(currentProject)}-site`;
  const onProgress = (evt) => { if (!event.sender.isDestroyed()) event.sender.send("publish:progress", { ...evt, target: "site" }); };
  try {
    ensureSiteDeps(currentProject);
    // Build locally first: a bad block or content fails here with the real message
    // instead of on Vercel minutes later.
    onProgress({ step: "check", status: "run", detail: "Checking the site builds" });
    const check = await buildSite(currentProject);
    if (!check.ok) {
      onProgress({ step: "check", status: "error", detail: check.error });
      return { ok: false, target: "site", error: `The site didn't build: ${check.error}` };
    }
    onProgress({ step: "check", status: "done", detail: "Site builds cleanly" });
    const res = await vercel.publishProject({
      token,
      teamId: scope.teamId || null,
      projectDir: currentProject,
      projectName,
      target: "site",
      customDomain: site.customDomain || null,
      onProgress,
    });
    savePublish(currentProject, {
      ...rec,
      site: { ...site, projectName: res.projectName, projectId: res.projectId, url: res.url, lastDeployAt: new Date().toISOString() },
    });
    setSiteUrl(currentProject, res.url);
    return { ok: true, target: "site", url: res.url, projectName: res.projectName, domainPending: res.domainPending, domainError: res.domainError };
  } catch (e) {
    return { ok: false, target: "site", error: e.message || String(e) };
  }
}

// Stop the in-flight agent turn (the designer hit Back mid-intake). interrupt() ends
// the SDK turn so no further output streams and its completion can't hijack a fresh
// turn's state. Best-effort: no active turn, or an interrupt that throws, is a no-op.
ipcMain.handle("agent:interrupt", async () => {
  const q = activeQuery;
  if (!q) return { ok: false, error: "no active turn" };
  try { await q.interrupt(); return { ok: true }; }
  catch (e) { console.error("[agent] interrupt failed:", e && e.message); return { ok: false, error: e && e.message }; }
});

// ---- Research toggle IPC ----------------------------------------------------
ipcMain.handle("research:get", () => ({
  licensed: researchLicensed(),
  global: loadResearchGlobal(),
  variation: currentProject ? loadResearchVariation(currentProject) : null, // null|true|false
  broadGlobal: loadBroadGlobal(),
  broadVariation: currentProject ? loadBroadVariation(currentProject) : null,
  variationId: currentProject ? activeVariationId(currentProject) : null,
  effective: researchActive(currentProject),
  broadEffective: broadActive(currentProject),
}));
// ---- Images mode IPC (placeholder-only vs source) — a global preference --------
function loadImagesPlaceholder() { return !!loadUiState().imagesPlaceholder; }
ipcMain.handle("images:get", () => ({ placeholder: loadImagesPlaceholder() }));
ipcMain.handle("images:set", (_e, { placeholder }) => { setUiState({ imagesPlaceholder: !!placeholder }); return { ok: true }; });

ipcMain.handle("research:setGlobal", (_e, { enabled }) => { saveResearchGlobal(enabled); return { ok: true }; });
ipcMain.handle("research:setVariation", (_e, { enabled }) => {
  if (currentProject) saveResearchVariation(currentProject, enabled);
  return { ok: true };
});
ipcMain.handle("research:setBroadGlobal", (_e, { enabled }) => { saveBroadGlobal(enabled); return { ok: true }; });
ipcMain.handle("research:setBroadVariation", (_e, { enabled }) => {
  if (currentProject) saveBroadVariation(currentProject, enabled);
  return { ok: true };
});

// ---- Session history IPC ----------------------------------------------------
ipcMain.handle("session:list", () => (currentProject ? loadSessionsIndex(currentProject) : []));
ipcMain.handle("session:archive", (_e, { sessionId }) => {
  const rec = currentProject ? archiveSession(currentProject, sessionId) : null;
  if (sessionId && sessionId === currentSessionId) currentSessionId = null; // it's being closed out
  return rec;
});
ipcMain.handle("session:load", (_e, { id }) => {
  if (!currentProject) return null;
  const rec = loadSessionsIndex(currentProject).find((s) => s.id === id);
  if (!rec) return null;
  ensureSdkTranscript(currentProject, rec); // so `resume` can find it
  let jsonl; try { jsonl = fs.readFileSync(path.join(sessionsDir(currentProject), rec.file), "utf8"); } catch { return null; }
  const { messages } = parseTranscript(jsonl);
  currentSessionId = rec.sessionId; // we're now live in this session again
  return { sessionId: rec.sessionId, messages, title: rec.title, createdAt: rec.createdAt };
});
ipcMain.handle("session:delete", (_e, { id }) => { if (currentProject) deleteSession(currentProject, id); return { ok: true }; });
ipcMain.handle("session:deleteAll", () => { if (currentProject) deleteAllSessions(currentProject); return { ok: true }; });

// Read the app version from package.json directly — app.getVersion() falls back
// to the Electron version (43.x) in the dev launch (`electron desktop/main.cjs`),
// which doesn't resolve the root package.json.
ipcMain.handle("app:version", () => {
  try { return require(path.join(appRoot, "package.json")).version; }
  catch { return app.getVersion(); }
});

// ---- Copy-voice IPC ---------------------------------------------------------
ipcMain.handle("voice:get", () => ({ project: loadProjectVoice(currentProject), global: loadGlobalRules() }));
ipcMain.handle("voice:saveProject", (_e, v) => { saveProjectVoice(currentProject, v); return { ok: true }; });
ipcMain.handle("voice:saveGlobal", (_e, { rules }) => { saveGlobalRules(rules); return { ok: true }; });

ipcMain.handle("agent:answer", (_event, { id, answers }) => {
  const p = pendingAsks.get(id);
  if (p) {
    pendingAsks.delete(id);
    p.resolve(answers);
  }
  return { ok: true };
});

ipcMain.handle("agent:cancelAsk", (_event, { id }) => {
  const p = pendingAsks.get(id);
  if (p) {
    pendingAsks.delete(id);
    p.reject(new Error("cancelled"));
  }
  return { ok: true };
});

// Begin a Get-Designing intake → start a fresh Brief for this flow (T5).
ipcMain.handle("intake:begin", (_event, { deliverableType, projectType } = {}) => {
  intakeBrief = createEmptyBrief(deliverableType || "web-pages");
  if (projectType) intakeBrief.projectType = projectType; // website | app (first fork)
  return { ok: true };
});

// Free-form "add more context" from the review step → append to the Brief's notes
// and push the updated Brief so the pane's brief rail refreshes (not just the chat).
ipcMain.handle("intake:addNote", (event, { text } = {}) => {
  const t = (text || "").trim();
  if (!t) return { ok: true };
  if (!intakeBrief) intakeBrief = createEmptyBrief("web-pages");
  intakeBrief.notes = Array.isArray(intakeBrief.notes) ? [...intakeBrief.notes, t] : [t];
  if (!event.sender.isDestroyed()) event.sender.send("agent:brief", intakeBrief);
  return { ok: true };
});

// The renderer-injected Tone/rules step feeds the picked tone straight into the
// Brief (it has no agent card), so the design prompt (buildDesignPrompt → "Tone: …")
// and the captured dashboard-card brief both carry it.
ipcMain.handle("intake:setTone", (event, { tone } = {}) => {
  if (!intakeBrief) intakeBrief = createEmptyBrief("web-pages");
  intakeBrief.tone = String(tone || "").trim();
  if (!event.sender.isDestroyed()) event.sender.send("agent:brief", intakeBrief);
  return { ok: true };
});

// Phase 2: turn the accumulated Brief into a natural-language `/design-brief`
// invocation. That command's orchestrator parses references/colors/fonts, runs the
// extractors, applies the brand into v01 (which flips previewReady → the pane
// reveals the live preview), then designs the page. Kept as an assembled NL string
// because /design-brief is authored around $ARGUMENTS, not a structured object.
// The designer's picked header/navigation layout → an explicit build instruction.
// Keep the ids in sync with MENU_LAYOUTS in shell.js (the renderer catalog). Type
// (simple / dropdown / mega) governs the menu behaviour (menu.ts); the rest is the
// logo/link placement in the Header.
const MENU_LAYOUT_PHRASES = {
  "simple-left-right": "a simple header (no dropdowns), logo on the left and nav links on the right",
  "simple-left-center": "a simple header (no dropdowns), logo on the left and nav links centered",
  "simple-center-split": "a simple header (no dropdowns), logo centered with nav links split to its left and right",
  "dropdown-left-right": "a header with dropdown menus, logo on the left and nav links on the right",
  "dropdown-left-center": "a header with dropdown menus, logo on the left and nav links centered",
  "dropdown-center-split": "a header with dropdown menus, logo centered with nav links split to its left and right",
  "mega-left-right": "a header with a full-width mega menu, logo on the left and nav links on the right",
  "mega-left-center": "a header with a full-width mega menu, logo on the left and nav links centered",
  "mega-center-split": "a header with a full-width mega menu, logo centered with nav links split to its left and right",
};

// The designer's picked hero layout → an explicit, authoritative build instruction.
// Keep the ids in sync with HERO_LAYOUTS in shell.js (the renderer catalog).
const HERO_LAYOUT_PHRASES = {
  "centered": "a centered hero — headline, subhead, and call-to-action buttons stacked and centered",
  "split": "a split hero — the copy on one side and a supporting visual on the other",
  "full-screen": "a full-screen hero that fills the viewport (100vh), with the copy overlaid on a full-bleed image or color",
  "minimal": "a type-led hero — a large left-aligned headline with generous whitespace and no dominant image",
  "showcase": "a product-showcase hero — a short headline up top with a large product visual dominating below",
};

// The designer's picked contact/CTA build type → an explicit build instruction. Keep
// the ids in sync with CTA_TYPES in shell.js (the renderer catalog). The template has
// NO backend, so the form phrase tells the model to build a client-validated form with
// a fake success state rather than invent a server call.
const CTA_TYPE_PHRASES = {
  "cta-form": "Build the contact / call-to-action section as a contact form (name, email, message, submit), " +
    "using react-hook-form + the shadcn form components (form/input/textarea/label/button), with client-side " +
    "validation and inline errors. There is NO backend, so do not POST anywhere or invent an API call: on a " +
    "valid submit, show a graceful success state (e.g. “Thanks — we’ll be in touch”) instead of sending",
  "cta-button": "Build the contact / call-to-action section as a button-led call to action (a prominent " +
    "button or link like “Get in touch” or “Book a call”, plus supporting contact details such as email / " +
    "phone / social), not a form",
};

function buildDesignPrompt(brief) {
  const b = brief || {};
  const parts = [];
  const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
  if (b.what) parts.push(String(b.what).trim());
  if (b.projectType) parts.push(`Project type: ${b.projectType}`);
  if (b.clientName) parts.push(`Client / company: ${b.clientName}`);
  if (b.projectName) parts.push(`Project name: ${b.projectName}`);
  if (b.logo && b.logo.src) {
    parts.push(
      `A brand logo image is saved at \`public${b.logo.src}\` (served at \`${b.logo.src}\`) and ` +
      `VITE_BRAND_LOGO is already set, so the scaffold header/footer render it automatically. ` +
      `Use the logo in the site header (top-nav brand lockup) in place of the text name, and ` +
      `optionally in the footer; if you author a divergent Header/Footer for this variation, keep ` +
      `the logo image (an <img> capped to a sensible height, aspect preserved) instead of the wordmark`
    );
  }
  const refs = list(b.references)
    .map((r) => (r && r.url ? (r.reason ? `${r.url} (drawn to: ${r.reason})` : r.url) : ""))
    .filter(Boolean);
  if (refs.length) parts.push(`Model the structure and feel on ${refs.join("; ")}`);
  const colors = list(b.colorSources).map((c) => c && c.value).filter(Boolean);
  if (colors.length) parts.push(`Colors from ${colors.join(", ")}`);
  const fonts = list(b.fontSources).map((f) => f && f.value).filter(Boolean);
  if (fonts.length) parts.push(`Fonts ${fonts.join(", ")}`);
  if (list(b.sections).length) parts.push(`Include these sections: ${b.sections.join(", ")}`);
  if (b.menuLayout && MENU_LAYOUT_PHRASES[b.menuLayout]) {
    parts.push(
      "Header / navigation layout (the designer’s explicit choice — build the site " +
      "header this way, configuring menu.ts for the menu style): " +
      MENU_LAYOUT_PHRASES[b.menuLayout]
    );
  }
  if (b.heroLayout && HERO_LAYOUT_PHRASES[b.heroLayout]) {
    parts.push(
      "Hero section layout (the designer’s explicit choice — honor this exactly for " +
      `the hero, over any other hero guidance): ${HERO_LAYOUT_PHRASES[b.heroLayout]}`
    );
  }
  if (b.ctaType && CTA_TYPE_PHRASES[b.ctaType]) {
    parts.push(
      "Contact / call-to-action section (the designer’s explicit choice — build it this way): " +
      CTA_TYPE_PHRASES[b.ctaType]
    );
  }
  if (list(b.audience).length) parts.push(`Audience: ${b.audience.join(", ")}`);
  if (b.tone) parts.push(`Tone: ${b.tone}`);
  if (list(b.deviceTargets).length) parts.push(`Devices: ${b.deviceTargets.join(", ")}`);
  if (list(b.notes).length) parts.push(`Also: ${b.notes.join("; ")}`);
  // Reference-ingest (T3): if the designer uploaded references, point the build at
  // the distilled digest and make it the PRIMARY style direction. The digest (not
  // the raw assets) is what rides the build — the agent reads it once from disk.
  if (b.referenceDigest) {
    parts.push(
      "The designer uploaded design references. A distilled style digest is at " +
      "`.thinkany/references/digest.md`, with the exact palette and fonts in " +
      "`.thinkany/references/digest.json`. Read the digest FIRST and treat it as the " +
      "PRIMARY style direction (feel, type, layout, imagery, emulate/avoid), and apply " +
      "the EXACT palette hexes from the json. Only open the raw reference files if you " +
      "are specifically asked"
    );
  }
  const body = parts.join(". ");
  let prompt = "/design-brief " + (body || "a clean, modern marketing website");
  // Fold in the sampled Design Direction (design-variety) as its own block, so the
  // build is conditioned onto a distinct compositional direction rather than the
  // model's default centroid. Present once the intake sets b.direction (T5).
  if (b.directionBlock) prompt += "\n\n" + b.directionBlock; // server-rendered at sample time
  return prompt;
}
ipcMain.handle("intake:designPrompt", async () => {
  // Fold the on-disk reference digest into the Brief so the build consumes it.
  if (intakeBrief && currentProject) {
    const dg = ingestRefs.readDigest(currentProject);
    if (dg && Array.isArray(dg.assets) && dg.assets.length) {
      intakeBrief.referenceDigest = ingestRefs.readDigestMd(currentProject);
      intakeBrief.referenceAssets = dg.assets;
    }
  }
  // Design-variety (T5): sample a Direction at build handoff so the build is conditioned onto
  // a distinct compositional direction, not the model's default. Auto by default; skipped if
  // one is already set (a reroll/knob path set it first). Cloud call — degrades to no direction
  // (build proceeds at the default centroid) if the endpoint is unreachable.
  if (intakeBrief && !intakeBrief.direction && varietyLicensed()) {
    const { direction, block } = await sampleDirection({
      what: intakeBrief.what,
      tone: intakeBrief.tone,
      projectType: intakeBrief.projectType,
      references: intakeBrief.references, // the "why I like it" steers the direction
      designer: designerId(), // reads this designer's anti-repetition memory (lever 3)
    });
    if (direction) { intakeBrief.direction = direction; intakeBrief.directionBlock = block; }
  }
  // Commit point: this Direction is now going into a real build, so record it onto the
  // designer's anti-repetition memory (fire-and-forget; a failed write never blocks the build).
  if (intakeBrief && intakeBrief.direction && varietyLicensed()) {
    recordDirection({ designer: designerId(), direction: intakeBrief.direction });
  }
  // Persist the sampled Direction where the build can pick it up (T4): the /design-brief skill
  // reads /tmp/ta-direction.json and folds it into variation.json (its reproducible DNA + the
  // dashboard card). The direction already carries its server-stamped lensLabel.
  if (intakeBrief && intakeBrief.direction) {
    try { fs.writeFileSync("/tmp/ta-direction.json", JSON.stringify(intakeBrief.direction, null, 2)); } catch {}
  }
  return { prompt: buildDesignPrompt(intakeBrief) };
});

// Design-variety is a licensed add-on (Rob 2026-08-17) sharing Research's license tier:
// one licensed key unlocks both. Unlicensed → nothing samples, no block is injected, and
// the knob panel stays dark (directionMeta returns empty so the renderer skips it).
const varietyLicensed = researchLicensed;

// P2 knob panel: the axis stops (for the sliders) + lens labels, from the cloud (cached).
ipcMain.handle("intake:directionMeta", async () => (varietyLicensed() ? await directionMeta() : { axes: {}, lenses: [] }));

// P2: (re)sample a Direction from the brief plus any axes the designer pinned with the
// knobs. No seed → a fresh draw each call (this is the reroll). Stores it on the brief so
// the build handoff uses exactly what the designer sees, and pushes the brief so the rail
// stays in sync.
ipcMain.handle("intake:sampleDirection", async (event, { axes, lens } = {}) => {
  if (!varietyLicensed()) return { direction: null };
  if (!intakeBrief) intakeBrief = createEmptyBrief("web-pages");
  const { direction, block } = await sampleDirection({
    what: intakeBrief.what,
    tone: intakeBrief.tone,
    projectType: intakeBrief.projectType,
    references: intakeBrief.references, // the "why I like it" steers the direction
    axes: axes && typeof axes === "object" ? axes : undefined,
    lens: lens || undefined,
    designer: designerId(), // a reroll also avoids the designer's recent lenses/motifs
  });
  intakeBrief.direction = direction;
  intakeBrief.directionBlock = block;
  if (!event.sender.isDestroyed()) event.sender.send("agent:brief", intakeBrief);
  return { direction };
});

// ---- Post-build reroll (fork an existing design with a new direction) --------
// The next free variation id, scanning existing folders (max + 1, so gaps/removals
// never collide). Base v00 has no folder, so folders are v01, v02, …
function nextVariationFolderId(projectDir) {
  let max = 0;
  try {
    for (const e of fs.readdirSync(path.join(projectDir, "src", "variations"), { withFileTypes: true })) {
      const m = e.isDirectory() && /^v(\d+)$/.exec(e.name);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  } catch { /* no variations dir */ }
  return "v" + String(max + 1).padStart(2, "0");
}

// Version tag derived from a variation id ("v03" → "v0.3"), matching the scaffold's
// versionTagForId (src/data/variations.ts). Deriving the badge from the id — which is
// itself unique (nextVariationFolderId = max+1) — is what keeps the version from ever
// duplicating across rerolls (rerolling one design twice used to yield two "v0.2"s).
function versionTagForId(id) {
  const n = parseInt(String(id).replace(/\D/g, ""), 10) || 0;
  return `v${Math.floor(n / 10)}.${n % 10}`;
}

// Art Director — a READ-ONLY design review the designer confers with. Deterministic
// (zero model tokens): lints a variation's files + palette against the /design rules.
// Never edits; returns findings the designer decides on. See docs/art-director-spec.md.
ipcMain.handle("artdirector:review", (_event, { id } = {}) => {
  if (!varietyLicensed()) return { error: "not-licensed" }; // shares the Research/design-variety tier
  if (!currentProject) return { error: "no-project" };
  if (!id) return { error: "no-variation" };
  try { return require("./artdirector.cjs").reviewVariation(currentProject, id); }
  catch (e) { return { error: String((e && e.message) || e) }; }
});

// ---- Art Director review store (Phase 3): recommendations per variation, persisted so
// the Director drawer + its Archive survive restarts. { [variationId]: { active, dismissed } }.
function artDirectorStorePath(dir) { return path.join(dir, ".thinkany", "artdirector.json"); }
function loadArtDirectorStore(dir) {
  try { return JSON.parse(fs.readFileSync(artDirectorStorePath(dir), "utf8")); } catch { return {}; }
}
ipcMain.handle("artdirector:loadRecs", (_event, { id } = {}) => {
  if (!currentProject || !id) return { active: [], dismissed: [], completed: [] };
  const rec = loadArtDirectorStore(currentProject)[id];
  return { active: (rec && rec.active) || [], dismissed: (rec && rec.dismissed) || [], completed: (rec && rec.completed) || [] };
});
ipcMain.handle("artdirector:saveRecs", (_event, { id, active, dismissed, completed } = {}) => {
  if (!currentProject || !id) return { ok: false };
  const store = loadArtDirectorStore(currentProject);
  store[id] = { active: active || [], dismissed: dismissed || [], completed: completed || [], updatedAt: new Date().toISOString() };
  try {
    fs.mkdirSync(path.join(currentProject, ".thinkany"), { recursive: true });
    fs.writeFileSync(artDirectorStorePath(currentProject), JSON.stringify(store, null, 2));
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
  return { ok: true };
});

// Accessibility review findings, persisted per variation (mirrors the Art Director store) so
// Held/Dismissed/Completed state survives restarts + re-runs. .thinkany/a11y.json.
function a11yStorePath(dir) { return path.join(dir, ".thinkany", "a11y.json"); }
function loadA11yStore(dir) {
  try { return JSON.parse(fs.readFileSync(a11yStorePath(dir), "utf8")); } catch { return {}; }
}
ipcMain.handle("a11y:load", (_event, { id } = {}) => {
  if (!currentProject || !id) return { active: [], dismissed: [], completed: [], ranAt: null };
  const rec = loadA11yStore(currentProject)[id];
  return { active: (rec && rec.active) || [], dismissed: (rec && rec.dismissed) || [], completed: (rec && rec.completed) || [], ranAt: (rec && rec.ranAt) || null };
});
ipcMain.handle("a11y:save", (_event, { id, active, dismissed, completed, ranAt } = {}) => {
  if (!currentProject || !id) return { ok: false };
  const store = loadA11yStore(currentProject);
  store[id] = { active: active || [], dismissed: dismissed || [], completed: completed || [], ranAt: ranAt || null, updatedAt: new Date().toISOString() };
  try {
    fs.mkdirSync(path.join(currentProject, ".thinkany"), { recursive: true });
    fs.writeFileSync(a11yStorePath(currentProject), JSON.stringify(store, null, 2));
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
  return { ok: true };
});

// Read a variation's variation.json (for the reroll: its brief + current direction seed
// the panel and the fork). Not gated — reading is harmless; the reroll UI is gated.
ipcMain.handle("variation:read", (_event, { id } = {}) => {
  if (!currentProject || !id) return { meta: null };
  try { return { meta: JSON.parse(fs.readFileSync(path.join(currentProject, "src", "variations", id, "variation.json"), "utf8")) }; }
  catch { return { meta: null }; }
});

// Pure sample for the reroll panel: takes the source design's signals explicitly (does NOT
// touch intakeBrief). Same seam + gate as the intake sampler.
ipcMain.handle("direction:sampleFor", async (_event, { signals, axes, lens } = {}) => {
  if (!varietyLicensed()) return { direction: null };
  const s = signals || {};
  const { direction, block } = await sampleDirection({ what: s.what, tone: s.tone, projectType: s.projectType, references: s.references, axes: axes && typeof axes === "object" ? axes : undefined, lens: lens || undefined, designer: designerId() });
  return { direction, block };
});

// Fork a source variation on disk (copy components/ + styles/ = inherit its brand + built
// design), write the fork's variation.json inheriting the brief + brand and stamping the
// NEW direction, and return the rendered direction block for the redesign prompt. The
// build (a /design redesign the caller kicks) then rebuilds ONLY the fork's Home.tsx.
ipcMain.handle("variation:createRerollFork", async (_event, { sourceId, direction } = {}) => {
  if (!varietyLicensed()) return { error: "not-licensed" };
  if (!currentProject || !sourceId) return { error: "no-project" };
  const varsDir = path.join(currentProject, "src", "variations");
  const srcDir = path.join(varsDir, sourceId);
  let srcMeta = {};
  try { srcMeta = JSON.parse(fs.readFileSync(path.join(srcDir, "variation.json"), "utf8")); } catch {}
  const targetId = nextVariationFolderId(currentProject);
  const dstDir = path.join(varsDir, targetId);
  try {
    fs.mkdirSync(dstDir, { recursive: true });
    fs.cpSync(path.join(srcDir, "components"), path.join(dstDir, "components"), { recursive: true });
    fs.cpSync(path.join(srcDir, "styles"), path.join(dstDir, "styles"), { recursive: true });
  } catch (e) { return { error: String(e && e.message || e) }; }
  const dir = direction || srcMeta.direction || null; // already carries its server-stamped lensLabel
  // Re-derive the prompt block from the cloud — reproduces dir via its seed/lens/axes (empty
  // block if the endpoint is unreachable: the reroll still forks, just without the direction block).
  let block = "";
  if (dir) { const r = await sampleDirection({ seed: dir.seed, lens: dir.lens, axes: dir.axes }); block = r.block || ""; }
  const today = new Date().toLocaleDateString("en-US");
  const meta = {
    version: versionTagForId(targetId), // unique per id → no duplicate "v0.2" badges
    title: srcMeta.title ? `${srcMeta.title} (reroll)` : "Reroll",
    description: srcMeta.description || "",
    createdAt: today,
    modifiedAt: today,
    styleguideStatus: srcMeta.styleguideStatus || "updated",
    brandStatus: srcMeta.brandStatus || "established",
    previewReady: true,
    primaryColor: srcMeta.primaryColor,
    primaryFont: srcMeta.primaryFont,
    brief: srcMeta.brief || "",
    direction: dir,
  };
  try {
    fs.writeFileSync(path.join(dstDir, "variation.json"), JSON.stringify(meta, null, 2));
    if (dir) fs.writeFileSync("/tmp/ta-direction.json", JSON.stringify(dir, null, 2));
  } catch (e) { return { error: String(e && e.message || e) }; }
  // Commit point: the reroll fork is a real design too — record its Direction so it also
  // counts toward the designer's anti-repetition memory (fire-and-forget).
  if (dir) recordDirection({ designer: designerId(), direction: dir });
  return { targetId, brief: meta.brief, block };
});

// Translate a card batch's answers (keyed by card id) into Brief FIELD values,
// normalizing per card type. Shared by the agent path (agent:intakeAnswer) and the
// client-rendered path (intake:applyAnswers) so both fold answers identically.
function foldCardAnswers(cards, answers) {
  const byField = {};
  for (const c of Array.isArray(cards) ? cards : []) {
    if (!c.field || !answers || !(c.id in answers)) continue;
    let v = answers[c.id];
    // Brief.references is a SourceRef[]. A reference card yields an array of
    // {url,reason} (up to 3); tolerate a lone object from older callers.
    if (c.type === "reference" && v && !Array.isArray(v)) v = [v];
    // color-swatch / font-pick yield a scalar (hex / font name); the Brief's
    // colorSources & fontSources are SourceRef[] — wrap into { value }.
    if ((c.field === "colorSources" || c.field === "fontSources") && v && !Array.isArray(v)) {
      v = [{ value: v, reason: null }];
    }
    byField[c.field] = v;
  }
  return byField;
}

// The pane submitted the designer's intake answers → fold them into the running
// Brief (mapping each card's `field`), push the updated Brief to the pane, and
// resolve the waiting tool call so the agent continues.
ipcMain.handle("agent:intakeAnswer", (event, { id, answers }) => {
  const p = pendingIntakes.get(id);
  if (p) {
    pendingIntakes.delete(id);
    if (intakeBrief && Array.isArray(p.cards)) {
      intakeBrief = applyAnswers(intakeBrief, foldCardAnswers(p.cards, answers));
      if (!event.sender.isDestroyed()) event.sender.send("agent:brief", intakeBrief);
    }
    p.resolve(answers || {});
  }
  return { ok: true };
});

// Client-rendered intake questions (no model turn) fold their answers straight into
// the Brief here — same mapping as the agent path, but there is no pending tool to
// resolve. `cards` carries each answered card's {id, field, type} so foldCardAnswers
// can map + normalize; `answers` is keyed by card id.
ipcMain.handle("intake:applyAnswers", (event, { cards, answers } = {}) => {
  if (!intakeBrief) intakeBrief = createEmptyBrief("web-pages");
  // A logo card carries a { filename, mime, b64 } payload. Persist the image to the
  // project (public/images + .env) here, and hand foldCardAnswers a light { src }
  // descriptor so the Brief never carries base64.
  const patched = { ...(answers || {}) };
  const logoCard = (cards || []).find((c) => c && c.type === "logo");
  if (logoCard) patched[logoCard.id] = saveDesignLogo(patched[logoCard.id]);
  intakeBrief = applyAnswers(intakeBrief, foldCardAnswers(cards, patched));
  if (!event.sender.isDestroyed()) event.sender.send("agent:brief", intakeBrief);
  return { ok: true, brief: intakeBrief };
});

// The designer dismissed the intake → reject so the tool returns an error (not a hang)
// and the agent can decide the remaining fields itself.
ipcMain.handle("agent:cancelIntake", (_event, { id }) => {
  const p = pendingIntakes.get(id);
  if (p) {
    pendingIntakes.delete(id);
    p.reject(new Error("the designer dismissed the intake"));
  }
  return { ok: true };
});

// ---- Key IPC ----------------------------------------------------------------
ipcMain.handle("key:status", () => {
  const key = process.env.ANTHROPIC_API_KEY || "";
  return { hasKey: !!key, keyHint: key ? key.slice(-4) : null };
});
ipcMain.handle("models:list", () => fetchModels());
// Build-fidelity toggle: OFF (default) → design builds run on Sonnet (fast, low cost); ON → they
// run on Opus (slower, pricier, but follows a detailed spec more faithfully — e.g. a Figma page).
// A global pref (ui-state), independent of the user's per-session model pick.
ipcMain.handle("fidelity:get", () => ({ hiFi: !!loadUiState().buildHiFi }));
ipcMain.handle("fidelity:set", (_event, { hiFi } = {}) => { setUiState({ buildHiFi: !!hiFi }); return { ok: true, hiFi: !!hiFi }; });

// Accessibility (AA) mode — opt-in, default OFF. On: builds author to WCAG AA (§4d + apply-brand
// --aa) and the Accessibility review drawer is enabled. A global ui-state pref.
function a11yModeOn() { return !!loadUiState().buildA11y; }
function a11yAutoOn() { return !!loadUiState().buildA11yAuto; }
ipcMain.handle("a11y:get", () => ({ enabled: a11yModeOn(), auto: a11yAutoOn() }));
ipcMain.handle("a11y:set", (_e, { enabled } = {}) => { setUiState({ buildA11y: !!enabled }); return { ok: true, enabled: !!enabled }; });
// Auto-run the accessibility review after a build completes (on) vs manual-only (off).
ipcMain.handle("a11y:setAuto", (_e, { auto } = {}) => { setUiState({ buildA11yAuto: !!auto }); return { ok: true, auto: !!auto }; });

// Quiet-build narration (Phase 3): one live Art-Director sentence per build phase, from a
// cheap Haiku call. Default-ON; a ui-state toggle disables it. Additive — the renderer keeps
// its curated line on any failure/timeout, so this never blocks or breaks the build spine.
function narrateEnabled() { const v = loadUiState().buildNarrate; return v === undefined ? true : !!v; }
ipcMain.handle("narrate:get", () => ({ enabled: narrateEnabled() }));
ipcMain.handle("narrate:set", (_e, { enabled } = {}) => { setUiState({ buildNarrate: !!enabled }); return { ok: true, enabled: !!enabled }; });
ipcMain.handle("narrate:line", async (_e, { phase, title, bits } = {}) => {
  if (!narrateEnabled() || !process.env.ANTHROPIC_API_KEY) return { ok: false };
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk"); // precedent: ingest.cjs visionPass
    const client = new Anthropic();
    const b = bits || {};
    const facts = [
      `Phase: ${title || phase}`,
      b.paletteWord && b.paletteWord !== "palette" ? `Palette: ${b.paletteWord}` : "",
      b.fontWords && b.fontWords !== "your type" ? `Type: ${b.fontWords}` : "",
      b.heroWord ? `Hero layout: ${b.heroWord}` : "",
    ].filter(Boolean).join("; ");
    const call = client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 60,
      temperature: 1,
      system:
        "You are a seasoned art director narrating a live website build to the client. Reply with " +
        "ONE warm, specific, present-tense sentence about the current phase, under 18 words. No " +
        "em-dashes, no preamble, no surrounding quotes.",
      messages: [{ role: "user", content: facts }],
    });
    const msg = await Promise.race([
      call,
      new Promise((_, rej) => setTimeout(() => rej(new Error("narrate timeout")), 4000)),
    ]);
    const line = (msg?.content?.[0]?.text || "").trim().replace(/^["']+|["']+$/g, "");
    return line ? { ok: true, line } : { ok: false };
  } catch { return { ok: false }; }
});
ipcMain.handle("model:get", () => ({ model: currentModel }));
ipcMain.handle("model:set", (_event, { model }) => {
  currentModel = model || null;
  setUiState({ model: currentModel });
  return { ok: true, model: currentModel };
});
ipcMain.handle("key:save", async (_event, { key }) => {
  const k = (key || "").trim();
  if (!k) return { ok: false, error: "Paste your key first." };
  const v = await validateKey(k);
  if (!v.ok) return v;
  try {
    storeKey(k);
  } catch (e) {
    return { ok: false, error: `Could not save the key: ${e.message}` };
  }
  process.env.ANTHROPIC_API_KEY = k;
  return { ok: true };
});
ipcMain.handle("key:clear", () => {
  removeStoredKey();
  delete process.env.ANTHROPIC_API_KEY;
  return { ok: true };
});

// ---- License IPC ------------------------------------------------------------
ipcMain.handle("license:status", () => {
  const key = (process.env.DERIVE_LICENSE_KEY || "").trim();
  return { hasLicense: !!key, hint: key ? key.slice(-4) : null };
});

// "Start from Figma": after /figma-ingest writes .thinkany/references/figma.json, the renderer reads
// it (on turn completion) to show the findings + next-step cards in the full-screen pane. Returns null
// if the ingest did not produce it (e.g. it needed a URL) so the renderer degrades to the chat.
ipcMain.handle("figma:readMeta", () => {
  if (!currentProject) return null;
  try { return JSON.parse(fs.readFileSync(path.join(currentProject, ".thinkany", "references", "figma.json"), "utf8")); }
  catch { return null; }
});

// Wire the imported Figma brand into tokens.css DETERMINISTICALLY, so any next step (Design this
// page / Start designing) starts branded instead of on the template defaults. figma.json already
// carries the exact mapping (colorRoles → the seven --ta-* roles, AA-safe; typeRoles → the faces);
// this just applies it. Non-interactive on purpose — the designer can refine later via
// /setup-styleguide. Fixes the "page built with default --ta-* colors + fonts" bug.
function applyFigmaBrand(projectDir) {
  let meta; try { meta = JSON.parse(fs.readFileSync(path.join(projectDir, ".thinkany", "references", "figma.json"), "utf8")); }
  catch { return { ok: false, reason: "no-figma-json" }; }
  const cssPath = path.join(projectDir, "src", "styles", "tokens.css");
  let css; try { css = fs.readFileSync(cssPath, "utf8"); } catch { return { ok: false, reason: "no-tokens-css" }; }
  const setVar = (name, val) => { if (!val) return; const re = new RegExp(`(--${name}\\s*:\\s*)[^;]+;`); if (re.test(css)) css = css.replace(re, `$1${val};`); };
  const roles = (meta.colorRoles && typeof meta.colorRoles === "object") ? meta.colorRoles : {};
  let nColors = 0; for (const [role, hex] of Object.entries(roles)) if (/^#[0-9a-fA-F]{3,8}$/.test(String(hex))) { setVar(`ta-${role}`, hex); nColors++; }
  const tr = (meta.typeRoles && typeof meta.typeRoles === "object") ? meta.typeRoles : {};
  const fam = (f, fb) => (f ? `"${f}", ${fb}` : null); // custom faces keep a fallback if not uploaded
  let nFonts = 0;
  if (tr.display) { setVar("ta-font-display", fam(tr.display, "system-ui, sans-serif")); nFonts++; }
  if (tr.body) { setVar("ta-font-sans", fam(tr.body, "system-ui, sans-serif")); nFonts++; }
  if (tr.mono) { setVar("ta-font-mono", fam(tr.mono, "ui-monospace, monospace")); nFonts++; }
  try { fs.writeFileSync(cssPath, css); } catch (e) { return { ok: false, reason: String((e && e.message) || e) }; }
  // Set the gleaned brand name too, so the styleguide/header show it immediately instead of the
  // "Client Name" placeholder (the name was known from ingest; no reason to wait for the build).
  if (meta.brandName && typeof meta.brandName === "string") { try { upsertProjectEnv(projectDir, "VITE_CLIENT_NAME", meta.brandName.trim()); } catch { /* env write best-effort */ } }
  return { ok: true, colors: nColors, fonts: nFonts, brandName: meta.brandName || null };
}
ipcMain.handle("figma:applyBrand", () => (currentProject ? applyFigmaBrand(currentProject) : { ok: false, reason: "no-project" }));

// Upload the files for a custom (non-web) font the Figma import flagged. Opens a multi-select
// picker (add one or several weight files), copies them into public/fonts/, and appends a
// weight/style-guessed @font-face block to src/styles/fonts.css so the design can use the real
// family. The designer's --ta-font-* wiring to it happens at styleguide/design time.
const FONT_FORMATS = { ".woff2": "woff2", ".woff": "woff", ".ttf": "truetype", ".otf": "opentype" };
const FONT_WEIGHTS = { thin: 100, hairline: 100, extralight: 200, ultralight: 200, light: 300, book: 400, regular: 400, normal: 400, text: 400, medium: 500, semibold: 600, demibold: 600, bold: 700, extrabold: 800, ultrabold: 800, black: 900, heavy: 900 };
const FONT_WKEYS = Object.keys(FONT_WEIGHTS).sort((a, b) => b.length - a.length); // longest first: "extralight" before "light"
function installFontFiles(projectDir, family, paths) {
  const fam = (family || "Custom Font").trim();
  const fontsDir = path.join(projectDir, "public", "fonts");
  fs.mkdirSync(fontsDir, { recursive: true });
  const faces = [], saved = [];
  for (const src of paths) {
    const fmt = FONT_FORMATS[path.extname(src).toLowerCase()];
    if (!fmt) continue; // .zip etc. not supported yet — individual font files only
    const base = path.basename(src).replace(/\s+/g, "-");
    try { fs.copyFileSync(src, path.join(fontsDir, base)); } catch { continue; }
    saved.push(base);
    const lower = base.toLowerCase();
    let weight = 400; for (const k of FONT_WKEYS) if (lower.includes(k)) { weight = FONT_WEIGHTS[k]; break; }
    const italic = /italic|oblique/.test(lower);
    faces.push(`@font-face {\n  font-family: "${fam}";\n  src: url("/fonts/${base}") format("${fmt}");\n  font-weight: ${weight};\n  font-style: ${italic ? "italic" : "normal"};\n  font-display: swap;\n}`);
  }
  if (!faces.length) return { ok: false, error: "No usable font files (.woff2 / .woff / .ttf / .otf)." };
  const cssPath = path.join(projectDir, "src", "styles", "fonts.css");
  let css = ""; try { css = fs.readFileSync(cssPath, "utf8"); } catch {}
  if (!css.includes(`font-family: "${fam}"`)) {
    try { fs.writeFileSync(cssPath, css + `\n/* ${fam} — uploaded from the Figma import */\n${faces.join("\n")}\n`); }
    catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
  }
  return { ok: true, family: fam, files: saved };
}
ipcMain.handle("font:install", async (_event, { family } = {}) => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  const res = await dialog.showOpenDialog(mainWindow, {
    title: family ? `Upload the ${family} font files` : "Upload font files",
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Fonts", extensions: ["woff2", "woff", "ttf", "otf"] }],
    buttonLabel: "Add fonts",
  });
  if (res.canceled || !res.filePaths.length) return { ok: false, canceled: true };
  return installFontFiles(currentProject, family, res.filePaths);
});

// Manual logo upload from the Figma findings screen — the reliable fallback when auto-export
// couldn't cleanly pull a nested/component logo. Mirrors saveDesignLogo's on-disk convention
// (public/images/logo.<ext> + VITE_BRAND_LOGO) but takes a picked file path.
function installLogoFromFile(projectDir, src) {
  try {
    const ext = (path.extname(src).toLowerCase() || ".png");
    const dir = path.join(projectDir, "public", "images");
    fs.mkdirSync(dir, { recursive: true });
    for (const e of [".svg", ".png", ".jpg", ".jpeg", ".webp"]) { try { fs.unlinkSync(path.join(dir, "logo" + e)); } catch { /* not there */ } }
    const fname = "logo" + ext;
    fs.copyFileSync(src, path.join(dir, fname));
    const rel = "/images/" + fname;
    upsertProjectEnv(projectDir, "VITE_BRAND_LOGO", rel);
    return { ok: true, src: rel, filename: path.basename(src) };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
ipcMain.handle("figma:uploadLogo", async () => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "Upload the brand logo",
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["svg", "png", "jpg", "jpeg", "webp"] }],
    buttonLabel: "Add logo",
  });
  if (res.canceled || !res.filePaths.length) return { ok: false, canceled: true };
  return installLogoFromFile(currentProject, res.filePaths[0]);
});
ipcMain.handle("license:save", async (_event, { key }) => {
  const k = (key || "").trim();
  if (!k) return { ok: false, error: "Enter your license key first." };
  const v = await validateLicense(k);
  if (!v.ok) return v;
  try {
    storeLicense(k);
  } catch (e) {
    return { ok: false, error: `Could not save the license: ${e.message}` };
  }
  process.env.DERIVE_LICENSE_KEY = k;
  return { ok: true };
});
ipcMain.handle("license:clear", () => {
  removeStoredLicense();
  delete process.env.DERIVE_LICENSE_KEY;
  return { ok: true };
});
// Design/Research/Director bundle license (DESIGN_LICENSE_KEY) — same shape, its own key.
ipcMain.handle("license:designStatus", () => {
  const key = (process.env.DESIGN_LICENSE_KEY || "").trim();
  return { hasLicense: !!key, hint: key ? key.slice(-4) : null };
});
ipcMain.handle("license:designSave", async (_event, { key }) => {
  const k = (key || "").trim();
  if (!k) return { ok: false, error: "Enter your license key first." };
  const v = await validateDesignLicense(k);
  if (!v.ok) return v;
  try { storeDesignLicense(k); } catch (e) { return { ok: false, error: `Could not save the license: ${e.message}` }; }
  process.env.DESIGN_LICENSE_KEY = k;
  resetMetaCache(); // license changed → next directionMeta() must re-fetch, not read stale
  if (skillsClient) skillsClient.refresh(k).catch(() => {}); // pull the playbooks for this key
  return { ok: true };
});
ipcMain.handle("license:designClear", () => {
  removeStoredDesignLicense();
  delete process.env.DESIGN_LICENSE_KEY;
  resetMetaCache();
  if (skillsClient) skillsClient.clear(); // no license, no playbooks
  return { ok: true };
});

// ---- Publish IPC (direct-to-Vercel) -----------------------------------------
ipcMain.handle("vercel:status", () => {
  const scope = loadVercelScope();
  return { connected: !!vercelAuth, user: scope.user || null, teamId: scope.teamId || null, teamName: scope.teamName || null };
});
// Sign in with Vercel (OAuth). Opens the browser, catches the callback, exchanges
// the code, validates the token can reach the API, and stores it (with its refresh
// token). Validation catches the case where the app's API permissions aren't active.
ipcMain.handle("vercel:oauthStart", async () => {
  const res = await runVercelOAuth();
  if (!res.ok) return res;
  const v = await vercel.validateToken(res.accessToken);
  if (!v.ok) {
    return { ok: false, error: "Connected, but this account can't reach the Vercel API yet (its API permissions may not be enabled). You can paste an access token instead." };
  }
  storeVercelAuth({ kind: "oauth", accessToken: res.accessToken, refreshToken: res.refreshToken, expiresAt: Date.now() + res.expiresIn * 1000 });
  const scope = loadVercelScope();
  scope.user = v.user;
  saveVercelScope(scope);
  return { ok: true, user: v.user };
});
ipcMain.handle("vercel:save", async (_event, { token }) => {
  const t = (token || "").trim();
  if (!t) return { ok: false, error: "Paste your Vercel token first." };
  const v = await vercel.validateToken(t);
  if (!v.ok) return v;
  try {
    storeVercelAuth({ kind: "token", token: t });
  } catch (e) {
    return { ok: false, error: `Could not save the token: ${e.message}` };
  }
  const scope = loadVercelScope();
  scope.user = v.user;
  saveVercelScope(scope);
  const teams = await vercel.listTeams(t);
  return { ok: true, user: v.user, teams };
});
ipcMain.handle("vercel:teams", async () => {
  const t = await vercelAccessToken();
  if (!t) return { teams: [] };
  return { teams: await vercel.listTeams(t) };
});
// Domains already on the user's Vercel account/team (to host previews on a subdomain).
ipcMain.handle("vercel:domains", async () => {
  const t = await vercelAccessToken();
  if (!t) return { domains: [] };
  const scope = loadVercelScope();
  return { domains: await vercel.listDomains(t, scope.teamId || null) };
});
// Save (or clear) the custom preview domain for the current project.
ipcMain.handle("publish:setDomain", (_event, { domain, target }) => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  const rec = loadPublish(currentProject);
  const d = (domain || "").trim().toLowerCase();
  // The site keeps its own domain under rec.site (its own Vercel project).
  const slot = target === "site" ? (rec.site = rec.site || {}) : rec;
  if (d) slot.customDomain = d; else delete slot.customDomain;
  savePublish(currentProject, rec);
  return { ok: true, customDomain: slot.customDomain || null };
});
ipcMain.handle("vercel:selectScope", (_event, { teamId, teamName }) => {
  const scope = loadVercelScope();
  if (teamId) { scope.teamId = teamId; scope.teamName = teamName || null; }
  else { delete scope.teamId; delete scope.teamName; }
  saveVercelScope(scope);
  return { ok: true };
});
ipcMain.handle("vercel:clear", () => {
  removeStoredVercelToken();
  clearVercelScope();
  vercelAuth = null;
  return { ok: true };
});

// Per-project publish state the panel reads to decide what to show.
ipcMain.handle("publish:status", () => {
  const connected = !!vercelAuth;
  const scope = loadVercelScope();
  if (!currentProject) return { connected, scope, hasProject: false };
  const design = detectDesign(currentProject);
  const rec = loadPublish(currentProject);
  return {
    connected,
    scope,
    hasProject: true,
    canPublish: !!(design.active && design.previewReady),
    url: rec.url || null,
    projectName: rec.projectName || deriveProjectName(currentProject),
    lastDeployAt: rec.lastDeployAt || null,
    gatePasswordSet: !!rec.gatePasswordSet,
    gatePassword: rec.gatePassword || null,
    customDomain: rec.customDomain || null,
    // The public website: its own Vercel project + URL, live once /promote-blocks ran.
    site: (() => {
      const r = siteReady(currentProject);
      const sr = rec.site || {};
      return {
        ready: r.ready,
        reason: r.ready ? null : r.reason,
        url: sr.url || null,
        projectName: sr.projectName || `${deriveProjectName(currentProject)}-site`,
        lastDeployAt: sr.lastDeployAt || null,
        customDomain: sr.customDomain || null,
      };
    })(),
  };
});

// The one-time chain (and every republish). Streams publish:progress. A fresh
// preview password is generated on the FIRST publish or when resetPassword is
// asked for, and returned once so the panel can show it; only a set/not-set flag
// is persisted (never the password itself).
ipcMain.handle("publish:run", async (event, args) => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  const token = await vercelAccessToken();
  if (!token) return { ok: false, error: "Connect Vercel first." };
  if (args && args.target === "site") return publishSite(event, token);
  const design = detectDesign(currentProject);
  if (!design.active || !design.previewReady) {
    return { ok: false, error: "There's nothing to publish yet — finish a design first." };
  }
  const resetPassword = !!(args && args.resetPassword);
  const scope = loadVercelScope();
  const rec = loadPublish(currentProject);
  const projectName = rec.projectName || deriveProjectName(currentProject);
  // Re-assert the gate password on EVERY publish so the live deployment always
  // matches what we display. (Edge Middleware bakes env values in at build time, so
  // a stale ADMIN_PASS otherwise drifts from the shown one.) Reuse the stored
  // password; generate a fresh one on first publish, on reset, or for legacy
  // records that predate storing it.
  let password = rec.gatePassword || null;
  if (resetPassword || !password) password = vercel.generatePassword();
  const onProgress = (evt) => { if (!event.sender.isDestroyed()) event.sender.send("publish:progress", evt); };
  try {
    const res = await vercel.publishProject({
      token,
      teamId: scope.teamId || null,
      projectDir: currentProject,
      projectName,
      env: gateEnvFor(currentProject),
      password,
      customDomain: rec.customDomain || null,
      onProgress,
    });
    savePublish(currentProject, {
      ...rec,
      projectName: res.projectName,
      projectId: res.projectId,
      url: res.url,
      lastDeployAt: new Date().toISOString(),
      gatePasswordSet: true,
      gatePassword: password,
    });
    return { ok: true, url: res.url, projectName: res.projectName, password, domainPending: res.domainPending, domainError: res.domainError };
  } catch (e) {
    onProgress({ step: "error", status: "error", detail: e.message });
    return { ok: false, error: e.message };
  }
});

// ---- Project IPC ------------------------------------------------------------
function companyProfilePath(projectDir) {
  return path.join(projectDir, "company-profile.json");
}
function hasCompanyProfile(projectDir) {
  return !!projectDir && fs.existsSync(companyProfilePath(projectDir));
}

// The app's DEFAULT company profile — the agency identity (name, admin/gate
// fonts, login logo) saved once and auto-applied to every new project, like the
// API key + license. It's the designer's public identity, not a secret, so plain
// JSON in userData (no keychain). Packed/applied by scripts/company-profile.mjs.
function defaultCompanyProfilePath() {
  return path.join(app.getPath("userData"), "company-profile-default.json");
}
function hasDefaultCompanyProfile() {
  return fs.existsSync(defaultCompanyProfilePath());
}
// Load the pack/unpack engine from the app's bundled scripts (ESM → dynamic import).
function companyProfileEngine() {
  return import(pathToFileURL(unpacked(path.join(appRoot, "scripts", "company-profile.mjs"))).href);
}

// Copy an attached file into the project (cwd = project) so the agent can act
// on it instead of the user pasting a path. Routed by type: images land in
// public/images/ (the design-image bucket); everything else in the root. A
// login logo still needs agent wiring (public/brand/ + middleware), so the
// agent relocates/wires that from wherever it lands.
const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"];

function attachToProject(srcPath) {
  if (!currentProject) return { ok: false, error: "No project is open." };
  if (!srcPath || !fs.existsSync(srcPath)) return { ok: false, error: "File not found." };
  try {
    const name = path.basename(srcPath);
    const isImage = IMAGE_EXTS.includes(path.extname(name).toLowerCase());
    const subdir = isImage ? "public/images" : "";
    const destDir = subdir ? path.join(currentProject, subdir) : currentProject;
    if (subdir) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(srcPath, path.join(destDir, name));
    rememberDir("attachDir", srcPath);
    const rel = "./" + (subdir ? `${subdir}/${name}` : name);
    return { ok: true, name, rel, kind: isImage ? "image" : "file" };
  } catch (e) {
    return { ok: false, error: `Could not attach: ${e.message}` };
  }
}

ipcMain.handle("project:status", () => ({
  hasProject: !!currentProject,
  path: currentProject,
  name: currentProject ? path.basename(currentProject) : null,
  ...(currentProject ? readProjectMeta(currentProject) : { client: "", project: "" }),
  viteUrl,
  design: currentProject ? detectDesign(currentProject) : { active: false, variationId: null },
  companyProfile: hasCompanyProfile(currentProject),
}));

// Lightweight re-checks the renderer polls after each agent turn, so the preview
// swaps from the welcome placeholder to the live design, and the company-profile
// download button appears, the moment each exists.
ipcMain.handle("project:design", () =>
  currentProject ? detectDesign(currentProject) : { active: false, variationId: null, previewReady: false }
);
// Probe whether the dev server is actually SERVING a route yet (200) — Vite may
// be up (viteUrl set) but still compiling the just-created variation. The
// renderer waits on this before opening the preview tabs so they never flash
// blank. Done in main to avoid renderer CORS to localhost.
ipcMain.handle("preview:probe", async (_event, { url }) => {
  try {
    const res = await fetch(url, { method: "GET" });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
});

// ---- Accessibility audit (P3) — axe-core, on demand, per breakpoint ----------
// Runs axe against the CURRENT design's isolated capture route in a hidden window (the
// capture-bridge pattern), at each breakpoint width. Deterministic — ZERO model tokens. The
// review drawer (P4) turns the findings into Fix/Hold/Dismiss rows. On-demand + retroactive:
// works on any built design, including ones authored with AA mode off.
const A11Y_BREAKPOINTS = [
  { name: "desktop", w: 1440, h: 900 },
  { name: "tablet", w: 834, h: 1112 },
  { name: "mobile", w: 390, h: 780 },
];
let _axeSrc = null;
function axeSource() {
  if (_axeSrc == null) {
    let p;
    try { p = require.resolve("axe-core/axe.min.js"); }
    catch { p = unpacked(path.join(appRoot, "node_modules", "axe-core", "axe.min.js")); }
    _axeSrc = fs.readFileSync(p, "utf8");
  }
  return _axeSrc;
}
async function waitForCaptureReady(wc, timeout = 8000) {
  // Prefer the explicit render gate, but fall back to "#root has painted content" so the
  // audit still runs on older scaffolds (or any page) that predate data-capture-ready.
  const probe = '(function(){var r=document.querySelector("#root");return !!document.querySelector("[data-capture-ready]")||!!(r&&r.children.length);})()';
  const start = Date.now();
  for (;;) {
    let ready = false;
    try { ready = await wc.executeJavaScript(probe, true); } catch {}
    if (ready) return true;
    if (Date.now() - start > timeout) return false;
    await new Promise((r) => setTimeout(r, 100));
  }
}
async function auditA11y(variationId) {
  if (!viteUrl) return { ok: false, error: "The preview isn't running yet — open a built design first." };
  const vid = variationId || "v01";
  const win = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    webPreferences: { backgroundThrottling: false, partition: "a11y-audit" },
  });
  const wc = win.webContents;
  const byKey = new Map(); // "rule::selector" → finding (accumulates the breakpoints it hits)
  try {
    for (const bp of A11Y_BREAKPOINTS) {
      win.setContentSize(bp.w, bp.h);
      try { await wc.loadURL(`${viteUrl}/?v=${vid}&capture=${bp.name}`); }
      catch (e) { if (!/ERR_ABORTED|\(-3\)/.test(String(e && e.message))) throw e; }
      await waitForCaptureReady(wc, 12000);
      // Wait for images + fonts to actually load before scanning — otherwise text over a
      // not-yet-painted image falsely fails contrast (inflates the findings).
      try {
        await wc.executeJavaScript(
          `(async () => {
            const imgs = Array.from(document.images || []);
            await Promise.race([
              Promise.all(imgs.map((i) => i.complete ? 0 : new Promise((r) => { i.addEventListener("load", r, { once: true }); i.addEventListener("error", r, { once: true }); }))),
              new Promise((r) => setTimeout(r, 4000)),
            ]);
            try { await document.fonts.ready; } catch (e) {}
            await new Promise((r) => setTimeout(r, 200));
          })()`,
          true,
        );
      } catch {}
      await wc.executeJavaScript(axeSource(), true); // inject axe into the page's main world
      const violations = await wc.executeJavaScript(
        `(async () => {
          if (typeof axe === "undefined") return [];
          const r = await axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a","wcag2aa","wcag21a","wcag21aa"] },
            resultTypes: ["violations"],
          });
          return (r.violations || []).map((v) => ({
            id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
            wcag: (v.tags || []).filter((t) => /^wcag\\d/.test(t)),
            nodes: (v.nodes || []).map((n) => ({
              target: n.target, html: String(n.html || "").slice(0, 400), failureSummary: n.failureSummary,
            })),
          }));
        })()`,
        true,
      );
      for (const v of violations || []) {
        for (const n of v.nodes || []) {
          const sel = Array.isArray(n.target) ? n.target.join(" ") : String(n.target || "");
          const key = `${v.id}::${sel}`;
          const hit = byKey.get(key);
          if (hit) { if (!hit.breakpoints.includes(bp.name)) hit.breakpoints.push(bp.name); }
          else byKey.set(key, {
            key, rule: v.id, impact: v.impact || "moderate", help: v.help, helpUrl: v.helpUrl,
            wcag: v.wcag || [], selector: sel, html: n.html, failureSummary: n.failureSummary,
            breakpoints: [bp.name],
          });
        }
      }
    }
  } catch (e) {
    win.destroy();
    return { ok: false, error: `Audit failed: ${e.message}` };
  }
  win.destroy();
  const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  const findings = [...byKey.values()].sort((a, b) => (order[a.impact] ?? 9) - (order[b.impact] ?? 9));
  return { ok: true, findings, count: findings.length, ranAt: Date.now(), variationId: vid };
}
ipcMain.handle("a11y:audit", (_e, { variationId } = {}) => auditA11y(variationId));
ipcMain.handle("company:status", () => ({ exists: hasCompanyProfile(currentProject) }));

// Apply the COMPANY layer (company name + admin/gate fonts + logo) to the current
// project — the backend for the in-pane "Brand This Project" form. Builds a profile
// from the form fields and runs it through the SAME apply engine as /import-company
// (writes .env VITE_COMPANY_NAME, admin fonts → tokens.css + gate middleware, logo →
// public/brand + gate wiring, app font @import → fonts.css). form = { companyName,
// headingFont, bodyFont, logo?: { filename, mime, b64 } }.
ipcMain.handle("company:apply", async (_event, form) => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  try {
    const { buildCompanyProfile, runUnpack } = await companyProfileEngine();
    const profile = buildCompanyProfile(form || {});
    const res = await runUnpack({ project: currentProject, profile });
    return { ok: true, applied: res.applied, manualSteps: res.manualSteps, summary: res.summary };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Save the project's company-profile.json out to a location the user picks —
// it's a portable artifact meant to move between projects.
ipcMain.handle("company:download", async () => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  const src = companyProfilePath(currentProject);
  if (!fs.existsSync(src)) {
    return { ok: false, error: "No company-profile.json yet — run /export-company first." };
  }
  const saveDir = lastDir("saveDir");
  const res = await dialog.showSaveDialog(mainWindow, {
    title: "Save company profile",
    defaultPath: saveDir ? path.join(saveDir, "company-profile.json") : "company-profile.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  rememberDir("saveDir", res.filePath);
  try {
    fs.copyFileSync(src, res.filePath);
  } catch (e) {
    return { ok: false, error: `Could not save: ${e.message}` };
  }
  return { ok: true, path: res.filePath };
});

// ---- Default company profile (auto-applied to new projects) ------------------
ipcMain.handle("company:defaultStatus", () => {
  if (!hasDefaultCompanyProfile()) return { has: false };
  try {
    const profile = JSON.parse(fs.readFileSync(defaultCompanyProfilePath(), "utf8"));
    // Pull the picked font families back out so the drawer's Update form can pre-fill them.
    const famName = (stack) => { const m = /^\s*['"]?([^'",]+)/.exec(String(stack || "")); return m ? m[1].trim() : ""; };
    const f = profile.fonts || {};
    const external = f.mode && f.mode !== "default";
    return {
      has: true,
      companyName: profile.companyName || "",
      headingFont: external ? famName(f.headingFamily) : "",
      bodyFont: external ? famName(f.bodyFamily) : "",
      logoName: (profile.logo && profile.logo.filename) || "",
    };
  } catch {
    return { has: true, companyName: "" };
  }
});
// Save the default profile straight from the drawer FIELDS (no project needed) — builds the
// same profile object /import-company consumes and writes it to the app default. On update, an
// existing logo is preserved when the form didn't include a new one.
ipcMain.handle("company:saveDefaultFields", async (_e, form) => {
  try {
    const { buildCompanyProfile } = await companyProfileEngine();
    const f = form || {};
    const profile = buildCompanyProfile(f);
    if (!profile.companyName) return { ok: false, error: "Add a company name first." };
    // On update, carry over what the form didn't re-supply: an existing logo, and prior
    // self-hosted (uploaded) fonts when the font names weren't changed and no new file was
    // uploaded — so editing just the name never silently drops a brand logo or brand font.
    if (hasDefaultCompanyProfile()) {
      try {
        const prev = JSON.parse(fs.readFileSync(defaultCompanyProfilePath(), "utf8"));
        if (!profile.logo && prev.logo) profile.logo = prev.logo;
        const famName = (stack) => { const m = /^\s*['"]?([^'",]+)/.exec(String(stack || "")); return m ? m[1].trim() : ""; };
        const hasUpload = f.headingFontFile || f.bodyFontFile;
        if (!hasUpload && prev.fonts && prev.fonts.mode === "selfhosted" && profile.fonts.mode !== "selfhosted") {
          const prevH = famName(prev.fonts.headingFamily), prevB = famName(prev.fonts.bodyFamily);
          const unchanged = (f.headingFont || prevH) === prevH && (f.bodyFont || prevB) === prevB;
          if (unchanged) profile.fonts = prev.fonts; // keep the uploaded brand fonts
        }
      } catch {}
    }
    fs.writeFileSync(defaultCompanyProfilePath(), JSON.stringify(profile, null, 2));
    return { ok: true, companyName: profile.companyName };
  } catch (e) {
    return { ok: false, error: `Could not save the profile: ${e.message}` };
  }
});
// Pack the CURRENT project's company identity and store it as the app default.
ipcMain.handle("company:saveDefault", async () => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  try {
    const { runPack } = await companyProfileEngine();
    const res = await runPack({ project: currentProject, out: defaultCompanyProfilePath() });
    const name = res?.summary?.companyName || "";
    if (!name || name === "(none set)") {
      try { fs.unlinkSync(defaultCompanyProfilePath()); } catch {}
      return { ok: false, error: "This project has no company name set yet — set up the company first, then save it as your default." };
    }
    return { ok: true, companyName: name };
  } catch (e) {
    return { ok: false, error: `Could not save the profile: ${e.message}` };
  }
});
ipcMain.handle("company:clearDefault", () => {
  try { fs.unlinkSync(defaultCompanyProfilePath()); } catch { /* already gone */ }
  return { ok: true };
});

ipcMain.handle("project:create", async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "Choose an empty folder for your new project",
    defaultPath: lastDir("projectDir"),
    properties: ["openDirectory", "createDirectory"],
    buttonLabel: "Create project here",
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
  const dir = res.filePaths[0];
  rememberDir("projectDir", dir);
  const entries = fs.readdirSync(dir).filter((e) => e !== ".DS_Store");
  if (entries.length) return { ok: false, error: "That folder isn't empty — pick a fresh, empty folder." };
  try {
    scaffoldProject(dir);
  } catch (e) {
    return { ok: false, error: `Could not scaffold the template: ${e.message}` };
  }
  // Auto-apply the saved default company profile so the new project starts
  // already company-branded (setup then skips the whole company block). Best
  // effort — a bad/absent profile never blocks project creation.
  if (hasDefaultCompanyProfile()) {
    try {
      const { runUnpack } = await companyProfileEngine();
      await runUnpack({ project: dir, input: defaultCompanyProfilePath() });
    } catch (e) {
      console.error("[main] company-profile auto-apply failed:", e.message);
    }
  }
  if (currentProject && currentSessionId) { try { archiveSession(currentProject, currentSessionId); } catch {} }
  currentSessionId = null;
  currentProject = dir;
  saveProjectPath(dir);
  try {
    await startViteFor(dir);
    maybeStartSite(dir);
  } catch (e) {
    return { ok: false, error: `Project created, but Vite failed to start: ${e.message}` };
  }
  return { ok: true, path: dir, name: path.basename(dir), ...readProjectMeta(dir), viteUrl, siteUrl };
});

ipcMain.handle("project:open", async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "Open a project folder",
    defaultPath: lastDir("projectDir"),
    properties: ["openDirectory"],
    buttonLabel: "Open project",
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
  const dir = res.filePaths[0];
  rememberDir("projectDir", dir);
  if (!fs.existsSync(path.join(dir, "package.json"))) {
    return { ok: false, error: "That folder has no package.json — it doesn't look like a project." };
  }
  try {
    linkNodeModules(dir); // no-op if it already has real deps
  } catch {
    /* has its own node_modules or symlink failed; Vite will report if unusable */
  }
  await refreshFrameworkFiles(dir); // carry this app build's framework files in, before Vite boots
  if (currentProject && currentSessionId) { try { archiveSession(currentProject, currentSessionId); } catch {} }
  currentSessionId = null;
  currentProject = dir;
  saveProjectPath(dir);
  try {
    await startViteFor(dir);
    maybeStartSite(dir);
  } catch (e) {
    return { ok: false, error: `Vite failed to start: ${e.message}` };
  }
  return { ok: true, path: dir, name: path.basename(dir), ...readProjectMeta(dir), viteUrl, siteUrl };
});

// The last few opened projects, excluding the current one, pruned to those that
// still exist and look like projects. Cap at 5 for the drawer.
ipcMain.handle("projects:recent", () => {
  return (loadUiState().recentProjects || [])
    .filter((p) => p && p !== currentProject && fs.existsSync(p) && fs.existsSync(path.join(p, "package.json")))
    .slice(0, 5)
    .map((p) => ({ path: p, name: path.basename(p), ...readProjectMeta(p) }));
});

// Open a specific project by path (a Recent-Projects click) — like project:open
// but with no dialog. Archives the current session first, then switches + starts Vite.
ipcMain.handle("project:openPath", async (_e, { path: dir } = {}) => {
  if (!dir || !fs.existsSync(dir)) return { ok: false, error: "That project folder no longer exists." };
  if (!fs.existsSync(path.join(dir, "package.json"))) {
    return { ok: false, error: "That folder has no package.json — it doesn't look like a project." };
  }
  if (dir === currentProject) return { ok: true, path: dir, name: path.basename(dir), viteUrl, siteUrl };
  if (currentProject && currentSessionId) { try { archiveSession(currentProject, currentSessionId); } catch {} }
  currentSessionId = null;
  try { linkNodeModules(dir); } catch { /* has its own deps or symlink failed */ }
  await refreshFrameworkFiles(dir); // carry this app build's framework files in, before Vite boots
  currentProject = dir;
  saveProjectPath(dir);
  try {
    await startViteFor(dir);
    maybeStartSite(dir);
  } catch (e) {
    return { ok: false, error: `Vite failed to start: ${e.message}` };
  }
  return { ok: true, path: dir, name: path.basename(dir), ...readProjectMeta(dir), viteUrl, siteUrl };
});

ipcMain.handle("project:reset", () => {
  // Leaving the project → archive the live session into it before we let go.
  if (currentProject && currentSessionId) archiveSession(currentProject, currentSessionId);
  currentSessionId = null;
  clearProjectPath();
  currentProject = null;
  stopVite();
  stopSite();
  return { ok: true };
});

// ---- Misc IPC ---------------------------------------------------------------
ipcMain.handle("open:external", (_event, url) => {
  if (typeof url === "string" && /^https?:\/\//.test(url)) shell.openExternal(url);
});

// The preview inspector (point & comment) file URL, resolved here where __dirname
// exists (the sandboxed renderer preload can't compute it). The shell fetches this
// once and attaches it as each preview webview's preload.
ipcMain.handle("preview:preloadPath", () => pathToFileURL(path.join(__dirname, "preview-inspect.cjs")).href);

// Attach a file via the native picker (📎 button).
ipcMain.handle("file:attach", async () => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "Attach a file to the project",
    defaultPath: lastDir("attachDir"),
    properties: ["openFile"],
    buttonLabel: "Attach",
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
  return attachToProject(res.filePaths[0]);
});

// Attach a file by path (from a drag-and-drop in the renderer).
ipcMain.handle("file:attachPath", (_event, { srcPath }) => attachToProject(srcPath));

// ---- Design references (reference-ingest T0: store + list, no model) ---------
// Uploaded reference material lives in the project's PRIVATE .thinkany/references
// store (see intake/references.cjs). T0 only captures + lists them; ingest/digest
// come in T1+. Each asset is decorated with its absolute path so the renderer can
// show a file:// thumbnail (the assets dir is outside public/, so Vite won't serve it).
let refsAnalyzing = 0; // vision passes in flight — the rail shows "reading…" while > 0
function referencesPayload(projectDir) {
  if (!projectDir) return { assets: [], digest: null, analyzing: false };
  const assets = references.listAssets(projectDir).map((a) => ({ ...a, abs: references.absPathFor(projectDir, a) }));
  return { assets, digest: ingestRefs.readDigest(projectDir), analyzing: refsAnalyzing > 0 };
}
// Ingest the references: T1 deterministic (0-token, sync) then T2 the isolated
// vision/summarization pass (async, spends tokens once). Pass the just-added ids
// to only process those; call with none to just rebuild the digest (e.g. after a
// removal). Best-effort — a failed ingest never blocks the upload.
function ingestReferences(projectDir, addedIds) {
  try { ingestRefs.ingest(projectDir, addedIds || null); } // T1
  catch (e) { console.error("[references] ingest failed:", e && e.message); }

  // T2 needs a key and only runs when new assets were added (a removal just
  // rebuilds the stub above). The pass is one-shot + isolated (see ingest.cjs) —
  // the images never enter the main design conversation.
  if (process.env.ANTHROPIC_API_KEY && addedIds && addedIds.length) {
    runVisionPass(projectDir, addedIds);
  }
}

// Fire the isolated vision pass and track the analyzing state. `ids` = the assets
// to analyze (null = every not-yet-analyzed one — the catch-up path).
function runVisionPass(projectDir, ids) {
  refsAnalyzing++;
  broadcastReferences();
  ingestRefs.visionPass(projectDir, ids, { model: currentModel || undefined })
    .then((r) => { if (r && !r.ok && r.error && r.error !== "no-api-key") console.error("[references] vision pass:", r.error); })
    .catch((e) => console.error("[references] vision pass:", e && e.message))
    .finally(() => { refsAnalyzing = Math.max(0, refsAnalyzing - 1); broadcastReferences(); });
}

// Catch up any references whose vision pass never ran (interrupted, or added
// before a key was set). Called when the rail loads the list, so re-opening the
// intake finishes the job. Cheap: just a manifest read unless work is pending.
function maybeCatchUpVision(projectDir) {
  if (!projectDir || !process.env.ANTHROPIC_API_KEY || refsAnalyzing > 0) return;
  let pending = false;
  try {
    pending = references.listAssets(projectDir).some(
      (a) => (a.kind === "image" || a.kind === "document") && !a.visionIngested);
  } catch { return; }
  if (pending) runVisionPass(projectDir, null);
}
function broadcastReferences() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("references:changed", referencesPayload(currentProject));
  }
}

ipcMain.handle("references:list", () => {
  maybeCatchUpVision(currentProject); // finish any interrupted vision pass on re-open
  return referencesPayload(currentProject);
});

ipcMain.handle("references:add", async () => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "Add design references",
    defaultPath: lastDir("referenceDir") || lastDir("attachDir"),
    properties: ["openFile", "multiSelections"],
    buttonLabel: "Add references",
  });
  if (res.canceled || !res.filePaths.length) return { ok: false, canceled: true };
  rememberDir("referenceDir", res.filePaths[0]);
  const { added, skipped } = references.addAssets(currentProject, res.filePaths);
  if (added.length) ingestReferences(currentProject, added.map((a) => a.id));
  broadcastReferences();
  return { ok: true, added, skipped, ...referencesPayload(currentProject) };
});

// Add references by path (drag-and-drop of one or more files onto the rail).
ipcMain.handle("references:addPaths", (_event, { paths } = {}) => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  const { added, skipped } = references.addAssets(currentProject, Array.isArray(paths) ? paths : []);
  if (added.length) ingestReferences(currentProject, added.map((a) => a.id));
  broadcastReferences();
  return { ok: true, added, skipped, ...referencesPayload(currentProject) };
});

ipcMain.handle("references:remove", (_event, { id } = {}) => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  references.removeAsset(currentProject, id);
  ingestReferences(currentProject); // rebuild the digest without the removed asset
  broadcastReferences();
  return { ok: true, ...referencesPayload(currentProject) };
});

// A custom, branded "About" window (the native macOS About panel can't show a
// logo file or a real button). Shows the logo, version, and a thinkany.co button.
let aboutWindow = null;
function openAboutWindow() {
  if (aboutWindow && !aboutWindow.isDestroyed()) { aboutWindow.focus(); return; }
  let version;
  try { version = require(path.join(appRoot, "package.json")).version; }
  catch { version = app.getVersion(); }
  aboutWindow = new BrowserWindow({
    width: 340, height: 384, resizable: false, minimizable: false, maximizable: false,
    fullscreenable: false, title: "About thinkany design", backgroundColor: "#ffffff",
    show: false,
  });
  aboutWindow.loadFile(path.join(__dirname, "about.html"), { search: "v=" + version });
  aboutWindow.once("ready-to-show", () => aboutWindow.show());
  // The "Visit thinkany.co" button opens with target=_blank → route it to the
  // real browser instead of navigating the About window.
  aboutWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  aboutWindow.webContents.on("will-navigate", (e, url) => {
    e.preventDefault();
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
  });
  aboutWindow.on("closed", () => { aboutWindow = null; });
}

// Application menu — mirrors the macOS default, but the app menu's "About" opens
// our branded window instead of the native panel. editMenu/viewMenu/windowMenu
// keep the standard shortcuts (copy/paste, etc.) so nothing regresses.
function buildAppMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: app.name, submenu: [
      { label: "About thinkany design", click: openAboutWindow },
      { type: "separator" },
      { role: "services" },
      { type: "separator" },
      { role: "hide" }, { role: "hideOthers" }, { role: "unhide" },
      { type: "separator" },
      { role: "quit" },
    ] },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ]));
}

app.whenReady().then(async () => {
  buildAppMenu();
  loadEnvLocal(); // dev fallback
  const stored = loadStoredKey(); // in-app key wins if present
  if (stored) process.env.ANTHROPIC_API_KEY = stored;
  const storedLicense = loadStoredLicense(); // in-app license wins over .env.local
  if (storedLicense) process.env.DERIVE_LICENSE_KEY = storedLicense;
  const storedDesignLicense = loadStoredDesignLicense(); // in-app design license wins over .env.local
  if (storedDesignLicense) process.env.DESIGN_LICENSE_KEY = storedDesignLicense;
  // Licensed skills: the last cache is usable at once (offline grace); a refresh
  // runs in the background whenever a Design license is present. SKILLS_LOCAL=1
  // (dev) reads desktop/skills/*.md instead, live.
  skillsClient = createSkillsClient({
    safeStorage,
    userDataDir: app.getPath("userData"),
    localDir: path.join(__dirname, "skills"),
    log: (m) => console.log(`[skills] ${m}`),
  });
  skillsClient.load();
  if (process.env.DESIGN_LICENSE_KEY) skillsClient.refresh(process.env.DESIGN_LICENSE_KEY).catch(() => {});
  vercelAuth = loadVercelAuth(); // in-app Publish: pasted token or Sign in with Vercel
  currentProject = loadProjectPath();
  currentModel = loadUiState().model || null;
  createWindow(); // show the UI first — nothing below may block it becoming responsive
  reapStaleVite(); // kill a Vite orphaned by a previous force-quit before starting fresh
  if (currentProject) {
    // Refresh the framework files from this app build first (best-effort), THEN start
    // Vite — so a project reopened under a newer .dmg boots with the new files. The
    // window is already up (created above), so this never blocks the UI.
    (async () => {
      await refreshFrameworkFiles(currentProject);
      startViteFor(currentProject).then(() => maybeStartSite(currentProject)).catch((e) => console.error("[main] Vite failed:", e.message));
    })();
  }
  // Native capture bridge: a hidden BrowserWindow the app-owned export scripts drive
  // over loopback (see capture-bridge.cjs). Its env makes `ta-export reconstruct`
  // capture with the app's own Chromium instead of puppeteer (block export in a packaged
  // .dmg). Started in the BACKGROUND — a slow/hung bridge must never block the window or
  // Vite from coming up (that showed as "not responding" on launch). Its env is set as
  // soon as it's ready, well before the user can trigger an agent turn; capture falls
  // back if a turn somehow beats it.
  startCaptureBridge()
    .then((bridge) => {
      process.env.TA_CAPTURE_ENDPOINT = `http://127.0.0.1:${bridge.port}`;
      process.env.TA_CAPTURE_TOKEN = bridge.token;
    })
    .catch((e) => console.error("[main] capture bridge failed to start:", e.message));
});

app.on("before-quit", () => {
  // Closing the app → archive the live session so it lands in the drawer next launch.
  if (currentProject && currentSessionId) archiveSession(currentProject, currentSessionId);
  stopVite();
  stopSite();
  stopCaptureBridge();
});
app.on("window-all-closed", () => {
  stopVite();
  stopSite();
  stopCaptureBridge();
  app.quit();
});
