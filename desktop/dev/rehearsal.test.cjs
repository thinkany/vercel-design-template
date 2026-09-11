// ©2026 thinkany llc. All rights reserved.
// REHEARSAL TEST — `node desktop/dev/rehearsal.test.cjs`.
//
// The Developer menu's "Walk through onboarding" makes the app PRETEND to be a fresh
// install. The whole point is that it touches nothing: walk the flow, type whatever, and
// your real keys, licences and usage choice are exactly as they were. This reads main.cjs
// and checks every handler that could break that promise is guarded.
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "main.cjs"), "utf8");
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };

/** The body of one ipcMain.handle("<name>", ...) registration. */
function handler(name) {
  const i = src.indexOf(`ipcMain.handle("${name}"`);
  assert.ok(i > -1, `${name} handler not found`);
  // To the next registration, which is close enough to bound one handler.
  const next = src.indexOf("ipcMain.handle(", i + 10);
  return src.slice(i, next > -1 ? next : i + 2000);
}

// ---- Nothing is WRITTEN while rehearsing ------------------------------------
// Each of these stores or deletes a real credential, so each must bail out first.
for (const h of [
  "key:save", "key:clear",
  "license:save", "license:clear",
  "license:designSave", "license:designClear",
  "unsplash:save", "unsplash:clear",
  "pexels:save", "pexels:clear",
  "pixabay:save", "pixabay:clear",
  "usage:set",
]) {
  ok(/if \(rehearsing\(\)\)/.test(handler(h)), `${h} must bail out while rehearsing (it writes real state)`);
}

// The guard has to come BEFORE the write, or it guards nothing.
for (const [h, write] of [
  ["key:save", "storeKey("],
  ["license:designSave", "storeDesignLicense("],
  ["unsplash:save", "storeUnsplashKey("],
  ["pexels:save", "storePexelsKey("],
  ["pixabay:save", "storePixabayKey("],
  ["usage:set", "setUiState("],
]) {
  const body = handler(h);
  const g = body.indexOf("rehearsing()"), w = body.indexOf(write);
  ok(g > -1 && w > -1 && g < w, `${h}: the rehearsal guard must come before ${write}`);
}

// ---- Everything READS as a fresh install ------------------------------------
for (const h of [
  "key:status", "usage:get", "license:status", "license:designStatus",
  "unsplash:status", "pexels:status", "pixabay:status", "video:sources",
]) {
  ok(/rehearsing\(\)|asFreshInstall\(/.test(handler(h)), `${h} must report a fresh install while rehearsing`);
}

// ---- It can only ever be a dev thing ----------------------------------------
ok(/const rehearsing = \(\) => onboardingRehearsal && !app\.isPackaged;/.test(src),
  "rehearsing() is false in a packaged build, whatever the flag says");
ok(/dev:rehearseOnboarding[\s\S]{0,240}app\.isPackaged/.test(src),
  "the IPC that turns it on refuses in a packaged build");
const menu = src.slice(src.indexOf('label: "Developer"'), src.indexOf('label: "Developer"') + 2500);
ok(/Walk through onboarding/.test(menu), "the menu item lives inside the dev-only Developer submenu");

// ---- The renderer restores what it stashed ----------------------------------
const shell = fs.readFileSync(path.join(__dirname, "..", "shell.js"), "utf8");
ok(/stashedTourFlags/.test(shell), "the tour flags are stashed, not deleted");
const fn = shell.slice(shell.indexOf("async function setOnboardingRehearsal"), shell.indexOf("function devRehearsalBadge"));
ok(/localStorage\.removeItem/.test(fn) && /localStorage\.setItem/.test(fn),
  "a walk-through both clears the flags on entry and puts them back on exit");
ok(/rehearsalUsage = null/.test(fn), "each walk-through starts from the first screen");
ok(/rehearsalKeyDone = false/.test(fn), "and from the key step, not part-way through it");

// ---- The walk-through must actually REACH the key screen --------------------
// The bug this pins: boot()'s normal branches read "no key but a project is open" and
// drop to the project chooser, so a machine with a project open would skip the key gate
// entirely, which is the screen the walk-through exists to show. The rehearsal branch
// therefore has to come BEFORE those.
const bootStart = shell.indexOf("async function boot()");
const boot = shell.slice(bootStart, shell.indexOf("\n}", bootStart));
const iReh = boot.indexOf("if (rehearsingOnboarding)");
const iNoKey = boot.indexOf("if (!hasKey && !proj.hasProject)");
ok(iReh > -1 && iNoKey > -1 && iReh < iNoKey,
  "boot() must check the walk-through BEFORE its has-key/has-project branches");
ok(/showStage\(hasKey \|\| rehearsalKeyDone \? "project" : "key"\)/.test(boot),
  "the walk-through shows the key screen first, then the project one once that step is done");

// Main reports "no key" for the whole walk-through, so the key step can only advance on
// the rehearsal's own record of it: without this the key screen would never be left.
const save = shell.slice(shell.indexOf("async function saveKey()"), shell.indexOf("keysave.addEventListener"));
ok(/res\.rehearsed/.test(save), "a rehearsed key save records the step (nothing is stored to read back)");

console.log(`rehearsal: ${checks} checks pass.`);
