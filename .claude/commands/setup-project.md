---
description: Brand this template — set the client/project name in .env and the preview-gate fonts
argument-hint: "[client name] | [project name]  (optional; you'll be prompted if omitted)"
---

You are branding this scaffold for a specific project. The public brand values
live in the committed `.env` at the project root as `VITE_COMPANY_NAME`,
`VITE_CLIENT_NAME`, and `VITE_PROJECT_NAME`. They are
consumed through `src/config/site.ts` and drive the dashboard header wordmark,
the title lockup, the styleguide masthead, and the browser tab title.

**Make this interactive.** Wherever a step says "ask" or "prompt," use the
`AskUserQuestion` tool rather than plain conversational text — it renders
clickable options plus an "Other → type your own" field and works the same in
the IDE and Claude Desktop. Batch related questions into a single
`AskUserQuestion` call (up to 4 questions per call) so the user answers one
panel instead of a back-and-forth. Every question auto-includes a free-text
"Other" field, so open-ended values (URLs, exact font-family strings) are typed
there; the preset options are just fast paths and sensible defaults. Only fall
back to a plain text prompt if a value truly has no reasonable presets.

Follow these steps:

0. **Preflight — install dependencies.** Before any branding, make sure the
   project can actually run. This is often the first time a non-technical
   designer has opened a code project, so be gentle and do the work for them.

   a. Check whether Node.js is installed **and current enough** by running
      `node -v` and `npm -v` from the project root. Note the Node version (the
      number after the `v`). This project runs on Vite 6, so it needs **Node 20.19
      or newer**; the current **LTS** (v22) is the safe default.

   b. **If Node is missing** (command not found), STOP and guide them — do not
      attempt to auto-install a system runtime. Detect their OS and give a
      friendly, non-technical message, e.g.:
      > "This project needs **Node.js** to run, and it isn't installed yet.
      > It's a one-time, click-through install:
      > 1. Go to **https://nodejs.org** and download the **LTS** version
      >    (the big green button — the installer is a `.pkg` on Mac / `.msi` on
      >    Windows).
      > 2. Open the downloaded file and click through the installer (all
      >    defaults are fine).
      > 3. Come back here and run **`/setup-project`** again."
      Then end the run — the rest of setup can't proceed without Node.

   c. **If Node is present but older than v20.19**, STOP and ask them to update —
      an out-of-date Node fails later with a cryptic Vite error, so catch it now.
      Same friendly tone, and tell them their current version:
      > "Your Node.js is **v{their version}**, but this project needs **v20.19 or
      > newer**. Updating is the same quick, click-through install:
      > 1. Go to **https://nodejs.org** and download the **LTS** version (v22).
      > 2. Open it and click through (all defaults are fine) — it replaces the
      >    old version.
      > 3. Come back here and run **`/setup-project`** again."
      If they use **nvm**, the faster path is `nvm install 22 && nvm use 22` (an
      `.nvmrc` pinned to 22 is committed, so `nvm use` picks it up). Then end the run.

   d. **If Node is present and v20.19 or newer**, run `npm install` from the
      project root and report the result plainly (success, or the actual error if
      it fails). This uses npm for the local dev server; note that **Vercel builds
      with pnpm** (see `vercel.json` / `pnpm-lock.yaml`), so the `package-lock.json`
      npm creates is git-ignored and throwaway — do not commit it.

   e. Once install succeeds, continue to branding below. Hold the `npm run dev`
      local-preview reminder for the **true end of onboarding** — after Phase II
      (the styleguide) wraps, per step 8 — so it lands last: they can preview
      locally with **`npm run dev`** (http://localhost:5173) for instant feedback,
      separate from the Vercel preview deploy.

1. **Read the current values.** Open `.env` and note the current
   `VITE_COMPANY_NAME`, `VITE_CLIENT_NAME`, and `VITE_PROJECT_NAME` (they may be
   blank on a fresh template pull).

2. **Ask for the company name FIRST.** This is the first question the user sees.
   `VITE_COMPANY_NAME` fills the dashboard header wordmark. A company name has no
   reasonable presets, so **use a plain text prompt** (not `AskUserQuestion`) —
   just ask for the value directly:

   > What is your company name?
   >
   > This name will appear on the login screen and throughout your client-facing
   > dashboard.

   Show the current `VITE_COMPANY_NAME` if one is already set. If the user leaves
   it blank, keep the existing value (or re-ask if none is set).

3. **Determine the remaining brand values.**
   - If the user passed arguments in `$ARGUMENTS`, parse them as
     `client name | project name` (project name optional).
   - Otherwise, **prompt the user**:
     - **Client name** (required). A client name has no reasonable presets, so
       **use a plain text prompt** (not `AskUserQuestion`) — just ask directly:

       > What is your client's name?
       >
       > This appears throughout the project in prominent locations.

       Show the current value if one is set. If the user leaves it blank, ask
       again — the template stays unbranded without it.
     - **Project name** (optional). Use `AskUserQuestion`; its `question` text
       puts a **blank line between the two sentences** (a real `\n\n` in the
       string) so it reads as two lines, not one run-on sentence. `header`
       "Project Name", `question`:

       > What do you want to call this project?
       >
       > Example: Web Redesign, Web Refresh, Brand Guidelines, or just a simple title.

       Show the current value if set. Blank is allowed (the title lockup simply
       drops the separator).

3b. **Ask the project type & preview shape.** This decides the device-preview
   matrix (`VITE_PROJECT_TYPE` + `VITE_ENABLE_TABLET`, consumed by `previewConfig`
   in `src/config/site.ts`). Ask both in a single `AskUserQuestion` call:

   1. Header "Project Type". Question (blank line between the two sentences — a
      real `\n\n` in the `question` string):

      > What type of project are you designing for?
      >
      > This will determine which device previews (desktop, tablet, and/or
      > mobile) are available in your workspace.

      Three options:
      - **"Web Site"** — the default (list first). Desktop + mobile are the
        baseline. → writes `VITE_PROJECT_TYPE="website"`.
      - **"App"** — mobile-first; the desktop preview is hidden (an app that
        needs desktop is really a website). → `VITE_PROJECT_TYPE="app"`.
      - **"Brand Guideline (coming soon)"** — parked; the home view shows a
        "coming soon" Brand placeholder (`src/app/components/Brand.tsx`) instead
        of a device preview. Set it if that's the intent, but tell the user it's
        stubbed. → `VITE_PROJECT_TYPE="brand"`. (The tablet question below then
        doesn't apply — brand mode has no device preview.)
   2. Header "Tablet view". Question: "Include a tablet preview as well?" Both
      Web Site and App default to **no** tablet unless asked. Options:
      **"No — skip tablet"** (default, first) / **"Yes — add tablet"**. "Yes"
      writes `VITE_ENABLE_TABLET="true"`; "No" leaves it blank.

   Note the effect back to the user: an **App** opens on the phone preview with
   no desktop button; a **Web Site** opens on desktop; tablet appears only if
   they opted in.

4. **Write the values back** into `.env`, preserving its comments and the rest
   of the file. Quote the values: `VITE_COMPANY_NAME="Acme Inc"`,
   `VITE_CLIENT_NAME="ACME ltd"`, `VITE_PROJECT_TYPE="app"`, and
   `VITE_ENABLE_TABLET="true"` (leave `VITE_ENABLE_TABLET=""` when tablet was
   declined).

5. **Confirm** what you set, and remind the user that these are Vite build-time
   vars: the dev server reloads automatically on `.env` change, but a running
   production build must be rebuilt/redeployed (Vercel does this on push).

6. **Remind about the preview gate (Vercel only).** First confirm they have a
   Vercel project. A [Vercel](https://vercel.com) account is **required** — it's
   what turns this project into a live, shareable website for client preview (the
   free "Hobby" tier is enough). If they haven't connected it yet, point them to
   the easiest path: create a free account at https://vercel.com (sign in with
   GitHub), push this repo to a GitHub repository, then in Vercel choose
   **Add New → Project** and import it — every `git push` then auto-deploys. The
   env-var steps below all live in that Vercel project, so it must exist first.

   The login page in
   `middleware.js` runs on Vercel's edge runtime and CANNOT read `.env` /
   `VITE_*`. To brand it, the user must add matching **`CLIENT_NAME`** and
   **`PROJECT_TITLE`** (plain names, no `VITE_` prefix) to their Vercel project's
   Environment Variables — alongside the gate secrets `ADMIN_PASS` / `AUTH_PASS`.
   Give them the exact values to paste. Unset, `CLIENT_NAME` falls back to
   "Preview" and `PROJECT_TITLE` to "A Design System".

7. **Configure the preview-gate fonts.** The gate in `middleware.js` has its own
   inline `<style>`, independent of the app's design system (it can't read the
   app's token layer). It uses two font roles: the **wordmark** (`.brand-name`)
   and the **body font** — used by everything else on the gate (subtitle, the
   "Preview Access" label, the password input, the Enter button, and the footer).

   Run this as an **interactive `AskUserQuestion` flow**:

   **6a. Opt-in gate.** One question. Header **"Your Company Fonts"**; `question`
   text is the three paragraphs below, each separated by a **blank line** (real
   `\n\n` in the string) so it isn't one run-on block:

   > Would you like to apply your brand fonts to this project's admin screens?
   >
   > The login preview uses two font families: one for your brand name and
   > headings, and another for all other text (subtitles, labels, password field,
   > and the Enter button). The interior Styleguide page will use the brand font
   > in the header and the secondary font for all body copy.
   >
   > These settings apply only to the admin experience. You will choose separate
   > fonts for the client design in a few moments, and your company fonts will not
   > affect that design.

   Options — exactly two:
   - **"Use default fonts"** — keeps the template's default admin typefaces:
     **DM Sans (700)** for the brand name / headings and **Inter (300)** for body
     text (these are the default admin font families). Put those names/weights on
     the option itself so the designer sees what they'd get.
   - **"Use my company or custom fonts"** — set your own.
   - If **"Use default fonts"**, make **no** font changes: the template already
     ships DM Sans / Inter for both the gate and the interior admin chrome. Skip
     the rest of this step and finish.

   **6b. Gather the values.** If **Yes**, ask these in a single `AskUserQuestion`
   call (three questions in one panel):
   1. Header **"Font Location"**. Question: "Where are your fonts located?"
      Three options:
      - **Google Fonts** — paste the share / `<link>` URL.
      - **URL** — paste any other CSS `<link>` stylesheet URL (Adobe Fonts,
        Typography.com, or any host).
      - **Import my own fonts** — place font files in the project (exact location
        handled below).
      (`AskUserQuestion` still auto-appends an "Other → type your own" field; these
      three cover the real cases.) For a Google / URL choice, follow up for the
      exact URL if the user didn't paste one, and show the current
      `<link rel="stylesheet">` href if one is set.
   2. Header "Primary font". `question` (blank line before the example — a real
      `\n\n` in the string):

      > Your **primary / wordmark** font — used for the brand name and headings,
      > across the login screen and the interior Styleguide + dashboard.
      >
      > Enter the family and weight, e.g. `'Vitesse A', 'Vitesse B', sans-serif` at 700.

      Give 1–2 example families as preset options; the designer types their own in
      the free-text field.
   3. Header "Body font". `question` (blank line before the example):

      > Your **secondary / body** font — used for all other admin text: on the
      > login screen (the subtitle, the "Preview Access" label, the password field,
      > the Enter button, and the footer) and throughout the Styleguide + dashboard
      > body copy.
      >
      > Enter the family and weight, e.g. `"Forza A", "Forza B", sans-serif` at 400.

   **If the designer chose "Import my own fonts":** have them place the font files
   in **`public/fonts/`** (create the folder if missing) — e.g.
   `public/fonts/Acme-Bold.woff2` and `public/fonts/Acme-Regular.woff2` (prefer
   `.woff2`). Files in `public/` are served at the site root, so reference them as
   `url('/fonts/Acme-Bold.woff2')`. Then:
   - Add an `@font-face` block per weight to **`src/styles/fonts.css`** (for the
     app + interior admin chrome).
   - Add the same `@font-face` blocks to the gate's inline `<style>` in
     **`middleware.js`**, AND **allowlist the folder** so the login page can fetch
     the files *before* the user is authenticated: change the matcher from
     `'/((?!_vercel).*)'` to `'/((?!_vercel|fonts).*)'`. (Font files aren't
     sensitive — this just lets `/fonts/*` pass through the gate.)
   - There is no external stylesheet URL in this case, so **skip the `<link>` edits
     below** and go straight to the `font-family` swaps + the admin-chrome tokens.

   Then edit `middleware.js` (for a Google Fonts / URL choice):
   - If a stylesheet URL was given, set the `<link rel="stylesheet">` href to it,
     and set the `<link rel="preconnect">` href to that URL's origin (scheme +
     host). If the user wants no external font, remove both `<link>` lines.
   - Replace the `font-family` on the `.brand-name` rule with the wordmark value.
   - Replace **all** occurrences of the current body `font-family` value (the one
     on the `body` rule — the same string is repeated on `.brand-subtitle`,
     `.label`, `.pw-wrap input`, and `button[type="submit"]`) with the body value.
   - Warn that font services like Typography.com / Adobe Fonts are **domain-locked**:
     the fonts load only on whitelisted domains, so the user must add their Vercel
     domain to the service's allowlist or the gate falls back to the stack's
     system font (`sans-serif`).

   Then apply the **same two fonts to the interior admin chrome** (the Styleguide
   page + dashboard), so the P7 promise holds — that chrome reads the
   `--admin-font-*` tokens, NOT the gate's inline `<style>`:
   - **Load the fonts for the app too.** The gate loads its own copy via
     `middleware.js`; the React app loads fonts in `src/styles/fonts.css`. If the
     stylesheet is a **Google Fonts** URL, add its families to the existing
     `@import` there (or add a second `@import`). For a **non-Google** provider
     (Adobe / Typography.com), add a `<link rel="stylesheet">` (+ `preconnect`) to
     `index.html`'s `<head>` instead.
   - In `src/styles/tokens.css`, set **`--admin-font-heading`** to the wordmark
     family and **`--admin-font-body`** to the secondary family (keep a system
     fallback in each stack, e.g. `'Wordmark', system-ui, sans-serif`). Leave
     `--admin-font-mono` and every `--admin-*` **color** token untouched.
   - These two `--admin-font-*` roles are the ONE part of `--admin-*` that project
     branding sets — they carry the company / agency fonts (see CLAUDE.md). On
     **"No"** above, leave them at their template defaults (DM Sans / Inter).

Do **not** put secrets (ADMIN_PASS / AUTH_PASS for the preview gate) in `.env`
— those belong in Vercel's Environment Variables or a local `.env.local`.

Note for later: the preview gate shows a text wordmark (name + subtitle) — a
logo could be added via an optional `SITE_LOGO` env var in `middleware.js`. This
is out of scope for this command; flag it if the user wants a full rebrand.

## 8. Continue straight into Phase II — the styleguide

Branding + company fonts are done, but onboarding isn't — **don't leave the
designer at a dead end.** The company-fonts prompt (P7) told them they'd choose the
client's design fonts "in a few moments," so flow directly into it and keep it
feeling like one continuous setup, not a second disconnected command:

- Give a **one-line bridge** — e.g. *"Your brand and company fonts are set. Now
  let's define the client's design foundation: colors and fonts."* — then
  **invoke the `/setup-styleguide` skill** to continue Phase II. That fulfils the
  "in a few moments" promise.
- **Off-ramp:** if the designer would rather pause (wants to set up Vercel first,
  or says "not now"), respect it — tell them they can run **`/setup-styleguide`**
  whenever they're ready, and give the `npm run dev` preview reminder (from step
  0d) now instead of at the end of Phase II.

Do the `npm run dev` local-preview reminder at the **true end of onboarding** —
after the styleguide (Phase II) wraps, or now if they paused here.
