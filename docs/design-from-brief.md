# Feature spec: **Design from a Brief**

> Status: **spec, not built.** Internal planning doc (export-ignored — never ships
> to a scaffolded project). Owner: Rob. Captured 2026-08-03 during first-pass app
> testing; to be built after the current bug sweep.

One-shot: a designer opens the app and describes intent with references — *"design
a site modeled after competitor.com, colors from brandsite.com, Playfair + Inter
from Google"* — and gets an **on-brand first design**, collapsing
`/setup-project` + `/setup-styleguide` + `/design` into one flow.

## Mental model
Brief it like a **junior designer**: describe the vibe, drop a few links, get a
first pass back, then iterate. The feature only kicks in when the opening message
**already carries the inputs** setup normally asks for (a reference to model, a
color source, font choices). It doesn't replace guided setup — it's the fast lane
for designers who arrive with a brief.

## Decisions locked (Rob, 2026-08-03)
1. **Auto-detect.** On a fresh/unbranded project, the app recognizes a
   design-request-with-references and dives straight in — no interactive setup
   gauntlet. (An explicit `/design-brief` command is a secondary entry point.)
2. **Trust the extraction — no blocking confirmation gate.** Build immediately
   from what's extracted; the designer reacts to the **live design**, not a
   pre-build form. Always *surface* what was pulled (palette, fonts, section plan)
   as a short narration so a correction is one sentence ("make the primary
   warmer"). Assume a deviation pass follows — that's how designers work.
3. **"Inspired by structure," never a pixel clone.** Reference-site modeling
   derives a *section outline*, not a copy — the right creative and IP line.

## Trigger — the auto-detect rule
Replaces the blanket "run /setup-project first" nudge on a fresh project with a
decision:
- **Design intent + ≥1 reference** (URL to model, color source, or named fonts)
  → **Design-from-Brief flow.**
- **Bare "help me get started" / no references** → normal guided setup.
- **Ambiguous** → lean brief-flow if any reference is present; otherwise setup.

Implementation touchpoints: the SessionStart hook context + a routing rule in
`/setup-project` (or a new `/design-brief` skill the hook points to).

## Pipeline
```
Brief + links
  1. PARSE → { referenceSites[], colorSource, fonts[], projectType, clientName?, copyHints }
  2. EXTRACT brand from references (fonts, colors, layout — see below)
  3. APPLY setup NON-INTERACTIVELY (reuses existing machinery):
       • .env: client / project / type / menu
       • create working variation v01 (base v00 stays pristine)
       • write v01 tokens.css + brand.ts (colors, fonts, spacing/radii/type scale)
       • apply a saved company profile if one exists
  4. DESIGN v01/Home modeled on the section plan, using the new --ta-* tokens
  5. SURFACE what was extracted (1 short narration) → designer iterates live
```
No blocking gate between 2 and 4 (decision 2).

## Brand extraction — the make-or-break, buildable with today's tools
No rendering/screenshot pipeline needed; the `curl`/`grep` allowlist already
exists.

| Input | Strategy | Confidence |
|---|---|---|
| **Fonts** | Resolve named Google Fonts → wire `@import` in `fonts.css` + `--ta-font-*` + `brand.ts` roles. "Fonts from a site" → `curl` its CSS, pull `font-family`. | High |
| **Colors** | `curl` the page + linked stylesheets → `grep` hex/rgb/hsl/oklch → **tally by frequency** → map to roles (darkest→ink, lightest→surface, most-saturated→primary/accent). Blend with model knowledge for known brands. Write straight into `v01` tokens (no gate). | Medium — good enough given the iterate-after model |
| **Layout** | `curl` the reference → derive a **section outline** (nav, hero headline/sub/CTA, feature grid, testimonial, footer) → build *inspired by*, not cloned. | Medium — structural inspiration |

**Color extractor is the first build target** — it's the piece that unlocks the
whole flow and the one with the most unknowns. A standalone script/step:
`url → ranked palette → role mapping`, testable in isolation before wiring the
orchestration.

## Reuses existing machinery (orchestrator, not a rewrite)
- `.env` writing + variation creation ← `/setup-project`
- `tokens.css` + `brand.ts` token/scale writing ← `/setup-styleguide`
- the `<DesignSurface>` authoring contract ← `/design`
- company identity ← auto-apply a saved **company profile** if present

Hard constraints it must honor: design into **v01, never base**; use the `--ta-*`
/ `--ta-font-*` token namespaces; keep `--admin-*` untouched.

## Fallbacks (never hard-fail)
- Color URL unscrapable → derive a palette from the reference's vibe + model
  knowledge, proceed (designer corrects live).
- Reference site unfetchable → ask for a one-line structure ("hero, 3 features,
  pricing, footer").
- No client name in brief → infer from the reference or use a placeholder, set
  later.

## Phasing
- **MVP:** parse brief → Google fonts + scraped palette (no gate) + section plan →
  non-interactive setup → `v01` tokens + Home design → surface + iterate.
  Start with the **color-from-URL extractor** as a standalone, tested piece.
- **v2:** sharper palette extraction (role inference + contrast/accessibility
  checks), multi-page, image sourcing from the brief, "fonts from a reference
  site" scraping.

## Next
Build after the current app bug sweep. First code: the color-from-URL extractor
(`url → ranked palette → --ta-* role mapping`), verified in isolation, then wire
the auto-detect routing + non-interactive setup around it.
