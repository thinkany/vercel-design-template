# Design after import (step 2 of the WordPress migration)

**Status:** spec'd 2026-09-08 from Rob's direction after the first real import
(tax.local into The Dog Bark v01). Not built. Follows step 1 (field purposes and
carried options) in [wordpress-migration-spec.md](wordpress-migration-spec.md).

## The problem it solves

An import lands everything the design already has a block for. What's left is a
short list of old sections with no destination: on the tax site, an image-beside-
copy story used three times, a testimonials section in two layouts, a CTA banner, a
logo strip, a two-column comparison, and running copy. The content for each is
already known, and so are the options the old site used (which side the copy sat
on, which testimonials layout). The site also already has a design.

Running the site back through a design process to get those sections would redo
work and put the existing pages at risk. The right shape is a **punch list**: one
section at a time, designed in the current motif, from a brief the import wrote,
then mapped and imported so the old content lands in it with its options intact.

## Principles

- **The design stays the design.** Existing blocks and pages are never touched by
  this flow. Only new blocks are authored, one per punch-list item.
- **Real content, not placeholders.** Each new block is designed against the copy,
  images and options the old site actually used, so what the designer sees on the
  page is what the client will see.
- **Options become props.** A variant the old site used (copy side, layout type)
  becomes an enum prop on the new block with exactly the values in use, so the
  import maps it through and the CMS offers it afterwards.
- **Designer-initiated, one at a time.** Each item has a button. Nothing is
  designed automatically, and nothing is imported until the designer confirms the
  mapping, as now.

## The flow

1. **Run the import** (as today). The report lists blocks with no destination.
2. **The punch list.** The panel gains a card, **Sections the design needs**, one
   row per unmapped old block: its title, where it's used and how often, its
   content fields in plain words, its options in use, and a **Design this section**
   button. Rows disappear as blocks get mapped; the card disappears when the list
   is empty.
3. **The brief.** Behind each row is a brief the app writes deterministically from
   the classification and the instances: `.thinkany/wp-import/briefs/<block>.json`
   plus a readable `.md`.
4. **Design this section** runs one agent turn: the design-block skill in a new
   **from-brief** mode. It authors one block in the design's visual language from
   the brief, with a props schema derived from the content fields and an enum for
   each option in use, registers it, and places it on the page where the old site
   used it, filled with one real instance's content. Nothing else changes.
5. **Map again.** Propose a mapping revisits every unmapped block. A new block
   authored from a brief carries the brief's field names in its schema, so the
   mapping is mechanical: the skill fills it without guessing, including the option
   map (`copy__left` → `left`).
6. **Run the import** again. The pages are rewritten in the old site's block order,
   so the three stories land between the hero and the steps where they were, each
   with its side. `_wp` on those instances now duplicates a mapped prop and is
   dropped for the fields that mapped.
7. Repeat from 2 until the list is empty. Then the usual passes: Art Director for
   consistency, copy for the arrows in the button labels, and so on.

## The brief

```jsonc
{
  "block": "acf/alternating-content",
  "title": "Alternating Content",
  "description": "",                       // from the ACF block registration when present
  "uses": 3,
  "where": [{ "page": "home", "position": 1, "of": 9 }, { "page": "home", "position": 2, "of": 9 }, { "page": "home", "position": 7, "of": 9 }],
  "fields": [                              // content fields, with the kind the new prop should have
    { "name": "block_title", "label": "Title", "kind": "string", "samples": ["The Clock Is Ticking", "Experience Matters"] },
    { "name": "block_copy", "label": "Copy", "kind": "richtext", "samples": ["Every year you wait, …"] },
    { "name": "image", "label": "Image", "kind": "image", "samples": ["/images/wp/clock.avif"] }
  ],
  "options": [                             // variants in use → enum props
    { "name": "copy_side", "label": "Copy side", "values": [{ "value": "copy__left", "label": "Left", "used": 2 }, { "value": "copy__right", "label": "Right", "used": 1 }], "suggest": { "prop": "side", "options": ["left", "right"] } }
  ],
  "references": [],                        // e.g. a form select, a featured post
  "instances": [                           // two or three real ones, full content, for the page placement
    { "page": "home", "position": 1, "fields": { "block_title": "The Clock Is Ticking", "block_copy": "<p>…</p>", "image": { "src": "/images/wp/clock.avif", "alt": "" } }, "variants": { "copy_side": "copy__left" } }
  ],
  "suggestedKey": "story",                 // a name in the design's vocabulary, the skill may rename
  "suggestedProps": { "heading": "string", "body": "richtext", "image": "image", "side": "enum:left|right" }
}
```

Images referenced by a brief are fetched into `public/images/wp/` when the brief is
written (the same fetcher the transform uses), so the block can be designed against
the real photos.

The `.md` form is the same in designer language: what the section is, where it
appears, its fields with sample copy, its options with counts, and the suggested
name and props.

## The design-block skill: from-brief mode

`/design-block --from-brief <block>` (or `/migrate-wordpress design <block>`, which
is the same thing addressed from the migration side). The playbook's normal contract
holds: one block, in the design's visual language, with a zod schema, registered,
placed on a page. The mode adds:

- **Read the brief first**, not the page. The section's purpose, fields and options
  are given; the skill's job is the visual answer in this design's motif.
- **Schema from the brief.** One prop per content field with the brief's kind, one
  enum per option in use with the suggested values, both named in the design's
  vocabulary (`heading`, `body`, `image`, `side`). The prop names are recorded back
  into the brief (`props` map, old field → new prop) so the mapping is mechanical.
- **Render every option.** A `side` enum means the component renders both sides. A
  `layout` enum with two values means two layouts, even if one is used once.
- **Place it with real content** at the old position on the page named in the
  brief, using the first instance. The other instances arrive with the import.
- **Say what was decided**, in section terms, and that the next step is Propose a
  mapping.

## Mapping after a from-brief block

The mapping skill reads `briefs/*.json`: a brief with a `props` map means the block
exists and the mapping is `old field → new prop` verbatim, plus `{ from, map }` for
each option from the brief's value list. The skill still says what it did; it no
longer has to infer.

## The punch list card

In the panel, under step 4 once a report exists:

- **Sections the design needs (6)**, one row each: title, "used 3× on Home", the
  content fields in words ("title, copy, image"), the options ("copy side: left,
  right"), and **Design this section**. A row whose brief has a `props` map shows
  "Block ready: <name>" and no button.
- A **Write the briefs** action regenerates all briefs from the current payload
  (they are cheap and deterministic; the `props` map is preserved across a rewrite).
- The report's "Blocks with no destination" section links to the same rows.

## What this is not

- Not a redesign. `/design` is never invoked; pages are never rebuilt.
- Not automatic. Each block is one deliberate turn, reviewed on the page before the
  next.
- Not a promise that every old section deserves a block. The designer can skip a
  row (a scratch page's section, an old promo banner). Skipped rows stay in the
  report so nothing is quietly lost.

## Phases

- **P1 Briefs and the punch list.** Brief writer (deterministic, from
  classification + instances + media fetch), the card in the panel, Design this
  section wired to the design-block skill's from-brief mode, the `props` map written
  back. Verifiable on the tax site: six briefs, one block designed from the
  image-beside-copy brief with a side option, placed on Home with a real story.
- **P2 Mechanical re-map and import.** The mapping skill reads briefs; the transform
  drops `_wp` entries that mapped; the punch list empties as blocks land.
- **P3 Ordering and review.** Confirm block order per page matches the old site
  after a partial import; Art Director pass offered from the card when the list is
  empty.

## Open questions

1. Where the from-brief mode lives: a flag on `/design-block` (one skill, one
   contract) or a mode on `/migrate-wordpress` that calls into it. A flag on
   design-block keeps the authoring contract in one place; the migration skill
   would just hand over the brief path.
2. Whether a brief for a block used on several pages with different options should
   place one instance per option value, so the designer sees both sides at once.
3. Whether the punch list should also list core blocks with no home (Custom HTML,
   embeds), or leave those to the report as today.
