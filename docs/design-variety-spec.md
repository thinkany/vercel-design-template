# Spec: Design variety — breaking the centroid with a sampled, steerable Direction

**Status:** draft / plan of record
**Date:** 2026-08-17
**Where it lands:** the design generation pipeline. Sampling + library are a new zero-dep module
(`desktop/intake/direction.cjs`) plus prompt assembly in `main.cjs` (`buildDesignPrompt`); the knob
UI is client-rendered in the intake pane (`shell.js`); the `/design` and `/design-brief` skills
(scaffold side, CORE) learn to honor the Direction; persistence rides `variation.json`. The
anti-repetition memory is an app-level, per-designer store under the pinned `userData`.
**Origin:** Rob is seeing the model repeat compositional patterns across designs (numbered section
eyebrows like "05 Connect", the same Hero → Features → Testimonials → Pricing rhythm, centered
hero + two buttons). Web design is commoditizing; this tool's promise is producing web designs both
*fast* and *distinctively*. The goal is to make repeated, generic output the exception, not the default.

## 1. Why it repeats (the mechanism this spec attacks)

An LLM asked for "a clean, modern marketing site" does not sample across design space; it reproduces
the **mode** of that description's training distribution. The commoditized centroid IS numbered
eyebrows, the canonical section order, the centered hero. Three consequences shape the whole design:

1. **The repetition lives in the compositional layer, not the brand layer.** Color and type already
   vary per project (`--ta-*`, `brand.ts`). What never varies is *structure and motif*: section
   rhythm, eyebrow treatment, hero archetype, grid. Those are low-entropy choices the model makes
   early and greedily. This is exactly what a designer notices repeating.
2. **The model cannot self-randomize.** "Be unique / avoid clichés / vary it" does not work: the
   model's notion of "creative" is itself an attractor. Variety must be **injected from outside as a
   concrete constraint**, never requested of the model.
3. **Randomness must be curated, not raw.** Cranking temperature yields novel-but-broken. The target
   is *appropriate distinctiveness*: a different, deliberate, coherent direction each time, drawn
   from a pool of directions that are all good and all weighted for fit.

## 2. The core idea: a Design Direction, sampled and steerable

Every design is conditioned on a structured object, the **Direction** (a design's "DNA"). It is
sampled fresh per design, biased toward brand/tone fit and away from what the designer has recently
seen, and it is fully steerable by the designer through a small set of semantic knobs. It persists
with the variation so it can be shown, reproduced, rerolled, and nudged.

```
Direction {
  seed:    <int>                 // reproduces the whole sample
  axes:    { convention, energy, structure, era }   // the designer-facing knobs (labeled stops)
  lens:    <lensId>              // sampled compositional archetype (from the deck)
  motifs:  { eyebrow, hero, sectionRhythm, featureLayout, divider, ... }  // per-slot choices
  source:  "auto" | "knobs" | "references"          // what drove it (precedence, see §7)
}
```

Three inputs produce a Direction, in precedence order (§7): **references** (if supplied) > **explicit
knobs** (if the designer set them) > **auto-sample** (the default). Whatever the source, the output
is one Direction object, injected as prompt text and persisted.

## 3. The knobs (decision: labeled semantic sliders)

Five axes (four compositional + Motion), each a **discrete labeled scale** (not a raw float, which
the model reads as noise). The slider is just how the designer selects which **stop word + rubric
phrase** gets injected. The axes are chosen to be as orthogonal as possible, so the knobs feel
independent.

| Axis | Stops (left → right) | What it controls |
|---|---|---|
| **Convention** | Common · Familiar · Bold · Experimental | Departure from the marketing-site centroid. The master "how far out" dial. |
| **Energy** | Calm · Measured · Lively · Maximal | Visual intensity: density, contrast, scale jumps, ornament. |
| **Structure** | Ordered · Balanced · Loose · Organic | Composition geometry: strict grid ↔ freeform / asymmetric / hand-built. |
| **Era** | Timeless · Classic · Current · Avant-garde | Stylistic period reference the design leans on. |
| **Motion** | Static · Subtle · Dynamic · Kinetic | How animated the design is. **BUILT 2026-08-25 as an orthogonal 5th knob.** |

**Motion is deliberately orthogonal (rubric-only).** Any lens can be still or animated, so Motion
does NOT steer the lens/motif draw (see `SCORE_AXES` in `direction.cjs`, which scores lens fit over
the four compositional axes only). It auto-samples (leaning subtle/dynamic, kinetic rare), honors
its knob + motion mood-words ("animated", "kinetic", "static"), and renders its own directive line
into the prompt block. That is what keeps it an independent dimension rather than a proxy for Energy
or Era. A directly-picked lens (which has no motion affinity) gets a seed-deterministic motion default.

Each stop maps to a **rubric phrase** that is the actual load-bearing prompt text. Example
(Convention):

- Common → "Stay close to familiar, high-credibility marketing-site conventions."
- Bold → "Break from the obvious layout; favor an unexpected structure or a signature moment."
- Experimental → "Depart deliberately from typical marketing-site conventions; unconventional
  layouts, unexpected type, and distinctive motifs are encouraged, as long as it stays usable."

MVP may ship **3** axes (drop whichever two overlap most in practice, likely Convention/Era) and add
the fourth once the rubric phrases are tuned. The table above is the target.

## 4. The lens deck (the curated space, lever 1)

A JSON library of ~12–20 **compositional archetypes**, the heart of the system and, frankly, the
moat (a well-built, well-weighted direction library is content that is hard to replicate; ties to
the IP-protection plan). Each entry:

```
Lens {
  id, label, description
  axisAffinity: { convention, energy, structure, era }   // where it sits, for weighting
  fitTags:      ["editorial", "boutique", "tech", ...]    // vertical/tone affinities for auto-vary
  directives:   { grid, type, sectionRhythm, heroBias, motifVocabulary, density, dos, donts }
  motifEligibility: { eyebrow:[...], hero:[...], ... }    // which motif options cohere with this lens
}
```

Seed set (illustrative, curate for real): Swiss/International, Editorial/Magazine, Brutalist,
Neo-retro, Maximalist, Organic/Hand-built, Monospace/Terminal, Corporate-confident,
Boutique-minimal, Playful/Toybox, Architectural/Grid, Warm-humanist. `directives` become prompt text.

## 5. Motif slots (lever 2)

Below the whole-archetype level, specific decisions are sampled from small curated decks, constrained
to the lens's `motifEligibility` and weighted by the axes + anti-repetition memory. This is what
directly demotes "05 Connect": **eyebrow** becomes one slot with ~6 options, sampled, so the numbered
treatment appears ~1-in-6 instead of always.

| Slot | Options (curate) |
|---|---|
| **eyebrow** | none · numbered-index · hairline-rule · micro-caps · icon-led · oversized-index |
| **hero** | split · centered · full-bleed · type-only · asymmetric · editorial-cover |
| **sectionRhythm** | uniform · alternating · escalating-density · punctuated-by-fullbleed |
| **featureLayout** | cards · rows · stagger · editorial-list · grid-collage |
| **divider / transition** | none · rule · shape · color-block · overlap |

Coherence rule: motifs are only ever drawn from the lens's eligible set, so a sample is never a
Frankenstein of incompatible tropes.

**BUILT 2026-08-24 (server-side deck, license-gated).** The slots, per-lens `motifEligibility`,
and prompt rendering shipped with the deck; this pass added the two remaining pieces:
- **Axis-weighted sampling.** `pickMotifs` no longer draws uniformly. Each option carries a
  partial `MOTIF_AFFINITY` (only the axis stops it expresses); the sampler weights the lens's
  eligible options by closeness to the resolved axes (`TUNING.motifSharpness`/`motifFloor`), so
  within one lens an ordered/calm design and a loose/maximal design get different, coherent
  motifs. Still deterministic in `seed`; `seed + axes` reproduces (the reroll's picked branch now
  honors the stored axes). Verified: opposite axis extremes shift the motif distribution as
  intended, 200/200 seeds reproduce.
- **Expanded decks.** +2 curated options per slot (eyebrow: tab-chip, vertical-label; hero:
  boxed-frame, split-diagonal; sectionRhythm: ribbon-bands, sparse; featureLayout: table,
  carousel; divider: gradient-fade, angled-cut), each with gloss + affinity and wired into 3–4
  coherent lenses.

Anti-repetition memory weighting (lever 3, §9) multiplies into these same motif weights when built.

## 6. Negative constraints (lever 6, thin backstop)

A small always-on anti-cliché note in the prompt: the known-overused tropes (numbered eyebrows,
centered-hero-two-buttons, the canonical six-section order, "X reasons why") carry an "avoid unless
the chosen lens/motif specifically calls for it" flag. This is a guardrail on top of §4–5, not the
strategy: negative constraints alone are whack-a-mole (the model just relocates to the next-modal
pattern) and don't raise the ceiling.

## 7. Precedence and the references interaction (lever 5)

References are the strongest, most underused anti-sameness signal, because they inject the designer's
*own* taste. Precedence when building a Direction:

1. **References supplied** → the reference digest DOMINATES. The Direction's lens/motifs are derived
   to match the references (not auto-sampled), `source = "references"`. Knobs still *modulate* ("lean
   more experimental than the references").
2. **Knobs set (no refs)** → axes are explicit; lens + motifs are sampled *conditioned on the axes*,
   `source = "knobs"`.
3. **Neither (the default)** → auto-sample everything, `source = "auto"` (see §8).

The cold start (no references) is exactly where repetition bites hardest, which is what auto-vary is
for.

## 8. Default posture (decision: auto-vary, then steer)

Out of the box, before the designer touches anything, each design **silently samples a fresh,
brand-appropriate Direction**. Sampling is **weighted, not uniform**: brand + tone + any captured
project vertical bias the axes and lens (a bakery skews Energy up / Structure organic; a law firm
skews Convention common / Structure ordered), so auto-variety stays *appropriate*, never
novel-but-wrong. Then lens + motifs sample conditioned on those axes and down-weighted by the
anti-repetition memory (§9).

The designer can then open the knob panel to steer, and **reroll** to resample (keeping any axes they
have pinned, or fresh). This makes "turn the knobs to fine-tune in a direction" a real, controllable
tool while keeping variety on by default for anyone who never opens the panel.

## 9. Anti-repetition memory (lever 3, decision: global per-designer)

A store that makes variety **compound across the designer's whole workflow**, not reset each project.
It records, per generated design: `lensId`, the motif-slot choices, an axes fingerprint, and a
timestamp.

- **Scope: global per-designer.** Lives app-level under the **pinned `userData`** (per the
  userData-pinning gotcha, so it survives app renames/upgrades), NOT inside a project, since the
  whole point is cross-project.
- **Effect:** when sampling, recently-used lenses and motifs are **down-weighted, not banned** (a ban
  starves the space). Weight **decays** with age, so a lens used 20 designs ago is fair again.
- **Verification hook:** `extract-layout.mjs` already turns a page into a structural fingerprint. The
  same extraction can *measure* motif frequency and prove the system reduced repetition, and can feed
  the memory from real output rather than the intended sample.

**Future (not built): reset / manage history.** A designer control to clear their anti-repetition
memory (a clean slate, or for testing), and maybe to view/pardon a specific recently-used style.
Server side is a small `{op:"reset", designer}` (DEL the KV key) + a `{op:"list", designer}` read;
client side a button in the direction "?" panel or settings. Deferred: the auto-decay already makes
stale choices fair again, so a manual reset is a nicety, not a requirement.

## 10. Where it plugs into the pipeline

- **`desktop/intake/direction.cjs`** (new, zero-dep): owns the lens deck, motif slots, axis rubrics,
  and the **seeded, weighted, memory-aware sampler**. Sibling to `deliverables.cjs`. Pure and
  testable (`node --check` + unit-style sampling checks).
- **`brief.cjs`**: add a `direction` field to the Brief (the Direction object).
- **`main.cjs` `buildDesignPrompt`**: fold the Direction into the `/design-brief` string as a
  prominent **"Design direction"** block: the axis rubric phrases + the lens directives + the sampled
  motif choices + the negative-constraint note.
- **Get-Designing intake (`shell.js`)**: auto-sample at intake start; the **knob panel** is a new
  client-rendered step/affordance (skippable, since default is auto-vary), which fits the just-shipped
  client-rendered intake (`233a8b4`) cleanly. The panel shows the current Direction ("leans
  editorial-bold") with the sliders + reroll.
- **Persistence**: capture the chosen Direction into `variation.json` (alongside the brief/color/font
  capture already planned in the brief-modal work), so a design's DNA is reproducible and displayable
  on the dashboard card.
- **Post-build adjust**: reroll or nudge knobs → regenerate (as a new variation or in place). This is
  the "fine-tune a spec in a specified direction" surface.
- **Skills (`/design`, `/design-brief`, CORE scaffold)**: add a "honor the Design Direction" section
  to the authoring contract so the build actually consumes it. Flows to new projects via the template
  snapshot.

## 11. Phasing

- **Phase 1 — the engine (MVP, highest leverage, nearly free).** `direction.cjs` (deck + slots +
  rubrics + seeded weighted sampler), auto-vary default, `buildDesignPrompt` injection, negative
  constraints, persist Direction to `variation.json`. This alone breaks the repetition. Sliders can be
  auto-set + shown before the panel exists.
- **Phase 2 — the knobs.** The client-rendered semantic-slider panel + reroll, in intake and
  post-build. Delivers Rob's "turn the knobs" ask.
- **Phase 3 — the memory. BUILT 2026-08-25 (server-side, per the cloud move).** Global per-designer
  store, but on the cloud endpoint (`direction/memory.cjs`, Vercel KV / Upstash + per-instance
  fallback), not under `userData` — the deck already lives server-side, so its natural home is there.
  Each committed design's lens+motifs are `record`ed per `designer` id (a per-install id under the
  app's pinned userData, sent by the client); `memoryPenalties` in `direction.cjs` decays them
  (21-day half-life) and down-weights the lens/motif draw, never banning. Degrades to no-memory on
  any KV outage. See design-variety-cloud-spec.md + derive/DEPLOY.md §2b.
- **Phase 4 — divergence (gated future, lever 4).** Generate N Directions, designer picks (or a
  distinctiveness judge picks the least generic). Real variety, but N× tokens, so opt-in/premium only.
- **Cross-cutting.** References precedence (§7) folds into Phase 1/2; the measurement harness
  (`extract-layout` fingerprints) is built alongside Phase 1 to prove it works.

## 12. Tensions and risks

- **Model compliance.** The build must actually honor the Direction, not water it down. Mitigate with
  *specific* directives (not vague "be experimental") and by restating the Direction prominently in
  the design turn. Watch for the model reverting to the centroid mid-build.
- **Coherence.** Curate the deck; enforce motif eligibility per lens; test that samples read as one
  intentional design, not a mashup.
- **Appropriateness.** Auto-vary must be brand/tone-weighted or it produces confident-wrong output.
  The weighting is the part most worth getting right.
- **Cost.** Sampling + prompt injection is essentially free and complements the intake token cut.
  Only Phase 4 trades cost for variety, hence gated.
- **Distinctiveness vs credibility.** A client wants a site that reads as legitimate in its category.
  The **Convention** axis is the release valve: pull toward Common for conservative clients, without
  losing the varied motif texture underneath.
- **Deck maintenance.** The library is content, not code, and needs ongoing curation. That burden is
  also the moat.

## 13. Open questions (for build kickoff)

- Final axis set: 3 or 4 for MVP, and the exact stop words + rubric phrases (needs a tuning pass with
  real generations).
- Lens deck v1 contents and each lens's directive text (the biggest content task).
- Auto-vary weighting inputs: what signals are actually available at sample time (brand, tone, project
  vertical) and how strong each bias is.
- Memory decay curve and how many recent designs meaningfully steer the sampler.
- Whether Phase 1 ships the knobs read-only (auto-set, shown) or waits for Phase 2 for any manual control.
