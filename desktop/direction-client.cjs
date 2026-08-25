// ©2026 thinkany llc. All rights reserved.
// The app's thin client for the cloud design-variety endpoint (derive.thinkany.design/
// api/direction). The curated lens deck + sampler run SERVER-side (the IP moat); this only
// POSTs brief signals and gets back a sampled Direction (+ its server-rendered prompt block)
// or the knob-panel metadata. Same `x-license-key` auth as the Figma derive.
//
// Degrades safely — a failed/slow call NEVER hard-fails a build: sample → { direction: null },
// meta → the last cached value (or empty, so the knob panel just stays dark). Set
// DIRECTION_LOCAL=1 to use the on-disk deck instead (DEV only; the deck is bundle-excluded from
// the packaged app). Same shapes as the old local intake/direction.cjs seam, but ASYNC.

const TIMEOUT_MS = 4000;
let _metaCache = null; // last successful meta — survives brief outages

function endpoint() {
  if (process.env.DIRECTION_ENDPOINT) return process.env.DIRECTION_ENDPOINT;
  const base = process.env.DERIVE_ENDPOINT || "https://derive.thinkany.design/api/derive";
  return base.replace(/\/api\/derive\/?$/, "/api/direction");
}

// DEV fallback only: the on-disk deck (excluded from the packaged app).
function localDeck() {
  try { return require("./intake/direction.cjs"); } catch { return null; }
}

async function post(body) {
  // The Design/Research/Director bundle key — its own Vercel env, separate from the Figma
  // export's DERIVE_LICENSE_KEY; same key the app gates the bundle on (main.cjs researchLicensed).
  const key = (process.env.DESIGN_LICENSE_KEY || "").trim();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(endpoint(), {
      method: "POST",
      headers: { "content-type": "application/json", "x-license-key": key },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`direction ${body.op}: HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

// Knob-panel metadata { axes, lenses }. Cached; on failure returns the last cache (or empty →
// the renderer skips the knob panel, same as unlicensed).
async function directionMeta() {
  const local = process.env.DIRECTION_LOCAL && localDeck();
  if (local) return local.directionMeta();
  try { _metaCache = await post({ op: "meta" }); return _metaCache; }
  catch { return _metaCache || { axes: {}, lenses: [] }; }
}

// Sample a Direction → { direction, block }. `direction` carries its server-stamped lensLabel;
// `block` is the server-rendered prompt block. On failure → { direction: null, block: "" } so a
// build proceeds at the model's default centroid rather than hard-failing.
async function sampleDirection(inputs = {}) {
  const local = process.env.DIRECTION_LOCAL && localDeck();
  if (local) {
    const direction = local.sampleDirection(inputs);
    const stamped = direction ? { ...direction, lensLabel: local.lensLabel(direction.lens) } : null;
    return { direction: stamped, block: stamped ? local.renderDirectionPrompt(stamped) : "" };
  }
  try { return await post({ op: "sample", ...inputs }); }
  catch { return { direction: null, block: "" }; }
}

// Record a COMMITTED design onto the designer's anti-repetition memory (lever 3, §9), so future
// samples down-weight this lens + these motifs. `entry` = { designer, direction }. Fire-and-
// forget: a failed record only weakens future variety slightly, so it NEVER blocks a build (and
// the DIRECTION_LOCAL dev deck has no server memory, so it's a no-op there).
async function recordDirection(entry = {}) {
  if (process.env.DIRECTION_LOCAL) return { ok: false };
  if (!entry.designer || !entry.direction || !entry.direction.lens) return { ok: false };
  try { return await post({ op: "record", designer: entry.designer, direction: entry.direction }); }
  catch { return { ok: false }; }
}

// Drop the cached meta so the next directionMeta() re-fetches — call this the moment
// the design license changes, so the licensed/unlicensed state can't read stale.
function resetMetaCache() { _metaCache = null; }

module.exports = { directionMeta, sampleDirection, recordDirection, resetMetaCache };
