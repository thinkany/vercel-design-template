// The design-variety SAMPLER — THE SEAM. See docs/design-variety-spec.md and
// design-variety-p1-tickets.md (T1). This is the ONLY module that imports the lens
// deck (`lenses.cjs`); the rest of the app touches design variety exclusively through
// the exports here. Inputs and outputs are plain serializable objects and the exported
// surface is intentionally small + async-friendly, so the deck + sampler can later move
// behind an authed cloud endpoint with no caller changes.
//
// House style: typographic apostrophes, no em-dashes.

const { AXES, AXIS_RUBRIC, MOTIFS, MOTIF_GLOSS, LENSES } = require("./lenses.cjs");

const AXIS_NAMES = Object.keys(AXES);   // convention, energy, structure, era
const MOTIF_SLOTS = Object.keys(MOTIFS); // eyebrow, hero, sectionRhythm, featureLayout, divider
const LENS_BY_ID = Object.fromEntries(LENSES.map((l) => [l.id, l]));

// The known-overused defaults the block tells the build to avoid unless the sampled
// direction specifically calls for them (lever 6, the thin backstop).
const NEGATIVE_DEFAULTS = [
  "numbered section eyebrows (01 / 02 / 03) when the direction did not call for them",
  "a centered hero with two side-by-side buttons",
  "the identical Hero, Features, Testimonials, Pricing, FAQ, CTA section order",
  "\"X reasons why\" or \"X ways to\" headings",
  "generic stock-photo hero images used as filler",
];

// ── Tuning (T2, refined against the offline batch; kept here so tuning is a data edit) ──
const TUNING = {
  axisSharpness: 2.6,  // >1 sharpens the pull toward axis-matching lenses
  fitWeight: 1.6,      // weight added per fitTag matched to the brief's tags
  lensFloor: 0.03,     // minimum lens weight, so no lens ever fully starves
  nameBoost: 14,       // weight multiplier when a distinctive style/movement is NAMED in the brief
  toneNudge: 3.6,      // how hard a mood word in the DESCRIPTION pushes its axis stop
  toneCopyNudge: 1.3,  // the copy-voice `tone` only pulls the VISUAL axes marginally (it is
                       // about the words, not the layout: "understated editorial" copy can
                       // sit on a vibrant design)
  // Per-axis weights for AUTO sampling a stop (index-aligned to AXES[axis]). Near-flat so
  // the tone nudges (below) and fit actually steer; extremes stay reachable.
  autoAxisBias: {
    convention: [1.0, 1.15, 1.15, 1.0],
    energy:     [1.05, 1.15, 1.1, 0.95],
    structure:  [1.1, 1.15, 1.05, 0.95],
    era:        [1.1, 1.05, 1.2, 0.9],
  },
};

// Natural-language → canonical fitTag vocabulary. The words designers actually type
// ("law", "corporate", "skincare") rarely equal a lens fitTag ("legal", "b2b", "beauty"),
// so bridge them. Applied in deriveTags to every token of the description + tone.
const KEYWORD_TAGS = {
  law: ["legal"], lawyer: ["legal"], attorney: ["legal"], legal: ["legal"], firm: ["b2b"],
  corporate: ["b2b", "enterprise"], company: ["b2b"], business: ["b2b"], enterprise: ["enterprise"],
  b2b: ["b2b"], consulting: ["consulting"], consultancy: ["consulting"], advisory: ["consulting"],
  startup: ["tech"], saas: ["tech", "b2b"], software: ["tech"], platform: ["tech"], tool: ["tech"],
  developer: ["dev-tools", "technical"], dev: ["dev-tools"], api: ["api", "dev-tools"], sdk: ["dev-tools"],
  code: ["dev-tools", "technical"], coding: ["dev-tools"], engineering: ["technical"], engineer: ["technical"],
  infrastructure: ["infra", "dev-tools"], infra: ["infra"], devops: ["infra"], cloud: ["infra"], database: ["infra"],
  security: ["security"], cybersecurity: ["security"], crypto: ["crypto"], blockchain: ["crypto"], web3: ["crypto"], nft: ["crypto"],
  ai: ["ai"], ml: ["ai"], intelligence: ["ai"], llm: ["ai"], model: ["ai"], robotics: ["hardware"], hardware: ["hardware"], device: ["hardware"],
  space: ["space"], aerospace: ["space"], satellite: ["space"],
  bank: ["finance"], banking: ["finance"], finance: ["finance"], financial: ["finance"], invest: ["finance"], investment: ["finance"],
  fintech: ["finance"], budgeting: ["finance"], payments: ["finance"], money: ["finance"], insurance: ["insurance"],
  health: ["healthcare"], healthcare: ["healthcare"], medical: ["healthcare"], clinic: ["healthcare"], doctor: ["healthcare"],
  dental: ["healthcare"], therapy: ["wellness", "healthcare"], wellness: ["wellness"], fitness: ["wellness"], gym: ["wellness"],
  yoga: ["wellness"], pilates: ["wellness"], meditation: ["wellness"], spa: ["wellness", "beauty"],
  beauty: ["beauty"], skincare: ["beauty"], cosmetic: ["beauty"], cosmetics: ["beauty"], makeup: ["beauty"],
  luxury: ["luxury"], premium: ["luxury"], exclusive: ["luxury"], jewelry: ["jewelry"], jewellery: ["jewelry"], watches: ["jewelry"],
  fashion: ["fashion"], clothing: ["fashion"], apparel: ["fashion"], streetwear: ["fashion"], wear: ["fashion"], outfit: ["fashion"],
  hotel: ["hospitality"], resort: ["hospitality"], hospitality: ["hospitality"], restaurant: ["hospitality", "food"],
  cafe: ["hospitality", "food"], coffee: ["food"], bar: ["hospitality"], dining: ["hospitality", "food"],
  food: ["food"], bakery: ["food"], bake: ["food"], kitchen: ["food"], chef: ["food"], culinary: ["food"], grocery: ["food"], cuisine: ["food"],
  photography: ["photography"], photographer: ["photography"], photo: ["photography"], film: ["photography"], cinema: ["photography"],
  art: ["art"], gallery: ["art"], museum: ["art"], artist: ["art"], painting: ["art"], sculpture: ["art"], portfolio: ["portfolio"],
  architecture: ["architecture"], architect: ["architecture"], interior: ["architecture"], building: ["architecture"], construction: ["architecture"],
  design: ["design-studio"], studio: ["design-studio"], creative: ["agency"], agency: ["agency"], branding: ["agency", "design-studio"],
  music: ["music"], band: ["music"], album: ["music"], record: ["music"], dj: ["music"], festival: ["events", "music"],
  event: ["events"], events: ["events"], conference: ["events"], wedding: ["events"], party: ["events"],
  game: ["gaming"], gaming: ["gaming"], games: ["gaming"], arcade: ["gaming"],
  kids: ["kids"], children: ["kids"], child: ["kids"], toddler: ["kids"], baby: ["kids"], toy: ["kids"], toys: ["kids"], family: ["kids"],
  education: ["education", "edtech"], school: ["education"], learn: ["education", "edtech"], learning: ["education", "edtech"],
  course: ["education"], teach: ["education"], university: ["education"], academy: ["education"], tutor: ["education"], edtech: ["edtech"],
  nonprofit: ["nonprofit"], charity: ["nonprofit"], foundation: ["nonprofit"], ngo: ["nonprofit"], volunteer: ["nonprofit", "community"], community: ["community"],
  media: ["media"], news: ["media"], magazine: ["media", "editorial"], publisher: ["publishing"], publishing: ["publishing"],
  blog: ["media"], journal: ["publishing"], editorial: ["editorial"], lifestyle: ["lifestyle"], culture: ["culture"], cultural: ["culture"],
  retail: ["consumer"], shop: ["consumer"], store: ["consumer"], ecommerce: ["consumer", "dtc"], commerce: ["consumer"],
  product: ["consumer"], dtc: ["dtc"], d2c: ["dtc"], entertainment: ["entertainment"], streaming: ["entertainment"], tv: ["entertainment"],
  // Art / design movements named in the brief → the movement lens's fitTag, so naming one
  // surfaces it (multi-word / hyphenated names lose their hyphen when tokenized, so bridge
  // the fragments too: "mid century" → century, "art deco" → deco, etc.).
  bauhaus: ["bauhaus"], modernist: ["bauhaus", "modernist"], midcentury: ["mid-century"], century: ["mid-century"],
  deco: ["art-deco"], artdeco: ["art-deco"], memphis: ["memphis"], postmodern: ["memphis"],
  constructivist: ["constructivist"], constructivism: ["constructivist"],
  destijl: ["de-stijl"], stijl: ["de-stijl"], mondrian: ["de-stijl", "mondrian"],
  nouveau: ["art-nouveau"], artnouveau: ["art-nouveau"], psychedelic: ["psychedelic"], psychedelia: ["psychedelic"],
  y2k: ["y2k"], vaporwave: ["vaporwave", "y2k"], retrofuturist: ["y2k"],
};

// A DISTINCTIVE style/movement named in the brief → that exact lens gets a strong boost
// (nameBoost), so "a Bauhaus site" or "make it brutalist" lands that lens. Keyed on the
// tags after KEYWORD_TAGS expansion. Only unambiguous style names belong here (not generic
// adjectives like "minimal" or "modern", which should keep auto-varying).
const NAME_LENS = {
  bauhaus: "bauhaus", modernist: "bauhaus", "mid-century": "mid-century-modern",
  "art-deco": "art-deco", deco: "art-deco", "art-nouveau": "art-nouveau", nouveau: "art-nouveau",
  memphis: "memphis", constructivist: "constructivist", "de-stijl": "de-stijl", mondrian: "de-stijl",
  psychedelic: "psychedelic", y2k: "y2k-futurist", vaporwave: "y2k-futurist",
  brutalist: "brutalist", swiss: "swiss", international: "swiss", maximalist: "maximalist",
  monospace: "monospace-terminal", terminal: "monospace-terminal",
};
function namedLens(tags) {
  if (tags) for (const [kw, id] of Object.entries(NAME_LENS)) if (tags.has(kw)) return id;
  return null;
}

// Tone / mood words → an axis stop to boost when AUTO-sampling axes. Each matched word
// multiplies that stop's weight by TUNING.toneNudge, so "calm minimal" pulls the design
// toward calm energy + ordered structure (and thus lenses that live there).
const TONE_AXIS = {
  calm: { energy: "calm" }, quiet: { energy: "calm" }, serene: { energy: "calm" }, spacious: { energy: "calm" }, soft: { energy: "calm" },
  minimal: { energy: "calm", structure: "ordered" }, clean: { structure: "ordered", energy: "measured" }, simple: { structure: "ordered" },
  professional: { convention: "common", structure: "ordered" }, trustworthy: { convention: "common" }, credible: { convention: "common" },
  serious: { convention: "common" }, traditional: { era: "timeless", convention: "common" }, heritage: { era: "timeless" }, timeless: { era: "timeless" }, classic: { era: "classic" },
  elegant: { energy: "calm", structure: "balanced" }, refined: { energy: "calm" }, sophisticated: { structure: "balanced" }, luxurious: { energy: "calm" }, upscale: { energy: "calm" }, premium: { energy: "calm" },
  bold: { convention: "bold", energy: "lively" }, striking: { energy: "lively" }, confident: { convention: "bold" }, strong: { energy: "lively" },
  loud: { energy: "maximal" }, energetic: { energy: "lively" }, vibrant: { energy: "lively" }, dynamic: { energy: "lively" }, lively: { energy: "lively" },
  maximal: { energy: "maximal" }, expressive: { energy: "maximal" }, ornate: { energy: "maximal" }, rich: { energy: "maximal" },
  playful: { energy: "lively", structure: "loose", convention: "bold" }, fun: { energy: "lively", structure: "loose" }, friendly: { structure: "loose" }, cheerful: { energy: "lively" }, whimsical: { structure: "loose" },
  rebellious: { convention: "experimental", structure: "loose" }, raw: { convention: "experimental" }, edgy: { convention: "experimental" }, gritty: { structure: "loose" }, punk: { convention: "experimental" },
  experimental: { convention: "experimental" }, unconventional: { convention: "experimental" }, unexpected: { convention: "bold" }, weird: { convention: "experimental" },
  warm: { structure: "loose", energy: "measured" }, cozy: { structure: "loose" }, inviting: { structure: "loose" }, gentle: { energy: "calm" },
  handmade: { structure: "organic" }, organic: { structure: "organic" }, natural: { structure: "organic" }, earthy: { structure: "organic" }, crafted: { structure: "organic" }, artisan: { structure: "organic" }, rustic: { structure: "organic" },
  futuristic: { era: "avant-garde", energy: "lively" }, sleek: { era: "current" }, cutting: { era: "avant-garde" }, advanced: { era: "avant-garde" }, innovative: { era: "current" },
  modern: { era: "current" }, contemporary: { era: "current" }, current: { era: "current" }, retro: { era: "classic" }, vintage: { era: "classic" }, nostalgic: { era: "classic" }, throwback: { era: "classic" },
  technical: { structure: "ordered" }, precise: { structure: "ordered" }, systematic: { structure: "ordered" }, engineered: { structure: "ordered" },
  editorial: { structure: "balanced" }, romantic: { energy: "calm", structure: "balanced" }, dreamy: { energy: "calm" }, delicate: { energy: "calm" },
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

// Normalize the caller's signals (vertical, tone, projectType, brand, description) into a
// lowercase tag set matched against each lens's `fitTags`. Each token also expands through
// KEYWORD_TAGS so natural language reaches the canonical tag vocabulary.
function deriveTags(inputs) {
  const out = new Set();
  const push = (v) => {
    if (v == null) return;
    String(v).toLowerCase().split(/[^a-z0-9+]+/).forEach((t) => {
      if (!t) return;
      out.add(t);
      const syn = KEYWORD_TAGS[t];
      if (syn) syn.forEach((s) => out.add(s));
    });
  };
  const add = (v) => (Array.isArray(v) ? v.forEach(push) : push(v));
  // The DESCRIPTION + vertical carry the visual intent; the copy-voice `tone` is left out
  // of fit on purpose (it should not summon a lens by itself).
  add(inputs.vertical); add(inputs.projectType); add(inputs.what);
  if (inputs.brand && typeof inputs.brand === "object") { add(inputs.brand.vertical); add(inputs.brand.industry); }
  return out;
}

// Description + tone words → per-axis stop boosts (via TONE_AXIS), steering the auto-sampled
// axes. The DESCRIPTION (`what`) nudges at full strength (it carries the visual intent); the
// copy-voice `tone` only nudges marginally, so it shapes copy, not the layout.
function moodAxisNudges(inputs) {
  const nudges = {};
  const apply = (text, strength) => {
    if (text == null) return;
    String(text).toLowerCase().split(/[^a-z0-9+]+/).forEach((tok) => {
      const map = TONE_AXIS[tok];
      if (!map) return;
      for (const [axis, stop] of Object.entries(map)) {
        nudges[axis] = nudges[axis] || {};
        nudges[axis][stop] = (nudges[axis][stop] || 1) * strength;
      }
    });
  };
  apply(inputs.what, TUNING.toneNudge);
  apply(inputs.tone, TUNING.toneCopyNudge);
  return nudges;
}

const stopIndex = (name, stop) => Math.max(0, AXES[name].indexOf(stop));

// Resolve the four axes: keep any the caller pinned (knobs), auto-sample the rest off the
// axis stream, with tone `nudges` boosting the mood-appropriate stops. Returns the full
// axes plus how many were validly pinned.
function resolveAxes(rng, pinned, nudges) {
  const axes = {};
  let pinnedCount = 0;
  for (const name of AXIS_NAMES) {
    const stops = AXES[name];
    const given = pinned && typeof pinned[name] === "string" && stops.includes(pinned[name]) ? pinned[name] : null;
    if (given) { axes[name] = given; pinnedCount++; continue; }
    const base = TUNING.autoAxisBias[name] || stops.map(() => 1);
    const bias = base.slice();
    const nudge = nudges && nudges[name];
    if (nudge) for (const [stop, mult] of Object.entries(nudge)) {
      const i = stops.indexOf(stop);
      if (i >= 0) bias[i] *= mult;
    }
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

function fitMatches(tags, lens) {
  if (!tags || tags.size === 0) return 0;
  let m = 0;
  for (const t of lens.fitTags || []) if (tags.has(t)) m++;
  return m;
}

function pickLens(rng, axes, tags) {
  const named = namedLens(tags); // a distinctive style named in the brief
  const weights = LENSES.map((l) => {
    const matched = fitMatches(tags, l);
    const fit = 1 + matched * TUNING.fitWeight;
    // Specialty lenses (art movements, autoWeight < 1) stay a LIGHT presence in random
    // auto-variety; a fit match (the movement named in the brief) restores full weight.
    const aw = matched > 0 ? 1 : (l.autoWeight != null ? l.autoWeight : 1);
    const boost = named && l.id === named ? TUNING.nameBoost : 1; // named style dominates
    return TUNING.lensFloor + axisScore(axes, l) * fit * aw * boost;
  });
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
  // Direct pick from the style selector: use that lens exactly (motifs from its own
  // eligibility, axes = its affinity), bypassing the weighted lens draw. seed + lens reproduces.
  const picked = inputs.lens ? LENSES.find((l) => l.id === inputs.lens) : null;
  if (picked) {
    return { seed, axes: { ...picked.axisAffinity }, lens: picked.id, motifs: pickMotifs(seed, picked), source: "picked" };
  }
  const tags = deriveTags(inputs);
  const pinned = inputs.axes && typeof inputs.axes === "object" ? inputs.axes : null;
  const { axes, pinnedCount } = resolveAxes(streamFor(seed, "axis"), pinned, moodAxisNudges(inputs));
  const lens = pickLens(streamFor(seed, "lens"), axes, tags);
  const motifs = pickMotifs(seed, lens);
  const source = pinnedCount > 0 ? "knobs" : "auto";
  return { seed, axes, lens: lens.id, motifs, source };
}

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Render a Direction into the "Design direction" prompt block that buildDesignPrompt
 * folds into the /design-brief string. Prompt-ready English (house style: no em-dashes).
 * THE public seam alongside sampleDirection. Returns "" for a missing/unknown Direction.
 */
function renderDirectionPrompt(direction) {
  if (!direction || !direction.lens) return "";
  const lens = LENS_BY_ID[direction.lens];
  if (!lens) return "";
  const d = lens.directives || {};
  const motifs = direction.motifs || {};
  const gloss = (slot, val) => (MOTIF_GLOSS[slot] && MOTIF_GLOSS[slot][val]) || val;

  const out = [];
  out.push("## Design direction (this is what makes the design distinct, follow it)");
  out.push("");
  out.push(`This design takes a ${lens.label} direction. ${lens.description}`);
  out.push("");
  // Character is rendered from the LENS's own axis position, not the requested axes, so
  // it never contradicts the directives below. The requested axes (direction.axes) drove
  // WHICH lens was picked; they are kept on the Direction for reproduction + the knobs.
  out.push("Overall character:");
  for (const name of AXIS_NAMES) {
    const stop = lens.axisAffinity[name];
    const phrase = AXIS_RUBRIC[name] && AXIS_RUBRIC[name][stop];
    if (phrase) out.push(`- ${capitalize(name)} (${stop}): ${phrase}`);
  }
  out.push("");
  out.push("Apply these directives:");
  if (d.grid) out.push(`- Grid: ${d.grid}`);
  if (d.type) out.push(`- Type: ${d.type}`);
  if (d.sectionRhythm) out.push(`- Section rhythm: ${d.sectionRhythm}`);
  if (d.heroBias) out.push(`- Hero: ${d.heroBias}`);
  if (d.motifVocabulary) out.push(`- Motif vocabulary: ${d.motifVocabulary}`);
  if (d.density) out.push(`- Density: ${d.density}`);
  out.push("");
  out.push("Use these specific compositional choices, not the generic defaults:");
  out.push(`- Section eyebrow: ${gloss("eyebrow", motifs.eyebrow)}`);
  out.push(`- Hero: ${gloss("hero", motifs.hero)}`);
  out.push(`- Section rhythm: ${gloss("sectionRhythm", motifs.sectionRhythm)}`);
  out.push(`- Feature / content layout: ${gloss("featureLayout", motifs.featureLayout)}`);
  out.push(`- Section dividers: ${gloss("divider", motifs.divider)}`);
  if (Array.isArray(d.dos) && d.dos.length) { out.push(""); out.push("Do: " + d.dos.join("; ") + "."); }
  if (Array.isArray(d.donts) && d.donts.length) out.push("Avoid: " + d.donts.join("; ") + ".");
  out.push("");
  out.push("Do not use these overused defaults unless the direction above specifically calls for them: " + NEGATIVE_DEFAULTS.join("; ") + ".");
  out.push("Hold this direction across the WHOLE page; do not drift back to a generic marketing layout partway down.");
  return out.join("\n");
}

// Metadata for the P2 knob UI: the axis stops (to build the sliders) + each lens's display
// label and description (so the renderer can name the picked lens without importing the
// deck). Part of the seam, moves with the sampler.
function directionMeta() {
  return {
    axes: AXES, // { convention: [...stops], energy: [...], structure: [...], era: [...] }
    lenses: LENSES.map((l) => ({ id: l.id, label: l.label, description: l.description })),
  };
}

module.exports = { sampleDirection, renderDirectionPrompt, directionMeta };
