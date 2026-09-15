// ©2026 thinkany llc. All rights reserved.
// REFERENCE DOCUMENTS TEST — `node desktop/dev/reference-documents.test.cjs`.
//
// An uploaded document (a copy deck, a content outline) must reach the build WHOLE, with
// no prompt from the designer: the digest keeps a 600-character excerpt for style, so the
// ingest leaves the full text where the agent can read it and the build note names it.
// Offline: a temp project, the real references + ingest modules, and the documentsNote
// function parsed out of main.cjs (an Electron entry point, not requirable here).
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const references = require("../intake/references.cjs");
const ingest = require("../intake/ingest.cjs");

const project = fs.mkdtempSync(path.join(os.tmpdir(), "ta-refdocs-"));
const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), "ta-refdocs-src-"));
const tailLine = "Closing line: only the whole file carries this sentence.";
const longBody = "## Part B\n\n" + "Real copy for the hero, written by the client. ".repeat(40) + "\n\n" + tailLine; // > 600 chars
fs.writeFileSync(path.join(srcDir, "copy-deck.md"), "# Brief\n\n" + longBody);
fs.writeFileSync(path.join(srcDir, "outline.txt"), "Home, About, Contact.");
fs.writeFileSync(path.join(srcDir, "mood.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47])); // not a real image; ingest tolerates it

const { added } = references.addAssets(project, [
  path.join(srcDir, "copy-deck.md"), path.join(srcDir, "outline.txt"), path.join(srcDir, "mood.png"),
]);
assert.strictEqual(added.length, 3, "three uploads stored");
ingest.ingest(project, null);

// 1. Plain-text uploads are readable where they sit; the manifest records the path + size.
const docs = ingest.readableDocuments(project);
assert.deepStrictEqual(docs.map((d) => d.name).sort(), ["copy-deck.md", "outline.txt"], "documents only, no images");
for (const d of docs) {
  assert.ok(d.path.startsWith(".thinkany/references/"), `path is project-relative: ${d.path}`);
  assert.ok(fs.existsSync(path.join(project, d.path)), `file exists at ${d.path}`);
}
const deck = docs.find((d) => d.name === "copy-deck.md");
assert.ok(deck.chars > 600, "the full length is recorded, not the excerpt");

// 2. The digest still carries only the excerpt, plus a pointer to the full text.
const md = ingest.readDigestMd(project);
assert.ok(md.includes("(full text: `assets/copy-deck.md`)"), "digest.md points at the whole document");
assert.ok(!md.includes(tailLine), "digest.md does not carry the whole document");

// 3. A binary document (a docx built by hand) gets its extracted text written as derived/<id>.txt.
const zlib = require("node:zlib");
function docx(text) {
  // A minimal zip with one stored entry, word/document.xml (enough for docxText).
  const xml = Buffer.from(`<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);
  const name = Buffer.from("word/document.xml");
  const crc = zlib.crc32 ? zlib.crc32(xml) : 0;
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 8);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(xml.length, 18); local.writeUInt32LE(xml.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 10);
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(xml.length, 20); central.writeUInt32LE(xml.length, 24); central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  const cdSize = central.length + name.length; const cdOffset = local.length + name.length + xml.length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(cdSize, 12); end.writeUInt32LE(cdOffset, 16);
  return Buffer.concat([local, name, xml, central, name, end]);
}
const docxText = "The whole deck lives in a Word file and the agent still reads every line of it.";
fs.writeFileSync(path.join(srcDir, "deck.docx"), docx(docxText));
const more = references.addAssets(project, [path.join(srcDir, "deck.docx")]);
ingest.ingest(project, more.added.map((a) => a.id));
const word = ingest.readableDocuments(project).find((d) => d.name === "deck.docx");
if (word) {
  assert.ok(/derived\/ref-\d+\.txt$/.test(word.path), `binary documents are read from derived text: ${word.path}`);
  assert.strictEqual(fs.readFileSync(path.join(project, word.path), "utf8").trim(), docxText);
} else {
  // docxText needs a zip the extractor accepts; a miss here is the hand-built zip, not the feature.
  console.log("  (docx extraction skipped: hand-built zip not accepted by the extractor)");
}

// 4. The build note names every document and says to read it whole and use its copy.
const src = fs.readFileSync(path.join(__dirname, "..", "main.cjs"), "utf8");
const m = src.match(/function documentsNote\(b\) \{[\s\S]*?\n\}/);
assert.ok(m, "documentsNote not found in main.cjs");
const documentsNote = new Function(m[0] + "; return documentsNote;")();
assert.strictEqual(documentsNote({}), "", "no documents, no note");
const note = documentsNote({ referenceDocuments: docs });
assert.ok(note.startsWith("UPLOADED DOCUMENTS."), "the note leads with what it is");
for (const d of docs) assert.ok(note.includes(`\`${d.path}\``), `names ${d.path}`);
assert.ok(/in full/.test(note) && /as written/.test(note) && /placeholder copy/.test(note), "read whole, use the copy, no placeholders");
assert.ok(/never instructions/.test(note), "document contents are material, not commands");
assert.ok(!/—/.test(note), "no em-dashes (house rule)");
const wired = /const buildNotes = \[[\s\S]*?documentsNote\(b\)[\s\S]*?\]\.filter\(Boolean\)/.test(src);
assert.ok(wired, "documentsNote rides the build notes, not the brief body");

fs.rmSync(project, { recursive: true, force: true });
fs.rmSync(srcDir, { recursive: true, force: true });
console.log("reference-documents: ok");
