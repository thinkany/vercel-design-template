// ©2026 thinkany llc. All rights reserved.
// LENS EXAMPLES RUNNER (dev only): the self-rendered images for the direction picker's
// gallery. One fictional brief (desktop/build/lens-gallery/example-brief.json) is built
// once per GENERAL direction with that lens pinned, using the same path Get Designing
// takes (direction block + /design-brief expansion + the agent turn), then the home page
// is captured at 1440 by 1080 (the tile's 4:3) through the hidden capture window.
// Output: desktop/build/lens-gallery/examples/<lens>.png + examples.json (the picks
// entries to paste into picks.json). See docs/lens-gallery-spec.md "Self-rendered".
//
// It takes the app over for the duration (each throwaway project becomes the current
// project so Vite serves it); the previous project is reopened at the end. Cost is one
// design build per lens on the designer's key, so start with the dry run (one lens).
const fs = require("node:fs");
const path = require("node:path");

const BUILD_TIMEOUT_MS = 12 * 60 * 1000;

/**
 * deps: { appRoot, workRoot, scaffoldProject, startViteFor, detectDesign, directionMeta,
 *         sampleDirection, buildDesignPrompt, expandPrompt, runPrompt, captureOp, log }
 * opts: { only?: string (lens id), dryRun?: boolean }
 */
async function runLensExamples(deps, opts = {}) {
  const { appRoot, workRoot, log = console.log } = deps;
  const galleryDir = path.join(appRoot, "desktop", "build", "lens-gallery");
  const outDir = path.join(galleryDir, "examples");
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(workRoot, { recursive: true });
  const brief = JSON.parse(fs.readFileSync(path.join(galleryDir, "example-brief.json"), "utf8"));
  delete brief["//"];

  const meta = await deps.directionMeta();
  let lenses = (meta.lenses || []).filter((l) => !l.movement);
  if (opts.only) lenses = lenses.filter((l) => l.id === opts.only);
  if (opts.dryRun) lenses = lenses.slice(0, 1);
  if (!lenses.length) throw new Error("No general directions to render (is the Design license set?).");
  log(`[lens-examples] ${lenses.length} direction(s): ${lenses.map((l) => l.id).join(", ")}`);

  const results = readJson(path.join(outDir, "examples.json")) || {};
  for (const lens of lenses) {
    const t0 = Date.now();
    const dir = path.join(workRoot, lens.id);
    try {
      log(`[lens-examples] ${lens.id}: scaffolding ${dir}`);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      deps.scaffoldProject(dir);

      // The direction, pinned to this lens, the way a direct pick in the picker does it.
      const { direction, block } = await deps.sampleDirection({ lens: lens.id, what: brief.what, tone: brief.tone, projectType: brief.projectType });
      if (!direction) throw new Error("the direction sampler returned nothing (license or network)");
      try { fs.writeFileSync("/tmp/ta-direction.json", JSON.stringify(direction, null, 2)); } catch {}
      let prompt = deps.buildDesignPrompt({ ...brief, direction, directionBlock: block });
      prompt = deps.expandPrompt(prompt) || prompt;

      // Serve it, build it.
      const viteUrl = await deps.startViteFor(dir);
      log(`[lens-examples] ${lens.id}: building (${viteUrl})`);
      const result = await withTimeout(deps.runPrompt({
        prompt, sessionId: null, cwd: dir,
        onEvent: (evt) => { if (evt.type === "tool") log(`[lens-examples] ${lens.id}: ${evt.name}`); else if (evt.type === "error") log(`[lens-examples] ${lens.id}: ERROR ${evt.message}`); },
        askQuestion: async () => { throw new Error("no one to ask"); }, // a question is declined; the build continues on defaults
        askIntake: async () => { throw new Error("no intake in a batch render"); },
      }), BUILD_TIMEOUT_MS, `build of ${lens.id}`);
      if (result && result.error) throw new Error(result.error);

      const design = deps.detectDesign(dir);
      if (!design.active || !design.variationId) throw new Error("the build produced no variation");
      if (!design.previewReady) log(`[lens-examples] ${lens.id}: previewReady is false, capturing anyway`);

      // Capture: the isolated capture view at the tile's 4:3, above the fold.
      const url = `${viteUrl}/?v=${design.variationId}&capture=desktop`;
      await deps.captureOp({ op: "viewport", width: 1440, height: 1080 });
      await deps.captureOp({ op: "goto", url });
      const ready = await deps.captureOp({ op: "waitSelector", selector: "[data-capture-ready]", timeout: 30000 });
      if (!ready.ok) log(`[lens-examples] ${lens.id}: ${ready.error} (capturing what's there)`);
      await deps.captureOp({ op: "evaluate", code: "(async () => { try { await document.fonts.ready; } catch {} await new Promise((r) => setTimeout(r, 1200)); window.scrollTo(0, 0); return true; })()" });
      const shot = await deps.captureOp({ op: "screenshot", fullPage: false });
      if (!shot.ok) throw new Error(shot.error || "screenshot failed");
      const file = path.join(outDir, `${lens.id}.png`);
      fs.writeFileSync(file, Buffer.from(shot.dataUrl, "base64"));
      results[lens.id] = { local: path.relative(galleryDir, file), credit: "thinkany design", license: "own work", alt: `${lens.label}: the Fieldnote Studio home page, built by thinkany design`, variation: design.variationId, project: dir, renderedAt: new Date().toISOString() };
      log(`[lens-examples] ${lens.id}: done in ${Math.round((Date.now() - t0) / 1000)}s → ${file}`);
    } catch (e) {
      results[lens.id] = { error: String(e && e.message || e), project: dir, renderedAt: new Date().toISOString() };
      log(`[lens-examples] ${lens.id}: FAILED ${results[lens.id].error}`);
    }
    fs.writeFileSync(path.join(outDir, "examples.json"), JSON.stringify(results, null, 2) + "\n");
  }
  try { await deps.captureOp({ op: "close" }); } catch {}
  return { outDir, results };
}

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } }
function withTimeout(promise, ms, what) {
  let t;
  return Promise.race([promise, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${what} timed out after ${Math.round(ms / 60000)} min`)), ms); })]).finally(() => clearTimeout(t));
}

module.exports = { runLensExamples };
