// Design-reference storage engine — the T0 core of the reference-ingest feature.
// See docs/reference-ingest-spec.md §4 (storage layout) + §15 (T0).
//
// WHAT THIS IS: the pure-Node, dependency-light store for design references a
// designer uploads before the design phase (images, brand PDFs, mood boards).
// It only STORES and CATALOGS the files — no model, no ingest, no digest yet
// (those are T1/T2). Files land under the project's PRIVATE `.thinkany/`
// working area (gitignored, never on the Vercel preview, never in `public/`),
// so nothing here is shipped to the client.
//
// It mirrors the brief.cjs / cards.cjs pattern: plain CommonJS, no Electron
// deps, so main.cjs (IPC wiring) can require it and it stays testable offline.
//
// Storage layout under <project>/.thinkany/references/:
//   assets/         the uploaded files, verbatim (original bytes)
//   manifest.json   one record per asset (see MANIFEST record shape below)
// `derived/`, `digest.md`, `digest.json` arrive with the ingest phases (T1+).
//
// A manifest record:
//   { id, file, name, kind, mime, bytes, sha256, addedAt, ingested, summary }
//   id        — stable "ref-NN", unique within the project; the address the UI/
//               future "reference N" flow keys off.
//   file      — path RELATIVE to the references dir ("assets/moodboard.png").
//   name      — the original filename (what the designer sees).
//   kind      — "image" | "document" | "other" (routing hint for later ingest).
//   sha256    — dedup key across re-uploads (§12); the same bytes never store twice.
//   ingested  — false at T0 (no ingest yet); summary stays null until T2.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".bmp", ".tif", ".tiff", ".heic", ".heif"]);
const DOC_EXTS = new Set([".pdf", ".doc", ".docx", ".md", ".markdown", ".txt", ".rtf", ".odt", ".pages"]);

// Minimal ext → MIME map (enough for the kinds we route; unknowns fall back to
// octet-stream). Kept tiny on purpose — the real content read is a later phase.
const MIME = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml", ".bmp": "image/bmp",
  ".tif": "image/tiff", ".tiff": "image/tiff", ".heic": "image/heic", ".heif": "image/heif",
  ".pdf": "application/pdf", ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".md": "text/markdown", ".markdown": "text/markdown", ".txt": "text/plain",
  ".rtf": "application/rtf", ".odt": "application/vnd.oasis.opendocument.text",
  ".pages": "application/x-iwork-pages-sffpages",
};

function referencesDir(projectDir) { return path.join(projectDir, ".thinkany", "references"); }
function assetsDir(projectDir) { return path.join(referencesDir(projectDir), "assets"); }
function manifestPath(projectDir) { return path.join(referencesDir(projectDir), "manifest.json"); }

function kindForExt(ext) {
  if (IMAGE_EXTS.has(ext)) return "image";
  if (DOC_EXTS.has(ext)) return "document";
  return "other";
}
function mimeForExt(ext) { return MIME[ext] || "application/octet-stream"; }

/** The absolute on-disk path of a stored asset (for the renderer's file:// thumbnail). */
function absPathFor(projectDir, rec) { return path.join(referencesDir(projectDir), rec.file); }

/** Read the manifest, tolerating a missing/corrupt file (returns an empty one). */
function readManifest(projectDir) {
  try {
    const m = JSON.parse(fs.readFileSync(manifestPath(projectDir), "utf8"));
    if (m && Array.isArray(m.assets)) return { version: m.version || 1, assets: m.assets };
  } catch { /* missing or malformed — start fresh */ }
  return { version: 1, assets: [] };
}

function writeManifest(projectDir, manifest) {
  fs.mkdirSync(referencesDir(projectDir), { recursive: true });
  fs.writeFileSync(manifestPath(projectDir), JSON.stringify(manifest, null, 2) + "\n");
}

function sha256File(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

/** Next "ref-NN" id, one past the highest already in the manifest (stable, gap-tolerant). */
function nextId(assets) {
  let max = 0;
  for (const a of assets) {
    const m = /^ref-(\d+)$/.exec((a && a.id) || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return "ref-" + String(max + 1).padStart(2, "0");
}

/** A destination filename that doesn't collide with one already in `dir` (name, name-1, …). */
function uniqueDestName(dir, base) {
  const ext = path.extname(base);
  const stem = path.basename(base, ext);
  let name = base;
  let n = 1;
  while (fs.existsSync(path.join(dir, name))) name = `${stem}-${n++}${ext}`;
  return name;
}

/**
 * Copy the given source files into the project's references store, skipping any
 * whose bytes already exist (dedup by sha256, §12). Returns the updated manifest
 * plus what was `added` (new records) and `skipped` (with a reason).
 */
function addAssets(projectDir, srcPaths) {
  const dir = assetsDir(projectDir);
  fs.mkdirSync(dir, { recursive: true });
  const manifest = readManifest(projectDir);
  const bySha = new Map(manifest.assets.map((a) => [a.sha256, a]));
  const added = [];
  const skipped = [];

  for (const src of Array.isArray(srcPaths) ? srcPaths : []) {
    try {
      if (!src || !fs.existsSync(src) || !fs.statSync(src).isFile()) {
        skipped.push({ src, reason: "not a file" });
        continue;
      }
      const sha = sha256File(src);
      const dup = bySha.get(sha);
      if (dup) { skipped.push({ src, reason: "duplicate", id: dup.id }); continue; }

      const origName = path.basename(src);
      const ext = path.extname(origName).toLowerCase();
      const destName = uniqueDestName(dir, origName);
      fs.copyFileSync(src, path.join(dir, destName));

      const rec = {
        id: nextId(manifest.assets),
        file: path.posix.join("assets", destName), // POSIX so file:// URLs are clean
        name: origName,
        kind: kindForExt(ext),
        mime: mimeForExt(ext),
        bytes: fs.statSync(src).size,
        sha256: sha,
        addedAt: new Date().toISOString(),
        ingested: false, // no ingest at T0
        summary: null,   // filled by the T2 style pass
      };
      manifest.assets.push(rec);
      bySha.set(sha, rec);
      added.push(rec);
    } catch (e) {
      skipped.push({ src, reason: e.message });
    }
  }

  if (added.length) writeManifest(projectDir, manifest);
  return { manifest, added, skipped };
}

function listAssets(projectDir) { return readManifest(projectDir).assets; }

/** Drop one asset: remove its file and its manifest record. Returns the removed record (or null). */
function removeAsset(projectDir, id) {
  const manifest = readManifest(projectDir);
  const idx = manifest.assets.findIndex((a) => a.id === id);
  if (idx < 0) return { manifest, removed: null };
  const [rec] = manifest.assets.splice(idx, 1);
  try { fs.unlinkSync(absPathFor(projectDir, rec)); } catch { /* already gone */ }
  writeManifest(projectDir, manifest);
  return { manifest, removed: rec };
}

module.exports = {
  referencesDir, assetsDir, manifestPath, absPathFor,
  kindForExt, mimeForExt,
  readManifest, writeManifest,
  addAssets, listAssets, removeAsset,
  nextId, // exported for tests
};
