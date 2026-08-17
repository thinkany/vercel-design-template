# Design variety — Phase 1 tickets (the engine)

Implements Phase 1 of [design-variety-spec.md](./design-variety-spec.md): the sampling engine that
conditions every design on a fresh, brand-appropriate, steerable **Direction**, so repeated generic
output becomes the exception. No designer-facing knob UI here (that is P2); no cross-project memory
(P3); no multi-candidate divergence (P4). P1 proves the spine: every design silently carries a
sampled Direction that visibly shapes the build.

**Dependency order:** T1 → (T2 ∥ T3) → (T4 ∥ T5) → T6, with T7 alongside. **T1 + T3 + T5 + T6 is the
minimum that ships variety**; T2 is the primary tuning surface; T4 + T7 make it durable and measurable.

## The seam (the principle that shapes every ticket)

`direction.cjs` exposes exactly two functions the rest of the app may call:

- `sampleDirection(inputs) → Direction`
- `renderDirectionPrompt(direction) → string`

`lenses.cjs` (the curated deck, the moat) is imported by **nothing except `direction.cjs`**. Inputs
and outputs are plain serializable objects, and the signatures are **async-ready** (callers `await`).
This is deliberate: Rob may later move the deck + sampler to server-retrieved protected logic (a
differentiator, harder to reverse-engineer). When that happens, `sampleDirection` becomes a `fetch`
to an authed endpoint (reusing the `derive.thinkany.design` + license infra) and **no caller
changes**. The deck is also `TEMPLATE_EXCLUDE`d so it never ships plaintext in a distributed scaffold.

**Tuning:** deck content (lens roster, rubric phrases, `fitTags`, motif eligibility) is tuned by
watching the sampler produce real Directions against real briefs (T2), NOT in a separate upfront pass.

---

## T1 — `direction.cjs`: the sampler behind the seam (core)

The foundational engine. Pure, zero-dep CommonJS (`.cjs` — `desktop/` is ESM by default), consumes
`lenses.cjs`.

**Build**
- Seeded RNG (a small deterministic PRNG; no `Math.random()` in the core path so a seed reproduces
  the whole sample).
- `sampleDirection(inputs)` where `inputs = { seed?, axes?, brand?, tone?, projectType?, vertical?,
  references?, history? }` (P1 uses `seed`, `axes`, and the brand/tone signals; `references` and
  `history` are accepted but pass-through until P3/references work).
  - **Axis resolution:** if `axes` given (P2 knobs), use them; else auto-sample per axis (T2 supplies
    the weighting).
  - **Lens pick:** weight each lens by (a) distance between the resolved axes and the lens
    `axisAffinity`, and (b) `fitTags` match to brand/tone/vertical. Weighted random pick.
  - **Motif pick:** for each slot, draw from the chosen lens's `motifEligibility[slot]`, weighted by
    the axes.
  - Return `Direction { seed, axes, lens, motifs, source }` (`source: "auto" | "knobs"`; `"references"`
    reserved).
- Keep all deck access inside this module; export only `sampleDirection` + `renderDirectionPrompt`
  (T3).

**Acceptance**
- `node -e`: same `seed` → byte-identical Direction; different seeds vary.
- A 200-sample batch spreads across the deck (no lens starves, none dominates absent a bias).
- Nothing outside `direction.cjs` imports `lenses.cjs` (grep clean).

**Files:** `desktop/intake/direction.cjs` (new). **Deps:** `lenses.cjs` (drafted).

---

## T2 — Auto-vary weighting from brand / tone (the tuning surface)

Make auto-variety *appropriate*, not uniform, using the signals available at sample time.

**Build**
- Map the real inputs into the T1 weighting: brand vertical/palette, `tone` (from the voice step),
  `projectType` (website vs app). Bias both axis auto-sampling and the lens `fitTags` match.
- Expose the weighting as tunable constants/tables in `direction.cjs` so tuning is a data edit.

**Acceptance**
- "law firm / calm / website" skews toward Corporate-Confident, Swiss, Boutique.
- "kids food brand / playful" skews toward Playful, Organic, Neo-retro.
- Still stochastic: repeated samples of the same brief differ, but stay within the appropriate band.

**Files:** `desktop/intake/direction.cjs`. **Deps:** T1.

---

## T3 — `renderDirectionPrompt` + fold into `buildDesignPrompt`

The prompt-text half of the seam.

**Build**
- `renderDirectionPrompt(direction)` (in `direction.cjs`, so deck text stays behind the seam) emits a
  prominent **"Design direction"** block: the axis rubric phrases (`AXIS_RUBRIC`), the chosen lens's
  `directives`, the concrete sampled motif choices, and the negative-constraint backstop (avoid the
  known-overused tropes unless the lens/motif calls for them).
- `main.cjs buildDesignPrompt` folds the block into the `/design-brief` string.

**Acceptance**
- A sampled Direction yields a coherent block that names specific motif choices (e.g. "eyebrow:
  hairline-rule, hero: asymmetric").
- `node --check` clean; the block reads as prompt-ready English (house style: no em-dashes).

**Files:** `desktop/intake/direction.cjs`, `desktop/main.cjs`. **Deps:** T1.

---

## T4 — Brief field + persistence to `variation.json`

Make the Direction durable and reproducible.

**Build**
- Add `direction` to the Brief (`brief.cjs` `BRIEF_FIELDS`).
- At build handoff (`main.cjs` design-prompt path), capture the chosen Direction into
  `variation.json` alongside the existing brief/color/font capture.

**Acceptance**
- `variation.json` carries `{ seed, axes, lens, motifs, source }`.
- Re-running `sampleDirection` with the stored seed + axes reproduces the same Direction.

**Files:** `desktop/intake/brief.cjs`, `desktop/main.cjs`. **Deps:** T1, T3.

---

## T5 — Auto-sample wiring in the intake

Every design carries a Direction, no UI yet.

**Build**
- At Get-Designing build handoff, call `sampleDirection` (`source:"auto"`) with the accumulated
  brief/brand/tone, store it on the Brief, and let T3 inject it. (Fits the client-rendered intake
  from `233a8b4`; the knob panel is P2.)

**Acceptance**
- A Get-Designing run with no knob UI produces a design conditioned on a sampled Direction.
- Two runs of the **same** brief produce visibly different directions.

**Files:** `desktop/shell.js`, `desktop/main.cjs`. **Deps:** T1, T3.

---

## T6 — Skills honor the Direction (`/design`, `/design-brief`, CORE scaffold)

Make the build actually apply the block, and keep applying it.

**Build**
- Add a "Design direction" section to the `/design` authoring contract: read the block, apply the
  lens directives + motif choices, and **restate the direction near the end of the build** so the
  model does not drift back to the centroid halfway down the page.
- `/design-brief` passes the block through to the build.
- Scaffold CORE → refresh the template snapshot (`make-template.cjs`) after committing.

**Acceptance**
- A build conditioned on "experimental / brutalist" is visibly, structurally different from one on
  "common / corporate" for the same brief.
- Spot-check: the numbered-index eyebrow appears only under lenses that make it eligible.

**Files:** `.claude/commands/design.md`, `.claude/commands/design-brief.md` (scaffold side). **Deps:** T3.

---

## T7 — Measurement harness (parallel)

Prove it works; seed P3's memory.

**Build**
- A script that runs N generations and, via `extract-layout.mjs` fingerprints, tallies lens + motif
  frequency and flags over-repetition. (This is also the data source the P3 global memory will
  consume.)

**Acceptance**
- A distribution report across a batch shows spread, not a single dominant pattern.
- Numbered-eyebrow frequency is demonstrably down versus the pre-variety baseline.

**Files:** `desktop/scripts/` (or `scripts/`) new report script. **Deps:** T1 (can stub output for the
harness before the full pipeline lands).

---

## Out of scope for P1 (later phases)

- **P2:** the client-rendered semantic-slider knob panel + reroll (intake and post-build).
- **P3:** the global per-designer anti-repetition memory (under pinned `userData`) + decay weighting.
- **P4:** multi-candidate divergence (generate N, designer picks) — gated/premium, N× tokens.
- **References precedence** (references dominate the Direction) folds in with the references work / P2.
- **Cloud relocation** of the deck + sampler — enabled by the seam, decided separately.
