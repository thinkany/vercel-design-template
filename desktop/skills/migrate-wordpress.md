---
description: Migrate a WordPress site into this project, two steps that read the app's WordPress import. "inventory" turns what the old site holds into a brief for the new design; "map" proposes where each old block and field lands among this site's blocks, for the designer to confirm before the import runs
---

Invoke this from the app's **Import from WordPress** panel (Site → Settings), or when
the designer asks to **migrate / move / import a WordPress site**, **use the old site
as the brief**, or **map the old content onto the new blocks**. The argument after the
command picks the step: `inventory` or `map`. With no argument, look at what exists
(§1) and pick: no mapping file yet and the site isn't built → `inventory`; the site is
built → `map`.

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

## 3. `map`: propose the mapping

The mapping file is `.thinkany/wp-import/mapping.json`. If it does not exist, say so
and stop: the app writes the skeleton (Propose a mapping does that first). Read it
and fill the empty targets. **Edit the file in place, keep every key, add nothing
the transform doesn't read.** The transform reads exactly these:

```jsonc
{
  "version": 1,
  "pages": [ { "wp": 12, "title": "About Us", "wpPath": "/about-us", "page": "about", "parent": null, "include": true } ],
  "blocks": {
    "acf/hero": { "block": "hero", "fields": {
      "heading": "heading",                       // target prop ← old field name
      "body": "subheading",                       // a wysiwyg field into a richtext prop converts to the site's markdown
      "image": "image",                           // an ACF image into an image prop: fetched and converted
      "ctas[0]": { "from": "button", "each": { "label": "title", "href": "url", "style": "=primary" } },
      "tone": { "from": "tone", "map": { "Light": "light", "Dark": "dark" } }   // old choice labels → the prop's options
    } },
    "acf/page-hero": { "block": "hero", "fields": {
      "heading": { "from": "hero_copy", "pick": "heading" },   // one wysiwyg holding headline + intro: the first heading…
      "body": { "from": "hero_copy", "pick": "rest" }          // …and everything after it
    } },
    "acf/faq": { "block": "faq", "fields": {
      "heading": "faq_title",
      "items": { "from": "faq_groups", "flatMap": "questions", "each": { "q": "question", "a": "answer" } }   // grouped questions, flattened
    } },
    "acf/features": { "block": "features", "fields": {
      "heading": "title",
      "items": { "from": "items", "each": { "title": "name", "text": "text", "icon": "icon" } }   // a repeater into a list of objects
    } }
  },
  "prose": { "block": "prose", "prop": "body" },   // where runs of ordinary paragraphs/headings/lists land; empty = dropped and reported
  "tables": { "block": "table", "rows": "rows", "header": "header", "caption": "caption" },
  "posts": { "import": true, "type": "post", "categoriesAsTags": true },
  "types": { "team": { "include": true, "key": "team", "label": "Team", "singular": "Team member", "path": "/team",
             "fields": { "role": "role", "bio": { "key": "bio" }, "photo": "photo", "accepting": "accepting" } } },
  "nav": "primary",
  "media": { "download": true, "folder": "wp" }
}
```

Rules for a good proposal:

- **Pages.** Keep the app's page ids unless one is unclear. `home` is the front
  page. A page that is clearly retired (a draft "old promotions", an empty page,
  the posts page that the blog replaces) gets `include: false`; say why in one line
  in chat, not in the file. Nested pages keep `parent: null`: the transform follows
  the old parent chain on its own. Set `parent` only to move a page.
- **Blocks.** Pair each old ACF block with the site block whose fields fit, by
  meaning first (a hero is a hero), then by field shape (heading, body, image, a
  link → hero or feature; a repeater of name/text/icon → features or cards; quote +
  who → testimonial). **A poor fit is worse than no fit.** An image-beside-copy
  story, a comparison, a logo strip or a CTA banner forced into a hero stacks
  heroes on the page and hides content in the wrong place; leave it unmapped, say
  so, and name the section the site is missing (each is a one-line `/design-block`
  ask). When the designer adds those blocks and asks again, revisit every block
  you left unmapped or mapped as a compromise: the mapping file is yours to
  update, not only to fill. `availableBlocks` in the file lists this site's blocks and
  their prop paths; use those paths exactly. Prop kinds come from
  `.thinkany/blocks.json` (`fields[block][path].kind`): string, richtext, image,
  link, list, enum with its options, boolean, number.
- **Layout settings are not content.** The old theme's presentation knobs (padding,
  background colors, section ids, hide on mobile, column widths, a deactivate
  toggle) are listed per block as `_layoutFields` in the skeleton and `layoutFields`
  in the definitions. Never map them: the new design decides layout. When a block
  has a deactivate toggle the skeleton already sets `skipWhen` to it, so instances
  switched off on the old site are skipped; a page block marked `deactivated` in
  the definitions is one of those.
- **One field, two props.** An old hero often keeps headline and intro in one
  wysiwyg field. Split it with `pick`: `heading` takes the first heading's text,
  `rest` takes what follows. Grouped repeaters (FAQ sections each holding
  questions) flatten into one list with `flatMap: "<sub repeater>"` before `each`.
- **Fields.** Map only fields whose kinds agree or convert cleanly: text → string,
  wysiwyg → richtext (or string, if the prop is plain text: the tags are stripped),
  image → image, link/url → link, repeater → list with `each`, group → object with
  `each`, select/radio → enum with a `map` when the labels differ, true_false →
  boolean. Never point two old fields at one prop. Leave a prop out rather than
  force a fit; the report lists unmapped fields and the designer decides.
- **Prose.** If the site has a block whose one richtext prop is meant for running
  copy (a Prose, Text, Article or Rich text block), name it in `prose`. If not, say
  so in chat: runs of paragraphs will be dropped and listed, and a prose block is a
  one-line ask to `/design-block`.
- **Tables.** Keep `tables` pointing at the built-in `table` block unless the site
  has its own.
- **Types.** Include a custom type when its entries are real content (team, services,
  locations). Keys are lowercase with dashes; paths start with `/`. Map each ACF
  field to a camelCase key; the kind comes from the ACF type unless you set one.
- **Nav.** The menu in the primary/header location, by slug. External links and
  page links both carry over.
- **Posts.** Import unless the site has none worth keeping; categories become tags.

After writing the file, tell the designer, in section terms, what lands where, what
has no destination and why, and that the next step is **Run the import** in the
panel (they can open the mapping file first to change anything). Do not run the
import yourself; there is no command for it, by design.

## 4. If something is missing

- No `.thinkany/wp-import/` files: the site hasn't been fetched. Say so; the panel's
  step 2 does it.
- `map` before the site is built (`content/site.json` has no design, or
  `.thinkany/blocks.json` is missing): say the mapping needs the site's blocks to
  exist, and that building the site from the approved design comes first.
