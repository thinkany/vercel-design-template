// ©2026 thinkany llc. All rights reserved.
// TRASH: deleted content is moved, not removed. A page, post, entry, form or image
// goes to <project>/.thinkany/trash/ with a record of where it came from, so the
// Settings tab can restore it (back to its place, or beside a name taken since, with
// the picker's "-N" rule) or delete it for good. Anything older than TTL_DAYS is
// purged when the project's content is next read. .thinkany/ is never uploaded.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const TTL_DAYS = 30;

function trashDir(projectDir) { return path.join(projectDir, ".thinkany", "trash"); }
function indexPath(projectDir) { return path.join(trashDir(projectDir), "index.json"); }
function readIndex(projectDir) { try { const j = JSON.parse(fs.readFileSync(indexPath(projectDir), "utf8")); return Array.isArray(j.items) ? j.items : []; } catch { return []; } }
function writeIndex(projectDir, items) { fs.mkdirSync(trashDir(projectDir), { recursive: true }); fs.writeFileSync(indexPath(projectDir), JSON.stringify({ items }, null, 2) + "\n"); }

/**
 * Move a file into the trash. `from` is the absolute path; `record` carries what the
 * UI needs to show and restore it: { kind, title, meta }. Returns the record.
 */
function moveToTrash(projectDir, from, record) {
  if (!fs.existsSync(from)) return null;
  fs.mkdirSync(trashDir(projectDir), { recursive: true });
  const id = crypto.randomBytes(6).toString("hex");
  const file = `${id}-${path.basename(from)}`;
  fs.renameSync(from, path.join(trashDir(projectDir), file));
  const rel = path.relative(projectDir, from).split(path.sep).join("/");
  const item = { id, kind: record.kind || "file", title: record.title || path.basename(from), from: rel, file, deletedAt: new Date().toISOString(), meta: record.meta || {} };
  writeIndex(projectDir, [item, ...readIndex(projectDir)]);
  return item;
}

function list(projectDir) { return readIndex(projectDir); }

/** A free path beside `wanted`: the name itself, else name-2, name-3, … */
function freePath(wanted) {
  if (!fs.existsSync(wanted)) return wanted;
  const dir = path.dirname(wanted), ext = path.extname(wanted), base = path.basename(wanted, ext);
  let n = 2; let p;
  do { p = path.join(dir, `${base}-${n++}${ext}`); } while (fs.existsSync(p));
  return p;
}

/** Put an item back. Returns { item, to (absolute), renamed } or { error }. */
function restore(projectDir, id) {
  const items = readIndex(projectDir);
  const item = items.find((x) => x.id === id);
  if (!item) return { error: "That item is no longer in the trash." };
  const src = path.join(trashDir(projectDir), item.file);
  if (!fs.existsSync(src)) { writeIndex(projectDir, items.filter((x) => x.id !== id)); return { error: "Its file is gone." }; }
  const wanted = path.join(projectDir, ...item.from.split("/"));
  fs.mkdirSync(path.dirname(wanted), { recursive: true });
  const to = freePath(wanted);
  fs.renameSync(src, to);
  writeIndex(projectDir, items.filter((x) => x.id !== id));
  return { item, to, renamed: to !== wanted };
}

/** Delete one item for good. */
function remove(projectDir, id) {
  const items = readIndex(projectDir);
  const item = items.find((x) => x.id === id);
  if (item) { try { fs.rmSync(path.join(trashDir(projectDir), item.file), { force: true }); } catch {} }
  writeIndex(projectDir, items.filter((x) => x.id !== id));
  return { ok: true };
}

function empty(projectDir) {
  for (const it of readIndex(projectDir)) { try { fs.rmSync(path.join(trashDir(projectDir), it.file), { force: true }); } catch {} }
  writeIndex(projectDir, []);
  return { ok: true };
}

/** Drop items older than TTL_DAYS. Returns how many went. */
function purgeOld(projectDir, now = Date.now()) {
  const items = readIndex(projectDir);
  if (!items.length) return 0;
  const cutoff = now - TTL_DAYS * 24 * 60 * 60 * 1000;
  const keep = [], gone = [];
  for (const it of items) (Date.parse(it.deletedAt) < cutoff ? gone : keep).push(it);
  for (const it of gone) { try { fs.rmSync(path.join(trashDir(projectDir), it.file), { force: true }); } catch {} }
  if (gone.length) writeIndex(projectDir, keep);
  return gone.length;
}

module.exports = { moveToTrash, list, restore, remove, empty, purgeOld, freePath, TTL_DAYS };
