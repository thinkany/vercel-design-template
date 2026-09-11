// ©2026 thinkany llc. All rights reserved.
// video-poster.cjs — take a still frame out of a video file (Electron main process).
//
// Every video a design uses needs a poster: it is what a reduced-motion visitor sees,
// what the Figma export draws, and what shows before the first frame paints. A clip the
// designer uploads has no poster of its own, so we grab one.
//
// Chromium already decodes H.264, so this needs no ffmpeg and no new dependency: a hidden
// BrowserWindow loads the clip, seeks past the opening frames (a first frame is often
// black, or a fade-in), and paints it to a canvas. Measured on a real Pexels clip:
// 1920x1080 in ~260ms, 426x226 in ~500ms.
//
// Its own window, not the capture bridge's: that one is long-lived and shared across an
// export run, and borrowing it would leave a <video> and a stray page behind in it.
//
// GOTCHA: the page must be served from the SAME DIRECTORY as the clip. A `data:` URL page
// is an opaque origin and cannot load `file://` media at all (it fails as
// MEDIA_ERR_SRC_NOT_SUPPORTED, which looks exactly like a missing codec and is not).

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { BrowserWindow } = require("electron");

const DEFAULT_SEEK = 1.0;   // seconds in: skip the black frame / fade-in
const LOAD_TIMEOUT = 20000;

// ONE window, reused, with calls serialized behind it: the same shape capture-bridge.cjs
// uses, and for the same reason. A grab is short (tens of milliseconds once the window is
// up), so standing a window up per call would cost more than it saves, and the second
// grab in a session is then nearly free.
let win = null;
let queue = Promise.resolve();

function getWindow() {
  if (win && !win.isDestroyed()) return win;
  win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 720,
    webPreferences: {
      backgroundThrottling: false, // a hidden window must keep decoding
      partition: "video-poster",   // isolated, in-memory
    },
  });
  return win;
}

/** Let go of the window (nothing depends on it between grabs). */
function closePosterWindow() {
  try { if (win && !win.isDestroyed()) win.destroy(); } catch { /* already gone */ }
  win = null;
}

/**
 * Grab a still from `clipPath` and write it to `outPath` as JPEG.
 * Resolves { ok: true, width, height, duration, bytes } or { ok: false, error }.
 * Never throws: a caller that cannot get a poster needs to say so, not crash.
 */
function grabPoster(clipPath, outPath, opts = {}) {
  const run = () => grabPosterNow(clipPath, outPath, opts);
  queue = queue.then(run, run); // serialize: one hidden window, one decode at a time
  return queue;
}

async function grabPosterNow(clipPath, outPath, { seek = DEFAULT_SEEK } = {}) {
  const clip = path.resolve(clipPath);
  if (!fs.existsSync(clip)) return { ok: false, error: "That video file could not be found." };

  // The page lives beside the clip so it can load it as a same-directory relative URL.
  // A temp dir of our own, with the clip copied in, keeps us from writing into the
  // designer's project folder just to take a picture.
  let workDir = null;
  try {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "ta-poster-"));
    const localClip = path.join(workDir, "clip" + (path.extname(clip) || ".mp4"));
    fs.copyFileSync(clip, localClip);
    const pagePath = path.join(workDir, "grab.html");
    fs.writeFileSync(pagePath, "<!doctype html><body style='margin:0'></body>");

    const w = getWindow();
    await w.loadFile(pagePath);

    const out = await w.webContents.executeJavaScript(`(async () => {
      const v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.preload = "auto";
      v.src = ${JSON.stringify(path.basename(localClip))};
      document.body.appendChild(v);
      await new Promise((res, rej) => {
        v.addEventListener("loadeddata", () => res(), { once: true });
        v.addEventListener("error", () => rej(new Error(
          "the file could not be decoded (" + ((v.error && v.error.code) || "?") + ")")), { once: true });
        setTimeout(() => rej(new Error("timed out reading the video")), ${LOAD_TIMEOUT});
      });
      if (!v.videoWidth || !v.videoHeight) throw new Error("the file has no video track");
      // Seek past the opening frames, but never past the end of a very short clip.
      const at = Math.min(${seek}, Math.max(0, (v.duration || 0) - 0.1));
      if (at > 0) {
        await new Promise((res, rej) => {
          v.addEventListener("seeked", () => res(), { once: true });
          setTimeout(() => rej(new Error("timed out seeking the video")), ${LOAD_TIMEOUT});
          v.currentTime = at;
        });
      }
      const c = document.createElement("canvas");
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d").drawImage(v, 0, 0);
      return { w: v.videoWidth, h: v.videoHeight, duration: v.duration || null,
               data: c.toDataURL("image/jpeg", 0.9) };
    })()`);

    const b64 = String(out.data || "").split(",")[1] || "";
    if (!b64) return { ok: false, error: "No frame came back from the video." };
    const bytes = Buffer.from(b64, "base64");
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(outPath, bytes);
    return { ok: true, width: out.w, height: out.h, duration: out.duration, bytes: bytes.length };
  } catch (e) {
    return { ok: false, error: (e && e.message) || String(e) };
  } finally {
    // The window stays; only this call's scratch directory goes. Drop the <video> so it
    // stops holding the file, WITHOUT awaiting a navigation: awaiting one here can sit
    // forever while the next queued call waits on this finally block.
    try { if (win && !win.isDestroyed()) win.webContents.executeJavaScript("document.body.innerHTML = ''", true).catch(() => {}); } catch { /* fine */ }
    try { if (workDir) fs.rmSync(workDir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

module.exports = { grabPoster, closePosterWindow };
