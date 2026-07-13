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

Captures are pixel-accurate frames, not linked component instances. Human-facing
usage is in [README.md](README.md) → "Exporting designs to Figma".

### Exporting to Figma as ONE cohesive file (pages + styleguide)

The full first-time export produces **one Figma file per variation** whose **Pages
panel** mirrors the project: a **Page per design page** (Home, About, …) holding
that page's per-breakpoint frames, a `———` separator, a **Styleguide** Page (real
color **variables** + text **styles** + a specimen), then scaffolded **Block
Library** / **Components** Pages (titled covers, built out later). This weaves the
two export paths — the design **page capture** (screenshots, above) and the
**brand library** (design-system objects) — into a single organized file.

Two pieces drive the brand/structure half:

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
  2. Get a `fileKey` (`create_new_file` "…{Variation}", or the user's `/design/` URL).
     **One file per variation.**
  3. Run **`scaffold`** → note the returned `anchors` (`{pageId}` per design page).
  4. **Fill the design Pages:** for each design page × active breakpoint, mint
     `generate_figma_design(fileKey, pageId)` with that page's anchor id so the
     frame lands on the **named Page** (not a new one), then run
     `npm run export:figma -- --captures …` and poll. Arrange the breakpoint frames
     on the page.
  5. Run **`variables`** → **`textstyles`** → **`specimen`** (sequential, never
     parallel), each embedding `MANIFEST` + the matching `PHASE` + the builder body.
  6. Screenshot the Styleguide frame + a scaffold cover to verify.

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

**Two token namespaces — keep them separate:**
- **`--ta-*` / `--ta-font-*`** = the **project** palette & type. Designer-owned;
  configured by `/setup-styleguide`. This is what designed pages consume.
- **`--admin-*`** = the **tooling** chrome (Dashboard, styleguide's own chrome,
  the preview gate). Fixed and intentional — **never touch `--admin-*`** during
  project branding.

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

- **`/setup-project`** — brand the scaffold: preflight `npm install`, write
  `VITE_*` names to `.env`, configure preview-gate fonts, point to Vercel setup.
- **`/setup-styleguide`** — Phase II: set project fonts/colors in `tokens.css` +
  `brand.ts`, adapt styleguide sections, flip `VITE_STYLEGUIDE_READY` /
  `VITE_BRAND_READY`.
