// ©2026 thinkany llc. All rights reserved.
// TOUR FOLDS TEST: `node desktop/dev/tour-folds.test.cjs`.
//
// A walkthrough tip opened straight from the help list can point at something inside a
// section the designer had folded shut (the Forms list, the drawer's key folds). The tour
// must open every folded section on the way to its target, or the tip draws at the
// window's top-left with nothing to point at (seen 2026-09-13). Also: the two tips added
// the same day, Spam protection in the CMS walkthrough and the Cloudflare card in the
// studio tour, sit where they belong and have copy.
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const D = path.join(__dirname, "..");
const shell = fs.readFileSync(path.join(D, "shell.js"), "utf8");
const copy = fs.readFileSync(path.join(D, "copy.js"), "utf8");
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };

const show = shell.slice(shell.indexOf("async function tourShow("), shell.indexOf("function stepPlacement("));
ok(/for \(let el = target\.parentElement; el && el !== document\.body; el = el\.parentElement\)/.test(show), "tourShow walks the target's ancestors");
ok(/el\.classList\.contains\("site-acc-body"\) && el\.hidden/.test(show), "looking for a folded section body");
ok(/const head = el\.previousElementSibling;\s*\n\s*if \(head && head\.classList\.contains\("site-acc-head"\)\) head\.click\(\);/.test(show), "and opens it through its own head, so the fold's remembered state follows");
ok(show.indexOf("for (let el = target.parentElement") < show.indexOf("target.scrollIntoView"), "before scrolling the target into view");
ok(/target\.classList\.contains\("site-acc"\) && !target\.classList\.contains\("open"\)/.test(show), "a target that is itself a folded section still opens too");
// Both fold kinds share the markup the walk relies on.
const cmsFold = shell.slice(shell.indexOf("function siteFold("), shell.indexOf("function siteFold(") + 900);
const keyFold = shell.slice(shell.indexOf("function licensesFold("), shell.indexOf("function licensesFold(") + 900);
for (const [name, src] of [["the CMS fold", cmsFold], ["the Keys drawer fold", keyFold]]) {
  ok(/"site-acc-head"/.test(src) && /"site-acc-body"/.test(src), `${name} uses site-acc-head + site-acc-body, which the walk keys on`);
}

// ---- the two new tips -------------------------------------------------------------
const cms = shell.slice(shell.indexOf("const CMS_TOUR_STEPS = ["), shell.indexOf("const CMS_TOUR = {"));
ok(/cmsStep\("siteDelivery", "cms-forms-delivery"[^\n]*\n\s*cmsStep\("siteProtection", "cms-forms-protection", "right", \(\) => ensureCmsTab\("forms"\)\)/.test(cms), "the CMS walkthrough's Forms tab ends with Spam protection, right after Delivery");
ok(/sec\.dataset\.tour = "cms-forms-protection"/.test(shell), "and the section carries that anchor");
ok(/\n        siteProtection: \{\n          title: "Spam protection, once per site"/.test(copy), "with its copy");
const tour = shell.slice(shell.indexOf("const TOUR_STEPS = ["), shell.indexOf("const onGate ="));
ok(/copy: "unsplashKey"[^\n]*\n\s*\{ copy: "turnstileToken", onEnter: \(\) => ensureModal\("licenses"\), target: inDrawer\("turnstile-token"\), placement: "right" \}/.test(tour), "the studio tour's Cloudflare tip follows the photo libraries");
ok(/tourId: "turnstile-token"/.test(shell), "and the Keys drawer card carries that anchor");
ok(/\n      turnstileToken: \{\n        title: "Spam protection for forms, optional"/.test(copy), "with its copy");
ok(!/—/.test(copy.slice(copy.indexOf("turnstileToken: {"), copy.indexOf("closeDrawer: {"))) && !/—/.test(copy.slice(copy.indexOf("siteProtection: {"), copy.indexOf("siteDelivery: {"))), "no em-dashes in the new copy");

console.log(`tour-folds: ${checks} checks pass.`);
