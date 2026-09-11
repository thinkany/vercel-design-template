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

console.log(`renderer-scope: ${checks} checks pass.`);
