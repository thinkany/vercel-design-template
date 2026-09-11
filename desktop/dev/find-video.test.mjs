// ©2026 thinkany llc. All rights reserved.
// find-video.test.mjs — the video CLI against stubbed library responses: rung choice,
// the size cap, the always-a-poster rule, the credit ledger and the exit codes.
// No live keys, no network: run with `node desktop/dev/find-video.test.mjs`.
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const CLI = path.join(HERE, "..", "..", "scripts", "find-video.mjs");

// A project to run in, and a stub server standing in for both libraries + their CDNs.
const proj = fs.mkdtempSync(path.join(os.tmpdir(), "vid-proj-"));
fs.mkdirSync(path.join(proj, "public", "video"), { recursive: true });

const MODE = path.join(proj, "stub-mode");
const setMode = (m) => fs.writeFileSync(MODE, m);
setMode("normal");

const server = await startServer();

// The stub runs as its OWN process. spawnSync blocks this process's event loop while the
// CLI runs, so a server living here could never answer the child's requests. Mode is set
// per-case by writing a file the stub reads on each request (no restart needed).
async function startServer() {
  const src = `
import http from "node:http";
import fs from "node:fs";
const MODE = ${JSON.stringify(MODE)};
const mode = () => { try { return fs.readFileSync(MODE, "utf8").trim(); } catch { return "normal"; } };
// A real (tiny) JPEG: sharp decodes the poster, so a stub header would fail the take.
const JPG = Buffer.from("/9j/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAJABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AIYA4V//2Q==", "base64");
const MP4 = Buffer.alloc(2048, 7);
const BIG = Buffer.alloc(9 * 1048576, 7);
const base = () => "http://127.0.0.1:" + s.address().port;
const pexelsVideo = (id) => ({
  id, width: 3840, height: 2160, duration: 12,
  url: "https://www.pexels.com/video/a-stunning-coastline-" + id + "/",
  image: base() + "/poster.jpg",
  user: { name: "A Contributor", url: "https://www.pexels.com/@contrib" },
  tags: [],
  video_files: [
    { link: base() + "/small.mp4", width: 640, height: 360, quality: null, file_type: "video/mp4", size: 500000 },
    { link: base() + "/hd.mp4", width: 1920, height: 1080, quality: null, file_type: "video/mp4", size: 3000000 },
    { link: base() + "/uhd.mp4", width: 3840, height: 2160, quality: null, file_type: "video/mp4", size: 9000000 },
  ],
  video_pictures: [{ picture: base() + "/poster.jpg" }],
});
const pixabayVideo = (id) => ({
  id, duration: 9, tags: "coast, aerial", pageURL: "https://pixabay.com/videos/x-" + id + "/",
  user: "Someone", user_id: 42, picture_id: "abc",
  videos: {
    tiny: { url: base() + "/small.mp4", width: 640, height: 360, size: 500000, thumbnail: base() + "/poster.jpg" },
    large: { url: base() + "/hd.mp4", width: 1920, height: 1080, size: 3000000, thumbnail: base() + "/poster.jpg" },
  },
});
const s = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const send = (code, body, type = "application/json") => {
    res.writeHead(code, { "content-type": type, "content-length": Buffer.byteLength(body),
      "x-ratelimit-limit": "200", "x-ratelimit-remaining": "199" });
    res.end(req.method === "HEAD" ? undefined : body);
  };
  if (u.pathname === "/videos/search") {
    const empty = ["nothing", "pexels-miss"].includes(u.searchParams.get("query"));
    return send(200, JSON.stringify({ videos: empty ? [] : [pexelsVideo(101)] }));
  }
  if (u.pathname.startsWith("/videos/videos/")) return send(200, JSON.stringify(pexelsVideo(101)));
  if (u.pathname === "/api/videos/") {
    const empty = u.searchParams.get("q") === "nothing";
    return send(200, JSON.stringify({ hits: empty ? [] : [pixabayVideo(202)] }));
  }
  if (u.pathname === "/poster.jpg") {
    if (mode() === "poster-fails") return send(404, "no", "text/plain");
    return send(200, JPG, "image/jpeg");
  }
  if (u.pathname.endsWith(".mp4")) {
    const body = mode() === "big" ? BIG : MP4;
    res.writeHead(200, { "content-type": "video/mp4", "content-length": body.length });
    return res.end(req.method === "HEAD" ? undefined : body);
  }
  send(404, "{}");
});
s.listen(0, "127.0.0.1", () => process.stdout.write(JSON.stringify({ port: s.address().port }) + "\\n"));
`;
  const file = path.join(proj, "stub.mjs");
  fs.writeFileSync(file, src);
  const { spawn } = await import("node:child_process");
  const child = spawn(process.execPath, [file], { stdio: ["ignore", "pipe", "inherit"] });
  const port = await new Promise((resolve, reject) => {
    let buf = "";
    child.stdout.on("data", (d) => { buf += d; const nl = buf.indexOf("\n"); if (nl >= 0) resolve(JSON.parse(buf.slice(0, nl)).port); });
    child.on("exit", (c) => reject(new Error(`stub exited early (${c})`)));
    setTimeout(() => reject(new Error("stub did not start")), 5000);
  });
  return { url: `http://127.0.0.1:${port}`, close: () => child.kill("SIGKILL") };
}

// The CLI talks to the stub by pointing the library hosts at it.
function run(argv, env = {}) {
  const r = spawnSync(process.execPath, [CLI, ...argv], {
    cwd: proj,
    env: {
      ...process.env,
      IMAGE_USAGE_FILE: path.join(proj, "usage.json"),
      TA_STOCK_TEST_BASE: server.url,
      ...env,
    },
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() };
}
const PEX = { PEXELS_API_KEY: "p" }, PIX = { PIXABAY_API_KEY: "x" };

// ---- no key ------------------------------------------------------------------
let r = run(["search", "coast"], { PEXELS_API_KEY: "", PIXABAY_API_KEY: "" });
assert.equal(r.code, 3, "no video library connected → exit 3");
assert.match(r.err, /Unsplash is stills-only/, "the message says why Unsplash doesn't count");

// ---- unknown / unconnected source --------------------------------------------
r = run(["search", "coast", "--source", "unsplash"], PEX);
assert.equal(r.code, 2, "unsplash is not a video source");
r = run(["search", "coast", "--source", "pixabay"], PEX);
assert.equal(r.code, 3, "a forced but unconnected library → exit 3");

// ---- search: shapes a Pexels result ------------------------------------------
r = run(["search", "coast"], PEX);
assert.equal(r.code, 0, `search should succeed: ${r.err}`);
let j = JSON.parse(r.out);
assert.equal(j.source, "pexels");
assert.equal(j.results.length, 1);
const c = j.results[0];
assert.equal(c.duration, 12, "duration is reported");
assert.equal(c.orientation, "landscape");
assert.ok(c.poster, "a poster URL is reported");
// Pexels sends no usable tags, so the label comes from the page-URL slug.
assert.equal(c.description, "a stunning coastline", "the slug stands in for the missing tags");
assert.ok(c.sizes.every((s) => typeof s.bytes === "number"),
  "every rendition reports its byte size, so the weight cap needs no HEAD request");
assert.equal(c.sizes.length, 3, "every MP4 rung is listed");
assert.ok(c.sizes[0].width < c.sizes[2].width, "rungs are sorted small to large");

// ---- search: cascades from an empty Pexels to Pixabay ------------------------
r = run(["search", "pexels-miss"], { ...PEX, ...PIX });
assert.equal(r.code, 0, `cascade should find Pixabay: ${r.err}`);
j = JSON.parse(r.out);
assert.equal(j.source, "pixabay", "an empty Pexels hands the query to Pixabay");

// ---- search: nothing anywhere -> exit 5 --------------------------------------
r = run(["search", "nothing"], PEX);
assert.equal(r.code, 5, "no match in any library → exit 5");

// ---- get: picks the rung for the spot, writes clip + poster + credit ---------
r = run(["get", "101", "--source", "pexels", "--out", "public/video/hero.mp4", "--spot", "background"], PEX);
assert.equal(r.code, 0, `get should succeed: ${r.err}`);
j = JSON.parse(r.out);
assert.equal(j.width, 1920, "background takes the 1920 rung, not the 4K one");
assert.equal(j.file, "/video/hero.mp4");
assert.equal(j.poster, "/video/hero.poster.avif", "the poster sits beside the clip");
assert.ok(fs.existsSync(path.join(proj, "public", "video", "hero.mp4")), "the clip is written");
const posterWritten = fs.existsSync(path.join(proj, "public", "video", "hero.poster.avif"))
  || fs.existsSync(path.join(proj, "public", "video", "hero.poster.jpg"));
assert.ok(posterWritten, "the poster is written (AVIF, or JPG without sharp)");
const led = JSON.parse(fs.readFileSync(path.join(proj, "public", "video", "credits.json"), "utf8"));
assert.equal(led.length, 1, "the credit is recorded in public/video");
assert.equal(led[0].free, true);
assert.ok(led[0].poster, "the credit names the poster");

// ---- get: a figure takes a smaller rung than a background -------------------
r = run(["get", "101", "--source", "pexels", "--out", "public/video/row.mp4", "--spot", "figure"], PEX);
j = JSON.parse(r.out);
assert.equal(j.width, 1920, "1920 is the smallest rung at/above the 1280 figure target");

// ---- get: over-cap is reported, not hidden ----------------------------------
setMode("big");
r = run(["get", "101", "--source", "pexels", "--out", "public/video/big.mp4", "--spot", "background"], PEX);
j = JSON.parse(r.out);
assert.equal(j.overCap, true, "a clip over the cap is flagged");
assert.match(j.note, /over the/, "and carries a note for the wrap-up");
setMode("normal");

// ---- get: no poster, no video ------------------------------------------------
setMode("poster-fails");
r = run(["get", "101", "--source", "pexels", "--out", "public/video/nop.mp4"], PEX);
assert.equal(r.code, 1, "a poster that won't fetch fails the take");
assert.ok(!fs.existsSync(path.join(proj, "public", "video", "nop.mp4")), "and leaves no orphan clip behind");
assert.match(r.err, /reduced motion|Figma/, "the message says why a poster is required");
setMode("normal");

// ---- get: guards -------------------------------------------------------------
r = run(["get", "101", "--source", "pexels", "--out", "/tmp/evil.mp4"], PEX);
assert.equal(r.code, 2, "--out must stay under public/video");
r = run(["get", "101", "--source", "pexels", "--out", "public/video/x.mov"], PEX);
assert.equal(r.code, 2, "--out must be an .mp4");
r = run(["get", "101", "--out", "public/video/x.mp4"], { ...PEX, ...PIX });
assert.equal(r.code, 2, "with two libraries connected, get needs --source");

// ---- pixabay: byte counts come with the search, so no HEAD is needed --------
r = run(["get", "202", "--source", "pixabay", "--out", "public/video/pb.mp4", "--spot", "figure"], PIX);
assert.equal(r.code, 0, `pixabay get should succeed: ${r.err}`);
j = JSON.parse(r.out);
assert.equal(j.source, "pixabay");
assert.equal(j.width, 1920, "the large rung clears the figure target");

server.close();
console.log("all find-video assertions passed");
