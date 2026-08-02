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
- **Don't narrate routine tool calls.** No "Let me check…", "I'll first…", "This
  is X, so I'll…" preamble before a tool call — just make the call. Speak only for
  milestones, findings, decisions, and blockers. (The `/design` skill's low-chatter
  protocol is the design-phase version of this rule.)

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

### Building a design (the post-setup design phase)

When a designer asks to **build, design, create, or edit a page/section/hero/
landing** (the freeform phase after `/setup-project` + `/setup-styleguide`),
**invoke [`/design`](.claude/commands/design.md) first.** It inlines the
authoring contract (the `<DesignSurface>` shape, the paste-ready page skeleton,
the five rules, the one live token read) so you go straight to designing instead
of re-deriving the rules from this file — and it sets the design-phase
**communication protocol**: suppress technical chatter, drive progress with a
TodoWrite list phrased in designer language (`Creating top navigation`,
`Building hero`, …), and give one plain-language line per milestone. **Every
design is a variation: design #1 edits the working variation's `Home.tsx` under
`src/variations/{id}/`, never the base.** Base v00 is the pristine template
blueprint — `/setup-styleguide` creates the working variation (`v01`) during
onboarding, or the dashboard's "Start designing" button does (see Variations
system). Keeping designs out of the base is what lets template upgrades refresh
the framework without clobbering the designer's work.

### Adding a page (beyond Home)

The scaffold ships three pages — Dashboard, Home, StyleGuide — and has no router.
A design is expressed as a **variation** (a full copy of Home + its styleguide),
not as a multi-page site, so extra pages (About, Pricing, …) are a deliberate
add. Design pages are driven by a **manifest**
([src/app/pages.ts](src/app/pages.ts)) — App.tsx routes/renders from it, and the
Figma export ([scripts/export-to-figma.mjs](scripts/export-to-figma.mjs))
enumerates it — so wiring a page is two steps. e.g. `About`:

1. **Build the component.** Create `About.tsx` **in the working variation**
   (`src/variations/{id}/components/About.tsx`) — the same place design #1 lives;
   never the base. **Model it on `Home.tsx`** — the canonical
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
`setPage`). `pages.ts` is a **global** manifest (one row wires the page for every
scope); the *component* resolves per-variation via `resolveComponent`, so the page
renders wherever a matching `About.tsx` exists (the working variation) and any other
variation can diverge its own by dropping an `About.tsx` into its
`components/` folder.

Same rules as everywhere: Tailwind utilities + `--ta-*` tokens, never hardcoded
hex/fonts, edit `src/variations/{id}/` (not the base) when working on a variation.

**Mark each section for the Block Library.** Put `data-block="{id}"` +
`data-block-name="{Name}"` on the root element of every major section you build
(hero, feature grid, CTA, …). That marker is the **only** declaration the Figma
**Block Library** export needs — it derives each block from the real rendered
section (binds its colors to `--ta-*` variables, componentizes per breakpoint). No
`blocks.ts`, no hand-built builders. Header/Footer carry markers too. See
[`/export-figma`](.claude/commands/export-figma.md) for the derive pipeline.
- **Put the marker on the element that owns the section's spacing & background —
  not an inner card.** A block's box is exactly the marked element, and composed
  pages stack blocks flush (the gap between two sections comes from their own
  `py-*`, since compose adds none). So if the section's vertical spacing or
  full-bleed background lives on a **wrapper** (`<Reveal className="… pb-24">`, a
  `bg-* w-full` ancestor) while the marker sits on an inner card, that
  spacing/background is **outside the block** and the section renders flush /
  bare in the export. Mark the outermost element that carries the `py-*`/`bg-*`
  (or, if a component wrapper like `Reveal` can't take the marker, wrap the card
  in a `<div data-block=…>` that holds the padding). Siblings that already mark
  the padded `<section>` are the pattern to match.

### Global elements (Header / Footer / Mobile Menu)

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
  export agree**. **Height is the same trap:** `vh`/`min-h-screen`/`100dvh` read
  the **window height**, so a "full-screen" section resizes as the *browser*
  resizes and diverges from the fixed device frame. For device-relative height use
  **`min-h-full`** — it keys off the frame (a definite-height ancestor), **not**
  the window, so a full-height section stays put as the browser resizes; **never**
  `vh`/`min-h-screen`/`100dvh` for in-frame content. The export captures each view
  at its **frame height** (phone 780 / tablet 900 — see `VIEWPORT_HEIGHTS` in the
  capture scripts) so height-relative content measures identically in preview and
  Figma. Portal-based overlays
  (shadcn `Sheet`/`Dialog`/`Drawer`) escape the frame to `document.body`; use
  inline positioning for in-frame menus.
- **Default mobile menu.** [MobileMenu.tsx](src/app/components/MobileMenu.tsx) is a
  slide-in drawer shipped **by default** (a designer never has to ask for one).
  DesignSurface renders it as an **in-frame overlay** (not a portal); the Header's
  hamburger toggles it through shared state in
  [mobileMenu.ts](src/app/mobileMenu.ts), and it slides from **`MENU_SIDE`** — the
  *same edge the hamburger sits on*, since that one constant positions both. It
  **exports as its own `mobile-menu` Block**: the drawer carries the
  `data-block` marker only while open, and the export tools do one extra
  `?menu=open` capture pass (DesignSurface forces the drawer open) to snapshot it —
  a standalone component, deliberately **not** added to any page's compose order.
  Diverge per variation by dropping `MobileMenu.tsx` into `src/variations/{id}/`.
- **Desktop nav menus.** Each nav item can reveal a **dropdown** or **mega** panel
  on hover, configured in [menu.ts](src/app/menu.ts) — a per-item manifest
  (`none` / `dropdown` / `mega`) **seeded from the setup `VITE_MENU_STYLE`** and
  edited/mixed per item there. Panels are in-frame overlays in the Header (mega
  spans the **content column** width), carrying `data-block="menu-{id}"` **only
  while open**. The export discovers menu-bearing items (they carry
  `data-menu-item`) and captures an item's open panel (`?menu=open&item={id}`) as
  its own **"Menu — {Item}" Block** after the Header. **By default only the FIRST
  menu-bearing item is built** — one representative panel — because building every
  item's panel is the slow part of a first export (each is a full load+settle, and
  mega panels are large). Ask for the rest with **`--menus all`** (or a specific one
  with **`--only menu-{id}`**). **Surface this in the export summary** — when the nav
  has more than one menu-bearing item, tell the designer how many exist and that only
  the first was built ("Built the Products mega menu; 3 more nav menus available — say
  the word for the rest"), so the trimmed default is a visible choice, not a silent
  omission. Menu open/active state is shared via
  [menuState.ts](src/app/menuState.ts) (same context as the mobile drawer).

### Exporting to Figma

When the user asks to **export, send, sync, or push** a design (or the styleguide,
components, blocks, or pages) **to Figma**, **invoke
[`/export-figma`](.claude/commands/export-figma.md) first** — don't re-derive the
pipeline from this file. It inlines the whole export contract: the two
independently-runnable parts (**Part 1** Styleguide + Blocks, **Part 2** Pages/App
from blocks), the locked **P15–P17** scope/destination/file prompts to ask **first**
(when the request doesn't already name a scope, ask with `AskUserQuestion` — don't
guess), the offline script pairs (`export-brand`/`export-library`/`export-reconstruct`
+ their `use_figma` builders), and the step-by-step live flow you orchestrate through
the Figma MCP. Before any `use_figma`/builder call, **read the `figma-use` +
`figma-generate-library` MCP resources** (`skill://figma/…/SKILL.md` via
`ReadMcpResourceTool`) — they're **MCP resources, not local Skill-tool skills**, so
`Skill(figma-use)` fails and just adds a round-trip. The whole export is **offline +
MCP only — it never runs on Vercel.**

### Troubleshooting visuals

When a designer reports a **visual symptom** — something **isn't showing, is cut
off, mispositioned, overlapping, hidden behind something, or looks wrong** in the
preview or the Figma export — **invoke
[`/diagnose`](.claude/commands/diagnose.md) first.** Don't ask them to open dev
tools and don't guess from the code alone. The reflex it enforces: **headlessly
screenshot the isolated capture route** (`/?v={id}&capture={view}`, plus
`&menu=open[&item={id}]` for menus) and **look at the image** — that's how you see
what the designer sees. It carries the symptom→cause→fix table for this scaffold's
gotchas (portal overlays escaping the device frame, container-query vs viewport
units, `overflow-hidden` clipping, off-screen/collapsed elements, and the
stacking-context rule behind most "hidden behind" bugs — fix the **ancestor's**
context, never pile `z-index` on the child).

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

[src/styles/brand.ts](src/styles/brand.ts) is the human-facing manifest the
styleguide renders — color groups + type roles, **plus the `spacing`, `radii`, and
`typeScale` scales** (the guide's Spacing/Radius/Type-Scale sections read these, so
they're single-source, not hardcoded in `StyleGuide.tsx`);
[tokens.css](src/styles/tokens.css) holds the values components actually consume.
`/setup-styleguide` writes **both** together so they never drift. The Figma
**foundations export** reads the same `brand.ts`: colors → COLOR variables, fonts →
text styles bound to `Type` family variables, **`spacing`/`radii` → FLOAT (px)
variables** (`Spacing`/`Radius` collections), and **`typeScale` → a `Type Scale/{px}`
text-style ramp**.

### Config & readiness flags

[src/config/site.ts](src/config/site.ts) reads `VITE_*` and exposes:
- `siteConfig` (client/company/project/tagline, with placeholder fallbacks while
  unbranded), `siteTitle`

**Styleguide/brand readiness is per-variation only** — there are no base-scope env
flags. Base v00 is the pristine template blueprint (never shows a setup banner);
each design variation carries its own `styleguideStatus` / `brandStatus` on its
record, cleared via the in-page buttons. The old `VITE_STYLEGUIDE_READY` /
`VITE_BRAND_READY` flags (and the `styleguideReady`/`brandReady` exports) are
retired.

### Preview gate

[middleware.js](middleware.js) is a **Vercel edge** password gate with its own
inline `<style>` (can't read the app's tokens). Fail-closed: locked until
`ADMIN_PASS`/`AUTH_PASS` are set in Vercel. Branding vars: `CLIENT_NAME` /
`PROJECT_TITLE` (plain names, no `VITE_`). **It does not run on the local dev
server** — the gate exists only on the Vercel deploy, so it can only be tested
there.

### Distribution & upgrades

Designers get the template as a **download** (no git link back), copy it into their
own repo, and connect that to their own Vercel. So pushing a new version is a
**file-overlay** problem — the designer's own `git diff` is the safety net.

- **Version marker (single source):** [public/version.json](public/version.json) is
  imported into the bundle (this copy's own version, [src/version.ts](src/version.ts))
  **and** served at `/version.json`. On the canonical deploy
  **create.thinkany.design** that served copy IS the latest (it builds from `main`).
  It's **gate-exempt** ([middleware.js](middleware.js) matcher) + CORS
  ([vercel.json](vercel.json)) so a designer's copy can read it cross-origin, and it
  carries `zipUrl`.
- **The pill** ([UpdateCheck.tsx](src/app/components/UpdateCheck.tsx)) is **admin +
  local-dev only** (`import.meta.env.DEV`): it compares bundled vs canonical and, when
  newer, opens a preview → confirm → apply flow. Upgrades are **local by nature** — a
  browser can't write project files, but the Vite dev server (Node) can.
- **The archive:** a build plugin ([vite.config.ts](vite.config.ts) `templateZipPlugin`)
  zips the git-tracked source into `dist/template-latest.zip` (gate-exempt + CORS) via
  the **zero-dep** [scripts/lib/zip.mjs](scripts/lib/zip.mjs) — no toolchain dep, no
  committed blob.
- **The engine:** [scripts/upgrade.mjs](scripts/upgrade.mjs) (pure Node) reads
  [upgrade.manifest.json](upgrade.manifest.json) and overlays by tier — **CORE**
  overwritten (default), **KEEP** never touched (`.env`, `src/variations/**`,
  `pages.ts`/`menu.ts`, base `tokens.css`/`brand.ts`, `public/images`), **REVIEW**
  written as a `*.upgrade-new` sidecar (`package.json`, `.claude/settings.json`). It
  refuses to write on a dirty tree unless forced.
- **One-click revert:** before writing, the engine snapshots every file it will
  overwrite into `.upgrade-backup/<ts>/` (gitignored) + a manifest. `runRevert()`
  restores them, deletes what the update added, and drops the backup — exposed via the
  dashboard **"Revert update"** button, **`/api/upgrade/revert`**, and
  `node scripts/upgrade.mjs --revert`. Works without git (covers forced/non-git
  applies) and survives a half-applied crash (backup written before any apply).
- **Two front doors, one engine:** the dashboard button → `/api/upgrade` (dev
  middleware) → the engine; and [`/upgrade`](.claude/commands/upgrade.md) → the same
  engine as a Claude command that walks the sidecars + git diff. **Option A is what
  makes the CORE/KEEP split clean** — the designer's work is siloed in
  `src/variations/**` (KEEP), so base chrome + `Home` are safely CORE.

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
- **Images are gathered non-browser, into `public/`.** Never open a headless
  browser or screenshot to source images (gated + inconsistent). Fetch over plain
  HTTP with one **bounded, non-interactive** attempt (`curl -fsS --max-time 8 -o
  public/images/…` — the scaffold allowlists `curl` so it never prompts) into
  `public/`; a same-origin file resolves in both the preview and the Figma export's
  asset-fetch (which **skips** slow/blocked/CORS'd external CDN URLs). On a
  slow/failed fetch, don't retry, prompt, or escalate — drop a network-free
  placeholder (`aspect-video bg-ta-border`), keep building, and **list the
  placeholders in the closing summary** so the designer can supply the real assets.
  See [`/design`](.claude/commands/design.md) §4b.
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
- **[`/setup-styleguide`](.claude/commands/setup-styleguide.md)** — Phase II:
  **create the working design variation** (`v01`) so the base stays pristine, then
  set the **client** fonts/colors in that variation's `tokens.css` + `brand.ts`,
  note the styleguide sections are adjustable, and close with the preview reminder +
  the optional permission-prompt tip. Readiness is the variation's own record
  markers (in-page buttons), not env flags.
- **[`/design`](.claude/commands/design.md)** — the post-setup **design phase**:
  the condensed authoring contract (`<DesignSurface>` shape + page skeleton + the
  five rules + one live token read) plus the low-chatter, TodoWrite-driven
  progress protocol. Invoke it when the designer asks to build/edit a page (see
  "Building a design" above). It also offers to start the dev server on the first
  build and re-points them at `/guide`.
- **[`/guide`](.claude/commands/guide.md)** — the user-facing **command list**:
  prints this project's commands (setup, design, guide) + how to run/stop the
  preview. Designers can type `/guide` at any time; it's introduced at the setup
  sign-off and re-offered by `/design`.
- **[`/upgrade`](.claude/commands/upgrade.md)** — apply the latest template version:
  the transparent front door to the overlay engine (dry-run → apply → walk sidecars +
  git diff). Same engine the dashboard's one-click Update button drives. See
  **Distribution & upgrades** above.
- **[`/export-figma`](.claude/commands/export-figma.md)** — the **Figma export
  phase**: the cohesive two-part pipeline (Part 1 Styleguide + Blocks, Part 2
  Pages/App from blocks), the offline script pairs + `use_figma` builders, and the
  live orchestration flow. It is the canonical source of the **P15–P17** export
  prompt copy (scope / destination / file). Invoke it when the user asks to
  export/send to Figma (see "Exporting to Figma" above). Triggered by natural
  language, not a typed slash command — so the pointer above is what routes to it.
