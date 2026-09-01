---
description: Set the client/project name, project type, tablet preview, and menu style in .env
argument-hint: "[client name] | [project name]  (optional; you'll be prompted if omitted)"
---

You are setting the **client/project details** for this design. These public brand
values live in the committed `.env` at the project root and are consumed through
`src/config/site.ts`:

- `VITE_CLIENT_NAME` — drives the dashboard header wordmark, the title lockup, the
  styleguide masthead, and the browser tab title.
- `VITE_PROJECT_NAME` — the secondary half of the title lockup.
- `VITE_PROJECT_TYPE` + `VITE_ENABLE_TABLET` — the device-preview matrix
  (`previewConfig`).
- `VITE_MENU_STYLE` — seeds the desktop nav menus (websites only).

**Scope: client/project only.** Two things this command used to do are now handled by
the app and must NOT be repeated here:

- **The environment is already running.** The desktop app scaffolds the project,
  installs dependencies, and runs the live preview itself. There is **no preflight**,
  no Node/`npm install` step, and no localhost URL to hand the designer. Never tell
  them to run `npm run dev`.
- **Company (agency) identity is owned by the Company Profile.** The app auto-applies
  the designer's saved default company profile when it creates a project, and the
  **Company Profile panel** creates/edits it (company name, admin/gate fonts, login
  logo, and all the `middleware.js` / `fonts.css` / `tokens.css` wiring). Do **not**
  ask for or wire a logo, company name, or admin fonts here. If `VITE_COMPANY_NAME`
  is empty (rare), point the designer to the **Company Profile panel** in one line and
  carry on with the client setup, don't set it inline.

**Make this interactive, ONE question at a time.** Wherever a step says "ask" or
"prompt," use the `AskUserQuestion` tool rather than plain conversational text, it
renders clickable options plus an "Other → type your own" field and works the same
in the IDE and Claude Desktop. **Ask EXACTLY ONE question per `AskUserQuestion`
call, and WAIT for the answer before asking the next, never put two or more
questions in a single call.** The designer must only ever see a single prompt on
screen at a time; a follow-up (like tablet preview, or menu style) is its own
separate call after the prior answer, never bundled alongside another. Every
question auto-includes a free-text "Other" field, so open-ended values are typed
there; the preset options are just fast paths and sensible defaults. Only fall back
to a plain text prompt if a value truly has no reasonable presets.

Follow these steps:

1. **Read the current values.** Open `.env` and note the current `VITE_CLIENT_NAME`,
   `VITE_PROJECT_NAME`, `VITE_PROJECT_TYPE`, and `VITE_MENU_STYLE` (they may be blank
   on a fresh project). Also note `VITE_COMPANY_NAME`: if it's **empty**, say one line
   like *"Heads up: your company identity isn't set yet, you can add it anytime in the
   Company Profile panel."* and continue, this command does not set it.

2. **Client name (required).**
   - Inline args are parsed as `client name | project name` (both optional,
     pipe-separated, in that order). **If a client name was passed** as the first
     `|`-separated segment of `$ARGUMENTS`, use it (confirm it back) and skip this
     prompt.
   - Otherwise, a client name has no reasonable presets, so **use a plain text prompt**
     (not `AskUserQuestion`), just ask directly:

     > What is your client's name?
     >
     > This appears throughout the project in prominent locations.

     Show the current value if one is set. If the user leaves it blank, ask again, the
     template stays unbranded without it.

3. **Ask the project type, THEN the tablet preview, as TWO SEPARATE `AskUserQuestion`
   calls.** The tablet question depends on the type answer (and doesn't apply to
   Brand), so **never bundle them in one call:** ask the type, wait for the answer,
   then ask tablet only if it applies. Together they set the device-preview matrix
   (`VITE_PROJECT_TYPE` + `VITE_ENABLE_TABLET`, consumed by `previewConfig` in
   `src/config/site.ts`).

   **Step 1, Project Type** (its own `AskUserQuestion` call, this question only).
   Header "Project Type". Question (blank line between the two sentences, a real
   `\n\n` in the `question` string):

   > What type of project are you designing for?
   >
   > This will determine which device previews (desktop, tablet, and/or mobile)
   > are available in your workspace.

   Three options:
   - **"Web Site":** the default (list first). Desktop + mobile are the baseline.
     → writes `VITE_PROJECT_TYPE="website"`.
   - **"App":** mobile-first; the desktop preview is hidden (an app that needs
     desktop is really a website). → `VITE_PROJECT_TYPE="app"`.
   - **"Brand Guideline (coming soon)":** parked; the home view shows a "coming
     soon" Brand placeholder (`src/app/components/Brand.tsx`) instead of a device
     preview. Set it if that's the intent, but tell the user it's stubbed. →
     `VITE_PROJECT_TYPE="brand"`.

   **Step 2, Tablet preview** (a SEPARATE `AskUserQuestion` call, made only
   *after* Step 1 is answered, and conditional on it):
   - If they chose **Brand** → **skip this question entirely** (brand mode has no
     device preview). Leave `VITE_ENABLE_TABLET=""`.
   - If they chose **Web Site** or **App** → ask, header "Tablet view", question
     "Include a tablet preview as well?" Both default to **no** tablet unless
     asked. Options: **"No, skip tablet"** (default, first) / **"Yes, add
     tablet"**. "Yes" writes `VITE_ENABLE_TABLET="true"`; "No" leaves it blank.

   Note the effect back to the user: an **App** opens on the phone preview with no
   desktop button; a **Web Site** opens on desktop; tablet appears only if they
   opted in. Keep the chosen type in mind, it tailors the project-name options in
   the next step.

4. **Ask the project name, tailored to the type.** `VITE_PROJECT_NAME` fills the
   secondary half of the title lockup. Use `AskUserQuestion`, header **"Project
   Name"**; the `question` text puts a **blank line between the two sentences** (a
   real `\n\n` in the string):

   > What do you want to call this project?
   >
   > Example: Web Redesign, Web Refresh, Brand Guidelines, or just a simple title.

   **Tailor the preset options to the project TYPE chosen in step 3** (first =
   default), so the name can't contradict the type. The auto "Other → type your own"
   field still covers any custom title:
   - **Web Site** → **"Website Design"** (*A brand new website design.*) ·
     **"Web Redesign"** (*Refreshing or rebuilding an existing site.*)
   - **App** → **"App Design"** (*A new application design.*) ·
     **"App Redesign"** (*Reworking an existing app.*)
   - **Brand Guideline** → **"Brand Guidelines"** (*A brand or style system.*)

   Whatever they pick (or type) becomes `VITE_PROJECT_NAME`. Show the current value
   if set. Blank is allowed (the title lockup simply drops the separator). If a
   project name already came via `$ARGUMENTS` (the 2nd segment), skip this and use it.

5. **Ask the desktop menu style, websites only.** SKIP for `app`/`brand` projects
   (no website nav). For a **Web Site**, ask with `AskUserQuestion`. Header **"Menu
   style"**; `question`: "How should the desktop nav menus start? You can change or
   mix these per item later in `src/app/menu.ts`." Options (first = default):
   - **"Traditional":** plain links, no open menu. → leave `VITE_MENU_STYLE=""`.
   - **"Hover dropdown":** each item reveals a short link list on hover. →
     `VITE_MENU_STYLE="dropdown"`.
   - **"Mega menu":** each item reveals a full content-width panel of sections. →
     `VITE_MENU_STYLE="mega"`.
   Explain the effect: this SEEDS every nav item's menu with a populated starter of
   that style, which the designer edits or varies per item in
   [menu.ts](src/app/menu.ts) (mix mega + dropdown + none). Each open menu, plus
   the default mobile-menu drawer, exports to Figma as its own **"Menu, {Item}"
   Block** after the Header.

6. **Write the values back** into `.env`, preserving its comments and the rest of the
   file. Quote the values: `VITE_CLIENT_NAME="ACME ltd"`,
   `VITE_PROJECT_NAME="Web Redesign"`, `VITE_PROJECT_TYPE="app"`, and
   `VITE_ENABLE_TABLET="true"` (leave `VITE_ENABLE_TABLET=""` when tablet was
   declined). For websites, also write `VITE_MENU_STYLE` from step 5 (leave `""` for
   traditional). Leave `VITE_COMPANY_NAME` untouched.

7. **Write the values, then move straight on, no recap, no publishing talk here.**
   The values are in `.env`, that's enough. Do **NOT**, at this point:
   - give the designer a "here's what we set" branding recap, or
   - introduce or walk through Publishing / Vercel.

   Neither belongs before the client has a design, showing it here is exactly the
   "too soon" problem. **Both are deferred to the true end of onboarding** (the
   styleguide's sign-off, `/setup-styleguide` **step 5**): the branding recap +
   build-time note and the full Publish/Vercel how-to. (Saving the agency identity
   for reuse isn't part of this flow at all, the Company Profile panel owns it.)
   Keep Phase I flowing straight into Phase II.

## Continue straight into Phase II, the styleguide

Client details are set, but onboarding isn't, **don't leave the designer at a dead
end.** Flow directly into the styleguide and keep it feeling like one continuous
setup, not a second disconnected command:

- Give a **one-line bridge:** e.g. *"Your project details are set. Now let's define
  the client's design foundation: colors and fonts."*, then **invoke the
  `/setup-styleguide` skill** to continue Phase II. **No branding recap, publish talk,
  or profile-save here** (per step 7), those all land at the styleguide's sign-off.
- **Off-ramp:** if the designer would rather pause ("not now"), respect it and tell
  them they can run **`/setup-styleguide`** whenever they're ready. Because the
  end-of-onboarding content lives in Phase II's sign-off, a pause means they simply
  get it when they resume. If they clearly want to publish before designing, you may
  give the Publish/Vercel how-to (from `/setup-styleguide` step 5) now, but keep the
  branding recap and profile-save for the true end.

The **end of onboarding is the styleguide's sign-off** (`/setup-styleguide` step 5):
that is where the branding recap, the Publish/Vercel how-to, and the save-company-
profile offer are delivered, once there's a design worth sharing.
