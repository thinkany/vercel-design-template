// Electron main process (CommonJS on purpose).
//
// Kept as .cjs so `require("electron")` returns the real main-process API.
// An ESM (.mjs) entry made Electron resolve the npm *stub* (the binary-path
// string) instead of injecting its API, leaving app/ipcMain undefined — and
// createRequire didn't help because it builds a standard Node require that
// bypasses Electron's patched resolver. CommonJS is the reliable entry.
//
// Everything Electron-specific lives under desktop/ so the Vite app's src/ is
// untouched — that keeps `git cherry-pick` from `main` conflict-free.

const { app, BrowserWindow, ipcMain, safeStorage, shell } = require("electron");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");

// Minimal zero-dep loader for desktop/.env.local (untracked) so the API key
// never has to be exported into the shell that launches the app.
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
// The key is entered in-app and persisted encrypted via the OS keychain
// (Electron safeStorage) under userData — never written into the project.
function keyFilePath() {
  return path.join(app.getPath("userData"), "anthropic-key.enc");
}

function loadStoredKey() {
  try {
    const p = keyFilePath();
    if (!fs.existsSync(p)) return null;
    const buf = fs.readFileSync(p);
    if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(buf);
    return buf.toString("utf8"); // fallback if keychain unavailable
  } catch {
    return null;
  }
}

function storeKey(key) {
  const p = keyFilePath();
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(key)
    : Buffer.from(key, "utf8");
  fs.writeFileSync(p, data);
}

function removeStoredKey() {
  try {
    fs.unlinkSync(keyFilePath());
  } catch {
    /* already gone */
  }
}

// Cheap, no-token validation: the models endpoint 200s on a good key, 401s on a
// bad one. Confirms the key before we persist it.
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

let viteProc = null;
let mainWindow = null;

// Start `npm run dev` and resolve with the actual localhost URL Vite prints.
// We parse stdout rather than hardcoding :5173 because the main worktree may
// already own that port, in which case Vite auto-picks :5174, etc.
function startVite() {
  return new Promise((resolve, reject) => {
    viteProc = spawn("npm", ["run", "dev"], {
      cwd: repoRoot,
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
        resolve(m[0]);
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

function createWindow(viteUrl) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    title: "Design Studio (spike)",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      // contextIsolation + sandbox stay at their secure defaults (true).
    },
  });
  mainWindow.loadFile(path.join(__dirname, "shell.html"), {
    query: { viteUrl },
  });
}

// Renderer asks the agent to run a prompt; we stream each event back on the
// 'agent:event' channel and resolve with the (possibly new) sessionId.
// agent.mjs is ESM — load it lazily via dynamic import (CJS -> ESM is fine).
ipcMain.handle("agent:prompt", async (event, { prompt, sessionId }) => {
  const { runPrompt } = await import(pathToFileURL(path.join(__dirname, "agent.mjs")).href);
  const onEvent = (evt) => {
    if (!event.sender.isDestroyed()) event.sender.send("agent:event", evt);
  };
  return runPrompt({ prompt, sessionId, cwd: repoRoot, onEvent });
});

// ---- Key management IPC -----------------------------------------------------
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

ipcMain.handle("open:external", (_event, url) => {
  if (typeof url === "string" && /^https?:\/\//.test(url)) shell.openExternal(url);
});

app.whenReady().then(async () => {
  loadEnvLocal(); // dev fallback
  const stored = loadStoredKey(); // in-app key wins if present
  if (stored) process.env.ANTHROPIC_API_KEY = stored;
  try {
    const viteUrl = await startVite();
    console.log("[main] Vite ready at", viteUrl);
    createWindow(viteUrl);
  } catch (err) {
    console.error("[main] Could not start Vite:", err.message);
    createWindow("about:blank");
  }
});

function stopVite() {
  if (viteProc) {
    viteProc.kill();
    viteProc = null;
  }
}

app.on("before-quit", stopVite);
app.on("window-all-closed", () => {
  stopVite();
  app.quit();
});
