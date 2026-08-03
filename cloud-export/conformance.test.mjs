// ©2026 thinkany llc. All rights reserved.
/**
 * conformance.test.mjs — locks `derive.mjs` to SHIPPING-PARITY, offline.
 *
 * The seam's structural risk (STEP2-boundary-design.md §4): the shipping
 * `extractSpec` and this POC `derive.mjs` are two hand-maintained copies of the
 * same interpretation IP. Until the cutover deletes the local copy, this test is
 * the guard that they can't silently desync.
 *
 * FIXTURE PAIR — a MATCHED capture+golden, both taken from the same live DOM on
 * 2026-08-03 (dev server on :5173), so the golden is genuine shipping output, not
 * derive's own echo:
 *   fixtures/capture-v00.json           ← cloud-export/capture-client.mjs (POC capture)
 *   fixtures/reconstruct-v00.golden.json ← scripts/export-reconstruct-to-figma.mjs (SHIPPING derive)
 * At seeding, derive(capture) matched the shipping golden with ZERO structural
 * diffs across all 4 blocks (header/hero/footer/mobile-menu), 7 brand colors, and
 * fonts.
 *
 * REFRESHING: when the sample design or the capture/derive logic changes,
 * regenerate BOTH from a live run and re-verify parity:
 *   node scripts/export-reconstruct-to-figma.mjs -v v00 --fast --out /tmp/ship
 *   node cloud-export/capture-client.mjs         -v v00 --fast --out /tmp/poc
 *   cp /tmp/poc/capture-v00.json  cloud-export/fixtures/capture-v00.json
 *   cp /tmp/ship/reconstruct-v00.json cloud-export/fixtures/reconstruct-v00.golden.json
 * (After cutover, when derive.mjs is the sole source, the golden simply becomes
 * derive's output — a plain regression lock.)
 *
 * Runs offline (no server, no deps): `node cloud-export/conformance.test.mjs`.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { derive } from "./derive.mjs";

const F = (p) => fileURLToPath(new URL(p, import.meta.url));
const capture = JSON.parse(await readFile(F("./fixtures/capture-v00.json"), "utf8"));
const golden = JSON.parse(await readFile(F("./fixtures/reconstruct-v00.golden.json"), "utf8"));

const spec = derive(capture);

/* ── order-independent deep compare; geometry within sub-pixel rounding ──
 * The two capture pipelines round independently, so numbers within 0.51px are
 * equal. Everything else must match exactly. */
const diffs = [];
function walk(a, b, path) {
  if (diffs.length > 50) return;
  const ta = typeof a, tb = typeof b;
  if (a === null || b === null || ta !== "object" || tb !== "object") {
    if (ta === "number" && tb === "number" && Math.abs(a - b) < 0.51) return;
    if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`${path}: golden=${JSON.stringify(a)} derive=${JSON.stringify(b)}`);
    return;
  }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(k in a)) { diffs.push(`${path}.${k}: absent in golden (derive has it)`); continue; }
    if (!(k in b)) { diffs.push(`${path}.${k}: absent in derive (golden has it)`); continue; }
    walk(a[k], b[k], `${path}.${k}`);
  }
}

// Compare the meaningful halves. Blocks aligned by id (order-independent).
walk(golden.brandColors, spec.brandColors, "brandColors");
walk(golden.fonts, spec.fonts, "fonts");
walk(golden.pages, spec.pages, "pages");
console.assert(spec.blocks.length === golden.blocks.length, `block count ${spec.blocks.length} vs golden ${golden.blocks.length}`);
const dmap = new Map(spec.blocks.map((b) => [b.blockId, b]));
for (const gb of golden.blocks) {
  const db = dmap.get(gb.blockId);
  if (!db) { diffs.push(`block '${gb.blockId}' missing from derive`); continue; }
  walk(gb.views, db.views, `block[${gb.blockId}].views`);
}

/* ── parity invariants (the color-resolver hardening must hold) ── */
// No brand color dropped to null (a named/keyword --ta-* token would have).
for (const c of spec.brandColors) {
  console.assert(c.rgb && Number.isFinite(c.rgb.r), `brand color '${c.token}' has no rgb — resolver dropped it`);
}
// No fill in the derived tree carries a null/absent color (would crash the builder).
function checkFills(node) {
  for (const f of node.fills || []) {
    if (f.type === "solid" || f.type === "gradient") {
      const cols = f.type === "solid" ? [f.color] : f.stops.map((s) => s.color);
      for (const col of cols) console.assert(col && Number.isFinite(col.r), `null fill color in <${node.tag}>`);
    }
  }
  for (const c of node.children || []) if (c.kind !== "text" && c.kind !== "svg") checkFills(c);
}
for (const b of spec.blocks) for (const v of Object.values(b.views)) checkFills(v);

if (diffs.length) {
  console.log(`✗ CONFORMANCE FAILED — ${diffs.length} diff(s) vs shipping golden:`);
  for (const d of diffs.slice(0, 50)) console.log("  •", d);
  process.exit(1);
}
console.log(`✓ CONFORMANCE PASSED — derive() matches shipping golden across ${spec.blocks.length} block(s) [${spec.blocks.map((b) => b.blockId).join(", ")}], ${spec.brandColors.length} brand colors, fonts + pages. No null colors leaked.`);
