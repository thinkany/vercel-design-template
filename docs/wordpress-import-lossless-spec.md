# WordPress import, lossless (the plan of record)

**Status:** spec'd 2026-09-08 from Rob's sequencing after the first real import
(tax.local into The Dog Bark v01). Decisions taken: a per-block "Use an existing
design" action in the Blocks tab (never before the import); renaming of imported
blocks' fields; naming automated by the import with a " - wp" suffix as the
standard; one Prose block per site. Open questions resolved 2026-09-08. **Supersedes** the mapping-first flow in
[wordpress-migration-spec.md](wordpress-migration-spec.md) (the plugin, the
payload, field purposes and carried options all stay; the Propose step goes) and
[design-after-import-spec.md](design-after-import-spec.md) (folded in as the design
pass). **P1 BUILT 2026-09-08** on `feature/wordpress-migration`: `needsDesign` and
`wp` on the block contract, the placeholder component, the block generator (props
from fields, enums from options, shared fragments, Prose - wp), the registry
insertion, the generated mapping, the draft-only never-overwrite transform with
`created.json`, the verification-first report, and the panel's one Run the import
button. Verified by the fixture test (17 cases) and a real site build that compiles
the generated blocks and renders them through the placeholder. Not yet run in the
app against tax.local. **P1 run on tax.local 2026-09-08**: 12 blocks, 4 draft pages,
entries, form kept, nothing overwritten; fixes from the run landed (held redirects,
numeric slugs, booleans, stale-file cleanup, schema validation in the report).
**P2 partly built 2026-09-08**: the Blocks tab's Active and Needs Design sections
(collapsible, remembered per project), Edit fields: a display label per field (stored with the site like block display names, shown in the page editor; the prop name never changes) and remove (block file and every content instance in one step, `wp:editBlock`). Rob 2026-09-08: renaming is the label, never the programmatic name. **P3 BUILT 2026-09-08**: the import writes a brief per block
(`.thinkany/wp-import/briefs/<key>.json` and `.md`: where used, fields with real
samples, options with usage, images, instances); the design-block playbook gains
§1c, the `--from-brief <key>` mode (schema is the contract, every option value
renders, `needsDesign: false`, one instance per missing option value on the first
page); Update design in the Blocks tab opens a one-line direction prompt with the
brief folded under it and runs the turn; the Blocks tab re-renders when the turn
ends. The import modal replaced the inline panel (staged like Get Designing).
P3 run on tax.local 2026-09-08 (Rob: the design pass works). **Use an existing
design BUILT 2026-09-08**: deterministic pairing by name and kind (synonym groups:
heading/title, body/copy, image/photo/icon, cta/button, items/cards…), shown for the
designer to adjust, then every instance rewritten to the design's block (lists pair
their item fields the same way, richtext into a plain string loses its marks) and the
generated block removed with its brief and labels. Home → Advanced → overwrite from
another page also landed. **P4 BUILT 2026-09-08**: the Pages, Posts and each type's
entries lists gain a status filter (All / Published / Drafts), a checkbox per row
with select all, and Publish selected / Unpublish selected behind a confirmation;
publishing checks each address against the published pages (including earlier
items in the same batch) and refuses the ones in the way, naming the page
(`site:setPublished`). A draft is never on the published site (unchanged); this
only decides which items are drafts.

## The idea in one paragraph

Import everything, design later. Every old block in use becomes a new block in the
site with the same content fields, its options as real props, and a placeholder
component that renders the content plainly with a "Needs design" marker. Every
page, post and entry lands as a **draft**, never touching what the design already
has. Forms come first so blocks can bind to them. The report is a verification, not
a loss list. Then the Blocks tab shows what needs a design, one block at a time, in
the current motif, with real content on real pages, and publishing happens in bulk
once the blocks are designed.

## Sequence

1. **Forms.** Every form the payload carries lands in the Forms tab (as now:
   Gravity Forms and WPForms, compound fields expanded, existing forms never
   overwritten).
2. **Blocks.** One new block per old ACF block **in use**, named well, with:
   - one prop per content field (kind from the ACF type: text → string, wysiwyg →
     richtext, image, link, repeater → list of objects, group → object, select →
     enum, true/false → boolean, number),
   - one enum prop per **option in use** (step 1's variants), with the values used,
   - references resolved (a form select → the built-in form binding; a featured
     post → a reference),
   - shared fragments for field groups that repeat across the theme,
   - a placeholder component and `needsDesign: true`.
   Plus one generated **Prose - wp** block per site (one richtext prop) whenever the
   site has runs of core paragraphs, and the built-in Table for tables.
3. **Content.** Pages, posts and custom-type entries written into `content/`, every
   one a draft, with collision-safe ids, in the old block order, with every field
   mapped one-to-one and options carried into their props. Media fetched for
   everything that references it. Redirects for every old address whose route
   changed.
4. **Report.** What was created, by type, with counts and names: forms, blocks
   (needs design), pages, posts, entries, images, redirects, menus; then the short
   list of what the site can't hold (embeds, uploads, hidden fields), per page.
5. **Design pass.** Blocks tab → Needs Design → Update design, one block per turn.
6. **Publish.** Pages / Posts / Types lists gain a draft filter and select-all with
   bulk publish, collision-checked.

Nothing in 1 to 4 needs an agent turn. The whole import is deterministic and runs
from the panel's one button. The agent appears only in step 5.

## 1. Forms

As built. A form's id comes from its title; an existing id is kept and reported as
"already there, left as is". The old Form block's reference resolves to the new id
so the generated form block binds on import.

## 2. Blocks

### Naming

Naming is automated by the import; there is no naming pass (Rob, 2026-09-08).

- **Block name and key.** The display name is the ACF block title with " - wp"
  appended, always, so an imported block is recognisable beside the design's own
  and never collides with one ("Hero - wp" beside "Hero"). The key is the slug of
  that name (`hero-wp`, `alternating-content-wp`). If a key still collides (a second
  import), the import adds `-2`. The Prose block is "Prose - wp" (`prose-wp`).
- **Prop names** from the ACF field labels in camelCase (`block_title` labelled
  "Title" → `title`; `hero_copy` labelled "Copy" → `copy`), with the theme's common
  prefixes dropped (`block_`, `hero_`, `cta_`) when the rest is still unique within
  the block. Layout fields (step 1) are not props. Names the designer changes in the
  Blocks tab are recorded in the block's `wp` map (old field → prop) so a re-import
  still lands.

### Shared fragments

Field groups that repeat across blocks (the tax theme's `block_title` +
`block_copy` on nine blocks; the CTA pair `cta_button` + `cta_button_two`) are
generated once into `site/blocks/lib/wp-fields.ts` as zod fragments, and each
block's schema composes them. A fragment is a set of field names and kinds seen
together on two or more blocks. The designer sees one prop shape, not nine
near-copies.

### The generated block file

`site/blocks/<key>.tsx`, in the same shape as a promoted block, plus metadata the
app reads:

```tsx
export const alternatingContentWp = defineBlock({
  name: "Alternating Content - wp",
  description: "Imported from WordPress (acf/alternating-content), used 3 times.",
  props: z.object({
    title: z.string().optional(),
    copy: richtext.optional(),
    image: image.optional(),
    side: z.enum(["left", "right"]).default("left"),      // from copy_side: copy__left ×2, copy__right ×1
  }),
  component: Placeholder,          // site/src/lib/placeholder-block.tsx, CORE
  needsDesign: true,
  wp: { block: "acf/alternating-content", fields: { block_title: "title", block_copy: "copy", image: "image", copy_side: "side" }, options: { copy_side: { copy__left: "left", copy__right: "right" } } },
});
```

`needsDesign` and `wp` are new optional fields on `BlockDef` (CORE). The registry
row in `site/blocks/index.ts` is added like a promoted block's.

### The placeholder component

One CORE component, `site/src/lib/placeholder-block.tsx`, renders any props
object plainly in the design's tokens: strings as headings or lines by length,
richtext through `Rich`, images at their size, links as buttons, lists as stacked
items, enums and booleans as small labels, nested objects indented. A visible
"Needs design" ribbon with the block's name, shown in the app's preview and the
local site, never on a published site (drafts don't publish, and a designed block
has its own component). It exists so every imported page previews and the site
builds before any design work.

### Undesigned blocks elsewhere

- **Art Director** skips them (they are not the designer's work yet).
- **Figma export** skips them.
- **The block picker** in the CMS lists them under a "Needs design" group, so a
  designer can still place one on a page if they want.

## 3. Content

### Never overwrite

The import creates; it never replaces. Ids are made from the old slug, and on
collision with anything already in `content/` (the design's `home`, a post with the
same slug) the import uses a distinct id from the old title, then `-2`. The report
lists every id that changed and why.

### Drafts

Every imported page, post and entry is written with `draft: true`. Drafts preview
in the app and in local dev and are left out of the build, as today. Home imports as
`welcome` (its old title), a draft, and the design's home stays the home page until
the designer decides otherwise.

### Pages in the old block order

Every old block instance becomes an instance of its generated block, in order. Runs
of core blocks become Prose instances; tables become Table instances; a Custom HTML
block converts as prose. Fields hidden by an off switch on the old site stay behind
and are named in the report (step 1). Options land in their enum props, and `_wp`
is no longer needed for anything that mapped, so it is written only for values that
did not (rare).

### Posts, entries, media, redirects, menus

As built: posts as markdown drafts; entries as JSON drafts under their type;
images through the media converter into `public/images/wp/`; a 301 for every old
address whose route changed; menus as header nav and footer columns, both optional.

### Re-running

A re-run finds its own previous output by the `wp` ids the import records
(`.thinkany/wp-import/created.json`: every file it wrote and the old id behind it)
and rewrites those, never anything else. A page the designer has since edited is
skipped and listed, unless the designer chooses "overwrite my edits" for that run.

## 4. The report

Verification first, losses second:

```
# Import report
Forms: Contact Us (7 fields)
Blocks created (need design): Alternating Content (3 uses, side: left/right), Testimonials (2, layout), Book CTA, Client Marquee, Table, Steps, FAQ, Form, Hero, WYSIWYG, WYSIWYG Columns, Prose
Pages (drafts): Welcome (was Home, id welcome, 9 blocks), Testimonials (4), Testing (3), Privacy Policy (24)
Posts (drafts): 1     Testimonials (entries, drafts): 5     Images: 26 (26 without alt)
Redirects: 2          Menus: header from "Main Nav"; footer from "Footer One", "Footer Two", "Footer Three" as columns
Ids changed: home → welcome (the design's home page keeps its place)

## What the site can't hold
- Welcome: core/embed (https://youtube.com/…)
- Contact Us form: X-rays (file upload)
- Welcome › Form: form title, intro (hidden on the old site)
```

Shown in the panel after the run (as now) and kept as `report.md`.

## 5. The Blocks tab

Two collapsible sections:

- **Active**: the design's blocks, as today. No field editing here: a designed
  block's schema is the designer's work and changes through `/design-block`.
- **Needs Design**: shown only when at least one block has `needsDesign`. Each row:
  the block's name, "imported from <old block>, used N×", its fields, its options,
  and three actions:
  - **Edit** opens the block's fields: **rename** a prop, **remove** a prop. Both
    rewrite the block file (schema and `wp` map) and every content instance of the
    block (the prop renamed or removed in each page, entry and template), in one
    step, so content and schema never drift. Adding a field is not offered here;
    that is a design decision and belongs to Update design.
  - **Update design** runs the design pass for this block (below).
  - **Use an existing design** offers the Active blocks; picking one runs a short
    agent turn that proposes old prop → existing prop, shown for confirmation, then
    rewrites every instance to the existing block and deletes the generated one.
    For the obvious fits (an imported hero onto the design's hero).
- Renaming a block (its display name and key) is offered in Edit too, through the
  same synced path: the block file, the registry row and every content instance's
  `type`.

## The design pass

**Update design** on a row runs `/design-block --from-brief <key>`: the design-block
skill's normal contract (one block, in the design's visual language, registered,
placed) with a flag that changes the inputs:

- The schema **already exists** and is the contract. The skill designs the component
  for it, keeps every prop, renders every enum value (a `side` renders both sides, a
  `layout` renders both layouts), and never adds or removes a prop. Field changes
  belong to Edit, before the pass.
- **The brief** (`.thinkany/wp-import/briefs/<key>.json` and `.md`, written by the
  import from the classification and the real instances: where used, field samples,
  options with counts, two or three full instances) tells the skill what the section
  is for and shows it real copy and images.
- **Design language**, optional: the button opens a one-line prompt prefilled from
  the brief ("Image beside copy, used three times on Welcome, with a left or right
  side"). The designer adds direction or leaves it.
- **Placement for review**: the block is already on the imported pages with real
  content. The skill sets `needsDesign: false`, and the app's preview reloads the
  page it is on. When the block has an option, the preview lands on a page where
  both values occur, or the skill places one instance per value on the block's first
  page so the designer sees both at once (Rob: yes).
- The row moves from Needs Design to Active.

## 6. Publishing

- **Pages, Posts, Types** lists gain a filter: **All / Published / Draft**.
- Each list gains **select** (per row, select all) and **Publish selected** and
  **Unpublish selected**. Publish flips `draft` off after a **collision check**: a
  draft whose route is already taken by a published page is refused and named
  ("/ is the design's Home; rename this page's slug or unpublish Home first").
- Single-page Publish, as today, gets the same check.

## The panel after this change

Import from WordPress keeps its steps but loses one:

1. The plugin (as now).
2. The content: fetch or load, then the inventory (as now).
3. **Run the import**: one button. Everything in the sequence runs. The mapping
   file is still written (`mapping.json`, generated, the audit trail), and an
   advanced link shows it, but nothing waits on it.
4. The report, and a pointer to the Blocks tab's Needs Design section.

"Propose a mapping" and "Start the mapping over" go. The migration skill keeps one
mode, `inventory` (the brief for a new design, unchanged). `map` is retired.

## To do (from the first lossless run on tax.local, 2026-09-08)

- **Link fields in the CMS.** Any prop that holds an `href` (a CTA, a button, a nav
  link) is a plain text field in the block editor today. It should be a picker over
  the site's pages, posts, entries and in-page anchors, with "type a URL" for
  anything else. A CMS feature, not import-specific, but the import makes it
  pressing: imported buttons point at old addresses.
- **Held redirects** (an old address that is a live page today) should be applied
  automatically when the draft that replaces it is published, from the record the
  import keeps.

## What is not in scope

- Core WordPress blocks with no home (embeds, galleries, files) stay in the report,
  not on the punch list (Rob: leave those to the report; revisit later).
- Other form plugins (the to-do list in the migration spec).
- Editing a designed block's fields from the Blocks tab.
- Merging two generated blocks into one, or splitting one (a design decision made
  through `/design-block` after the pass).

## Phases

- **P1 Blocks and content.** `BlockDef` gains `needsDesign` and `wp`; the placeholder
  component; the block generator (keys, props, enums from variants, shared
  fragments, Prose); the content writer with draft-only, collision-safe ids, old
  block order, `created.json`; the report as verification. The panel's Run the
  import does all of it. Verifiable on the tax site: every page previews, every
  block placeholder shows its content, the site builds (drafts excluded).
- **P2 The Blocks tab.** Active and Needs Design sections; Edit (rename, remove,
  synced to content); Use an existing design; the naming pass; the block picker's
  Needs design group; Art Director and Figma export skip undesigned blocks.
- **P3 The design pass.** `/design-block --from-brief`: briefs written by the
  import, the flag in the design-block skill, the one-line design language prompt,
  both-values placement, `needsDesign` cleared, the row moving to Active.
- **P4 Publishing.** The All / Published / Draft filter, select-all, bulk publish and
  unpublish with the collision check, on Pages, Posts and Types.

P1 alone makes the import lossless and reviewable. P2 to P4 make it usable for a
real client site without hand-editing files.

## Resolved questions (Rob, 2026-09-08)

1. Naming is automated by the import, no agent pass: the " - wp" suffix is the
   standard, not only a conflict rule.
2. Prose is one generated block per site.
3. "Use an existing design" is offered only in the Blocks tab after the import,
   never before it.
