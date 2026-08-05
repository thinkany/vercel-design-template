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

const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog, Menu } = require("electron");

// The package name is "@figma/my-make-file"; force the product name so the macOS
// app menu (About / Hide / Quit …) and the About panel read "thinkany design".
// Must run before app is ready / the default menu is built. Covers both the dev
// run (app.getName() would otherwise fall back to package.json "name") and any
// path the packaged bundle name doesn't already override. Safe to rename: userData
// is pinned below so the display name no longer dictates where state is stored.
app.setName("thinkany design");
const { spawn, execSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs");
const path = require("node:path");

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

const appRoot = path.resolve(__dirname, ".."); // the Electron app / template source (git worktree in dev; Resources/app when packaged)

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

const BIN_DIR = path.join(__dirname, "bin");
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

// Point a project folder at the app's installed deps so Vite runs without a
// per-project `npm install`. (A packaged build would run a real install.)
function linkNodeModules(projectDir) {
  const projModules = path.join(projectDir, "node_modules");
  if (!fs.existsSync(projModules)) {
    fs.symlinkSync(path.join(appRoot, "node_modules"), projModules, "dir");
  }
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
  const bundledTemplate = path.join(appRoot, "desktop", "template");
  if (app.isPackaged || fs.existsSync(bundledTemplate)) {
    // Copy from the bundled snapshot (packaged, or dev after a `predist` build).
    fs.cpSync(bundledTemplate, targetDir, { recursive: true });
  } else {
    const excludes = TEMPLATE_EXCLUDE
      .map((p) => `--exclude="${p}" --exclude="${p}/*"`)
      .join(" ");
    execSync(`git -C "${appRoot}" archive main | tar -x ${excludes} -C "${targetDir}"`, { stdio: "pipe" });
  }
  // Guarantee nothing on the exclude list survived, regardless of source/variant.
  for (const p of TEMPLATE_EXCLUDE) {
    fs.rmSync(path.join(targetDir, p), { recursive: true, force: true });
  }
  linkNodeModules(targetDir);
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

function stopVite() {
  if (viteProc) {
    viteProc.kill();
    viteProc = null;
  }
  viteUrl = null;
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
  const viteBin = path.join(appRoot, "node_modules", "vite", "bin", "vite.js");
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
    });
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
// License = STUB for now: the presence of RESEARCH_LICENSE_KEY in the env (the same
// shape as the Figma export's DERIVE_* env). Unset today → the feature stays dark;
// "when the time comes" the cloud server provisions the key and it activates. No
// validation service yet (that's the later half, mirroring the derive flow).
function researchLicensed() {
  return !!(process.env.RESEARCH_LICENSE_KEY && process.env.RESEARCH_LICENSE_KEY.trim());
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

ipcMain.handle("agent:prompt", async (event, { prompt, sessionId }) => {
  if (!currentProject) {
    event.sender.send("agent:event", { type: "error", message: "No project is open." });
    return { sessionId };
  }
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
  // Tell the /design-brief flow whether the licensed research layer is active, via
  // an env var the agent's Bash inherits (same channel as TA_CAPTURE_* etc.).
  process.env.TA_DESIGN_RESEARCH = researchActive(currentProject) ? "on" : "off";
  process.env.TA_DESIGN_RESEARCH_BROAD = broadActive(currentProject) ? "on" : "off";
  const result = await runPrompt({ prompt, sessionId, cwd: currentProject, onEvent, askQuestion, model: currentModel, copyVoice: effectiveVoice(currentProject) });
  if (result && result.sessionId) currentSessionId = result.sessionId; // so quit can archive it
  return result;
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

// ---- Key IPC ----------------------------------------------------------------
ipcMain.handle("key:status", () => {
  const key = process.env.ANTHROPIC_API_KEY || "";
  return { hasKey: !!key, keyHint: key ? key.slice(-4) : null };
});
ipcMain.handle("models:list", () => fetchModels());
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
  return import(pathToFileURL(path.join(appRoot, "scripts", "company-profile.mjs")).href);
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
ipcMain.handle("company:status", () => ({ exists: hasCompanyProfile(currentProject) }));

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
    return { has: true, companyName: profile.companyName || "" };
  } catch {
    return { has: true, companyName: "" };
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
  currentProject = dir;
  saveProjectPath(dir);
  try {
    await startViteFor(dir);
  } catch (e) {
    return { ok: false, error: `Project created, but Vite failed to start: ${e.message}` };
  }
  return { ok: true, path: dir, name: path.basename(dir), viteUrl };
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
  currentProject = dir;
  saveProjectPath(dir);
  try {
    await startViteFor(dir);
  } catch (e) {
    return { ok: false, error: `Vite failed to start: ${e.message}` };
  }
  return { ok: true, path: dir, name: path.basename(dir), viteUrl };
});

ipcMain.handle("project:reset", () => {
  // Leaving the project → archive the live session into it before we let go.
  if (currentProject && currentSessionId) archiveSession(currentProject, currentSessionId);
  currentSessionId = null;
  clearProjectPath();
  currentProject = null;
  stopVite();
  return { ok: true };
});

// ---- Misc IPC ---------------------------------------------------------------
ipcMain.handle("open:external", (_event, url) => {
  if (typeof url === "string" && /^https?:\/\//.test(url)) shell.openExternal(url);
});

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
  // Native capture bridge: a hidden BrowserWindow the app-owned export scripts
  // drive over loopback (see capture-bridge.cjs). Injecting these into the env
  // makes `ta-export reconstruct` capture with the app's own Chromium instead of
  // puppeteer — the fix for block export in a packaged .dmg. Set before the agent
  // can spawn Bash so its tool subprocesses inherit them.
  try {
    const bridge = await startCaptureBridge();
    process.env.TA_CAPTURE_ENDPOINT = `http://127.0.0.1:${bridge.port}`;
    process.env.TA_CAPTURE_TOKEN = bridge.token;
  } catch (e) {
    console.error("[main] capture bridge failed to start:", e.message);
  }
  currentProject = loadProjectPath();
  currentModel = loadUiState().model || null;
  createWindow();
  if (currentProject) {
    startViteFor(currentProject).catch((e) => console.error("[main] Vite failed:", e.message));
  }
});

app.on("before-quit", () => {
  // Closing the app → archive the live session so it lands in the drawer next launch.
  if (currentProject && currentSessionId) archiveSession(currentProject, currentSessionId);
  stopVite();
  stopCaptureBridge();
});
app.on("window-all-closed", () => {
  stopVite();
  stopCaptureBridge();
  app.quit();
});
