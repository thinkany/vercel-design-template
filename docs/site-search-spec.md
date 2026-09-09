# Site search (a Search setting in the site builder)

**Status:** spec'd 2026-09-08 from Rob's ask ("how might site search be accomplished on Vercel"). Rob chose option A and the design-agent placement flow the same day. Not built.

## Goal

A visitor types a word into the published site and gets a list of matching pages,
posts and entries, on Vercel, with nothing for the designer to sign up for and
nothing for the client to pay for. The designer turns it on in Settings, tells
the design agent where the search should live and how it should look, and the
Site tab preview shows it working before publish.

## What Vercel gives us

Vercel has no search product. Three things it does give us shape the options:

- **Static assets on a CDN.** Anything in the build output is served cached and
  immutable per deploy. A search index that is just a file is the cheapest thing
  Vercel can serve.
- **Serverless functions** from the project's `api/` folder (the forms receiver
  already lives there, `api/forms.js`). A function can hold an index and answer
  queries, at the cost of a cold start and a per-invocation bill.
- **Redirects with query matching** in `vercel.json` (`has: [{ type: "query" }]`),
  which matters for WordPress migrations (WordPress search is `/?s=term`).

## Options

| | A. Build-time index, client search | B. Pagefind | C. Function + hosted search | D. Function + in-function index |
|---|---|---|---|---|
| Where the index is built | Astro endpoint at build (and in dev) | Post-build over the rendered HTML | At publish, pushed to Algolia / Typesense / Meilisearch | At publish, bundled into the function |
| Where queries run | The browser (MiniSearch, ~7 KB) | The browser (WASM, chunked index fetched on demand) | Third-party API | Vercel function |
| Works in the Site tab (astro dev) | Yes, same code path | No, needs a full build first | Only with a live account | Only with a local shim |
| Cost to the client | None | None | Account + plan | Function invocations |
| Scales to | A few hundred pages (index is one file) | Tens of thousands of pages | Unlimited | Thousands, cold-start bound |
| What it indexes | Content collections (props, markdown, entries) | Whatever rendered | Whatever we push | Whatever we push |
| Extra accounts for the designer | None | None | One | None |

**Decision (Rob, 2026-09-08): A, with B as the scale tier.** A is the only
option whose dev and production paths are the same code, which is what the
Site tab preview needs. It needs no account, no function, no key, and its index
is a CDN-cached static file. Its one limit is size, and the app can measure
that at build and say when the site has outgrown it. Pagefind then slots in
behind the same UI as a build step in the publish path, because it indexes
rendered HTML and needs no schema knowledge. C is right for a client who
already pays for Algolia, and is worth a provider slot later in the same shape
as the forms providers, not now. D buys nothing over A or B for this kind of
site.

## Decisions (Rob, 2026-09-08)

1. **Search is an option in Settings**, default off. Turning it on adds the
   `/search` route and the index; off means neither ships.
2. **Location and appearance are design work, not toggles.** Once search is on,
   the Search section shows a brief entry (the same form-entry pattern as the
   other in-app briefs): the designer describes where they want search and how
   it should look ("a magnifier at the right of the nav that opens a full-width
   field", "a search bar under the hero on the Resources page", "results as
   cards with the cover image"). Submitting kicks off the design agent, which
   designs the placement and the results page in the design's language,
   following the same rules as any other submitted design turn (the design
   contract, KEEP tiers, the progress protocol, the edit rules, the
   accessibility rules when AA mode is on). No header/page placement switches.
3. **The Search block falls under the same umbrella.** The agent decides whether
   the brief calls for a header field, a block in a page, a standalone page, or
   several, and creates or designs the block through `/design-block` where one is
   needed. There is a plain built-in Search block as the fallback the agent can
   restyle, not a second path the designer chooses by hand.
4. **What is indexed**: pages and posts always; designer types per type (a toggle
   in the type's settings, on by default when the type has its own routes).
   Drafts and `seo.noindex` entries are never indexed, the same rule as the
   sitemap and llms.txt.
5. **The results page is `noindex` and left out of the sitemap**, like every
   search results page should be.
6. **A promoted design with a search field in its header** is recorded, not
   replaced: promote turns search on and binds the drawn field, and the brief
   entry starts prefilled with "as designed in the header".
7. **WordPress migrations** add a redirect from `/?s=` to `/search?q=`, so old
   search links and browser search shortcuts keep working, and turn search on
   when the source theme showed a search form (the plugin reports the theme's
   widgets and menus), with the brief prefilled from where it sat there.

## The flow

1. Designer opens Site → Settings → Search and turns it on. The index endpoint
   and the `/search` route now exist; the results page renders in the site's
   base styles, unstyled but working, so search is usable before any design
   pass.
2. The section shows the brief entry: one text field with a placeholder that
   suggests the shape ("Where should search live, and how should it look?"),
   optional reference images through the existing reference picker, and a
   **Design it** button. Below it, the current state: "Not designed yet",
   or "Designed 8 Sep, header field + results page" with a **Change** action
   that reopens the entry prefilled with the last brief.
3. Submitting starts a scoped design turn in the chat (the same shape as the
   Art Director's Apply and the accessibility Fix turns): the agent gets the
   brief, the search contract below, and the site's current chrome and blocks.
   It designs the header slot, block or page, wires the field, restyles the
   results page, and reports what it placed where. The Site tab refreshes as
   it goes.
4. The designer iterates in chat like any other design edit, or reopens the
   brief and submits again.

### What the design agent gets (the search contract)

A short section in the design skill (`desktop/skills/design.md` and the
scaffold's `design-block.md` from-brief mode), the way forms and the CTA
picker have theirs:

- The field is always a `<form action="/search" method="get">` with an input
  named `q`, so it works before hydration and with no script at all.
- The header is the only place page-level markup hydrates, so live suggestions
  as the visitor types belong in the header field only (through the chrome's
  search island); a field in a block submits to `/search`.
- The results page is `site/src/pages/search.astro` + `SearchResults.tsx`; the
  agent restyles it through the site's tokens and the block CSS, and keeps its
  structure (form, status line, result list with title, kind, snippet).
- Never index or design around chrome text; never hide the field behind script
  alone; keep the field labelled for screen readers.
- Record the placement in `content/site.json` (`search.placement`) so promote,
  the walkthrough and a re-design know what exists.

## Data

### `content/site.json` (existing file, new section)

```json
{
  "search": {
    "enabled": true,
    "placeholder": "Search",
    "brief": "A magnifier at the right of the nav that opens a full-width field; results as simple rows.",
    "designed": "2026-09-08T18:00:00Z",
    "placement": ["header", "page"],
    "types": { "products": true, "team": false }
  }
}
```

`brief` and `designed` are what the Settings section shows and prefills.
`placement` is written by the design turn (values: `header`, `block`, `page`)
so the app can say what exists without parsing the design. `types` lists the
designer types that are indexed; a type missing from the map follows the
default (indexed when it has routes).

### The index, `/search-index.json`

An Astro endpoint, `site/src/pages/search-index.json.ts`, generated from the
content collections at build and on request in dev. One document per public
page, post or entry:

```json
{
  "v": 1,
  "docs": [
    { "id": "about", "url": "/about", "kind": "page", "title": "About", "description": "…", "headings": ["Our story", "The team"], "body": "…plain text…" },
    { "id": "posts/spring-menu", "url": "/blog/spring-menu", "kind": "post", "title": "The spring menu", "date": "2026-04-02", "tags": ["menu"], "body": "…" },
    { "id": "products/lamp", "url": "/products/lamp", "kind": "products", "title": "Arc lamp", "body": "…" }
  ]
}
```

**Text extraction** is one shared walker in `site/src/lib/search.ts`, reused by
the future AI surfaces (see below):

- **Pages**: walk each block instance's validated props. Strings from schema
  fields marked `richtext` are HTML, stripped to text; other strings are taken
  as they are; arrays and nested objects are walked. Headings come from props
  named `title`, `heading`, `eyebrow` (the block schema knows which fields those
  are; the walker keys off `.describe()` the way `richtext` and `form` already do).
  Media paths, hrefs, form refs and ids are skipped.
- **Posts**: frontmatter title, description and tags, plus the markdown body
  rendered to text (the same renderer `richtext.ts` uses).
- **Entries**: the type's text and richtext fields, in field order.
- **Chrome** (nav, footer) is not indexed; it is the same on every page.

Body text is capped per document (say 4,000 characters, headings and the
description always kept) so a long page does not dominate the file.

**Size guard.** The endpoint logs the index size in the build output; the app's
site build reads it and, past a threshold (1.5 MB raw, roughly 300 pages of
prose), shows a Settings hint that the site has outgrown the built-in index and
should use the scale tier (phase 3). Past a hard limit the build still succeeds;
search just gets slower.

## The pieces

### Site side (scaffold, CORE tier)

- `site/src/lib/search.ts`: the walker above, plus `searchDocs()` for the endpoint.
- `site/src/pages/search-index.json.ts`: the index endpoint; returns 404 when
  search is off so the route does not exist on a site without it.
- `site/src/pages/search.astro`: the results page. Route files can hydrate, so it
  mounts `SearchResults.tsx` with `client:load`. Reads `?q=` from the URL, fetches
  the index once, searches with MiniSearch (prefix + fuzzy, title and headings
  boosted, kind filter chips when more than one kind is present), renders the
  hits with title, url, kind and a snippet with the match highlighted. With no
  script the page still shows the form and a "searching needs JavaScript" line.
  It renders in the site's base styles until the design turn restyles it.
- **Header search slot** in `site/blocks/chrome.ts`: the Header component gains an
  optional `search` prop. Off, nothing renders. On, the design turn's markup
  for the trigger and field lives in the header block; the chrome's search
  island adds the live top-five dropdown and Enter goes to the results page.
  A promoted header keeps its own drawn field (decision 6).
- **Search block** (`site/src/lib/builtin-blocks.tsx`): a heading, a lead and the
  plain form, no script. The fallback the design turn restyles or replaces with
  a designed block.
- `robots.txt.ts`, the sitemap filter and `llms.ts` add `/search` to their
  noindex set.
- The `vercel.json` the app writes at publish gains a long `Cache-Control` for
  `/search-index.json` (it changes only on deploy) and, for migrated WordPress
  sites, the `/?s=` redirect.

MiniSearch is one new site dependency (`SITE_DEP_KEYS` in `main.cjs`, and the
packaged node_modules fill from the [[packaged-node-modules-gotcha]] memory).

### App side (`desktop/`)

- **Settings → Search**: the on/off switch, the placeholder text, the brief entry
  with references and **Design it**, the designed/not-designed state with
  **Change**, the per-type index toggles, and the size hint. Copy in `copy.js`
  under `site.settingsSearch`.
- **The scoped design turn**: a `search:design` IPC that composes the brief, the
  search contract and the current placement into a design turn, the same
  machinery as the Art Director's Apply. Writes `search.designed` and
  `search.placement` when the turn reports done.
- **Skills**: the search contract section in `design.md`, and a from-brief
  entry in `design-block.md` for a designed Search block. Synced to derive
  through `sync-skills.cjs` before any DMG.
- **Site build** reads the index size line from the Astro build output.
- **Promote** (`/promote-blocks`): when the design's header has a search input,
  turn search on, bind the field, and prefill the brief.
- **WordPress import**: on a migrated site, set the `/?s=` redirect, turn search
  on when the source theme showed a search form, prefill the brief with where
  it sat.
- **Walkthrough**: one step for the Settings section and the brief.

## Phases

- **P1, the index, the results page and the switch.** `search.ts` walker +
  endpoint, `/search` route with the MiniSearch island, Settings on/off +
  placeholder, noindex wiring, cache header at publish, base-styled results.
  Testable end to end in the Site tab and on a published site with no design
  pass.
- **P2, the brief and the design turn.** Brief entry + references + Design it,
  the scoped turn, the search contract in the skills, the header slot and
  chrome island, the fallback Search block, `placement` bookkeeping, per-type
  toggles, walkthrough step.
- **P3, promote and WordPress.** Promote binding and prefill, the `/?s=`
  redirect and auto-enable.
- **P4, the scale tier (Pagefind).** When the index passes the threshold, the
  publish path runs Pagefind over `dist-site` after the Astro build and the same
  `SearchResults.tsx` switches to Pagefind's chunked index. Dev keeps the
  MiniSearch path (the Site tab never needs the big index). Same UI, same
  settings, one more build step.
- **Later, if a client asks**: a hosted provider slot (Algolia, Typesense) in the
  shape of the forms providers, pushing the same documents at publish. And a
  derive-backed "ask this site" that feeds the same documents to a model, which
  is the reason the walker lives in one place and llms.txt should move onto it.

## Not in scope

- Search analytics (what visitors search for). Worth a tiny function writing to
  Vercel KV later, surfaced in the app as a list; not part of the launch.
- Indexing media, PDFs or form content.
- Synonyms, stemming per language beyond MiniSearch's defaults.
