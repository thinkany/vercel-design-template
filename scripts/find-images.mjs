// ©2026 thinkany llc. All rights reserved.
// find-images.mjs — source photos for a design from a stock library (CORE).
//
//   node scripts/find-images.mjs search "<query>" [--orientation landscape|portrait|squarish]
//                                                  [--color <hint>] [--per 8] [--page 1]
//   node scripts/find-images.mjs get <id> --source pexels|pixabay --out public/images/<name>.avif [--width 2400]
//   node scripts/find-images.mjs get <id> --source unsplash [--width 2400]      → a hotlinked src
//   node scripts/find-images.mjs status
//
// `search` prints JSON candidates: id, a description and alt text, the dominant colour,
// size and orientation, the photographer, and a small thumb URL (for a look, if wanted).
// `get` takes one candidate. From Pexels or Pixabay it lands in public/images as AVIF
// (JPG when sharp is unavailable). From Unsplash it is NOT copied: Unsplash's terms ask
// that photos are shown from their CDN, so `get` returns a sized `src` (and a `srcset`)
// on images.unsplash.com to use as-is, after triggering the download endpoint. Either
// way the attribution lands in public/images/credits.json (keyed by the file, or by the
// hotlinked URL) with the photographer and links for the site to show.
//
// Sources: Unsplash (UNSPLASH_ACCESS_KEY: minted by Connect with Unsplash, or the
// designer's own), Pexels (PEXELS_API_KEY) and Pixabay (PIXABAY_API_KEY) from Keys & Licenses.
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

// The library endpoints. TA_STOCK_TEST_BASE points them at a local stub for
// desktop/dev/find-images.test.mjs; unset (always, in a real project) they are the
// libraries themselves.
const TEST_BASE = process.env.TA_STOCK_TEST_BASE || "";
const UNSPLASH_API = TEST_BASE ? `${TEST_BASE}/unsplash` : "https://api.unsplash.com";
const PEXELS_API = TEST_BASE ? `${TEST_BASE}/pexels/v1` : "https://api.pexels.com/v1";
const PIXABAY_API = TEST_BASE ? `${TEST_BASE}/pixabay/api/` : "https://pixabay.com/api/";

// A hotlinked Unsplash photo at a width: their CDN (imgix) sizes on the fly, `auto=format`
// serves AVIF/WebP to browsers that take it, and `ixid` (kept from `raw`) is the view
// attribution their terms want.
export function unsplashSrc(raw, width) {
  const u = new URL(raw);
  u.searchParams.set("w", String(width));
  u.searchParams.set("auto", "format");
  u.searchParams.set("fit", "max");
  u.searchParams.set("q", "80");
  return u.toString();
}
const SRCSET_WIDTHS = [640, 1024, 1600, 2400];

const SOURCES = {
  unsplash: {
    id: "unsplash",
    key: () => (process.env.UNSPLASH_ACCESS_KEY || "").trim(),
    keyName: "UNSPLASH_ACCESS_KEY",
    label: "Unsplash",
    hotlink: true, // shown from Unsplash's CDN, never copied into public/ (their terms)
    async search({ query, orientation, color, per, page }) {
      const u = new URL(`${UNSPLASH_API}/search/photos`);
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
        const res = await api("unsplash", "Unsplash", `${UNSPLASH_API}/photos/${encodeURIComponent(id)}`, h);
        if (!res.ok) throw new Error(`Unsplash photo ${id}: HTTP ${res.status}`);
        const j = await res.json();
        p = { id, raw: j.urls.raw, download_location: j.links.download_location, html: j.links.html, description: j.description || j.alt_description || "", user: { name: j.user && j.user.name || "", html: j.user && j.user.links && j.user.links.html || "" } };
      }
      // The terms: trigger the download endpoint whenever a photo is used (one counted
      // call), and show the photo from their CDN rather than a copy. So no bytes here:
      // a sized `src` plus a `srcset` for the design to hotlink.
      if (p.download_location) { try { await api("unsplash", "Unsplash", p.download_location, h); } catch (e) { if (e instanceof BudgetError) throw e; } }
      const src = unsplashSrc(p.raw, width);
      const srcset = SRCSET_WIDTHS.filter((w) => w <= width).map((w) => `${unsplashSrc(p.raw, w)} ${w}w`).join(", ");
      return {
        src, srcset,
        credit: { source: "unsplash.com", url: utm(p.html), free: true, hotlinked: true, author: p.user.name, authorUrl: utm(p.user.html), description: p.description },
      };
    },
  },
  pexels: {
    id: "pexels",
    key: () => (process.env.PEXELS_API_KEY || "").trim(),
    keyName: "PEXELS_API_KEY",
    label: "Pexels",
    async search({ query, orientation, color, per, page }) {
      const u = new URL(`${PEXELS_API}/search`);
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
        const res = await api("pexels", "Pexels", `${PEXELS_API}/photos/${encodeURIComponent(id)}`, { Authorization: this.key() });
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
      const u = new URL(PIXABAY_API);
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
        const u = new URL(PIXABAY_API);
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
    if (!id) { console.error("get needs <id>"); process.exit(2); }
    // A `get` must name the library its `search` reported: ids aren't portable between them.
    const lib = forced || (connected().length === 1 ? connected()[0] : null);
    if (!lib) { console.error(`get needs --source (${connected().map((s) => s.id).join(" / ")}): name the library the search reported.`); process.exit(2); }
    const width = Math.min(4000, parseInt(a.width || "2400", 10) || 2400);
    if (lib.hotlink) {
      // Nothing lands in public/: the photo is shown from the library's CDN. The credit
      // is keyed by that URL, and `--out` is ignored (with a note, not a failure).
      const { src, srcset, credit } = await lib.take(id, width);
      // Keyed by the photo (its CDN path, without our sizing), so taking it again at
      // another width updates one entry; `src` carries the last size handed out.
      const key = new URL(src);
      const n = recordCredit(ROOT, `${key.origin}${key.pathname}`, { ...credit, src });
      console.log(JSON.stringify({ source: lib.id, hotlinked: true, src, srcset, credit, credits: n, note: `${lib.label} photos are shown from ${lib.label}'s CDN (their terms): use src as the image's src${out ? "; --out was ignored" : ""}.` }));
      return;
    }
    if (!out) { console.error(`get from ${lib.label} needs --out public/images/<name>.avif`); process.exit(2); }
    const abs = path.resolve(ROOT, out);
    if (!abs.startsWith(path.join(ROOT, "public", "images") + path.sep)) { console.error("--out must be under public/images/"); process.exit(2); }
    const { bytes, credit } = await lib.take(id, width);
    const written = await writeImage(bytes, abs);
    const file = path.basename(written);
    const n = recordCredit(ROOT, file, credit);
    console.log(JSON.stringify({ source: lib.id, file: `/images/${file}`, credit, credits: n }));
    return;
  }
  console.error("usage: find-images.mjs search <query> [--source unsplash|pexels|pixabay|auto] [--orientation ..] [--color ..] [--per 8] | get <id> --source <the search's source> [--out public/images/<name>.avif, not for unsplash] [--width 2400] | status");
  process.exit(2);
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  // exit 3: no key; 4: every library's budget is spent; 5: nothing matched anywhere
  // (3/4/5 all mean: use the plain path or a placeholder); 1: other errors.
  main().catch((e) => { console.error(e.message || String(e)); process.exit(e instanceof BudgetError ? 4 : 1); });
}
