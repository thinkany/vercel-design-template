---
description: Design from a brief — one pass from a natural-language design request with references (a site to model, a color source, fonts) to an on-brand v01 design. The "Get Designing" path.
argument-hint: "the brief, e.g. 'a site like stripe.com, colors from stripe, Playfair + Inter'"
---

The designer arrived with a **brief** instead of stepping through setup. Turn it
into an on-brand **first design in one pass** — no setup gauntlet, no confirmation
gate. This orchestrates the extractors + the deterministic apply, then hands off
to the `/design` contract.

**The brief:** $ARGUMENTS

## Locked decisions (don't re-litigate)
- **Trust the extraction.** Build immediately; the designer reacts to the **live
  design**, not a form. Never block on "is this right?".
- **Inspired by structure, never a pixel clone.**
- **Design into the working variation `v01` — NEVER base `v00`.**

## Communication protocol
Same as [`/design`](design.md): calm, plain-language, **low-chatter**. Drive with a
TodoWrite list in designer terms (`Reading your references`, `Applying colors & fonts`,
`Building the hero`, …). One short line per milestone. **Never** narrate the scripts,
JSON, or token mechanics.

## 1. Parse the brief
From the brief pull: **reference site(s)** to model (layout), **color source** (a URL
or a named brand), **fonts** (names, or a site to pull from), **project type**
(`website`/`app`/`brand` — default `website`), **client name** (if named), **copy
hints**. A missing value → infer it or leave the default. **Do NOT ask** (the one
exception is in Fallbacks).

## 2. Extract (run the tools — ~10s each, don't narrate them)
- **Colors:** `node scripts/extract-palette.mjs <colorURL> > /tmp/ta-palette.json`
  — color source = the named color site, else the site being modeled.
- **Fonts:** `node scripts/resolve-fonts.mjs "Font One" "Font Two" > /tmp/ta-fonts.json`
  — or `--from <url>` to pull a site's fonts. If no fonts are named, skip this (the
  template defaults stay).

Read both JSON files. On a failed/empty extract, **fall back** (a palette from your
knowledge of the brand; sensible fonts) and **proceed** — never hard-fail.

## 3. Apply (deterministic — one command, creates v01)
```
node scripts/apply-brand.mjs --variation v01 \
  --palette /tmp/ta-palette.json --fonts /tmp/ta-fonts.json \
  --client "<name or a sensible placeholder>" --project-type <type> [--menu <dropdown|mega>]
```
This creates `v01` from base, writes its `tokens.css` (the seven `--ta-*` colors,
the `--ta-font-*` stacks, the shadcn bridge) + `brand.ts` + `fonts.css` `@import`,
sets the `.env` brand keys, and flips `previewReady`. Omit `--fonts` if you skipped
step 2's font resolve. If the preview doesn't refresh, the dev server picks up the
new variation on reload.

## 4. Design v01/Home
Now follow the [`/design`](design.md) authoring contract and build
`src/variations/v01/components/Home.tsx` with the **new** `--ta-*` / `--ta-font-*`
tokens. Model the **section outline** on the reference — nav, hero (headline / sub /
CTA), a feature row, social proof, footer — **inspired by structure, not copied**.
Source images per `/design` §4b (one bounded `curl`, placeholder on a miss).

## 5. Surface (one line, then stop)
Close by naming **what was pulled and from where**, and invite a correction — so the
designer steers the live result:
> "Branded from your brief — primary **#533afd** pulled from stripe.com, **Playfair**
> for headings + **Inter** for text, and a hero-plus-feature-row layout. It's live at
> localhost:5173. Want the primary warmer, or a different hero?"

## Fallbacks (never hard-fail)
- **Color URL unscrapable** → derive the palette from your knowledge of the brand and
  proceed.
- **Reference site unfetchable** → ask for a **one-line** structure ("hero, 3 features,
  pricing, footer") — the only question allowed.
- **No client name** → infer from the reference or use a placeholder; it's set later.

---
*Note: this runs `node` scripts. In local dev that's fine. In a packaged build the
agent's shell needs a `node` on PATH (the app's `desktop/bin` node shim) — see the
app wiring.*
