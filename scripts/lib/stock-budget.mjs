// ©2026 thinkany llc. All rights reserved.
// stock-budget.mjs — pacing, hourly budget and credit ledger for the stock libraries.
//
// Shared by find-images.mjs (photos) and find-video.mjs (footage). The libraries turn
// access off for bursts and allow so many requests a window (a new Unsplash app 50 an
// hour, Pexels 200 an hour, Pixabay 100 a MINUTE), so every API call goes through
// `api()`: at least MIN_GAP_MS apart, refused once the window's remaining count (from
// the X-Ratelimit headers) is down to RESERVE, and logged, per library, to the usage
// file the app shows in Keys & Licenses (IMAGE_USAGE_FILE, set by the app; falls back
// to .thinkany/image-usage.json). Search results are cached in the same file so a
// `get` needs one call (or none, for Pexels), not two.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

export const MIN_GAP_MS = 1100;
export const RESERVE = 3;
const USAGE_FILE = process.env.IMAGE_USAGE_FILE || process.env.UNSPLASH_USAGE_FILE || path.join(ROOT, ".thinkany", "image-usage.json");

function readAll() { try { return JSON.parse(fs.readFileSync(USAGE_FILE, "utf8")) || {}; } catch { return {}; } }
function writeAll(all) { try { fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true }); fs.writeFileSync(USAGE_FILE, JSON.stringify(all, null, 2)); } catch {} }
export function readUsage(id) { const all = readAll(); return (all[id] && typeof all[id] === "object") ? all[id] : {}; }
export function writeUsage(id, u) { const all = readAll(); all[id] = u; writeAll(all); }
export const hourStart = (t = Date.now()) => t - (t % 3600000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export class BudgetError extends Error {}

// How a library's allowance resets. "hour": a fixed hour bucket, the count starts fresh
// on the hour (Unsplash, Pexels). "reset-header": the response says how many seconds are
// left in the window (Pixabay's X-RateLimit-Reset, a rolling minute); we store the
// absolute time it lands on and fall back to a minute bucket when the header is absent.
const WINDOWS = { unsplash: "hour", pexels: "hour", pixabay: "reset-header" };
const FALLBACK_WINDOW_MS = 60000;
const windowOf = (id) => WINDOWS[id] || "hour";

// Is this usage record's window still the one we're in? For "hour" that's the bucket it
// was written in; for "reset-header" it's whether the stored reset time is still ahead.
function sameWindow(id, u, now = Date.now()) {
  if (windowOf(id) === "reset-header") return typeof u.resetAt === "number" && u.resetAt > now;
  return u.hourStart === hourStart(now);
}
// When the current window ends (for the "come back in N minutes" message).
function windowEndsAt(id, u) {
  if (windowOf(id) === "reset-header") return u.resetAt || (Date.now() + FALLBACK_WINDOW_MS);
  return (u.hourStart || hourStart()) + 3600000;
}

/** Has this library got requests left in its current window? */
export function budgetLeft(id) {
  const u = readUsage(id);
  return !(sameWindow(id, u) && typeof u.remaining === "number" && u.remaining <= RESERVE);
}

/**
 * One paced, budgeted, counted API call. Throws BudgetError when the library's window is
 * spent (the caller spills to the next library, or falls back to the plain path).
 */
export async function api(id, label, url, headers) {
  const u = readUsage(id);
  const same = sameWindow(id, u);
  if (!budgetLeft(id)) {
    const mins = Math.max(1, Math.ceil((windowEndsAt(id, u) - Date.now()) / 60000));
    throw new BudgetError(`${label} budget for this window is used up (${u.limit - u.remaining} of ${u.limit}); it resets in about ${mins} min. Use another connected library, or the plain sourcing path, for the rest of this build.`);
  }
  const wait = (u.lastAt || 0) + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  const res = await fetch(url, { headers });
  const limit = parseInt(res.headers.get("x-ratelimit-limit") || "", 10);
  const remaining = parseInt(res.headers.get("x-ratelimit-remaining") || "", 10);
  const reset = parseInt(res.headers.get("x-ratelimit-reset") || "", 10);
  // A new window starts a fresh count; the previous window's remaining must not carry
  // over (a response without rate headers, a 401 say, would otherwise keep a stale low
  // number). `media` is preserved so a library serving both photos and video keeps both
  // caches across the reset.
  const cur = readUsage(id);
  const next = same ? { ...cur } : { limit: cur.limit, photos: cur.photos, videos: cur.videos };
  Object.assign(next, { lastAt: Date.now(), hourStart: hourStart(), requests: (same ? (cur.requests || 0) : 0) + 1 });
  if (windowOf(id) === "reset-header") {
    // Pixabay counts down seconds to the window's end; without the header assume a minute.
    next.resetAt = Number.isFinite(reset) ? Date.now() + reset * 1000 : Date.now() + FALLBACK_WINDOW_MS;
  }
  if (Number.isFinite(limit)) next.limit = limit;
  if (Number.isFinite(remaining)) next.remaining = remaining; else if (!same) delete next.remaining;
  writeUsage(id, next);
  return res;
}

/** Cache what a search found, so `get` can take one without a second lookup. */
export function cacheItems(id, kind, list) {
  const u = readUsage(id); const items = u[kind] || {};
  for (const p of list) items[p.id] = p;
  const ids = Object.keys(items); if (ids.length > 300) ids.slice(0, ids.length - 300).forEach((k) => delete items[k]);
  writeUsage(id, { ...u, [kind]: items });
}
export const cachedItem = (id, kind, key) => (readUsage(id)[kind] || {})[String(key)];

export const orientationOf = (w, h) => (w > h * 1.15 ? "landscape" : h > w * 1.15 ? "portrait" : "squarish");
export const utm = (u) => (u ? `${u}${u.includes("?") ? "&" : "?"}utm_source=thinkany_design&utm_medium=referral` : "");

/**
 * Walk the libraries in preference order, first one that answers wins. A library with no
 * key, no budget, nothing matching, or a transient failure hands off to the next; only a
 * forced single source reports its error. Returns null when every library came up empty
 * (the caller falls back to a placeholder for that one spot).
 *
 * This is per REQUEST, not per project: one query missing on Unsplash moves that query to
 * Pexels, rather than pinning the whole build to one library up front.
 */
export async function cascade(sources, run) {
  let lastError = null;
  for (const src of sources) {
    if (!src.key()) continue;
    if (!budgetLeft(src.id)) continue;
    try {
      const out = await run(src);
      if (out && (!Array.isArray(out.results) || out.results.length)) return out;
    } catch (e) {
      if (e instanceof BudgetError) { lastError = e; continue; }
      if (isTransient(e)) { lastError = e; continue; }
      throw e; // a rejected key or a bad request is worth reporting, not papering over
    }
  }
  if (lastError && sources.filter((s) => s.key()).length === 1) throw lastError;
  return null;
}
// A rate limit or a library having a bad day: try the next library rather than giving up.
function isTransient(e) {
  return /HTTP (429|5\d\d)/.test(e && e.message || "") || /fetch failed|ENOTFOUND|ETIMEDOUT|ECONNRESET/i.test(e && e.message || "");
}

/** Merge one credit into public/<dir>/credits.json (by file name; fresh file if none). */
export function recordCredit(root, file, credit, dir = "images") {
  const p = path.join(root, "public", dir, "credits.json");
  let list = [];
  try { const j = JSON.parse(fs.readFileSync(p, "utf8")); list = Array.isArray(j) ? j : j.images || j.videos || []; } catch {}
  list = list.filter((c) => c && c.file !== file);
  list.push({ file, ...credit });
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(list, null, 2) + "\n");
  return list.length;
}

/** Write the bytes as AVIF at `out` (sharp), else as JPG beside the intended name. */
export async function writeImage(bytes, out) {
  let sharp = null;
  try { sharp = (await import("sharp")).default; } catch {}
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (sharp && /\.avif$/i.test(out)) {
    await sharp(bytes).rotate().avif({ quality: 55 }).toFile(out);
    return out;
  }
  const jpg = out.replace(/\.avif$/i, ".jpg");
  fs.writeFileSync(jpg, bytes);
  return jpg;
}

/** `--flag value` / bare positional parsing, shared by both CLIs. */
export function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) { const k = a.slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true"; out[k] = v; }
    else out._.push(a);
  }
  return out;
}

/** Per-library status for `status` (what Keys & Licenses shows). */
export function statusOf(sources) {
  const out = {};
  for (const s of sources) {
    const u = readUsage(s.id); const same = sameWindow(s.id, u);
    out[s.id] = { configured: !!s.key(), limit: u.limit || null, remaining: same ? (u.remaining ?? null) : null, requestsThisWindow: same ? (u.requests || 0) : 0 };
  }
  return out;
}
