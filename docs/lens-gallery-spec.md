# Lens gallery: showing a direction, not just naming it

**Status:** BUILT 2026-09-05. App UI, derive data model, 29 essays, Commons curation tooling, and 86 credited images live on derive. The self-rendered examples runner is BUILT (Developer menu, dev only) and not yet run: Rob runs it when ready.

## Goal

The direction picker in Get Designing names a lens and gives it one line. A casual
site creator needs to see it. Each lens gets up to three example images and a
fuller read on where the direction comes from, what it makes a visitor feel and
what to expect on the page. Designer-facing only: none of it enters a prompt.

## Decisions (Rob, 2026-09-05)

1. Mixed sourcing: openly licensed references (Wikimedia Commons: public domain,
   CC0, CC BY, CC BY-SA) where a canon exists, plus one self-rendered example for
   general directions that have no public-domain canon. Never screenshots of
   other people's live sites.
2. The essay is designer-facing; the prompt directives stay as they are.
3. Rob picks from a contact sheet; the UI is built while he picks.
4. Images are converted to AVIF and served by derive.

## Data (derive)

- `direction/lens-gallery.cjs`: the 29 essays (authored) and `lensGallery(id)`,
  which returns `{ essay, gallery }`. Gallery records come from
  `direction/lens-gallery.json` (generated, never edited by hand): `file`, `alt`,
  `credit`, `creditUrl`, `license`. `src` is `LENS_IMAGE_BASE` (default
  `https://derive.thinkany.design/lenses/`) plus the file.
- `directionMeta()` merges `essay` and `gallery` into each lens, so the app gets
  it through the metadata call it already makes. `direction.test.mjs` checks every
  lens has an essay and every image is credited.
- Images live in `derive/public/lenses/<lens>-<n>.avif` (1400px wide, quality 50).

## Curation tooling (app repo, `desktop/build/lens-gallery/`)

1. `shortlist.mjs`: per-lens search terms against the Commons API, filtered to
   the four open licences and at least 1000px wide. Writes `out/shortlist.json` and
   `out/shortlist.html`, a contact sheet: click tiles (up to three per lens), copy
   the picks JSON.
2. `picks.json`: the curator's picks. Commons entries are `{ title }`; a local
   screenshot is `{ local, credit, creditUrl, license, alt }`.
3. `build.mjs`: fetches each pick, converts with sharp to AVIF, writes the images
   and `lens-gallery.json` into the derive repo. Then commit and push derive.

## App UI

- Under the lens description: a three-tile strip. Hover shows the credit with a
  "source" link (opens the file page). Click opens the lightbox.
- **About this direction** opens the lightbox on the essay alone, so the feature
  is useful before images land.
- The lightbox: the image large with previous and next, the credit line, the
  essay beneath. Escape, the close button or a click outside closes it. Arrow keys
  step through the images.

## Self-rendered examples (the runner)

General directions have no public-domain canon, so each gets one example the tool
built itself. Decisions: one fictional client for every render, so the images teach
the direction rather than a brand; captured at the tile's own 4:3 above the fold;
credited "thinkany design", licence "own work".

- **The brief.** `desktop/build/lens-gallery/example-brief.json`: Fieldnote Studio, a
  small architecture and interiors practice. Neutral enough to be styled every way.
  Edit it there; every render reads it.
- **The runner.** `desktop/lens-examples.cjs`, started from the app's **Developer**
  menu (present only when the app runs unpackaged). Two entries: "one direction (dry
  run)" renders the first general direction so you can judge the brief and the crop;
  "all general directions" renders the rest. It needs the Claude key and the Design
  license (the direction sampler and the /design-brief playbook come from derive).
- **What it does per direction.** Scaffolds a throwaway project under the app's data
  folder (`lens-examples/<lens>`), samples the direction with that lens pinned (the
  same call a direct pick in the picker makes), builds the Get Designing prompt from
  the brief with the direction block, expands the /design-brief playbook, and runs the
  agent turn with the project served by Vite. Questions the skill might ask are
  declined so the build proceeds on defaults. Then it opens
  `/?v=<variation>&capture=desktop` in the hidden capture window at 1440 by 1080,
  waits for the capture-ready marker and the fonts, and saves the viewport as PNG.
- **Output.** `desktop/build/lens-gallery/examples/<lens>.png` and `examples.json`,
  whose entries are already in picks format (`local`, `credit`, `license`, `alt`).
  The folder is git-ignored; the pictures are regenerable.
- **Adding to the picker.** Review the PNGs. For each keeper, paste its entry from
  `examples.json` into `picks.json` under the lens, as the first image (the
  self-rendered example leads, the Commons references follow). Run
  `node desktop/build/lens-gallery/build.mjs`, which converts local files like any
  other pick, then commit and push derive. Restart the app; the tiles update.
- **Cost and time.** One design build per direction on the designer's key, roughly
  five minutes each; seventeen general directions is about an hour and a half
  unattended. The app is busy for the duration and the previous project is reopened
  at the end.
- **Known limits.** The dry run and the full run render into the same folder, so a
  re-run overwrites. Image sourcing follows the app's Images setting (placeholders
  when that is on). A failed direction is recorded in `examples.json` with its error
  and the batch moves on.

## Follow-ups

- Run the self-rendered examples batch and fold the keepers into picks.json.
- A third Pop Art image (the picked one was AI-generated and was dropped).
- The remaining thin shortlist (Swiss: six candidates) may need a hand-picked file
  or two from museum open-access collections.
