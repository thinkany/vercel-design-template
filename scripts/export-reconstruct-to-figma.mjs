#!/usr/bin/env node
// ©2026 thinkany llc. All rights reserved.
/**
 * export-reconstruct-to-figma.mjs — the reconstruct BUILD LIBRARY (local).
 *
 * The reconstruct pipeline is capture (local) → derive (CLOUD, the IP) → build
 * (local). This file is the BUILD half only, imported by the reconstruct
 * entrypoint (export-reconstruct-client.mjs). It holds NO derive IP — the raw→
 * intent interpretation moved server-side (derive.thinkany.design; source in the
 * private derive repo). It exports:
 *
 *   emitCalls(manifest, out, limit)  — pack a BuildSpec into ready-to-submit
 *     use_figma call payloads, sized to the 50K code limit (batched blocks →
 *     blocks-NN.js; oversized → per-view temp + _combine.js; + _plan.json).
 *   printManifest(args)              — read-only inspection of an EXISTING
 *     reconstruct-{id}.json (+ its _plan.json): block sizes, compose order, and
 *     the full submission order. No capture, no dev server.
 *
 * The client captures the raw [data-block] DOM, POSTs it to the cloud derive, and
 * feeds the returned BuildSpec here for the build. The builder body it packs is
 * figma-reconstruct-library.plugin.js (read at emit time).
 */
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

// ── Emit ready-to-submit use_figma call payloads, sized to the 50K code limit ──
// For each block, assemble `const MANIFEST=…;const PHASE=…;` + the builder body.
// If both breakpoints fit under --limit → one `{blockId}.js` (builds the View= set).
// Else → per-view `{blockId}-{view}.js` temp builds + a shared `_combine.js`. Writes
// `_plan.json` (ordered calls + combine list + any single view STILL too big). So
// orchestration just reads a file and submits it verbatim — no manual assembly,
// no size guessing, no failed "try then discover it's too big" round-trips.
// Slim the builder body so it isn't re-shipped verbatim at full weight (~25K, heavily
// commented) in EVERY use_figma call. The body is ferried through the orchestrator's
// context and re-emitted as the `code` param, so it must stay RELIABLY REPRODUCIBLE —
// which rules out identifier/whitespace minification (that collapses the ~20K body into
// one dense unreproducible line and corrupts the submit step). Instead do a CONSERVATIVE
// strip: drop only full-line `//` comments, blank lines, and trailing whitespace. This
// keeps every statement on its own line (still readable + debuggable), never touches code
// or string contents (a line with inline/trailing `//`, a URL, or a `//`-in-string is
// kept whole), and still cuts ~27% (~6.7K/call) — enough to collapse the practice split
// into one call and drop the roster/schedule temps under the 50K `code` limit. Syntax-
// checked with a raw-body fallback so the pipeline can never break on it.
function slimBody(body) {
  try {
    const slim = body
      .split("\n")
      .map((l) => l.replace(/\s+$/, ""))
      .filter((l) => { const s = l.trim(); return s && !s.startsWith("//"); })
      .join("\n");
    Object.getPrototypeOf(async () => {}).constructor(slim); // parse as async body (top-level await/return OK)
    if (!slim.includes("MANIFEST") || !slim.includes("PHASE")) throw new Error("MANIFEST/PHASE dropped");
    return slim;
  } catch (e) {
    console.error(`  ⚠ builder-body slim skipped (${e.message}) — shipping raw body`);
    return body;
  }
}

export async function emitCalls(manifest, out, limit) {
  const bodySrc = await readFile(new URL("./figma-reconstruct-library.plugin.js", import.meta.url), "utf8");
  const rawBody = bodySrc.slice(bodySrc.indexOf("async function getOrCreateCollection"));
  const body = slimBody(rawBody);
  if (body.length < rawBody.length) console.error(`  ✓ builder body slimmed ${rawBody.length}B → ${body.length}B (${Math.round(100 * (1 - body.length / rawBody.length))}% smaller, per call; multi-line preserved)`);
  const base = { blockPageName: manifest.blockPageName, brandCollectionName: manifest.brandCollectionName, brandColors: manifest.brandColors, fonts: manifest.fonts, views: manifest.views, widths: manifest.widths };
  const assemble = (m, phase) => `const MANIFEST=${JSON.stringify(m)};\nconst PHASE=${JSON.stringify(phase)};\n${body}`;
  // Per-variation subdir so different variations' call payloads never clobber.
  const dir = join(out, "reconstruct-calls", manifest.variation);
  await rm(dir, { recursive: true, force: true }); // wipe stale payloads (e.g. per-view temp files from a prior over-limit run) so nothing to hand-clean
  await mkdir(dir, { recursive: true });
  const plan = { note: "INVARIANT: every *.js call file embeds the SAME builder body (read once from the plugin); files differ ONLY in their leading `const MANIFEST=…;` + `const PHASE=…;` lines — do NOT diff/md5 the bodies to 'verify', they are identical by construction. PART 1 (Styleguide+Blocks): submit each calls[].file as the use_figma `code` param (with your fileKey), collect photos[] from each return + upload_assets, then submit _combine.js. PART 2 (Pages from blocks): once blocks exist, submit each compose[].file — one per page, fan out in parallel — to compose design Pages from block instances (resolved BY NAME off the Block Library page).", calls: [], combine: [], compose: [], oversized: [] };
  // Greedily PACK blocks into batches that each fit one call's `limit`. The fixed
  // builder body dominates every payload, so batching both amortizes it across
  // several blocks AND — the real win — makes far fewer sequential use_figma
  // round-trips (the export's dominant cost). The builder already iterates
  // MANIFEST.blocks, so a batch is just `blocks: [b1, b2, …]`. A block too big even
  // alone (`solo > limit`) falls to the per-view split path (temp builds+combine),
  // unchanged. pruneStale stays off (batches are partial), so nothing clobbers
  // sibling batches.
  let batch = [];
  let packed = 0; // total blocks folded into batch calls
  const flush = async () => {
    if (!batch.length) return;
    const code = assemble({ ...base, blocks: batch }, "reconstruct");
    const n = plan.calls.filter((c) => c.batch).length + 1;
    const f = `blocks-${String(n).padStart(2, "0")}.js`;
    await writeFile(join(dir, f), code);
    plan.calls.push({ file: f, phase: "reconstruct", batch: true, blockIds: batch.map((b) => b.blockId), blocks: batch.length, bytes: code.length });
    packed += batch.length;
    batch = [];
  };
  for (const blk of manifest.blocks) {
    const views = Object.keys(blk.views);
    const solo = assemble({ ...base, blocks: [blk] }, "reconstruct");
    if (solo.length > limit) {
      // Too big even alone → close the open batch first (preserve page order),
      // then split this block per view into temp builds + a combine entry.
      await flush();
      for (const view of views) {
        const code = assemble({ ...base, views: [view], blocks: [{ ...blk, views: { [view]: blk.views[view] } }], temp: true }, "reconstruct");
        const f = `${blk.blockId}-${view}.js`; await writeFile(join(dir, f), code);
        plan.calls.push({ file: f, blockId: blk.blockId, phase: "reconstruct", temp: true, view, bytes: code.length });
        if (code.length > limit) plan.oversized.push({ blockId: blk.blockId, view, bytes: code.length });
      }
      plan.combine.push({ blockId: blk.blockId, name: blk.name, views });
      continue;
    }
    // Would adding this block overflow the open batch? Close it first, then start
    // a fresh batch with this block (which fits alone, checked above).
    if (batch.length && assemble({ ...base, blocks: [...batch, blk] }, "reconstruct").length > limit) await flush();
    batch.push(blk);
  }
  await flush();
  if (plan.combine.length) { const code = assemble({ blockPageName: manifest.blockPageName, combine: plan.combine }, "combine"); await writeFile(join(dir, "_combine.js"), code); plan.combineCall = { file: "_combine.js", bytes: code.length }; }
  // PART 2 — one compose call per page. Blocks carry NO componentId, so the builder
  // resolves each BY NAME off the Block Library page (Part 1's output). Tiny payloads
  // (body + page-order manifest), never near the limit; fan out in parallel per page.
  for (const pg of manifest.pages || []) {
    if (!pg.blocks || !pg.blocks.length) continue;
    const m = { page: { id: pg.id, name: pg.name, route: pg.route, blocks: pg.blocks.map((b) => ({ blockId: b.blockId, name: b.name })) }, views: manifest.views, widths: manifest.widths, blockPageName: manifest.blockPageName };
    const code = assemble(m, "compose");
    const f = `_compose-${pg.id}.js`; await writeFile(join(dir, f), code);
    plan.compose.push({ file: f, page: pg.id, name: pg.name, blocks: pg.blocks.length, bytes: code.length });
  }
  await writeFile(join(dir, "_plan.json"), JSON.stringify(plan, null, 2));
  const batchCalls = plan.calls.filter((c) => c.batch).length;
  console.error(`✓ emitted ${plan.calls.length} block call(s)${plan.combine.length ? " + _combine.js" : ""} + ${plan.compose.length} compose call(s) + _plan.json → ${dir}`);
  console.error(`  Part 1: ${packed} block(s) packed into ${batchCalls} call(s), ${plan.combine.length} split into per-view temp+combine. Part 2: ${plan.compose.length} page(s) to compose.`);
  if (plan.oversized.length) console.error(`  ⚠ ${plan.oversized.length} single view(s) STILL exceed ${limit}B even shrunk — will fail the 50K limit; node-tree split needed: ${plan.oversized.map((o) => `${o.blockId}/${o.view} (${o.bytes}B)`).join(", ")}`);
  return plan;
}

const FALLBACK_WIDTHS = { desktop: 1440, tablet: 664, mobile: 370 };
const VIEWPORT_HEIGHT = 900;
// Per-view capture height, matched to the device-frame portrait heights in the
// live preview (PhoneFrame 780, TabletFrame 900, desktop unframed). Keeps
// `min-h-full` content resolving to the SAME device height in the reconstructed
// Figma block as in the preview — without this a full-height mobile section
// measures at 900 here but 780 in the phone frame, so preview↔Figma diverge.
const VIEWPORT_HEIGHTS = { desktop: 900, tablet: 900, mobile: 780 };
const viewHeight = (view) => VIEWPORT_HEIGHTS[view] ?? VIEWPORT_HEIGHT;


// Read-only inspection of an EXISTING manifest (+ its _plan.json, if emitted). No
// capture, no dev server, no Figma — so you can understand block structure/sizes
// without improvising `node -e` snippets (which each trigger a fresh permission
// prompt). This is THE way to inspect the reconstruct output.
export async function printManifest(args) {
  const kb = (bytes) => (bytes / 1024).toFixed(1) + "KB";
  const path = join(args.out, `reconstruct-${args.variation}.json`);
  let m;
  try { m = JSON.parse(await readFile(path, "utf8")); }
  catch { console.error(`No manifest at ${path}. Run the extractor first (without --print) to generate it.`); return; }
  const blocks = m.blocks || [];
  // Drill into ONE block: node-type composition + heaviest sub-nodes. Replaces the
  // ad-hoc `python3 -c` / `node -e` a designer's Claude would otherwise improvise to
  // work out WHY a block is oversized (usually a few heavy inline SVGs). Read-only.
  if (args.block) {
    const b = blocks.find((x) => x.blockId === args.block);
    if (!b) { console.error(`No block "${args.block}" in ${path}. Blocks present: ${blocks.map((x) => x.blockId).join(", ")}`); return; }
    const selfBytes = (n) => JSON.stringify({ ...n, children: undefined }).length; // node minus its subtree
    console.log(`\nblock "${b.blockId}" (${b.name}) — node composition\n`);
    for (const [view, spec] of Object.entries(b.views || {})) {
      const counts = {}; const bytesByKind = {}; const nodes = [];
      const walk = (n) => {
        const kind = n.kind || "element";
        const sb = selfBytes(n);
        counts[kind] = (counts[kind] || 0) + 1;
        bytesByKind[kind] = (bytesByKind[kind] || 0) + sb;
        nodes.push({ label: kind === "element" && n.tag ? `element <${n.tag}>` : kind, self: sb, svg: n.svg ? n.svg.length : 0 });
        for (const c of n.children || []) walk(c);
      };
      walk(spec);
      const specBytes = JSON.stringify(spec).length;
      console.log(`  ${view}: ${nodes.length} nodes, ${kb(specBytes)} total`);
      // Weight BY KIND (count · total self-bytes · % of block) — the "SVG is 63% of
      // this block" signal that tells you what to trim on an oversized block.
      for (const k of Object.keys(bytesByKind).sort((a, c) => bytesByKind[c] - bytesByKind[a])) {
        console.log(`      ${k.padEnd(9)} ${String(counts[k]).padStart(3)} nodes  ${kb(bytesByKind[k]).padStart(8)}  ${Math.round(100 * bytesByKind[k] / specBytes)}%`);
      }
      nodes.sort((a, c) => c.self - a.self);
      console.log(`    heaviest nodes (self size, subtree excluded):`);
      for (const n of nodes.slice(0, 8)) console.log(`      ${n.label.padEnd(18)} ${kb(n.self).padStart(8)}${n.svg ? `  · svg markup ${kb(n.svg)}` : ""}`);
      console.log("");
    }
    return;
  }
  console.log(`\nreconstruct manifest — ${args.variation}  (${path})`);
  console.log(`  keys: ${Object.keys(m).join(", ")}`);
  console.log(`  views: ${(m.views || []).join(", ")}   widths: ${JSON.stringify(m.widths || {})}`);
  console.log(`  ${blocks.length} block(s) [{blockId,name,page,route,views}], ${(m.pages || []).length} page(s), ${(m.assets || []).length} asset(s)\n`);
  const rows = blocks.map((b) => {
    const entries = Object.entries(b.views || {});
    return {
      page: b.page || "", blockId: b.blockId, name: b.name || "",
      views: entries.map(([v]) => v).join(","),
      per: entries.map(([v, spec]) => `${v}:${kb(JSON.stringify(spec).length)}`).join(" "),
      total: entries.reduce((n, [, spec]) => n + JSON.stringify(spec).length, 0),
    };
  });
  const wId = Math.max(5, ...rows.map((r) => r.blockId.length));
  const wNm = Math.max(4, ...rows.map((r) => r.name.length));
  console.log(`  ${"PAGE".padEnd(8)}${"BLOCK".padEnd(wId + 2)}${"NAME".padEnd(wNm + 2)}${"VIEWS".padEnd(15)}SIZE`);
  for (const r of rows) console.log(`  ${r.page.padEnd(8)}${r.blockId.padEnd(wId + 2)}${r.name.padEnd(wNm + 2)}${r.views.padEnd(15)}${kb(r.total)}  (${r.per})`);
  if ((m.pages || []).length) {
    console.log(`\n  pages (compose order):`);
    for (const p of m.pages) console.log(`    ${(p.id || "").padEnd(10)} ${(p.blocks || []).map((b) => b.blockId).join(" → ")}`);
  }
  try {
    const plan = JSON.parse(await readFile(join(args.out, "reconstruct-calls", args.variation, "_plan.json"), "utf8"));
    const batchCalls = plan.calls.filter((c) => c.batch);
    const packed = batchCalls.reduce((n, c) => n + (c.blocks || 0), 0);
    console.log(`\n  _plan.json: ${packed} block(s) → ${batchCalls.length} batched call(s), ${plan.combine.length} split, ${plan.compose.length} compose page(s)${plan.oversized.length ? `, ${plan.oversized.length} oversized ⚠` : ""}`);
    // Full submission order — submit each file as the use_figma `code` param in THIS
    // order (Part 1 block calls → _combine.js → Part 2 compose). No need to read
    // _plan.json yourself.
    console.log(`  submission order:`);
    for (const c of plan.calls) {
      const label = c.batch ? `[${(c.blockIds || []).join(", ")}]` : (c.temp ? `${c.blockId} (${c.view} temp)` : c.blockId);
      console.log(`    ${c.file.padEnd(26)} ${kb(c.bytes).padStart(8)}  ${label}`);
    }
    if (plan.combineCall) console.log(`    ${plan.combineCall.file.padEnd(26)} ${kb(plan.combineCall.bytes).padStart(8)}  combine → ${plan.combine.map((c) => c.blockId).join(", ")}`);
    for (const c of plan.compose) console.log(`    ${c.file.padEnd(26)} ${kb(c.bytes).padStart(8)}  compose ${c.page}`);
    if (plan.oversized.length) console.log(`    ⚠ oversized (node-tree split needed): ${plan.oversized.map((o) => `${o.blockId}/${o.view}`).join(", ")}`);
  } catch { /* no _plan.json yet (run with --emit-calls) — fine */ }
  console.log("");
}
