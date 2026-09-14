// ©2026 thinkany llc. All rights reserved.
// FIND-IMAGES TEST: `node desktop/dev/find-images.test.mjs`.
//
// Drives scripts/find-images.mjs against a local stub standing in for Unsplash and
// Pexels (TA_STOCK_TEST_BASE). The point under test: an Unsplash `get` is HOTLINKED
// (their terms): it pings the download endpoint, writes nothing under public/, and
// returns a sized src on images.unsplash.com with the credit keyed by that URL. A
// Pexels `get` still lands a file. Same stub-as-its-own-process shape as find-video.test.
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const CLI = path.join(HERE, "..", "..", "scripts", "find-images.mjs");

const proj = fs.mkdtempSync(path.join(os.tmpdir(), "img-proj-"));
fs.mkdirSync(path.join(proj, "public", "images"), { recursive: true });
const HITS = path.join(proj, "hits.log"); // the stub appends every path it serves
const server = await startServer();

async function startServer() {
  const src = `
import http from "node:http";
import fs from "node:fs";
const HITS = ${JSON.stringify(HITS)};
const JPG = Buffer.from("/9j/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAJABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AIYA4V//2Q==", "base64");
const base = () => "http://127.0.0.1:" + s.address().port;
const unsplashPhoto = (id) => ({
  id, width: 4000, height: 2667, color: "#26261a", description: "A mountain road at dusk", alt_description: "road between mountains",
  urls: { raw: "https://images.unsplash.com/photo-" + id + "?ixid=M3wxfDB8MXxhbGx8fHx8fHx8fHwxNjk0MDAwMDAw&ixlib=rb-4.0.3", thumb: "https://images.unsplash.com/photo-" + id + "?w=200" },
  links: { html: "https://unsplash.com/photos/" + id, download_location: base() + "/unsplash/photos/" + id + "/download?ixid=abc" },
  user: { name: "Ansel Someone", links: { html: "https://unsplash.com/@ansel" } },
});
const pexelsPhoto = (id) => ({
  id, width: 4000, height: 3000, avg_color: "#334455", alt: "a workshop bay", url: "https://www.pexels.com/photo/" + id + "/",
  photographer: "A Contributor", photographer_url: "https://www.pexels.com/@contrib",
  src: { original: base() + "/pexels-file/" + id + ".jpg", tiny: base() + "/pexels-file/" + id + "-tiny.jpg" },
});
const s = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  fs.appendFileSync(HITS, u.pathname + "\\n");
  const send = (code, body, type = "application/json") => {
    res.writeHead(code, { "content-type": type, "content-length": Buffer.byteLength(body), "x-ratelimit-limit": "3000", "x-ratelimit-remaining": "2999" });
    res.end(body);
  };
  if (u.pathname === "/unsplash/search/photos") return send(200, JSON.stringify({ results: u.searchParams.get("query") === "nothing" ? [] : [unsplashPhoto("u1")] }));
  if (/^\\/unsplash\\/photos\\/[^/]+\\/download$/.test(u.pathname)) return send(200, JSON.stringify({ url: "https://images.unsplash.com/photo-u1" }));
  if (/^\\/unsplash\\/photos\\/[^/]+$/.test(u.pathname)) return send(200, JSON.stringify(unsplashPhoto(u.pathname.split("/").pop())));
  if (u.pathname === "/pexels/v1/search") return send(200, JSON.stringify({ photos: [pexelsPhoto(9)] }));
  if (u.pathname.startsWith("/pexels-file/")) return send(200, JPG, "image/jpeg");
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

function run(argv, env = {}) {
  const r = spawnSync(process.execPath, [CLI, ...argv], {
    cwd: proj,
    env: { ...process.env, IMAGE_USAGE_FILE: path.join(proj, "usage.json"), TA_STOCK_TEST_BASE: server.url, UNSPLASH_ACCESS_KEY: "child-key", PEXELS_API_KEY: "pexels-key", ...env },
    encoding: "utf8",
  });
  let json = null; try { json = JSON.parse(r.stdout); } catch {}
  return { code: r.status, out: r.stdout, err: r.stderr, json };
}
const hits = () => { try { return fs.readFileSync(HITS, "utf8").trim().split("\n"); } catch { return []; } };
const credits = () => { try { return JSON.parse(fs.readFileSync(path.join(proj, "public", "images", "credits.json"), "utf8")); } catch { return []; } };
const files = () => fs.readdirSync(path.join(proj, "public", "images")).filter((f) => f !== "credits.json");

let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };

try {
  // ---- search: Unsplash answers first, and the candidates read as before ----------
  const s1 = run(["search", "mountain road dusk", "--orientation", "landscape", "--per", "4"]);
  ok(s1.code === 0 && s1.json && s1.json.source === "unsplash", `search answers from unsplash (exit ${s1.code}: ${s1.err})`);
  ok(s1.json.results[0].id === "u1" && s1.json.results[0].photographer === "Ansel Someone", "candidates carry id + photographer");

  // ---- get from Unsplash: hotlinked ------------------------------------------------
  const before = hits().length;
  const g1 = run(["get", "u1", "--source", "unsplash", "--width", "2000"]);
  ok(g1.code === 0 && g1.json, `unsplash get succeeds without --out (exit ${g1.code}: ${g1.err})`);
  ok(g1.json.hotlinked === true, "the result says it is hotlinked");
  const src = new URL(g1.json.src);
  ok(src.hostname === "images.unsplash.com", "src is on Unsplash's CDN");
  ok(src.searchParams.get("w") === "2000" && src.searchParams.get("auto") === "format" && src.searchParams.get("fit") === "max", "sized on the CDN with auto=format");
  ok(src.searchParams.get("ixid") && src.searchParams.get("ixlib"), "the raw URL's attribution params are kept");
  ok(/640w/.test(g1.json.srcset) && /1600w/.test(g1.json.srcset) && !/2400w/.test(g1.json.srcset), "srcset lists the widths up to the requested one");
  ok(files().length === 0, "nothing was written under public/images");
  const after = hits();
  ok(after.length === before + 1 && /\/unsplash\/photos\/u1\/download$/.test(after[after.length - 1]), "exactly one call was made: the download ping (the search cached the photo)");
  const c1 = credits();
  ok(c1.length === 1 && c1[0].file === `${src.origin}${src.pathname}` && c1[0].src === g1.json.src && c1[0].hotlinked === true && c1[0].free === true,
    "the credit is keyed by the photo's CDN path (no sizing), carries the sized src, and is marked hotlinked");
  ok(/utm_source=thinkany_design/.test(c1[0].url) && c1[0].author === "Ansel Someone", "with the photographer and utm-tagged links");
  ok(/shown from Unsplash/.test(g1.json.note), "and the output says why there is no file");

  // A second get with --out is not a failure: the flag is ignored with a note.
  const g2 = run(["get", "u1", "--source", "unsplash", "--out", "public/images/hero.avif"]);
  ok(g2.code === 0 && /--out was ignored/.test(g2.json.note) && files().length === 0, "--out on an Unsplash get is ignored, not an error");
  ok(credits().length === 1 && /w=2400/.test(credits()[0].src), "the same photo at another width updates its one credit (and its src) rather than adding a second");

  // ---- get from Pexels: a file, as before ---------------------------------------------
  const s2 = run(["search", "workshop bay", "--source", "pexels"]);
  ok(s2.code === 0 && s2.json.source === "pexels", "a forced Pexels search answers");
  const g3 = run(["get", "9", "--source", "pexels", "--out", "public/images/bay.avif"]);
  ok(g3.code === 0 && g3.json && /^\/images\/bay\.(avif|jpg)$/.test(g3.json.file), `pexels get writes a file (exit ${g3.code}: ${g3.err})`);
  ok(files().length === 1, "and it is on disk");
  const g4 = run(["get", "9", "--source", "pexels"]);
  ok(g4.code === 2 && /needs --out/.test(g4.err), "a Pexels get without --out still asks for one");
  ok(credits().length === 2 && !credits()[1].hotlinked, "its credit is keyed by file, not hotlinked");

  // ---- status still reports both ----------------------------------------------------
  const st = run(["status"]);
  ok(st.code === 0 && st.json.unsplash && st.json.pexels, "status lists both libraries");
} finally {
  server.close();
}
console.log(`find-images: ${checks} checks pass.`);
