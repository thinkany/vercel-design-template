# CLAUDE.md

Working rules and architecture for this repo. Human-facing setup docs live in
[README.md](README.md) — keep the two in sync but don't duplicate; this file is
for the AI assistant.

## What this is

A **reusable, brandable design-template scaffold**. A designer pulls it
unbranded, brands it (`/setup-project`, `/setup-styleguide`), then builds page
designs as **variations** and shares a live, password-gated preview via Vercel.
Stack: **React 18 + Vite 6 + Tailwind 4**, originally a **Figma Make** export,
deployed on **Vercel** (auto-builds on every `git push`). No backend.

The workflow runs *through* Claude Code — designers use it to brand the template
and build designs — so a Claude plan that includes Claude Code is a prerequisite
(subscription is the simplest path; an API key also works but is metered).

## Hard constraints — read first

- **The local dev server is the live design surface.** The user runs
  `npm run dev` (http://localhost:5173) and keeps it running; Vite compiles and
  hot-reloads, so designs you build appear **in real time** as you edit. Assume
  it's running — build against it. **Vercel is just the hosting/sharing
  environment** (a live, gated URL for the client), not where design work is
  verified.
- **Package managers split on purpose:** npm locally, pnpm on Vercel. Vercel is
  pinned to pnpm (see [vercel.json](vercel.json)); the local `package-lock.json`
  is git-ignored and throwaway, while `pnpm-lock.yaml` is the committed source of
  truth Vercel builds from — don't delete it.
- **`.env` is committed** — it holds only *public* `VITE_*` brand config. **Never
  put secrets in it.** Gate passwords (`ADMIN_PASS`/`AUTH_PASS`) and the gate's
  `CLIENT_NAME`/`PROJECT_TITLE` live in Vercel's Environment Variables (edge
  runtime can't read `VITE_*`) or a git-ignored `.env.local`.
- **Figma Make artifacts:** the `react()` and `tailwindcss()` Vite plugins and
  the `figma:asset/` resolver in [vite.config.ts](vite.config.ts) are required by
  Make even where Tailwind looks unused — **do not remove them**.
- **No test suite / linter** configured. "Verify" means looking at the running
  dev server in the browser.

## Architecture

Entry: [index.html](index.html) → [src/main.tsx](src/main.tsx) →
[src/app/App.tsx](src/app/App.tsx).

**Routing is query-param based** (no router lib, despite `react-router` being a
dep). [App.tsx](src/app/App.tsx) reads `window.location.search`:
- `/` → **Dashboard** (variation gallery, landing)
- `/?v={id}` → the designed **Home** page for that variation
- `/?v={id}&styleguide` (or `/?styleguide`) → that variation's **StyleGuide**

### Variations system (core concept)

A "variation" is a full, independent copy of a design. **`v00` is the base**
(lives in `src/app/components` + `src/styles`). Each additional variation is a
complete copy under **`src/variations/{id}/`** (`components/` + `styles/`).

- **[variationRegistry.ts](src/app/variationRegistry.ts)** — `import.meta.glob`s
  every base + variation component eagerly; `resolveComponent(id, name)` returns
  the variation's component **falling back to base v00**. New variation folders
  are auto-discovered — no `App.tsx` edits needed.
- **[brandRegistry.ts](src/app/brandRegistry.ts)** — same pattern for the brand
  manifest; `resolveBrand(id)` returns **only** that scope's palette (siloing: a
  red variation and a blue one never cross).
- **Creation is dev-only:** the "Make Variation" flow POSTs to
  `/api/variation/create`, handled by a **dev-server Vite middleware** in
  [vite.config.ts](vite.config.ts) that copies the folders on disk. This does
  **not** run on Vercel's static deploy — variations are authored locally, then
  committed.
- **Variation records** persist in **localStorage** (`ta-variations-v2`), typed
  in [src/data/variations.ts](src/data/variations.ts). Base v00 is seeded from
  `INITIAL_VARIATIONS`.

### Adding a page (beyond Home)

The scaffold ships three pages — Dashboard, Home, StyleGuide — and has no router.
A design is expressed as a **variation** (a full copy of Home + its styleguide),
not as a multi-page site, so extra pages (About, Pricing, …) are a deliberate
add. Design pages are driven by a **manifest**
([src/app/pages.ts](src/app/pages.ts)) — App.tsx routes/renders from it, and the
Figma export ([scripts/export-to-figma.mjs](scripts/export-to-figma.mjs))
enumerates it — so wiring a page is two steps. e.g. `About`:

1. **Build the component.** Create `src/app/components/About.tsx` (base v00).
   **Model it on [Home.tsx](src/app/components/Home.tsx)** — the canonical
   design-surface pattern: a Tailwind-first content function, then wrap it in
   **[`<DesignSurface>`](src/app/DesignSurface.tsx)** (the shared responsive
   preview shell) and pass it the `onNavigate` prop. That wrapper is what gives
   the page the desktop/tablet/mobile preview, renders the shared Header/Footer
   (see **Global elements** below), **and** makes it exportable to Figma per
   breakpoint by default — do not hand-roll `ViewToggle`/`PhoneFrame` in the
   page. Do **not** model it on
   `Dashboard.tsx` / `StyleGuide.tsx` — those are `--admin-*` tooling chrome, not
   design surfaces.
2. **Register it in [pages.ts](src/app/pages.ts).** Add one row:
   `{ id: "about", route: "about", name: "About", component: "About" }`. That
   single line wires **routing** (`?v={id}&about`), **rendering** (App resolves +
   renders it via `resolveComponent`), and **Figma export** (captured
   automatically at every active breakpoint). No `App.tsx` edit needed.

Navigate to it from any page via `onNavigate("about")` (the `onNavigate` prop is
`setPage`). **Variations inherit it for free** via `resolveComponent`'s fallback
to base v00; to diverge a variation's version, drop `About.tsx` into
`src/variations/{id}/components/`.

Same rules as everywhere: Tailwind utilities + `--ta-*` tokens, never hardcoded
hex/fonts, edit `src/variations/{id}/` (not the base) when working on a variation.

**Mark each section for the Block Library.** Put `data-block="{id}"` +
`data-block-name="{Name}"` on the root element of every major section you build
(hero, feature grid, CTA, …). That marker is the **only** declaration the Figma
**Block Library** export needs — it derives each block from the real rendered
section (binds its colors to `--ta-*` variables, componentizes per breakpoint). No
`blocks.ts`, no hand-built builders. Header/Footer carry markers too. See
"Exporting to Figma as ONE cohesive file" for the derive pipeline.

### Global elements (Header / Footer)

Shared site chrome lives in **[Header.tsx](src/app/components/Header.tsx)** +
**[Footer.tsx](src/app/components/Footer.tsx)** and is rendered **once, globally,
by [DesignSurface](src/app/DesignSurface.tsx)** — not per page. So a menu/footer
edit made in that one component cascades to **every design page, every
breakpoint, and every variation** (a variation diverges by dropping its own
`Header.tsx`/`Footer.tsx` into `src/variations/{id}/components/`, resolved via
`resolveComponent`). The nav is single-source too: both files map the
[pages.ts](src/app/pages.ts) manifest, so adding a page auto-adds its nav link.

- **Website projects only.** `DesignSurface` gates chrome on
  `projectType === "website"`; `app` and `brand` projects render **no** website
  Header/Footer (apps carry their own in-screen nav). A single page can opt out
  with `chrome={false}` (e.g. a full-bleed landing).
- **Responsive via container queries, NOT viewport.** The device frames
  ([PhoneFrame](src/app/components/PhoneFrame.tsx)/`TabletFrame`) render page
  content in a **fixed-width box inside your real browser window**, so Tailwind's
  viewport utilities (`md:`/`lg:`) and `vw`/`vh` units read the **window, not the
  frame** — a `md:` hamburger would wrongly show desktop nav inside the phone
  preview. `DesignSurface` marks the design surface **`@container`**, so use
  **container-query variants (`@sm:`/`@lg:` …) and `cqw`/`cqi` units** for
  responsive design: they key off the frame width in the live preview *and* the
  viewport width the export tool sets per breakpoint, so **preview and Figma
  export agree**. Portal-based overlays (shadcn `Sheet`/`Dialog`/`Drawer`) escape
  the frame to `document.body`; use inline positioning for in-frame menus.

### Exporting to Figma — ask which scope FIRST

Two export surfaces (both detailed below): the **design Pages/App** (frame
captures) and the **Styleguide** (design-system objects). When the user says
"export to Figma" **without naming a scope, do NOT guess** — ask first with
**AskUserQuestion**. The three export prompts are **locked copy — use them
verbatim** (adapt only the `{Pages|App}` label):

**P15 · header "Export scope"** — *"What would you like to send to Figma?"*
- **Both Styleguide and {Pages|App}** → the cohesive one-file flow ("Exporting to
  Figma as ONE cohesive file" below): `scaffold` → capture Pages onto their Figma
  Pages → `variables` → `textstyles` → `specimen` → `components` (the design's
  shadcn components) → `blocks` (section blocks).
- **Styleguide only** → the design-system phases only, no page captures (`scaffold`
  for the panel if needed → `variables` → `textstyles` → `specimen` → `components`
  → `blocks`). "Styleguide" is the whole brand library here — tokens **plus** the
  Components + Block Library pages.
- **{Pages|App} only** → the page-capture flow only ("Exporting designs to Figma"
  below); skip the design-system phases (variables/styles/specimen/components/blocks).

Use **"App"** for `projectType === "app"`, else **"Pages"**. Brand-guideline
projects (`projectType === "brand"`) have no design pages — run **Styleguide only**
and skip the prompt. **If the request already names a scope** ("export the
styleguide", "send the pages") skip the prompt and run that path.

Two follow-ups, only when a **new** file will be created (skip both when reusing a
recorded file):

**P16 · header "Destination"** — asked when `manifest.target` is unset —
*"Where should the new Figma file go?"*
- **My drafts (private to me)** → individual scope: the user's Full-seat plan, no
  `projectId`.
- **A team project (shared)** → a team `planKey` **+ a `projectId`** from a project
  URL. Offer only teams with an **editor seat** (filter `whoami`, exclude
  `seat_type` `view`/`developer`); without a project URL the file lands in that
  team's private drafts. Persist the choice via `--set-target` (see the live flow).

**P17 · header "Figma file"** — asked only when `existingFile` IS recorded and the
user's intent is unclear — *"Update the existing Figma file, or start a new one?"*
- **Update it** (default) → reuse the recorded file (verify it still exists first).
- **Start a new file** → create + record a new one (then P16 if no destination set).

When a file is recorded, **default to Update it** (mention which file); only pop
P17 if intent is genuinely unclear.

### Exporting designs to Figma

When the user asks to export/send designs to Figma, capture each design page at
each active breakpoint via [scripts/export-to-figma.mjs](scripts/export-to-figma.mjs)
(driven by the [pages.ts](src/app/pages.ts) manifest + `previewConfig.views`). The
script renders the isolated route `?v={id}&{route}&capture={view}` — a bare design
surface (no `ViewToggle`/bezel) via [DesignSurface](src/app/DesignSurface.tsx).

Prereqs: dev server running; Figma MCP connected. puppeteer is **not** a project
dependency — the export script auto-installs it locally (`npm i puppeteer
--no-save`) on first run, so it never enters `package.json` or the Vercel deploy.
**Keep it out of `package.json`:** it isn't in the committed `pnpm-lock.yaml`
(can't be regenerated without pnpm), so Vercel's `pnpm install` fails on the
unlisted deps; and `--no-optional` in the install command breaks the build by
stripping Rollup's native binary. Keeping puppeteer entirely out of the deploy is
what keeps Vercel green. Two modes:

- **Dry-run** (offline PNGs, no Figma): `npm run export:figma` (`-- -v {id}`,
  `-- --pages a,b`, `-- --views desktop,mobile`). Use to preview.
- **Live send** — you orchestrate it (a plain `npm run` can't mint Figma capture
  IDs):
  1. Read the active views/pages from the script's manifest (or run dry-run).
  2. Get a target `fileKey` (`create_new_file`, or the user's Figma URL).
  3. For **each page × active breakpoint**, call `generate_figma_design(fileKey)`
     to mint a `captureId` + submit `endpoint`; write a JSON keyed `"{page}-{view}"`.
  4. `npm run export:figma -- --captures captures.json` — the script submits each.
  5. Poll each `captureId` via `generate_figma_design(fileKey, captureId)` until
     `completed`.

**Performance — batch the MCP calls (applies to blocks too).** The mint (step 3)
and poll (step 5) `generate_figma_design` calls are **independent**, so issue them
**in parallel — all in one assistant message** (N tool-use blocks), never one at a
time. This cuts wall-clock and round-trips; it also matters because each
`generate_figma_design` response is large (~1.5k tokens), so serial minting bloats
context. The capture script itself is already fast — it groups captures by page-load
(one navigation per route×breakpoint) and returns on the actual `/submit` POST rather
than waiting on html.to.design's hanging promise. While **iterating** on a design, add
`--fast` (primary breakpoint only) and, for blocks, `--only {blockIds}` (re-derive just
the sections you changed); drop both for the final full export.

Captures are pixel-accurate frames, not linked component instances. Human-facing
usage is in [README.md](README.md) → "Exporting designs to Figma".

### Exporting to Figma as ONE cohesive file (pages + styleguide)

The full first-time export produces **one Figma file per variation** whose **Pages
panel** mirrors the project: a **Page per design page** (Home, About, …) holding
that page's per-breakpoint frames, a `———` separator, a **Styleguide** Page (real
color **variables** + text **styles** + a specimen), a **Components** Page (the
shadcn components **this design actually uses** — see the usage scan below — as
component sets with variant properties), and a **Block Library** Page (section blocks **derived from the
real page** — every `[data-block]` section, at each breakpoint, as `View=…`
component sets). This weaves the design **page capture** (screenshots, above) and
the **design-system objects** (tokens, atoms, blocks — all editable, all bound to
Figma variables) into a single organized file.

Three script pairs (each an offline manifest + a `use_figma` builder body, same
pattern) drive the design-system half. Load the `figma-use` +
`figma-generate-library` skills before any builder call:

- **Brand tokens** → the Styleguide Page. `scripts/export-brand-to-figma.mjs` +
  `scripts/figma-brand-library.plugin.js` (phases `scaffold`/`variables`/
  `textstyles`/`specimen`). Detailed below.
- **Components** → the Components Page. `scripts/export-library-to-figma.mjs` +
  `scripts/figma-component-library.plugin.js` (PHASE `components`). **Usage-driven,
  not a default set:** the manifest step **statically scans the variation's design
  surface** — the [pages.ts](src/app/pages.ts) page components + the global
  Header/Footer, variation overrides resolved like
  [variationRegistry.ts](src/app/variationRegistry.ts) — follows their local imports
  and collects every `components/ui/{name}` used, then builds **only the catalog
  specs the design actually imports**. (A `coverage` report rides along: `used`,
  `supported`, `unsupported` — used but no spec yet, warned + skipped — and
  `excluded`. `--all` skips the scan to emit the whole catalog.) Each spec maps a
  `ui/*.tsx` component to a variant-property set; fills bound to a **System**
  variable collection. Four `kind`s, dispatched by the manifest's `builder`:
  **atom** (Button/Badge/Toggle — single label/icon child), **field** (Input — a
  fixed-width field whose variants are interaction *states*), and **slotted**
  (Alert, Switch, Checkbox, Card — fixed multi-child structures). The builder also
  **prunes** any known-catalog set the design no longer uses, so re-exports leave
  nothing stale. Composite/behavioral components (navigation-menu, sidebar, dialog,
  table) need a richer model and are excluded. `npm run export:library`
  (`-- -v {id}`, `-- --all`).
- **Blocks** → the Block Library Page. `scripts/export-blocks-to-figma.mjs` +
  `scripts/figma-block-library.plugin.js` (PHASE `blocks`). **DERIVE-EVERYTHING:
  blocks are not declared or hand-built — each is derived from the real page.** A
  designer marks a section with `data-block="{id}"` + `data-block-name="{Name}"`
  (Header/Footer are marked too); the capture driver
  (`export-to-figma.mjs --blocks`) discovers those markers live and screenshots
  each `[data-block]` at each breakpoint into Figma as an editable
  html.to.design layer tree; the builder POST-PASS then **binds** each captured
  fill to the nearest **Brand** `--ta-*` variable, **normalizes** fonts Figma lacks
  to the project face/role proxy, **flattens** html.to.design's passthrough wrapper
  frames, **repairs layout** from DOM hints (see next paragraph), and
  **componentizes** each block into a `View=…` set. So the block LIST is
  the union of `[data-block]` markers (no `blocks.ts`); the offline manifest only
  supplies the brand palette + font roles. `npm run export:blocks` builds that
  manifest. Add a block by marking a new `[data-block]` section — nothing else.
  (Interaction states like an open mobile menu aren't auto-captured yet — default
  rendered state per breakpoint.)

  **Layout repair (html.to.design fidelity).** html.to.design's DOM→auto-layout
  conversion drops two things the builder can't otherwise recover: it bakes each
  section's rendered pixel height as a **FIXED** frame height (so a content-sized
  section pins its content to the top with a void below, and self-stretch columns
  collapse — e.g. an `object-cover` fill image), and it defaults centered content
  (`mx-auto` / `text-center`) to **left**. So the **discover** step
  (`export-to-figma.mjs` `extractLayoutHints`) reads the real intent from each
  section's live DOM into a per-block `layout` hint — a root-level `hugHeight` flag
  (skipped for sections that deliberately reserve height, e.g. a `min-h-screen`
  hero) and a `textAlign` list keyed by the text's own content (links/buttons and
  horizontal-row items filtered out to avoid nav false-positives). That hint rides
  along into each `captures[]` entry, and the builder's `repairLayout` pass applies
  it: hugs the root height, and re-centers matched TEXT nodes + their constrained
  (`mx-auto`) wrapper ancestors **without** disturbing left-aligned siblings like
  card captions.

The brand-tokens pair in detail:

- **[scripts/export-brand-to-figma.mjs](scripts/export-brand-to-figma.mjs)** — the
  deterministic, offline manifest. Reads a variation's `brand.ts` (names/roles, via
  esbuild transpile) + `tokens.css` (live `--ta-*` values), plus the shared
  [pages.ts](src/app/pages.ts) design-page list, and emits
  `figma-export/brand-{id}.json`: the **file structure** (design pages → separator →
  Styleguide → scaffold sections), colors (inferred **scopes** + `var(--ta-*)` code
  syntax), and type roles. Variation-aware/siloed like
  [brandRegistry.ts](src/app/brandRegistry.ts) (v00 → base; `vNN` → its own
  `styles/`, else base). Touches no Figma account. `npm run export:brand`
  (`-- -v {id}`, `-- --print`).
- **[scripts/figma-brand-library.plugin.js](scripts/figma-brand-library.plugin.js)**
  — the Plugin API **builder**. NOT run by node; its body is embedded into a
  `use_figma` call (prepend `const MANIFEST = {…}; const PHASE = "…";`). **Idempotent**
  phases (find-by-name update, never duplicate): `scaffold` (the Pages panel;
  returns each design page's **Figma page id**) → `variables` → `textstyles` →
  `specimen` (built **on the Styleguide Page**). Load the `figma-use` +
  `figma-generate-library` skills first.

**Live flow** (you orchestrate — a plain `npm run` can't call the Figma MCP):
  1. `npm run export:brand -- -v {id}` and read the manifest.
  2. **Target file — reuse the recorded one, else create + record** (one file per
     variation; no duplicate files):
     - The manifest's **`existingFile`** is the Figma file this variation last
       exported to (from the git-ignored `figma-export/figma-files.json` registry).
       If present, **verify it still exists** — a quick `get_metadata` /
       `use_figma` read on that `fileKey`; on failure treat as missing — then
       **reuse it** (the builder updates it in place, no duplicate Pages).
     - Else, or if the user chose "start new": create at the **recorded
       destination** (`manifest.target`). **If no target is set, ask Individual vs
       Team first** (see destination resolution below), then
       `create_new_file({ fileName: "…{Variation}", planKey, projectId? })` and
       **record it** so the next export reuses it:
       `npm run export:brand -- -v {id} --record --file-key {key} --file-url {url}
       --file-name {name}` (`--file-key` also accepts a full `/design/` URL).
       `--forget` drops the mapping.

  **Destination resolution** (where NEW files are created — project-wide, set once):
  `manifest.target` holds it. When unset, ask **Individual (personal drafts)** vs
  **Team (shared project)**:
    - Resolve candidate teams from the Figma **`whoami`**, **filtered to editor
      seats** — exclude `seat_type` `view` and `developer`; they can't author
      files, so never offer them. (A user may end up with exactly one eligible
      plan — that's fine.)
    - **Individual** → the user's Full-seat/personal `planKey`, no `projectId`.
    - **Team** → the chosen plan's `planKey` **+ a `projectId`** from a Figma
      project/folder URL the user provides. Without a URL the file lands in that
      team's **private drafts** (not shared) — say so and let them decide.
    - Persist it: `npm run export:brand -- --set-target --scope {individual|team}
      --plan {planKey} [--plan-name {name}] [--project {url}]` (`--forget-target`
      resets). Reused files (`existingFile`) keep their own home — destination
      only governs newly-created files.
  3. Run **`scaffold`** → note the returned `anchors` (`{pageId}` per design page).
  4. Run **`variables`** → **`textstyles`** → **`specimen`** (sequential, never
     parallel), each embedding the brand `MANIFEST` + the matching `PHASE` + the
     brand builder body. This populates the **`Brand`** collection everything binds to.
  5. **Fill the Components Page (design's components):** `npm run export:library -- -v {id}`,
     which scans the design surface and emits a manifest of **only the ui components
     this design uses** (check its `coverage` report — a warned `unsupported` entry
     means the design uses a ui atom with no spec yet). Then run the component builder
     (PHASE `components`) embedding that manifest + the `figma-component-library.plugin.js`
     body. It finds the "Components" Page by name (dropping the scaffold cover), builds
     the used component sets + a `System` variable collection, and prunes any stale
     catalog set. If the design uses no shadcn components the page is (correctly) left
     empty — pass `--all` to force the whole catalog instead.
  6. **Fill the Block Library Page (blocks) — derive from the real page:**
     a. `npm run export:blocks -- -v {id}` → the offline brand manifest
        (palette + font roles; `captures: []`).
     b. `node scripts/export-to-figma.mjs --blocks --discover -v {id}` → live JSON
        `{ blocks, pages, views, widths }`: `blocks` = each unique section to capture
        once (each carries a `layout` hint — `hugHeight` + `textAlign` — read from
        its live DOM; see "Layout repair" above); `pages` = per-page block ORDER
        (used to compose in step 7); `views`/`widths`.
     c. For **each unique block × active breakpoint**, mint
        `generate_figma_design(fileKey)` and write a `captures.json` keyed
        `"{blockId}-{view}"` → `{ captureId, endpoint, route, blockId, view }`.
     d. `node scripts/export-to-figma.mjs --blocks --captures captures.json -v {id}`
        submits each via html.to.design `figmaselector`; **poll** each captureId
        until `completed` and record its resulting **node id** into the manifest's
        `captures[]` (`{ blockId, name, view, nodeId, layout }` — carry the block's
        `layout` hint from step b so `repairLayout` can apply it).
     e. Run the block builder (PHASE `blocks`) embedding that filled manifest + the
        `figma-block-library.plugin.js` body. The POST-PASS binds/normalizes/flattens/
        componentizes each capture onto "Block Library" and **returns
        `built[].componentId` per `blockId`**. It binds to the **`Brand`** collection —
        because step 4's `variables` phase already populated it, the builder binds to
        those canonical `var(--ta-*)` variables (matched by code syntax) rather than
        duplicating; standalone it creates its own.
  7. **Compose the design Pages from block INSTANCES** (top of the cascade
     variables → components → blocks → **pages**; this REPLACES any raw page-capture).
     For **each** page in the discovery `pages`, assemble
     `MANIFEST.page = { id, name, route, blocks: [{ blockId, name, componentId }] }`
     (componentId from step 6e) + `views` + `widths`, and run the **`compose`**
     builder (PHASE `compose`, same plugin body) — **one call per page, fanned out in
     parallel** (each does a single `setCurrentPageAsync`). It stacks a block INSTANCE
     per section (right `View=` variant per breakpoint) onto that design's Figma Page,
     so the page is variable-bound and editing a block master cascades to every page.
     Designers never edit a Page except the copy inside a block.
  8. Screenshot the Styleguide, Components, Block Library, and composed design Pages
     to verify.

All builder calls stay **sequential, never parallel** (Figma state mutations must
serialize) — except the per-page `compose` calls in step 7, which target different
Figma Pages and so fan out in parallel. The `components` phase is self-contained —
safe to re-run after a `cva`/token change (idempotent find-by-name). The `blocks`
phase is idempotent per block name too, but a re-run needs **fresh captures** (a
capture id is single-use), so re-derive from step 6b when the page design changes.
`compose` is idempotent per page (it clears its prior `{Page} — {View}` frames) and
cheap to re-run after blocks change — no capture needed.

**Fonts:** the builder uses the project's real `--ta-font-*` family when Figma has
it, else a role-based **proxy** (Display→Playfair Display, Serif→Lora, Sans→Inter,
Mono→JetBrains Mono) — an unbranded template ships `system-ui`/`Georgia`
placeholders that aren't Figma fonts. Proxies are labelled "(proxy)". **Colors are
single-mode** ("Value") — `tokens.css` defines only light `--ta-*` values; a
light/dark brand collection is a token-model change first. Like the page export,
this is **offline + MCP only — it never runs on Vercel.**

### Styling & tokens

CSS entry [src/styles/index.css](src/styles/index.css) imports, in order:
`fonts.css → tailwind.css → tokens.css → theme.css → globals.css`.
Per-variation `tokens.css` is lazy-loaded *after* base tokens so `:root` values
win (a variation can diverge its own fonts/colors).

**Three token namespaces — keep them separate:**
- **`--ta-*` / `--ta-font-*`** = the **project** palette & type. Designer-owned;
  configured by `/setup-styleguide`. This is what designed pages consume.
- **`--admin-*`** = the **tooling** chrome (Dashboard, styleguide's own chrome,
  the preview gate). Its **color** tokens are fixed and intentional — **never
  touch the `--admin-*` colors** during project branding. **One exception:** the
  two type roles **`--admin-font-heading`** / **`--admin-font-body`** are the
  *company / agency* fonts for the admin experience — **`/setup-project`**'s font
  step sets them (heading = wordmark, body = secondary), alongside the gate's
  inline fonts, so the login gate + Styleguide + dashboard chrome share one
  typographic identity. `/setup-styleguide` still never touches `--admin-*` — it
  owns the *client* design fonts (`--ta-font-*`).
- **shadcn primitives** (`--primary`, `--secondary`, `--destructive`,
  `--foreground`, …) = the namespace the 40 **`ui/*.tsx`** components read. They
  ship at stock shadcn defaults, so shadcn components render **off-brand** (and the
  Figma **Components** export faithfully mirrors that) until bridged. **`/setup-styleguide`
  step 1c** bridges the brand-carrying ones to `--ta-*` via `var()` **references**
  (single-source, `:root`/light only) — so branding cascades to shadcn components
  in the live app *and* the export. The component exporter
  ([export-library-to-figma.mjs](scripts/export-library-to-figma.mjs)) follows one
  level of `var()` indirection to resolve the real color; the block exporter binds
  `--ta-*` directly and is unaffected. Leave `--destructive`, surfaces, and
  `--chart-*`/`--sidebar-*` stock unless the brand deliberately maps them.

[src/styles/brand.ts](src/styles/brand.ts) is the human-facing manifest
(names/roles/order) the styleguide renders; [tokens.css](src/styles/tokens.css)
holds the values components actually consume. `/setup-styleguide` writes **both**
together so they never drift.

### Config & readiness flags

[src/config/site.ts](src/config/site.ts) reads `VITE_*` and exposes:
- `siteConfig` (client/company/project/tagline, with placeholder fallbacks while
  unbranded), `siteTitle`
- `styleguideReady` ← `VITE_STYLEGUIDE_READY` (base scope)
- `brandReady` ← `VITE_BRAND_READY` (base scope)

Variations ignore the env flags and carry their own `styleguideStatus` /
`brandStatus` fields on their variation record instead.

### Preview gate

[middleware.js](middleware.js) is a **Vercel edge** password gate with its own
inline `<style>` (can't read the app's tokens). Fail-closed: locked until
`ADMIN_PASS`/`AUTH_PASS` are set in Vercel. Branding vars: `CLIENT_NAME` /
`PROJECT_TITLE` (plain names, no `VITE_`). **It does not run on the local dev
server** — the gate exists only on the Vercel deploy, so it can only be tested
there.

## Reuse what's already here — don't rebuild

Before hand-rolling UI, use the resources already installed:

- **shadcn/ui — 40 components in
  [src/app/components/ui/](src/app/components/ui/)** (Radix-based: `button`,
  `dialog`, `card`, `tabs`, `accordion`, `select`, `dropdown-menu`, `form`,
  `table`, `sheet`, `drawer`, `tooltip`, `sidebar`, `carousel`, `chart`, etc.).
  Reach for these first. Customize via `theme.css` / token variables — don't fork
  a component file unless unavoidable. Compose classNames with the **`cn()`**
  helper in [ui/utils.ts](src/app/components/ui/utils.ts).
- **Icons:** `lucide-react`. **Charts:** `recharts` (via the `chart` ui wrapper).
  **Animation:** `motion`. **Carousels:** `embla-carousel-react`. **Forms:**
  `react-hook-form` (via the `form` ui component). **Toasts:** `sonner`.
  **Command palette:** `cmdk`. **Dates:** `date-fns` + `react-day-picker`.
  **Theme switching:** `next-themes`.
- Full dependency list is in [package.json](package.json) — check it before
  adding anything new.

## Conventions

- **Content is single-source — never fork it by breakpoint.** A design page's
  copy and images are authored **once**. `DesignSurface` renders that one content
  node inside each device frame (desktop/tablet/mobile); the breakpoints differ
  only in the viewport/frame *around* it, not the content itself. So a copy or
  image change made in one place **cascades to every device automatically** — you
  never edit "the mobile version" separately. Make breakpoints differ only
  through responsive *styling* (Tailwind `sm:`/`md:`/`lg:` variants, `clamp()`),
  **never by branching content on `view`** (e.g.
  `view === "mobile" ? <copyA/> : <copyB/>`) or duplicating text/images per
  device. The same applies to shared globals (Header/Footer): they live in one
  component consumed by every page — edit that component, not each page.
- **Tailwind-first.** Build components and elements with Tailwind utility
  classes. Apply the active variation's design values — the fonts, colors, and
  structures defined in its styleguide (`--ta-*` / `--ta-font-*` tokens, exposed
  as `text-ta-*` / `bg-ta-*` / `font-ta-*` utilities). If the styleguide hasn't
  defined those yet, still build with Tailwind utilities — only fall back to
  inline `style={{}}` as a last resort.
- **Never hardcode hex colors or font stacks** — use the `--ta-*` / `--ta-font-*`
  tokens (or their Tailwind utilities), never raw values.
- **Dark mode** via `.dark` on `<html>` and `dark:` variants — not manual media
  queries.
- **`@` alias → `src/`** ([vite.config.ts](vite.config.ts)).
- Components are `.tsx`; capitalized function exports are treated as components by
  the registry (lowercase/data exports are skipped).
- Editing a variation? Change files under `src/variations/{id}/`, **not** the
  base, or you'll alter every variation that falls back to base.

## Setup commands (skills)

The onboarding prompt **copy is authored and locked in these two command files** —
they are the canonical source of the P1–P14 wording (question text, headers,
options). **Do NOT duplicate that copy into this file; edit it there.**
`/setup-project` **hands off directly into `/setup-styleguide`**, so the two run as
one continuous flow.

- **[`/setup-project`](.claude/commands/setup-project.md)** — brand the scaffold:
  preflight `npm install` (checks Node ≥ 20.19), write `VITE_*` names to `.env`,
  choose project type, set the **company / admin** fonts (gate + `--admin-font-*`),
  point to Vercel setup, then hand off to →
- **[`/setup-styleguide`](.claude/commands/setup-styleguide.md)** — Phase II: set
  the **client** fonts/colors in `tokens.css` + `brand.ts`, note the styleguide
  sections are adjustable, flip `VITE_STYLEGUIDE_READY` / `VITE_BRAND_READY`, and
  close with the preview reminder + the optional permission-prompt tip.

(The **export** prompts P15–P17 have no command file — their locked copy lives in
"Exporting to Figma — ask which scope FIRST" above.)
