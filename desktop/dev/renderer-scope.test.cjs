// ©2026 thinkany llc. All rights reserved.
// RENDERER SCOPE TEST — `node desktop/dev/renderer-scope.test.cjs`.
//
// shell.js is a browser script: nothing type-checks it, and a free identifier only
// explodes when the code path runs. A block pasted into the WRONG function is valid
// syntax, so `node --check` passes, every structural test passes, and a designer finds
// out when a panel comes up blank.
//
// That happened: an edit meant for licensesFold also landed in siteFold and
// siteAccordionize, neither of which has a `note` parameter. Every CMS fold threw
// "note is not defined" and every block content field disappeared.
//
// Proper scope analysis needs a real parser, and a half-built one gives false confidence
// (an earlier attempt here passed with the bug present). So this does the narrow thing it
// can do honestly: the identifiers those three near-identical fold builders share are
// PARAMETERS of exactly one of them, so any use outside that one is the mistake.
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "shell.js"), "utf8");
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };

// The three builders all start with the same head.append(chev, title) line, which is why
// a replacement aimed at one can silently hit the others.
const FOLD_BUILDERS = ["licensesFold", "siteFold", "siteAccordionize"];
function bodyOf(name) {
  const i = src.indexOf(`function ${name}(`);
  assert.ok(i > -1, `${name} not found in shell.js`);
  // To the next top-level declaration, which bounds it well enough for this check.
  const rest = src.slice(i + 10);
  const j = rest.search(/\n(?:async )?function [A-Za-z_$]/);
  return src.slice(i, j > -1 ? i + 10 + j : src.length);
}

// `note` and `noteIcons` are licensesFold's parameters. Nothing else may read them.
for (const name of FOLD_BUILDERS) {
  const body = bodyOf(name);
  const usesNote = /\bnote\b/.test(body) || /\bnoteIcons\b/.test(body);
  const declares = /function licensesFold\(host, \{[^}]*note\b/.test(body);
  if (name === "licensesFold") {
    ok(declares, "licensesFold still takes the note parameters it renders");
  } else {
    ok(!usesNote,
      `${name}() reads "note"/"noteIcons", which only licensesFold declares. ` +
      "The three fold builders share a head.append line, so an edit aimed at one can land in all three.");
  }
}

// `fold` is licensesFold's own local (its returned body). setFoldState hangs off it.
for (const name of ["siteFold", "siteAccordionize"]) {
  ok(!/fold\.setFoldState/.test(bodyOf(name)),
    `${name}() sets fold.setFoldState, but has no "fold": that belongs to licensesFold`);
}

// And the shared line itself is still present in all three, so this test keeps watching
// the right functions if one is renamed.
for (const name of FOLD_BUILDERS) {
  ok(/head\.append\(siteEl\("span", "site-acc-chev"\)/.test(bodyOf(name)),
    `${name}() still builds a site-acc head (if not, update FOLD_BUILDERS)`);
}

// ---- A superseded drawer render must not write into the body -----------------
// Every CMS tab click re-opens the drawer (refresh() → openModal("site")), and renderSite
// makes eight IPC reads before it appends anything. Two quick clicks leave the slower
// render resuming into a body the newer one has cleared: it either wipes what the newer
// one drew or appends a second copy beside it, and the tab row goes with it.
const openModal = src.slice(src.indexOf("async function openModal"), src.indexOf("let modalRenderGen"));
ok(/modalBody\.dataset\.gen = String\(\+\+modalRenderGen\)/.test(openModal),
  "each open claims the body with a generation");
ok(/function bodyIsCurrent\(body, gen\)/.test(src), "and there is a way to ask if a render still owns it");
const rsStart = src.indexOf("async function renderSite(body)");
const rs = src.slice(rsStart, src.indexOf("\nasync function ", rsStart + 10));
ok(/const gen = Number\(body\.dataset\.gen \|\| 0\)/.test(rs), "renderSite reads its claim before awaiting");
ok((rs.match(/if \(!bodyIsCurrent\(body, gen\)\) return;/g) || []).length >= 2,
  "and checks it again after its reads, before it builds");
// The guard has to come after the LAST read, so nothing is built on stale data. (The
// first appendChild in this function is inside a helper that is only called later, so
// position alone would not tell us; the reads are what matter.)
// The render's OWN reads are the top-level `const x = await window.desktop.…` lines;
// the awaits further down belong to click handlers and run long after this returns.
const ownReads = [...rs.matchAll(/^  const \w+ = await window\.desktop\./gm)].map((m) => m.index);
const lastGuard = rs.lastIndexOf("if (!bodyIsCurrent(body, gen)) return;");
ok(ownReads.length >= 6, `renderSite still front-loads its reads (found ${ownReads.length})`);
ok(lastGuard > ownReads[ownReads.length - 1],
  "the final guard sits after the last of them, before the panel is built");
ok(/const tabs = siteEl\("div", "site-tabs"\)/.test(rs.slice(lastGuard)),
  "and the tab row is built after it, so a superseded render never draws one");

console.log(`renderer-scope: ${checks} checks pass.`);
