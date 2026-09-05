// ©2026 thinkany llc. All rights reserved.
// LENS GALLERY, step 2: turn the curator's picks into the images derive serves. Reads
// picks.json ({ lensId: [ { title: "File:…" } | { local, credit, creditUrl, license, alt } ] }),
// fetches each Commons original (or reads the local file), resizes to 1400px wide, writes
// AVIF to the derive repo's public/lenses/<lens>-<n>.avif, and rewrites
// derive/direction/lens-gallery.json with the credit, license and file page per image.
// Then commit + push derive.
//
//   node desktop/build/lens-gallery/build.mjs
//   DERIVE_REPO=/path/to/derive node desktop/build/lens-gallery/build.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..", "..", "..");
const sharp = createRequire(path.join(appRoot, "package.json"))("sharp");
const deriveRepo = process.env.DERIVE_REPO || path.resolve(appRoot, "..", "derive");
const imgDir = path.join(deriveRepo, "public", "lenses");
const dataFile = path.join(deriveRepo, "direction", "lens-gallery.json");
const API = "https://commons.wikimedia.org/w/api.php";
const UA = "thinkany-design-lens-gallery/1.0 (rob@thinkany.co)";
const WIDTH = 1400, QUALITY = 50;
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
  const picks = JSON.parse(fs.readFileSync(path.join(here, "picks.json"), "utf8"));
  fs.mkdirSync(imgDir, { recursive: true });
  const out = {};
  for (const [lens, items] of Object.entries(picks)) {
    out[lens] = [];
    let n = 0;
    for (const it of items.slice(0, 3)) {
      n++;
      const file = `${lens}-${n}.avif`;
      let buf, rec;
      if (it.local) {
        buf = fs.readFileSync(it.local);
        rec = { file, alt: it.alt || "", credit: it.credit || "thinkany design", creditUrl: it.creditUrl || "", license: it.license || "own work" };
      } else {
        const info = await commonsInfo(it.title);
        buf = Buffer.from(await (await fetch(info.url, { headers: { "User-Agent": UA } })).arrayBuffer());
        rec = { file, alt: it.alt || info.description, credit: it.credit || info.artist || "Wikimedia Commons", creditUrl: info.pageUrl, license: info.license };
      }
      await sharp(buf).rotate().resize({ width: WIDTH, withoutEnlargement: true }).avif({ quality: QUALITY }).toFile(path.join(imgDir, file));
      out[lens].push(rec);
      console.log(`[gallery] ${file}  ${rec.license}  ${rec.credit}`);
    }
  }
  fs.writeFileSync(dataFile, JSON.stringify(out, null, 2) + "\n");
  console.log(`[gallery] wrote ${dataFile} (${Object.keys(out).length} lenses)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
