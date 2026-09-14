// ©2026 thinkany llc. All rights reserved.
// KEY CLIPBOARD TEST: `node desktop/dev/key-clipboard.test.cjs`.
//
// Pexels and Pixabay have no sign-in path (one key per account), so the paste flow is
// trimmed instead: clicking a sign-up link arms a clipboard watch, and when the window
// regains focus a clipboard value of that library's shape is filled in and checked. A
// paste is checked on its own too. The shapes live in main, which only ever answers
// with a match, so clipboard text of any other kind never reaches the renderer.
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const D = path.join(__dirname, "..");
const main = fs.readFileSync(path.join(D, "main.cjs"), "utf8");
const shell = fs.readFileSync(path.join(D, "shell.js"), "utf8");
const preload = fs.readFileSync(path.join(D, "preload.cjs"), "utf8");
const copy = fs.readFileSync(path.join(D, "copy.js"), "utf8");
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };

// ---- The shapes, run for real ---------------------------------------------------
const shapesSrc = /const KEY_SHAPES = \{[\s\S]*?\n\};\nfunction keyFromClipboard[\s\S]*?\n\}\n/.exec(main);
ok(shapesSrc, "KEY_SHAPES + keyFromClipboard are findable in main");
const { keyFromClipboard } = new Function(shapesSrc[0] + "\nreturn { keyFromClipboard };")();
const U = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE"; // 43
const P = "563492ad6f917000010000015a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d"; // 56
const X = "12345678-abcdef0123456789abcdef012"; // <id>-<25 hex>
ok(U.length === 43 && P.length === 56, "the sample keys have the real lengths");
const C = "sk-ant-api03-" + "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789".repeat(3) + "-AbCdAA"; // ~120 chars
ok(keyFromClipboard("claude", C) === C, "an Anthropic Console key matches its shape");
ok(keyFromClipboard("claude", "sk-ant-short") === null, "a truncated copy is not taken as a key");
ok(keyFromClipboard("claude", U) === null && keyFromClipboard("unsplash", C) === null, "Claude and library keys never cross shapes");
ok(keyFromClipboard("unsplash", U) === U, "an Unsplash Access Key matches its shape");
ok(keyFromClipboard("pexels", P) === P, "a Pexels key matches its shape");
ok(keyFromClipboard("pixabay", X) === X, "a Pixabay key matches its shape");
ok(keyFromClipboard("pexels", `  ${P}\n`) === P, "surrounding whitespace from the copy is trimmed");
ok(keyFromClipboard("pexels", U) === null, "an Unsplash key is not taken as a Pexels one (length)");
ok(keyFromClipboard("unsplash", P) === null, "nor the other way round");
ok(keyFromClipboard("pixabay", P) === null, "a Pexels key is not a Pixabay one");
for (const junk of ["", "hello world", "https://www.pexels.com/api/key/", "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789", "Dear designer, your key is 1234", P + " and more"]) {
  ok(keyFromClipboard("pexels", junk) === null && keyFromClipboard("pixabay", junk) === null && keyFromClipboard("unsplash", junk) === null,
    `ordinary clipboard text never crosses: ${JSON.stringify(junk).slice(0, 40)}`);
}
ok(keyFromClipboard("nope", P) === null, "an unknown shape answers null, never the text");
ok(keyFromClipboard("cloudflareAccount", "0123456789abcdef0123456789ABCDEF") === "0123456789abcdef0123456789ABCDEF", "a Cloudflare Account ID (32 hex) matches its own shape");
ok(keyFromClipboard("cloudflare", "0123456789abcdef0123456789abcdef") === null, "and is not taken as a token");

// ---- Main answers only a match -----------------------------------------------------
const h = main.slice(main.indexOf('ipcMain.handle("clipboard:key"'), main.indexOf('ipcMain.handle("clipboard:key"') + 400);
ok(/clipboard\.readText\(\)/.test(h) && /return keyFromClipboard\(shape, text\)/.test(h), "the handler reads the clipboard in main and returns the shape match or null");
ok(/nativeImage, clipboard \} = require\("electron"\)/.test(main), "clipboard comes from electron's main-process API");
ok(/readClipboardKey: \(shape\) => ipcRenderer\.invoke\("clipboard:key", \{ shape \}\)/.test(preload), "preload exposes readClipboardKey(shape)");

// ---- The row: arm on a sign-up link, fill on focus, check on paste --------------------
const ls = shell.slice(shell.indexOf("async function licenseSection"), shell.indexOf("function unsplashConnectOpts"));
ok(/input\.addEventListener\("paste", \(\) => setTimeout\(\(\) => \{ if \(input\.value\.trim\(\)\) doSave\(\); \}, 0\)\)/.test(ls), "a paste is checked straight away");
ok(/e\.target\.closest\("a\[href\]"\)\) armed = Date\.now\(\)/.test(ls), "clicking a link in the steps arms the watch");
ok(/window\.addEventListener\("focus", onFocus\)/.test(ls), "the window's focus (coming back from the browser) triggers the read");
ok(/window\.addEventListener\("blur", onBlur\)/.test(ls) && /if \(opts\.keyShape && fieldInView\(\)\) armed = Date\.now\(\)/.test(ls), "leaving the app with an empty key field in view arms the watch too (the site may already be open)");
ok(/el\.offsetParent !== null && !el\.value\.trim\(\)/.test(ls), "in view means visible (not in a shut fold) and empty");
ok(/if \(!extraMissing\(\) \|\| !opts\.extraField\.keyShape\) return;[\s\S]{0,120}readClipboardKey\(opts\.extraField\.keyShape\)/.test(ls), "once the key is in, a required second field is filled from the clipboard by its own shape");
ok(/keyShape: "cloudflareAccount"/.test(shell), "the Turnstile card's Account ID field uses that");
ok(/mainWindow\.webContents\.setWindowOpenHandler\(\(\{ url \}\) => \{\s*\n\s*if \(\/\^https\?:\\\/\\\/\/\.test\(url\)\) shell\.openExternal\(url\);\s*\n\s*return \{ action: "deny" \};/.test(main),
  "a target=_blank link in the app opens in the designer's browser, where the address bar is (an Account ID lives there)");
ok(/if \(!document\.contains\(input\)\) \{ window\.removeEventListener\("focus", onFocus\); return; \}/.test(ls), "a torn-down row unhooks itself");
ok(/!opts\.keyShape \|\| !armed \|\| Date\.now\(\) - armed > 10 \* 60 \* 1000 \|\| saveBtn\.disabled/.test(ls) && /if \(input\.value\.trim\(\)\) \{\s*\n\s*if \(!extraMissing\(\)/.test(ls),
  "no read unless armed within ten minutes and nothing is in flight; a filled key field only ever reads for a missing second field");
ok(/readClipboardKey\(opts\.keyShape\)/.test(ls), "the read names this row's shape, so main matches only that library");
ok(/armed = 0;\s*\n\s*if \(typeof revealOwnKey === "function"\) revealOwnKey\(\);\s*\n\s*input\.value = k;/.test(ls), "a match disarms, opens the own-key fold when there is one, and fills the field");
ok(/msg\.textContent = COPY\.licenses\.fromClipboard;[\s\S]{0,80}doSave\(\);/.test(ls), "then says where it came from and checks it");
ok(/if \(opts\.stepsHtml && !lic\.hasLicense\) armOnLinks\(body\);/.test(ls), "a plain row arms on its own steps");
ok(/body\.append\(\.\.\.fieldEls, saveBtn, msg\)/.test(ls), "and appends its fields (key, then any second field) with Save");
ok(/if \(opts\.stepsHtml\) \{ ownFold\.appendChild\(stepsEl\(\)\); armOnLinks\(ownFold\); \}/.test(ls), "a connect row arms on the steps inside its own-key fold");
ok(/\n    fromClipboard: "/.test(copy), "copy.licenses.fromClipboard exists");

// ---- The Claude key row: no sign-in path exists, so it gets the trimmed paste too -----------
const ck = shell.slice(shell.indexOf("async function claudeKeySection"), shell.indexOf("async function licenseSection"));
ok(/input\.addEventListener\("paste", \(\) => setTimeout\(\(\) => \{ if \(input\.value\.trim\(\)\) doSave\(\); \}, 0\)\)/.test(ck), "a pasted Claude key is checked straight away");
ok(/\/console\\\.anthropic\\\.com\/\.test\(a\.href\)\) armed = Date\.now\(\)/.test(ck), "a click on a console.anthropic.com link (anywhere: the setup step's steps sit outside the row) arms the watch");
ok(/document\.addEventListener\("click", armOnConsoleLink\)/.test(ck) && /document\.removeEventListener\("click", armOnConsoleLink\)/.test(ck), "the document-wide arm listener unhooks itself once the row is gone");
ok(/readClipboardKey\("claude"\)/.test(ck), "the read asks for Claude's shape");
ok(/window\.addEventListener\("blur", onBlur\)/.test(ck), "the Claude row arms on leaving the app too");
ok(/!armed \|\| Date\.now\(\) - armed > 10 \* 60 \* 1000 \|\| input\.value\.trim\(\) \|\| saveBtn\.disabled/.test(ck), "same guards: armed, within ten minutes, empty field, nothing in flight");
ok(/msg\.textContent = COPY\.licenses\.fromClipboard;[\s\S]{0,80}doSave\(\);/.test(ck), "a match is labelled and checked");

// ---- Every library row in both hosts names its shape -------------------------------------
const drawer = shell.slice(shell.indexOf("async function renderLicenses"), shell.indexOf("async function renderLicenses") + 6000);
for (const [lib, shape] of [["Unsplash", "unsplash"], ["Pexels", "pexels"], ["Pixabay", "pixabay"]]) {
  const i = drawer.indexOf(`stepsHtml: COPY.licenses.${shape}StepsHtml`);
  ok(i > -1 && new RegExp(`keyShape: "${shape}"`).test(drawer.slice(i, i + 200)), `the drawer's ${lib} row passes keyShape "${shape}"`);
}
const media = shell.slice(shell.indexOf('id: "media"'), shell.indexOf("const SETUP_STEPS ="));
ok(/keyShape: lib\.id/.test(media), "the walk-through passes each library's id as its shape");

console.log(`key-clipboard: ${checks} checks pass.`);
