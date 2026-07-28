# Cloud export — the licensed derive path (POC)

> Branch `poc/licensed-cloud-export`. This directory does **not** exist on `main`
> and never ships to Vercel. It's the proof-of-concept for moving the high-IP
> Figma **derive** logic off the distributed scaffold and behind an auth-gated
> cloud endpoint.

## The three layers (and where the seam falls)

Today `scripts/export-reconstruct-to-figma.mjs` does all three in one local run:

| Layer | Runs where | Why | IP value |
|---|---|---|---|
| **Capture** — puppeteer renders the user's live `localhost:5173`, walks each `[data-block]` into a raw node tree | **Local** (must — touches the live local project) | needs `getComputedStyle` / `getBoundingClientRect` on the running app | low (commodity serialization) |
| **Derive** — raw tree → Figma-intent build-spec (parse gradients/shadows/radii/borders, resolve colors, omit-defaults, infer layout, bind brand vars) | **Cloud** ← the move | pure computation; no browser, no local files | **high — this is the product** |
| **Build** — feed the build-spec to `figma-*.plugin.js` via the `use_figma` MCP | **Local** (must — user's Figma auth, local MCP session) | plugin `code` executes in the user's Figma | high but un-hideable (transmitted to Figma) |

**Seam rule:** geometry (rects, offsets, text-run boxes) is measured **locally**
because it needs live layout. **Every interpretation of a style string** — parse,
resolve, compact, bind — happens in the **cloud**. `contracts.ts` encodes exactly
this cut.

## Data flow

```
LOCAL client (thin capture shim)                 CLOUD derive (Vercel Function)
─────────────────────────────────               ──────────────────────────────
puppeteer → each [data-block] × view
  serialize raw node tree ────────► CaptureBundle ──POST (API key hdr)──►
  download + PNG-reencode images                    raw → intent:
  (bytes stay LOCAL) ┐                                • culori color resolve
                     │                                • gradient/shadow/radius/border parse
                     │                                • omit-defaults compaction
                     │                                • layout intent + brand binding
  ◄──────────────────┼──────────── BuildSpec ◄────────┘
  feed BuildSpec ─────┘
  + local image bytes → use_figma builder (Part 1 blocks, Part 2 compose)
     → real editable Figma nodes
```

Image bytes and the Figma build never cross the wire. The cloud sees only raw
styles + geometry and returns only the per-node spec.

## The two contracts (`contracts.ts`)

- **`CaptureBundle`** (up) — dumb, faithful serialization. Raw computed-style
  strings (whitelisted in `CAPTURED_STYLE_PROPS`), parent-relative rects, text
  runs, svg markup, img srcs, raw `--ta-*` brand vars, per-page block order,
  asset names. No parsing, no color resolution.
- **`BuildSpec`** (down) — the existing `reconstruct-{variation}.json` manifest,
  formalized. The local orchestrator feeds it to the builder **unchanged**, so
  the cloud hop is transparent to the existing Part 1 / Part 2 flow.

## What changes in the existing scripts

`extractSpec` in `export-reconstruct-to-figma.mjs` splits along the seam:

- Its **raw reads** (walk DOM, `getComputedStyle`, `getBoundingClientRect`, Range
  text measurement, `outerHTML`, `currentSrc`) → become the local **capture**,
  emitting `RawNode`s. Color resolution (`toRGBA` canvas trick) **moves out** —
  the bundle ships raw color strings.
- Its **interpretation** (`parseLinear`, `bgFills`, `parseShadows`, radius/border
  logic, `textStyle`, `readBrand` titling/binding, omit-defaults) → becomes the
  cloud **derive**, now resolving colors with a JS color lib (culori) instead of
  a browser canvas.

`emitCalls` / `slimBody` / the builder plugins are **build-layer** — unchanged,
stay local.

## Open decision

**Color resolution: cloud-side (culori) — recommended.** Today `toRGBA` uses a
browser canvas to flatten oklab/hsl/rgb → sRGB. To move *all* parsing to the
cloud (max IP), the cloud resolves colors itself with culori (handles
oklab/oklch/lab/hsl). Alternative: resolve locally and ship RGBA — simpler, but
leaks the gradient/shadow color-extraction into the client. Going cloud-side.

## Not yet covered

- **Library / brand paths** (`export-library`, `export-brand`) — pure file
  parsing, same contract shape (raw-files-in → spec-out). A later variant.
- **Auth / licensing** — API key in request header; endpoint, metering, and
  revocation are the next design after these contracts. See `[[lockdown-ip-todo]]`.
