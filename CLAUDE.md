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
