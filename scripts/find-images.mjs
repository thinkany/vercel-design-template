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
// Sources: Unsplash (UNSPLASH_ACCESS_KEY), Pexels (PEXELS_API_KEY) and Pixabay
// (PIXABAY_API_KEY), the designer's own keys from Keys & Licenses.
// `--source unsplash|pexels|pixabay|auto` (default auto: each search walks the connected
// libraries in order, Unsplash → Pexels → Pixabay, and the first one with budget and a
// result answers). Colour hints: Unsplash black_and_white, black, white, yellow, orange,
// red, purple, magenta, green, teal, blue; Pexels red, orange, yellow, green, turquoise,
// blue, violet, pink, brown, black, gray, white, or a hex colour; Pixabay grayscale,
// transparent, red, orange, yellow, green, turquoise, blue, lilac, pink, white, gray,
// black, brown.
import path from "node:path";
import {
  api, budgetLeft, cacheItems, cachedItem, cascade, BudgetError,
  orientationOf, utm, recordCredit, writeImage, args, statusOf,
} from "./lib/stock-budget.mjs";

const ROOT = process.cwd();
export { recordCredit, writeImage, BudgetError };

const SOURCES = {
  unsplash: {
    id: "unsplash",
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
      const res = await api("unsplash", "Unsplash", u, { Authorization: `Client-ID ${this.key()}`, "Accept-Version": "v1" });
      if (!res.ok) throw new Error(`Unsplash search: HTTP ${res.status}${res.status === 401 ? " (the key was rejected)" : res.status === 403 ? " (rate limit reached, try again in an hour)" : ""}`);
      const data = await res.json();
      // Keep what `get` needs, so taking a photo costs one call (the download ping), not two.
      cacheItems("unsplash", "photos", (data.results || []).map((p) => ({ id: p.id, raw: p.urls && p.urls.raw, download_location: p.links && p.links.download_location, html: p.links && p.links.html, description: p.description || p.alt_description || "", user: { name: p.user && p.user.name || "", html: p.user && p.user.links && p.user.links.html || "" } })));
      return (data.results || []).map((p) => ({
        id: p.id,
        description: p.description || "",
        alt: p.alt_description || "",
        color: p.color || "",
        width: p.width, height: p.height,
        orientation: orientationOf(p.width, p.height),
        photographer: p.user && p.user.name || "",
        thumb: p.urls && p.urls.thumb || "",
      }));
    },
    async take(id, width) {
      const h = { Authorization: `Client-ID ${this.key()}`, "Accept-Version": "v1" };
      let p = cachedItem("unsplash", "photos", id);
      if (!p) {
        const res = await api("unsplash", "Unsplash", `https://api.unsplash.com/photos/${encodeURIComponent(id)}`, h);
        if (!res.ok) throw new Error(`Unsplash photo ${id}: HTTP ${res.status}`);
        const j = await res.json();
        p = { id, raw: j.urls.raw, download_location: j.links.download_location, html: j.links.html, description: j.description || j.alt_description || "", user: { name: j.user && j.user.name || "", html: j.user && j.user.links && j.user.links.html || "" } };
      }
      // The terms: trigger the download endpoint whenever a copy is taken (one counted call).
      if (p.download_location) { try { await api("unsplash", "Unsplash", p.download_location, h); } catch (e) { if (e instanceof BudgetError) throw e; } }
      const u = new URL(p.raw);
      u.searchParams.set("w", String(width)); u.searchParams.set("q", "85"); u.searchParams.set("fm", "jpg"); u.searchParams.set("fit", "max");
      const img = await fetch(u);
      if (!img.ok) throw new Error(`Unsplash file ${id}: HTTP ${img.status}`);
      return {
        bytes: Buffer.from(await img.arrayBuffer()),
        credit: { source: "unsplash.com", url: utm(p.html), free: true, author: p.user.name, authorUrl: utm(p.user.html), description: p.description },
      };
    },
  },
  pexels: {
    id: "pexels",
    key: () => (process.env.PEXELS_API_KEY || "").trim(),
    keyName: "PEXELS_API_KEY",
    label: "Pexels",
    async search({ query, orientation, color, per, page }) {
      const u = new URL("https://api.pexels.com/v1/search");
      u.searchParams.set("query", query);
      u.searchParams.set("per_page", String(per));
      u.searchParams.set("page", String(page));
      if (orientation) u.searchParams.set("orientation", orientation === "squarish" ? "square" : orientation);
      if (color) u.searchParams.set("color", color);
      const res = await api("pexels", "Pexels", u, { Authorization: this.key() });
      if (!res.ok) throw new Error(`Pexels search: HTTP ${res.status}${res.status === 401 ? " (the key was rejected)" : res.status === 429 ? " (rate limit reached, try again in an hour)" : ""}`);
      const data = await res.json();
      // Everything `get` needs comes with the search, so taking a Pexels photo costs no call.
      cacheItems("pexels", "photos", (data.photos || []).map((p) => ({ id: String(p.id), original: p.src && p.src.original, html: p.url, description: p.alt || "", user: { name: p.photographer || "", html: p.photographer_url || "" } })));
      return (data.photos || []).map((p) => ({
        id: String(p.id),
        description: "",
        alt: p.alt || "",
        color: p.avg_color || "",
        width: p.width, height: p.height,
        orientation: orientationOf(p.width, p.height),
        photographer: p.photographer || "",
        thumb: p.src && p.src.tiny || "",
      }));
    },
    async take(id, width) {
      let p = cachedItem("pexels", "photos", id);
      if (!p) {
        const res = await api("pexels", "Pexels", `https://api.pexels.com/v1/photos/${encodeURIComponent(id)}`, { Authorization: this.key() });
        if (!res.ok) throw new Error(`Pexels photo ${id}: HTTP ${res.status}`);
        const j = await res.json();
        p = { id: String(j.id), original: j.src && j.src.original, html: j.url, description: j.alt || "", user: { name: j.photographer || "", html: j.photographer_url || "" } };
      }
      // The file host takes sizing parameters; the CDN fetch isn't rate-limited.
      const u = new URL(p.original);
      u.searchParams.set("w", String(width)); u.searchParams.set("auto", "compress"); u.searchParams.set("cs", "tinysrgb");
      const img = await fetch(u);
      if (!img.ok) throw new Error(`Pexels file ${id}: HTTP ${img.status}`);
      return {
        bytes: Buffer.from(await img.arrayBuffer()),
        credit: { source: "pexels.com", url: p.html, free: true, author: p.user.name, authorUrl: p.user.html, description: p.description },
      };
    },
  },
  pixabay: {
    id: "pixabay",
    key: () => (process.env.PIXABAY_API_KEY || "").trim(),
    keyName: "PIXABAY_API_KEY",
    label: "Pixabay",
    async search({ query, orientation, color, per, page }) {
      const u = new URL("https://pixabay.com/api/");
      u.searchParams.set("key", this.key());
      u.searchParams.set("q", query);
      // Pixabay wants 3-200; anything smaller comes back as a validation error.
      u.searchParams.set("per_page", String(Math.max(3, per)));
      u.searchParams.set("page", String(page));
      u.searchParams.set("image_type", "photo");
      u.searchParams.set("safesearch", "true");
      if (orientation) u.searchParams.set("orientation", orientation === "landscape" ? "horizontal" : orientation === "portrait" ? "vertical" : "all");
      if (color) u.searchParams.set("colors", color);
      const res = await api("pixabay", "Pixabay", u, {});
      if (!res.ok) throw new Error(`Pixabay search: HTTP ${res.status}${res.status === 400 ? " (the key was rejected, or the query was invalid)" : res.status === 429 ? " (rate limit reached, try again shortly)" : ""}`);
      const data = await res.json();
      // largeImageURL is a fixed 1280px-max render; fullHD/imageURL need a paid plan, so
      // `get` takes the large one and lets sharp do the rest.
      cacheItems("pixabay", "photos", (data.hits || []).map((p) => ({ id: String(p.id), large: p.largeImageURL, html: p.pageURL, description: p.tags || "", user: { name: p.user || "", html: p.user_id ? `https://pixabay.com/users/${p.user}-${p.user_id}/` : "" } })));
      return (data.hits || []).map((p) => ({
        id: String(p.id),
        description: p.tags || "",
        alt: p.tags || "",
        color: "",
        width: p.imageWidth, height: p.imageHeight,
        orientation: orientationOf(p.imageWidth, p.imageHeight),
        photographer: p.user || "",
        thumb: p.previewURL || "",
      }));
    },
    async take(id) {
      let p = cachedItem("pixabay", "photos", id);
      if (!p) {
        const u = new URL("https://pixabay.com/api/");
        u.searchParams.set("key", this.key());
        u.searchParams.set("id", String(id));
        const res = await api("pixabay", "Pixabay", u, {});
        if (!res.ok) throw new Error(`Pixabay photo ${id}: HTTP ${res.status}`);
        const j = await res.json();
        const hit = (j.hits || [])[0];
        if (!hit) throw new Error(`Pixabay photo ${id}: not found`);
        p = { id: String(hit.id), large: hit.largeImageURL, html: hit.pageURL, description: hit.tags || "", user: { name: hit.user || "", html: hit.user_id ? `https://pixabay.com/users/${hit.user}-${hit.user_id}/` : "" } };
      }
      // Their terms ask that the CDN isn't hotlinked, which is what we want anyway: the
      // file comes down into public/ like every other source. No sizing params here.
      const img = await fetch(p.large);
      if (!img.ok) throw new Error(`Pixabay file ${id}: HTTP ${img.status}`);
      return {
        bytes: Buffer.from(await img.arrayBuffer()),
        credit: { source: "pixabay.com", url: p.html, free: true, author: p.user.name, authorUrl: p.user.html, description: p.description },
      };
    },
  },
};
// The order a search walks: best-curated first, widest last.
const ORDER = ["unsplash", "pexels", "pixabay"];
const inOrder = () => ORDER.map((id) => SOURCES[id]);
const connected = () => inOrder().filter((s) => s.key());

async function main() {
  const a = args(process.argv.slice(2));
  const cmd = a._[0];
  if (cmd === "status") { console.log(JSON.stringify(statusOf(inOrder()))); return; }
  const forced = a.source && a.source !== "auto" ? SOURCES[a.source] : null;
  if (a.source && a.source !== "auto" && !forced) { console.error(`Unknown source "${a.source}". Sources: ${ORDER.join(", ")}, auto`); process.exit(2); }
  if (!connected().length) { console.error(`No image library is connected (${inOrder().map((s) => s.keyName).join(" / ")}). The designer adds a key under Keys & Licenses (Unsplash, Pexels or Pixabay, all optional). Use the plain sourcing path instead.`); process.exit(3); }
  if (forced && !forced.key()) { console.error(`${forced.label} isn't connected (${forced.keyName}). Use --source auto, or another library.`); process.exit(3); }

  if (cmd === "search") {
    const query = a._.slice(1).join(" ").trim();
    if (!query) { console.error("search needs a query"); process.exit(2); }
    const params = { query, orientation: a.orientation, color: a.color, per: Math.min(30, parseInt(a.per || "8", 10) || 8), page: parseInt(a.page || "1", 10) || 1 };
    // Per request, not per project: a library with no budget, no match or a bad moment
    // hands this one query to the next in line.
    const hit = await cascade(forced ? [forced] : inOrder(), async (src) => ({ source: src.id, query, results: await src.search(params) }));
    if (!hit) {
      const spent = connected().every((s) => !budgetLeft(s.id));
      console.error(spent
        ? "Every connected library's budget is spent for this window. Use the plain sourcing path for the remaining spots."
        : "No library had a match for that query. Try a reworded query once, or use the plain sourcing path for this spot.");
      process.exit(spent ? 4 : 5);
    }
    console.log(JSON.stringify(hit, null, 1));
    return;
  }
  if (cmd === "get") {
    const id = a._[1]; const out = a.out;
    if (!id || !out) { console.error("get needs <id> --out public/images/<name>.avif"); process.exit(2); }
    // A `get` must name the library its `search` reported: ids aren't portable between them.
    const src = forced || (connected().length === 1 ? connected()[0] : null);
    if (!src) { console.error(`get needs --source (${connected().map((s) => s.id).join(" / ")}): name the library the search reported.`); process.exit(2); }
    const abs = path.resolve(ROOT, out);
    if (!abs.startsWith(path.join(ROOT, "public", "images") + path.sep)) { console.error("--out must be under public/images/"); process.exit(2); }
    const { bytes, credit } = await src.take(id, Math.min(4000, parseInt(a.width || "2400", 10) || 2400));
    const written = await writeImage(bytes, abs);
    const file = path.basename(written);
    const n = recordCredit(ROOT, file, credit);
    console.log(JSON.stringify({ source: src.id, file: `/images/${file}`, credit, credits: n }));
    return;
  }
  console.error("usage: find-images.mjs search <query> [--source unsplash|pexels|pixabay|auto] [--orientation ..] [--color ..] [--per 8] | get <id> --source <the search's source> --out public/images/<name>.avif [--width 2400] | status");
  process.exit(2);
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  // exit 3: no key; 4: every library's budget is spent; 5: nothing matched anywhere
  // (3/4/5 all mean: use the plain path or a placeholder); 1: other errors.
  main().catch((e) => { console.error(e.message || String(e)); process.exit(e instanceof BudgetError ? 4 : 1); });
}
