# CLAUDE.md

The AI-assistant contract for this repo: durable constraints + a map to the
on-demand **skills** that carry each phase's "how." Human-facing setup docs live in
[README.md](README.md); keep the two in sync. **Don't re-explain here what a skill
already owns** (that duplication is paid on every call), point to it.

## What this is

A **reusable, brandable design-template scaffold.** A designer pulls it unbranded,
brands it (`/setup-project`, `/setup-styleguide`), then builds page designs as
**variations** and shares a live, password-gated preview via Vercel. Stack:
**React 18 + Vite 6 + Tailwind 4**, a **Figma Make** export, deployed on **Vercel**
(auto-builds on every `git push`). No backend. The whole workflow runs *through*
Claude Code.

## Hard constraints, read first

- **The local dev server is the live design surface.** The user runs `npm run dev`
  (http://localhost:5173) and keeps it running; Vite hot-reloads, so designs appear
  in real time as you edit. Build against it. **Vercel is just hosting/sharing** (a
  gated URL for the client), not where design work is verified.
- **No test suite / linter.** "Verify" = look at the running dev server in the browser.
- **Package managers split on purpose:** npm locally, pnpm on Vercel (pinned in
  [vercel.json](vercel.json)). `package-lock.json` is git-ignored + throwaway;
  `pnpm-lock.yaml` is the committed source of truth, don't delete it.
- **`.env` is committed:** it holds only *public* `VITE_*` brand config. **Never put
  secrets in it.** Gate passwords (`ADMIN_PASS`/`AUTH_PASS`) + the gate's
  `CLIENT_NAME`/`PROJECT_TITLE` live in Vercel env vars (edge runtime can't read
  `VITE_*`) or a git-ignored `.env.local`.
- **Figma Make artifacts:** the `react()`/`tailwindcss()` Vite plugins + the
  `figma:asset/` resolver in [vite.config.ts](vite.config.ts) are required by Make
  even where they look unused, **do not remove them.**
- **Node ≥ 20.19** (`.nvmrc` pins 22); the shell's default node may be older, `nvm use`.
- **Don't narrate routine tool calls.** No "Let me check…", "I'll first…" preamble,
  just make the call. Speak for milestones, findings, decisions, blockers. (The
  `/design` low-chatter protocol is the design-phase version of this.)
- **No em-dashes in anything a person reads** (design copy, chat replies, setup
  wording, labels, summaries, and these docs). Use a comma, a colon, parentheses, or
  two sentences. The em-dash reads as an AI tell; keep the product's voice human.

## Architecture

Entry: [index.html](index.html) → [src/main.tsx](src/main.tsx) →
[src/app/App.tsx](src/app/App.tsx). **Routing is query-param based** (no router lib):
App reads `window.location.search`, `/` → **Dashboard**, `/?v={id}` → that
variation's **Home**, `/?v={id}&styleguide` → its **StyleGuide**.

### Variations system (core concept)

A "variation" is a full, independent copy of a design. **`v00` is the base**
(`src/app/components` + `src/styles`); each additional variation is a complete copy
under **`src/variations/{id}/`** (`components/` + `styles/`).

- **[variationRegistry.ts](src/app/variationRegistry.ts):** eagerly globs every base +
  variation component; `resolveComponent(id, name)` returns the variation's component,
  **falling back to base v00**. New variation folders auto-discover, no `App.tsx` edits.
- **[brandRegistry.ts](src/app/brandRegistry.ts):** same pattern for the brand manifest;
  `resolveBrand(id)` returns **only** that scope's palette (a red variation and a blue
  one never cross).
- **Creation is dev-only:** the "Make Variation" flow POSTs to `/api/variation/create`, a
  Vite dev-middleware ([vite.config.ts](vite.config.ts)) that copies folders on disk. It
  does **not** run on Vercel's static deploy, variations are authored locally, then committed.
- **Records** persist in localStorage (`ta-variations-v2`), typed in
  [src/data/variations.ts](src/data/variations.ts); base v00 seeded from `INITIAL_VARIATIONS`.
- **Editing a variation? Change files under `src/variations/{id}/`, never the base**, or you
  alter every variation that falls back to v00. Design work is siloed here on purpose, it's
  what lets upgrades refresh the framework (CORE) without clobbering the designer's work.

**Readiness is per-variation:** each variation record carries its own
`styleguideStatus`/`brandStatus` (cleared via in-page buttons); base v00 is the pristine
blueprint and never shows a setup banner. The old `VITE_STYLEGUIDE_READY`/`VITE_BRAND_READY`
flags are retired.

### Styling & tokens

CSS entry [src/styles/index.css](src/styles/index.css) imports in order:
`fonts.css → tailwind.css → tokens.css → theme.css → globals.css`. Per-variation
`tokens.css` lazy-loads *after* base so `:root` values win (a variation diverges its own
fonts/colors).

**Three token namespaces, keep them separate:**
- **`--ta-*` / `--ta-font-*`** = the **project** palette & type (designer-owned, set by
  `/setup-styleguide`). Designed pages consume these, exposed as `text-ta-*`/`bg-ta-*`/
  `font-ta-*` utilities. **Never hardcode a hex or font stack**, always the token/utility.
- **`--admin-*`** = the **tooling** chrome (Dashboard, styleguide chrome, preview gate).
  Colors are fixed, **never touch `--admin-*` colors** during branding. One exception: the
  two type roles `--admin-font-heading`/`--admin-font-body` are the *agency* fonts, set by the
  **Company Profile** panel (not `/setup-project`).
- **shadcn primitives** (`--primary`, `--secondary`, `--foreground`, …) = the namespace the
  40 `ui/*.tsx` components read. They ship at stock defaults (so shadcn renders off-brand)
  until `/setup-styleguide` step 1c bridges the brand-carrying ones to `--ta-*` via `var()`
  references (the component exporter follows one level of `var()`; leave `--destructive`,
  surfaces, `--chart-*`/`--sidebar-*` stock unless the brand maps them).

[src/styles/brand.ts](src/styles/brand.ts) is the human-facing manifest the styleguide
renders (color groups, type roles, **plus the `spacing`/`radii`/`typeScale` scales**);
[tokens.css](src/styles/tokens.css) holds the values components consume. `/setup-styleguide`
writes both together so they never drift; the Figma foundations export reads the same `brand.ts`.

### Global chrome (Header / Footer / menus)

Shared site chrome lives in [Header.tsx](src/app/components/Header.tsx) +
[Footer.tsx](src/app/components/Footer.tsx) and is rendered **once, globally, by
[DesignSurface](src/app/DesignSurface.tsx)**, not per page, so one edit cascades to every
page, breakpoint, and variation (a variation diverges by dropping its own
`Header.tsx`/`Footer.tsx` into `src/variations/{id}/components/`). Both map the
[pages.ts](src/app/pages.ts) manifest, so adding a page auto-adds its nav link. DesignSurface
gates chrome on `projectType === "website"` (app/brand projects render none). **The
design-phase how (default mobile menu, dropdown/mega config via `menu.ts`, the
container-query-not-viewport trap, portal-escape) is in
[`/design`](.claude/commands/design.md); menu/mobile-menu Figma export is in
[`/export-figma`](.claude/commands/export-figma.md).**

### Config & readiness

[src/config/site.ts](src/config/site.ts) reads `VITE_*` → `siteConfig`
(client/company/project/tagline, with placeholder fallbacks while unbranded) + `siteTitle`.

### Preview gate

[middleware.js](middleware.js) is a **Vercel edge** password gate (its own inline `<style>`,
can't read app tokens). Fail-closed: locked until `ADMIN_PASS`/`AUTH_PASS` are set in Vercel;
branding via `CLIENT_NAME`/`PROJECT_TITLE`. **Does not run on local dev**, testable only on
the Vercel deploy.

### Distribution & upgrades

Designers get the template as a **download** (no git link back) and overlay new versions;
their own `git diff` is the safety net. [public/version.json](public/version.json) is the
single version marker (bundled as [src/version.ts](src/version.ts) + served at `/version.json`,
gate-exempt + CORS so a designer's copy reads it cross-origin; carries `zipUrl`). The **update
pill** ([UpdateCheck.tsx](src/app/components/UpdateCheck.tsx)) is admin+local-dev only. The
overlay engine ([scripts/upgrade.mjs](scripts/upgrade.mjs) +
[upgrade.manifest.json](upgrade.manifest.json)) tiers files: **CORE** overwritten, **KEEP**
never touched (`.env`, `src/variations/**`, `pages.ts`/`menu.ts`, base `tokens.css`/`brand.ts`,
`public/images`), **REVIEW** written as a `*.upgrade-new` sidecar; it snapshots a
one-click-revert backup before writing and refuses a dirty tree unless forced. Two front doors,
one engine: the dashboard button (`/api/upgrade`) and [`/upgrade`](.claude/commands/upgrade.md).
The CORE/KEEP split is clean **because** the designer's work is siloed in `src/variations/**`.

### Site build (after design approval)

A second build target lives beside the design surface: `site/` (Astro, `npm run
site:build`) renders **blocks** + **content** to static HTML, importing the pinned
variation's fonts/tokens/globals (`content/site.json` → `design`). The design surface
is untouched by it; the site is built FROM the design, never the other way.

- `site/blocks/*.tsx` (KEEP): one block per section, `defineBlock({ name, props: zod,
  component })`, registered by key in `site/blocks/index.ts`; header/footer in
  `site/blocks/chrome.ts` (named exports, the header hydrates, everything else is static).
- `content/site.json` (KEEP): pinned design, public URL, nav. `content/pages/*.json`: a
  page = ordered `{ type, props }` block instances + SEO fields. `content/posts/*.md`: the
  blog. `content/types.json`: designer-defined content types (products, landing pages) as
  DATA: key, label, path, fields, and a template of blocks whose string props bind entry
  fields with `{{field}}`; entries are `content/<key>/*.json`, rendered by the generic
  routes in `site/src/pages/[type]/`. The app's Pages panel edits all of this; a type can
  also be written by hand. `content/collections.ts` stays for code-defined collections.
- `site/src/**` (CORE): layout, routes, block validation, sitemap/robots/llms.txt. Don't
  edit it in a project; it upgrades with the template.

Block props are the CONTENT (headings, copy, images, card lists); markup is the DESIGN
(classes verbatim, `@lg:`/`cqi` included, the site wraps pages in the same `@container`).
Invalid content fails `site:build` naming the page, block and field. `/promote-blocks` is
the only way a design becomes blocks; `/design` keeps editing the design itself.

### Company profile

The **agency layer**, the things the same for every project a designer does (company name
`VITE_COMPANY_NAME`, admin/gate fonts, login logo), can be saved once and reused. It's owned by
the app's **Company Profile** panel: the app auto-applies the saved default profile when it
creates a project, and the panel creates/edits it (this is the layer `/setup-project` used to set,
now moved out of it). [scripts/company-profile.mjs](scripts/company-profile.mjs) (zero-dep) `pack`s
it into one portable, base64-embedded `company-profile.json` and `unpack`s it onto a fresh copy
(deterministic anchored substitution, skipping + reporting anything that doesn't match, never
clobbering). Front doors: [`/export-company`](.claude/commands/export-company.md) /
[`/import-company`](.claude/commands/import-company.md), plus the Company Profile panel's own
import/export. **Not** the per-client design (`VITE_CLIENT_NAME`, project name/type, `--ta-*`,
`brand.ts`, menus), which `/setup-project` + `/setup-styleguide` still set.

## Reuse what's already here, don't rebuild

Before hand-rolling UI, use what's installed:
- **shadcn/ui, 40 components** in [src/app/components/ui/](src/app/components/ui/) (button,
  dialog, card, tabs, accordion, select, dropdown-menu, form, table, sheet, drawer, tooltip,
  sidebar, carousel, chart, …). Customize via `theme.css`/tokens, don't fork a component unless
  unavoidable. Compose classNames with **`cn()`** ([ui/utils.ts](src/app/components/ui/utils.ts)).
- **Icons** `lucide-react`, **charts** `recharts` (via the `chart` wrapper), **animation**
  `motion`, **carousels** `embla-carousel-react`, **forms** `react-hook-form`, **toasts**
  `sonner`, **command palette** `cmdk`, **dates** `date-fns` + `react-day-picker`, **theme**
  `next-themes`.
- Full list in [package.json](package.json); check it before adding anything new.

## Conventions

- **`@` alias → `src/`** ([vite.config.ts](vite.config.ts)).
- **Admin/chrome copy is keyed, not inline.** Framework UI strings (Dashboard, VariationCard,
  MakeVariationModal, …) live in [src/copy/en.ts](src/copy/en.ts) and render via
  `import { copy } from "@/copy"` (`copy.area.item`, parameterized entries are functions). Add or
  reword there, never hardcode a label in a component. **Designer page content stays inline** in the
  variation components (it's their design, not framework copy). Locale files are added later beside
  `en.ts`; `index.ts` picks one. (Shell/gate/skill copy are separate catalogs, same convention.)
- Components are `.tsx`; capitalized function exports are treated as components by the registry
  (lowercase/data exports are skipped).
- **Content is single-source, never fork it by breakpoint.** Author copy/images once;
  DesignSurface renders that one node in each device frame. Breakpoints differ only through
  responsive *styling* (`sm:`/`md:` variants, `clamp()`), **never branch content on `view`**
  (`view === "mobile" ? … : …`) or duplicate text/images per device. Same for shared globals:
  edit the one component, not each page.
- **Dark mode** via `.dark` on `<html>` + `dark:` variants, not manual media queries.
- **Images** are gathered non-browser into `public/` (or held with
  [ImagePlaceholder](src/app/components/ImagePlaceholder.tsx) when `TA_DESIGN_IMAGES=placeholder`);
  the full flow (bounded `curl`, `credits.json` licence tracking, placeholder fallback + report)
  is in [`/design`](.claude/commands/design.md) §4b. **Never** open a headless browser to source
  images (gated + inconsistent).

## The skills, when each takes over

The onboarding prompt copy (P1–P17 wording: question text, headers, options) is **authored and
locked in these command files, not here**; edit it there, don't duplicate it into this file.
Invoke the skill the moment its phase begins, don't re-derive its rules from this file.
Some skills are **licensed**: their command file in this project is a stub, and the thinkany
design app supplies the playbook for the turn. If a command's content says so, it wasn't
loaded (no app, or no Design license); say that to the designer and stop.

- **[`/setup-project`](.claude/commands/setup-project.md)** → set the **client/project details**
  in `.env` (client name, project type, tablet, project name, menu style), then hands off directly
  into →. Scope is client-only: the app scaffolds + runs the preview (no preflight) and the
  **Company Profile panel** owns the agency identity (name, admin/gate fonts, logo), so this
  command no longer touches Node/npm or the company block.
- **[`/setup-styleguide`](.claude/commands/setup-styleguide.md)** → Phase II: create the working
  variation (`v01`, so base stays pristine), set the client fonts/colors in its
  `tokens.css` + `brand.ts`.
- **[`/design`](.claude/commands/design.md)** → the post-setup **design phase**: the authoring
  contract (`<DesignSurface>` shape, page skeleton, adding a page, the five rules, global-chrome
  how, the one live token read) + the low-chatter, TodoWrite-driven progress protocol. **Invoke
  it whenever a designer asks to build/design/create/lay out/edit a page/section/hero/landing.**
  Every design is a variation, design #1 edits the working variation's `Home.tsx`, never the base.
  **Carve-out: a single point-to-comment element edit is NOT a `/design` trigger.** A scoped tweak
  (the "Design feedback, pointed at an element" prompts, which carry a `Scope:` line) is a direct
  Read→Edit in the variation's component, don't load `/design` for it. Escalate to `/design` only
  when the scope is a whole section, a new section/page, a layout/responsive rework, or a change
  spanning multiple sections (the prompt's `Scope: section` hint, or the note asks for it).
- **[`/promote-blocks`](.claude/commands/promote-blocks.md)** → the design is **approved**
  and the designer wants the **site**: each section of the approved variation becomes a block
  in `site/blocks/` with a props schema, its copy/images move into `content/`, the
  header/footer become `site/blocks/chrome.ts`, then `npm run site:build` proves it. Invoke on
  "approved / final / start the site build / turn this into a site / promote to blocks".
  Carries the design→site translation table (motion → data-reveal, onNavigate → hrefs, menu
  state → local state, frame heights → 100dvh). Once promoted, page copy is edited as content,
  not by `/design`.
- **[`/diagnose`](.claude/commands/diagnose.md)** → a **reported visual bug** (something not
  showing, cut off, mispositioned, overlapping, hidden behind another element). Headlessly
  screenshot the `?capture=` route and look; carries the symptom→cause→fix table for this
  scaffold's gotchas. **Only for a reported symptom, not a self-verify reflex during a build.**
- **[`/export-figma`](.claude/commands/export-figma.md)** → export/send/sync a design (or
  styleguide/blocks/pages) to **Figma**: the two-part pipeline (Styleguide + Blocks, then
  Pages/App), the locked P15–P17 scope/destination prompts, the offline script pairs + `use_figma`
  builders. Natural language triggers it (there's no typed slash command). Offline + MCP only,
  never on Vercel.
- **[`/upgrade`](.claude/commands/upgrade.md)** → apply the latest template version (overlay CORE,
  keep the designer's work, walk the sidecars + git diff). Same engine as the dashboard button.
- **[`/export-company`](.claude/commands/export-company.md)** /
  **[`/import-company`](.claude/commands/import-company.md)** → save & reuse the agency layer
  across fresh copies (also available in the app's Company Profile panel).
- **[`/guide`](.claude/commands/guide.md)** → print this project's command list (setup, design,
  guide, preview controls) for the designer; introduced at setup sign-off, re-offered by `/design`.
