// ©2026 thinkany llc. All rights reserved.
// COMPETITOR REVIEW, headless (phase 1 of docs/competitor-review-spec.md). Dev only, not shipped.
//
// Runs the whole review against a real promoted project from the terminal, so the quality
// of the recommendations can be judged before any drawer exists:
//
//   node desktop/dev/competitor-review.cjs --project <dir> --competitors a.com,b.com,c.com
//         [--pages 3] [--model <id>] [--dry]
//
//   --dry   read the field and the site, write the read + print the prompt size, no model turn
//
// Needs ANTHROPIC_API_KEY (read from desktop/.env.local when unset). Prints the prose report
// as it streams, then the suggestions as a table, and records the run in the project's
// .thinkany/competitors.json exactly as the drawer will.
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const C = require("../competitors.cjs");

const ROOT = path.join(__dirname, "..", "..");
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i === -1 ? dflt : args[i + 1]; };
const project = path.resolve(opt("project", "."));
const competitors = String(opt("competitors", "")).split(",").map((s) => s.trim()).filter(Boolean);
const pages = Number(opt("pages", C.DEFAULT_PAGES)) || C.DEFAULT_PAGES;
const model = opt("model", undefined);
const dry = args.includes("--dry");

if (!competitors.length || !fs.existsSync(path.join(project, "content", "site.json"))) {
  process.stderr.write("usage: node desktop/dev/competitor-review.cjs --project <promoted project dir> --competitors a.com,b.com [--pages 3] [--model id] [--dry]\n");
  process.exit(2);
}
if (!process.env.ANTHROPIC_API_KEY) {
  try {
    const env = fs.readFileSync(path.join(ROOT, "desktop", ".env.local"), "utf8");
    const m = env.match(/^\s*ANTHROPIC_API_KEY\s*=\s*["']?([^"'\n]+)/m);
    if (m) process.env.ANTHROPIC_API_KEY = m[1].trim();
  } catch { /* no .env.local */ }
}

(async () => {
  const t0 = Date.now();
  const extractor = path.join(ROOT, "scripts", "extract-layout.mjs");
  process.stderr.write(`Reading ${competitors.length} competitor site(s), ${pages} page(s) each after the home page…\n`);
  const field = await C.readField(competitors, {
    extractor, pages,
    onProgress: ({ done, total, url, failed }) => process.stderr.write(`  ${done}/${total} ${url}${failed ? `  (${failed})` : ""}\n`),
  });
  const site = C.readProjectContent(project);
  const brief = C.readBriefSummary(project);
  const readPath = C.writeRead(project, { field, site, brief });
  const prompt = C.buildReviewPrompt({ field, site, brief, readPath });
  process.stderr.write(`Read done in ${((Date.now() - t0) / 1000).toFixed(1)}s: ${field.filter((c) => !c.failed).length} read, ${field.filter((c) => c.failed).length} failed; this site has ${site.pages.length} page(s). Prompt ${(prompt.length / 1024).toFixed(1)} KB, saved read at .thinkany/${readPath}\n`);
  if (dry) { process.stdout.write(prompt.slice(0, 2000) + (prompt.length > 2000 ? "\n…\n" : "\n")); return; }
  if (!process.env.ANTHROPIC_API_KEY) { process.stderr.write("No ANTHROPIC_API_KEY (set it, or put it in desktop/.env.local).\n"); process.exit(1); }

  const { runPrompt } = await import(pathToFileURL(path.join(ROOT, "desktop", "agent.mjs")).href);
  let report = "";
  let suggestions = [];
  let usage = null;
  const t1 = Date.now();
  await runPrompt({
    prompt, cwd: project, model, reviewMode: "competitor",
    onSuggest: (list) => { suggestions = list || []; },
    onEvent: (ev) => {
      if (ev.type === "text") { report += ev.text; process.stdout.write(ev.text); }
      else if (ev.type === "tool") process.stderr.write(`  [tool] ${ev.name || ""} ${ev.detail ? String(ev.detail).slice(0, 80) : ""}\n`);
      else if (ev.type === "error") process.stderr.write(`ERROR: ${ev.message}\n`);
      else if (ev.type === "result") usage = ev.usage || null;
    },
    projectState: { promoted: true, design: null, blocks: [], projectType: "website", imageSources: [], videoSources: [] },
  });
  process.stdout.write("\n\n");

  if (!suggestions.length) process.stdout.write("(no suggestions were emitted)\n");
  else {
    process.stdout.write(`${suggestions.length} suggestion(s):\n\n`);
    suggestions.forEach((s, i) => {
      process.stdout.write(`${i + 1}. [${s.angle || "?"} / ${s.kind}${s.page ? ` / ${s.page}` : ""}] ${s.title}\n`);
      process.stdout.write(`   why: ${s.why}\n`);
      if (s.evidence) process.stdout.write(`   evidence: ${s.evidence}\n`);
      if (s.apply) process.stdout.write(`   apply: ${s.apply}\n`);
      if (s.create) process.stdout.write(`   create: ${s.create.title} [${(s.create.blocks || []).join(", ")}]\n`);
      process.stdout.write("\n");
    });
  }
  const run = C.recordRun(project, {
    ranAt: new Date().toISOString(), read: readPath,
    sitesRead: field.filter((c) => !c.failed).length, sitesFailed: field.filter((c) => c.failed).map((c) => c.url),
    report: report.trim(), active: suggestions.map((s, i) => ({ ...s, id: s.id || `c${i + 1}` })),
  });
  const secs = ((Date.now() - t1) / 1000).toFixed(1);
  process.stderr.write(`Review turn ${secs}s${usage ? `, tokens in ${usage.input_tokens || "?"} (cache read ${usage.cache_read_input_tokens || 0}) out ${usage.output_tokens || "?"}` : ""}. Run recorded (${run.ranAt}) in .thinkany/competitors.json\n`);
})().catch((e) => { process.stderr.write(`${e && e.stack || e}\n`); process.exit(1); });
