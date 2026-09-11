// ©2026 thinkany llc. All rights reserved.
// find-video.mjs — source demo/FPO footage for a design from a stock library (CORE).
//
//   node scripts/find-video.mjs search "<query>" [--orientation landscape|portrait]
//                                               [--min-duration 4] [--max-duration 30] [--per 8]
//   node scripts/find-video.mjs get <id> --source <the search's source>
//                                        --out public/video/<name>.mp4 [--spot background|figure]
//   node scripts/find-video.mjs status
//
// `search` prints JSON candidates: id, a description, size and orientation, duration, the
// contributor, a poster URL, and the size rungs available with their byte weights. `get`
// takes one candidate into public/video as MP4, ALWAYS writes a poster still beside it as
// AVIF, records the attribution in public/video/credits.json, and reports both files.
//
// The poster is not optional: it is what a reduced-motion visitor sees, what the Figma
// capture exports, what the <video> shows before the first frame paints, and what the
// design falls back to when a clip is cleared. A video without one is a black box.
//
// Sources: Pexels (PEXELS_API_KEY) and Pixabay (PIXABAY_API_KEY), the designer's own keys
// from Keys & Licenses. Unsplash is stills-only and is not in this chain. `--source
// pexels|pixabay|auto` (default auto: each search walks the connected libraries in order,
// Pexels then Pixabay, and the first with budget and a match answers).
import fs from "node:fs";
import path from "node:path";
import {
  api, budgetLeft, cacheItems, cachedItem, cascade, BudgetError,
  orientationOf, recordCredit, writeImage, args, statusOf,
} from "./lib/stock-budget.mjs";

const ROOT = process.cwd();

// The library endpoints. TA_STOCK_TEST_BASE points them at a local stub for
// desktop/dev/find-video.test.mjs; unset (always, in a real project) they are the
// libraries themselves.
const TEST_BASE = process.env.TA_STOCK_TEST_BASE || "";
const PEXELS_API = TEST_BASE || "https://api.pexels.com";
const PIXABAY_API = TEST_BASE ? `${TEST_BASE}/api/videos/` : "https://pixabay.com/api/videos/";

// What a spot can afford. A hero loop carries the page, a figure sits in a content row;
// neither is worth many megabytes of FPO. `get` takes the smallest rung that clears the
// target width, and when every rung is over the cap it takes the smallest and says so.
const SPOTS = {
  background: { width: 1920, cap: 8 * 1024 * 1024, label: "full-bleed background" },
  figure: { width: 1280, cap: 4 * 1024 * 1024, label: "in-flow figure" },
};

const SOURCES = {
  pexels: {
    id: "pexels",
    key: () => (process.env.PEXELS_API_KEY || "").trim(),
    keyName: "PEXELS_API_KEY",
    label: "Pexels",
    async search({ query, orientation, per, page, minDuration, maxDuration }) {
      const u = new URL(`${PEXELS_API}/videos/search`);
      u.searchParams.set("query", query);
      u.searchParams.set("per_page", String(per));
      u.searchParams.set("page", String(page));
      if (orientation) u.searchParams.set("orientation", orientation === "squarish" ? "square" : orientation);
      if (Number.isFinite(minDuration)) u.searchParams.set("min_duration", String(minDuration));
      if (Number.isFinite(maxDuration)) u.searchParams.set("max_duration", String(maxDuration));
      const res = await api("pexels", "Pexels", u, { Authorization: this.key() });
      if (!res.ok) throw new Error(`Pexels video search: HTTP ${res.status}${res.status === 401 ? " (the key was rejected)" : res.status === 429 ? " (rate limit reached, try again in an hour)" : ""}`);
      const data = await res.json();
      const mapped = (data.videos || []).map(shapePexels).filter((v) => v.sizes.length && v.poster);
      // Everything `get` needs comes with the search, so taking a Pexels clip costs no call.
      cacheItems("pexels", "videos", mapped.map((v) => ({ id: v.id, sizes: v.sizes, poster: v.poster, html: v.html, description: v.description, user: v.user })));
      return mapped.map(publicFields);
    },
    async take(id) {
      let v = cachedItem("pexels", "videos", id);
      if (!v) {
        const res = await api("pexels", "Pexels", `${PEXELS_API}/videos/videos/${encodeURIComponent(id)}`, { Authorization: this.key() });
        if (!res.ok) throw new Error(`Pexels video ${id}: HTTP ${res.status}`);
        const s = shapePexels(await res.json());
        v = { id: s.id, sizes: s.sizes, poster: s.poster, html: s.html, description: s.description, user: s.user };
      }
      return v;
    },
  },
  pixabay: {
    id: "pixabay",
    key: () => (process.env.PIXABAY_API_KEY || "").trim(),
    keyName: "PIXABAY_API_KEY",
    label: "Pixabay",
    async search({ query, orientation, per, page }) {
      const u = new URL(PIXABAY_API);
      u.searchParams.set("key", this.key());
      u.searchParams.set("q", query);
      u.searchParams.set("per_page", String(Math.max(3, per))); // their minimum is 3
      u.searchParams.set("page", String(page));
      u.searchParams.set("safesearch", "true");
      const res = await api("pixabay", "Pixabay", u, {});
      if (!res.ok) throw new Error(`Pixabay video search: HTTP ${res.status}${res.status === 400 ? " (the key was rejected, or the query was invalid)" : res.status === 429 ? " (rate limit reached, try again shortly)" : ""}`);
      const data = await res.json();
      const mapped = (data.hits || []).map(shapePixabay).filter((v) => v.sizes.length && v.poster);
      cacheItems("pixabay", "videos", mapped.map((v) => ({ id: v.id, sizes: v.sizes, poster: v.poster, html: v.html, description: v.description, user: v.user })));
      return mapped.map(publicFields);
    },
    async take(id) {
      let v = cachedItem("pixabay", "videos", id);
      if (!v) {
        const u = new URL(PIXABAY_API);
        u.searchParams.set("key", this.key());
        u.searchParams.set("id", String(id));
        const res = await api("pixabay", "Pixabay", u, {});
        if (!res.ok) throw new Error(`Pixabay video ${id}: HTTP ${res.status}`);
        const hit = ((await res.json()).hits || [])[0];
        if (!hit) throw new Error(`Pixabay video ${id}: not found`);
        const s = shapePixabay(hit);
        v = { id: s.id, sizes: s.sizes, poster: s.poster, html: s.html, description: s.description, user: s.user };
      }
      return v;
    },
  },
};

// ---- Normalising the two libraries into one candidate shape -------------------
// Pexels: video_files[] carries {link,width,height,quality,file_type}; video_pictures[]
// the poster frames. Sizes have no byte count, so `bytes` stays null and the cap check
// falls back to the HEAD request in pickRung().
function shapePexels(v) {
  const files = (v.video_files || []).filter((f) => /mp4/i.test(f.file_type || "") && f.width && f.height);
  return {
    id: String(v.id),
    // `tags` has been seen both as [{title}] and as plain strings; treat either as a label.
    description: (Array.isArray(v.tags) ? v.tags : [])
      .map((t) => (typeof t === "string" ? t : (t && t.title) || "")).filter(Boolean).join(", "),
    width: v.width, height: v.height,
    duration: v.duration || null,
    photographer: (v.user && v.user.name) || "",
    poster: v.image || ((v.video_pictures || [])[0] || {}).picture || "",
    html: v.url || "",
    user: { name: (v.user && v.user.name) || "", html: (v.user && v.user.url) || "" },
    sizes: files.map((f) => ({ url: f.link, width: f.width, height: f.height, bytes: null, quality: f.quality || "" }))
      .sort((a, b) => a.width - b.width),
  };
}
// Pixabay: videos.{large,medium,small,tiny} each {url,width,height,size}. Byte counts are
// given, so the cap is checked without a network round trip.
function shapePixabay(v) {
  const rungs = Object.entries(v.videos || {})
    .filter(([, f]) => f && f.url && f.width)
    .map(([quality, f]) => ({ url: f.url, width: f.width, height: f.height, bytes: f.size || null, quality, thumbnail: f.thumbnail || "" }))
    .sort((a, b) => a.width - b.width);
  const first = rungs[rungs.length - 1] || {};
  return {
    id: String(v.id),
    description: v.tags || "",
    width: first.width || null, height: first.height || null,
    duration: v.duration || null,
    photographer: v.user || "",
    // Whatever thumbnail the response carries, largest first. Their rungs each may bring
    // one; only if none does do we fall back to the id-derived CDN URL, which is the one
    // part of this shape not confirmed against a live response.
    poster: rungs.map((r) => r.thumbnail).filter(Boolean).pop()
      || (v.picture_id ? `https://i.vimeocdn.com/video/${v.picture_id}_640x360.jpg` : ""),
    html: v.pageURL || "",
    user: { name: v.user || "", html: v.user_id ? `https://pixabay.com/users/${v.user}-${v.user_id}/` : "" },
    sizes: rungs,
  };
}
// What a candidate looks like to the caller (the cache keeps the URLs; this is the view).
const publicFields = (v) => ({
  id: v.id,
  description: v.description,
  alt: v.description,
  width: v.width, height: v.height,
  orientation: orientationOf(v.width || 16, v.height || 9),
  duration: v.duration,
  photographer: v.photographer,
  poster: v.poster,
  sizes: v.sizes.map((s) => ({ quality: s.quality, width: s.width, height: s.height, bytes: s.bytes })),
});

/**
 * The smallest rung at or above the spot's target width, else the largest available.
 * Returns { rung, overCap, bytes } — `overCap` is what the caller reports rather than
 * silently dropping a heavy clip into the project.
 */
async function pickRung(sizes, spot) {
  const target = SPOTS[spot].width;
  const atOrAbove = sizes.filter((s) => s.width >= target);
  const candidates = atOrAbove.length ? atOrAbove : sizes.slice(-1);
  for (const rung of candidates) {
    const bytes = rung.bytes != null ? rung.bytes : await headBytes(rung.url);
    if (bytes == null || bytes <= SPOTS[spot].cap) return { rung, bytes, overCap: false };
  }
  // Every rung that fits the spot is over the cap: take the smallest one there is.
  const smallest = sizes[0];
  const bytes = smallest.bytes != null ? smallest.bytes : await headBytes(smallest.url);
  return { rung: smallest, bytes, overCap: true };
}
async function headBytes(url) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    const n = parseInt(r.headers.get("content-length") || "", 10);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

const ORDER = ["pexels", "pixabay"];
const inOrder = () => ORDER.map((id) => SOURCES[id]);
const connected = () => inOrder().filter((s) => s.key());
const mb = (n) => (n == null ? "unknown size" : `${(n / 1048576).toFixed(1)} MB`);

async function main() {
  const a = args(process.argv.slice(2));
  const cmd = a._[0];
  if (cmd === "status") { console.log(JSON.stringify(statusOf(inOrder()))); return; }
  const forced = a.source && a.source !== "auto" ? SOURCES[a.source] : null;
  if (a.source && a.source !== "auto" && !forced) { console.error(`Unknown source "${a.source}". Video sources: ${ORDER.join(", ")}, auto (Unsplash is stills-only).`); process.exit(2); }
  if (!connected().length) { console.error(`No video library is connected (${inOrder().map((s) => s.keyName).join(" / ")}). The designer adds a Pexels or Pixabay key under Keys & Licenses; Unsplash is stills-only. Build this spot with a still image instead.`); process.exit(3); }
  if (forced && !forced.key()) { console.error(`${forced.label} isn't connected (${forced.keyName}). Use --source auto, or another library.`); process.exit(3); }

  if (cmd === "search") {
    const query = a._.slice(1).join(" ").trim();
    if (!query) { console.error("search needs a query"); process.exit(2); }
    const params = {
      query, orientation: a.orientation,
      per: Math.min(30, parseInt(a.per || "8", 10) || 8),
      page: parseInt(a.page || "1", 10) || 1,
      minDuration: parseInt(a["min-duration"] || "4", 10),
      maxDuration: parseInt(a["max-duration"] || "30", 10),
    };
    const hit = await cascade(forced ? [forced] : inOrder(), async (src) => ({ source: src.id, query, results: await src.search(params) }));
    if (!hit) {
      const spent = connected().every((s) => !budgetLeft(s.id));
      console.error(spent
        ? "Every connected video library's budget is spent for this window. Build this spot with a still image."
        : "No video library had a match for that query. Try a reworded query once, or build this spot with a still image.");
      process.exit(spent ? 4 : 5);
    }
    console.log(JSON.stringify(hit, null, 1));
    return;
  }

  if (cmd === "get") {
    const id = a._[1]; const out = a.out;
    if (!id || !out) { console.error("get needs <id> --out public/video/<name>.mp4"); process.exit(2); }
    const spot = SPOTS[a.spot] ? a.spot : "background";
    const src = forced || (connected().length === 1 ? connected()[0] : null);
    if (!src) { console.error(`get needs --source (${connected().map((s) => s.id).join(" / ")}): name the library the search reported.`); process.exit(2); }
    const abs = path.resolve(ROOT, out);
    if (!abs.startsWith(path.join(ROOT, "public", "video") + path.sep)) { console.error("--out must be under public/video/"); process.exit(2); }
    if (!/\.mp4$/i.test(abs)) { console.error("--out must end in .mp4"); process.exit(2); }

    const v = await src.take(id);
    if (!v.sizes || !v.sizes.length) { console.error(`${src.label} video ${id}: no MP4 rendition available. Pick another candidate.`); process.exit(5); }
    const { rung, bytes, overCap } = await pickRung(v.sizes, spot);

    // The clip. The CDN fetch isn't rate-limited; only the API calls are counted.
    const res = await fetch(rung.url);
    if (!res.ok) throw new Error(`${src.label} file ${id}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buf);

    // The poster, always. Without it a reduced-motion visitor and the Figma export both
    // get an empty box, so a poster that won't fetch fails the whole take.
    const posterPath = abs.replace(/\.mp4$/i, ".poster.avif");
    let posterFile = null;
    try {
      const p = await fetch(v.poster);
      if (!p.ok) throw new Error(`HTTP ${p.status}`);
      posterFile = await writeImage(Buffer.from(await p.arrayBuffer()), posterPath);
    } catch (e) {
      try { fs.unlinkSync(abs); } catch {}
      console.error(`${src.label} video ${id}: the poster still could not be fetched (${e.message}). A video without a poster would be blank for reduced motion and in the Figma export, so nothing was written. Pick another candidate, or use a still image for this spot.`);
      process.exit(1);
    }

    const credit = {
      source: `${src.id}.com`, url: v.html, free: true,
      author: v.user.name, authorUrl: v.user.html,
      description: v.description, poster: path.basename(posterFile),
    };
    const n = recordCredit(ROOT, path.basename(abs), credit, "video");
    console.log(JSON.stringify({
      source: src.id,
      file: `/video/${path.basename(abs)}`,
      poster: `/video/${path.basename(posterFile)}`,
      spot, width: rung.width, height: rung.height, duration: v.duration,
      bytes: buf.length, size: mb(buf.length),
      overCap: overCap || buf.length > SPOTS[spot].cap,
      note: (overCap || buf.length > SPOTS[spot].cap)
        ? `This is ${mb(buf.length)}, over the ${mb(SPOTS[spot].cap)} guide for a ${SPOTS[spot].label}. Say so in the wrap-up so the designer can decide.`
        : undefined,
      credit, credits: n,
    }, null, 1));
    return;
  }

  console.error("usage: find-video.mjs search <query> [--source pexels|pixabay|auto] [--orientation ..] [--min-duration 4] [--max-duration 30] [--per 8] | get <id> --source <the search's source> --out public/video/<name>.mp4 [--spot background|figure] | status");
  process.exit(2);
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  // exit 3: no video library connected; 4: every library's budget is spent; 5: nothing
  // matched (3/4/5 all mean: build the spot with a still image); 1: other errors.
  main().catch((e) => { console.error(e.message || String(e)); process.exit(e instanceof BudgetError ? 4 : 1); });
}
