---
description: Import a saved company (agency) profile, name, admin/gate fonts, logo, into this project, so you don't re-enter it on every new copy
argument-hint: "[path to company-profile.json]  (optional; you'll be prompted)"
---

Apply a **company profile** exported from a previous project (see
[`/export-company`](export-company.md)) onto this template copy, restoring the
agency's name, admin/gate fonts, and login logo in one step instead of re-entering
them by hand. This is also the flow `/setup-project` offers as its very first
question.

It is **safe**: it writes onto the template's known pristine CORE files
(`middleware.js` / `tokens.css` / `.env` / `fonts.css`) with anchored edits, and
anything that doesn't match the expected anchor is **skipped and reported** rather
than clobbered. Best run on a **fresh copy**, before the rest of setup.

## Steps

1. **Get the profile file.** A `company-profile.json` can't be pasted into the
   prompt, so it has to be on disk. Offer the designer the two ways to hand it over,
   and use whichever they pick:
   - **"Point me at it":** they give the full path to their saved
     `company-profile.json` (e.g. in Dropbox). Use that path directly.
   - **"I'll drop it in":** tell them to place the file at the **project root** as
     `company-profile.json`, confirm it's there, then use `./company-profile.json`.

   If `$ARGUMENTS` already gives a path, use it and skip the prompt.

2. **Apply it:**

   ```
   node scripts/company-profile.mjs unpack --in <path-to-profile>
   ```

3. **Report the result** from the script's output, in plain language:
   - **Applied:** what it wired up (company name, admin fonts, gate fonts, logo,
     allowlist, restored font files).
   - **Manual steps:** the script lists anything it couldn't finish
     automatically. The common one is **external-stylesheet fonts**: the gate loads
     its own copy, but you should confirm the app also loads the family, add it to
     the `@import` in [src/styles/fonts.css](src/styles/fonts.css) (Google Fonts) or
     a `<link>` in `index.html` (other hosts). **Do these edits for the designer**
     rather than just listing them, then confirm.

4. **Confirm & preview.** Tell the designer their company identity is in place, and
   that the dev server hot-reloads `.env`/token changes (the gate itself only exists
   on the Vercel deploy, see `/setup-project` for the gate env vars). Then point
   them at what's next: **`/setup-project`** to set this project's *client* name and
   design (the parts a company profile deliberately leaves out).

If the imported file isn't a company profile (wrong `kind`), the script errors
clearly, relay that and re-ask for the right file.
