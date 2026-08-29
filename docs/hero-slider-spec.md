# Hero: Slider option (with sub-layouts) — spec

**Status:** SPEC'd 2026-08-28, not built. Author: Rob's ask.
**Where:** electron app hero picker (`desktop/shell.js` HERO_LAYOUTS + renderer,
`shell.html` CSS, `copy.js`), `main.cjs` HERO_LAYOUT_PHRASES; scaffold `/design`
build rule for building + Figma-exporting a slider.

## Summary / feasibility

Add **Slider** as a hero-layout option, with two sub-layouts. Fully feasible:
`embla-carousel-react@8.6.0` and the shadcn `ui/carousel.tsx` wrapper are installed,
so a hero carousel is a built-in primitive, not a hand-roll. The `capture` prop
already reaches the hero component, which is what makes a clean Figma export possible.

## The option + sub-layouts

A 6th hero chip: **Slider**. When selected, offer two layouts:

- **3a — In a column** (`slider-column`): a typical slider contained in the max-width
  content column (slides sit inside the column; arrows/dots; optional autoplay).
- **3b — Full-bleed background** (`slider-fullbleed`): each slide is a full-viewport-width
  **background image**; the copy stays within the content column, overlaid on the slides.

(Both are standard carousel patterns; more sub-layouts can slot in later.)

## Selection UX — nested reveal (recommended)

The current hero picker is a flat single-select of chips. Slider needs a **second
level**, so:

- Slider appears as one chip among the 6 hero options.
- **Picking Slider reveals a sub-row** of two chips (3a / 3b), each with its own mini
  wireframe, directly under the hero grid (progressive disclosure).
- The stored value is the SUB id (`slider-column` / `slider-fullbleed`), never bare
  "slider". Continue stays disabled until a sub-option is chosen (or default to
  `slider-column` on a bare Slider pick — decide at build).
- Picking a different hero (or "Let you choose") hides the sub-row.

This nested pattern generalizes to any future hero-with-variants. **Alternative
(simpler, not recommended):** two flat chips "Slider · column" / "Slider · full-bleed",
no nesting, but it clutters the flat grid and doesn't scale. Prefer the reveal.

Wireframes (same SVG chip style as the other heroes):
- `slider-column`: a max-width box with a slide + dot indicators + side arrows, inset
  from the frame edges.
- `slider-fullbleed`: a full-frame image block with a copy column overlaid + dots.

## Data model

- `heroLayout` gains two ids: **`slider-column`**, **`slider-fullbleed`** (the existing
  field; no schema change).
- `HERO_LAYOUT_PHRASES` (main.cjs) gains matching phrases, e.g.:
  - `slider-column`: "a hero built as a slider/carousel contained in the max-width
    content column (multiple slides, dot indicators + arrows, tasteful autoplay)."
  - `slider-fullbleed`: "a full-bleed hero slider where each slide is a full-width
    background image, with the headline + CTAs held within the content column overlaid
    on the slides."

## Build guidance (scaffold `/design`)

- Build the slider with **embla / the shadcn `carousel`** (don't hand-roll). Reuse
  `cn()`, keep tokens (`bg-ta-*` etc.), container-query units, and the `fill-screen`
  rule if the slider hero is full-screen.
- **Capture-mode static render (the Figma fix):** the hero component already receives
  `capture`. When `capture` is set, render **a single static slide** (slide 1, no embla
  track/overflow) so the export is one clean hero frame with no off-screen carousel
  layers. Interactive (autoplay/arrows) only in live preview.
- Dots/arrows are real in preview; in capture they can render as static indicators (or
  be omitted) — a designer reading the Figma frame still sees "this is a slider."

## Figma export implications

- A slider is interactive; **Figma is static**, so the export represents the hero as
  **slide 1** (the motion/interaction cannot carry into Figma — expected, not a defect).
- **Risk without the capture-mode static render:** embla lays all slides in a horizontal
  track (`overflow: hidden` viewport, off-screen slides translated). The block capture
  (html.to.design / CDP) could traverse the off-screen slides → extra/overlapping/hidden
  layers, or (if it read scrollWidth) a giant over-wide hero.
- **Mitigation = the capture-mode static render above.** With it, the exported hero is
  exactly one slide, clean. This is the load-bearing requirement for the export to be
  tidy.
- Verify on a real export once built (the `?capture=` route + a Figma run).

## Open questions for build kickoff

- Nested reveal vs. flat chips (recommend reveal). Bare-Slider default = column, or
  require a sub-pick?
- Capture render: static slide-1 only, or slide-1 + static dots (so Figma reads as a
  slider)?
- Autoplay on by default in preview, or off (accessibility / motion-preference)?
- Does `slider-fullbleed` count as a `fill-screen` hero (full viewport) by default?

## Related

- [[design-variety-feature]] — the hero picker this extends (Centered/Split/Full-screen/
  Type-led/Showcase; Slider is #6).
- Figma export path: `desktop/capture-bridge.cjs` + the `?capture=` route + `data-block`
  block capture — the static-render fix lives in the hero component, keyed on `capture`.
