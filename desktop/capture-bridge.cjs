// Native capture bridge (Electron main process).
//
// A loopback HTTP server backed by a HIDDEN BrowserWindow, so the app-owned
// export scripts can serialize the running preview's DOM WITHOUT puppeteer —
// which can't be installed in a packaged .dmg (read-only Resources, no npm). The
// reconstruct/page scripts run as spawned subprocesses and can't open a
// BrowserWindow themselves, so they drive this bridge over HTTP via
// scripts/lib/page-driver.mjs → RemotePageDriver.
//
// Exposes exactly the puppeteer-Page primitives the capture scripts use:
//   goto / viewport (setContentSize) / waitSelector (poll) / evaluate
//   (webContents.executeJavaScript) / close (destroy the window).
//
// Loopback-only + a per-launch token. Ops are serialized (captures are
// sequential) so one window is reused across a run and never races itself.

const http = require("node:http");
const crypto = require("node:crypto");
const { BrowserWindow } = require("electron");

let server = null;
let token = null;
let win = null;              // the hidden capture window (created lazily)
let queue = Promise.resolve(); // op serializer

function getWindow() {
  if (win && !win.isDestroyed()) return win;
  win = new BrowserWindow({
    show: false,        // hidden: the renderer still lays out, so getBoundingClientRect is real
    width: 1440,
    height: 900,
    webPreferences: {
      backgroundThrottling: false, // a hidden window must keep laying out / painting
      // Isolated in-memory session (not "persist:") so the liveCapture webRequest
      // hook sees ONLY this window's traffic — never the main app's requests.
      partition: "capture-bridge",
      // executeJavaScript runs in the page's main world regardless of isolation;
      // no preload needed. Defaults (contextIsolation, sandbox) stay secure.
    },
  });
  return win;
}

function destroyWindow() {
  if (win && !win.isDestroyed()) win.destroy();
  win = null;
}

async function handleOp(op) {
  switch (op.op) {
    case "goto": {
      const w = getWindow();
      try {
        await w.loadURL(op.url);
      } catch (e) {
        // ERR_ABORTED (-3) fires on client-side redirects / HMR races even though
        // the page loads fine. The scripts always follow goto with an explicit
        // waitSelector, so tolerate aborts and rethrow only genuine failures.
        if (!/ERR_ABORTED|\(-3\)/.test(String(e && e.message))) throw e;
      }
      return { ok: true };
    }
    case "viewport": {
      // setContentSize sets the web content area (= window.innerWidth/innerHeight
      // in CSS px), so responsive CSS reflows at the real breakpoint width.
      getWindow().setContentSize(Math.round(op.width), Math.round(op.height));
      return { ok: true };
    }
    case "waitSelector": {
      const wc = getWindow().webContents;
      const timeout = op.timeout ?? 15000;
      const start = Date.now();
      const sel = JSON.stringify(op.selector);
      for (;;) {
        const present = await wc.executeJavaScript(`!!document.querySelector(${sel})`, true);
        if (present) return { ok: true };
        if (Date.now() - start > timeout) return { ok: false, error: `waitForSelector timeout: ${op.selector}` };
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    case "evaluate": {
      const wc = getWindow().webContents;
      // executeJavaScript awaits the completion value, so an async IIFE (settle /
      // image re-encode) resolves before we return. userGesture:true keeps
      // gesture-gated APIs (e.g. clipboard) available; harmless otherwise.
      const result = await wc.executeJavaScript(op.code, true);
      return { ok: true, result };
    }
    case "screenshot": {
      // Rasterize via CDP with captureBeyondViewport → a true full-page PNG even
      // though the window is hidden (the same path puppeteer uses internally).
      const wc = getWindow().webContents;
      const dbg = wc.debugger;
      try { if (!dbg.isAttached()) dbg.attach("1.3"); } catch { /* already attached */ }
      const params = { format: "png", captureBeyondViewport: !!op.fullPage };
      if (op.fullPage) {
        const m = await dbg.sendCommand("Page.getLayoutMetrics");
        const size = m.cssContentSize || m.contentSize;
        params.clip = { x: 0, y: 0, width: Math.ceil(size.width), height: Math.ceil(size.height), scale: 1 };
      }
      const shot = await dbg.sendCommand("Page.captureScreenshot", params);
      return { ok: true, dataUrl: shot.data }; // CDP returns base64
    }
    case "liveCapture": {
      const wc = getWindow().webContents;
      // 1. Inject Figma's html.to.design capture.js.
      await wc.executeJavaScript(
        `new Promise((res, rej) => { const s = document.createElement("script"); s.src = ${JSON.stringify(op.captureJsUrl)}; s.onload = () => res(true); s.onerror = () => rej(new Error("capture.js load failed")); document.head.appendChild(s); })`,
        true,
      );
      // 2. Wait for captureForDesign to exist (bounded).
      const t0 = Date.now();
      for (;;) {
        const ready = await wc.executeJavaScript("typeof window.figma?.captureForDesign === 'function'", true);
        if (ready) break;
        if (Date.now() - t0 > 15000) return { ok: false, error: "captureForDesign never appeared" };
        await new Promise((r) => setTimeout(r, 100));
      }
      // 3. Fire it, and resolve on the real /submit POST (captureForDesign's own
      //    promise hangs after the capture lands). Watch via this session's
      //    webRequest — isolated to the capture partition. Bounded fallback.
      const outcome = await new Promise((resolve) => {
        let done = false;
        const finish = (v) => {
          if (done) return;
          done = true;
          try { wc.session.webRequest.onCompleted({ urls: ["*://*/*"] }, null); } catch { /* detach */ }
          resolve(v);
        };
        wc.session.webRequest.onCompleted({ urls: ["*://*/*"] }, (details) => {
          if (details.url.includes(op.submitPath)) finish(`posted ${details.statusCode}`);
        });
        wc.executeJavaScript(
          `window.figma.captureForDesign(${JSON.stringify({ captureId: op.captureId, endpoint: op.endpoint, selector: op.selector })})`,
          true,
        ).catch(() => {});
        setTimeout(() => finish("no-post-15s"), 15000);
      });
      return { ok: true, outcome };
    }
    case "close": {
      destroyWindow();
      return { ok: true };
    }
    default:
      return { ok: false, error: `unknown op '${op.op}'` };
  }
}

// Serialize ops onto a single chain so a stray overlap can never drive one
// window concurrently (the client is sequential, but be defensive).
function enqueue(fn) {
  const run = queue.then(fn, fn);
  queue = run.then(() => {}, () => {});
  return run;
}

/**
 * Start the bridge. Resolves to { port, token }; inject them into the agent env
 * as TA_CAPTURE_ENDPOINT (http://127.0.0.1:<port>) + TA_CAPTURE_TOKEN so the
 * spawned export scripts pick the RemotePageDriver. Idempotent.
 */
function startCaptureBridge() {
  if (server) return Promise.resolve({ port: server.address().port, token });
  token = crypto.randomBytes(16).toString("hex");
  server = http.createServer((req, res) => {
    if (req.method !== "POST") { res.writeHead(405); return res.end(); }
    if (req.headers["x-capture-token"] !== token) { res.writeHead(401); return res.end(); }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      let op;
      try { op = JSON.parse(body); }
      catch { res.writeHead(400, { "content-type": "application/json" }); return res.end('{"ok":false,"error":"bad json"}'); }
      let out;
      try { out = await enqueue(() => handleOp(op)); }
      catch (e) { out = { ok: false, error: String((e && e.message) || e) }; }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(out));
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    // Port 0 → OS picks a free ephemeral port; 127.0.0.1 → loopback only. The
    // port is only valid after 'listening'.
    server.listen(0, "127.0.0.1", () => resolve({ port: server.address().port, token }));
  });
}

function stopCaptureBridge() {
  destroyWindow();
  if (server) { try { server.close(); } catch { /* ignore */ } server = null; }
}

module.exports = { startCaptureBridge, stopCaptureBridge };
