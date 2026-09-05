// ©2026 thinkany llc. All rights reserved.
// LENS GALLERY, step 1: a shortlist of openly licensed images per lens, from Wikimedia
// Commons, for the curator to pick from. Writes out/shortlist.json + out/shortlist.html
// (a contact sheet: click tiles to pick, copy the picks JSON into picks.json, then run
// build.mjs). Only public-domain, CC0, CC BY and CC BY-SA files are kept, with the
// artist, license and file page so the app can credit and link every image.
//
//   node desktop/build/lens-gallery/shortlist.mjs            # every lens
//   node desktop/build/lens-gallery/shortlist.mjs bauhaus    # one lens
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "out");
const API = "https://commons.wikimedia.org/w/api.php";
const UA = "thinkany-design-lens-gallery/1.0 (rob@thinkany.co)";

// Search terms per lens: two or three phrases each, tuned to the movement's canon
// where one exists and to evocative material where it doesn't.
const TERMS = {
  "corporate-confident": ["Paul Rand IBM", "Olivetti poster", "office building lobby glass", "Seagram Building"],
  "swiss": ["Josef Müller-Brockmann poster", "Swiss style poster grid", "Armin Hofmann poster"],
  "editorial": ["magazine cover 1950s", "Vogue cover 1930s", "newspaper front page 1960s", "Life magazine cover"],
  "boutique-minimal": ["minimalist white interior gallery", "minimal typography poster white", "luxury boutique interior"],
  "warm-humanist": ["Eric Gill lettering", "hand painted shop sign", "Frutiger typeface", "children book illustration 1960s"],
  "gallery-curatorial": ["art museum gallery interior white wall", "exhibition space paintings hung", "Kunsthalle interior"],
  "type-forward": ["letterpress wood type poster", "typographic poster 1960s", "Massin typography", "Hamilton Wood Type"],
  "neo-retro": ["1970s poster design", "record sleeve 1970s", "vintage motel sign"],
  "monospace-terminal": ["computer terminal screen green", "teletype printout", "IBM keypunch"],
  "brutalist": ["brutalist architecture concrete", "Barbican Estate", "Boston City Hall brutalism"],
  "organic-handbuilt": ["hand-thrown pottery workshop", "linocut print illustration", "handmade paper texture"],
  "playful-toybox": ["wooden toy blocks primary colors", "children's playground colorful", "Fisher-Price toy vintage"],
  "maximalist": ["Victorian broadside poster typography", "collage poster dense", "Baroque ornament interior"],
  "techno-futurist": ["circuit board macro", "neon futuristic corridor", "server room blue light"],
  "glass-soft": ["frosted glass gradient", "translucent glass facade architecture", "dichroic glass"],
  "eco-natural": ["linen fabric texture", "botanical illustration plate", "moss forest floor"],
  "data-utility": ["railway timetable table", "Harry Beck tube map", "control panel switches gauges"],
  "bauhaus": ["Bauhaus poster", "Herbert Bayer typography", "Bauhaus Dessau building"],
  "mid-century-modern": ["Eames lounge chair", "1950s advertisement illustration", "Case Study House"],
  "art-deco": ["Art Deco poster", "Chrysler Building crown", "Art Deco interior gold"],
  "memphis": ["Memphis Group Sottsass", "Carlton bookcase Sottsass", "Memphis design 1980s"],
  "constructivist": ["Rodchenko poster", "El Lissitzky", "Stenberg brothers film poster"],
  "de-stijl": ["Mondrian Composition", "Rietveld Schröder House", "Theo van Doesburg"],
  "art-nouveau": ["Alphonse Mucha poster", "Guimard Métro entrance", "Art Nouveau ornament"],
  "psychedelic": ["psychedelic poster", "Victor Moscoso", "Avalon Ballroom poster", "psychedelic art 1960s"],
  "y2k-futurist": ["iMac G3", "chrome 3D render", "translucent plastic 1999"],
  "pop-art": ["Roy Lichtenstein", "benday dots", "Andy Warhol Campbell's"],
  "wabi-sabi": ["wabi-sabi tea bowl", "kintsugi", "Japanese tea house interior"],
  "op-art": ["Bridget Riley", "Victor Vasarely", "op art pattern black white"],
};
const OK_LICENSE = /^(public domain|cc0|cc by(-sa)?( \d(\.\d)?)?|pd)/i;

async function api(params) {
  const url = API + "?" + new URLSearchParams({ format: "json", origin: "*", ...params });
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}
const strip = (html) => String(html || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function candidates(term) {
  const j = await api({ action: "query", generator: "search", gsrsearch: term, gsrnamespace: 6, gsrlimit: 15, prop: "imageinfo", iiprop: "url|extmetadata|size|mime", iiurlwidth: 480 });
  const pages = Object.values((j.query && j.query.pages) || {});
  const out = [];
  for (const p of pages) {
    const ii = p.imageinfo && p.imageinfo[0]; if (!ii) continue;
    if (!/^image\/(jpeg|png)$/.test(ii.mime || "")) continue;
    if ((ii.width || 0) < 1000) continue;
    const md = ii.extmetadata || {};
    const license = strip(md.LicenseShortName && md.LicenseShortName.value);
    if (!OK_LICENSE.test(license)) continue;
    out.push({
      title: p.title, pageUrl: ii.descriptionurl, thumb: ii.thumburl, width: ii.width, height: ii.height,
      license, artist: strip(md.Artist && md.Artist.value).slice(0, 80), credit: strip(md.Credit && md.Credit.value).slice(0, 80),
      description: strip(md.ImageDescription && md.ImageDescription.value).slice(0, 160), term,
    });
  }
  return out;
}

async function main() {
  const only = process.argv[2];
  const ids = Object.keys(TERMS).filter((id) => !only || id === only);
  fs.mkdirSync(outDir, { recursive: true });
  const shortlist = {};
  for (const id of ids) {
    const seen = new Set(); const list = [];
    for (const term of TERMS[id]) {
      try { for (const c of await candidates(term)) { if (!seen.has(c.title)) { seen.add(c.title); list.push(c); } } }
      catch (e) { console.warn(`[shortlist] ${id} "${term}": ${e.message}`); }
      await new Promise((r) => setTimeout(r, 250));
    }
    shortlist[id] = list.slice(0, 18);
    console.log(`[shortlist] ${id}: ${shortlist[id].length} candidates`);
  }
  fs.writeFileSync(path.join(outDir, "shortlist.json"), JSON.stringify(shortlist, null, 2));
  fs.writeFileSync(path.join(outDir, "shortlist.html"), sheet(shortlist));
  console.log(`[shortlist] wrote ${path.join(outDir, "shortlist.html")}`);
}

function sheet(shortlist) {
  const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const lenses = Object.entries(shortlist).map(([id, list]) => `
    <section><h2>${esc(id)} <small>${list.length} candidates, pick up to 3</small></h2><div class="grid">${list.map((c) => `
      <figure data-lens="${esc(id)}" data-title="${esc(c.title)}" title="${esc(c.description)}">
        <img src="${esc(c.thumb)}" loading="lazy" alt="">
        <figcaption><b>${esc(c.license)}</b> ${esc(c.artist || c.credit)}<br><a href="${esc(c.pageUrl)}" target="_blank">file page</a> · ${c.width}×${c.height}</figcaption>
      </figure>`).join("")}</div></section>`).join("");
  return `<!doctype html><meta charset="utf-8"><title>Lens gallery shortlist</title>
<style>body{font:13px/1.4 -apple-system,Helvetica,Arial,sans-serif;margin:0;padding:20px 24px 80px;color:#222}h2{margin:28px 0 8px;font-size:16px}h2 small{color:#777;font-weight:400;margin-left:8px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}figure{margin:0;border:2px solid #e5e5e5;border-radius:8px;overflow:hidden;cursor:pointer;background:#fafafa}figure.on{border-color:#111}
figure img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}figcaption{padding:6px 8px;font-size:11px;color:#444}a{color:#06c}
#bar{position:fixed;top:0;left:0;right:0;background:#111;color:#fff;padding:10px 24px;display:flex;gap:12px;align-items:center;z-index:9}#bar textarea{flex:1;height:34px;font:11px monospace}#bar button{padding:6px 12px}</style>
<div id="bar"><b>Picks</b><textarea id="picks" readonly>{}</textarea><button id="copy">Copy picks JSON</button><span id="n">0 picked</span></div><div style="height:60px"></div>
<p>Click tiles to pick up to three per lens. Copy the JSON into <code>desktop/build/lens-gallery/picks.json</code>, then run <code>node desktop/build/lens-gallery/build.mjs</code>. Local screenshots can be added to picks.json by hand as <code>{"local":"/path.png","credit":"thinkany design","license":"own work"}</code>.</p>
${lenses}
<script>
const picks={};const ta=document.getElementById('picks');const n=document.getElementById('n');
const paint=()=>{ta.value=JSON.stringify(Object.fromEntries(Object.entries(picks).filter(([,v])=>v.length).map(([k,v])=>[k,v.map(t=>({title:t}))])),null,1);n.textContent=Object.values(picks).reduce((a,v)=>a+v.length,0)+' picked';};
document.querySelectorAll('figure').forEach(f=>f.addEventListener('click',()=>{const l=f.dataset.lens,t=f.dataset.title;picks[l]=picks[l]||[];const i=picks[l].indexOf(t);if(i>=0){picks[l].splice(i,1);f.classList.remove('on');}else{if(picks[l].length>=3)return;picks[l].push(t);f.classList.add('on');}paint();}));
document.getElementById('copy').addEventListener('click',()=>{ta.select();document.execCommand('copy');});paint();
</script>`;
}
main().catch((e) => { console.error(e); process.exit(1); });
