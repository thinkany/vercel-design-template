# Figma ingest — spec

**Priority: queued (build after the current close-out), alongside the other parked features.**
Value is high; the sleeper win is brand token pre-fill, not "another reference format."

Read an EXISTING Figma design (via the Figma MCP server) into the app as a structured design
brief + reference. This is the *import* direction on the same offline/auth-gated Figma plumbing
the app already uses for *export*. It rides the reference-ingest architecture (ingest once →
compact digest persists in the convo) and feeds two consumers: the design brief and the brand.

**Not** a pixel-perfect reconstruction (that's a heavier, separate problem). This produces a
brief-quality digest + ground-truth tokens, not a rebuilt page.

## Why this is worth it

- **Ground truth, not inference.** A screenshot forces the model to *guess* colors, type sizes,
  and spacing from pixels (today's palette-from-image re-ranking is an approximation). Figma
  Variables give exact values.
- **Semantic structure.** Named layers + auto-layout give real section names ("Hero", "Pricing",
  "Footer") and responsive intent (direction, gap, padding, hug/fill) a screenshot can't express.
  Better than the HTML-heuristic outline `extract-layout.mjs` produces for `/design-brief`.
- **The sleeper win: brand pre-fill.** `get_variable_defs` maps almost 1:1 onto `brand.ts` /
  `tokens.css` / the `--ta-*` palette + type scale. Importing a Figma file can pre-populate the
  brand at near-perfect fidelity during `/setup-styleguide`, instead of guessing from a screenshot.

## Input & format requirements

Input is a **Figma frame URL** (`figma.com/design/:key/...?node-id=X`), not an uploaded file.
Two hard requirements:

- **Access + a node target.** The Dev Mode MCP server reachable (Figma desktop app open on the
  file, or a token) and a specific frame/node to scope to. Offline + auth-gated like export;
  never runs on Vercel.
- **A well-structured source to get the payoff.** Figma Variables + auto-layout + named layers
  yield rich data. A flattened file (absolute positions, no variables, "Rectangle 47" names)
  degrades toward "a screenshot with coordinates." State this to the user; we can't control the
  source file's discipline. Degrade gracefully (see below), never hard-fail.

## The pull sequence (cheapest, highest-value first)

Always **node-scoped to one frame**, never a whole file.

1. **`get_variable_defs`** → tokens: colors, type scale, spacing, radii as actual values.
   Compact (hundreds to ~2k tokens) and the highest value per token. Drives brand pre-fill.
2. **`get_metadata`** → the layer/hierarchy tree: named sections, auto-layout (direction/gap/
   padding), sizes, hug/fill. The section outline, ground-truth. Scales with the tree — scope it.
3. **`get_screenshot`** → ONE raster of the frame, for aesthetic feel (imagery, density, polish)
   the structure can't carry.
4. **Skip `get_design_context`** at ingest — the full code/React view is the token-heavy call
   (tens of thousands of tokens on a full page). Not needed for a brief.

Then **distill** all of the above into the SAME compact digest the PDF/image ingest already
emits, so only the small summary rides subsequent turns.

## Cost / tokens

- A screenshot ≈ `(w×h)/750` vision tokens, capped ~1,600 for a large image; a PDF is similar
  per page.
- `get_variable_defs`: a few hundred to ~2k tokens — cheaper than an image, more useful per token.
- `get_metadata`: scales with the tree; a rich full page can be 5k–15k+ tokens (i.e. *more* than
  an image) → the reason to scope to a frame.
- `get_design_context`: tens of thousands on a full page → excluded at ingest.

Net: the ingest *turn* can cost more than dropping in an image (it pulls structure), but the
**persisted digest is small**, same as the existing ingest. Over a whole design session it's
likely cheaper than re-carrying an image AND far higher fidelity. Levers: frame-scope, skip
`get_design_context`, cap the screenshot to one.

## Two consumers

1. **Reference / brief.** A new reference SOURCE ("Import from Figma") beside upload-PDF/image,
   producing the standard digest that grounds `/design-brief` + `/design`. Slots into the
   reference-ingest UI + digest shape with no new persistence format.
2. **Brand pre-fill (the high-value path).** During `/setup-styleguide`, offer to seed the
   `--ta-*` palette + type scale + spacing/radii from `get_variable_defs`. Writes `brand.ts` +
   `tokens.css` together (same as setup writes them today) so they never drift; the designer
   confirms/tweaks rather than picking from scratch. Wire the contrast-safe pairing (see the
   accessibility spec) so an imported palette still passes AA.

## Operational shape

- **Auth/offline**, like export: needs the Figma Dev Mode server or a token; surfaced in the
  Figma/Keys drawers, gated on the Figma license tier (same as export).
- **Node-scoped** always — enumerate top-level frames via `get_metadata`, let the user pick (or
  take the linked node-id), never pull a whole file.
- **Graceful degradation:** no variables → screenshot-only digest + a note that tokens couldn't
  be read; unreachable file → prompt to open it in Figma / paste a token; oversized frame → warn
  + scope tighter. Never hard-fail a brief.

## Phasing

1. **P1 — brief ingest.** "Import from Figma" reference source: `get_variable_defs` +
   node-scoped `get_metadata` + one `get_screenshot` → the existing digest. Proves the pull +
   distill on the reference plumbing.
2. **P2 — brand pre-fill.** Seed `--ta-*` + type/space/radii into `brand.ts`/`tokens.css` from
   the tokens during `/setup-styleguide`, with AA-safe pairing + designer confirmation.
3. **P3 — polish.** Frame picker UI, multi-frame ingest, better section→scaffold mapping.

## Out of scope

- Pixel-perfect reconstruction of the Figma page (heavy, separate problem — this is brief-grade).
- Two-way sync / round-trip with export (export stays its own path; this is import only).
- Running any of it on Vercel (offline + auth-gated, same as export).

## Relates to

reference-ingest (digest + sources), design-from-brief / `extract-layout.mjs` (superior layout
source), setup-styleguide (token pre-fill target), the Figma export MCP plumbing (same auth/
offline door, reverse direction), accessibility-aa (AA-safe imported palette).
