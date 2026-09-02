// ©2026 thinkany llc. All rights reserved.
// Image conversion worker for the CMS media picker. Runs as a CHILD process under
// the app's Electron-as-Node (main.cjs spawns it), so sharp's native binding never
// loads inside the main process. One job per run:
//
//   node media-convert.cjs <in> <out.avif|out.webp> [maxWidth] [quality]   → prints JSON
//
// The output format follows the extension (AVIF by default: sharp's prebuilt
// libvips carries the AOM encoder, so no extra library; WebP as the fallback).
// Auto-orients from EXIF, strips metadata (sharp's default), never upscales.
const path = require("node:path");

async function main() {
  const [inPath, outPath, maxW = "2400", quality = "55"] = process.argv.slice(2);
  if (!inPath || !outPath) throw new Error("usage: media-convert <in> <out.avif|out.webp> [maxWidth] [quality]");
  const avif = /\.avif$/i.test(outPath);
  // Resolve sharp from the app's node_modules (the worker's own dir sits inside the
  // app; the packaged app's modules are the unpacked clone, which main passes via
  // NODE_PATH when needed).
  const sharp = require("sharp");
  const img = sharp(inPath, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const width = Math.min(meta.width || Number(maxW), Number(maxW));
  const resized = img.resize({ width, withoutEnlargement: true });
  const info = await (avif ? resized.avif({ quality: Number(quality), effort: 4 }) : resized.webp({ quality: Number(quality), effort: 4 })).toFile(outPath);
  process.stdout.write(JSON.stringify({ ok: true, width: info.width, height: info.height, size: info.size, from: { width: meta.width, height: meta.height, format: meta.format } }));
}
main().catch((e) => { process.stdout.write(JSON.stringify({ ok: false, error: e.message })); process.exit(1); });
