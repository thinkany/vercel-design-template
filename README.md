# Design Template

A reusable, brandable scaffold for building out site designs. Pull it from git
**unbranded**, open it with Claude, and configure it for your project in one step.

Built with React + Vite + Tailwind (originally a Figma Make export) and deployed
on Vercel, which auto-builds on every push to git.

## Getting started

```bash
npm install
npm run dev
```

The app runs at http://localhost:5173. Fresh from git it is intentionally
unbranded — the dashboard shows neutral placeholders (`Project Name : Subtitle`)
until you configure it in the step below.

## First-time setup — branding the template

### With Claude (recommended)

Open this project in Claude Code and run:

```
/setup-project
```

Claude prompts you for a **site name** and an optional **subtitle**, writes them
into `.env`, and the dev server reloads with your branding applied. You can also
pass them inline:

```
/setup-project Acme Studio | Case Studies
```

### By hand

Edit `.env` in the project root:

```
VITE_SITE_NAME="Acme Studio"
VITE_SITE_SUBTITLE="Case Studies"
VITE_SITE_TAGLINE="Design work, start to finish"
```

Then restart the dev server if it doesn't reload on its own.

## Phase II — configure the styleguide

Before designing any real pages, configure the **styleguide** (viewable at
`/?styleguide`) for your project. It's the living reference every later design
decision is checked against, so it comes first.

Run:

```
/setup-styleguide
```

Claude walks you through it: set your **fonts & colors** in the design-token file
(`src/styles/tokens.css`, with font imports in `fonts.css`), then adapt the
styleguide's generic example sections to your project. The styleguide reads the
live token values, so its Colors/Type sections reflect your edits immediately.
When the foundation reflects your project, set `VITE_STYLEGUIDE_READY=true` in
`.env` to clear the setup banner shown on the styleguide page.

Until that flag is set, the styleguide displays a reminder that it hasn't been
configured yet.

**Per-variation styleguides.** Every design variation you create from the
dashboard gets its own copy of the styleguide as a starting point. When creating
one, you're asked whether it needs its own styleguide changes — if so, that
variation's styleguide (`/?v={id}&styleguide`) shows a review reminder with a
*Mark as updated* button until you've adapted it. The base styleguide and each
variation are managed independently.

## Good to know

- **`.env` is committed on purpose.** It holds only *public* brand config, so it
  travels with the repo and deploys automatically. Never put secrets in it — the
  preview-gate passwords (`ADMIN_PASS` / `AUTH_PASS`) belong in Vercel's
  environment variables or a local, git-ignored `.env.local`.
- **Brand values are build-time.** The dev server reloads on `.env` changes, but
  a live deploy needs a rebuild to pick them up — Vercel does this automatically
  on each push.
- **The preview gate is branded separately.** The password screen lives in
  `middleware.js` and runs on Vercel's edge runtime, which *cannot* read `.env` /
  `VITE_*`. To brand it, add plain **`SITE_NAME`** and **`SITE_SUBTITLE`** vars in
  your Vercel project's Environment Variables (next to `ADMIN_PASS` / `AUTH_PASS`).
  Unset, it falls back to "Preview". A logo can be added later via a `SITE_LOGO`
  var.
- **Instructions for Claude live in `CLAUDE.md`,** kept separate from this
  human-facing README. That's where the project's conventions and working rules
  for the AI assistant are defined.
```

