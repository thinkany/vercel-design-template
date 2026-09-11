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

// ---- A step never hides what skipping it costs ------------------------------
// The Research key also gates the SITE BUILDER, so skipping this step quietly removes
// the CMS icon. A step called "Design research" that says nothing about that would have
// misled anyone who later wondered where the site builder went.
const research = block.slice(block.indexOf('id: "research"'), block.indexOf('id: "media"'));
ok(/also: \(\) => COPY\.setupGate\.researchAlso/.test(research),
  "the Research step names the site builder the same key unlocks");

// ---- One live step at a time ------------------------------------------------
const render = shell.slice(shell.indexOf("async function renderSetupStep"), shell.indexOf("function finishSetupStep"));
ok(/if \(!answered && !isLive\) continue;/.test(render),
  "steps below the live one are not rendered at all (not merely disabled)");
const doneRow = shell.slice(shell.indexOf("function buildSetupDoneRow"), shell.indexOf("/** Read what is already connected"));
ok(/setup-done-row/.test(doneRow), "an answered step collapses to a done-row");
ok(/COPY\.setupGate\.reopen/.test(doneRow), "a done step can be reopened");
ok(/buildSetupDoneRow\(step, answered\)/.test(render), "and the render uses that one builder");
ok(/setup-step-also/.test(render), "a step's second line (what else its key unlocks) is rendered");
ok(/doneBtn\.hidden = !!nextSetupStep\(\)/.test(render),
  "Done only appears once every step is answered");

// ---- Answering a step is two movements, not a swap --------------------------
// The card closes around its own midline (so it shuts like a door, not by the bottom
// riding up to a fixed top), then glides up into the slot it will rest in. Both are
// measured first, so the card lands exactly where the rebuilt stack draws it.
const finish = shell.slice(shell.indexOf("async function finishSetupStep"), shell.indexOf("/**\n * The top of the slot"));
ok(/measureDoneRow\(id, stack\)/.test(finish),
  "the closed size is measured from a real row, not guessed");
ok(/setupRestingTop\(id, stack/.test(finish),
  "and so is the slot it travels to");
// Phase 1: the midline holds still while the height goes.
ok(/const midlineOffset = \(box\.height - to\.height\) \/ 2/.test(finish),
  "the close offsets by half the height lost, which keeps the midline fixed");
ok(/transform: `translateY\(\$\{midlineOffset\}px\)`/.test(finish),
  "and the close animates to exactly that offset");
// Phase 2: from that midline up to the slot, and the lift accounts for the offset.
ok(/const lift = restTop - \(startTop \+ midlineOffset\)/.test(finish),
  "the lift is measured from where the close leaves the card, not from where it started");
ok(/translateY\(\$\{midlineOffset \+ lift\}px\)/.test(finish),
  "the travel ends on the resting slot");
ok(finish.indexOf("await close.finished") < finish.indexOf("const glide"),
  "the travel begins only once the close has finished");
// It must leave the flow BEFORE the close, not after. Going absolute afterwards meant
// the flow pulled everything up while the card was still shrinking, so by the time it
// travelled there was no open space left to float through.
ok(/card\.style\.position = "absolute"/.test(finish) && /card\.style\.width = box\.width/.test(finish),
  "it lifts out of the flow for the trip, with its width pinned first");
ok(finish.indexOf('card.style.position = "absolute"') < finish.indexOf("const close = card.animate"),
  "and it does so BEFORE closing, so the space it floats through is already open");
ok(finish.indexOf("const restTop") > finish.indexOf('card.style.position = "absolute"'),
  "the destination is measured after the stack has reflowed without it");
// Nothing under the stack may jump while the card is out of flow.
ok(/stack\.style\.height = stackBox\.height/.test(finish),
  "the stack holds its height, so what sits below it does not jump");
// The stack must NOT shrink during the travel: in a flex column that drags the finished
// rows above toward the top, which read as them sliding down to meet the closing card
// and then rising with it. Only the card moves until the next step arrives.
const travelBlock = finish.slice(finish.indexOf("const TRAVEL"), finish.indexOf("Hand over to the real stack"));
ok(!/stack\.animate\(/.test(travelBlock),
  "the stack keeps its full height for the trip: nothing above the card may move");
// It gives that height up at the handover instead, under the next step's own entrance.
const handover = finish.slice(finish.indexOf("Hand over to the real stack"));
ok(/stack\.animate\(/.test(handover),
  "the held height is released as the next step arrives, not snapped away before it");
ok(/heldHeight/.test(handover) && /settledHeight/.test(handover),
  "and it eases between the measured before and after, not a guess");
// Order matters here. Releasing the pin before the rebuild leaves one frame where the
// travelling card is still absolute and the stack has NO in-flow children, so it
// collapses to nothing and everything above it reflows. That showed as a flash on the
// first step, the only one with no finished rows left to hold the stack open.
ok(handover.indexOf("await renderSetupStep") < handover.indexOf('stack.style.height = ""'),
  "the stack is rebuilt BEFORE its held height is released, or the first step flashes");
// The held-open geometry has to be pinned before the animation holding it is dropped.
ok(finish.indexOf("card.style.height = to.height") < finish.indexOf("card.getAnimations().forEach"),
  "the closed geometry is pinned before the close animation is cancelled (or it flashes open)");
// Slower than it was: the point of this pass.
const closeMs = +(finish.match(/const CLOSE = (\d+)/) || [])[1];
const travelMs = +(finish.match(/const TRAVEL = (\d+)/) || [])[1];
ok(closeMs >= 200 && closeMs <= 400, `the close is quick but not a snap (${closeMs}ms)`);
ok(travelMs >= 450, `the travel decelerates into place rather than darting (${travelMs}ms)`);
ok(travelMs > closeMs, "and the arrival takes longer than the close");
ok(/prefers-reduced-motion/.test(finish), "none of it runs for reduced motion");
// The rail must not repaint mid-movement. refreshRailActivation resolves four IPC calls
// and then toggles icon visibility, which lands as a flash if it arrives while the card
// is still travelling. The key rows therefore leave it to the host, and the host does it
// once the animation is over.
ok(finish.lastIndexOf("refreshRailActivation()") > finish.indexOf("await glide.finished"),
  "the rail is refreshed only after the card has landed");
for (const [fn, where] of [["claudeKeySection", "the Claude row"], ["licenseSection", "the licence rows"]]) {
  const body = shell.slice(shell.indexOf(`async function ${fn}(`), shell.indexOf(`async function ${fn}(`) + 4000);
  const save = body.slice(body.indexOf("if (res.ok)"), body.indexOf("} else {"));
  checks++;
  assert.ok(!/^\s*refreshRailActivation\(\);/m.test(save.split("onConnected")[0]),
    `${where} must not refresh the rail before handing back to its host`);
}
ok(/if \(setupAnimating\) return/.test(finish), "a second click during the transition cannot race the first");
// The measurement must not disturb what the designer is looking at.
const mStart = shell.indexOf("function measureDoneRow");
const measure = shell.slice(mStart, shell.indexOf("\n}", mStart));
ok(/visibility:hidden/.test(measure) && /left:-9999px/.test(measure),
  "the row is measured off-screen, so the real stack never flickers");
ok(/ghost\.remove\(\)/.test(measure), "and the measuring clone is removed again");
// The slot is computed from the live stack, so a spacing change moves the target with it.
const rest = shell.slice(shell.indexOf("function setupRestingTop"), shell.indexOf("function setupRestingTop") + 700);
ok(/rowGap|gap/.test(rest), "the slot accounts for the stack's own gap");
ok(/if \(step\.id === id\) break/.test(rest), "counting only the rows that sit above it");

// ---- Reusing the drawer's key rows ------------------------------------------
// The whole reason this is cheap: one implementation of validate/save/show/unplug.
ok(/claudeKeySection\(host/.test(block), "step 1 renders the drawer's Claude row");
ok(/noDesc: true/.test(block),
  "without the row's own description, which the step has already given in full");
// Figma, Research, and ONE call inside the media step's loop that serves all three
// libraries: three call sites, five rows.
ok((block.match(/licenseSection\(/g) || []).length === 3,
  "the other steps render the drawer's licence rows");
const loop = block.slice(block.indexOf("for (const lib of libs)"));
ok(/licenseSection\(fold/.test(loop), "the media step loops one licence row over its three libraries");
ok(/onConnected:/.test(block), "each row reports a successful save back to the stepper");
// onConnected must actually be honoured, or the drawer would re-open over the stepper.
const ls = shell.slice(shell.indexOf("async function licenseSection"), shell.indexOf("async function licenseSection") + 3000);
ok(/if \(opts\.onConnected\) opts\.onConnected\(res\);\s*\n\s*else \{ refreshRailActivation\(\); openModal\("licenses"\); \}/.test(ls),
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
// A shut library also says whether it is already set up, beside what it offers.
ok(/setFoldState\(st && st\.hasLicense \? COPY\.setupGate\.connected : ""\)/.test(media),
  "a connected library shows Connected on its heading, readable while shut");
ok(/const st = await lib\.get\(\)/.test(media),
  "and reads it live on every repaint, so unplugging one clears the label again");
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

// The two facts under the heading are a numbered list, left-aligned inside a gate that
// otherwise centres its text, and large enough to read as instructions.
ok(/<ol class="setup-intro">[\s\S]*?setupGate\.intro1[\s\S]*?setupGate\.intro2[\s\S]*?<\/ol>/.test(html),
  "the intro is a numbered list of two, not one centred paragraph");
const introCss = html.slice(html.indexOf(".setup-intro {"), html.indexOf("first-run key setup"));
ok(/text-align: left/.test(introCss), "left-aligned, against the gate's centred default");
ok(/counter-increment: setup-intro/.test(introCss) && /content: counter\(setup-intro\)/.test(introCss),
  "numbered by CSS counter, so the markup stays semantic");
ok(/font-size: 13\.5px/.test(introCss), "a touch larger than the gate's 13px paragraph");
ok(/id="keygate"/.test(html), "the reconnect key gate is still there");
ok(/id="setup-done"[^>]*hidden/.test(html), "Done starts hidden");
ok(/\.site-acc-state \{/.test(html), "the heading state chip is styled");
ok(/\.setup-libs \.site-acc-state \{[^}]*#1a7f37/.test(html),
  "and on the light setup panel it matches the done-rows' Connected chip");

// The Keys drawer shows the same thing, since that is where people return to add one.
const shellDrawer = shell.slice(shell.indexOf("async function renderLicenses"));
for (const lib of ["unsplash", "pexels", "pixabay"]) {
  ok(new RegExp(`${lib}Fold\\.setFoldState`).test(shellDrawer),
    `the drawer's ${lib} row shows its connected state too`);
}

// A done-row reads title ......... [state] Change, and those two line up down the stack
// however long a step's name is, so the column of states is scannable.
const row = html.slice(html.indexOf(".setup-done-row {"), html.indexOf(".setup-reopen:hover"));
ok(/\.setup-done-row \.setup-step-title \{[^}]*flex: 1 1 auto/.test(row),
  "the title takes the slack, so the state and Change sit together on the right");
ok(/\.setup-chip \{[^}]*min-width/.test(row), "the state chip has a fixed width, so Change lines up too");
ok(!/\.setup-reopen \{[^}]*margin-left: auto/.test(row),
  "Change is no longer pushed right on its own (that left the chips ragged)");

console.log(`setup-stepper: ${checks} checks pass.`);
