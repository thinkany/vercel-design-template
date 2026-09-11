// ©2026 thinkany llc. All rights reserved.
// SETUP STEPPER TEST — `node desktop/dev/setup-stepper.test.cjs`.
//
// The first-run key walk-through: Claude (required), then Figma, Research and the photo /
// video libraries (each skippable), one at a time, then "Done setting up!" hands off to
// the project chooser and the tour. Read out of shell.js, which is a browser script.
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const shell = fs.readFileSync(path.join(__dirname, "..", "shell.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "shell.html"), "utf8");
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };

// ---- The steps, in the order the designer meets them ------------------------
const block = shell.slice(shell.indexOf("const SETUP_STEPS = ["), shell.indexOf("/** Read what is already connected"));
const ids = [...block.matchAll(/^\s{4}id: "(\w+)",/gm)].map((m) => m[1]);
ok(JSON.stringify(ids) === JSON.stringify(["claude", "figma", "research", "media"]),
  `steps run Claude → Figma → Research → media, got ${JSON.stringify(ids)}`);

// Only the Claude key is required: the studio cannot run without it, and everything
// else has to be skippable or the walk-through becomes a wall of credentials.
const claude = block.slice(block.indexOf('id: "claude"'), block.indexOf('id: "figma"'));
ok(/required: true/.test(claude), "the Claude key is required");
for (const id of ["figma", "research", "media"]) {
  const i = block.indexOf(`id: "${id}"`);
  const seg = block.slice(i, i + 900);
  ok(!/required: true/.test(seg), `${id} is skippable`);
}

// ---- One live step at a time ------------------------------------------------
const render = shell.slice(shell.indexOf("async function renderSetupStep"), shell.indexOf("function finishSetupStep"));
ok(/if \(!answered && !isLive\) continue;/.test(render),
  "steps below the live one are not rendered at all (not merely disabled)");
ok(/setup-done-row/.test(render), "an answered step collapses to a done-row");
ok(/COPY\.setupGate\.reopen/.test(render), "a done step can be reopened");
ok(/doneBtn\.hidden = !!nextSetupStep\(\)/.test(render),
  "Done only appears once every step is answered");
// The skip affordance exists only on optional steps.
ok(/if \(!step\.required\)[\s\S]{0,400}setup-skip/.test(render), "only optional steps offer Skip");

// ---- Reusing the drawer's key rows ------------------------------------------
// The whole reason this is cheap: one implementation of validate/save/show/unplug.
ok(/claudeKeySection\(host/.test(block), "step 1 renders the drawer's Claude row");
// Figma, Research, and ONE call inside the media step's loop that serves all three
// libraries: three call sites, five rows.
ok((block.match(/licenseSection\(/g) || []).length === 3,
  "the other steps render the drawer's licence rows");
const loop = block.slice(block.indexOf("for (const lib of libs)"));
ok(/licenseSection\(box/.test(loop), "the media step loops one licence row over its three libraries");
ok(/onConnected:/.test(block), "each row reports a successful save back to the stepper");
// onConnected must actually be honoured, or the drawer would re-open over the stepper.
const ls = shell.slice(shell.indexOf("async function licenseSection"), shell.indexOf("async function licenseSection") + 3000);
ok(/if \(opts\.onConnected\) opts\.onConnected\(res\);\s*\n\s*else openModal\("licenses"\)/.test(ls),
  "licenseSection defers to onConnected instead of always re-opening the drawer");

// ---- The media step asks for three at once ----------------------------------
const media = block.slice(block.indexOf('id: "media"'));
for (const lib of ["Unsplash", "Pexels", "Pixabay"]) {
  ok(new RegExp(`COPY\\.licenses\\.${lib.toLowerCase()}Label`).test(media), `the media step offers ${lib}`);
}
ok(/mediaOrder/.test(media), "and states the sourcing order, which is otherwise a guess");
ok(/onConnected: \(\) => renderSetupStep\(\)/.test(media),
  "connecting ONE library does not end the step: a designer may want two or three");

// ---- First run vs reconnect -------------------------------------------------
const bootStart = shell.indexOf("async function boot()");
const boot = shell.slice(bootStart, shell.indexOf("\n}", bootStart));
ok(/SETUP_DONE_KEY/.test(boot), "boot() decides first-run from the setup marker");
ok(/if \(hasKey\) \{ try \{ localStorage\.setItem\(SETUP_DONE_KEY/.test(boot),
  "an install that already has a key is marked done retroactively, so upgrades never replay setup");
ok(/showStage\("key"\)/.test(boot),
  "a reconnect still gets the single focused key screen, not the whole walk-through");

// ---- Finishing --------------------------------------------------------------
const doneBtn = shell.slice(shell.indexOf("const setupDoneBtn = el(\"setup-done\")"), shell.indexOf("// ---- Onboarding rehearsal"));
ok(/queueTour\(\)/.test(doneBtn) && /flushPendingTour\(\)/.test(doneBtn),
  "Done hands off to the walkthrough tour");
ok(doneBtn.indexOf("queueTour()") < doneBtn.indexOf("boot()"),
  "the tour is queued BEFORE boot repaints, so it lands on the project screen");
// The tour must no longer fire from the key save, or it would interrupt at step 2.
const saveKey = shell.slice(shell.indexOf("async function saveKey()"), shell.indexOf("keysave.addEventListener"));
ok(!/queueTour\(\)/.test(saveKey),
  "saving the Claude key no longer starts the tour (it would interrupt the walk-through)");

// ---- A walk-through must actually reach the steps ---------------------------
ok(/TOUR_FLAGS = \[[^\]]*SETUP_DONE_KEY/.test(shell),
  "the dev walk-through stashes the setup marker too, or it would skip straight past");

// ---- Markup -----------------------------------------------------------------
ok(/id="setupgate"/.test(html) && /id="setup-stack"/.test(html), "the setup gate and its stack exist");
ok(/id="keygate"/.test(html), "the reconnect key gate is still there");
ok(/id="setup-done"[^>]*hidden/.test(html), "Done starts hidden");

console.log(`setup-stepper: ${checks} checks pass.`);
