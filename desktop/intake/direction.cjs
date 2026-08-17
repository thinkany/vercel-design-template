// The design-variety SAMPLER — THE SEAM. See docs/design-variety-spec.md and
// design-variety-p1-tickets.md (T1). This is the ONLY module that imports the lens
// deck (`lenses.cjs`); the rest of the app touches design variety exclusively through
// the exports here. Inputs and outputs are plain serializable objects and the exported
// surface is intentionally small + async-friendly, so the deck + sampler can later move
// behind an authed cloud endpoint with no caller changes.
//
// House style: typographic apostrophes, no em-dashes.

const { AXES, MOTIFS, LENSES } = require("./lenses.cjs");

const AXIS_NAMES = Object.keys(AXES);   // convention, energy, structure, era
const MOTIF_SLOTS = Object.keys(MOTIFS); // eyebrow, hero, sectionRhythm, featureLayout, divider

// ── Tuning (T2 refines against real samples; kept here so tuning is a data edit) ──
const TUNING = {
  axisSharpness: 2.5,  // >1 sharpens the pull toward axis-matching lenses
  fitWeight: 0.6,      // weight added per fitTag matched to the brief's tags
  lensFloor: 0.04,     // minimum lens weight, so no lens ever fully starves
  // Per-axis weights for AUTO sampling a stop (index-aligned to AXES[axis]). A mild
  // center-lean, so extreme combos are less frequent but always reachable.
  autoAxisBias: {
    convention: [1.0, 1.3, 1.3, 1.0],
    energy:     [1.1, 1.3, 1.2, 0.9],
    structure:  [1.2, 1.3, 1.1, 0.9],
    era:        [1.2, 1.1, 1.4, 0.7],
  },
};

// ── Seeded PRNG (mulberry32). A SEPARATE stream per decision domain, sub-seeded from
//    the master seed, so that pinning axes (which skips the axis stream) does NOT shift
//    the lens/motif streams. That is what makes `seed + axes` reproduce the same lens +
//    motifs regardless of whether the axes were auto-sampled or supplied. ──
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SUB = { axis: 0x0a11, lens: 0x0b22, motif: 0x0c33 };
function streamFor(seed, domain, salt = 0) {
  return mulberry32((seed ^ SUB[domain] ^ Math.imul(salt, 0x9e3779b1)) | 0);
}

function weightedIndex(rng, weights) {
  let total = 0;
  for (const w of weights) total += w > 0 ? w : 0;
  if (total <= 0) return Math.floor(rng() * weights.length);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] > 0 ? weights[i] : 0;
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

// Normalize the caller's signals (vertical, tone, projectType, brand) into a lowercase
// tag set matched against each lens's `fitTags`. Rough in T1; T2 enriches the mapping.
function deriveTags(inputs) {
  const out = new Set();
  const push = (v) => { if (v == null) return; String(v).toLowerCase().split(/[^a-z0-9+]+/).forEach((t) => t && out.add(t)); };
  const add = (v) => (Array.isArray(v) ? v.forEach(push) : push(v));
  add(inputs.vertical); add(inputs.tone); add(inputs.projectType);
  if (inputs.brand && typeof inputs.brand === "object") { add(inputs.brand.vertical); add(inputs.brand.industry); }
  return out;
}

const stopIndex = (name, stop) => Math.max(0, AXES[name].indexOf(stop));

// Resolve the four axes: keep any the caller pinned (knobs), auto-sample the rest off
// the axis stream. Returns the full axes plus how many were validly pinned.
function resolveAxes(rng, pinned) {
  const axes = {};
  let pinnedCount = 0;
  for (const name of AXIS_NAMES) {
    const stops = AXES[name];
    const given = pinned && typeof pinned[name] === "string" && stops.includes(pinned[name]) ? pinned[name] : null;
    if (given) { axes[name] = given; pinnedCount++; continue; }
    const bias = TUNING.autoAxisBias[name] || stops.map(() => 1);
    axes[name] = stops[weightedIndex(rng, bias)];
  }
  return { axes, pinnedCount };
}

// How well a lens matches the resolved axes: average per-axis closeness in [0,1],
// then sharpened so nearer lenses are strongly preferred.
function axisScore(axes, lens) {
  let sum = 0;
  for (const name of AXIS_NAMES) {
    const d = Math.abs(stopIndex(name, axes[name]) - stopIndex(name, lens.axisAffinity[name]));
    sum += 1 - d / (AXES[name].length - 1);
  }
  return Math.pow(sum / AXIS_NAMES.length, TUNING.axisSharpness);
}

function fitScore(tags, lens) {
  if (!tags || tags.size === 0) return 1;
  let matches = 0;
  for (const t of lens.fitTags || []) if (tags.has(t)) matches++;
  return 1 + matches * TUNING.fitWeight;
}

function pickLens(rng, axes, tags) {
  const weights = LENSES.map((l) => TUNING.lensFloor + axisScore(axes, l) * fitScore(tags, l));
  return LENSES[weightedIndex(rng, weights)];
}

function pickMotifs(seed, lens) {
  const motifs = {};
  MOTIF_SLOTS.forEach((slot, i) => {
    const eligible = (lens.motifEligibility && lens.motifEligibility[slot]) || MOTIFS[slot];
    const rng = streamFor(seed, "motif", i + 1);
    // Uniform within the lens's eligible set (T2 may add per-slot axis weighting). This
    // alone demotes an overused motif to 1-in-N wherever a lens makes it eligible.
    motifs[slot] = eligible[Math.floor(rng() * eligible.length)];
  });
  return motifs;
}

/**
 * Sample a Direction from a brief's signals. THE public seam.
 * @param {object} inputs { seed?, axes?, brand?, tone?, projectType?, vertical?, references?, history? }
 *   P1 consumes seed, axes, and the brand/tone/vertical tag signals. `references` and
 *   `history` are accepted (forward-compatible) but not yet influential.
 * @returns {{seed:number, axes:object, lens:string, motifs:object, source:string}}
 *   Deterministic given `seed`; `seed + axes` reproduces the same lens + motifs.
 */
function sampleDirection(inputs = {}) {
  const seed = Number.isFinite(inputs.seed) ? inputs.seed | 0 : Math.floor(Math.random() * 0xffffffff) | 0;
  const tags = deriveTags(inputs);
  const pinned = inputs.axes && typeof inputs.axes === "object" ? inputs.axes : null;
  const { axes, pinnedCount } = resolveAxes(streamFor(seed, "axis"), pinned);
  const lens = pickLens(streamFor(seed, "lens"), axes, tags);
  const motifs = pickMotifs(seed, lens);
  const source = pinnedCount > 0 ? "knobs" : "auto";
  return { seed, axes, lens: lens.id, motifs, source };
}

module.exports = { sampleDirection };
