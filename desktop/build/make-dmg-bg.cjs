// Renders the DMG installer-window background (white, logo, arrow, "drag to install"
// caption in Kelly Slab) via headless Electron at 2x, downscales to 1x with sips, and
// combines both into a retina multi-resolution TIFF for electron-builder.
// Run: <electron> desktop/build/make-dmg-bg.cjs
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

app.commandLine.appendSwitch("force-device-scale-factor", "1"); // deterministic pixels

const OUT = __dirname;
const W = 680, H = 420, S = 2; // logical size + supersample factor
const logo = fs.readFileSync(path.join(OUT, "dmg-logo.svg"), "utf8");

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com">
<link href="https://fonts.googleapis.com/css2?family=Kelly+Slab&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;padding:0}
  body{width:${W}px;height:${H}px;background:#ffffff;position:relative;overflow:hidden;zoom:${S}}
  .logo{position:absolute;top:38px;left:50%;transform:translateX(-50%);width:300px}
  .logo svg{width:100%;height:auto;display:block}
  .arrow{position:absolute;top:236px;left:256px;width:168px;height:26px}
  .caption{position:absolute;bottom:34px;left:0;width:100%;text-align:center;
    font-family:'Kelly Slab',serif;font-size:16px;color:#3a3a3a;letter-spacing:.2px}
</style></head><body>
  <div class="logo">${logo}</div>
  <svg class="arrow" viewBox="0 0 168 26" fill="none">
    <line x1="2" y1="13" x2="148" y2="13" stroke="#cfcfcf" stroke-width="3" stroke-linecap="round"/>
    <path d="M147 4 L166 13 L147 22" stroke="#cfcfcf" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>
  <div class="caption">Drag thinkany design into Applications</div>
</body></html>`;

app.whenReady().then(async () => {
  if (app.dock) app.dock.hide();
  const win = new BrowserWindow({ width: W * S, height: H * S, useContentSize: true, show: false, frame: false });
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  try { await win.webContents.executeJavaScript("document.fonts.ready.then(()=>1)"); } catch {}
  await new Promise((r) => setTimeout(r, 900));
  const img = await win.webContents.capturePage();
  const at2x = path.join(OUT, "dmg-background@2x.png");
  const at1x = path.join(OUT, "dmg-background.png");
  const tiff = path.join(OUT, "dmg-background.tiff");
  fs.writeFileSync(at2x, img.toPNG());
  win.destroy();
  execFileSync("sips", ["-z", String(H * S), String(W * S), at2x]);              // normalize 2x → 1360x840
  execFileSync("sips", ["-z", String(H), String(W), at2x, "--out", at1x]);       // downscale → 680x420
  execFileSync("tiffutil", ["-cathidpicheck", at1x, at2x, "-out", tiff]);        // retina TIFF
  console.log("[dmg-bg] wrote", path.basename(at1x), path.basename(at2x), path.basename(tiff));
  app.quit();
});
