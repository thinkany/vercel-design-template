# Lens gallery: showing a direction, not just naming it

**Status:** BUILT 2026-09-05 (app UI, derive data model, 29 essays, curation tooling). Images pending the curator's picks; general directions also get one self-rendered example each (a later pass).

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

## Follow-ups

- Self-rendered examples for the general directions: build one sample home page
  per direction with the app, screenshot, add to picks as local files.
- The remaining thin shortlist (Swiss: six candidates) may need a hand-picked file
  or two from museum open-access collections.
