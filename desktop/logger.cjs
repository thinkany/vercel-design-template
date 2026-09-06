// ©2026 thinkany llc. All rights reserved.
// APP LOG (Settings → Logging). Off by default. When on, everything the main process
// prints, the renderer's console, and the agent's turn events (tool names, denials,
// errors, the runtime's own diagnostics) go to a daily file under userData/logs,
// seven days kept. Testers turn it on, reproduce, and "Save log file…" hands them the
// day's file to send back. Keys are never written: anything that looks like one is
// redacted before it hits the disk.
const fs = require("node:fs");
const path = require("node:path");

let dir = null;          // userData/logs
let enabled = false;
let lastDate = "";       // the day the last line went to (prune once per day)
let wrapped = false;
const original = {};     // console methods before wrapping

const KEEP_DAYS = 7;
const REDACT = [
  /sk-ant-[A-Za-z0-9_-]{8,}/g,            // Claude keys
  /\bre_[A-Za-z0-9]{10,}\b/g,             // Resend
  /\bSG\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, // SendGrid
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, // Postmark / license-shaped tokens
  /(ANTHROPIC_API_KEY|DERIVE_LICENSE_KEY|DESIGN_LICENSE_KEY|FORMS_LICENSE_KEY|FORMS_PROVIDER_KEY|RECAPTCHA_SECRET)\s*[=:]\s*\S+/g,
];
function redact(text) { let t = String(text); for (const re of REDACT) t = t.replace(re, (m, k) => (k ? `${k}=[redacted]` : "[redacted]")); return t; }

function today() { return new Date().toISOString().slice(0, 10); }
function fileFor(date) { return path.join(dir, `thinkany-${date}.log`); }
function prune() {
  try {
    const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
    for (const f of fs.readdirSync(dir)) { const m = f.match(/^thinkany-(\d{4}-\d{2}-\d{2})\.log$/); if (m && Date.parse(m[1]) < cutoff) { try { fs.unlinkSync(path.join(dir, f)); } catch {} } }
  } catch {}
}
function fmt(args) {
  return args.map((a) => { if (a instanceof Error) return a.stack || a.message; if (typeof a === "string") return a; try { return JSON.stringify(a); } catch { return String(a); } }).join(" ");
}

/** Append one line: `[time] [source/level] text`. No-op while disabled. */
function write(level, source, text) {
  if (!enabled || !dir) return;
  try {
    const d = today();
    if (d !== lastDate) { fs.mkdirSync(dir, { recursive: true }); prune(); lastDate = d; }
    // Synchronous append: a line is on disk when the call returns, so "Save log file" and a crash both see it.
    fs.appendFileSync(fileFor(d), `[${new Date().toISOString()}] [${source}/${level}] ${redact(text).replace(/\r?\n/g, "\n    ")}\n`);
  } catch {}
}

function wrapConsole() {
  if (wrapped) return; wrapped = true;
  for (const level of ["log", "info", "warn", "error"]) {
    original[level] = console[level].bind(console);
    console[level] = (...args) => { original[level](...args); write(level, "main", fmt(args)); };
  }
}

/** Point the log at a folder and turn it on or off. Safe to call again. */
function configure({ logsDir, on }) {
  dir = logsDir;
  const was = enabled;
  if (on) { enabled = true; wrapConsole(); write("info", "main", "logging on"); }
  else { if (was) write("info", "main", "logging off"); enabled = false; }
}
function isEnabled() { return enabled; }
function currentFile() { return dir ? fileFor(today()) : null; }
function logsDir() { return dir; }

module.exports = { configure, isEnabled, write, currentFile, logsDir, redact };
