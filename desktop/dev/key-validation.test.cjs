// ©2026 thinkany llc. All rights reserved.
// KEY VALIDATION TEST — `node desktop/dev/key-validation.test.cjs`.
//
// A key that validates must actually be a key. Verified against the live APIs on
// 2026-09-11: Pexels serves SEARCH results to any Authorization header at all, so
// validating there accepted every string a designer could type and only failed later,
// mid-build, with a confusing error. Its single-resource endpoint does return 401.
//
// Unsplash (401) and Pixabay (400) reject a bad key on their search endpoints, so those
// validators are fine as they stand. This pins all three so the distinction is not lost.
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "main.cjs"), "utf8");
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };

const fn = (name) => {
  const i = src.indexOf(`async function ${name}(`);
  assert.ok(i > -1, `${name} not found`);
  return src.slice(i, src.indexOf("\n}", i));
};

// ---- Pexels must NOT validate against a search endpoint ---------------------
const pexels = fn("validatePexelsKey");
ok(!/api\.pexels\.com\/v1\/search/.test(pexels),
  "Pexels must not validate against /v1/search: it answers 200 to any key");
ok(/api\.pexels\.com\/v1\/photos\//.test(pexels),
  "it validates against a single-resource endpoint, which does answer 401");
ok(/401/.test(pexels), "and treats 401 as a rejected key");

// ---- The other two reject on search, so they may use it ---------------------
const unsplash = fn("validateUnsplashKey");
ok(/api\.unsplash\.com/.test(unsplash) && /401/.test(unsplash),
  "Unsplash validates against its own endpoint and reads 401 as a rejection");
const pixabay = fn("validatePixabayKey");
ok(/pixabay\.com\/api/.test(pixabay) && /400/.test(pixabay),
  "Pixabay reads 400 as a rejection, which is what it actually returns");

// ---- Every validator distinguishes a rate limit from a bad key --------------
for (const [name, body] of [["Pexels", pexels], ["Unsplash", unsplash], ["Pixabay", pixabay]]) {
  ok(/429|403/.test(body), `${name} tells a spent rate limit apart from a bad key`);
  ok(/Couldn.t reach/.test(body), `${name} says so when the library is unreachable`);
}

// ---- And none of them stores a key it did not check -------------------------
for (const [handler, store] of [
  ["pexels:save", "storePexelsKey"],
  ["unsplash:save", "storeUnsplashKey"],
  ["pixabay:save", "storePixabayKey"],
]) {
  const i = src.indexOf(`ipcMain.handle("${handler}"`);
  const body = src.slice(i, src.indexOf("\n});", i));
  const v = body.indexOf("validate"), w = body.indexOf(store);
  checks++;
  assert.ok(v > -1 && w > -1 && v < w, `${handler} must validate before it stores`);
}

console.log(`key-validation: ${checks} checks pass.`);
