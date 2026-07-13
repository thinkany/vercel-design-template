# Design Template

A reusable, brandable scaffold for building out site designs. Pull it from git
**unbranded**, open it with Claude, and configure it for your project in one step.

Built with React + Vite + Tailwind (originally a Figma Make export) and deployed
on Vercel, which auto-builds on every push to git.

## Getting started

**Prerequisite: Claude access.** This template is built and configured *with*
Claude Code, so you need a Claude plan that includes it — a subscription is the
simplest path (a heavier plan gives more headroom for sustained design work). See
[Claude pricing](https://www.anthropic.com/pricing). A developer API key also
works but is metered per use; most designers should just use a subscription.

**Prerequisite: Node.js.** If you don't already have it, download the **LTS**
version from [nodejs.org](https://nodejs.org) and run the installer (a
click-through `.pkg` on Mac / `.msi` on Windows — all defaults are fine). This is
a one-time setup. Running `/setup-project` in Claude Code checks for this and
walks you through it if it's missing.

```bash
npm install
npm run dev
```

The app runs at http://localhost:5173. Fresh from git it is intentionally
unbranded — the dashboard shows neutral placeholders (`Client Name : Project Name`)
until you configure it in the step below.

## First-time setup — branding the template

### With Claude (recommended)

**Easiest start:** open the project's folder in Claude Code and just say
**"Hello."** On a fresh, unbranded copy, Claude greets you and offers to walk you
through the initial setup automatically. (Claude waits for that first message
before it does anything — selecting the folder alone won't start it.)

Or run the setup command yourself at any time:

```
/setup-project
```

Claude prompts you for a **client name** and an optional **project name**, writes
them into `.env`, and the dev server reloads with your branding applied. You can
also pass them inline:

```
/setup-project ACME ltd | Case Studies
```

### By hand

Edit `.env` in the project root:

```
VITE_CLIENT_NAME="ACME ltd"
VITE_PROJECT_NAME="Case Studies"
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

## Vercel Instructions

The template deploys to Vercel and auto-builds on every push to git. Configuration
lives in **two different places** — set both for a fully branded, protected deploy.

### Connecting to Vercel (required)

A [Vercel](https://vercel.com) account is required — it's what turns this project
into a **live, shareable website** for client preview. The free "Hobby" tier is
enough. The easiest, recommended path is to sync through **GitHub** so every push
auto-deploys:

1. **Create a free Vercel account** at [vercel.com](https://vercel.com) — sign in
   with GitHub so the two are already linked.
2. **Push this project to a GitHub repository** (private is fine).
3. In Vercel, click **Add New → Project** and **import** that GitHub repo. Vercel
   reads `vercel.json` and configures the build automatically — just click
   **Deploy**.
4. You now get a **live URL** you can share. From here on, **every `git push`
   auto-deploys** a fresh build, and pull requests get their own preview URLs.

Then set the environment variables below so the deploy is branded and
password-protected before you share the link.

### App branding → committed `.env`

The dashboard, styleguide, and site pages read their brand from the committed
`.env` (`VITE_SITE_*`), baked into the bundle at build time. Set these with
`/setup-project` (see above) — they travel with the repo and deploy automatically.

### Login gate + secrets → Vercel Environment Variables

The password screen (`middleware.js`) runs on Vercel's **edge runtime**, which
**cannot** read `.env` / `VITE_*`. Set these in the Vercel dashboard under
**Project → Settings → Environment Variables** (plain names, **no `VITE_` prefix**):

| Variable | Purpose | Required? |
|---|---|---|
| `CLIENT_NAME` | Project name on the login screen (large wordmark) | Falls back to `Preview` if unset |
| `PROJECT_TITLE` | Appears next to the CLIENT_NAME or as a Small note under the CLIENT_NAME | Optional — hidden if unset |
| `ADMIN_PASS` | Admin password for the gate | **Required** |
| `AUTH_PASS` | Client password for the gate | **Required** |

- Without `ADMIN_PASS` / `AUTH_PASS` the site stays locked (fail-closed) — no one
  can get in until they're set.
- `SITE_NAME` / `SITE_SUBTITLE` are **separate** from the app's `VITE_SITE_*`. For a
  fully branded deploy, set the name in **both** places — `.env` for the app, the
  Vercel dashboard for the gate.
- A logo on the login screen can be added later via an optional `SITE_LOGO` var.
- After changing dashboard env vars, **redeploy** for them to take effect.

## Exporting designs to Figma

You can push your designs into Figma — **one frame per page × screen size**
(Desktop / Tablet / Mobile), captured as the design surface only (no preview
toolbar, no device bezel). Every design page is included automatically, and the
capture uses each breakpoint's real viewport width, so the layout you get in
Figma is the true responsive design, not a scaled-down thumbnail. Tablet is
included only if you enabled it during setup.

### With Claude (recommended)

Keep the dev server running (`npm run dev`) and just ask Claude — for example:

```
Export the current designs to Figma
```

Claude captures each design page at each active breakpoint and sends them into a
Figma file (it will create one for you, or you can paste a link to an existing
file). You can steer it — e.g. *"export variation v01"* or *"just the home page."*

This step runs **through Claude** by design: sending into Figma uses your
authenticated Figma connection, which lives with Claude rather than the local app.

**Prerequisites**

- **Figma connected in Claude.** The Figma integration (MCP) must be enabled and
  you must be signed in to Figma, so Claude can create/write the file.
- **A headless browser** — installed **automatically the first time you run an
  export** (a one-time download of a headless Chromium). It lives *outside* the
  project's dependencies, so it never installs on Vercel — the export is a purely
  local tool and never touches the client-facing deploy.

### Preview locally first (optional)

To see exactly what would be sent — as image files, without touching Figma —
generate them to disk:

```bash
npm run export:figma
```

This writes one PNG per page × breakpoint into `figma-export/` (git-ignored).
Handy flags (note the `--` before them):

```bash
npm run export:figma -- -v v01            # a specific variation (default: v00)
npm run export:figma -- --pages home      # limit to certain pages
```

### Notes

- The **dev server must be running** — that's what the export renders.
- Captures are **pixel-accurate frames**, not linked design-system components.
- Adding a new design page (see `CLAUDE.md`) makes it part of the export
  automatically — no extra wiring.

## Exporting to Figma as one cohesive file

The full export builds **one Figma file per variation**, organized just like the
project — so the pages *and* the styleguide live together:

```
Home            ← Page: your design, one frame per screen size
About           ← Page (once you add it)
———
Styleguide      ← Page: color variables + text styles + a specimen
Block Library   ← Page: scaffold (built out later)
Components      ← Page: scaffold (built out later)
```

Each **design page becomes its own Figma Page** (named for the page), and the
**Styleguide** is its own Page in the same file — real, editable Figma objects
(drop a color swatch from the variable picker, apply a text style to any layer),
not just screenshots, generated straight from your styleguide tokens.

### With Claude (recommended)

Just ask — for example:

```
Export to Figma
```

If you don't say what to export, Claude asks first — **Both Styleguide and
Pages/App**, **Styleguide only**, or **Pages/App only** — so you never have to
remember flags. (Naming it up front — *"export just the styleguide"* — skips the
question.) For the full export, Claude creates the Figma file, sets up the Pages
(Home / About / … + Styleguide + scaffold sections), captures each design page at
each screen size onto its Page, and builds the color variables, text styles, and
specimen on the Styleguide Page.
Re-running is safe — it **updates in place** instead of duplicating, so it's easy
to keep Figma in sync after a change. You can steer it — e.g. *"export variation
v01."*

### Preview the styleguide side first (optional)

To inspect what will be created — the file structure + tokens, without touching
Figma:

```bash
npm run export:brand              # variation v00
npm run export:brand -- -v v01    # a specific variation
npm run export:brand -- --print   # print the full manifest
```

### Notes

- Each **design page** becomes its own Figma **Page**; the **Styleguide** is its
  own Page in the same file. Re-running updates in place — no duplicate pages.
- **Claude remembers the Figma file per variation** (after the first export), so
  re-exporting updates that same file instead of creating a new one. Ask it to
  *"start a new file"* to override, or *"forget the Figma file for v01"* to reset.
- **Destination — your drafts or a team.** The first time you create a file,
  Claude asks whether to put new files in your **personal drafts** (Individual) or
  a **shared team project** (Team), and remembers the choice. Team options are
  limited to teams where your Figma seat can create files (an editor/Full seat —
  View/Dev seats are skipped). For a Team file that teammates can open, you give
  Claude a **project (folder) URL** once; without it, a team file stays in that
  team's private drafts. Change it anytime — *"export to my team's 2026 project."*
- **Colors** map to Figma variables with their role as the description and the
  CSS variable (`var(--ta-blue)`) as Dev-Mode code syntax.
- **Fonts:** if the project hasn't picked real typefaces yet (a fresh template
  ships system-font placeholders), the specimen uses clearly-labelled stand-in
  faces so you can still see the type scale. Once you've branded it, it uses your
  real fonts where Figma has them.
- Runs entirely offline + through Figma — it **never** affects the Vercel deploy.

## Good to know

- **`.env` is committed on purpose.** It holds only *public* brand config, so it
  travels with the repo and deploys automatically. Never put secrets in it — gate
  passwords and `SITE_*` go in Vercel's Environment Variables (see above) or a
  local, git-ignored `.env.local`.
- **Brand values are build-time.** The dev server reloads on `.env` changes, but
  a live deploy needs a rebuild to pick them up — Vercel does this automatically
  on each push.
- **Instructions for Claude live in `CLAUDE.md`,** kept separate from this
  human-facing README. That's where the project's conventions and working rules
  for the AI assistant are defined.

