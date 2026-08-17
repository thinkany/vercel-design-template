---
description: Design from a brief, one pass from a natural-language design request with references (a site to model, a color source, fonts) to an on-brand v01 design. The "Get Designing" path.
argument-hint: "the brief, e.g. 'a site like stripe.com, colors from stripe, Playfair + Inter'"
---

The designer arrived with a **brief** instead of stepping through setup. Turn it
into an on-brand **first design in one pass:** no setup gauntlet, no confirmation
gate. This orchestrates the extractors + the deterministic apply, then hands off
to the `/design` contract.

**The brief:** $ARGUMENTS

## Locked decisions (don't re-litigate)
- **Trust the extraction.** Build immediately; the designer reacts to the **live
  design**, not a form. Never block on "is this right?".
- **Inspired by structure, never a pixel clone.**
- **Design into the working variation `v01`, NEVER base `v00`.**

## Communication protocol
Same as [`/design`](design.md): calm, plain-language, **low-chatter**. Drive with a
TodoWrite list in designer terms (`Reading your references`, `Applying colors & fonts`,
`Building the hero`, …). One short line per milestone. **Never** narrate the scripts,
JSON, or token mechanics.

## 1. Parse the brief
From the brief pull: **reference site(s)** to model (layout), **color source** (a URL
or a named brand), **fonts** (names, or a site to pull from), **project type**
(`website`/`app`/`brand`, default `website`), **client name** (the company/brand, if
named), **project name** (if named), **copy hints**. A missing value → infer it or
leave the default. **Do NOT ask** (the one exception is in Fallbacks).

## 2. Extract (run the tools, ~10s each, don't narrate them)
- **Colors:** `node scripts/extract-palette.mjs <colorURL> > /tmp/ta-palette.json`,
 color source = the named color site, else the site being modeled.
- **Fonts:** `node scripts/resolve-fonts.mjs "Font One" "Font Two" > /tmp/ta-fonts.json`,
 or `--from <url>` to pull a site's fonts. If no fonts are named, skip this (the
  template defaults stay).
- **Layout:** `node scripts/extract-layout.mjs <referenceURL> > /tmp/ta-outline.json`,
 the reference being modeled. Returns the page's **section skeleton**: an ordered
  list of sections (`hero`/`features`/`logos`/`pricing`/`testimonial`/`faq`/`cta`/`footer`)
  with heading, layout (stack/columns/grid + counts), and the nav pattern. Skip only if
  the brief names no reference site.

Read all three JSON files. On a failed/empty extract, **fall back** (a palette from your
knowledge of the brand; sensible fonts; a conventional section order) and **proceed**,
never hard-fail.

## 2b. Research the field (licensed + gated, usually SKIP)
**FIRST run `echo $TA_DESIGN_RESEARCH`.** If it is anything other than `on`, **skip this
entire step** and go to step 3 (this is the default, the feature is a licensed add-on,
off unless both licensed and toggled on). Do not mention it when off.

When it prints `on`, study a few comparable sites to ground the structure. **Tell the
designer up front it adds a little time**, e.g. *"Studying a few comparable {category}
sites to shape the layout, this'll take a little longer than usual."* Then:
1. **Discover 3–5 references.** Any sites the brief named first; else `WebSearch` the
   category (`"best {category} website"`, `"{competitor} alternatives"`, landing-page
   galleries). Cap at 5.
2. **Read each:** `node scripts/extract-layout.mjs <url>` for its section skeleton +
   nav pattern (and `extract-palette`/`resolve-fonts` if you need a brand cue the brief
   didn't give). Bounded; skip any that fail, a smaller sample is fine.
3. **Synthesize a conventions report** and write it to `/tmp/ta-research.json`:
   the **common** section order (table stakes) vs. what the strong ones do **differently**
   (differentiators), the prevailing nav pattern, plus an `originalityNote`. **Grammar
   only, never reproduce any single site's layout or copy.**

**Broad mode, run `echo $TA_DESIGN_RESEARCH_BROAD`.** If it prints `on`, don't just study
same-category competitors, **look BEYOND them**. Say so up front (it takes *even* longer:
*"Looking at both {category} sites and the wider style you're after, this'll take a bit
longer."*). Decompose the brief into **three axes** and search each SEPARATELY:
- **Function** (what it *is*, "pilates studio", "booking site") → for **structure & IA** (the
  `extract-layout` read above).
- **Aesthetic / tone** (the *feel*, "luxury", "lifestyle", "editorial", "minimal") → search
  **cross-category** exemplars of that vibe (luxury lifestyle brands, boutique hotels, high-end
  wellness, whatever *embodies the feel*, regardless of industry) for **visual language**.
- **Region / mood** (e.g. "west coast", "Scandinavian") → for **imagery & atmosphere**.

Then **blend** in the synthesis: **structure** from the function peers, **feel** from the
aesthetic exemplars, **mood** from the region, recorded as extra fields on
`/tmp/ta-research.json` (`aesthetic`, `region`, `feelRefs`). Still **grammar/feel only, never
clone**. If broad is `off`, do the competitor-only version above.

This is the same as the single-reference read, scaled to many + synthesized. It changes
only step 4's *input* (a synthesized outline + feel notes instead of one site's), never the rules.

## 3. Apply (deterministic, one command, creates v01)
```
node scripts/apply-brand.mjs --variation v01 \
  --palette /tmp/ta-palette.json --fonts /tmp/ta-fonts.json \
  --client "<name or a sensible placeholder>" [--project "<project name if given>"] \
  --project-type <type> [--menu <dropdown|mega>]
```
This creates `v01` from base, writes its `tokens.css` (the seven `--ta-*` colors,
the `--ta-font-*` stacks, the shadcn bridge) + `brand.ts` + `fonts.css` `@import`,
sets the `.env` brand keys, and flips `previewReady`. Omit `--fonts` if you skipped
step 2's font resolve. If the preview doesn't refresh, the dev server picks up the
new variation on reload.

## 4. Design v01/Home
**First, save the brief for reference.** Write the designer's original brief into
`"brief"` in `src/variations/v01/variation.json` (the dashboard card shows it under
"Original brief"). Save **only the designer's brief text**, i.e. everything BEFORE any
`## Design direction` block: that block is system-injected (see below), not the designer's
words, so never store it as the brief. Silent bookkeeping, don't narrate it.

Now follow the [`/design`](design.md) authoring contract and build
`src/variations/v01/components/Home.tsx` with the **new** `--ta-*` / `--ta-font-*`
tokens. **Drive the page's section order + block choices from `/tmp/ta-research.json`
if it exists** (step 2b ran the research layer), **otherwise from `/tmp/ta-outline.json`**
(the single reference's skeleton): build each section in its `sections[]` order, matching the
`type` to a block (hero / feature grid / logo cloud / pricing / testimonial / FAQ / CTA
/ footer) and honoring its `layout`/`columns`/`items` (e.g. a `grid×3` features block →
a 3-up card row) and `nav.pattern`. This is **inspired by structure, not copied:** the
outline is the skeleton; the copy, imagery, and styling are the brand's own. If the
outline is thin/missing (SPA or no reference), fall back to a conventional order
(nav → hero → features → social proof → CTA → footer). Source images per `/design` §4b
(one bounded `curl`, placeholder on a miss).

**The `## Design direction` block (if present in the brief above) is authoritative for the
design's composition**, apply it per [`/design`](design.md) §4a: the lens + its named motif
choices govern the visual **treatment** (eyebrow, hero archetype, section rhythm, feature
layout, dividers, type feel, density), while the outline/research above governs the section
**content** and order. Hold the direction across the whole page, don't drift back to the
generic centroid partway down.

## 5. Surface (one line, then stop)
Close by naming **what was pulled and from where**, and invite a correction, so the
designer steers the live result:
> "Branded from your brief, primary **#533afd** pulled from stripe.com, **Playfair**
> for headings + **Inter** for text, and a hero-plus-feature-row layout. It's live at
> localhost:5173. Want the primary warmer, or a different hero?"

## Fallbacks (never hard-fail)
- **Color URL unscrapable** → derive the palette from your knowledge of the brand and
  proceed.
- **Reference site unfetchable** → ask for a **one-line** structure ("hero, 3 features,
  pricing, footer"), the only question allowed.
- **No client name** → infer from the reference or use a placeholder; it's set later.

---
*Note: this runs `node` scripts. In local dev that's fine. In a packaged build the
agent's shell needs a `node` on PATH (the app's `desktop/bin` node shim), see the
app wiring.*
