---
description: Import an existing Figma frame (via the Figma MCP) into a compact design digest + brand tokens — the "Start from Figma" onboarding path, the read direction of the export plumbing
---

Use this when the designer starts a project **from a Figma frame** (the "Start from Figma"
card) or asks to **import / bring in / pull a Figma design**. `$ARGUMENTS` is a Figma **frame URL**
(`figma.com/design/:key/...?node-id=X`). You READ the target frame(s) through the Figma MCP and
distill into the project's reference digest (so `/design-brief` + `/design` consume it exactly like an
uploaded reference) plus a `figma.json` token seed. This is the *import* direction of the same
license-gated Figma plumbing `export-figma` uses — never runs on Vercel.

**This is brief-grade, not a pixel-perfect rebuild.** You produce a digest + ground-truth tokens,
not a reconstructed page. House style: typographic apostrophes, **no em-dashes**.

## Prereqs (degrade, never hard-fail)

- **Figma MCP connected**, same as export. The connected server is **file-key-scoped**: every read
  tool (`get_metadata`, `get_variable_defs`, `get_screenshot`) needs a **fileKey**, so you always work
  from a **URL** — there is no ambient "current selection" to resolve without a file. If a URL is
  missing, ask for one (see below). If a target is unreachable, tell the designer to check the Figma
  connection, then stop cleanly. Do NOT invent data.

## Resolve the target (do this first)

A Figma **URL is required** (it carries the fileKey). If `$ARGUMENTS` has none, or carries surrounding
text (e.g. "Implement this from Figma. @https://..."), first **extract the `figma.com` URL** from it
(ignore a leading `@` and any prose). If there is still no URL, ask the designer to paste one — with a
node id (`figma.com/design/:key/:name?node-id=123-456`, via right-click frame → Copy link to
selection) to go straight to that frame, or just the file URL to pick from its frames — then stop.

From the URL, always stay **node-scoped**, never a whole file:

- **A URL with a `node-id`** → that exact frame. Parse the `node-id` and scope to it.
- **A URL with NO `node-id`** (a file / page URL), OR a node that turns out to be a page holding
  several top-level frames → **frame picker**: call `get_metadata` on the fileKey to enumerate the
  top-level frames (names + sizes), then `AskUserQuestion` ("Which frame(s) should I import?") listing
  them. Let the designer pick **one or several** (multi-frame). If the response surfaces a current
  selection, highlight it as the likely target.
- **Multi-frame** → ingest each picked frame through the pull + distill below; the digest gets one
  asset per frame and a **combined** section outline (label each section with its frame), and
  `figma.json.frames` lists them. Keep it to the few they pick, not the whole file.

Capture the **file name** and the chosen **frame name(s)** as you go — they seed the project name
suggestion (below).

## The pull sequence (node-scoped, cheapest + highest-value first)

Call these on the frame node, in order. Batch where the MCP allows.

1. **`get_variable_defs`** → the tokens (colors, type scale, spacing, radii as real values). Cheapest,
   highest value, drives the brand seed. If the file has **no variables**, note it and continue
   (screenshot-only digest).
2. **`get_metadata`** → the layer tree: named sections, auto-layout (direction / gap / padding),
   sizes, hug/fill. This is the section outline + the structure signal. It scales with the tree, so
   if it is huge, summarize the top two levels rather than pulling everything.
3. **`get_screenshot`** → **one** raster of the frame, for the aesthetic feel (imagery, density,
   polish) the structure cannot carry.
4. **Do NOT call `get_design_context`** — the code/React view is tens of thousands of tokens and a
   brief does not need it.

## Distill

**Tokens (from `get_variable_defs`).** Map the variables to:
- `colors`: the brand hex values (primary, accents, ink, surfaces where named).
- `type`: font families + the size/weight scale.
- `spacing`, `radii`: the numeric scales.
Keep the exact values. These are the ground-truth brand seed (the payoff over guessing from pixels).

**Also record `colorRoles`** — the palette mapped to the seven `--ta-*` roles (primary / accent /
surface / ink / body / muted / border), AA-safe (text roles must clear WCAG AA on the surface; nudge
a failing one and it is fine). The app **auto-wires `colorRoles` + `typeRoles` into `tokens.css`** the
moment the ingest finishes, so the design starts on the real brand, not the template defaults. Get
this mapping right — it is what the build actually renders.

**Structure (from `get_metadata`).** Produce a short **section outline** (ordered named regions), and
classify the frame:
- `"page"` — reads as a real page: **≥ 2 stacked section-level auto-layout frames**, or named layers
  matching page regions (hero / header / nav / footer / features / pricing / cta / testimonials), at
  a page-scale width. 
- `"styleguide"` — a token/component sheet: swatch grids, type specimens, a single component, no
  vertical page composition.
- `"unknown"` — ambiguous. **When unsure, prefer `"styleguide"`** (a false "page" wrongly implies a
  layout to reproduce; a false "styleguide" only forgoes an offer, which is safe).

**Feel (from the screenshot).** A short read: `overallFeel`, `type`, `layout`, `imagery`, and
`emulate` / `avoid` notes. This is the vibe the tokens + structure cannot express.

**Component details (the fidelity beyond palette).** The brand layer is not enough: the small
decisions (button shape, link treatment, card style) are what make it read as THIS design, and they
live on the components, not the tokens. For the few KEY components only, pull a **targeted
`get_design_context` on that ONE node** (a primary button, a text link / CTA, a card) — node-scoped,
so it stays cheap even though the full-page code view is off. Extract the exact values and record
them as directives in `figma.json.components` + the digest's **Component details** line:
- **Buttons:** capture the **exact** corner radius AND the button height. Classify crisply: if the
  radius is >= half the height (or is 999 / 9999px, `50%`, or "full"), it is a **PILL** — record it
  verbatim as `border-radius: 9999px`, never a rounded-down guess. Also padding, border, fill, and
  hover. The single most common miss is a pill flattening to a subtle radius because the build fell
  back to the scaffold's default button rounding — so record the exact value and that it must
  OVERRIDE that default.
- **Links / CTAs:** treatment (underline, arrow icon, letter-spaced caps) and hover.
- **Cards / containers:** hairline-rule vs boxed vs shadowed, radius, padding.
These are the details a plain screenshot read misses. Capture the real values, not generic defaults.

**Fonts + type roles (flag non-web faces, and map faces to roles so they are USED).** List the font
families in `fonts`. Any family that is **not** a common Google / system webfont (e.g. "DotMatrix
Two") goes in **`customFonts`** as `{ family }` — the app surfaces an upload control for the real
files. Do not guess a substitute; record the real name.

**Crucially, record which face fills which role** in `figma.json.typeRoles`, e.g.
`{ "display": "DotMatrix Two", "eyebrow": "DotMatrix Two", "body": "Outfit", "mono": null }`, and state
it in the digest. An uploaded font that is not wired to a `--ta-font-*` role **will not appear** (that
is why DotMatrix was missing). So instruct the build, in the digest, to **set the `--ta-font-*` tokens
to these families** — the uploaded custom files live in `public/fonts/` with their `@font-face` already
in `fonts.css` — so eyebrows/labels/display render in the distinctive face and body in the readable
one. If a custom font was not uploaded, fall back to the nearest webfont and note the substitution.

**Brand name + logo (glean and ingest).** From the metadata + screenshot:
- **Brand name.** Read the actual company/brand name from a wordmark/logo layer, a nav or footer
  logo, a footer copyright line, or the file name. Record it as `brandName` (the real name, e.g.
  "SkyWater", not a tidy slug). If you genuinely cannot tell, leave it null. This pre-fills the
  designer's "Company or brand name" field.
- **Logo (best-effort).** A "logo" layer is often a **component set with variants** (State=default /
  hover) wrapping the real artwork one level down. Drill in: find the logo component → its **default**
  variant → the innermost image/vector node, and export **that** node with **`download_assets`**
  (prefer SVG; PNG at 2x otherwise). Save it as **`public/images/logo.<ext>`** and set
  **`VITE_BRAND_LOGO=/images/logo.<ext>`** in the project `.env` (the scaffold's header reads it).
  **Only set `logo` to that path if a file was actually written** — never claim a logo you did not
  verify was exported. If you cannot cleanly export it (nested instance, no exportable node, export
  returned nothing), leave `logo` null and briefly say so; the app then offers the designer a
  one-click upload on the findings screen. Do not export a random graphic as a fallback.

**Images (ingest the curated ones — use them, don't source stock).** The frame's real imagery
(photography, illustration, meaningful image fills) is **already curated for this brand and already
present**, so it is the right source for the design — better than fetching stock. Export those image
nodes/fills with **`download_assets`** into **`public/images/figma/`** (descriptive names, e.g.
`hero.jpg`, `markets-aerospace.jpg`), and record each in `figma.json.images` as `{ name, path }`.
Then in the digest add an **Images** line naming the folder and instructing the build to **use these
first**. Skip icons, tiny decorative marks, the logo (handled above), and empty placeholder boxes
(a dark rectangle with no photo is not an asset). If the frame has no real imagery (a bare component
sheet often does not), skip and leave `images` empty — the normal `/design` image flow then applies.

**Icons (ingest the real SVGs, don't substitute).** Named icon / vector components (arrows, chevrons,
UI glyphs), **especially ones with hover / non-hover states**, are curated assets the design should
use verbatim, not a generic text arrow or a lucide swap. Export them with `download_assets` into
**`public/images/figma/icons/`** (descriptive names, e.g. `arrow.svg`, `arrow-hover.svg`), record each
in `figma.json.icons` as `{ name, path, hoverPath? }`, and note in the digest that links/CTAs use
these exact SVGs (and their hover swap). Skip the logo (handled above) and purely decorative marks.

## Write two files under `.thinkany/references/`

**1. `digest.json`** + **`digest.md`** — the SAME shape reference-ingest emits, so `/design-brief`
picks it up with no special-casing. `digest.json`:

```json
{
  "version": 1,
  "generatedAt": "<ISO now>",
  "stub": false,
  "palette": ["#RRGGBB", "..."],
  "fonts": ["Family Name", "..."],
  "assets": [{
    "id": "figma",
    "name": "<frame name>",
    "kind": "image",
    "summary": "Figma frame — <one-line feel>",
    "palette": ["#RRGGBB", "..."],
    "ingested": true
  }],
  "style": { "overallFeel": "...", "type": "...", "layout": "...", "imagery": "..." },
  "emulate": "...",
  "avoid": "...",
  "brandRules": ["exact palette + type come from the Figma variables (ground truth)"]
}
```

`digest.md` (human, same headings reference-ingest uses):

```
## Design references (distilled from a Figma frame)

_Distilled from the imported Figma frame. Treat this as the primary style direction; the palette and type are EXACT (from the file's variables)._

_Build from this digest, and MATCH the source faithfully — fidelity is the priority. The brand is already wired into tokens.css. To get the colors, icons, and detail right, DO look at the design: screenshot the frame's sections for visual reference (get_screenshot) as much as you need — that visual check is what makes the build accurate. Use the ingested images/icons by their `public/images/figma/` paths (they are already downloaded; don't re-fetch them)._

- **Overall feel:** ...
- **Type:** ...
- **Layout:** ...
- **Imagery:** ...
- **Palette (exact, from Figma variables):** #RRGGBB #RRGGBB ...
- **Emulate:** ...
- **Avoid:** ...
- **Section outline:** Hero, Features, Pricing, Footer  (from the frame's named layers)
- **Type roles (wire `--ta-font-*` to these, uploaded custom files are in `public/fonts/`):** Display/eyebrow = DotMatrix Two; Body = Outfit; ... USE them, do not leave the template default.
- **Component details:** Buttons = **fully-rounded pill, `border-radius: 9999px`** — apply this EXACT value and OVERRIDE the scaffold's default button rounding; do NOT settle for a subtle radius. Links = arrow-icon + letter-spaced caps (hover swaps the arrow); Cards = hairline rule, no box. MATCH these, not generic defaults.
- **Icons:** real SVGs are in `public/images/figma/icons/` (e.g. `arrow.svg` + `arrow-hover.svg`) — use these for links/CTAs, not a text arrow or a substitute.
- **Images:** curated images from the source Figma are in `public/images/figma/` — USE these first (they are the client's own assets); only source new images for anything they do not cover.
```

**2. `figma.json`** — the token seed + structure (the brand-pre-fill source, P2, and the handoff
signal). Do not fold this into the digest:

```json
{
  "frameUrl": "<the URL>",
  "fileName": "<the Figma file name>",
  "frames": [{ "nodeId": "<node-id>", "name": "<frame name>" }],
  "generatedAt": "<ISO now>",
  "tokens": { "colors": { "amber-500": "#F0BC48", "...": "#RRGGBB" }, "type": {...}, "spacing": {...}, "radii": {...} },
  "colorRoles": { "primary": "#F0BC48", "accent": "#B7872D", "surface": "#212121", "ink": "#FFFFFF", "body": "#C9C9C9", "muted": "#686868", "border": "#4C4C4C" },
  "fonts": ["..."],
  "customFonts": [{ "family": "DotMatrix Two" }],
  "typeRoles": { "display": "DotMatrix Two", "eyebrow": "DotMatrix Two", "body": "Outfit", "mono": null },
  "components": { "button": "fully-rounded pill, border-radius: 9999px, letter-spaced caps, amber on dark", "link": "arrow-icon + micro-caps, hover swaps arrow", "card": "hairline rule, no box" },
  "images": [{ "name": "hero", "path": "/images/figma/hero.jpg" }],
  "icons": [{ "name": "arrow", "path": "/images/figma/icons/arrow.svg", "hoverPath": "/images/figma/icons/arrow-hover.svg" }],
  "sections": [{ "name": "Hero", "frame": "<frame name>" }],
  "structure": "page | styleguide | unknown",
  "brandName": "<the real company/brand name gleaned from the wordmark/footer, or null>",
  "logo": "/images/logo.svg | null",
  "nameSuggestion": "<a tidy project name derived from the file / frame name>",
  "hasVariables": true,
  "summary": "<one plain sentence on the feel, e.g. engineering-serious: near-black canvas, one amber accent, documentary photography, hairline rules>",
  "flags": ["<any caveat, e.g. no spacing/radii variables in the file>", "<e.g. DotMatrix Two is not a standard webfont, needs a source or substitute>"]
}
```

`frames` is one entry for a single ingest, several for multi-frame. `sections` carries the combined,
frame-labelled outline. `nameSuggestion` is a clean title from the file/frame name (e.g. file
"Acme Marketing v3" → "Acme"). `summary` (one sentence) + `flags` (caveats) are shown to the designer
by the app. `tokens.colors` values are what the app renders as swatches, so keep them exact.

## Then hand off — the APP drives the next step in the pane

**Do NOT ask a chat question, run the next command yourself, or post a chat summary.** Once the files
are written, the app reads `figma.json` and presents the findings + the next-step choice **as cards in
the full-screen pane** (like Get Designing), so the designer never types a command and never needs a
chat recap. Your job ends the moment the three files are written: **STOP silently** — do not print a
confirmation line ("Imported X — choose how to continue"), a summary, or any closing message. The pane
IS the confirmation; a chat line here is redundant and confusing to the designer.

The `structure` you record drives which cards the pane shows:

- **`page`** → the pane offers "Design this page" (a `/design` build using the section outline as the
  layout skeleton + the screenshot as reference) alongside "Start from a brief".
- **`styleguide` | `unknown`** → the pane offers "Start designing" (the digest + tokens ride along as
  the style direction; the designer says what they are building).

So record `structure`, `summary`, `flags`, `nameSuggestion`, and the palette/type accurately — those
are exactly what the pane renders. `nameSuggestion` pre-fills the project name; the named `sections`
are available to map a website's nav/pages later (with confirmation, never silently).

## Degrade matrix (never hard-fail)

- **No variables** → skip the token seed; write the digest from the screenshot only (`stub` stays
  `false` but `palette` may be approximate from the raster, and say so). `figma.json.hasVariables:
  false`.
- **Unreachable frame / MCP down** → stop and tell the designer how to connect; write nothing.
- **Oversized `get_metadata`** → summarize the top levels; still classify + outline.
- **A digest already exists** (they uploaded refs first) → merge the Figma palette/feel in rather
  than clobbering; keep both sources' assets.

## Cost

Node-scope everything, skip `get_design_context`, one screenshot only. The ingest turn pulls
structure so it can cost more than dropping in an image, but the **persisted digest is small** and
the fidelity is far higher (exact tokens + real section names).
