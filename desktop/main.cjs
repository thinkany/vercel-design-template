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

const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog } = require("electron");
const { spawn, execSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs");
const path = require("node:path");

const appRoot = path.resolve(__dirname, ".."); // the Electron app / template source (git worktree)

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

// A project has an "active design" once setup has created a working variation
// (src/variations/<id>/). Before that, a fresh scaffold has only the base
// blueprint — which the app hides behind a welcome placeholder rather than
// showing the template's blueprint dashboard mid-setup.
function detectDesign(projectDir) {
  try {
    const ids = fs
      .readdirSync(path.join(projectDir, "src", "variations"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    if (ids.length) return { active: true, variationId: ids[0] };
  } catch {
    /* no variations dir yet = fresh */
  }
  return { active: false, variationId: null };
}

// Point a project folder at the app's installed deps so Vite runs without a
// per-project `npm install`. (A packaged build would run a real install.)
function linkNodeModules(projectDir) {
  const projModules = path.join(projectDir, "node_modules");
  if (!fs.existsSync(projModules)) {
    fs.symlinkSync(path.join(appRoot, "node_modules"), projModules, "dir");
  }
}

// Paths tracked on `main` but NEVER shipped into a scaffolded project —
// app-internal IP (e.g. the licensed cloud-export logic). Extend as needed.
const TEMPLATE_EXCLUDE = ["cloud-export"];

// Scaffold a pristine project: export the clean `main` branch template into
// targetDir (no desktop/, no Electron deps — those live only on this branch),
// minus the app-internal IP in TEMPLATE_EXCLUDE, then link node_modules.
// Packaged builds would ship a bundled template dir instead.
function scaffoldProject(targetDir) {
  const excludes = TEMPLATE_EXCLUDE
    .map((p) => `--exclude="${p}" --exclude="${p}/*"`)
    .join(" ");
  execSync(`git -C "${appRoot}" archive main | tar -x ${excludes} -C "${targetDir}"`, { stdio: "pipe" });
  // Belt-and-suspenders: guarantee nothing on the exclude list survived,
  // regardless of tar variant.
  for (const p of TEMPLATE_EXCLUDE) {
    fs.rmSync(path.join(targetDir, p), { recursive: true, force: true });
  }
  linkNodeModules(targetDir);
}

let currentProject = null;
let viteProc = null;
let viteUrl = null;
let mainWindow = null;

function stopVite() {
  if (viteProc) {
    viteProc.kill();
    viteProc = null;
  }
  viteUrl = null;
}

// Start Vite for a project dir; resolve with the URL Vite prints (parsed, not
// hardcoded, since the port varies) and push a 'vite:ready' event to the UI.
function startViteFor(projectDir) {
  stopVite();
  return new Promise((resolve, reject) => {
    viteProc = spawn("npm", ["run", "dev"], {
      cwd: projectDir,
      env: process.env,
      shell: process.platform === "win32",
    });
    let settled = false;
    viteProc.stdout.on("data", (buf) => {
      const text = buf.toString();
      process.stdout.write(`[vite] ${text}`);
      const m = text.match(/https?:\/\/localhost:\d+/);
      if (m && !settled) {
        settled = true;
        viteUrl = m[0];
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("vite:ready", viteUrl);
        }
        resolve(viteUrl);
      }
    });
    viteProc.stderr.on("data", (b) => process.stderr.write(`[vite] ${b}`));
    viteProc.on("exit", (code) => {
      if (!settled) reject(new Error(`Vite exited before it was ready (code ${code})`));
    });
    setTimeout(() => {
      if (!settled) reject(new Error("Timed out waiting for Vite (60s)"));
    }, 60000);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    title: "Design Studio (spike)",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      // contextIsolation + sandbox stay at their secure defaults (true).
    },
  });
  mainWindow.loadFile(path.join(__dirname, "shell.html"));
}

// ---- Agent IPC (cwd = current project) --------------------------------------
ipcMain.handle("agent:prompt", async (event, { prompt, sessionId }) => {
  if (!currentProject) {
    event.sender.send("agent:event", { type: "error", message: "No project is open." });
    return { sessionId };
  }
  const { runPrompt } = await import(pathToFileURL(path.join(__dirname, "agent.mjs")).href);
  const onEvent = (evt) => {
    if (!event.sender.isDestroyed()) event.sender.send("agent:event", evt);
  };
  return runPrompt({ prompt, sessionId, cwd: currentProject, onEvent });
});

// ---- Key IPC ----------------------------------------------------------------
ipcMain.handle("key:status", () => ({ hasKey: !!process.env.ANTHROPIC_API_KEY }));
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

// ---- Project IPC ------------------------------------------------------------
function companyProfilePath(projectDir) {
  return path.join(projectDir, "company-profile.json");
}
function hasCompanyProfile(projectDir) {
  return !!projectDir && fs.existsSync(companyProfilePath(projectDir));
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
  currentProject ? detectDesign(currentProject) : { active: false, variationId: null }
);
ipcMain.handle("company:status", () => ({ exists: hasCompanyProfile(currentProject) }));

// Save the project's company-profile.json out to a location the user picks —
// it's a portable artifact meant to move between projects.
ipcMain.handle("company:download", async () => {
  if (!currentProject) return { ok: false, error: "No project is open." };
  const src = companyProfilePath(currentProject);
  if (!fs.existsSync(src)) {
    return { ok: false, error: "No company-profile.json yet — run /export-company first." };
  }
  const res = await dialog.showSaveDialog(mainWindow, {
    title: "Save company profile",
    defaultPath: "company-profile.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  try {
    fs.copyFileSync(src, res.filePath);
  } catch (e) {
    return { ok: false, error: `Could not save: ${e.message}` };
  }
  return { ok: true, path: res.filePath };
});

ipcMain.handle("project:create", async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "Choose an empty folder for your new project",
    properties: ["openDirectory", "createDirectory"],
    buttonLabel: "Create project here",
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
  const dir = res.filePaths[0];
  const entries = fs.readdirSync(dir).filter((e) => e !== ".DS_Store");
  if (entries.length) return { ok: false, error: "That folder isn't empty — pick a fresh, empty folder." };
  try {
    scaffoldProject(dir);
  } catch (e) {
    return { ok: false, error: `Could not scaffold the template: ${e.message}` };
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
    properties: ["openDirectory"],
    buttonLabel: "Open project",
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
  const dir = res.filePaths[0];
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
  clearProjectPath();
  currentProject = null;
  stopVite();
  return { ok: true };
});

// ---- Misc IPC ---------------------------------------------------------------
ipcMain.handle("open:external", (_event, url) => {
  if (typeof url === "string" && /^https?:\/\//.test(url)) shell.openExternal(url);
});

app.whenReady().then(async () => {
  loadEnvLocal(); // dev fallback
  const stored = loadStoredKey(); // in-app key wins if present
  if (stored) process.env.ANTHROPIC_API_KEY = stored;
  currentProject = loadProjectPath();
  createWindow();
  if (currentProject) {
    startViteFor(currentProject).catch((e) => console.error("[main] Vite failed:", e.message));
  }
});

app.on("before-quit", stopVite);
app.on("window-all-closed", () => {
  stopVite();
  app.quit();
});
