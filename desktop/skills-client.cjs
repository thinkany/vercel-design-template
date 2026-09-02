// ©2026 thinkany llc. All rights reserved.
// The app's client for the licensed SKILLS service (derive.thinkany.design/api/skills).
//
// The design-process playbooks (/design, /design-brief, /promote-blocks,
// /setup-styleguide) are process IP. They no longer ship in the scaffold; the
// scaffold carries one-paragraph stubs so the slash commands autocomplete. The
// REAL body reaches the model only through this: fetched with the Design license,
// cached encrypted under userData (offline grace, same shape as the keys), and
// spliced into the turn by expandPrompt() BEFORE the SDK sees the prompt, so the
// SDK never expands the stub.
//
// Degrades cleanly: no license → no skills → the SDK expands the stub, which tells
// the designer the skill needs the app + a license. A failed refresh keeps the last
// cache. SKILLS_LOCAL=1 (dev) reads desktop/skills/*.md straight from disk.
//
// The chain of trust is the license: whoever holds a key gets the text. This is
// hardening (the playbooks are not on every designer's disk), not secrecy.
const fs = require("node:fs");
const path = require("node:path");

const TIMEOUT_MS = 6000;
const CACHE_FILE = "skills.enc";

function endpoint() {
  if (process.env.SKILLS_ENDPOINT) return process.env.SKILLS_ENDPOINT;
  const base = process.env.DERIVE_ENDPOINT || "https://derive.thinkany.design/api/derive";
  return base.replace(/\/api\/derive\/?$/, "/api/skills");
}

// Split "---\n<frontmatter>\n---\n<body>" (dev-only local read; the server does
// the same split at sync time).
function parseSkillFile(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const desc = (m[1].match(/^description:\s*(.*)$/m) || [])[1] || "";
  return { description: desc.trim(), body: m[2].trim() + "\n" };
}

/**
 * Create the client. `safeStorage` + `userDataDir` are injected (Electron's main
 * process passes the real ones; tests pass a fake), so this module has no
 * Electron import of its own.
 */
function createSkillsClient({ safeStorage, userDataDir, localDir, log = () => {} }) {
  let state = { etag: null, fetchedAt: null, skills: {} }; // in-memory copy of the cache
  const cachePath = () => path.join(userDataDir, CACHE_FILE);

  function encrypt(text) {
    return safeStorage && safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : Buffer.from(text, "utf8");
  }
  function decrypt(buf) {
    return safeStorage && safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString("utf8");
  }

  /** Load the on-disk cache (boot). Never throws. */
  function load() {
    try {
      const parsed = JSON.parse(decrypt(fs.readFileSync(cachePath())));
      if (parsed && parsed.skills && typeof parsed.skills === "object") state = parsed;
    } catch { /* no cache yet, or unreadable → stay empty */ }
    return state;
  }
  function save() {
    try {
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.writeFileSync(cachePath(), encrypt(JSON.stringify(state)));
    } catch (e) { log(`skills cache write failed: ${e.message}`); }
  }
  /** Forget everything (the license was removed). */
  function clear() {
    state = { etag: null, fetchedAt: null, skills: {} };
    try { fs.rmSync(cachePath(), { force: true }); } catch {}
  }

  // DEV: the canonical sources on disk, re-read on every call so an edit is live.
  function localSkills() {
    const out = {};
    let files = [];
    try { files = fs.readdirSync(localDir); } catch { return out; }
    for (const f of files) {
      if (!f.endsWith(".md")) continue;
      const parsed = parseSkillFile(fs.readFileSync(path.join(localDir, f), "utf8"));
      if (parsed) out[f.replace(/\.md$/, "")] = parsed;
    }
    return out;
  }

  /**
   * Fetch the bundle with the given license key. 304 → keep the cache; 200 →
   * replace + persist; anything else → keep what we have. Returns the skill map.
   */
  async function refresh(licenseKey) {
    const key = (licenseKey || "").trim();
    if (!key) return state.skills;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const headers = { "x-license-key": key };
      if (state.etag) headers["if-none-match"] = state.etag;
      const res = await fetch(endpoint(), { headers, signal: ctrl.signal });
      if (res.status === 304) {
        state.fetchedAt = new Date().toISOString();
        save();
        return state.skills;
      }
      if (!res.ok) { log(`skills refresh: HTTP ${res.status}`); return state.skills; }
      const doc = await res.json();
      if (!doc || !doc.skills || typeof doc.skills !== "object") return state.skills;
      state = { etag: doc.etag || res.headers.get("etag") || null, fetchedAt: new Date().toISOString(), skills: doc.skills };
      save();
      log(`skills refreshed: ${Object.keys(state.skills).join(", ")}`);
      return state.skills;
    } catch (e) {
      log(`skills refresh failed: ${e.message}`);
      return state.skills;
    } finally { clearTimeout(t); }
  }

  function skills() {
    return process.env.SKILLS_LOCAL && localDir ? localSkills() : state.skills;
  }
  function has(name) { return !!skills()[name]; }
  function names() { return Object.keys(skills()); }

  /**
   * If `prompt` invokes a skill we hold ("/design-brief a dog park site"), return
   * the expanded prompt: the playbook body with $ARGUMENTS replaced by the rest of
   * the line (Claude Code's own substitution rule), or the body alone when the
   * skill takes no arguments. Anything else → null (send the prompt as-is; the
   * SDK handles local commands and plain chat).
   */
  function expandPrompt(prompt) {
    if (typeof prompt !== "string") return null;
    // The name ends at the first whitespace of any kind: "/design-brief a site",
    // "/promote-blocks\n\nuse v02" and a bare "/design" all match.
    const m = prompt.match(/^\/([a-z0-9][a-z0-9-]*)(?:\s+([\s\S]*))?$/);
    if (!m) return null;
    const name = m[1];
    const skill = skills()[name];
    if (!skill) return null;
    const args = (m[2] || "").trim();
    let body = skill.body;
    if (body.includes("$ARGUMENTS")) body = body.split("$ARGUMENTS").join(args);
    else if (args) body = body + "\n\n" + args; // a skill without a slot still gets what was typed
    return { name, prompt: body };
  }

  return { load, refresh, clear, skills, has, names, expandPrompt, endpoint, _state: () => state };
}

module.exports = { createSkillsClient, parseSkillFile, endpoint };
