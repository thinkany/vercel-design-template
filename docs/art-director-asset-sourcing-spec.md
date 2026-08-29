# Art Director: source imagery from an asset suggestion — spec

**Status:** SPEC'd 2026-08-28, not built. Author: Rob's ask.
**Extends:** Art Director phase-3 "act on suggestions" ([[art-director-feature]]); sibling of
the font-suggestions spec ([[art-director-font-suggestions]]) under the "make AD suggestions
actionable" theme.
**Where:** `desktop/agent.mjs` (suggest schema + persona), `desktop/main.cjs` (bridge),
`desktop/shell.js` (Director drawer modal), `desktop/copy.js`; reuses the `/design` §4b image
pipeline + `sendText`.

## Problem

An `asset` recommendation ("Source one large-scale visual moment, every visual is a small UI
card; the Mercedes reference earns its drama through one image at scale") surfaces as
Hold / Dismiss, "needs a new asset, your call to supply it." No action. Rob wants the
**option to have the Art Director source the imagery** whenever this kind of message appears.

## Feasibility

High. `/design` §4b is the non-browser image-sourcing flow (bounded `curl` of a licensed
image → `public/images`, `credits.json` licence tracking, placeholder fallback + report). The
agent already does this during a build; a "Source it" action just points it at the
suggestion. `sendText` runs the command (Figma-button / command-menu path).

Caveat: the schema today defines `asset` as "the builder can't source." That's true for a
SPECIFIC brand/product photo, but a generic large-scale/stock/hero image IS sourceable. So
this reclassifies imagery-type assets as actionable (with graceful placeholder fallback when
nothing fits).

## Design

1. **Suggest schema** (agent.mjs): add an OPTIONAL `assetSourceable?: boolean` (or an
   `assetHint?: string`) to an asset suggestion. The AD sets `assetSourceable` when the asset
   is imagery the §4b pipeline can fetch (a hero/large-scale/stock image), and provides
   `assetHint`, a short image brief / search phrase ("a wide cinematic shot of an empty coastal
   road at dusk") to steer the sourcing, the imagery analogue of the font shortlist.
2. **Bridge** (main.cjs): forward `assetSourceable` / `assetHint` to the renderer.
3. **Director modal** (shell.js): when `assetSourceable` (or always, for `asset` kind), add a
   **"Source imagery"** action beside Hold/Dismiss. (Keep "your call to supply it" wording only
   for non-sourceable assets, e.g. a specific brand photo.)
4. **On click → `sendText` a command**, e.g.:
   > `Source and place imagery for this recommendation, "${title}": ${why}. Use the image flow
   > (a licensed non-browser download into public/images with a credits.json entry; a
   > placeholder + report if nothing fits — never a headless browser), sized/placed as the note
   > describes${assetHint ? `. Direction: ${assetHint}` : ""}.`
   The agent runs §4b, adds the image + credit, and wires it into the design. The rec resolves
   like an applied suggestion (moves to the drawer Archive / marked done). If it can only place
   a placeholder, that surfaces in its report (existing §4b behavior), the honest outcome.

## Generalizes

With the font spec, this completes "actionable AD suggestions" across the three kinds:
- **code** → Apply (built).
- **decision** → propose choices (fonts, later colors) → pick → apply command.
- **asset** → "Source it" → image-pipeline command (this spec).
All three are the same shape: a suggestion carries enough structure that one click `sendText`s a
precise command the builder/agent executes.

## Open questions for build kickoff

- Gate the "Source imagery" action on `assetSourceable`, or offer it on every `asset` kind and
  let the agent fall back to a placeholder + "this needs a real asset from you" note?
- Does the AD always attach an `assetHint`, or only when it has a specific image in mind?
- After sourcing, re-run the phase-1 lint / re-confer, or just resolve the rec?
- Respect `TA_DESIGN_IMAGES=placeholder` mode (source vs. force placeholder)?

## Related

- [[art-director-feature]] — phase 3 this extends. [[art-director-font-suggestions]] — sibling.
- `/design` §4b image pipeline + `credits.json`; `sendText` command path.
