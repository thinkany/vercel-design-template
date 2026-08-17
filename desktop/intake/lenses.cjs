// Design-variety LENS DECK v1 — DRAFT for tuning. See docs/design-variety-spec.md §3–5.
//
// NOT WIRED IN YET. The P1 sampler (`direction.cjs`) will consume this: pick a lens
// weighted by the axes + brand/tone fit + anti-repetition memory, then draw each motif
// slot from that lens's eligible set. Everything here is prompt-facing content — the
// `directives` strings become the "Design direction" block in buildDesignPrompt, so
// they are written to be dropped into a prompt verbatim.
//
// House style applies (this is copy a person tunes and the model reads): typographic
// apostrophes, no em-dashes.

// ── Axis model: the designer-facing knobs. Discrete labeled stops (index 0..3), left
//    to right. A lens's `axisAffinity` names its natural stop on each; the sampler uses
//    the distance between the designer's knob and the lens affinity as a weight. ──
const AXES = {
  convention: ["common", "familiar", "bold", "experimental"], // how far off the centroid
  energy:     ["calm", "measured", "lively", "maximal"],       // intensity / density / contrast
  structure:  ["ordered", "balanced", "loose", "organic"],     // grid-strict → freeform
  era:        ["timeless", "classic", "current", "avant-garde"], // stylistic period reference
};

// Per-stop rubric phrases — the actual prompt text a knob position injects. These are
// lens-independent; the lens `directives` layer on top. (Draft; tune against real gens.)
const AXIS_RUBRIC = {
  convention: {
    common:       "Stay close to familiar, high-credibility marketing conventions.",
    familiar:     "Use a recognizable structure, but give it one considered, non-generic move.",
    bold:         "Break from the obvious layout; favor an unexpected structure or a signature moment.",
    experimental: "Depart deliberately from typical conventions: unconventional layout, unexpected type, distinctive motifs. Stay usable.",
  },
  energy: {
    calm:     "Quiet and spacious; few elements, soft contrast, lots of breathing room.",
    measured: "Composed and even; clear contrast without noise.",
    lively:   "Energetic; stronger contrast, scale jumps, and accent color.",
    maximal:  "Dense and loud; layered elements, big scale jumps, ornament, high contrast.",
  },
  structure: {
    ordered:  "Strict, visible grid; everything aligns; symmetry where it helps.",
    balanced: "A clear grid with deliberate breaks from it.",
    loose:    "Asymmetric and offset; the grid is a suggestion, not a cage.",
    organic:  "Freeform and hand-built; overlaps, irregular placement, no rigid columns.",
  },
  era: {
    timeless:      "Classic and durable; nothing that will date quickly.",
    classic:       "Lean on a specific past era's design language, done with intent.",
    current:       "Of-the-moment contemporary web craft.",
    "avant-garde": "Forward-looking and experimental; ahead of current trends.",
  },
};

// ── Motif slots (lever 2): the full option vocabulary per slot. Each lens declares a
//    coherent SUBSET in `motifEligibility`; the sampler only ever draws from that subset,
//    so a sample is never a mashup of incompatible tropes. Demoting an overused motif
//    (e.g. "numbered-index" eyebrows) to 1 option among several is how the "05 Connect"
//    repetition breaks — it stays authentic where a lens genuinely calls for it. ──
const MOTIFS = {
  // The little label above a section heading.
  eyebrow:       ["none", "numbered-index", "hairline-rule", "micro-caps", "icon-led", "oversized-index", "kicker-line"],
  // The hero / first-viewport archetype.
  hero:          ["split", "centered", "full-bleed", "type-only", "asymmetric", "editorial-cover", "collage"],
  // How sections pace down the page.
  sectionRhythm: ["uniform", "alternating", "escalating-density", "punctuated-by-fullbleed", "editorial-flow"],
  // How a set of features / items is laid out.
  featureLayout: ["cards", "rows", "stagger", "editorial-list", "grid-collage", "bento"],
  // What separates sections.
  divider:       ["none", "rule", "shape", "color-block", "overlap", "whitespace"],
};

// Human phrasing for each motif slug, so the sampled choice reads as an instruction in
// the "Design direction" prompt block (renderDirectionPrompt). Prompt-facing content,
// kept with the deck so all the moat text moves together if this goes to the cloud.
const MOTIF_GLOSS = {
  eyebrow: {
    "none": "no small label above section headings",
    "numbered-index": "a numbered index above section headings (01, 02, 03)",
    "hairline-rule": "a thin hairline rule above section headings",
    "micro-caps": "a small all-caps label above section headings",
    "icon-led": "a small icon leading each section heading",
    "oversized-index": "an oversized number or index used as a graphic element by the heading",
    "kicker-line": "a short kicker phrase above the section heading",
  },
  hero: {
    "split": "a split hero (headline on one side, visual on the other)",
    "centered": "a centered hero statement",
    "full-bleed": "a full-bleed hero (edge-to-edge image or color)",
    "type-only": "a type-only hero (the headline fills the first screen, no hero image)",
    "asymmetric": "an asymmetric, off-center hero composition",
    "editorial-cover": "an editorial-cover hero (magazine-style lead: strong headline plus a lead image)",
    "collage": "a collage hero (layered, overlapping elements)",
  },
  sectionRhythm: {
    "uniform": "uniform, evenly paced sections",
    "alternating": "alternating section layouts (left/right or light/dark)",
    "escalating-density": "sections that escalate in density and intensity down the page",
    "punctuated-by-fullbleed": "regular sections punctuated by full-bleed moments",
    "editorial-flow": "an editorial flow where section width and density vary like magazine pages",
  },
  featureLayout: {
    "cards": "feature cards",
    "rows": "full-width feature rows",
    "stagger": "staggered, offset feature blocks",
    "editorial-list": "an editorial list (typographic, numbered or ruled)",
    "grid-collage": "a grid collage of items",
    "bento": "a bento grid of mixed-size tiles",
  },
  divider: {
    "none": "no explicit dividers between sections",
    "rule": "thin rules between sections",
    "shape": "shaped dividers between sections",
    "color-block": "color-block transitions between sections",
    "overlap": "overlapping sections that bleed into each other",
    "whitespace": "generous whitespace as the only divider",
  },
};

// ── The deck. 14 lenses chosen to SPAN the axes (a Common anchor for conservative
//    clients through to Experimental) and to be individually distinct + usable. Curate
//    and grow over time; this is the moat. ──
const LENSES = [
  {
    id: "corporate-confident",
    label: "Corporate Confident",
    description: "The credible centroid done well. Polished, trustworthy, unfussy. The safe end of the Convention axis, the release valve for conservative clients.",
    axisAffinity: { convention: "common", energy: "calm", structure: "ordered", era: "timeless" },
    fitTags: ["finance", "legal", "b2b", "enterprise", "healthcare", "insurance", "consulting"],
    directives: {
      grid: "Clean 12-column grid, comfortable margins, predictable alignment.",
      type: "One professional sans plus an optional restrained serif for headings. Clear size hierarchy.",
      sectionRhythm: "Even, well-spaced sections; one confident accent moment, not many.",
      heroBias: "Split hero (headline + supporting visual) or a calm centered statement.",
      motifVocabulary: "Subtle cards, soft shadows used sparingly, a single brand accent, real photography.",
      density: "medium",
      dos: ["Look established and legible", "Earn trust through polish and restraint"],
      donts: ["No trend-chasing", "Avoid the exact six-section clone; vary at least the rhythm and eyebrow"],
    },
    motifEligibility: {
      eyebrow: ["micro-caps", "hairline-rule", "none", "kicker-line"],
      hero: ["split", "centered", "full-bleed"],
      sectionRhythm: ["uniform", "alternating"],
      featureLayout: ["cards", "rows", "bento"],
      divider: ["whitespace", "rule", "color-block"],
    },
  },
  {
    id: "swiss",
    label: "Swiss / International",
    description: "Objective, grid-driven, typographic. Confidence through precision and restraint.",
    axisAffinity: { convention: "familiar", energy: "measured", structure: "ordered", era: "timeless" },
    fitTags: ["tech", "editorial", "b2b", "architecture", "finance", "design-studio"],
    directives: {
      grid: "Strict, almost visible column grid; consistent gutters; everything snaps to it.",
      type: "A single clean grotesque. Hierarchy by size and weight only. Flush-left, ragged-right.",
      sectionRhythm: "Uniform sections; the grid, not ornament, makes the rhythm.",
      heroBias: "Type-led or asymmetric; headline placed with mathematical care and generous margin.",
      motifVocabulary: "Hairline rules, index numbers, precise captions, vast white space. No shadows, gradients, or rounded corners.",
      density: "low-to-medium",
      dos: ["Let alignment and whitespace carry it", "Use scale and weight for hierarchy"],
      donts: ["No decorative flourishes", "No drop shadows or gradients", "Don't center everything"],
    },
    motifEligibility: {
      eyebrow: ["numbered-index", "hairline-rule", "micro-caps", "none"],
      hero: ["type-only", "asymmetric", "split"],
      sectionRhythm: ["uniform", "alternating"],
      featureLayout: ["rows", "editorial-list", "grid-collage"],
      divider: ["rule", "whitespace", "none"],
    },
  },
  {
    id: "editorial",
    label: "Editorial / Magazine",
    description: "A magazine spread on the web: strong type, mixed columns, deliberate asymmetry, imagery treated as content.",
    axisAffinity: { convention: "familiar", energy: "measured", structure: "balanced", era: "classic" },
    fitTags: ["media", "fashion", "lifestyle", "agency", "publishing", "culture", "food"],
    directives: {
      grid: "Editorial grid with varied column spans; pull-quotes and images break the measure.",
      type: "A characterful serif or high-contrast display for headings, clean sans for body. Big headline scale.",
      sectionRhythm: "Editorial flow: sections vary in width and density like magazine pages.",
      heroBias: "Editorial-cover or asymmetric; a commanding headline, a strong lead image, a dateline feel.",
      motifVocabulary: "Drop caps, pull-quotes, captions, column rules, oversized folios.",
      density: "medium",
      dos: ["Treat type as the lead voice", "Vary column width for rhythm"],
      donts: ["No uniform card grids", "Don't center every heading"],
    },
    motifEligibility: {
      eyebrow: ["kicker-line", "oversized-index", "micro-caps", "hairline-rule"],
      hero: ["editorial-cover", "asymmetric", "split"],
      sectionRhythm: ["editorial-flow", "alternating", "punctuated-by-fullbleed"],
      featureLayout: ["editorial-list", "stagger", "grid-collage"],
      divider: ["rule", "whitespace", "overlap"],
    },
  },
  {
    id: "boutique-minimal",
    label: "Boutique Minimal",
    description: "Luxury restraint. Vast whitespace, small refined type, very few elements, everything intentional.",
    axisAffinity: { convention: "familiar", energy: "calm", structure: "balanced", era: "timeless" },
    fitTags: ["luxury", "fashion", "beauty", "architecture", "hospitality", "jewelry", "wellness"],
    directives: {
      grid: "Spare, balanced composition; enormous margins; few elements per view.",
      type: "Delicate, refined type at modest sizes; wide letter-spacing on labels.",
      sectionRhythm: "Calm and slow; generous emptiness between a small number of sections.",
      heroBias: "Full-bleed image with a whisper of type, or type-only with immense space.",
      motifVocabulary: "Thin rules, letter-spaced micro-labels, monochrome or near-monochrome, one hero image.",
      density: "low",
      dos: ["Make emptiness the feature", "Restrain the palette and the element count"],
      donts: ["No clutter", "No loud color", "Nothing that looks mass-market"],
    },
    motifEligibility: {
      eyebrow: ["micro-caps", "none", "hairline-rule"],
      hero: ["full-bleed", "type-only", "asymmetric"],
      sectionRhythm: ["uniform", "punctuated-by-fullbleed"],
      featureLayout: ["rows", "editorial-list", "stagger"],
      divider: ["whitespace", "none", "rule"],
    },
  },
  {
    id: "warm-humanist",
    label: "Warm Humanist",
    description: "Friendly and approachable. Humanist type, soft palettes, real people, rounded edges without being childish.",
    axisAffinity: { convention: "common", energy: "measured", structure: "balanced", era: "current" },
    fitTags: ["healthcare", "education", "nonprofit", "community", "hospitality", "wellness", "consumer"],
    directives: {
      grid: "Comfortable, forgiving grid; soft corners; nothing sharp or cold.",
      type: "A humanist sans or a warm serif; generous line height; conversational scale.",
      sectionRhythm: "Even and welcoming; photography of people recurs.",
      heroBias: "Split with a warm human image, or centered with an inviting line.",
      motifVocabulary: "Rounded cards, soft shadows, warm accent color, candid photography, gentle illustration.",
      density: "medium",
      dos: ["Feel human and reassuring", "Use real, warm imagery"],
      donts: ["Nothing austere or corporate-cold", "Avoid harsh contrast"],
    },
    motifEligibility: {
      eyebrow: ["icon-led", "micro-caps", "kicker-line", "none"],
      hero: ["split", "centered", "collage"],
      sectionRhythm: ["uniform", "alternating"],
      featureLayout: ["cards", "rows", "stagger"],
      divider: ["shape", "whitespace", "color-block"],
    },
  },
  {
    id: "gallery-curatorial",
    label: "Gallery / Curatorial",
    description: "Museum-like. Image-led, generous, restrained chrome, the content presented as art.",
    axisAffinity: { convention: "familiar", energy: "calm", structure: "balanced", era: "timeless" },
    fitTags: ["art", "photography", "portfolio", "luxury", "culture", "architecture", "design-studio"],
    directives: {
      grid: "Image-first composition; work sits in generous frames; chrome recedes.",
      type: "Quiet, small type that never competes with the imagery; captions in fine print.",
      sectionRhythm: "Slow, punctuated by full-bleed imagery; space to breathe between works.",
      heroBias: "Full-bleed or collage of the work itself, minimal overlaid type.",
      motifVocabulary: "Fine captions, index numbers, thin frames, monochrome chrome around rich images.",
      density: "low",
      dos: ["Let the imagery lead", "Keep the interface nearly invisible"],
      donts: ["No heavy UI chrome", "Don't crowd the work"],
    },
    motifEligibility: {
      eyebrow: ["numbered-index", "micro-caps", "none", "hairline-rule"],
      hero: ["full-bleed", "collage", "asymmetric"],
      sectionRhythm: ["punctuated-by-fullbleed", "editorial-flow", "uniform"],
      featureLayout: ["grid-collage", "stagger", "editorial-list"],
      divider: ["whitespace", "none", "overlap"],
    },
  },
  {
    id: "type-forward",
    label: "Type-forward",
    description: "The type is the design. Oversized display, minimal imagery, layout driven by words.",
    axisAffinity: { convention: "bold", energy: "lively", structure: "loose", era: "current" },
    fitTags: ["agency", "media", "fashion", "portfolio", "music", "events", "design-studio"],
    directives: {
      grid: "Composition built around huge type; images are secondary or absent.",
      type: "A distinctive display face at commanding scale; dramatic size contrast with body.",
      sectionRhythm: "Loose and typographic; headlines set the pace, not cards.",
      heroBias: "Type-only, filling the viewport with a single powerful statement.",
      motifVocabulary: "Oversized headings, kinetic-feeling type, minimal color, letterforms as graphic elements.",
      density: "medium",
      dos: ["Make the words the hero", "Push type scale further than feels safe"],
      donts: ["Don't fall back on a stock image hero", "No timid type sizes"],
    },
    motifEligibility: {
      eyebrow: ["oversized-index", "kicker-line", "none", "micro-caps"],
      hero: ["type-only", "asymmetric", "split"],
      sectionRhythm: ["editorial-flow", "alternating", "escalating-density"],
      featureLayout: ["editorial-list", "rows", "stagger"],
      divider: ["whitespace", "rule", "overlap"],
    },
  },
  {
    id: "neo-retro",
    label: "Neo-retro",
    description: "A past era revived with intent: chunky forms, warm nostalgic palettes, period motifs, done knowingly.",
    axisAffinity: { convention: "bold", energy: "lively", structure: "balanced", era: "classic" },
    fitTags: ["consumer", "food", "gaming", "music", "dtc", "events", "hospitality"],
    directives: {
      grid: "Period-appropriate composition (70s poster, 90s web, mid-century print) applied deliberately.",
      type: "A characterful retro or revival typeface; period-true color and texture.",
      sectionRhythm: "Lively and varied; period motifs recur as punctuation.",
      heroBias: "Full-bleed poster-like hero or collage with period styling.",
      motifVocabulary: "Grain, halftones, chunky borders, retro badges, warm saturated palette.",
      density: "medium-to-high",
      dos: ["Commit to one era, not a mash of several", "Use period color and texture honestly"],
      donts: ["Don't do generic 'modern' underneath a retro font", "Avoid ironic half-measures"],
    },
    motifEligibility: {
      eyebrow: ["oversized-index", "icon-led", "kicker-line", "numbered-index"],
      hero: ["full-bleed", "collage", "centered"],
      sectionRhythm: ["alternating", "punctuated-by-fullbleed", "escalating-density"],
      featureLayout: ["grid-collage", "cards", "stagger"],
      divider: ["shape", "color-block", "overlap"],
    },
  },
  {
    id: "monospace-terminal",
    label: "Monospace / Terminal",
    description: "The developer aesthetic. Mono type, code motifs, spare color, grid discipline, quiet confidence.",
    axisAffinity: { convention: "bold", energy: "measured", structure: "ordered", era: "current" },
    fitTags: ["dev-tools", "infra", "security", "crypto", "ai", "api", "technical"],
    directives: {
      grid: "Tight, exact grid; ASCII-like precision; alignment to a monospace measure.",
      type: "Monospace for accents and labels (sometimes throughout); minimal, high-legibility.",
      sectionRhythm: "Uniform and systematic; content reads like well-formatted output.",
      heroBias: "Type-led or split; a precise statement, maybe a code or terminal motif.",
      motifVocabulary: "Mono labels, hairline borders, terminal/code blocks, restrained accent (often single-hue), dark mode friendly.",
      density: "low-to-medium",
      dos: ["Feel precise and technical", "Use mono type as a signature"],
      donts: ["No soft rounded friendliness", "No stock marketing photography"],
    },
    motifEligibility: {
      eyebrow: ["numbered-index", "hairline-rule", "micro-caps", "none"],
      hero: ["type-only", "split", "asymmetric"],
      sectionRhythm: ["uniform", "escalating-density"],
      featureLayout: ["rows", "bento", "grid-collage"],
      divider: ["rule", "none", "whitespace"],
    },
  },
  {
    id: "brutalist",
    label: "Brutalist",
    description: "Raw and honest. Exposed structure, harsh contrast, system fonts, deliberate anti-polish.",
    axisAffinity: { convention: "experimental", energy: "lively", structure: "loose", era: "current" },
    fitTags: ["agency", "art", "music", "crypto", "dev-tools", "fashion", "events"],
    directives: {
      grid: "Visible, sometimes broken grid; raw borders; elements butt against each other.",
      type: "System or utilitarian type, big and blunt; unapologetic size contrast.",
      sectionRhythm: "Jarring on purpose; density and scale shift hard between sections.",
      heroBias: "Full-bleed type or asymmetric block; stark, high-contrast, no gloss.",
      motifVocabulary: "Hard borders, raw links, undesigned-looking forms, high contrast, minimal or clashing color.",
      density: "medium-to-high",
      dos: ["Embrace the raw and unpolished", "Let structure show"],
      donts: ["No soft shadows or gradients", "Nothing that reads as 'safe corporate'"],
    },
    motifEligibility: {
      eyebrow: ["oversized-index", "numbered-index", "none", "hairline-rule"],
      hero: ["type-only", "asymmetric", "full-bleed"],
      sectionRhythm: ["escalating-density", "punctuated-by-fullbleed", "alternating"],
      featureLayout: ["rows", "grid-collage", "editorial-list"],
      divider: ["rule", "color-block", "overlap"],
    },
  },
  {
    id: "organic-handbuilt",
    label: "Organic / Hand-built",
    description: "Warm and imperfect. Asymmetry, hand-drawn accents, natural shapes, nothing rigid.",
    axisAffinity: { convention: "bold", energy: "lively", structure: "organic", era: "current" },
    fitTags: ["wellness", "craft", "food", "kids", "nonprofit", "beauty", "community"],
    directives: {
      grid: "Freeform; elements overlap and sit off-axis; no rigid columns.",
      type: "Warm, slightly characterful type; hand-lettered or humanist accents.",
      sectionRhythm: "Flowing and irregular; organic shapes carry the eye down.",
      heroBias: "Collage or asymmetric with hand-drawn or natural elements.",
      motifVocabulary: "Blobs, hand-drawn strokes, textured fills, natural palette, playful overlaps.",
      density: "medium",
      dos: ["Let it feel handmade and warm", "Use asymmetry and overlap freely"],
      donts: ["Nothing rigid or gridlocked", "Avoid cold geometric perfection"],
    },
    motifEligibility: {
      eyebrow: ["icon-led", "kicker-line", "none", "oversized-index"],
      hero: ["collage", "asymmetric", "split"],
      sectionRhythm: ["editorial-flow", "alternating", "escalating-density"],
      featureLayout: ["stagger", "grid-collage", "cards"],
      divider: ["shape", "overlap", "color-block"],
    },
  },
  {
    id: "playful-toybox",
    label: "Playful / Toybox",
    description: "Bright and bouncy. Rounded forms, big friendly shapes, strong color, motion-forward.",
    axisAffinity: { convention: "bold", energy: "maximal", structure: "loose", era: "current" },
    fitTags: ["consumer", "kids", "food", "gaming", "dtc", "edtech", "fintech-consumer"],
    directives: {
      grid: "Loose, bouncy composition; playful offsets; big rounded shapes anchor sections.",
      type: "Rounded or bold friendly type; big, cheerful scale.",
      sectionRhythm: "High-energy; color blocks and shapes punctuate each section.",
      heroBias: "Centered or collage with big shapes, strong color, an animated feel.",
      motifVocabulary: "Rounded corners, bold shapes, bright multi-color, stickers/badges, gentle motion cues.",
      density: "medium-to-high",
      dos: ["Be bright, friendly, energetic", "Use bold color confidently"],
      donts: ["Nothing austere", "Don't mute the palette into corporate safety"],
    },
    motifEligibility: {
      eyebrow: ["icon-led", "kicker-line", "oversized-index", "none"],
      hero: ["centered", "collage", "split"],
      sectionRhythm: ["alternating", "escalating-density", "punctuated-by-fullbleed"],
      featureLayout: ["cards", "bento", "stagger"],
      divider: ["shape", "color-block", "overlap"],
    },
  },
  {
    id: "maximalist",
    label: "Maximalist",
    description: "More is more. Dense layering, many type sizes, ornament, collage, controlled chaos.",
    axisAffinity: { convention: "experimental", energy: "maximal", structure: "organic", era: "current" },
    fitTags: ["fashion", "events", "entertainment", "art", "music", "agency", "culture"],
    directives: {
      grid: "Layered and overlapping; multiple focal points; intentional density.",
      type: "Many sizes and weights, mixed families, type as texture.",
      sectionRhythm: "Relentless energy; each section stacks new layers and focal points.",
      heroBias: "Collage or full-bleed packed with layered elements.",
      motifVocabulary: "Overlaps, stickers, mixed media, saturated multi-color, ornament everywhere.",
      density: "high",
      dos: ["Layer boldly", "Fill space with intent, not emptiness"],
      donts: ["Don't retreat to minimal safety", "Avoid a single tidy grid"],
    },
    motifEligibility: {
      eyebrow: ["oversized-index", "icon-led", "kicker-line", "numbered-index"],
      hero: ["collage", "full-bleed", "asymmetric"],
      sectionRhythm: ["escalating-density", "punctuated-by-fullbleed", "editorial-flow"],
      featureLayout: ["grid-collage", "stagger", "bento"],
      divider: ["overlap", "color-block", "shape"],
    },
  },
  {
    id: "techno-futurist",
    label: "Techno-futurist",
    description: "Forward-looking and digital. Dark surfaces, glow and gradient, sharp geometry, a sci-fi edge.",
    axisAffinity: { convention: "experimental", energy: "maximal", structure: "ordered", era: "avant-garde" },
    fitTags: ["ai", "crypto", "gaming", "infra", "deep-tech", "hardware", "space"],
    directives: {
      grid: "Precise geometric grid; sharp edges; a dark canvas with luminous accents.",
      type: "Sharp, technical sans, sometimes wide or condensed; crisp hierarchy.",
      sectionRhythm: "Escalating; glow, gradient, and motion intensify down the page.",
      heroBias: "Full-bleed dark hero with luminous type, 3D or gradient focal element.",
      motifVocabulary: "Dark mode, neon or gradient accents, glow, grid lines, 3D/graphic renders, sharp geometry.",
      density: "medium-to-high",
      dos: ["Feel advanced and premium-technical", "Use dark surfaces and luminous accents"],
      donts: ["No warm hand-made softness", "Avoid stock daylight photography"],
    },
    motifEligibility: {
      eyebrow: ["hairline-rule", "numbered-index", "micro-caps", "kicker-line"],
      hero: ["full-bleed", "split", "asymmetric"],
      sectionRhythm: ["escalating-density", "punctuated-by-fullbleed", "uniform"],
      featureLayout: ["bento", "grid-collage", "cards"],
      divider: ["color-block", "rule", "overlap"],
    },
  },
];

module.exports = { AXES, AXIS_RUBRIC, MOTIFS, MOTIF_GLOSS, LENSES };
