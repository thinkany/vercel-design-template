# Art Director: actionable font suggestions — spec

**Status:** SPEC'd 2026-08-28, not built. Author: Rob's ask.
**Extends:** the Art Director phase-3 "act on suggestions" ([[art-director-feature]]).
**Where:** `desktop/agent.mjs` (suggest schema + persona), `desktop/main.cjs` (bridge),
`desktop/shell.js` (Director drawer modal), `desktop/copy.js`; reuses `buildFontPick`,
`loadGoogleFonts`, `sendText`, and optionally `scripts/resolve-fonts.mjs`.

## Problem

A type/font recommendation ("Give the Display role its own typeface, `--ta-font-display`
and `--ta-font-sans` are both Inter") currently surfaces as a **decision** suggestion:
Hold / Dismiss, "a call for you (or the client) to make." No action. Rob wants the Art
Director to **propose specific font families** (rendered like the design brief's font
picker) and, once one is picked, **send a chat command to swap the font(s)**.

## Feasibility

High, mostly wiring existing parts:
- `buildFontPick` (shell.js) already renders a single-select list of font families **in
  their real typeface** via `loadGoogleFonts` — this is the picker UI.
- `sendText(cmd)` runs a chat command (the Figma-export / command-menu path).
- The suggest schema (agent.mjs) already carries structured suggestions to the renderer.

## Design

1. **Extend the `suggest` schema** (agent.mjs) with two OPTIONAL fields on a suggestion:
   - `fontOptions?: string[]` — 2–4 candidate Google Font families the Art Director
     proposes, chosen to fit the design direction + brand (e.g. for a bold/avant-garde
     brief: Fraunces, Clash Display, Space Grotesk).
   - `fontRole?: "display" | "serif" | "sans" | "mono"` — which `--ta-font-*` role to
     change.
   The Art Director **persona** is told: for a type/font recommendation, fill these (a
   short, direction-appropriate shortlist + the role), so the suggestion is actionable
   rather than a bare "your call." (Optionally seed/validate the shortlist against
   `resolve-fonts.mjs` so the names are real Google Fonts.)
2. **Bridge** (main.cjs): forward `fontOptions` / `fontRole` to the renderer with the rest
   of the suggestion (they already flow through the suggest→renderer bridge).
3. **Director drawer modal** (shell.js): when a suggestion has `fontOptions`, render a
   **font-pick** (reuse `buildFontPick` with those options + `loadGoogleFonts`) below the
   "why", single-select, each shown in its own typeface. Replace/augment the Hold/Dismiss
   row with an **"Apply <font>"** action, enabled once a font is chosen.
4. **On apply → `sendText` a precise command**, e.g.:
   > `Set the ${role} typeface to "${font}": update --ta-font-${role} in tokens.css (and
   > the matching shadcn/type-role token), add its Google Fonts @import to fonts.css, and
   > keep brand.ts's type role in sync.`
   The builder executes it as a scoped edit (same as an `apply` code suggestion, but the
   font is the designer's pick). The rec then resolves like an applied suggestion (moves to
   the drawer Archive / marked done).

## Generalizes (note, not first build)

This is really "a **choice-bearing decision** suggestion": the AD proposes options, the
modal renders them, selecting one sends an apply command. Fonts first; the same shape later
fits a **color** call (swatch options → set `--ta-primary`), a spacing/scale call, etc.
Keep the schema field generic enough (`choices` + an `applyTemplate`) if we want it reusable
from the start — decide at build. MVP can be font-specific.

## Open questions for build kickoff

- Schema: font-specific (`fontOptions`/`fontRole`) vs. a generic `choices` + `applyTemplate`.
- Does "Apply" also let the designer type a custom font (like the brief's custom entry), or
  only pick from the AD's shortlist?
- Pairing: does the AD ever suggest a display **+** body pairing (two roles at once), or one
  role per suggestion?
- After apply, re-run the phase-1 lint / re-confer, or just resolve the rec?

## Related

- [[art-director-feature]] — phase 3 this extends (code/asset/decision split, apply flow).
- Design brief font path: `buildFontPick` + `loadGoogleFonts` + `resolve-fonts.mjs` (reuse).
- `sendText` command path (shared with the Figma Export Design button).
