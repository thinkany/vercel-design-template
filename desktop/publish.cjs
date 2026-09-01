// desktop/publish.cjs — Vercel client + direct-deploy orchestration.
//
// Phase 0 of the in-app Publish feature (see docs/publish-integration-spec.md).
// The DEFAULT publish path is direct to Vercel, no git: create a project, set the
// gate env vars, upload the project's source, let Vercel build it (pnpm/vite per
// the template's vercel.json), and return the gated URL. GitHub is a later,
// opt-in backup path and lives elsewhere.
//
// Pure logic + `fetch` only (global in Electron's main process). No electron
// import — main.cjs owns secret storage, IPC, and the per-project publish record;
// this module is handed a token + a progress callback and does the work.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const VERCEL_API = "https://api.vercel.com";

// ---- Low-level Vercel request -----------------------------------------------
async function vercelFetch(token, pathname, { method = "GET", body, teamId, raw, digest } = {}) {
  const url = new URL(VERCEL_API + pathname);
  if (teamId) url.searchParams.set("teamId", teamId);
  const headers = { authorization: `Bearer ${token}` };
  let payload;
  if (raw) {
    headers["content-type"] = "application/octet-stream";
    if (digest) headers["x-vercel-digest"] = digest;
    payload = raw;
  } else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  return fetch(url, { method, headers, body: payload });
}

async function readJson(res) {
  try { return await res.json(); } catch { return null; }
}
// Vercel errors come back as { error: { code, message } }.
async function errMessage(res, fallback) {
  const j = await readJson(res);
  return (j && j.error && j.error.message) || fallback || `Vercel error ${res.status}`;
}

// ---- Auth --------------------------------------------------------------------
// Validate a token by asking who it belongs to. Mirrors validateKey/validateLicense.
async function validateToken(token) {
  try {
    const res = await vercelFetch(token, "/v2/user");
    if (res.ok) {
      const j = await readJson(res);
      const u = j && j.user;
      return { ok: true, user: (u && (u.username || u.name || u.email)) || "your account" };
    }
    if (res.status === 401 || res.status === 403) return { ok: false, error: "That token was rejected. Check it and try again." };
    return { ok: false, error: `Unexpected response from Vercel (${res.status}).` };
  } catch (e) {
    return { ok: false, error: `Couldn't reach Vercel: ${e.message}` };
  }
}

// ---- Sign in with Vercel (OAuth, public client + PKCE) ----------------------
const OAUTH_TOKEN_URL = "https://api.vercel.com/login/oauth/token";

// Exchange the authorization code for tokens. Public client (auth method `none`),
// so no client_secret — PKCE's code_verifier is the proof instead.
async function exchangeOAuthCode({ clientId, code, codeVerifier, redirectUri }) {
  try {
    const res = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      }).toString(),
    });
    const j = await readJson(res);
    if (!res.ok) return { ok: false, error: (j && (j.error_description || j.error)) || `Token exchange failed (${res.status}).` };
    return { ok: true, accessToken: j.access_token, refreshToken: j.refresh_token || null, expiresIn: j.expires_in || 3600 };
  } catch (e) {
    return { ok: false, error: `Couldn't reach Vercel: ${e.message}` };
  }
}

// Trade a refresh token for a fresh access token (the access token lasts ~1h).
async function refreshOAuthToken({ clientId, refreshToken }) {
  try {
    const res = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        refresh_token: refreshToken,
      }).toString(),
    });
    const j = await readJson(res);
    if (!res.ok) return { ok: false, error: (j && (j.error_description || j.error)) || `Token refresh failed (${res.status}).` };
    return { ok: true, accessToken: j.access_token, refreshToken: j.refresh_token || refreshToken, expiresIn: j.expires_in || 3600 };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Teams the token can deploy into (for scope selection). Personal scope is implicit.
async function listTeams(token) {
  try {
    const res = await vercelFetch(token, "/v2/teams");
    if (!res.ok) return [];
    const j = await readJson(res);
    return (j && j.teams ? j.teams : []).map((t) => ({ id: t.id, name: t.name || t.slug || t.id, slug: t.slug }));
  } catch {
    return [];
  }
}

// ---- Source collection -------------------------------------------------------
// The set the template's .gitignore excludes, applied here so the upload mirrors
// what a git deploy would carry (source + pnpm-lock.yaml + vercel.json, never
// node_modules / secrets / throwaway output).
const IGNORE_SEG = new Set(["node_modules", ".git", ".thinkany", "dist", "dist-app", ".vercel", ".upgrade-backup", "figma-export"]);
const IGNORE_BASE = new Set([".DS_Store", "package-lock.json", "company-profile.json"]);
function isIgnored(rel, name) {
  if (rel.split(path.sep).some((s) => IGNORE_SEG.has(s))) return true;
  if (IGNORE_BASE.has(name)) return true;
  if (name.endsWith(".local")) return true; // *.local incl. .env.local
  if (rel === path.join(".claude", "settings.local.json")) return true;
  return false;
}
function collectFiles(root) {
  const out = [];
  (function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isSymbolicLink()) continue; // never follow (node_modules is a symlink)
      const abs = path.join(dir, e.name);
      const rel = path.relative(root, abs);
      if (isIgnored(rel, e.name)) continue;
      if (e.isDirectory()) walk(abs);
      else if (e.isFile()) out.push(rel);
    }
  })(root);
  return out;
}

function sha1(buf) { return crypto.createHash("sha1").update(buf).digest("hex"); }

// Bounded-concurrency map so a few hundred small files upload quickly without
// opening hundreds of sockets at once.
async function pMap(items, fn, concurrency = 10) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, worker));
  return results;
}

// Upload one file by its sha1 digest. Vercel dedupes: an already-present blob
// returns fast, so re-deploys only transfer what changed.
async function uploadFile(token, teamId, abs) {
  const buf = fs.readFileSync(abs);
  const digest = sha1(buf);
  const res = await vercelFetch(token, "/v2/files", { method: "POST", teamId, raw: buf, digest });
  if (!res.ok && res.status !== 409) {
    throw new Error(await errMessage(res, `Upload failed (${res.status})`));
  }
  return { sha: digest, size: buf.length };
}

// ---- Env vars ----------------------------------------------------------------
// The gate lives in middleware.js (Vercel edge) and can't read VITE_*; these plain
// vars must live in the project's Vercel environment. Idempotent per key: create,
// or PATCH the existing one.
async function setEnv(token, teamId, projectId, key, value) {
  const res = await vercelFetch(token, `/v10/projects/${projectId}/env`, {
    method: "POST", teamId,
    body: { key, value, type: "encrypted", target: ["production", "preview"] },
  });
  if (res.ok) return;
  // Already exists → find its id and PATCH.
  if (res.status === 400 || res.status === 409) {
    const list = await vercelFetch(token, `/v10/projects/${projectId}/env`, { teamId });
    const j = await readJson(list);
    const envs = (j && (j.envs || j.env)) || [];
    const existing = envs.find((e) => e.key === key);
    if (existing) {
      const patch = await vercelFetch(token, `/v9/projects/${projectId}/env/${existing.id}`, {
        method: "PATCH", teamId, body: { value, target: ["production", "preview"] },
      });
      if (patch.ok) return;
      throw new Error(await errMessage(patch, `Couldn't update ${key}`));
    }
  }
  throw new Error(await errMessage(res, `Couldn't set ${key}`));
}

// ---- Project + deployment ----------------------------------------------------
// Reuse an existing project by name, else create one. Build settings mirror the
// template's vercel.json (vercel.json in the uploaded files still wins at build).
async function ensureProject(token, teamId, name) {
  const existing = await vercelFetch(token, `/v9/projects/${encodeURIComponent(name)}`, { teamId });
  if (existing.ok) {
    const j = await readJson(existing);
    return { id: j.id, name: j.name };
  }
  const res = await vercelFetch(token, "/v11/projects", {
    method: "POST", teamId,
    body: {
      name,
      framework: "vite",
      buildCommand: "pnpm run build",
      installCommand: "pnpm install --no-frozen-lockfile",
      outputDirectory: "dist",
    },
  });
  if (!res.ok) throw new Error(await errMessage(res, "Couldn't create the Vercel project"));
  const j = await readJson(res);
  return { id: j.id, name: j.name };
}

async function createDeployment(token, teamId, name, files) {
  const res = await vercelFetch(token, "/v13/deployments", {
    method: "POST", teamId,
    body: {
      name,
      target: "production",
      files, // [{ file, sha, size }]
      projectSettings: { framework: "vite" },
    },
  });
  if (!res.ok) throw new Error(await errMessage(res, "Couldn't start the deployment"));
  return readJson(res);
}

async function pollDeployment(token, teamId, id, onState) {
  const started = Date.now();
  const TIMEOUT = 5 * 60 * 1000;
  let last = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await vercelFetch(token, `/v13/deployments/${id}`, { teamId });
    const j = await readJson(res);
    const state = (j && (j.readyState || j.status)) || "QUEUED";
    if (state !== last) { last = state; onState && onState(state); }
    if (state === "READY") return j;
    if (state === "ERROR" || state === "CANCELED") {
      throw new Error(`The build ${state === "ERROR" ? "failed" : "was canceled"} on Vercel.`);
    }
    if (Date.now() - started > TIMEOUT) throw new Error("The deployment took too long (5 min).");
    await new Promise((r) => setTimeout(r, 3000));
  }
}

// The real production URL, read from Vercel rather than guessed. Guessing
// `{name}.vercel.app` is wrong whenever that host was taken and Vercel suffixed it
// (e.g. m-r → m-r-beta.vercel.app). We list the project's assigned domains and pick
// the clean production `.vercel.app` alias (shortest non-deployment, non-branch host).
async function resolveProductionUrl(token, teamId, projectId, projectName) {
  try {
    const res = await vercelFetch(token, `/v9/projects/${projectId}/domains`, { teamId });
    if (res.ok) {
      const j = await readJson(res);
      const names = ((j && (j.domains || j)) || [])
        .map((d) => d && d.name)
        .filter((n) => typeof n === "string" && n.endsWith(".vercel.app") && !n.includes("-git-"));
      if (names.length) {
        names.sort((a, b) => a.length - b.length); // clean alias is shortest; deploy hosts are longer
        return `https://${names[0]}`;
      }
    }
  } catch { /* fall through to a best-effort guess */ }
  return `https://${projectName}.vercel.app`;
}

// The apex/root domains already on the user's Vercel account/team (so they can put
// previews on a subdomain of one they own, e.g. mor.studio.com).
async function listDomains(token, teamId) {
  try {
    const res = await vercelFetch(token, "/v5/domains", { teamId });
    if (!res.ok) return [];
    const j = await readJson(res);
    return ((j && j.domains) || [])
      .filter((d) => d && d.name && d.verified)
      .map((d) => ({ name: d.name }));
  } catch {
    return [];
  }
}

// Attach a domain (e.g. a subdomain) to the project's production. For a subdomain of
// a domain already configured on Vercel this verifies automatically. Idempotent: if
// it's already on this project we treat it as success.
async function addProjectDomain(token, teamId, projectId, domain) {
  const res = await vercelFetch(token, `/v10/projects/${projectId}/domains`, {
    method: "POST", teamId, body: { name: domain },
  });
  if (res.ok) {
    const j = await readJson(res);
    return { ok: true, verified: j.verified !== false, verification: j.verification || null };
  }
  // Already attached to THIS project? Then it's fine.
  const check = await vercelFetch(token, `/v9/projects/${projectId}/domains`, { teamId });
  if (check.ok) {
    const j = await readJson(check);
    const found = ((j && (j.domains || j)) || []).find((d) => d && d.name === domain);
    if (found) return { ok: true, verified: found.verified !== false, verification: found.verification || null };
  }
  const ej = await readJson(res);
  return { ok: false, error: (ej && ej.error && ej.error.message) || `Couldn't attach ${domain} (${res.status}).` };
}

// A readable, unambiguous preview password (no 0/O/1/l/I).
function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(16);
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += alphabet[bytes[i] % alphabet.length];
    if (i === 3 || i === 7 || i === 11) out += "-";
  }
  return out;
}

// ---- The orchestrated publish ------------------------------------------------
// Runs the whole direct-to-Vercel chain, emitting progress via onProgress(step,
// status, detail). Returns { url, projectName, projectId, password } — password is
// only present when this run generated a fresh one (first publish, or a reset).
//
//   opts: { token, teamId, projectDir, projectName, env, password, onProgress }
//     env      = { CLIENT_NAME, PROJECT_TITLE }
//     password = a value to (re)set as ADMIN_PASS, or null to leave the gate as-is
async function publishProject({ token, teamId, projectDir, projectName, env, password, customDomain, onProgress }) {
  const emit = (step, status, detail) => onProgress && onProgress({ step, status, detail });

  emit("project", "run", "Creating the Vercel project");
  const project = await ensureProject(token, teamId, projectName);
  emit("project", "done", project.name);

  emit("env", "run", "Setting the preview gate");
  await setEnv(token, teamId, project.id, "CLIENT_NAME", env.CLIENT_NAME || "Preview");
  await setEnv(token, teamId, project.id, "PROJECT_TITLE", env.PROJECT_TITLE || "");
  if (password) await setEnv(token, teamId, project.id, "ADMIN_PASS", password);
  emit("env", "done", password ? "Gate password set" : "Config synced");

  emit("upload", "run", "Gathering the design files");
  const rels = collectFiles(projectDir);
  let uploaded = 0;
  const files = await pMap(rels, async (rel) => {
    const meta = await uploadFile(token, teamId, path.join(projectDir, rel));
    uploaded++;
    if (uploaded % 25 === 0 || uploaded === rels.length) emit("upload", "run", `Uploaded ${uploaded}/${rels.length} files`);
    return { file: rel.split(path.sep).join("/"), sha: meta.sha, size: meta.size };
  });
  emit("upload", "done", `${files.length} files`);

  emit("deploy", "run", "Vercel is building your design");
  const dep = await createDeployment(token, teamId, projectName, files);
  await pollDeployment(token, teamId, dep.id, (state) => {
    const nice = { QUEUED: "Queued", INITIALIZING: "Starting the build", BUILDING: "Building", READY: "Ready" }[state] || state;
    emit("deploy", "run", nice);
  });

  // If a custom domain was chosen, attach it to production and use it as the URL.
  // Otherwise ask Vercel for the actual production alias (don't guess {name}.vercel.app).
  let url;
  let domainPending = false;
  let domainError = null;
  if (customDomain) {
    emit("domain", "run", `Attaching ${customDomain}`);
    const dr = await addProjectDomain(token, teamId, project.id, customDomain);
    if (dr.ok) {
      url = `https://${customDomain}`;
      domainPending = !dr.verified;
      emit("domain", "done", dr.verified ? customDomain : `${customDomain} (DNS verifying)`);
    } else {
      domainError = dr.error;
      url = await resolveProductionUrl(token, teamId, project.id, project.name);
      emit("domain", "error", dr.error);
    }
  } else {
    url = await resolveProductionUrl(token, teamId, project.id, project.name);
  }
  emit("ready", "done", url.replace(/^https?:\/\//, ""));
  return { url, projectName: project.name, projectId: project.id, password: password || null, domainPending, domainError };
}

module.exports = { validateToken, listTeams, listDomains, publishProject, generatePassword, collectFiles, exchangeOAuthCode, refreshOAuthToken };
