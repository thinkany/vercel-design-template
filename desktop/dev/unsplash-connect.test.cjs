// ©2026 thinkany llc. All rights reserved.
// CONNECT WITH UNSPLASH TEST: `node desktop/dev/unsplash-connect.test.cjs`.
//
// Unsplash's API guidelines say an app must not send its users off to register their own
// developer keys; the sanctioned route is Dynamic Client Registration through ONE parent
// application whose secret stays on the server. These pins keep that shape: the app
// opens the sign-in, catches the callback on its own loopback port, hands the code to
// derive, and stores what comes back exactly like a pasted key (validated first). The
// parent secret never appears in the app, and the pasted-key path stays as the fallback.
// (The derive half is tested in the derive repo: unsplash.test.mjs.)
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const D = path.join(__dirname, "..");
const main = fs.readFileSync(path.join(D, "main.cjs"), "utf8");
const shell = fs.readFileSync(path.join(D, "shell.js"), "utf8");
const copy = fs.readFileSync(path.join(D, "copy.js"), "utf8");
const preload = fs.readFileSync(path.join(D, "preload.cjs"), "utf8");
const agent = fs.readFileSync(path.join(D, "agent.mjs"), "utf8");
const skill = fs.readFileSync(path.join(D, "skills", "design.md"), "utf8");
const script = fs.readFileSync(path.join(D, "..", "scripts", "find-images.mjs"), "utf8");
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const handler = (name) => {
  const i = main.indexOf(`ipcMain.handle("${name}"`);
  assert.ok(i > -1, `${name} handler not found`);
  const next = main.indexOf("ipcMain.handle(", i + 10);
  return main.slice(i, next > -1 ? next : i + 2000);
};
const fn = (src, name) => {
  const i = src.indexOf(`function ${name}(`);
  assert.ok(i > -1, `${name} not found`);
  return src.slice(i, src.indexOf("\n}\n", i));
};

// ---- The loopback listener ---------------------------------------------------
const port = /const UNSPLASH_OAUTH_PORT = (\d+);/.exec(main);
const vport = /const VERCEL_OAUTH_PORT = (\d+);/.exec(main);
ok(port && vport && port[1] !== vport[1], "Unsplash listens on its own loopback port, not Vercel's");
ok(/const UNSPLASH_REDIRECT_URI = `http:\/\/127\.0\.0\.1:\$\{UNSPLASH_OAUTH_PORT\}\/callback`/.test(main),
  "the redirect is the loopback /callback (what derive allows and the parent app registers)");
const run = fn(main, "runUnsplashConnect");
ok(/op: "start"/.test(run) && /op: "exchange"/.test(run), "the flow asks derive to start, then to exchange the code");
ok(/redirectUri: UNSPLASH_REDIRECT_URI/.test(run), "both calls carry the same redirect");
ok(/server\.listen\(UNSPLASH_OAUTH_PORT, "127\.0\.0\.1"/.test(run), "the listener binds loopback only");
ok(/shell\.openExternal\(authUrl\)/.test(run), "the sign-in opens in the designer's browser");
ok(/^https:\\\/\\\/unsplash\\\.com\\\//.test(run.match(/\/\^https:[^/]+\//)[0].slice(1, -1)) || /unsplash\\\.com/.test(run),
  "the URL derive returns must be on unsplash.com before it is opened");
ok(/if \(retState !== state\)/.test(run) && !/retState !== null/.test(run), "the callback's state must match this attempt (Unsplash echoes it; seen live)");
ok(/access_denied/.test(run), "a refused Allow reads as the designer's choice, not a failure");
ok(/oauthResultPage\(ok, msg, "Unsplash"\)/.test(run), "the browser's result page names Unsplash");
ok(!/client_secret|clientSecret/.test(main), "the parent application's secret never appears in the app");
ok(!/unsplash\.com\/oauth\/token|api\.unsplash\.com\/clients/.test(main), "the app never talks to the token or clients endpoints itself: derive does");

// ---- Where the exchange goes ------------------------------------------------
const ep = fn(main, "unsplashConnectEndpoint");
ok(/UNSPLASH_CONNECT_ENDPOINT/.test(ep), "UNSPLASH_CONNECT_ENDPOINT overrides the endpoint (dev, tests)");
ok(/\/api\/unsplash/.test(ep) && /DERIVE_ENDPOINT/.test(ep), "otherwise it is derive's /api/unsplash, beside /api/derive");
const post = fn(main, "unsplashConnectPost");
ok(/"x-license-key": \(process\.env\.DESIGN_LICENSE_KEY/.test(post), "the call carries the Design licence, which gates the exchange on derive");
ok(/AbortController/.test(post), "and gives up on a silent server rather than hanging the button");

// ---- The IPC handler ---------------------------------------------------------
const h = handler("unsplash:connect");
ok(/if \(rehearsing\(\)\)/.test(h) && h.indexOf("rehearsing()") < h.indexOf("storeUnsplashKey("), "rehearsal bails before anything is stored");
ok(/DESIGN_LICENSE_KEY/.test(h) && /needsLicense: true/.test(h), "without the Design licence it says so instead of calling derive");
ok(h.indexOf("validateUnsplashKey(") > -1 && h.indexOf("validateUnsplashKey(") < h.indexOf("storeUnsplashKey("), "the minted key is validated before it is stored, like a pasted one");
ok(/process\.env\.UNSPLASH_ACCESS_KEY = r\.accessKey/.test(h), "and injected as UNSPLASH_ACCESS_KEY, so the script needs no new seam");
ok(/saveUnsplashConnect\(\{ via: "unsplash"/.test(h), "the connection remembers it came through the account");
ok(/via/.test(handler("unsplash:status")), "status says which way the key arrived");
ok(/removeUnsplashConnect\(\)/.test(handler("unsplash:save")), "a pasted key replaces that memory");
ok(/removeUnsplashConnect\(\)/.test(handler("unsplash:clear")), "and unplugging clears it");
ok(/connectUnsplash: \(\) => ipcRenderer\.invoke\("unsplash:connect"\)/.test(preload), "preload exposes connectUnsplash");

// ---- The renderer ------------------------------------------------------------
const ls = shell.slice(shell.indexOf("async function licenseSection"), shell.indexOf("function unsplashConnectOpts"));
ok(/if \(!opts\.connect\) \{[\s\S]{0,120}body\.append\(\.\.\.fieldEls, saveBtn, msg\);\s*\n\s*return;\s*\n\s*\}/.test(ls), "rows without a connect offer render exactly as before");
ok(/connectBtn\.className = "panelbtn primary"/.test(ls), "the connect button is the primary action");
ok(/ownFold\.hidden = true/.test(ls), "the own-key steps and field start folded away");
ok(/if \(opts\.stepsHtml\) \{ ownFold\.appendChild\(stepsEl\(\)\);/.test(ls), "the how-to-get-a-key steps live inside that fold, not above the button");
ok(/if \(opts\.connect && lic\.via\)/.test(ls), "a connected row says whether it came through the account or a pasted key");
ok(/const res = await c\.run\(\);[\s\S]{0,200}if \(opts\.onConnected\) opts\.onConnected\(res\);/.test(ls), "a successful connect reports to the host the way a save does (the stepper relies on it)");
const drawer = shell.slice(shell.indexOf("const unsplashFold = licensesFold("), shell.indexOf("const pexelsFold = licensesFold("));
ok(/connect: unsplashConnectOpts\(\)/.test(drawer), "the Keys drawer's Unsplash row offers the connect");
const media = shell.slice(shell.indexOf('id: "media"'), shell.indexOf("const SETUP_STEPS ="));
const uLib = media.slice(media.indexOf('id: "unsplash"'), media.indexOf('id: "pexels"'));
ok(/connect: unsplashConnectOpts\(\)/.test(uLib), "so does the setup walk-through's Unsplash card");
for (const lib of ["pexels", "pixabay"]) {
  const i = media.indexOf(`id: "${lib}"`);
  ok(!/connect:/.test(media.slice(i, i + 400)), `${lib} has no connect (no OAuth path there): it stays a pasted key`);
}
ok(/connect: lib\.connect \|\| null/.test(media), "the walk-through passes the offer through to the row");
ok(/run: \(\) => window\.desktop\.connectUnsplash\(\)/.test(shell), "the offer runs the IPC connect");

// ---- What the designer reads -------------------------------------------------
for (const k of ["unsplashConnect", "unsplashConnecting", "unsplashConnectHint", "unsplashOwnKeyToggle", "unsplashOwnKeyHide", "unsplashCouldNotConnect", "unsplashHow", "unsplashViaAccount", "unsplashViaOwnKey"]) {
  ok(new RegExp(`\\n    ${k}:`).test(copy), `copy.licenses.${k} exists`);
}
const desc = /unsplashDesc: "([^"]+)"/.exec(copy)[1];
ok(/served from Unsplash/.test(desc) && /replace any of them/.test(desc), "the row says photos are served from Unsplash and can be replaced");
const offer = /unsplashOffer: "([^"]+)"/.exec(copy)[1];
ok(/served from Unsplash/.test(offer) && /replace/.test(offer), "so does the walk-through card");
ok(/Unsplash asks that its photos are shown from Unsplash/.test(copy), "and the help card behind the lifesaver");
ok(!/—/.test(copy.slice(copy.indexOf("unsplashLabel:"), copy.indexOf("pexelsLabel:"))), "no em-dashes in the Unsplash copy");

// ---- Hotlinking: the terms the parent app is reviewed on ------------------------
const uSrc = script.slice(script.indexOf("  unsplash: {"), script.indexOf("  pexels: {"));
ok(/hotlink: true/.test(uSrc), "Unsplash is a hotlinked source");
ok(/download_location/.test(uSrc) && !/arrayBuffer/.test(uSrc), "it still pings the download endpoint, and no longer copies the bytes");
ok(/auto=format|"auto", "format"/.test(script) && /export function unsplashSrc/.test(script), "the src is sized on their CDN with auto=format");
ok(/if \(lib\.hotlink\) \{/.test(script) && /recordCredit\(ROOT, `\$\{key\.origin\}\$\{key\.pathname\}`, \{ \.\.\.credit, src \}\)/.test(script), "`get` records the credit keyed by the photo's CDN path (no size) and writes no file");
ok(/hotlinked: true, src, srcset/.test(agent), "the agent prompt explains the hotlinked result");
ok(/their own image at any time/.test(agent), "and tells the designer photos can be swapped");
ok(/From Unsplash, `get` copies nothing/.test(skill), "the design skill says the same");
ok(/never\s+`curl` it into `public\/`/.test(skill), "and forbids copying it down");

console.log(`unsplash-connect: ${checks} checks pass.`);
