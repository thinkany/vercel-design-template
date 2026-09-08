# WordPress migration (an existing ACF Pro site into a new design)

**Status:** spec'd 2026-09-07 from Rob's idea (a plugin that reads the fields and
content as a proof of concept) and the follow-up discussion. **Proof of concept
BUILT 2026-09-07 on `feature/wordpress-migration`** (not merged, not app-tested,
not run against a real WordPress site): the read-only plugin
(`desktop/wp-plugin/thinkany-export.php`), the importer module
(`desktop/wp-import.cjs`: fetch, inventory, mapping skeleton, HTML to markdown,
transform, redirects, report; fixture test `desktop/dev/wp-import.test.cjs`), the
built-in Table block, the Import from WordPress section in Site → Settings (and on
the CMS drawer before the site is built), and the `/migrate-wordpress` skill
(`inventory`, `map`) in `desktop/skills`, served locally with `SKILLS_LOCAL=1`.
Sibling of [wordpress-export-spec.md](wordpress-export-spec.md): the two share one
payload format and one field-type table, read in opposite directions.

**Block options (step 1 of the variations plan, BUILT 2026-09-08):** the plugin
exports ACF conditional logic; the importer classifies every block field by
purpose (content, variant, layout, reference) from conditional logic, field type,
values used across the site, and name; the inventory shows options in use, the
skeleton lists them per block (`_variants`), the skill maps one onto an enum prop
when the new block has it, and the transform keeps every variant value on the
imported instance under `_wp` (unknown to the schema, stripped at build, kept
through CMS saves) and lists options seen in the report. Step 2 (block briefs for
unmapped blocks and a `/design-block` from-WordPress mode that authors the block
with its options) is to be spec'd after step 1 is tested on the tax site.

**Dev loop:** `SKILLS_LOCAL=1 npm run desktop` (the skill reads from disk, no derive
push). Test the importer with `node desktop/dev/wp-import.test.cjs`. The scaffold
stub `.claude/commands/migrate-wordpress.md` reaches new projects after
`node desktop/build/make-template.cjs` on a committed tree. The export token is kept
in `.thinkany/wp-import/source.json` (local, skipped by publish) so media can be
fetched from a site that is not public.

## Goal

A designer takes a client's existing WordPress site (ACF Pro, block-based) and
redesigns it in thinkany design without retyping the content. The old site's
structure and copy become the brief; the designer designs the new site as usual;
after promote-blocks, the old content flows into the new blocks through a mapping
the designer confirms; old URLs redirect to new ones; the site publishes to Vercel,
or goes back into WordPress through the export spec. The migration is a design job
plus a deterministic transform. The designer touches only the mapping.

## The one design decision

**Export structure, never scrape rendered HTML.** ACF holds the schema (field
groups, post types, options pages), and every ACF block in post content is a
parsed block with its field values as data. Reading those gives the four things
the site builder is made of: block schemas, content types, pages as ordered block
instances, and site settings. Rendered HTML has no field boundaries, so a hero's
eyebrow, heading, and CTA collapse into one blob. HTML is read only as a fallback
for classic-editor pages that have no blocks, and the importer reports it as such.

## The plugin (read-only)

A single-file WordPress plugin, `thinkany-export`, that writes one JSON payload.
It never writes to the site, so the trust story for a client's live install stays
clean.

- **Access:** one endpoint (`/wp-json/thinkany/v1/export`) behind a token the
  plugin shows once on activation, plus a WP-CLI command (`wp thinkany export`)
  for designers with shell access. Same payload either way.
- **Definitions:** ACF field groups (local JSON form), post types, taxonomies,
  options pages, ACF block registrations (name, title, fields).
- **Entries:** every page, post, and custom-type entry: id, type, slug, URL,
  parent, menu order, status, dates, author, featured image, terms, SEO meta
  (Yoast and Rank Math read; title, description, noindex, canonical, share image).
  Content as a parsed block list (block name plus field values for ACF blocks,
  attributes plus inner HTML for core blocks), or raw HTML with a `classic: true`
  flag.
- **Site:** title, tagline, home page id, posts page id, menus with their items,
  the options page values, permalink structure.
- **Media manifest:** every attachment: id, URL, mime, dimensions, alt, caption,
  and the entries that reference it. Files are not embedded; the app downloads
  them from the URL with the token.
- **Forms:** if Gravity Forms or WPForms is present, each form's fields as a
  simple list (label, type, required), for the Forms tab. Best effort, flagged.

The payload is the export spec's `import.json` with `direction: "from-wordpress"`
and the same entry and media shapes, so a site can round-trip: migrate in, redesign,
export back out to the same install headless or as a full theme.

**No-plugin variant.** For a first look at a site the designer can't install on,
the app can read the public REST API (pages, posts, media) and, where the ACF-to-
REST plugin exists, field values. It cannot read field group definitions or parse
blocks, so the mapping step degrades to field-name guesses. Useful for a quote,
not for the migration.

## The migration in the app

### 1. Import (Website intake, "existing site" step)

The intake's existing-code hint gains an "Import from WordPress" choice: site URL
and token. The app fetches the payload into `.thinkany/wp-import/` (payload plus
downloaded media, gitignored) and validates it. This never mixes with `content/`
until the mapping runs.

### 2. Inventory becomes the brief

The agent reads the payload and writes a content inventory, shown as a card:

- pages and their hierarchy, with block types used per page and counts across
  the site,
- post count and categories,
- custom post types with entry counts and their fields,
- media volume and how many images lack alt text,
- forms found,
- pages that are classic HTML (no blocks) and what they contain.

The inventory drives the brief: the sections list is populated from the block
types the old site actually uses (a site with hero, three-up features, testimonial
slider, FAQ, contact says so in real names), the page list is real, and the copy
rides along as content the designer designs against instead of placeholder text.
The old design itself is not imported. If the client wants continuity, the
designer uploads screenshots as references like any other project.

### 3. Design as usual

The designer builds v01, v02 against the inventory. Nothing in this step is
migration-specific. Get Designing, Design Direction, the Art Director, Figma
export, all unchanged.

### 4. Promote, then map

After promote-blocks creates the new blocks with zod schemas, a **mapping step**
pairs old to new:

- **Page level:** old page → new page (by slug, confirmed), old block sequence →
  new block sequence. A flexible-content field inside an old block becomes
  sibling blocks in the new page.
- **Block level:** old ACF block → new block. The agent proposes by name and by
  field shape (an old block with heading, body, image, and a link is a hero or a
  feature, and the page position decides which).
- **Field level:** old field → new prop, by type from the shared table
  (wysiwyg → richtext, image array → `{ src, alt }`, link → `{ label, href }`,
  repeater → list of objects, group → nested object, select → enum with a value
  map when the option names differ).
- **Types:** custom post types → entries in `types.json` and their folders; their
  single templates → the type's page blocks.
- **Settings:** menus → `site.json` nav and footer links; site title and tagline
  → the SEO site name; options page values → site settings where a match exists.

The mapping is written as `.thinkany/wp-import/mapping.json`, one file the
designer can read and edit. The proof of concept edits it by hand; the later UI
is a two-column view with the agent's proposals marked suggested and the designer
confirming, the same accept/edit/discard pattern the other features use. Nothing
is transformed until the designer confirms.

**The transform** is deterministic: it reads the payload and the mapping and
writes `content/pages/*.json`, `content/posts/*.md`, `content/<type>/*.json`,
`site.json` nav and settings, and copies media into `public/images/` through the
existing optimizer with alt text carried over. It is re-runnable: fixing a mapping
and running again overwrites what it wrote and touches nothing else.

### 5. Redirects

Every entry's old URL is compared with its new route. Differences write into the
`redirects` list in `site.json` as 301s, which the site build and the site's
`vercel.json` already publish. Deleted pages get a redirect to the closest
parent, flagged for the designer. This is the step clients get burned on in a
redesign, and it is nearly free here.

### 6. Report

An import report per page: fields mapped, fields dropped and why, rich-text
nodes lost (tables, embeds, shortcodes, galleries), images missing alt, classic
pages that need a hand pass. The report is the designer's punch list, and it is
honest about the ceiling rather than pretending the transform was lossless.

### 7. Publish

Vercel through the existing site publish. Or, once the export spec's headless or
full-theme path exists, back into the same WordPress install: the payload's ids
seed the export's id map so the round trip updates entries in place.

## The rich-text ceiling and tables (decided)

The site's rich text is a markdown subset: paragraphs, headings, inline styles,
lists, links, images, quotes, code, dividers. A wysiwyg field carrying a table, an
embed, a shortcode, or a gallery has no destination inside prose.

**Decision (Rob, 2026-09-07): tables are promoted to a block.** The migration's
answer to a table inside wysiwyg content is a **Table block** in the scaffold's
block library (rows as a list of lists, an optional header row, an optional
caption), styled once in the design's language and edited in the CMS with the
list-of-lists props it already handles. The transform splits the prose at the
table and inserts the block between the two halves, so a paragraph, a table, and
a closing paragraph become richtext, Table, richtext in the page's block list.
The prose subset itself does not grow. Merged cells and per-column widths are
lost and reported.

Embeds, shortcodes, and galleries follow the same shape only when the mapping
names a target block (a video block, a gallery block); otherwise they are dropped
and listed in the report. The report counts every dropped node per page, so the
decision to add more prose-adjacent blocks later is made from real client content.

## Out of scope

- Plugin content: WooCommerce, event calendars, membership, multilingual. The
  inventory names them so the quote is honest; the transform ignores them.
- Users, comments, revisions.
- Writing anything to the WordPress site. The plugin is read-only by design.
- The old theme's design. Nothing visual is imported.

## Proof of concept

The plugin, plus steps 1, 2, 4, and 5, on one real ACF block-based site with
posts and one custom post type. The mapping is a hand-edited JSON. No media
download, no mapping UI, no forms. The test is: does the new v01, promoted and
transformed, show the client's real pages with their real copy, and do the old
URLs land? That proves the thesis and shows how much of the transform is
deterministic before any UI is built.

## Phases (after the proof of concept)

1. **Plugin and payload** hardened: token flow, WP-CLI, media manifest, SEO meta,
   forms best effort, a fixture site for tests.
2. **Import and inventory** in Website intake, with the inventory card feeding
   the brief's sections and pages.
3. **Mapping UI and transform**, re-runnable, with the report.
4. **Media and redirects** in the transform, alt carried over, deleted-page
   handling.
5. **Round trip** with the export spec's id map.

## Decisions (Rob, 2026-09-07)

1. **The plugin ships inside the app** (for now): the designer downloads it from the
   import step and uploads it to the client's site, so plugin and payload format
   stay versioned together. wordpress.org later, if discoverability matters.
2. **Inventory-to-brief and mapping proposals are derive-served skills**, like
   the other licensed build steps, but they are **developed and tested locally
   first**: during development they run from the app (the scaffold's `.claude`
   commands, the dev-only skill path) so a change is a restart, not a derive push
   and a cloud build. They move to derive once the migration is proven on real
   sites. The plugin and the transform are deterministic and ship in the app.
3. **Rich text and tables**: promote to a Table block (see the section above).
   The prose subset stays as it is.

## To do

- **Other form plugins.** The plugin reads Gravity Forms and WPForms today. Add
  Contact Form 7 (fields parsed from its shortcode-style form template), Ninja
  Forms, Formidable, Fluent Forms and WS Form, each into the same payload shape
  (`forms[]`: id, plugin, title, fields with type, label, required, choices), so
  they import into the Forms tab and an old form block binds to them the same way.
  Until then those forms appear in the report as an unresolved reference.
- **Step 2 of block options** (spec after step 1 is tested on the tax site): block
  briefs for unmapped blocks and a `/design-block` from-WordPress mode.

## Assumptions and open questions

- ACF Pro with block-based content is the primary target; classic-content sites
  get the HTML fallback and a bigger hand pass.
- Whether the mapping step should also be offered before design (map old blocks
  to the scaffold's section vocabulary) so the sections list is even tighter.
  Probably not: the sections list from the inventory is enough, and mapping to
  blocks that don't exist yet is speculative.
- Multisite and non-standard permalinks: read the permalink structure from the
  payload and don't assume `/%postname%/`.
