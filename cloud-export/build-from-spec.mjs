#!/usr/bin/env node
// ©2026 thinkany llc. All rights reserved.
/**
 * build-from-spec.mjs — the BRIDGE from a cloud-derived BuildSpec to the existing
 * use_figma builder.
 *
 * The cloud path ends with capture-client --post writing a BuildSpec to
 * cloud-export/out/reconstruct-{v}.json. The Figma build itself is unchanged: it
 * still runs through emitCalls() in scripts/export-reconstruct-to-figma.mjs, which
 * packs a spec into ready-to-submit use_figma call payloads
 * (reconstruct-calls/{variation}/ _plan.json + per-block .js). This bridge just feeds the cloud spec into that
 * packer — no puppeteer, no browser, purely local (the build layer stays local
 * under the user's Figma auth). Output is byte-identical to the old offline
 * `export-reconstruct --emit-calls`, so the /export-figma Part 1 / Part 2
 * orchestration consumes it verbatim.
 *
 * USAGE
 *   node cloud-export/build-from-spec.mjs -v v00
 *   node cloud-export/build-from-spec.mjs --in cloud-export/out/reconstruct-v00.json
 *
 * Typical flow:
 *   DERIVE_ENDPOINT=… DERIVE_LICENSE_KEY=… \
 *     node cloud-export/capture-client.mjs -v v00 --post   # → out/reconstruct-v00.json
 *   node cloud-export/build-from-spec.mjs -v v00           # → out/reconstruct-calls/v00/
 *   # then submit each reconstruct-calls/{variation}/*.js via use_figma (see /export-figma)
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { emitCalls } from "../scripts/export-reconstruct-to-figma.mjs";

function parseArgs(argv) {
  const args = { variation: "v00", in: null, out: null, limit: 48000 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--variation" || a === "-v") args.variation = argv[++i];
    else if (a === "--in") args.in = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--limit") args.limit = parseInt(argv[++i], 10) || 48000;
    else if (a === "--help" || a === "-h") args.help = true;
  }
  return args;
}

function help() {
  console.log(`
build-from-spec — pack a cloud-derived BuildSpec into use_figma call payloads.

  node cloud-export/build-from-spec.mjs [options]
  -v, --variation <id>   Variation (default v00)
      --in <path>        BuildSpec JSON (default <out>/reconstruct-{v}.json)
      --out <dir>        Output dir (default cloud-export/out)
      --limit <n>        Max bytes per use_figma call (default 48000)
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return help();
  const outDir = args.out || fileURLToPath(new URL("./out", import.meta.url));
  const inPath = args.in || join(outDir, `reconstruct-${args.variation}.json`);

  let spec;
  try { spec = JSON.parse(await readFile(inPath, "utf8")); }
  catch (e) { throw new Error(`cannot read BuildSpec at ${inPath}: ${e.message} (run capture-client --post first, or pass --in)`); }
  if (!spec || spec.contract !== 1 || !Array.isArray(spec.blocks)) throw new Error(`${inPath} is not a v1 BuildSpec`);
  if (!spec.blocks.length) throw new Error(`BuildSpec has no blocks — nothing to build`);

  const plan = await emitCalls(spec, outDir, args.limit);
  const callsDir = join(outDir, "reconstruct-calls", spec.variation);
  console.error(`✓ bridge: packed ${spec.blocks.length} block(s) → ${callsDir}`);
  console.error(`  Next: submit each reconstruct-calls/${spec.variation}/*.js as the use_figma \`code\` param (see /export-figma Part 1), then _combine.js, then compose.`);
  console.log(JSON.stringify({
    inPath, callsDir,
    calls: plan.calls.length, splitBlocks: plan.combine.length,
    composePages: plan.compose.length, oversized: plan.oversized.length,
  }, null, 2));
}

main().then(() => process.exit(0), (err) => { console.error(String(err.message || err)); process.exit(1); });
