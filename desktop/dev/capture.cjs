// Dev utility: full-page captures of a URL at desktop + mobile widths via a hidden
// Electron window. Usage (from the repo root, with ELECTRON_RUN_AS_NODE unset):
//   npx electron desktop/dev/capture.cjs <outDir> [url] [desktop|mobile]
// (one width per process: a second loadURL in the same process fails with
// ERR_FAILED against a static preview server, so run twice for both.)
// Scroll-reveal elements (.js [data-reveal]) are forced visible so the whole page
// renders in one capture without scrolling.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const out = process.argv[2];
const url = process.argv[3] || "http://localhost:4321/";
const ALL = { desktop: 1440, mobile: 390 };
const which = process.argv[4];
const shots = which ? [[which, ALL[which]]] : Object.entries(ALL);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  for (const [name, width] of shots) {
    const win = new BrowserWindow({ show: false, width, height: 900 });
    await win.loadURL(url);
    // Reveal everything, and pin viewport-height sections (100dvh heroes) to the
    // initial window height so growing the window to the page height doesn't
    // stretch them across the whole capture.
    await win.webContents.insertCSS(
      ".js [data-reveal]{opacity:1!important;transform:none!important;transition:none!important}" +
      "[data-block=hero]{min-height:900px!important;height:900px!important}",
    );
    await wait(1200);
    const h = await win.webContents.executeJavaScript("document.documentElement.scrollHeight");
    const height = Math.min(Math.max(h || 900, 900), 14000);
    win.setSize(width, height);
    await wait(900);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(out, `vh-${name}.png`), img.toPNG());
    console.log(`${name}: ${width}x${height} -> vh-${name}.png`);
    win.destroy();
  }
  app.quit();
}).catch((e) => { console.error(e); app.exit(1); });
