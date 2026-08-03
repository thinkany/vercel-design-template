---
description: Export this project's company (agency) identity — name, admin/gate fonts, logo — as one portable file to reuse on future projects
argument-hint: "[output path]  (optional; defaults to ./company-profile.json)"
---

Save the **company layer** of this project — the agency-owned identity that stays
the same across every project the designer does — into a single portable file they
can reuse when branding a fresh template copy. It is the mirror image of
[`/import-company`](import-company.md).

**What it captures** (and, deliberately, what it does NOT):
- ✅ **Company name** (`VITE_COMPANY_NAME`)
- ✅ **Admin / gate fonts** (`--admin-font-heading` / `--admin-font-body`, the login
  gate's fonts, and any self-hosted font files)
- ✅ **Login logo** (`public/brand/…`)
- ❌ **Not** the client design — `VITE_CLIENT_NAME`, project name/type, the `--ta-*`
  palette, `brand.ts`, menus. Those change every project and belong to
  `/setup-styleguide` + `/design`, not the company profile.

The logo and any font files are **base64-embedded** in the JSON, so the whole
profile is one self-contained text file — no zip, no loose assets. Base64
round-trips any image format losslessly (PNG / WebP / JPG / SVG all the same).

## Steps

1. **Sanity check.** This only makes sense on a **branded** project. Peek at
   `.env` — if `VITE_COMPANY_NAME` is blank, tell the designer there's nothing to
   export yet (run `/setup-project` first) and stop.

2. **Run the exporter:**

   ```
   node scripts/company-profile.mjs pack
   ```

   (If `$ARGUMENTS` gives a path, pass it as `--out <path>` to write there instead
   of the default `./company-profile.json`.)

3. **Report what was saved** in plain language, from the script's summary — the
   company name, the font mode (default / external stylesheet / self-hosted files),
   and whether a logo was included. Then tell the designer:

   > Saved your company profile to **company-profile.json**. Keep this file
   > somewhere reusable (Dropbox, your desktop) — next time you brand a fresh copy
   > of the template, run **/import-company** and point it at this file to restore
   > your name, fonts, and logo in one step.

   Note it's safe to commit or not: it holds only public brand info (no passwords).
