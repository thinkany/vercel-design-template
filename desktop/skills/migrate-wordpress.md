---
description: Migrate a WordPress site into this project. "inventory" turns what the app's WordPress import holds into a brief for the new design; the import itself runs from the app's panel
---

Invoke this from the app's **Import from WordPress** panel (Site → Settings), or when
the designer asks to **migrate / move / import a WordPress site**, **use the old site
as the brief**, or **map the old content onto the new blocks**. The argument after the
command picks the step; today there is one, `inventory`.

The app has already fetched the site into `.thinkany/wp-import/`. You read those
files; you never contact the WordPress site and never write into `content/`. The
import itself (the deterministic transform) runs from the app's panel once the
designer confirms the mapping.

## 0. Communication protocol, same as `/design`

The designer is watching the app. No technical narration (JSON, paths, schemas).

1. **Open with one sentence** naming the step: "Reading what the old site holds"
   or "Proposing where the old content lands".
2. **One short line per milestone**, in designer language: pages, sections, copy,
   images. Never block names with slashes, never prop paths.
3. **Close** with what exists now and the one thing the designer does next.

**No em-dashes** in anything you say or write.

## 1. Reads, once, batched

- `.thinkany/wp-import/inventory.json` (counts, page tree, block types in use)
- `.thinkany/wp-import/definitions.json` (field groups, ACF block definitions, each
  page's block sequence with field NAMES and a short sample value, custom types
  with sample entries, menus, forms)
- `.thinkany/wp-import/mapping.json` if it exists (the skeleton the app wrote, or a
  mapping already in progress)
- For `map` only: `.thinkany/blocks.json` (this site's blocks with their field kinds
  by dotted path: `defaults` and `fields` per block key), and `content/site.json`.

Do NOT read `payload.json`: it is the full content and is large. The definitions
file carries everything the mapping needs.

## 2. `inventory`: the old site as a brief

Write `.thinkany/wp-import/brief.md` and say the same thing in chat, shorter. The
brief is what the designer takes into Get Designing (or pastes into the "what are we
making" answer), so it is written for that: concrete, in the client's terms, no
WordPress vocabulary.

Sections, in order:

1. **What the site is**: one paragraph from the site name, tagline, the home page's
   opening copy, and the custom types (a site with a Team type and a Services type
   is a practice, a firm, a studio; say which).
2. **Pages to design**: the page tree, one line each, with what each page is made
   of in section terms (hero, three features, a testimonial, opening hours table,
   contact form). Mark drafts and pages that are probably retired (old promotions,
   empty pages) as "review: keep or drop".
3. **Sections the design needs**: the distinct section kinds across the site with
   how often each appears, phrased as the scaffold's section vocabulary where it
   fits (Hero, Features, Testimonials, FAQ, Gallery, Contact, CTA, Table, Prose).
   This list is what the designer's brief "sections" answer should contain.
4. **Content types**: each custom type with its fields in plain words and how many
   entries, and whether it wants an index page.
5. **Voice, from the copy**: three or four lines quoting real headings and body
   copy, then one sentence on the tone (warm, clinical, playful).
6. **Assets**: image count, how many lack alt text, notable ones (a hero photo, a
   logo, team portraits). The images arrive with the import, not now.
7. **Watch-outs**: classic pages (no blocks) that need a hand pass, embeds and
   shortcodes that won't carry over, forms found (and which fields), plugin content
   out of scope.

Keep it under a page. Facts only from the files; where the files don't say, don't
guess.

## 3. `map`: retired

The import no longer needs a mapping proposed: every old block becomes a block of
this site with the same fields (docs/wordpress-import-lossless-spec.md), and the
panel's Run the import does it. If asked to map, say so in one line and point at
Run the import in Site → Settings → Import from WordPress.

## 4. If something is missing

- No `.thinkany/wp-import/` files: the site hasn't been fetched. Say so; the panel's
  step 2 does it.
- `map` before the site is built (`content/site.json` has no design, or
  `.thinkany/blocks.json` is missing): say the mapping needs the site's blocks to
  exist, and that building the site from the approved design comes first.
