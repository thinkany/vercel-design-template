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
ok(/licenseSection\(fold/.test(loop), "the media step loops one licence row over its three libraries");
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
// Connecting one library does not end the step (a designer may want two or three), and
// it must not re-render the stack either: that would collapse sections they had opened.
ok(!/onConnected: \(\) => renderSetupStep\(\)/.test(media),
  "connecting a library must not rebuild the whole stack");
ok(/const paintLib = async \(\) =>/.test(media),
  "a library row repaints itself in place instead");
ok(/if \(res\) fold\.closeFold\(\)/.test(media),
  "a validated key folds ITS OWN section away");
// The fold handle only ever CLOSES. There is deliberately no "open it for them".
ok(!/openFold|\.open\(\)/.test(media), "nothing in this step auto-opens a section");
ok(/closeFold/.test(shell.slice(shell.indexOf("fold.closeFold = ()"), shell.indexOf("fold.closeFold = ()") + 400)),
  "licensesFold exposes a closer, and only a closer");
// Unplugging repaints but must not shut, or the field they now need would be hidden.
// (Both paths repaint; only a truthy result, i.e. a save, also folds it away.)
ok(/await paintLib\(\);\s*\n\s*if \(res\) fold\.closeFold\(\)/.test(media),
  "a cleared key repaints the row but leaves the section open");
// The Continue button reads live status rather than a captured snapshot.
ok(/SETUP_STEPS\.find\(\(x\) => x\.id === "media"\)/.test(media),
  "the step's Continue finds its step by id, not by position");

// Each library folds, so three sets of how-to-get-a-key steps don't land together.
ok(/licensesFold\(shelf/.test(media), "each library is a folding section, like the drawer's rows");
ok(/openDefault: false/.test(media),
  "every library starts collapsed: the step is a menu of three, not three sets of instructions");
ok(/remember: false/.test(media),
  "and a fresh walk-through starts collapsed again, not from a choice stored last time");

// What each key actually buys you, said where it can be read while the fold is SHUT.
ok(/note: lib\.offers/.test(media), "each fold's heading says what that library offers");
ok(/noteIcons: lib\.icons/.test(media), "and shows it as a mark, not only a word");
for (const [lib, offer] of [["unsplash", "offersImages"], ["pexels", "offersBoth"], ["pixabay", "offersBoth"]]) {
  const i = media.indexOf(`id: "${lib}"`);
  ok(new RegExp(`S\\.${offer}`).test(media.slice(i, i + 400)),
    `${lib} is labelled with what it carries (${offer})`);
}
ok(/id: "unsplash"[\s\S]{0,300}icons: \[PHOTO_SVG\]/.test(media),
  "Unsplash shows the photo mark only: it has no video");
for (const lib of ["pexels", "pixabay"]) {
  const i = media.indexOf(`id: "${lib}"`);
  ok(/icons: \[PHOTO_SVG, VIDEO_SVG\]/.test(media.slice(i, i + 400)),
    `${lib} shows both marks: one key covers photos and video`);
}
// The marks follow the rail's line style rather than inventing a second one.
ok(/stroke-width="1"/.test(shell.slice(shell.indexOf("const ICON_ATTRS"), shell.indexOf("const ICON_ATTRS") + 240)),
  "the media marks use the same 1px line style as the rail icons");

// The drawer must not inherit any of this: it remembers folds on purpose.
const drawer = shell.slice(shell.indexOf("async function renderLicenses"), shell.indexOf("async function renderLicenses") + 3000);
ok(!/remember:/.test(drawer), "the Keys drawer still remembers a designer's fold choices");

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

// A done-row reads title ......... [state] Change, and those two line up down the stack
// however long a step's name is, so the column of states is scannable.
const row = html.slice(html.indexOf(".setup-done-row {"), html.indexOf(".setup-reopen:hover"));
ok(/\.setup-done-row \.setup-step-title \{[^}]*flex: 1 1 auto/.test(row),
  "the title takes the slack, so the state and Change sit together on the right");
ok(/\.setup-chip \{[^}]*min-width/.test(row), "the state chip has a fixed width, so Change lines up too");
ok(!/\.setup-reopen \{[^}]*margin-left: auto/.test(row),
  "Change is no longer pushed right on its own (that left the chips ragged)");

console.log(`setup-stepper: ${checks} checks pass.`);
