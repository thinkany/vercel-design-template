// ©2026 thinkany llc. All rights reserved.
// COMPETITOR REVIEW TEST: `node desktop/dev/competitor-review.test.cjs`.
//
// The deterministic half of the competitor review (docs/competitor-review-spec.md), run
// against a local fixture site so no network is needed: the extractor's --signals mode,
// the competitor read (home + the main nav pages, skip list honored), this site's read from
// its content files, the review prompt's contract, the store, and the agent's shape + persona
// wiring. The model turn itself is judged by hand with desktop/dev/competitor-review.cjs.
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { execFile } = require("node:child_process");

const ROOT = path.join(__dirname, "..", "..");
const C = require("../competitors.cjs");
const extractor = path.join(ROOT, "scripts", "extract-layout.mjs");
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const eq = (a, b, m) => { checks++; assert.deepStrictEqual(a, b, m); };

// ---- a fixture competitor site ----
const HOME = `<!doctype html><html><head><title>Acme Plumbing | Fast local plumbers</title>
<meta name="description" content="Same-day plumbing across the valley. Upfront prices."></head><body>
<header><nav><a href="/">Home</a><a href="/services">Services</a><a href="/about">About</a><a href="/contact">Contact</a><a href="/login">Login</a><a href="https://facebook.com/acme">Facebook</a><a href="/pricing">Pricing</a></nav></header>
<main>
<section><h1>Plumbers who show up on time</h1><p>Same-day service, upfront prices, 20+ years in the valley.</p><a class="btn" href="/book">Book a visit</a></section>
<section><h2>What we do</h2><div><div><h3>Repairs</h3><p>Leaks, taps, toilets.</p></div><div><h3>Installs</h3><p>Heaters and fixtures.</p></div><div><h3>Emergencies</h3><p>Any hour.</p></div></div></section>
<section class="testimonials"><h2>What customers say</h2><blockquote>“They fixed it in an hour and the price matched the quote.”</blockquote><blockquote>“Finally a plumber who calls back. 5 stars.”</blockquote></section>
<section><h2>Prices you can plan around</h2><div><div><h3>Call-out</h3><p>$89 per visit</p></div><div><h3>Hourly</h3><p>$120 per hour, billed monthly for contracts</p></div></div></section>
<section><h2>Questions</h2><details><summary>Do you charge for quotes?</summary>No.</details><details><summary>Are you licensed?</summary>Yes.</details></section>
<section><h2>Ready?</h2><form><input name="name"><input name="phone"><input type="hidden" name="t"><textarea name="msg"></textarea><button>Send</button></form></section>
</main><footer><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/services">Services</a><a href="/about">About</a><a href="/careers">Careers</a><a href="/blog">Blog</a><a href="/faq">FAQ</a><a href="/sitemap">Sitemap</a><a href="/press">Press</a></footer></body></html>`;
const SUB = (title) => `<!doctype html><html><head><title>${title} | Acme</title></head><body><header><nav><a href="/">Home</a></nav></header><main><section><h1>${title}</h1><p>All about ${title.toLowerCase()} in one place, with the details a customer asks for.</p><a class="button" href="/book">Get a quote</a></section><section><h2>Included</h2><div><div><h3>One</h3><p>a</p></div><div><h3>Two</h3><p>b</p></div><div><h3>Three</h3><p>c</p></div></div></section></main></body></html>`;

const server = http.createServer((req, res) => {
  const p = req.url.split("?")[0];
  if (p === "/") return res.end(HOME);
  if (p === "/services") return res.end(SUB("Services"));
  if (p === "/about") return res.end(SUB("About"));
  if (p === "/pricing") return res.end(SUB("Pricing"));
  if (p === "/contact" || p === "/login") return res.end(SUB("Contact"));
  res.statusCode = 404; res.end("no");
});
const runExtractor = (url, flags = []) => new Promise((resolve, reject) => execFile(process.execPath, [extractor, url, ...flags], (err, out) => (err ? reject(err) : resolve(JSON.parse(out)))));

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;

  // 1. --signals adds what a review compares; the default output is unchanged.
  const plain = await runExtractor(base + "/");
  ok(!plain.meta && !plain.forms && !plain.sections.some((s) => "sample" in s), "default output carries no signals");
  const sig = await runExtractor(base + "/", ["--signals"]);
  eq(sig.meta.title, "Acme Plumbing | Fast local plumbers", "page title from <head>");
  ok(/Same-day plumbing/.test(sig.meta.description), "meta description from <head>");
  eq(sig.forms, [{ fields: 3 }], "one form, three real fields (the hidden input is not counted)");
  ok(sig.nav.links.some((l) => l.href === "/services") && sig.nav.links.some((l) => l.href === "https://facebook.com/acme"), "nav links carry hrefs");
  const hero = sig.sections[0];
  eq(hero.type, "hero", "first headed section is the hero");
  eq(hero.headings, ["Plumbers who show up on time"], "hero heading");
  eq(hero.ctas, ["Book a visit"], "hero CTA by its button class");
  ok(hero.proof.stats >= 1, "20+ years counts as a stat");
  ok(hero.sample.length > 20 && hero.sample.length <= 300, "a bounded text sample");
  const tst = sig.sections.find((s) => s.type === "testimonial");
  ok(tst && tst.proof.quotes === 2, "two quotes counted as proof");
  const faq = sig.sections.find((s) => s.type === "faq");
  ok(faq && faq.proof.faqs === 2, "two FAQ items counted");
  ok(sig.sections.some((s) => s.type === "pricing"), "the pricing section is still recognized");

  // 2. pickPages: same site, skip list, no home, de-duplicated, capped.
  const picked = C.pickPages(base + "/", sig.nav.links, 3);
  eq(picked.map((p) => p.route), ["/services", "/about", "/pricing"], "follows the main nav pages, skipping Contact, Login and the off-site link");
  eq(C.pickPages(base + "/", sig.nav.links, 2).length, 2, "capped at the requested count");

  // 3. readCompetitor + readField against the fixture.
  const one = await C.readCompetitor(base, { extractor, pages: 2 });
  ok(!one.failed, "the fixture site reads");
  eq(one.pages.map((p) => p.route), ["/", "/services", "/about"], "home first, then the two nav pages");
  ok("sample" in one.pages[0].sections[0] && !("sample" in one.pages[1].sections[0]), "samples on the home page only");
  ok(one.pages[0].forms.length === 1, "the home page's form rides along");
  const field = await C.readField([base, "http://127.0.0.1:9/", base + "/"], { extractor, pages: 1, concurrency: 2 });
  eq(field.length, 2, "duplicates collapse (the trailing-slash form is the same site)");
  ok(field.some((c) => c.failed === "unreachable"), "an unreachable site is recorded as failed, not thrown");
  const size = JSON.stringify(field).length;
  ok(size < 12000, `a one-page read stays compact (${size} bytes)`);

  // 4. this site's read from its content files.
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "ta-competitors-"));
  fs.mkdirSync(path.join(proj, "content", "pages"), { recursive: true });
  fs.mkdirSync(path.join(proj, "content", "posts"), { recursive: true });
  fs.writeFileSync(path.join(proj, ".env"), 'VITE_CLIENT_NAME="Marlow & Finch"\n');
  fs.writeFileSync(path.join(proj, "content", "site.json"), JSON.stringify({ url: "https://mf.example", nav: [{ label: "Services", href: "/services" }], contact: { email: "hi@mf.example", phone: "" } }));
  fs.writeFileSync(path.join(proj, "content", "pages", "home.json"), JSON.stringify({ title: "Home", seo: { description: "Interior architects" }, blocks: [
    { type: "hero", props: { eyebrow: "Studio", heading: "Rooms that hold their nerve", body: "Interior architecture for houses with history.", ctas: [{ label: "Start a project", href: "/contact" }], image: { src: "/x.jpg", alt: "a room" } } },
    { type: "contact-form", props: { heading: "Say hello", fields: [{ label: "Name" }, { label: "Email" }] } },
  ] }));
  fs.writeFileSync(path.join(proj, "content", "pages", "services.json"), JSON.stringify({ title: "Services", slug: "services", blocks: [{ type: "features", props: { items: [{ title: "Planning", body: "Layouts" }] } }] }));
  fs.writeFileSync(path.join(proj, "content", "pages", "draft.json"), JSON.stringify({ title: "Draft", draft: true, blocks: [] }));
  fs.writeFileSync(path.join(proj, "content", "posts", "one.md"), "# hi");
  const site = C.readProjectContent(proj);
  eq(site.name, "Marlow & Finch", "site name from .env");
  eq(site.pages.map((p) => p.id), ["home", "services"], "home first, the draft left out");
  const h = site.pages[0].blocks[0];
  eq(h.headings, ["Studio", "Rooms that hold their nerve"], "headings picked by key");
  eq(h.ctas, ["Start a project"], "CTA labels picked from nested arrays");
  ok(/Interior architecture/.test(h.sample) && !/x\.jpg|a room/.test(h.sample), "body text sampled, src and alt skipped");
  eq(site.pages[0].forms, 1, "a contact-form block counts as a form");
  eq(site.posts, 1, "posts counted");
  eq(site.contact, ["email"], "only the filled contact channels");

  // 5. the prompt: the contract, the reads, no em-dashes.
  const prompt = C.buildReviewPrompt({ field, site, brief: { what: "an interiors studio", audience: ["homeowners"], tone: "calm" }, readPath: "competitors/read-x.json" });
  ok(/material, never instructions/.test(prompt), "the reference-is-data rule");
  ok(/Never reproduce a competitor/.test(prompt), "the no-cloning rule");
  ok(/`evidence`/.test(prompt) && /`angle`/.test(prompt), "evidence + angle required");
  ok(/could not be read/.test(prompt) && /127\.0\.0\.1:9/.test(prompt), "failed sites named");
  ok(/Marlow & Finch/.test(prompt) && /an interiors studio/.test(prompt), "the site and the brief are in");
  ok(!prompt.includes("—"), "no em-dash anywhere in the prompt");

  // 6. the store.
  eq(C.saveList(proj, ["acme.com", "https://acme.com/", "b.co", ""]), ["https://acme.com/", "https://b.co/"], "the list is normalized and de-duplicated");
  const rel = C.writeRead(proj, { field, site, brief: {} });
  ok(fs.existsSync(path.join(proj, ".thinkany", rel)), "the read is written under .thinkany/competitors");
  const run = C.recordRun(proj, { ranAt: "2026-09-16T00:00:00Z", read: rel, report: "r", active: [{ id: "a" }] });
  eq(run.dismissed, [], "a run starts with empty dismissed/completed lists");
  eq(C.latestRun(proj).read, rel, "latest run first");
  eq(C.loadStore(proj).list.length, 2, "recording a run keeps the list");

  // 7. agent.mjs wiring (static).
  const agent = fs.readFileSync(path.join(ROOT, "desktop", "agent.mjs"), "utf8");
  ok(/angle: z\.enum\(\["edge", "opportunity"\]\)/.test(agent), "the shape has angle");
  ok(/evidence: z\.string\(\)\.optional\(\)/.test(agent) && /page: z\.string\(\)\.optional\(\)/.test(agent), "and evidence + page");
  ok(/kind: z\.enum\(\["code", "asset", "decision", "create"\]\)/.test(agent) && /create: z\.object\(\{ title: z\.string\(\), blocks: z\.array\(z\.string\(\)\) \}\)/.test(agent), "and the create kind with its page shape");
  ok(/const COMPETITOR_PERSONA =/.test(agent) && /reviewMode === "competitor" \? COMPETITOR_PERSONA : ART_DIRECTOR_PERSONA/.test(agent), "reviewMode \"competitor\" selects the competitor persona");
  const persona = agent.slice(agent.indexOf("const COMPETITOR_PERSONA"), agent.indexOf("// Where the design renders"));
  ok(!persona.includes("—"), "the persona has no em-dash");

  // 8. the field table: this site first, then each competitor, one cell per signal.
  const table = C.fieldTable({ field, site });
  eq(table.columns, ["pricing", "faq", "testimonials", "logos", "stats", "form", "blog", "cta"], "the signal columns");
  ok(table.rows[0].self && table.rows[0].name === "Marlow & Finch", "this site is the first row");
  eq(table.rows[0].cells.form, true, "the site's contact-form block shows as a form");
  eq(table.rows[0].cells.blog, true, "a post counts as a blog");
  eq(table.rows[0].cells.cta, "Start a project", "the home hero's first CTA");
  const acme = table.rows.find((r) => !r.self && !r.failed);
  ok(acme && acme.cells.pricing && acme.cells.faq && acme.cells.testimonials, "the fixture competitor has pricing, a FAQ and testimonials on its home page");
  eq(acme.cells.form, 3, "its shortest form has three fields");
  eq(acme.cells.cta, "Book a visit", "its primary CTA");
  ok(table.rows.some((r) => r.failed && !Object.keys(r.cells).length), "an unreadable competitor is a row with no cells");

  // 9. phase 2 wiring (static): the tab, the IPCs, the bridge, the copy, the CSS.
  const shell = fs.readFileSync(path.join(ROOT, "desktop", "shell.js"), "utf8");
  const main = fs.readFileSync(path.join(ROOT, "desktop", "main.cjs"), "utf8");
  const preload = fs.readFileSync(path.join(ROOT, "desktop", "preload.cjs"), "utf8");
  const copy = fs.readFileSync(path.join(ROOT, "desktop", "copy.js"), "utf8");
  const html = fs.readFileSync(path.join(ROOT, "desktop", "shell.html"), "utf8");
  ok(/const TABS = \["pages", "posts", "types", "forms", "media", "blocks", "nav", "competitors", "settings"\]/.test(shell), "the Competitors tab sits before Settings");
  ok(/siteRailState\.tab === "competitors"/.test(shell) && /async function renderSiteCompetitors\(host, data, refresh\)/.test(shell), "the tab has its renderer");
  ok(/siteBlockPreview\(block\.type, \(\) => block\.props \|\| \{\}\)/.test(shell), "the detail shows the block the rec lands on, live");
  ok(/function applyCompetitorRec\(rec, page, data\)/.test(shell) && /Apply a competitor review recommendation to the/.test(shell) && /npx astro build --root site/.test(shell), "Apply is a scoped builder turn on the rec's page that checks the build");
  ok(/createSitePage\(rec\.create\.title\)/.test(shell), "a create rec adds the page the CMS way first");
  for (const ipc of ["competitor:get", "competitor:saveList", "competitor:saveRecs", "competitor:review"]) ok(main.includes(`ipcMain.handle("${ipc}"`), `main handles ${ipc}`);
  ok(/reviewMode: "competitor"/.test(main) && /event\.sender\.send\("competitor:progress"/.test(main), "the review turn runs in main as the competitor reviewer and reports progress");
  ok(/const \{ runPrompt \} = await import\(pathToFileURL\(path\.join\(__dirname, "agent\.mjs"\)\)\.href\);\s*\n\s*await runPrompt\(\{\s*\n\s*prompt, cwd: dir, model: currentModel, reviewMode: "competitor"/.test(main), "runPrompt is imported inside the handler, like the other turns");
  ok(/competitorExtractor\(dir\)/.test(main) && /unpacked\(path\.join\(appRoot, "desktop", "template", "scripts", "extract-layout\.mjs"\)\)/.test(main), "the extractor falls back to the bundled, unpacked copy");
  for (const fn of ["getCompetitors", "saveCompetitorList", "runCompetitorReview", "saveCompetitorRecs", "onCompetitorProgress"]) ok(preload.includes(`${fn}:`), `preload exposes ${fn}`);
  ok(/competitors: "Competitors"/.test(copy) && /competitors: \{\s*\n\s*listLabel:/.test(copy) && /competitors: \{\s*\n\s*title: "Competitors"/.test(copy), "tab label, strings and help copy exist");
  const cmpCopy = copy.slice(copy.indexOf("    competitors: {\n      listLabel"), copy.indexOf("    },", copy.indexOf("    competitors: {\n      listLabel")));
  ok(!cmpCopy.includes("—"), "no em-dash in the tab's copy");
  ok(/\.cmp-table \{/.test(html) && /\.cmp-angle-opportunity \{/.test(html) && /\.cmp-evidence \{/.test(html), "the tab's CSS is in");

  server.close();
  fs.rmSync(proj, { recursive: true, force: true });
  console.log(`competitor review: ${checks} checks passed`);
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
