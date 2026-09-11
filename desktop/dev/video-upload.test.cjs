// ©2026 thinkany llc. All rights reserved.
// VIDEO UPLOAD TEST — `node desktop/dev/video-upload.test.cjs`.
//
// A clip a designer uploads has to land somewhere a video field can find it, WITH the
// poster still that every video spot depends on. Read out of main.cjs and shell.js, the
// way the other structural tests here do; the live Electron half (actually decoding a
// frame) is covered by desktop/video-poster.cjs's own behaviour, checked by hand.
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const main = fs.readFileSync(path.join(__dirname, "..", "main.cjs"), "utf8");
const shell = fs.readFileSync(path.join(__dirname, "..", "shell.js"), "utf8");
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };

// ---- Clips go to public/video, not in with the documents --------------------
ok(/function videoDir\(dir\) \{ return path\.join\(dir, "public", "video"\); \}/.test(main),
  "clips live in public/video");
ok(/kind === "video" \? videoDir\(dir\)/.test(main), "the media helpers know that third kind");
// .mp4 used to be a DOCUMENT, which is where an uploaded clip would have landed.
const fileExt = main.match(/const FILE_EXT = new Set\(\[([^\]]*)\]\)/)[1];
ok(!/"\.mp4"/.test(fileExt), "mp4 is no longer a document: it would have gone to public/files");
ok(!/"\.mov"/.test(fileExt), "nor is mov");
const videoExt = main.match(/const VIDEO_EXT = new Set\(\[([^\]]*)\]\)/)[1];
for (const e of ['".mp4"', '".mov"', '".webm"']) ok(videoExt.includes(e), `${e} is accepted as video`);

// ---- Every import derives a poster ------------------------------------------
const imp = main.slice(main.indexOf("async function importVideoFiles"), main.indexOf("function importDocumentFiles"));
ok(/grabPoster\(dest, posterAbs\)/.test(imp), "an imported clip has a poster grabbed for it");
ok(/\$\{stem\}\.poster\.jpg/.test(imp),
  "written beside the clip under the same stem, the convention find-video.mjs already uses");
// A failed grab must not lose the clip: the designer may have a better still anyway.
ok(/posterError: r\.ok \? null : r\.error/.test(imp), "a failed grab is reported, not thrown");
ok(/added\.push\(\{/.test(imp) && !/if \(!r\.ok\) continue/.test(imp),
  "and the clip still imports, so the field can ask for a poster");
ok(/bytes:/.test(imp), "the weight comes back, so a heavy clip can be flagged");

// ---- The field always offers a manual poster --------------------------------
const field = shell.slice(shell.indexOf('} else if (f.kind === "video") {'), shell.indexOf('} else if (f.kind === "link") {'));
ok(/const paintPoster = \(\) => \{/.test(field) && /paintPoster\(\);/.test(field),
  "the poster control is always rendered, not only when the grab failed");
ok(/window\.desktop\.uploadVideo\(\)/.test(field), "a clip can be chosen from a dialog");
ok(/window\.desktop\.importVideo\(paths\)/.test(field), "and dropped onto the field");
ok(/videoNeedsPoster/.test(field), "a clip with no poster says so plainly");
ok(/videoHeavy/.test(field), "and a heavy clip is flagged rather than landing silently");
// The value is only usable with both halves.
ok(/get = \(\) => \(cur\.src && cur\.poster \?/.test(field),
  "a clip with no poster is not a usable field value");

// ---- Wiring -----------------------------------------------------------------
const preload = fs.readFileSync(path.join(__dirname, "..", "preload.cjs"), "utf8");
for (const m of ["uploadVideo", "importVideo"]) ok(new RegExp(`${m}:`).test(preload), `${m} is bridged`);
for (const h of ["media:uploadVideo", "media:importVideo"]) ok(main.includes(`ipcMain.handle("${h}"`), `${h} is handled`);
// Both must refuse without a licence and without a project, like every other media op.
for (const h of ["media:uploadVideo", "media:importVideo"]) {
  const body = main.slice(main.indexOf(`ipcMain.handle("${h}"`), main.indexOf(`ipcMain.handle("${h}"`) + 700);
  ok(/siteLicensed\(\)/.test(body) && /No project is open/.test(body), `${h} is gated like the rest`);
}

console.log(`video-upload: ${checks} checks pass.`);
