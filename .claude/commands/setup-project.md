---
description: Brand this template — set the site name and subtitle in .env
argument-hint: "[name] | [subtitle]  (optional; you'll be prompted if omitted)"
---

You are branding this scaffold for a specific project. The public brand values
live in the committed `.env` at the project root as `VITE_SITE_NAME`,
`VITE_SITE_SUBTITLE`, and `VITE_SITE_TAGLINE`. They are consumed through
`src/config/site.ts` and drive the dashboard title lockup, the header, the
styleguide masthead, and the browser tab title.

Follow these steps:

1. **Read the current values.** Open `.env` and note the current
   `VITE_SITE_NAME` and `VITE_SITE_SUBTITLE` (they may be blank on a fresh
   template pull).

2. **Determine the new values.**
   - If the user passed arguments in `$ARGUMENTS`, parse them as
     `name | subtitle` (subtitle optional).
   - Otherwise, **prompt the user**:
     - Ask for the **site name** — the primary title (e.g. the
       "Deep Focus Review" part of "Deep Focus Review : Refinements").
       Show the current value if one is set. This one is required; if the
       user leaves it blank, ask again — the template stays unbranded without it.
     - Ask for the **subtitle** — the secondary label (e.g. the "Refinements"
       part). Show the current value if set. Blank is allowed (the title
       lockup simply drops the separator).
     - Ask for the **tagline** — an optional line shown in the masthead/header.
       Show the current value if set. Blank is allowed (it's simply hidden).

3. **Write the values back** into `.env`, preserving its comments and the rest
   of the file. Quote the values: `VITE_SITE_NAME="Acme Studio"`.

4. **Confirm** what you set, and remind the user that these are Vite build-time
   vars: the dev server reloads automatically on `.env` change, but a running
   production build must be rebuilt/redeployed (Vercel does this on push).

5. **Remind about the preview gate (Vercel only).** The login page in
   `middleware.js` runs on Vercel's edge runtime and CANNOT read `.env` /
   `VITE_*`. To brand it, the user must add matching **`SITE_NAME`** and
   **`SITE_SUBTITLE`** (plain names, no `VITE_` prefix) to their Vercel project's
   Environment Variables — alongside the gate secrets `ADMIN_PASS` / `AUTH_PASS`.
   Give them the exact values to paste. Unset, the gate falls back to "Preview".

Do **not** put secrets (ADMIN_PASS / AUTH_PASS for the preview gate) in `.env`
— those belong in Vercel's Environment Variables or a local `.env.local`.

Note for later: the preview gate shows a text wordmark (name + subtitle) — a
logo could be added via an optional `SITE_LOGO` env var in `middleware.js`. The
`©` comment headers in source files are also still DFR-branded. Both are out of
scope for this command; flag them if the user wants a full rebrand.
