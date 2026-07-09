---
description: Brand this template — set the client/project name in .env and the preview-gate fonts
argument-hint: "[client name] | [project name]  (optional; you'll be prompted if omitted)"
---

You are branding this scaffold for a specific project. The public brand values
live in the committed `.env` at the project root as `VITE_COMPANY_NAME`,
`VITE_CLIENT_NAME`, `VITE_PROJECT_NAME`, and `VITE_SITE_TAGLINE`. They are
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

1. **Read the current values.** Open `.env` and note the current
   `VITE_COMPANY_NAME`, `VITE_CLIENT_NAME`, and `VITE_PROJECT_NAME` (they may be
   blank on a fresh template pull).

2. **Ask for the company name FIRST.** This is the first question the user sees.
   `VITE_COMPANY_NAME` fills the dashboard header wordmark. Use `AskUserQuestion`
   with a single question whose text is "What is your company name?" and whose
   `header` (the short chip label) is **"Your Company Name"**. Provide exactly
   two preset options — the tool auto-adds a free-text "Other → type your own"
   field, so do NOT add a redundant "enter your own" preset:
   - **"Design Template For"** — the default (list it first).
   - **"A thinkany.design Template"** — the second preset.
   The user types their real company name via the automatic "Other" field.
   Show the current `VITE_COMPANY_NAME` if one is already set.

3. **Determine the remaining brand values.**
   - If the user passed arguments in `$ARGUMENTS`, parse them as
     `client name | project name` (project name optional).
   - Otherwise, **prompt the user**:
     - Ask for the **client name** — the primary title (e.g. the
       "ACME ltd" part of "ACME ltd : Refinements").
       Show the current value if one is set. This one is required; if the
       user leaves it blank, ask again — the template stays unbranded without it.
     - Ask for the **project name** — the secondary label (e.g. the "Refinements"
       part). Show the current value if set. Blank is allowed (the title
       lockup simply drops the separator).
     - Ask for the **tagline** — an optional line shown in the masthead/header.
       Show the current value if set. Blank is allowed (it's simply hidden).

4. **Write the values back** into `.env`, preserving its comments and the rest
   of the file. Quote the values: `VITE_COMPANY_NAME="Acme Inc"`,
   `VITE_CLIENT_NAME="ACME ltd"`.

5. **Confirm** what you set, and remind the user that these are Vite build-time
   vars: the dev server reloads automatically on `.env` change, but a running
   production build must be rebuilt/redeployed (Vercel does this on push).

6. **Remind about the preview gate (Vercel only).** The login page in
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

   **6a. Opt-in gate.** One question:
   - Question: "Would you like to brand your design environment's font families?
     The preview gate uses two roles — a **wordmark** font for the brand name /
     headings, and a **body** font for everything else (subtitle, labels, the
     password input, and the Enter button)."
   - Header: "Brand fonts", options: **"Yes — set custom fonts"** /
     **"No — use system fonts"**.
   - If **No**, remove the external `<link>` lines and leave the system stack;
     skip the rest of this step and finish.

   **6b. Gather the values.** If **Yes**, ask these in a single `AskUserQuestion`
   call (three questions in one panel):
   1. Header "Stylesheet". Question: "Where are your webfonts hosted? Choose
      **Other** to paste the exact CSS `<link>` URL." Options: **Google Fonts /
      Adobe Fonts (Typekit) / Typography.com / None (already installed)**.
      Show the current `<link rel="stylesheet">` href if one is set. If the user
      picks a provider name rather than pasting a URL, follow up for the exact URL.
   2. Header "Primary font". Question: "Your **primary / wordmark** font — used
      for the brand name and headings. Choose **Other** to type the family and
      weight, e.g. `'Vitesse A', 'Vitesse B', sans-serif` at 700." Give 1–2
      example families as options plus the free-text "Other".
   3. Header "Body font". Question: "Your **secondary / body** font — used for
      all body copy: the subtitle, the 'Preview Access' label, the password
      input, the Enter button, and the footer. Choose **Other** to type the
      family and weight, e.g. `"Forza A", "Forza B", sans-serif` at 400."

   Then edit `middleware.js`:
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

Do **not** put secrets (ADMIN_PASS / AUTH_PASS for the preview gate) in `.env`
— those belong in Vercel's Environment Variables or a local `.env.local`.

Note for later: the preview gate shows a text wordmark (name + subtitle) — a
logo could be added via an optional `SITE_LOGO` env var in `middleware.js`. The
`©` comment headers in source files are also still DFR-branded. Both are out of
scope for this command; flag them if the user wants a full rebrand.
