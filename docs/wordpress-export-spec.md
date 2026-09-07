# WordPress export (ACF Pro and Gutenberg, full theme and headless)

**Status:** future feature, spec'd 2026-09-05 from Rob's brief. Not scheduled. Nothing
built. Written so the thinking here is not lost. The reverse direction, an existing
ACF site migrated into a new design, is [wordpress-migration-spec.md](wordpress-migration-spec.md);
the two share the payload format and the field-type table.

## Goal

A site built in thinkany design can be delivered to a WordPress install: its blocks,
content types, content and settings arrive as WordPress understands them, and the
client edits in WordPress from then on. The publish path today is Vercel only; this
is a second destination, chosen per project.

## The two choices the designer makes

Both are options in the export, and they combine freely.

1. **Where the pages render**
   - **Full theme.** WordPress renders the site. Our blocks become WordPress blocks
     with PHP render templates; a generated theme carries the design's tokens, fonts
     and Tailwind build. The client hosts one thing.
   - **Headless.** WordPress is the editing backend only. The Astro site we already
     build reads the content over WPGraphQL or the REST API and renders it exactly as
     it does today. No template translation; the client hosts WordPress and the site.
2. **How fields are defined**
   - **ACF Pro.** Field groups as ACF Local JSON (`acf-json/`), with a PHP fallback
     (`acf_add_local_field_group()` calls) for installs that cannot take the folder.
     Post types and options pages also as ACF JSON. Blocks are ACF Blocks.
   - **Gutenberg.** Native blocks: `block.json` attributes, no ACF dependency. Content
     types are registered in PHP; settings live in the Customizer or a small options
     page. Fewer editing niceties (repeaters and groups have no native equivalent, so
     lists are handled with inner blocks or a JSON attribute), but zero plugin cost.

## Why the fit is good

Every block already declares its content as a schema (`site/blocks/*.tsx`), every
content type declares its fields (`content/types.json`), pages are ordered block
instances (`content/pages/*.json`), and site settings are one JSON file. Those are
the same four things a WordPress build declares, so layers 1 and 2 below are
deterministic transforms. Only the templates need a model.

## Layer 1: definitions (deterministic)

A generator walks the block schemas, the types file and the site schema and emits
the definitions for the chosen field system.

| thinkany | ACF Pro | Gutenberg attribute |
|---|---|---|
| text (`z.string()`) | text | string |
| richtext | wysiwyg | string (HTML), RichText in edit |
| image `{ src, alt }` | image, array return | object `{ id, url, alt }` |
| link `{ label, href }` | link | object `{ label, url }` |
| choice (enum), image side | select or radio | string with `enum` |
| yes/no | true_false | boolean |
| number | number | number |
| list of strings | textarea, one per line, or repeater | array of strings |
| list of objects | repeater with sub fields | array of objects, or inner blocks |
| nested object | group | object |
| form reference | select over the site's forms | string |
| content type | post type (ACF JSON) plus field group | `register_post_type()` in PHP plus block bindings |
| site settings, nav, logos, legal | options page group | theme options plus `register_setting()` |

- **Stable keys.** ACF field keys are `field_` plus a hash of the block key and the
  dotted path; group keys hash the block key. A re-export updates in place instead
  of duplicating, and content keeps its meta.
- **Blocks as blocks.** Each of ours becomes one WordPress block: ACF Block
  (`block.json` plus its field group) or native block (`block.json` with the
  attributes above). The `name` is `thinkany/<block-key>`. Pages hold blocks in
  `post_content`, which is what the block editor edits, so the client's experience is
  the native one.
- **Forms.** ACF and Gutenberg have no forms. The export writes each form as a
  definition a forms plugin can import (Gravity Forms JSON first), and the Form block
  renders a placeholder that points at it. Headless keeps our own forms endpoint.

## Layer 2: content (deterministic)

- The export writes one import payload: pages, posts, entries with their meta (or
  serialised block content for the block editor), site settings, and the image
  manifest.
- A small importer runs it: a WP-CLI command shipped in the theme or plugin
  (`wp thinkany import <file>`), or a plugin endpoint the app posts to. It creates
  posts, writes ACF meta or block content, sideloads images from the project's
  `public/images` into the media library, and records the id map so a re-import
  updates rather than duplicates.
- Headless installs import the same payload; the Astro site then reads live from
  WordPress instead of `content/`.

## Layer 3: templates

- **Full theme, ACF.** Each block gets a PHP render template carrying the same
  Tailwind classes, with `get_field()` calls in place of props. The theme carries the
  design's tokens and fonts, a Tailwind build over the templates, the reveal script,
  and the header and footer chrome as template parts driven by the options group.
- **Full theme, Gutenberg.** The same, as dynamic blocks with `render.php` reading
  attributes; an `edit.js` gives the block editor a live preview of each block.
- **Headless.** No translation. A content loader in `site/src/lib` reads WPGraphQL
  or REST and maps ACF or block attributes back onto our block props; the existing
  blocks render unchanged. The build runs on Vercel as now, triggered by a WordPress
  webhook on save.

The React-to-PHP translation is agent work, the reverse of promote-blocks, and lives
as a licensed skill (`/export-wordpress`) the same way the other build steps do. The
markup is simple sections with utility classes, so it translates faithfully; the
skill's contract is "same classes, same DOM, props replaced by field reads".

## In the app

- **Export panel** gains a WordPress destination beside Vercel: two choices (render:
  full theme or headless; fields: ACF Pro or Gutenberg), a target folder or a ZIP,
  and for headless the WordPress URL and an application password so the importer
  can be called directly.
- **Output** is a theme folder (`thinkany-<client>/`) or a plugin folder for headless
  (`thinkany-<client>-content/`), plus `import.json` and `images/`. The app runs
  layers 1 and 2 itself; layer 3 runs as a chat turn with progress, like the site
  build.
- **Re-export** is the normal path after edits: definitions and content update in
  place through the stable keys and the id map.

## Phases

1. **Definitions**: the schema walker and the ACF JSON writer with the PHP fallback,
   plus the Gutenberg `block.json` writer. Testable offline against the fixture sites.
2. **Content**: the payload writer and the importer (WP-CLI first), with image
   sideloading and the id map.
3. **Headless**: the Astro loader for WPGraphQL and REST, the save webhook, and the
   Export panel's headless path. This is the first end-to-end deliverable, since it
   needs no templates.
4. **Full theme**: the `/export-wordpress` skill for ACF Blocks, then native
   Gutenberg blocks, and the theme scaffold (tokens, fonts, Tailwind build, chrome).

## Assumptions and open questions

- ACF Pro is available on the client's install when that option is chosen; the
  Gutenberg option exists for installs without it.
- WordPress 6.5 or later for the block APIs used.
- Forms: which forms plugin to target first (Gravity Forms is the working
  assumption).
- Whether the theme ships a Tailwind build step or precompiled CSS (precompiled is
  simpler for clients; a build step keeps the theme editable).
- Where the licence boundary sits: layers 1 and 2 are deterministic and could ship in
  the app; layer 3 is the IP and stays a derive-served skill.
