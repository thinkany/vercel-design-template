---
description: Export a design to Figma, the cohesive two-part pipeline (Styleguide + Blocks, then Pages/App from blocks), the locked P15–P17 scope/destination prompts, and the live orchestration flow
---

Use this the moment the user asks to **export, send, sync, or push** a design (or
the styleguide, components, blocks, or pages) **to Figma:** the post-design export
phase. It inlines the full pipeline so you go straight to exporting instead of
re-deriving the mechanics: the two runnable parts, the scope/destination prompts to
ask **first**, the offline script pairs, and the step-by-step live flow you
orchestrate through the Figma MCP.

**Invocations use `ta-export`:** the app-provided CLI (`ta-export <brand|library|
reconstruct|figma> [args]`) that runs the app-owned export tooling against the
current project. The exporters are app IP and **do not ship inside a project**, so
`ta-export` replaces the old in-project `node scripts/export-*` / `npm run export:*`
calls; it auto-passes `--project-root` to the filesystem exporters. It's on PATH only
inside the desktop app, export is an app feature.

**Load the Figma skills as MCP RESOURCES, not via the `Skill` tool.** In this
setup `figma-use` + `figma-generate-library` are served by the Figma MCP server as
resources, **not** local Skill-tool skills, so `Skill(figma-use)` fails and costs a
round-trip. Read them **directly** with the MCP resource reader
(**`ReadMcpResourceTool`**) at **`skill://figma/figma-use/SKILL.md`** and
**`skill://figma/figma-generate-library/SKILL.md`** before any `use_figma`/builder
call. The export is **offline + MCP only, it never runs on Vercel.**

## Exporting to Figma, TWO parts, ask scope FIRST

The cohesive export runs as **two independently-runnable parts.** Splitting them is
what keeps each run short and iterable, the blocks are the slow, high-fidelity half;
the pages are cheap:

- **Part 1, Styleguide + Blocks:** the design-system objects **plus** the section
  blocks, `scaffold` → `variables` → `textstyles` → `specimen` → `components` (the
  design's shadcn components) → `blocks` (the reconstructed `[data-block]` section sets
  on the Block Library page). This is the expensive half (the block builder loop).
- **Part 2, {Pages|App} from blocks:** the STANDALONE `compose`, stacks block
  INSTANCES into each design Page, resolving each block's component **BY NAME** off the
  Block Library page (no in-memory ids needed). Cheap, idempotent, and re-runnable on
  its own whenever page order or a block master changes. **Requires Part 1 first:** the
  builder throws `Block Library page … not found, run Part 1` if the blocks aren't there.

When the user says "export to Figma" **without naming a scope, do NOT guess:** ask
first with **AskUserQuestion**. Use these prompts verbatim (adapt only `{Pages|App}`):

**Ask silently, no preamble.** Do the project-type check and any prep with **no
narration**: don't say "Let me check the project type" or "This is a website project,
so I'll ask…". Just call `AskUserQuestion` so only the dialog appears. Same for the
whole export run, announce milestones and results, not the routine tool calls between
them.

**Suggest `/clear` before Part 1.** Part 1 (the block-builder loop) is the single most
context-heavy op in the pipeline, each of its ~11 `use_figma` calls ferries a ~19–43K
payload through the conversation, so starting it on a long history inflates every turn and
risks a mid-run context summarization. So when the run **will include Part 1** (the
"Styleguide + Blocks" or "Both" scope, or a brand project) **and the conversation already
carries a long history**, open with a one-line nudge before asking P15, e.g. *"This is a
long, context-heavy run, consider `/clear` first for a cleaner, cheaper pass. Ready when
you are."* Keep it a nudge, not a blocker (the user may decline). **Skip it entirely for a
standalone Part-2 "Pages/App from blocks" compose:** that's one cheap call and needs no
clear. Don't otherwise touch the locked P15–P17 copy below.

**P15 · header "Export scope":** *"What would you like to send to Figma?"*
- **Styleguide + Blocks (Part 1)** → the Part-1 phases above; builds the Styleguide,
  Components, and Block Library pages. No page composition.
- **{Pages|App} from blocks (Part 2)** → the standalone `compose` only; assumes Part 1
  already built the blocks (errors if the Block Library page is missing, run Part 1
  first).
- **Both, Part 1 then Part 2** → run Part 1, then Part 2 back-to-back for the full
  cohesive one-file result (same file). Same total work as before; the value of the
  split is checkpointing + cheap Part-2 re-runs, not a shorter first pass.

(A raw **pixel snapshot** of pages, the old html.to.design page-CAPTURE via
`ta-export figma`, "Exporting designs to Figma" below,
is still available but is NOT what "Pages" means here; reach for it only when the user
explicitly wants flat screenshots instead of editable, variable-bound block instances.)

Use **"App"** for `projectType === "app"`, else **"Pages"**. Brand-guideline
projects (`projectType === "brand"`) have no design pages, run **Part 1 (Styleguide +
Blocks)** and skip the prompt. **If the request already names a scope** ("export the
styleguide", "send the pages", "just recompose the pages") skip the prompt and run that
path.

Two follow-ups, only when a **new** file will be created (skip both when reusing a
recorded file):

**P16 · header "Destination":** asked when `manifest.target` is unset,
*"Where should the new Figma file go?"*
- **My drafts (private to me)** → individual scope: the user's Full-seat plan, no
  `projectId`.
- **A team project (shared)** → a team `planKey` **+ a `projectId`** from a project
  URL. Offer only teams with an **editor seat** (filter `whoami`, exclude
  `seat_type` `view`/`developer`); without a project URL the file lands in that
  team's private drafts. Persist the choice via `--set-target` (see the live flow).

**P17 · header "Figma file":** asked only when `existingFile` IS recorded and the
user's intent is unclear, *"Update the existing Figma file, or start a new one?"*
- **Update it** (default) → reuse the recorded file (verify it still exists first).
- **Start a new file** → create + record a new one (then P16 if no destination set).

When a file is recorded, **default to Update it** (mention which file); only pop
P17 if intent is genuinely unclear.

## Exporting designs to Figma

When the user asks to export/send designs to Figma, capture each design page at
each active breakpoint via `ta-export figma`
(driven by the [pages.ts](../../src/app/pages.ts) manifest + `previewConfig.views`). The
script renders the isolated route `?v={id}&{route}&capture={view}`, a bare design
surface (no `ViewToggle`/bezel) via [DesignSurface](../../src/app/DesignSurface.tsx).

Prereqs: dev server running; Figma MCP connected. puppeteer is **not** a project
dependency, the export script auto-installs it locally (`npm i puppeteer
--no-save`) on first run, so it never enters `package.json` or the Vercel deploy.
**Keep it out of `package.json`:** it isn't in the committed `pnpm-lock.yaml`
(can't be regenerated without pnpm), so Vercel's `pnpm install` fails on the
unlisted deps; and `--no-optional` in the install command breaks the build by
stripping Rollup's native binary. Keeping puppeteer entirely out of the deploy is
what keeps Vercel green. Two modes:

- **Dry-run** (offline PNGs, no Figma): `ta-export figma` (`-v {id}`,
  `--pages a,b`, `--views desktop,mobile`). Use to preview.
- **Live send:** you orchestrate it (a plain `ta-export` run can't mint Figma capture
  IDs):
  1. Read the active views/pages from the script's manifest (or run dry-run).
  2. Get a target `fileKey` (`create_new_file`, or the user's Figma URL).
  3. For **each page × active breakpoint**, call `generate_figma_design(fileKey)`
     to mint a `captureId` + submit `endpoint`; write a JSON keyed `"{page}-{view}"`.
  4. `ta-export figma --captures captures.json`, the script submits each.
  5. Poll each `captureId` via `generate_figma_design(fileKey, captureId)` until
     `completed`.

**Performance, batch the MCP calls.** This page-capture path still uses
`generate_figma_design`; the mint (step 3) and poll (step 5) calls are
**independent**, so issue them **in parallel, all in one assistant message** (N
tool-use blocks), never one at a time. This cuts wall-clock and round-trips; it also
matters because each `generate_figma_design` response is large (~1.5k tokens), so
serial minting bloats context. The capture script itself is already fast, it groups
captures by page-load (one navigation per route×breakpoint) and returns on the actual
`/submit` POST rather than waiting on html.to.design's hanging promise. While
**iterating**, add `--fast` (primary breakpoint only); drop it for the final export.
(**Blocks no longer use this path at all:** the cohesive export reconstructs them
offline with no mint/poll; see "Exporting to Figma as ONE cohesive file".)

Captures are pixel-accurate frames, not linked component instances. Human-facing
usage is in [README.md](../../README.md) → "Exporting designs to Figma".

## Exporting to Figma as ONE cohesive file (pages + styleguide)

The full first-time export produces **one Figma file per variation** whose **Pages
panel** mirrors the project: a **Page per design page** (Home, About, …) holding
that page's per-breakpoint frames **composed from block instances**, a `———`
separator, a **Styleguide** Page (real color **variables**, **spacing + radius
number variables**, text **styles** whose font family is **bound to `Type` string
variables**, a **type-scale text-style ramp**, + a specimen), a **Components** Page (the shadcn components **this design actually uses**,
see the usage scan below, as component sets with variant properties), and a
**Block Library** Page (section blocks **reconstructed from the real page:** every
`[data-block]` section, at each breakpoint, as `View=…` component sets). Everything
is **real editable Figma nodes bound to variables:** the design pages, the blocks,
the atoms, and the tokens, woven into a single organized file. (No screenshots:
blocks are reconstructed from the DOM, and pages are stacks of block instances.)

**This is two runnable parts** (see P15): **Part 1 = Styleguide + Blocks** (the live
flow's steps 1–6: scaffold → variables → textstyles → specimen → components → blocks)
and **Part 2 = Pages from blocks** (step 7's `compose`). The "Both" scope just runs
1→2 back-to-back. Part 2 is **standalone**: it resolves each block's component **by
name** off the Block Library page, so it can run any time after Part 1 without re-doing
the expensive block builds, `ta-export reconstruct --emit-calls` writes a
ready-to-submit **`_compose-{pageId}.js`** per page (in `reconstruct-calls/{variation}/`,
listed in `_plan.json`'s `compose[]`) alongside the block calls.

Three script pairs (each an offline manifest + a `use_figma` builder body, same
pattern) drive the design-system half. Read the Figma skill **MCP resources**
(`skill://figma/figma-use/SKILL.md` + `…/figma-generate-library/SKILL.md` via
`ReadMcpResourceTool`, **not** `Skill(...)`, see top) before any builder call:

- **Brand tokens** → the Styleguide Page. `ta-export brand` +
  `figma-brand-library.plugin.js` (phases `scaffold`/`variables`/
  `textstyles`/`specimen`). Detailed below.
- **Components** → the Components Page. `ta-export library` +
  `figma-component-library.plugin.js` (PHASE `components`). **Usage-driven,
  not a default set:** the manifest step **statically scans the variation's design
  surface:** the [pages.ts](../../src/app/pages.ts) page components + the global
  Header/Footer, variation overrides resolved like
  [variationRegistry.ts](../../src/app/variationRegistry.ts), follows their local imports
  and collects every `components/ui/{name}` used, then builds **only the catalog
  specs the design actually imports**. (A `coverage` report rides along: `used`,
  `supported`, `unsupported`, used but no spec yet, warned + skipped, and
  `excluded`. `--all` skips the scan to emit the whole catalog.) Each spec maps a
  `ui/*.tsx` component to a variant-property set; fills bound to a **System**
  variable collection. Four `kind`s, dispatched by the manifest's `builder`:
  **atom** (Button/Badge/Toggle, single label/icon child), **field** (Input, a
  fixed-width field whose variants are interaction *states*), and **slotted**
  (Alert, Switch, Checkbox, Card, fixed multi-child structures). The builder also
  **prunes** any known-catalog set the design no longer uses, so re-exports leave
  nothing stale. Composite/behavioral components (navigation-menu, sidebar, dialog,
  table) need a richer model and are excluded. `ta-export library`
  (`-v {id}`, `--all`).
- **Blocks** → the Block Library Page. `ta-export reconstruct` +
  `figma-reconstruct-library.plugin.js` (PHASE `reconstruct`).
  **RECONSTRUCT, not capture, NO html.to.design, NO `generate_figma_design`
  mint/poll.** A designer marks a section with `data-block="{id}"` +
  `data-block-name="{Name}"` (Header/Footer too); the extractor walks each
  `[data-block]` at each breakpoint into a **deterministic build spec** of uniform
  ordered nodes (box / text / svg), reading layout (flex/grid), fills (solid /
  gradient / image, colors resolved to sRGB from oklab via canvas), text
  (font/size/weight/align/color), svg markup, and downloaded image assets, plus
  the brand palette + font roles read **live** from `:root` (`--ta-*` /
  `--ta-font-*`). The builder then makes **real Figma nodes**: flex → auto-layout,
  grid → wrap, block-flow + absolute overlays → absolute; text runs → real text
  (project family, else role proxy); svg → real vectors (recolored); gradients →
  `GRADIENT_LINEAR`; image fills → a placeholder rect whose `{ nodeId, asset }` it
  **returns** so Claude sets the photo via `upload_assets(nodeId)`. It **binds**
  each fill to the nearest **Brand** `--ta-*` variable (opacity-preserving) and
  **componentizes** each block into a `View=…` set. So the block LIST is the union
  of `[data-block]` markers (no `blocks.ts`); `ta-export reconstruct` builds
  the whole manifest (specs + palette + assets) offline in one pass. Add a block by
  marking a new `[data-block]` section, nothing else. (Interaction states like an
  open mobile menu aren't captured yet, default rendered state per breakpoint.)

  **Why reconstruct beats capture.** The old path screenshotted each section into
  Figma via html.to.design, which was both the slowest stage (serial mint → submit
  → poll per section, seconds–minutes each, plus doomed captures) and the least
  faithful (it dropped background-image photos, SVG icons, gradients, and
  alpha-tint fills, and choked on heavy sections like a big accordion). Reconstruct
  builds the exact same sections as real editable nodes from the DOM, faithful to
  photos/icons/gradients/emoji, no external service, no polling. Two gotchas the
  builder handles: a **childless semi-transparent SOLID overlay** (a `bg-ta-*/70`
  wash) must carry its alpha on **node** opacity, not paint opacity, paint opacity
  is stripped by `setBoundVariableForPaint` and by instancing; and `background`
  photos map to an image fill set post-build via `upload_assets`. A `cover`/center
  background maps to `FILL`; non-center `background-position` is a known refinement.

The brand-tokens pair in detail:

- **`ta-export brand`:** the
  deterministic, offline manifest. Reads a variation's `brand.ts` (names/roles, via
  esbuild transpile) + `tokens.css` (live `--ta-*` values), plus the shared
  [pages.ts](../../src/app/pages.ts) design-page list, and emits
  `figma-export/brand-{id}.json`: the **file structure** (design pages → separator →
  Styleguide → scaffold sections), colors (inferred **scopes** + `var(--ta-*)` code
  syntax), and type roles. Variation-aware/siloed like
  [brandRegistry.ts](../../src/app/brandRegistry.ts) (v00 → base; `vNN` → its own
  `styles/`, else base). Touches no Figma account. `ta-export brand`
  (`-v {id}`, `--print`).
- **`figma-brand-library.plugin.js`**,
 the Plugin API **builder**. NOT run by node; its body is embedded into a
  `use_figma` call (prepend `const MANIFEST = {…}; const PHASE = "…";`). **Idempotent**
  phases (find-by-name update, never duplicate): `scaffold` (the Pages panel;
  returns each design page's **Figma page id**) → `variables` → `textstyles` →
  `specimen` (built **on the Styleguide Page**). Read the `figma-use` +
  `figma-generate-library` **MCP resources** first (`ReadMcpResourceTool`, not
  `Skill(...)`, see top).

**Live flow** (you orchestrate, a plain `ta-export` run can't call the Figma MCP):
  1. `ta-export brand -v {id}` and read the manifest.
  2. **Target file, reuse the recorded one, else create + record** (one file per
     variation; no duplicate files):
     - **Read `existingFile` + `target` from the `export:brand` summary:** it prints
       them (`↻ Recorded Figma file…` / `✎ No file recorded`, and `⌂ New files go
       to…`). You already ran the generator, so don't re-parse the manifest; if you
       must, use `jq '{existingFile,target}' figma-export/brand-{id}.json` (`jq` is
       allowlisted), **never `node -e`** (the `;`/`require` trips a heuristic + prompt).
     - The manifest's **`existingFile`** is the Figma file this variation last
       exported to (from the git-ignored `figma-export/figma-files.json` registry).
       If present, **verify it still exists:** a quick `get_metadata` /
       `use_figma` read on that `fileKey`; on failure treat as missing, then
       **reuse it** (the builder updates it in place, no duplicate Pages).
     - Else, or if the user chose "start new": create at the **recorded
       destination** (`manifest.target`). **If no target is set, ask Individual vs
       Team first** (see destination resolution below), then
       `create_new_file({ fileName: "…{Variation}", planKey, projectId? })` and
       **record it** so the next export reuses it:
       `ta-export brand -v {id} --record --file-key {key} --file-url {url}
       --file-name {name}` (`--file-key` also accepts a full `/design/` URL).
       `--forget` drops the mapping.

  **Destination resolution** (where NEW files are created, project-wide, set once):
  `manifest.target` holds it. When unset, ask **Individual (personal drafts)** vs
  **Team (shared project)**:
    - Resolve candidate teams from the Figma **`whoami`**, **filtered to editor
      seats:** exclude `seat_type` `view` and `developer`; they can't author
      files, so never offer them. (A user may end up with exactly one eligible
      plan, that's fine.)
    - **Individual** → the user's Full-seat/personal `planKey`, no `projectId`.
    - **Team** → the chosen plan's `planKey` **+ a `projectId`** from a Figma
      project/folder URL the user provides. Without a URL the file lands in that
      team's **private drafts** (not shared), say so and let them decide.
    - Persist it: `ta-export brand --set-target --scope {individual|team}
      --plan {planKey} [--plan-name {name}] [--project {url}]` (`--forget-target`
      resets). Reused files (`existingFile`) keep their own home, destination
      only governs newly-created files.
     **Emit the phase payloads with the script, don't hand-assemble.** Run
     `ta-export brand -v {id} --emit-calls` and it writes
     `figma-export/brand-calls/{variation}/brand-{phase}.js` (MANIFEST + PHASE + builder body,
     ready to submit) + `_plan.json`. Submit those files as the `use_figma` `code`
     param, **never improvise a `node -e` to build the payloads** (unallowlistable
     arbitrary code; the script command is stable and allowlisted).
  3. Run **`scaffold`** → note the returned `anchors` (`{pageId}` per design page).
  4. Run **`variables`** → **`textstyles`** → **`specimen`** (sequential, never
     parallel), each embedding the brand `MANIFEST` + the matching `PHASE` + the
     brand builder body. This populates the **`Brand`** color collection everything
     binds to, the **`Spacing`** + **`Radius`** FLOAT (px) collections (`variables`
     phase), a **`Type`** collection of font-family string variables the role text
     styles bind their `fontFamily` to, and a **`Type Scale/{px}`** ramp of
     size-only text styles (`textstyles` phase). The `specimen` frame documents all
     of them, spacing bars bind their **width** and radius squares their **corner
     radius** to the FLOAT variables, so editing a token reflows the swatch.
  5. **Fill the Components Page (design's components):** `ta-export library -v {id}`,
     which scans the design surface and emits a manifest of **only the ui components
     this design uses** (check its `coverage` report, a warned `unsupported` entry
     means the design uses a ui atom with no spec yet). Then run the component builder
     (PHASE `components`) embedding that manifest + the `figma-component-library.plugin.js`
     body. It finds the "Components" Page by name (dropping the scaffold cover), builds
     the used component sets + a `System` variable collection, and prunes any stale
     catalog set. If the design uses no shadcn components the page is (correctly) left
     empty, pass `--all` to force the whole catalog instead.
  6. **Fill the Block Library Page (blocks), reconstruct from the real page:**
     a. `ta-export reconstruct -v {id}` → `figma-export/reconstruct-{id}.json`
        in one offline pass: for **every** `[data-block]` × active breakpoint, the
        full build spec (uniform ordered nodes), plus the brand palette + font roles
        (read live from `:root`), `pages` (per-page block ORDER for step 7),
        `views`/`widths`, and `assets` (image files downloaded to
        `figma-export/reconstruct-assets/`). No minting, no `generate_figma_design`,
        no polling, this is the whole discover+extract, done offline. (Iterate with
        `--fast` for the primary breakpoint, `--only {ids}` to re-extract some blocks.)
        Specs OMIT default-valued fields (≈40–50% smaller) so heavy blocks fit a call.
     b. **Add `--emit-calls`** and the script also writes **batched, ready-to-submit
        `use_figma` payloads** to `figma-export/reconstruct-calls/{variation}/`, assembled
        (spec + builder body) and **sized to the 50K `code` limit**, plus `_plan.json`.
        This is the robust way to run the builder: **size is known offline, so route
        without failed "try-then-discover-it's-too-big" attempts.** **Blocks are
        PACKED into batches**: as many as fit one call's limit go into a single
        `blocks-NN.js` (the builder iterates `MANIFEST.blocks`, building each block's
        `View=` set), so the export makes **far fewer sequential round-trips:** the
        dominant cost, and amortizes the fixed builder body. A block too big even
        alone → per-view `{blockId}-{view}.js` **temp** builds (`MANIFEST.temp` →
        standalone `__tmp:{blockId}:{view}` components, no combine, no cross-call
        deletion) **+** a shared `_combine.js` (PHASE `combine`) that merges the temps
        into the `View=` set (photos set on temp nodes survive the combine). Submit
        each `calls[].file` verbatim as the `code` param (with your fileKey), collect
        `photos[]` from each return, then submit `_combine.js`.

        **⚠ RE-READ each call file from disk immediately before submitting it,
        NEVER reuse a builder body you read earlier in this conversation.**
        `--emit-calls` REGENERATES these files from the current builder source, so
        on a **re-export** (e.g. after a fix to `figma-reconstruct-library.plugin.js`
        or a re-run of a single block) the freshly-written file carries the NEW
        body, while a body still cached in your context ships the OLD code and the
        build silently reverts. So the loop is always: read the `.js` file fresh →
        submit its exact contents as `code` → next file. One read per submit, every
        time, even if you "already saw" that file earlier in the session.

        **Every call file
        embeds a byte-identical builder body by construction, they differ ONLY in
        their leading `MANIFEST`/`PHASE` lines. Trust that; do NOT diff/md5 the files
        to "verify" it** (a wasted, prompt-triggering check, the `_plan.json` note
        states the same invariant).
        `_plan.json.oversized` flags any single view STILL over the limit even shrunk
        (needs a node-tree split, rare). Builder calls stay **sequential**; the
        `upload_assets` POSTs and per-page `compose` calls parallelize.

        **Inspecting the manifest/plan, use `--print`, NOT `node -e`/`python3 -c`.**
        `--print` and `--block` are **complete:** you never need to open, parse, or
        probe `reconstruct-{v}.json` yourself, and you don't need to know its internal
        schema (it's `{ variation, views, widths, blocks:[{blockId,name,page,route,
        views:{[view]:spec}}], pages, assets }`, but treat that as opaque). To see
        block structure, sizes, compose order, or **the full ordered list of call
        files to submit** (block calls → `_combine.js` → compose, with sizes), run
        `ta-export reconstruct --print`, so you never read
        `_plan.json` or `ls` the calls dir yourself. To diagnose **why a block is
        oversized** (node composition + per-kind weight + heaviest inline SVGs per
        view), run `… --block {id}`. Both are read-only (no capture, no dev server).
        `--emit-calls` **wipes stale payloads** in `reconstruct-calls/{variation}/`
        each run, so there are never orphaned temp files to hand-`rm`. **Never improvise
        `node -e`/`python3 -c` (or hand-read the raw JSON) to spelunk or schema-probe
        the manifest:** each unique snippet is a fresh permission prompt (and can't be
        safely allowlisted; multi-line ones with `#` even trip a security heuristic),
        whereas `--print` / `--block` / `jq` / `cat` are stable, read-only, and
        allowlisted. **Same for surveying the calls dir:** do NOT `cd` in and run a
        `for f in *.js; …` loop with `wc`/`head`/`du`/`stat` (a `cd &&`, a `for`, and a
        `$(…)` all defeat the `curl`/`jq`/`cat` allowlist and trip the
        `simple_expansion` heuristic → a prompt every run). The complete file inventory,
        every call file with its **byte size** and the **blockIds** it carries, plus the
        `combine`/`compose`/`oversized` breakdown, is already in `_plan.json`; read it
        with one allowlisted `jq`, e.g.
        `jq -r '.calls[] | "\(.file)  \(.bytes)B  [\(.blockIds // [.blockId] | join(", "))]"' figma-export/reconstruct-calls/{v}/_plan.json`,
        or just run `--print` (which formats the same ordered list with sizes).
        The builder **returns** `built[].componentId` per `blockId` **and** a
        `photos[]` list of `{ blockId, view, asset, nodeId }`, binding fills to the
        **`Brand`** collection (canonical `var(--ta-*)` from step 4).
     c. For **each** `photos[]` entry, `upload_assets(fileKey, count:1, nodeId,
        scaleMode:"FILL")` and POST the asset bytes from
        `figma-export/reconstruct-assets/{asset}` to the returned `submitUrl`. These
        uploads **can run in parallel**. This sets the real photos on the placeholder
        rects. **Prefer uploading each call's `photos[]` right after that call**, so
        there's nothing to accumulate.
        **POST form, one bare `curl` per asset, fired as parallel tool calls (NOT a
        shell loop).** Each POST must be a single command whose **first token is
        `curl`** so it matches the allowlisted `Bash(curl:*)` and never prompts:
        `curl -sS -o /dev/null -w "%{http_code}\n" -F "file=@ABS/PATH/asset.png;type=image/png" "SUBMIT_URL"`.
        Use an **absolute** `file=@` path so there's no `cd …&&` prefix (that makes the
        first token `cd`, breaking the match). **Never** wrap the POSTs in a
        `declare -a`/array + `for` loop with `& … wait`, the loop's first token isn't
        `curl` (so it can't be allowlisted) and `declare -a` trips a "changes assignment
        semantics" heuristic; both prompt every run. To parallelize, emit the N bare
        `curl` calls as N tool calls in one message, the harness runs them concurrently.
        If you DO persist the running `{asset,nodeId}` map across calls, write it with the
        **Write tool** to your scratchpad, **never a bash `cat <<'EOF'` heredoc** (the
        JSON braces trip an "expansion obfuscation" security heuristic and prompt every
        time).
  7. **Compose the design Pages from block INSTANCES, this is PART 2, runnable on its
     own** (top of the cascade variables → components → blocks → **pages**; REPLACES any
     raw page-capture). For **each** page in the discovery `pages`, assemble
     `MANIFEST.page = { id, name, route, blocks: [{ blockId, name }] }` + `views` +
     `widths` + `blockPageName`, and run the **`compose`** builder (PHASE `compose`, same
     `figma-reconstruct-library.plugin.js` body), **one call per page, fanned out in
     parallel** (each does a single `setCurrentPageAsync`). **Block resolution:** compose
     prefers an in-memory `componentId` (pass it from step 6b when running "Both"
     back-to-back), else resolves each block **by NAME** off the Block Library page
     (`figma.loadAllPagesAsync()` → find the set named `{block.name}`), so Part 2 needs
     nothing from Part 1's return and stands alone. Guard: no Block Library page ⇒ throws
     "run Part 1 first". The `--emit-calls` **`_compose-{pageId}.js`** files are exactly
     this call, ready to submit (blocks carry names, no ids). It stacks a block INSTANCE
     per section (right `View=` variant per breakpoint) onto that design's Figma Page, so
     the page is variable-bound and editing a block master cascades to every page.
     Designers never edit a Page except the copy inside a block.
  8. Screenshot the Styleguide, Components, Block Library, and composed design Pages
     to verify.

All builder calls stay **sequential, never parallel** (Figma state mutations must
serialize), except the per-page `compose` calls in step 7, which target different
Figma Pages and so fan out in parallel, and the `upload_assets` POSTs in step 6c.
The `components` phase is self-contained, safe to re-run after a `cva`/token change
(idempotent find-by-name). The `reconstruct` phase is idempotent per block name (it
removes + rebuilds each block's set and prunes stale ones); re-run
`ta-export reconstruct` (offline, cheap, no minting) whenever the page design
changes, then re-run the builder. `compose` is idempotent per page (it clears its
prior `{Page}, {View}` frames) and cheap to re-run after blocks change.

**Fonts:** the builder uses the project's real `--ta-font-*` family when Figma has
it, else a role-based **proxy** (Display→Playfair Display, Serif→Lora, Sans→Inter,
Mono→JetBrains Mono), an unbranded template ships `system-ui`/`Georgia`
placeholders that aren't Figma fonts. Proxies are labelled "(proxy)". **Colors are
single-mode** ("Value"), `tokens.css` defines only light `--ta-*` values; a
light/dark brand collection is a token-model change first. Like the page export,
this is **offline + MCP only, it never runs on Vercel.**
