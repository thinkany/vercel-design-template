// ©2026 thinkany llc. All rights reserved.
// optimize-images.mjs — every raster image the site serves as AVIF (CORE).
//
//   node scripts/optimize-images.mjs [dir] [--quality 55] [--max 2400] [--json] [--dry]
//
// Converts JPG / PNG / WebP / TIFF / HEIC under public/images (default) to AVIF
// beside the original, removes the original, and rewrites references to it in
// src/, content/, site/blocks/ and public/images/credits.json. SVG, GIF and AVIF
// are left alone. Never upscales; auto-orients; strips metadata. The CMS applies
// the same conversion to uploads (desktop/media-convert.cjs), so images from the
// design phase (Claude's sourcing), from uploads, and from anywhere else all
// arrive the same way. Quality / max width default to .thinkany/cms.json.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const has = (n) => args.includes(n);
const root = process.cwd();
const dir = path.resolve(root, args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--quality" && args[args.indexOf(a) - 1] !== "--max") || "public/images");
let quality = 55, maxWidth = 2400;
try { const c = JSON.parse(fs.readFileSync(path.join(root, ".thinkany", "cms.json"), "utf8")); if (c.media) { quality = c.media.quality || quality; maxWidth = c.media.maxWidth || maxWidth; } } catch {}
if (flag("--quality")) quality = Number(flag("--quality"));
if (flag("--max")) maxWidth = Number(flag("--max"));
const dry = has("--dry"), json = has("--json");

const CONVERT = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".heic", ".heif"]);
const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else out.push(p); } return out; };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function main() {
  if (!fs.existsSync(dir)) { report({ converted: [], rewrites: 0, note: `no ${path.relative(root, dir)}` }); return; }
  const converted = []; const failed = [];
  for (const file of walk(dir)) {
    const ext = path.extname(file).toLowerCase();
    if (!CONVERT.has(ext)) continue;
    const out = file.slice(0, -ext.length) + ".avif";
    if (dry) { converted.push({ from: file, to: out }); continue; }
    try {
      const img = sharp(file, { failOn: "none" }).rotate();
      const meta = await img.metadata();
      await img.resize({ width: Math.min(meta.width || maxWidth, maxWidth), withoutEnlargement: true }).avif({ quality, effort: 4 }).toFile(out);
      const before = fs.statSync(file).size, after = fs.statSync(out).size;
      fs.unlinkSync(file);
      converted.push({ from: file, to: out, before, after });
    } catch (e) { failed.push({ file, error: e.message }); try { fs.unlinkSync(out); } catch {} }
  }
  // Rewrite references: "/images/hero.jpg" → "/images/hero.avif" (and "hero.jpg" in credits.json).
  let rewrites = 0;
  if (converted.length && !dry) {
    const pairs = converted.map((c) => [path.relative(dir, c.from).split(path.sep).join("/"), path.relative(dir, c.to).split(path.sep).join("/")]);
    const roots = ["src", "content", "site/blocks", "public/images/credits.json"].map((r) => path.join(root, r)).filter((p) => fs.existsSync(p));
    const files = roots.flatMap((r) => (fs.statSync(r).isDirectory() ? walk(r) : [r])).filter((f) => /\.(tsx?|jsx?|css|html|json|md|mdx|astro)$/.test(f) && !f.includes("node_modules"));
    for (const f of files) {
      let text = fs.readFileSync(f, "utf8"); const orig = text;
      for (const [from, to] of pairs) text = text.replace(new RegExp(`(["'(/])${esc(from)}(?=["')\\s?#])`, "g"), `$1${to}`);
      if (text !== orig) { fs.writeFileSync(f, text); rewrites++; }
    }
  }
  report({ converted: converted.map((c) => ({ ...c, from: path.relative(root, c.from), to: path.relative(root, c.to) })), failed, rewrites, quality, maxWidth, dry });
}
function report(r) {
  if (json) { process.stdout.write(JSON.stringify(r) + "\n"); return; }
  const saved = (r.converted || []).reduce((n, c) => n + ((c.before || 0) - (c.after || 0)), 0);
  console.log(`${(r.converted || []).length} image(s) ${r.dry ? "would be " : ""}converted to AVIF${saved ? ` (${(saved / 1024).toFixed(0)} KB saved)` : ""}, ${r.rewrites || 0} file(s) updated${r.failed && r.failed.length ? `, ${r.failed.length} failed` : ""}${r.note ? ` (${r.note})` : ""}.`);
  for (const f of r.failed || []) console.log(`  failed: ${f.file}: ${f.error}`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
