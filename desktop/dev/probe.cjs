// Dev utility: load a URL in a hidden window and print console messages + a text
// excerpt, for diagnosing a blank render. Usage: npx electron desktop/dev/probe.cjs <url>
const { app, BrowserWindow } = require("electron");
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1440, height: 900 });
  win.webContents.on("console-message", (_e, level, msg) => { if (level >= 2) console.log("[console]", msg.slice(0, 400)); });
  await win.loadURL(process.argv[2]);
  await new Promise((r) => setTimeout(r, 2500));
  const text = await win.webContents.executeJavaScript("document.body.innerText.slice(0, 300)");
  const blocks = await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('[data-block]')).map(e=>e.dataset.block).join(',')");
  console.log("[text]", JSON.stringify(text)); console.log("[blocks]", blocks || "(none)");
  app.quit();
}).catch((e) => { console.error(e); app.exit(1); });
