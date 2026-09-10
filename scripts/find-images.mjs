// ©2026 thinkany llc. All rights reserved.
// find-images.mjs — source photos for a design from a stock library (CORE).
//
//   node scripts/find-images.mjs search "<query>" [--orientation landscape|portrait|squarish]
//                                                  [--color <hint>] [--per 8] [--page 1]
//   node scripts/find-images.mjs get <id> --out public/images/<name>.avif [--width 2400]
//   node scripts/find-images.mjs status
//
// `search` prints JSON candidates: id, a description and alt text, the dominant colour,
// size and orientation, the photographer, and a small thumb URL (for a look, if wanted).
// `get` takes one candidate into public/images as AVIF (JPG when sharp is unavailable),
// records the attribution in public/images/credits.json, and reports the file. The
// library's terms are honoured here: the download endpoint is triggered on every take,
// and the credit carries the photographer and links for the site to show.
//
// Source: Unsplash (UNSPLASH_ACCESS_KEY, the designer's own key from Keys & Licenses).
// The `--source` switch is where another library (Pexels, Pixabay) plugs in later.
// Colour hints for Unsplash: black_and_white, black, white, yellow, orange, red, purple,
// magenta, green, teal, blue.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// ---- Pace + budget. Unsplash turns access off for bursts, and a demo app has 50
// requests an hour. Every API call goes through `api()`: at least MIN_GAP_MS apart,
// refused once the hour's remaining count (from the X-Ratelimit headers) is down to
// RESERVE, and logged to the usage file the app shows in Keys & Licenses
// (UNSPLASH_USAGE_FILE, set by the app; falls back to .thinkany/unsplash.json here).
// Search results are cached in the same file so `get` needs one call, not two.
const MIN_GAP_MS = 1100;
const RESERVE = 3;
const USAGE_FILE = process.env.UNSPLASH_USAGE_FILE || path.join(ROOT, ".thinkany", "unsplash.json");
function readUsage() { try { return JSON.parse(fs.readFileSync(USAGE_FILE, "utf8")) || {}; } catch { return {}; } }
function writeUsage(u) { try { fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true }); fs.writeFileSync(USAGE_FILE, JSON.stringify(u, null, 2)); } catch {} }
const hourStart = (t = Date.now()) => t - (t % 3600000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export class BudgetError extends Error {}
async function api(url, headers) {
  const u = readUsage();
  const sameHour = u.hourStart === hourStart();
  if (sameHour && typeof u.remaining === "number" && u.remaining <= RESERVE) {
    const mins = Math.max(1, Math.ceil((u.hourStart + 3600000 - Date.now()) / 60000));
    throw new BudgetError(`Unsplash budget for this hour is used up (${u.limit - u.remaining} of ${u.limit}); it resets in about ${mins} min. Use the plain sourcing path for the rest of this build.`);
  }
  const wait = (u.lastAt || 0) + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  const res = await fetch(url, { headers });
  const limit = parseInt(res.headers.get("x-ratelimit-limit") || "", 10);
  const remaining = parseInt(res.headers.get("x-ratelimit-remaining") || "", 10);
  // A new hour starts a fresh count; the previous hour's remaining must not carry over
  // (a response without rate headers, a 401 say, would otherwise keep a stale low number).
  const cur = readUsage();
  const next = sameHour ? { ...cur } : { limit: cur.limit, photos: cur.photos };
  Object.assign(next, { lastAt: Date.now(), hourStart: hourStart(), requests: (sameHour ? (cur.requests || 0) : 0) + 1 });
  if (Number.isFinite(limit)) next.limit = limit;
  if (Number.isFinite(remaining)) next.remaining = remaining; else if (!sameHour) delete next.remaining;
  writeUsage(next);
  return res;
}
function cachePhotos(list) {
  const u = readUsage(); const photos = u.photos || {};
  for (const p of list) photos[p.id] = p;
  const ids = Object.keys(photos); if (ids.length > 300) ids.slice(0, ids.length - 300).forEach((k) => delete photos[k]);
  writeUsage({ ...u, photos });
}
const SOURCES = {
  unsplash: {
    key: () => (process.env.UNSPLASH_ACCESS_KEY || "").trim(),
    keyName: "UNSPLASH_ACCESS_KEY",
    label: "Unsplash",
    async search({ query, orientation, color, per, page }) {
      const u = new URL("https://api.unsplash.com/search/photos");
      u.searchParams.set("query", query);
      u.searchParams.set("per_page", String(per));
      u.searchParams.set("page", String(page));
      u.searchParams.set("content_filter", "high");
      if (orientation) u.searchParams.set("orientation", orientation);
      if (color) u.searchParams.set("color", color);
      const res = await api(u, { Authorization: `Client-ID ${this.key()}`, "Accept-Version": "v1" });
      if (!res.ok) throw new Error(`Unsplash search: HTTP ${res.status}${res.status === 401 ? " (the key was rejected)" : res.status === 403 ? " (rate limit reached, try again in an hour)" : ""}`);
      const data = await res.json();
      // Keep what `get` needs, so taking a photo costs one call (the download ping), not two.
      cachePhotos((data.results || []).map((p) => ({ id: p.id, raw: p.urls && p.urls.raw, download_location: p.links && p.links.download_location, html: p.links && p.links.html, description: p.description || p.alt_description || "", user: { name: p.user && p.user.name || "", html: p.user && p.user.links && p.user.links.html || "" } })));
      return (data.results || []).map((p) => ({
        id: p.id,
        description: p.description || "",
        alt: p.alt_description || "",
        color: p.color || "",
        width: p.width, height: p.height,
        orientation: p.width > p.height * 1.15 ? "landscape" : p.height > p.width * 1.15 ? "portrait" : "squarish",
        photographer: p.user && p.user.name || "",
        thumb: p.urls && p.urls.thumb || "",
      }));
    },
    async take(id, width) {
      const h = { Authorization: `Client-ID ${this.key()}`, "Accept-Version": "v1" };
      let p = (readUsage().photos || {})[id];
      if (!p) {
        const res = await api(`https://api.unsplash.com/photos/${encodeURIComponent(id)}`, h);
        if (!res.ok) throw new Error(`Unsplash photo ${id}: HTTP ${res.status}`);
        const j = await res.json();
        p = { id, raw: j.urls.raw, download_location: j.links.download_location, html: j.links.html, description: j.description || j.alt_description || "", user: { name: j.user && j.user.name || "", html: j.user && j.user.links && j.user.links.html || "" } };
      }
      // The terms: trigger the download endpoint whenever a copy is taken (one counted call).
      if (p.download_location) { try { await api(p.download_location, h); } catch (e) { if (e instanceof BudgetError) throw e; } }
      const u = new URL(p.raw);
      u.searchParams.set("w", String(width)); u.searchParams.set("q", "85"); u.searchParams.set("fm", "jpg"); u.searchParams.set("fit", "max");
      const img = await fetch(u);
      if (!img.ok) throw new Error(`Unsplash file ${id}: HTTP ${img.status}`);
      return {
        bytes: Buffer.from(await img.arrayBuffer()),
        credit: {
          source: "unsplash.com",
          url: `${p.html}?utm_source=thinkany_design&utm_medium=referral`,
          free: true,
          author: p.user.name,
          authorUrl: p.user.html ? `${p.user.html}?utm_source=thinkany_design&utm_medium=referral` : "",
          description: p.description,
        },
      };
    },
  },
};

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) { const k = a.slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true"; out[k] = v; }
    else out._.push(a);
  }
  return out;
}

/** Merge one credit into public/images/credits.json (by file name; fresh file if none). */
export function recordCredit(root, file, credit) {
  const p = path.join(root, "public", "images", "credits.json");
  let list = [];
  try { const j = JSON.parse(fs.readFileSync(p, "utf8")); list = Array.isArray(j) ? j : j.images || []; } catch {}
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

async function main() {
  const a = args(process.argv.slice(2));
  const cmd = a._[0];
  const src = SOURCES[a.source || "unsplash"];
  if (!src) { console.error(`Unknown source "${a.source}". Sources: ${Object.keys(SOURCES).join(", ")}`); process.exit(2); }
  if (cmd === "status") { const u = readUsage(); const same = u.hourStart === hourStart(); console.log(JSON.stringify({ source: src.label, configured: !!src.key(), limit: u.limit || null, remaining: same ? u.remaining : null, requestsThisHour: same ? (u.requests || 0) : 0 })); return; }
  if (!src.key()) { console.error(`${src.label} isn't connected: no ${src.keyName}. The designer adds the key under Keys & Licenses (${src.label}, optional). Use the plain sourcing path instead.`); process.exit(3); }
  if (cmd === "search") {
    const query = a._.slice(1).join(" ").trim();
    if (!query) { console.error("search needs a query"); process.exit(2); }
    const results = await src.search({ query, orientation: a.orientation, color: a.color, per: Math.min(30, parseInt(a.per || "8", 10) || 8), page: parseInt(a.page || "1", 10) || 1 });
    console.log(JSON.stringify({ source: src.label, query, results }, null, 1));
    return;
  }
  if (cmd === "get") {
    const id = a._[1]; const out = a.out;
    if (!id || !out) { console.error("get needs <id> --out public/images/<name>.avif"); process.exit(2); }
    const abs = path.resolve(ROOT, out);
    if (!abs.startsWith(path.join(ROOT, "public", "images") + path.sep)) { console.error("--out must be under public/images/"); process.exit(2); }
    const { bytes, credit } = await src.take(id, Math.min(4000, parseInt(a.width || "2400", 10) || 2400));
    const written = await writeImage(bytes, abs);
    const file = path.basename(written);
    const n = recordCredit(ROOT, file, credit);
    console.log(JSON.stringify({ file: `/images/${file}`, credit, credits: n }));
    return;
  }
  console.error("usage: find-images.mjs search <query> [--orientation ..] [--color ..] [--per 8] | get <id> --out public/images/<name>.avif [--width 2400] | status");
  process.exit(2);
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  // exit 3: no key; exit 4: the hour's budget is spent (both mean: plain path); 1: other errors.
  main().catch((e) => { console.error(e.message || String(e)); process.exit(e instanceof BudgetError ? 4 : 1); });
}
