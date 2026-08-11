// Deterministic reference ingest — the T1 core of the reference-ingest feature.
// See docs/reference-ingest-spec.md §6 (pipeline) + §8 (digest) + §15 (T1).
//
// WHAT THIS IS: the ZERO-TOKEN pass that turns stored references (intake/
// references.cjs) into a compact design-direction DIGEST, with no model call.
// It routes each stored asset to the cheapest local reader:
//   - image    → dominant palette via Electron nativeImage (pixel quantization)
//   - document → plain-text extract (md/txt/rtf, docx via a builtin zip reader,
//                pdf best-effort text layer)
// then writes digest.json (machine) + digest.md (human) alongside the manifest.
// The rich "gets the vibe" style read is the T2 vision pass; this is the stub
// that already flows exact colors + doc excerpts into the design for free.
//
// DEPENDENCY NOTE: image palette uses Electron's nativeImage (no new npm dep, per
// the dependency-light rule). If nativeImage quantization proves too coarse or
// inaccurate in practice, swap imagePalette() for an image-decode dep
// (get-image-colors / sharp) — that's the intended escape hatch, isolated here.
// Everything else is pure Node (zlib for docx), so the doc extractors are testable
// offline; only imagePalette needs the Electron runtime.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const references = require("./references.cjs");

// nativeImage is Electron-only; guard the require so the doc extractors below
// stay runnable under plain Node (offline tests, CI).
let nativeImage = null;
try { ({ nativeImage } = require("electron")); } catch { /* plain Node — image palette disabled */ }

const DOC_TEXT_CAP = 20000; // chars kept per document (§11 cap + disclose)
const EXCERPT_CHARS = 600;  // what rides in digest.md per doc

// ---- Image palette (Electron nativeImage) -----------------------------------

function rgbHex(r, g, b) {
  const h = (n) => n.toString(16).padStart(2, "0");
  return "#" + h(r) + h(g) + h(b);
}
function colorDist(a, b) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Dominant colors of an image, most-frequent first, near-duplicates merged.
// A popularity quantizer on a downscaled bitmap — exact-ish, good enough to seed
// a palette. Returns [] when nativeImage is unavailable or the image won't decode.
function imagePalette(absPath, maxColors = 5) {
  if (!nativeImage) return [];
  let img;
  try { img = nativeImage.createFromPath(absPath); } catch { return []; }
  if (!img || img.isEmpty()) return [];
  const { width, height } = img.getSize();
  if (!width || !height) return [];

  const target = 128; // downscale longest edge — palette doesn't need full res
  const scale = Math.min(1, target / Math.max(width, height));
  if (scale < 1) {
    try { img = img.resize({ width: Math.max(1, Math.round(width * scale)), quality: "good" }); }
    catch { /* keep original */ }
  }
  let bmp;
  try { bmp = img.toBitmap(); } catch { return []; } // BGRA, row-major
  if (!bmp || !bmp.length) return [];

  const counts = new Map();
  for (let i = 0; i + 3 < bmp.length; i += 4) {
    if (bmp[i + 3] < 16) continue; // skip near-transparent
    const b = bmp[i], g = bmp[i + 1], r = bmp[i + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3); // 5 bits/channel
    const e = counts.get(key);
    if (e) { e.n++; e.r += r; e.g += g; e.b += b; }
    else counts.set(key, { n: 1, r, g, b });
  }

  const buckets = [...counts.values()].sort((a, b) => b.n - a.n);
  const picked = [];
  for (const bk of buckets) {
    const rgb = [Math.round(bk.r / bk.n), Math.round(bk.g / bk.n), Math.round(bk.b / bk.n)];
    if (picked.some((p) => colorDist(p, rgb) < 48)) continue; // merge similar
    picked.push(rgb);
    if (picked.length >= maxColors) break;
  }
  return picked.map((rgb) => rgbHex(rgb[0], rgb[1], rgb[2]));
}

// ---- Document text ----------------------------------------------------------

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&"); // last, so &amp;lt; → &lt; not <
}

// Minimal ZIP reader: pull ONE entry's bytes out of a zip buffer (docx/xlsx are
// zips). Scans the End-of-Central-Directory record, walks the central directory,
// and inflates the matching entry (store or deflate). Zero-dep (zlib is builtin).
function readZipEntry(buf, targetName) {
  const EOCD_SIG = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16); // central directory offset
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break; // central dir header sig
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    if (name === targetName) {
      const lhNameLen = buf.readUInt16LE(localOff + 26);
      const lhExtraLen = buf.readUInt16LE(localOff + 28);
      const dataStart = localOff + 30 + lhNameLen + lhExtraLen;
      const comp = buf.subarray(dataStart, dataStart + compSize);
      try {
        if (method === 0) return comp;
        if (method === 8) return zlib.inflateRawSync(comp);
      } catch { return null; }
      return null;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

function docxText(buf) {
  const xml = readZipEntry(buf, "word/document.xml");
  if (!xml) return "";
  let s = xml.toString("utf8");
  s = s.replace(/<w:tab\b[^>]*\/?>/g, "\t");
  s = s.replace(/<w:br\b[^>]*\/?>/g, "\n");
  s = s.replace(/<\/w:p>/g, "\n"); // paragraph breaks
  s = s.replace(/<[^>]+>/g, "");   // strip all remaining tags
  return decodeXmlEntities(s).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Decode a PDF literal string body (inside the parens), honoring the escapes PDF
// literal strings use (\n \r \t \( \) \\ and octal \ddd).
function decodePdfLiteral(body) {
  let out = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c !== "\\") { out += c; continue; }
    const n = body[i + 1];
    if (n === "n") { out += "\n"; i++; }
    else if (n === "r") { out += "\r"; i++; }
    else if (n === "t") { out += "\t"; i++; }
    else if (n === "(" || n === ")" || n === "\\") { out += n; i++; }
    else if (n >= "0" && n <= "7") {
      let oct = n; i++;
      for (let k = 0; k < 2 && body[i + 1] >= "0" && body[i + 1] <= "7"; k++) { oct += body[++i]; }
      out += String.fromCharCode(parseInt(oct, 8) & 0xff);
    } else { out += n; i++; }
  }
  return out;
}

// Best-effort PDF text-layer extraction (§6.2a): inflate the content streams and
// pull text from the literal-string show operators (Tj / TJ). Handles the common
// case (FlateDecode streams, Latin text); hex-string / CID-font PDFs won't decode
// and yield "" — the caller then marks the asset for the T2 vision fallback (§13).
function pdfText(buf) {
  const raw = buf.latin1 ? buf.toString("latin1") : buf.toString("binary");
  const chunks = [];
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) continue;
    let data = raw.slice(start, end);
    // The dict just before "stream" tells us the filter.
    const head = raw.slice(Math.max(0, m.index - 400), m.index);
    if (/\/FlateDecode/.test(head)) {
      try { data = zlib.inflateSync(Buffer.from(data, "latin1")).toString("latin1"); }
      catch { continue; } // not really flate / broken — skip this stream
    }
    chunks.push(data);
    re.lastIndex = end + 9;
  }

  let text = "";
  for (const content of chunks) {
    // ( ... ) Tj   and   [ (..) -12 (..) ] TJ  → grab every literal string
    const strRe = /\((?:\\.|[^\\()])*\)/g;
    // Only pull strings that sit near a show operator, cheap heuristic: any literal
    // string in a content stream that contains Tj/TJ operators at all.
    if (!/\bT[jJ]\b/.test(content)) continue;
    let sm;
    while ((sm = strRe.exec(content))) {
      const body = sm[0].slice(1, -1);
      const piece = decodePdfLiteral(body);
      if (piece) text += piece;
    }
    text += "\n";
  }
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Route a document asset to its extractor by extension. Returns { text, note }.
// Does a string read like real prose, not decoded binary/font noise? Best-effort
// PDF/rtf extraction can pull font-glyph or stream bytes that "decode" to junk
// (e.g. "```mmm@@@ÿÿÿ…"): lots of symbols/high bytes, almost no spaces or letters.
// We must never feed that to the vision pass, so gate extracted text through this.
function looksLikeText(s) {
  if (!s) return false;
  const str = s.slice(0, 4000);
  const n = str.length || 1;
  let letters = 0, spaces = 0, nonAscii = 0, ctrl = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c === 9 || c === 10 || c === 13 || c === 32) { spaces++; continue; }
    if (c < 32) { ctrl++; continue; }
    if (c > 126) { nonAscii++; continue; }
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) letters++;
  }
  // Real prose: mostly letters, some spaces between words, little binary noise.
  return letters / n > 0.45 && spaces / n > 0.05 && nonAscii / n < 0.25 && ctrl / n < 0.05;
}

function extractDocText(absPath, ext) {
  try {
    const e = (ext || path.extname(absPath)).toLowerCase();
    if (e === ".md" || e === ".markdown" || e === ".txt") {
      return { text: fs.readFileSync(absPath, "utf8"), note: null }; // trust plain text
    }
    if (e === ".rtf") {
      const raw = fs.readFileSync(absPath, "latin1");
      let text = raw
        .replace(/\\'[0-9a-fA-F]{2}/g, "")     // hex-escaped bytes
        .replace(/\\[a-zA-Z]+-?\d* ?/g, "")     // control words
        .replace(/[{}]/g, "").replace(/\\\n/g, "\n").trim();
      if (text && !looksLikeText(text)) text = "";
      return { text, note: text ? null : "no readable text extracted" };
    }
    if (e === ".docx" || e === ".odt") {
      let text = docxText(fs.readFileSync(absPath));
      if (text && !looksLikeText(text)) text = "";
      return { text, note: text ? null : "no readable text in the document body" };
    }
    if (e === ".pdf") {
      let text = pdfText(fs.readFileSync(absPath));
      // A vector/scanned/CID-font PDF often yields junk rather than nothing — drop it.
      if (text && !looksLikeText(text)) text = "";
      return { text, note: text ? null : "no readable text layer (scanned or vector PDF)" };
    }
    return { text: "", note: "unsupported document type" };
  } catch (err) {
    return { text: "", note: `could not read: ${err.message}` };
  }
}

// ---- Digest assembly --------------------------------------------------------

function firstExcerpt(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > EXCERPT_CHARS ? clean.slice(0, EXCERPT_CHARS).trim() + "…" : clean;
}

/**
 * Ingest the project's stored references into a deterministic digest stub.
 * Processes every not-yet-ingested asset (or `onlyIds` if given), routes each to
 * its local extractor, updates the manifest (ingested/summary/ingestError), and
 * writes digest.json + digest.md. Returns { manifest, digest, processed, failed }.
 */
function ingest(projectDir, onlyIds = null) {
  const manifest = references.readManifest(projectDir);
  const only = Array.isArray(onlyIds) && onlyIds.length ? new Set(onlyIds) : null;

  const processed = [];
  const failed = [];
  for (const rec of manifest.assets) {
    if (only ? !only.has(rec.id) : rec.ingested) continue;
    const abs = references.absPathFor(projectDir, rec);
    const ext = path.extname(rec.name || rec.file).toLowerCase();

    if (rec.kind === "image") {
      const palette = imagePalette(abs);
      rec.palette = palette;
      rec.ingested = palette.length > 0 || nativeImage != null; // decoded (or tried) at T1
      rec.summary = palette.length ? `image, dominant ${palette.slice(0, 3).join(" ")}` : "image (no palette extracted)";
      rec.ingestError = palette.length ? null : (nativeImage ? "could not read pixels" : null);
      (palette.length ? processed : failed).push(rec.id);
    } else if (rec.kind === "document") {
      const { text, note } = extractDocText(abs, ext);
      const full = (text || "").length;
      rec.chars = Math.min(full, DOC_TEXT_CAP);
      rec.truncated = full > DOC_TEXT_CAP;
      rec.excerpt = firstExcerpt((text || "").slice(0, DOC_TEXT_CAP));
      rec.ingested = full > 0;
      rec.summary = full ? `document, ${full} chars extracted` : `document (${note || "no text"})`;
      rec.ingestError = full ? null : (note || "no text extracted");
      (full ? processed : failed).push(rec.id);
    } else {
      // "other" — stored, but nothing deterministic to pull at T1.
      rec.ingested = false;
      rec.summary = "unsupported reference type";
      rec.ingestError = "unsupported type";
      failed.push(rec.id);
    }
  }

  references.writeManifest(projectDir, manifest);
  const digest = writeDigest(projectDir, manifest);
  return { manifest, digest, processed, failed };
}

// Merge each image's palette into one project palette, most-common first, near-
// duplicates dropped. Deterministic order (by first appearance / frequency).
function mergePalette(assets, max = 6) {
  const seen = [];
  const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (const a of assets) {
    for (const hex of a.palette || []) {
      const rgb = rgbOf(hex);
      if (seen.some((s) => colorDist(rgbOf(s), rgb) < 40)) continue;
      seen.push(hex);
      if (seen.length >= max) return seen;
    }
  }
  return seen;
}

function writeDigest(projectDir, manifest, vision = null) {
  const assets = manifest.assets;
  const images = assets.filter((a) => a.kind === "image");
  const docs = assets.filter((a) => a.kind === "document");
  const palette = mergePalette(images); // exact hexes stay authoritative (T1)

  const digest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    stub: !vision, // false once the vision pass has run (T2)
    palette,
    fonts: [], // deterministic fonts arrive with URL-ref folding (T3)
    assets: assets.map((a) => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      summary: a.summary || null,
      palette: a.palette || undefined,
      excerpt: a.excerpt || undefined,
      chars: a.chars || undefined,
      truncated: a.truncated || undefined,
      ingested: a.ingested,
      ingestError: a.ingestError || undefined,
    })),
  };
  if (vision) {
    // The rich direction from the vision pass. Palette above is NOT overwritten.
    digest.style = {
      overallFeel: vision.overallFeel || null,
      type: vision.type || null,
      layout: vision.layout || null,
      imagery: vision.imagery || null,
    };
    digest.emulate = vision.emulate || null;
    digest.avoid = vision.avoid || null;
    digest.brandRules = Array.isArray(vision.brandRules) ? vision.brandRules.filter(Boolean) : [];
  }

  const dir = references.referencesDir(projectDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "digest.json"), JSON.stringify(digest, null, 2) + "\n");
  fs.writeFileSync(path.join(dir, "digest.md"), renderDigestMd(digest, images.length, docs.length));
  return digest;
}

function renderDigestMd(digest, nImages, nDocs) {
  const lines = [];
  const n = digest.assets.length;
  lines.push(`## Design references (distilled from ${n} upload${n === 1 ? "" : "s"})`);
  lines.push("");
  lines.push(digest.stub
    ? "_Deterministic stub (exact colors + document text). The style/vibe read is added by the vision pass._"
    : "_Distilled from the uploaded references. Treat this as the primary style direction._");
  lines.push("");

  const s = digest.style || {};
  if (s.overallFeel) lines.push(`- **Overall feel:** ${s.overallFeel}`);
  if (s.type) lines.push(`- **Type:** ${s.type}`);
  if (s.layout) lines.push(`- **Layout:** ${s.layout}`);
  if (s.imagery) lines.push(`- **Imagery:** ${s.imagery}`);
  if (digest.palette.length) {
    lines.push(`- **Palette (exact, from ${nImages} image${nImages === 1 ? "" : "s"}):** ${digest.palette.join(" ")}`);
  }
  for (const rule of digest.brandRules || []) lines.push(`- **From the docs:** ${rule}`);
  if (digest.emulate) lines.push(`- **Emulate:** ${digest.emulate}`);
  if (digest.avoid) lines.push(`- **Avoid:** ${digest.avoid}`);

  // Per-asset lines: the vision note (if any) is now in each asset's summary.
  for (const a of digest.assets) {
    if (a.kind === "image" && a.summary) {
      lines.push(`- **${a.name}:** ${a.summary}`);
    } else if (a.kind === "document" && a.excerpt) {
      lines.push(`- **${a.name}:** "${a.excerpt}"${a.truncated ? " …(truncated)" : ""}`);
    } else if (a.ingestError) {
      lines.push(`- **${a.name}:** ${a.ingestError}${digest.stub ? " (will be read by the vision pass)" : ""}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function readDigest(projectDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(references.referencesDir(projectDir), "digest.json"), "utf8"));
  } catch { return null; }
}

// ---- T2: isolated vision / doc-summarization pass ---------------------------
// See docs/reference-ingest-spec.md §7. This is the one step that spends tokens,
// and it does so ONCE per asset, in a SEPARATE one-shot Messages API call whose
// transcript is discarded — the images never enter the main design conversation
// (§11 hard rule). It turns the deterministic stub into the rich "gets the vibe"
// digest: style, type feel, layout, imagery, emulate/avoid, per-asset notes.
// The exact palette from T1 stays authoritative; the model only adds direction.

const VISION_MAX_IMAGES = 6;   // §11 cap + disclose
const VISION_MAX_DOC_CHARS = 6000; // bounded doc text into the pass

// Downscale an image to ~1024px longest edge and return a base64 JPEG part for
// the vision call (style/mood doesn't need full resolution — a large token saving,
// §6.1b). Returns null when nativeImage is unavailable or the image won't decode
// (e.g. SVG), so the caller simply skips it.
function imageVisionPart(absPath, maxEdge = 1024) {
  if (!nativeImage) return null;
  let img;
  try { img = nativeImage.createFromPath(absPath); } catch { return null; }
  if (!img || img.isEmpty()) return null;
  const { width, height } = img.getSize();
  if (!width || !height) return null;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  if (scale < 1) {
    try { img = img.resize({ width: Math.max(1, Math.round(width * scale)), quality: "good" }); }
    catch { /* keep original */ }
  }
  let buf;
  try { buf = img.toJPEG(80); } catch { return null; }
  if (!buf || !buf.length) return null;
  return { media_type: "image/jpeg", data: buf.toString("base64") };
}

// Recursively map a function over every string in a parsed JSON value.
function sanitizeStrings(obj, fn) {
  if (typeof obj === "string") return fn(obj);
  if (Array.isArray(obj)) return obj.map((v) => sanitizeStrings(v, fn));
  if (obj && typeof obj === "object") {
    const o = {};
    for (const k of Object.keys(obj)) o[k] = sanitizeStrings(obj[k], fn);
    return o;
  }
  return obj;
}

// Pull a JSON object out of a model reply that may carry stray prose or fences.
function parseJsonLoose(text) {
  if (!text) return null;
  let s = String(text).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

/**
 * Run the isolated vision/summarization pass over the project's references and,
 * on success, rewrite digest.json + digest.md with the rich direction and mark
 * the analyzed assets `visionIngested`. Requires ANTHROPIC_API_KEY. Returns
 * { ok, error?, digest?, analyzed:[ids], skipped:[...] }.
 *
 * `opts.model` picks the model (defaults to claude-opus-5). The call is one-shot
 * with no session/resume, so nothing persists beyond digest.md / digest.json.
 */
async function visionPass(projectDir, onlyIds = null, opts = {}) {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "no-api-key" };
  const manifest = references.readManifest(projectDir);
  const only = Array.isArray(onlyIds) && onlyIds.length ? new Set(onlyIds) : null;
  const pending = manifest.assets.filter((a) => (only ? only.has(a.id) : !a.visionIngested)
    && (a.kind === "image" || a.kind === "document"));
  if (!pending.length) return { ok: true, digest: readDigest(projectDir), analyzed: [], skipped: [] };

  // Build the batched input: downscaled images (capped) + bounded doc excerpts.
  const imageParts = [];
  const imageIds = [];
  const skipped = [];
  for (const a of pending.filter((x) => x.kind === "image")) {
    if (imageParts.length >= VISION_MAX_IMAGES) { skipped.push({ id: a.id, reason: "image cap" }); continue; }
    const part = imageVisionPart(references.absPathFor(projectDir, a));
    if (part) { imageParts.push({ rec: a, part }); imageIds.push(a.id); }
    else skipped.push({ id: a.id, reason: "undecodable image" });
  }
  const docs = pending.filter((x) => x.kind === "document" && (x.excerpt || "").length);
  let docBudget = VISION_MAX_DOC_CHARS;
  const docLines = [];
  const docIds = [];
  for (const a of docs) {
    if (docBudget <= 0) { skipped.push({ id: a.id, reason: "doc cap" }); continue; }
    const slice = (a.excerpt || "").slice(0, docBudget);
    docBudget -= slice.length;
    docLines.push(`- ${a.name}: ${slice}`);
    docIds.push(a.id);
  }
  if (!imageParts.length && !docLines.length) return { ok: false, error: "nothing analyzable" };

  const palette = mergePalette(manifest.assets.filter((a) => a.kind === "image"));
  const instruction =
    "Distill these design references into concise design direction for a web/app designer. " +
    (palette.length ? `The exact palette is already extracted (keep as-is): ${palette.join(" ")}. ` : "") +
    (docLines.length ? `Design-relevant text from documents:\n${docLines.join("\n")}\n` : "") +
    "Reply with ONLY a JSON object (no prose, no code fences) of this shape: " +
    '{"overallFeel":"","type":"","layout":"","imagery":"","emulate":"","avoid":"",' +
    '"brandRules":[""],"assets":[{"name":"","note":""}]}. ' +
    "Keep every value to one short line; assets = one note per image describing its visual style. " +
    "brandRules = explicit do/don'ts from the documents (empty array if none). " +
    "Do not use em-dashes (—) anywhere; use a comma or colon instead.";

  const content = [
    ...imageParts.map(({ part }) => ({ type: "image", source: { type: "base64", ...part } })),
    { type: "text", text: instruction },
  ];

  let reply;
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: opts.model || "claude-opus-5",
      max_tokens: 3000,
      system: "You are a design-direction distiller. You produce a compact JSON style digest from reference images and notes. You do not converse.",
      messages: [{ role: "user", content }],
    });
    reply = (msg.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }

  let vision = parseJsonLoose(reply);
  if (!vision) return { ok: false, error: "unparseable model reply" };
  // Belt-and-suspenders on the no-em-dash rule: the digest.md feel line is shown
  // in the UI, so strip any em-dash the model slipped in (→ arrows are fine).
  vision = sanitizeStrings(vision, (v) => v.replace(/\s*—\s*/g, ", "));

  // Fold per-asset notes into the manifest summaries and mark analyzed.
  const noteByName = new Map((Array.isArray(vision.assets) ? vision.assets : [])
    .filter((x) => x && x.name).map((x) => [String(x.name).toLowerCase(), x.note || ""]));
  const analyzed = [...imageIds, ...docIds];
  for (const a of manifest.assets) {
    if (!analyzed.includes(a.id)) continue;
    a.visionIngested = true;
    const note = noteByName.get(String(a.name || "").toLowerCase());
    if (note) a.summary = a.kind === "image" ? note : `${a.summary} — ${note}`;
  }
  references.writeManifest(projectDir, manifest);

  const digest = writeDigest(projectDir, manifest, vision);
  return { ok: true, digest, analyzed, skipped };
}

module.exports = {
  ingest, readDigest, visionPass,
  // exported for offline tests:
  imagePalette, extractDocText, docxText, pdfText, readZipEntry, mergePalette,
};
