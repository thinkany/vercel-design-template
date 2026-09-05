// ©2026 thinkany llc. All rights reserved.
// PHONE UPLOAD: photos from a phone into the project, over the local network, with a
// QR code. The app opens a small HTTP listener on the Mac's Wi-Fi address with a
// single-use token; the phone scans the code and gets one screen (take a photo,
// choose from the library); each file posts straight back to the Mac and lands
// through the same path a desktop upload takes (media or references). Nothing
// leaves the network and nothing is stored anywhere in between.
//
// Limits: same Wi-Fi (client-isolated networks won't reach the Mac); the first run
// gets macOS's "allow incoming connections" prompt once. The token dies after ten
// minutes, when the panel closes, or when a new session starts.
const http = require("node:http");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const MAX_BYTES = 40 * 1024 * 1024;
const TTL_MS = 10 * 60 * 1000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif"]);
const EXT_FOR = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/avif": ".avif", "image/heic": ".heic", "image/heif": ".heif", "application/pdf": ".pdf" };

let server = null;
let session = null; // { token, target, accept: Set, onFile, expires, timer, tmpDir }

/** The Mac's LAN IPv4 (Wi-Fi first), or null when there is none. */
function lanAddress() {
  const ifs = os.networkInterfaces();
  const pick = (names) => { for (const n of names) for (const a of ifs[n] || []) if (a.family === "IPv4" && !a.internal) return a.address; return null; };
  return pick(["en0", "en1"]) || pick(Object.keys(ifs).filter((n) => !/^(lo|utun|awdl|llw|bridge|vmnet|docker)/.test(n))) || null;
}

function page(session, copy) {
  const c = copy || {};
  const esc = (s) => String(s || "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const accept = session.target === "references" ? "image/jpeg,image/png,image/webp,application/pdf" : "image/jpeg,image/png,image/webp";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(c.title || "Send to thinkany design")}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; font: 16px/1.45 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; background: #f4f4f7; color: #17171b; padding: max(24px, env(safe-area-inset-top)) 20px 40px; }
  h1 { font-size: 20px; margin: 0 0 6px; }
  p { margin: 0 0 22px; color: #505056; font-size: 14px; }
  label.btn { display: block; padding: 18px; margin: 0 0 12px; border-radius: 12px; background: #111; color: #fff; text-align: center; font-weight: 600; font-size: 17px; }
  label.btn.alt { background: #fff; color: #111; border: 1px solid #d6d6de; }
  input[type=file] { display: none; }
  ul { list-style: none; padding: 0; margin: 20px 0 0; }
  li { display: flex; gap: 10px; align-items: center; padding: 10px 0; border-top: 1px solid #e2e2e8; font-size: 14px; }
  li img { width: 44px; height: 44px; object-fit: cover; border-radius: 6px; background: #ddd; }
  li .s { margin-left: auto; color: #505056; font-size: 12px; }
  li.ok .s { color: #1a7f37; } li.err .s { color: #c0261e; }
</style></head><body>
<h1>${esc(c.heading || "Send to thinkany design")}</h1>
<p>${esc(c.lead || "Photos you pick here go straight to the project on your computer, over your Wi‑Fi.")}</p>
<label class="btn">${esc(c.take || "Take a photo")}<input type="file" accept="image/jpeg,image/png" capture="environment" id="cam"></label>
<label class="btn alt">${esc(c.choose || "Choose from your library")}<input type="file" accept="${accept}" multiple id="lib"></label>
<ul id="list"></ul>
<script>
  const url = location.pathname;
  const list = document.getElementById('list');
  async function send(file) {
    const li = document.createElement('li');
    const img = document.createElement('img'); if (file.type.startsWith('image/')) img.src = URL.createObjectURL(file);
    const name = document.createElement('span'); name.textContent = file.name;
    const s = document.createElement('span'); s.className = 's'; s.textContent = ${JSON.stringify(c.sending || "Sending…")};
    li.append(img, name, s); list.prepend(li);
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name) }, body: file });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { li.className = 'ok'; s.textContent = ${JSON.stringify(c.sent || "Sent")}; }
      else { li.className = 'err'; s.textContent = j.error || ${JSON.stringify(c.failed || "Not sent")}; }
    } catch (e) { li.className = 'err'; s.textContent = ${JSON.stringify(c.failed || "Not sent")}; }
  }
  for (const id of ['cam', 'lib']) document.getElementById(id).addEventListener('change', (e) => { for (const f of e.target.files) send(f); e.target.value = ''; });
</script></body></html>`;
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("too large")); req.destroy(); return; } chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function ensureServer() {
  if (server) return Promise.resolve(server.address().port);
  server = http.createServer(async (req, res) => {
    const m = (req.url || "").match(/^\/u\/([a-f0-9]{32})(?:\?.*)?$/);
    const s = session;
    if (!m || !s || m[1] !== s.token || Date.now() > s.expires) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("This code has expired. Open the panel again in thinkany design for a new one."); }
    if (req.method === "GET") { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }); return res.end(page(s, s.copy)); }
    if (req.method !== "POST") { res.writeHead(405); return res.end(); }
    const type = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    if (!s.accept.has(type)) { res.writeHead(415, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ ok: false, error: "That kind of file isn't accepted here." })); }
    let buf;
    try { buf = await readBody(req, MAX_BYTES); } catch { res.writeHead(413, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ ok: false, error: "Too large (40 MB max)." })); }
    let name = "";
    try { name = decodeURIComponent(String(req.headers["x-filename"] || "")); } catch {}
    name = path.basename(name || "").replace(/[^\w.\- ]+/g, "").trim() || `phone-${Date.now()}${EXT_FOR[type] || ""}`;
    if (!path.extname(name)) name += EXT_FOR[type] || "";
    const tmp = path.join(s.tmpDir, `${Date.now()}-${crypto.randomBytes(3).toString("hex")}-${name}`);
    try {
      fs.writeFileSync(tmp, buf);
      const out = await s.onFile(tmp, { name, type, size: buf.length });
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: true, ...(out || {}) }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: false, error: e && e.message || "Couldn't save it." }));
    } finally { try { fs.unlinkSync(tmp); } catch {} }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "0.0.0.0", () => resolve(server.address().port));
  });
}

/**
 * Start (or restart) a session. target: "media" | "references". onFile(tmpPath, meta)
 * is awaited per received file; its result rides back to the phone. Returns
 * { url, qr (PNG data URL), expires } or { error } when the Mac has no network address.
 */
async function startSession({ target, tmpDir, copy, onFile, onExpire }) {
  const ip = lanAddress();
  if (!ip) return { error: "no-network" };
  stopSession();
  const port = await ensureServer();
  const token = crypto.randomBytes(16).toString("hex");
  fs.mkdirSync(tmpDir, { recursive: true });
  const accept = new Set(target === "references" ? [...IMAGE_TYPES, "application/pdf"] : IMAGE_TYPES);
  const url = `http://${ip}:${port}/u/${token}`;
  session = { token, target, accept, onFile, copy, tmpDir, expires: Date.now() + TTL_MS, timer: setTimeout(() => { stopSession(); if (onExpire) onExpire(); }, TTL_MS) };
  const qr = await require("qrcode").toDataURL(url, { margin: 1, width: 320, color: { dark: "#111111", light: "#ffffff" } });
  return { url, qr, expires: session.expires };
}
function stopSession() {
  if (session && session.timer) clearTimeout(session.timer);
  session = null;
}
function stopServer() { stopSession(); if (server) { try { server.close(); } catch {} server = null; } }

module.exports = { startSession, stopSession, stopServer, lanAddress };
