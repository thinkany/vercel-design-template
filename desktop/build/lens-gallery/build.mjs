// ©2026 thinkany llc. All rights reserved.
// LENS GALLERY, step 2: turn the curator's picks into the images derive serves. Reads
// picks.json ({ lensId: [ { title: "File:…" } | { local, credit, creditUrl, license, alt } ] }),
// fetches each Commons original (or reads the local file), writes AVIF to the derive repo's
// public/lenses/: <lens>-<n>.avif (1200px, the lightbox) and <lens>-<n>-thumb.avif (520px
// 4:3 crop, the picker tile), and rewrites
// derive/direction/lens-gallery.json with the credit, license and file page per image.
// Then commit + push derive.
//
//   node desktop/build/lens-gallery/build.mjs                  # every lens in picks.json
//   node desktop/build/lens-gallery/build.mjs editorial        # one lens; the others keep their records
//   DERIVE_REPO=/path/to/derive node desktop/build/lens-gallery/build.mjs
//
// Each record carries `v`, a short hash of the AVIF bytes, which the app appends to the
// URL, so a replaced image (same file name) is never served from a browser cache.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import crypto from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..", "..", "..");
const sharp = createRequire(path.join(appRoot, "package.json"))("sharp");
const deriveRepo = process.env.DERIVE_REPO || path.resolve(appRoot, "..", "derive");
const imgDir = path.join(deriveRepo, "public", "lenses");
const dataFile = path.join(deriveRepo, "direction", "lens-gallery.json");
const API = "https://commons.wikimedia.org/w/api.php";
const UA = "thinkany-design-lens-gallery/1.0 (rob@thinkany.co)";
const WIDTH = 1200, QUALITY = 45;   // the lightbox image
const THUMB = 520, THUMB_QUALITY = 45; // the picker tile
const strip = (html) => String(html || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function commonsInfo(title) {
  const url = API + "?" + new URLSearchParams({ format: "json", action: "query", titles: title, prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: 2000 });
  const j = await (await fetch(url, { headers: { "User-Agent": UA } })).json();
  const p = Object.values(j.query.pages)[0]; const ii = p && p.imageinfo && p.imageinfo[0];
  if (!ii) throw new Error(`no imageinfo for ${title}`);
  const md = ii.extmetadata || {};
  return {
    url: ii.thumburl || ii.url, pageUrl: ii.descriptionurl,
    artist: strip(md.Artist && md.Artist.value), license: strip(md.LicenseShortName && md.LicenseShortName.value),
    description: strip(md.ImageDescription && md.ImageDescription.value).slice(0, 140),
  };
}

async function main() {
  const only = process.argv[2] || null;
  const picks = JSON.parse(fs.readFileSync(path.join(here, "picks.json"), "utf8"));
  if (only && !picks[only]) throw new Error(`no picks for "${only}"`);
  fs.mkdirSync(imgDir, { recursive: true });
  // One lens: start from the existing records so the rest are untouched.
  const out = only ? (JSON.parse(fs.readFileSync(dataFile, "utf8")) || {}) : {};
  for (const [lens, items] of Object.entries(picks)) {
    if (only && lens !== only) continue;
    out[lens] = [];
    let n = 0;
    for (const it of items.slice(0, 3)) {
      n++;
      const file = `${lens}-${n}.avif`;
      let buf, rec;
      if (it.local) {
        buf = fs.readFileSync(path.isAbsolute(it.local) ? it.local : path.join(here, it.local)); // relative to this folder (examples/<lens>.png)
        rec = { file, alt: it.alt || "", credit: it.credit || "thinkany design", creditUrl: it.creditUrl || "", license: it.license || "own work" };
      } else {
        const info = await commonsInfo(it.title);
        buf = Buffer.from(await (await fetch(info.url, { headers: { "User-Agent": UA } })).arrayBuffer());
        rec = { file, alt: it.alt || info.description, credit: it.credit || info.artist || "Wikimedia Commons", creditUrl: info.pageUrl, license: info.license };
      }
      await sharp(buf).rotate().resize({ width: WIDTH, withoutEnlargement: true }).avif({ quality: QUALITY }).toFile(path.join(imgDir, file));
      const thumb = `${lens}-${n}-thumb.avif`;
      await sharp(buf).rotate().resize({ width: THUMB, height: Math.round(THUMB * 0.75), fit: "cover", withoutEnlargement: true }).avif({ quality: THUMB_QUALITY }).toFile(path.join(imgDir, thumb));
      rec.thumb = thumb;
      rec.v = crypto.createHash("sha1").update(fs.readFileSync(path.join(imgDir, file))).digest("hex").slice(0, 8);
      out[lens].push(rec);
      console.log(`[gallery] ${file}  ${rec.license}  ${rec.credit}`);
    }
  }
  fs.writeFileSync(dataFile, JSON.stringify(out, null, 2) + "\n");
  console.log(`[gallery] wrote ${dataFile} (${Object.keys(out).length} lenses)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
