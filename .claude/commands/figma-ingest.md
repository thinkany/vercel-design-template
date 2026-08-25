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

- **Overall feel:** ...
- **Type:** ...
- **Layout:** ...
- **Imagery:** ...
- **Palette (exact, from Figma variables):** #RRGGBB #RRGGBB ...
- **Emulate:** ...
- **Avoid:** ...
- **Section outline:** Hero, Features, Pricing, Footer  (from the frame's named layers)
```

**2. `figma.json`** — the token seed + structure (the brand-pre-fill source, P2, and the handoff
signal). Do not fold this into the digest:

```json
{
  "frameUrl": "<the URL>",
  "fileName": "<the Figma file name>",
  "frames": [{ "nodeId": "<node-id>", "name": "<frame name>" }],
  "generatedAt": "<ISO now>",
  "tokens": { "colors": { "...": "#RRGGBB" }, "type": {...}, "spacing": {...}, "radii": {...} },
  "fonts": ["..."],
  "sections": [{ "name": "Hero", "frame": "<frame name>" }],
  "structure": "page | styleguide | unknown",
  "nameSuggestion": "<a tidy project name derived from the file / frame name>",
  "hasVariables": true
}
```

`frames` is one entry for a single ingest, several for multi-frame. `sections` carries the combined,
frame-labelled outline. `nameSuggestion` is a clean title from the file/frame name (e.g. file
"Acme Marketing v3" → "Acme"), used to pre-fill the project name downstream.

## Then hand off

Report briefly what you found (file name, palette, fonts, structure, section count). Then:

- **Name suggestion.** When the design flow asks for the project/client name, offer
  `nameSuggestion` as the default (editable) rather than a blank prompt.
- **`structure: "page"`** → offer to **design the imported frame**: "This looks like a full page. Want
  me to design a version of it?" If yes, run a `/design` build using the **section outline (in order)**
  as the layout skeleton, the screenshot as the visual reference, and the palette/type as the brand.
  If no, continue to the normal brief.
- **`structure: "styleguide" | "unknown"`** → do NOT imply a layout. The tokens + digest are seeded;
  continue to the normal brief: ask what they are building and design with this frame as the style
  reference (the digest already rides `/design-brief`).
- **Section → scaffold mapping (website).** When setting up a website's nav/pages, propose the menu
  from the named sections (map hero/features/pricing/etc. to pages or in-page anchors), so the site
  structure mirrors the Figma. The designer confirms; do not silently generate pages.

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
