---
description: Import an existing Figma frame (via the Figma MCP) into a compact design digest + brand tokens — the "Start from Figma" onboarding path, the read direction of the export plumbing
---

Use this when the designer starts a project **from a Figma frame** (the "Start from Figma"
card) or asks to **import / bring in / pull a Figma design**. `$ARGUMENTS` is a Figma **frame
URL** (`figma.com/design/:key/...?node-id=X`). You READ that one frame through the Figma MCP and
distill it into the project's reference digest (so `/design-brief` + `/design` consume it exactly
like an uploaded reference) plus a `figma.json` token seed. This is the *import* direction of the
same offline, license-gated Figma plumbing `export-figma` uses — never runs on Vercel.

**This is brief-grade, not a pixel-perfect rebuild.** You produce a digest + ground-truth tokens,
not a reconstructed page. House style: typographic apostrophes, **no em-dashes**.

## Prereqs (degrade, never hard-fail)

- **Figma MCP connected** (Dev Mode MCP / the desktop app open on the file), same as export. If the
  frame is unreachable, tell the designer to open the file in Figma (or check the Figma connection),
  then stop cleanly. Do NOT invent data.
- **A node target.** Parse the `node-id` from the URL. Always **scope to that one frame** — never
  pull a whole file.

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
  "nodeId": "<node-id>",
  "generatedAt": "<ISO now>",
  "tokens": { "colors": { "...": "#RRGGBB" }, "type": {...}, "spacing": {...}, "radii": {...} },
  "fonts": ["..."],
  "sections": ["Hero", "Features", "..."],
  "structure": "page | styleguide | unknown",
  "hasVariables": true
}
```

## Then hand off

Report briefly what you found (palette, fonts, structure, section count). Then:

- **`structure: "page"`** → offer to **design the imported frame**: "This looks like a full page. Want
  me to design a version of it?" If yes, run a `/design` build using the section outline + screenshot
  as the layout reference and the palette/type as the brand. If no, continue to the normal brief.
- **`structure: "styleguide" | "unknown"`** → do NOT imply a layout. The tokens + digest are seeded;
  continue to the normal brief: ask what they are building and design with this frame as the style
  reference (the digest already rides `/design-brief`).

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
