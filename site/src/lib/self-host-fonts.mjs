// ©2026 thinkany llc. All rights reserved.
// SELF-HOSTED WEBFONTS (CORE). The design's fonts arrive as Google Fonts @imports
// (fonts.css, tokens.css). Served that way, a visitor's browser must fetch the
// page, then the CSS, then Google's CSS, then the font files: four hops before
// the brand type appears, hence the flash of fallback text. This integration
// downloads the font files once at build (and at dev start), writes them to
// public/fonts with a local @font-face sheet, preloads the display and body
// faces, and strips the remote @imports, so the fonts come from the site's own
// origin in the first round trip. Offline or blocked: it warns and the Google
// @imports stay in place, so nothing breaks.
import fs from "node:fs";
import path from "node:path";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"; // → woff2 + unicode-range subsets
const IMPORT_RE = /@import\s+url\(\s*['"]?(https:\/\/fonts\.googleapis\.com\/css2?\?[^'")]+)['"]?\s*\)\s*;?/g;

/** The Google Fonts URLs a design's styles import (fonts.css + tokens.css). */
export function googleFontUrls(stylesDir) {
  const urls = new Set();
  for (const f of ["fonts.css", "tokens.css"]) {
    try { for (const m of fs.readFileSync(path.join(stylesDir, f), "utf8").matchAll(IMPORT_RE)) urls.add(m[1].replace(/&amp;/g, "&")); } catch {}
  }
  return [...urls];
}

// The families behind the design's font roles ("--ta-font-display: 'Fraunces', …").
function roleFamilies(stylesDir) {
  const out = {};
  try {
    const t = fs.readFileSync(path.join(stylesDir, "tokens.css"), "utf8");
    for (const m of t.matchAll(/--ta-font-(display|serif|sans|mono):\s*'([^']+)'/g)) out[m[1]] = m[2];
  } catch {}
  return out;
}
const coversWeight = (w, want) => { const n = String(w).trim().split(/\s+/).map(Number); return n.length > 1 ? want >= n[0] && want <= n[1] : n[0] === want; };

/** Download + write; returns the manifest, or null when the design imports no Google Fonts. */
export async function selfHost({ repoRoot, stylesDir, log = () => {} }) {
  const urls = googleFontUrls(stylesDir);
  if (!urls.length) return null;
  const outDir = path.join(repoRoot, "public", "fonts");
  const manifestPath = path.join(outDir, "manifest.json");
  try {
    const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (m && JSON.stringify(m.urls) === JSON.stringify(urls) && fs.existsSync(path.join(outDir, "fonts.css")) && (m.faces || []).every((f) => fs.existsSync(path.join(repoRoot, "public", f.file)))) return m; // current
  } catch {}
  fs.mkdirSync(outDir, { recursive: true });
  // Only the families the design USES (its --ta-font-* roles): the design phase imports
  // many candidates for the styleguide picker, and the site needn't carry those.
  const roles = roleFamilies(stylesDir);
  const wanted = new Set(Object.values(roles));
  const faces = []; let css = "";
  for (const url of urls) {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/css,*/*;q=0.1" } });
    if (!res.ok) throw new Error(`Google Fonts answered ${res.status}`);
    const text = await res.text();
    const re = /(?:\/\*\s*([\w-]+)\s*\*\/\s*)?(@font-face\s*\{[^}]*\})/g;
    for (const m of text.matchAll(re)) {
      const subset = m[1] || ""; const block = m[2];
      const family = (block.match(/font-family:\s*'([^']+)'/) || [])[1] || "";
      if (wanted.size && !wanted.has(family)) continue;
      const src = (block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/) || [])[1];
      if (!src) continue;
      const file = path.basename(new URL(src).pathname);
      const dest = path.join(outDir, file);
      if (!fs.existsSync(dest)) {
        const r = await fetch(src, { headers: { "user-agent": UA } });
        if (!r.ok) throw new Error(`font file answered ${r.status}`);
        fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
      }
      let local = block.replace(src, `/fonts/${file}`);
      local = /font-display/.test(local) ? local.replace(/font-display:\s*\w+;/, "font-display: swap;") : local.replace(/\}\s*$/, "  font-display: swap;\n}");
      css += (subset ? `/* ${subset} */\n` : "") + local + "\n";
      faces.push({
        family,
        style: (block.match(/font-style:\s*(\w+)/) || [])[1] || "normal",
        weight: (block.match(/font-weight:\s*([\d\s]+);/) || [])[1] || "400",
        subset, file: `/fonts/${file}`,
      });
    }
  }
  // Preload the latin, upright, regular-weight face of the display and body families.
  const preload = [];
  for (const role of ["display", "sans", "serif"]) {
    const fam = roles[role]; if (!fam) continue;
    const c = faces.filter((f) => f.family === fam && f.style === "normal" && (f.subset === "latin" || !f.subset));
    const pick = c.find((f) => coversWeight(f.weight, 400)) || c[0];
    if (pick && !preload.includes(pick.file)) preload.push(pick.file);
  }
  // Files from an earlier design that nothing references any more.
  const keep = new Set(faces.map((f) => path.basename(f.file)));
  for (const f of fs.readdirSync(outDir)) if (/\.woff2?$/.test(f) && !keep.has(f)) { try { fs.unlinkSync(path.join(outDir, f)); } catch {} }
  fs.writeFileSync(path.join(outDir, "fonts.css"), "/* Generated by the site build: this design's Google Fonts, self-hosted. Rebuilt when the design's fonts change; do not edit. */\n" + css);
  const manifest = { urls, faces, preload, generatedAt: new Date().toISOString() };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  log(`${faces.length} font face(s) self-hosted in public/fonts, ${preload.length} preloaded`);
  return manifest;
}

/** The Astro integration: self-host at config time, strip the remote @imports while hosted. */
export default function selfHostFonts({ repoRoot, stylesDir }) {
  let hosted = false;
  return {
    name: "thinkany:self-host-fonts",
    hooks: {
      "astro:config:setup": async ({ logger, updateConfig }) => {
        let manifest = null;
        try { manifest = await selfHost({ repoRoot, stylesDir, log: (m) => logger.info(m) }); hosted = !!manifest; }
        catch (e) { hosted = false; logger.warn(`fonts: not self-hosted (${e.message}); Google Fonts load directly`); }
        // The layout reads these at render (Base.astro): the preload list, or null.
        updateConfig({ vite: { define: { __TA_FONT_PRELOAD__: JSON.stringify(manifest ? manifest.preload : null) }, plugins: [{
          name: "thinkany:strip-google-fonts", enforce: "pre",
          transform(code, id) {
            if (!hosted || !/[\\/]styles[\\/](fonts|tokens)\.css(\?|$)/.test(id)) return;
            return { code: code.replace(IMPORT_RE, "/* self-hosted: /fonts/fonts.css */"), map: null };
          },
        }] } });
      },
    },
  };
}
