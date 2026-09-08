# A/B testing (Experiments in the site builder)

**Status:** spec'd 2026-09-05 from Rob's question and the site builder as it stands
(static Astro target, JSON block pages, one Vercel production deployment, no
per-request code on the published site). **Priority: future feature, high.**
Nothing built. Depends on the site builder ([[cms-site-builder]]) and reuses the
forms function ([[forms-feature]]) for conversion tracking.

## Goal

A designer picks a page, makes a variant of it (different hero, different copy,
different block order), sets a traffic split, and publishes. Visitors are bucketed
at the edge and see one version consistently. The app shows how each version is
doing and lets the designer keep the winner with one click. No terminal, no Vercel
dashboard, no third-party testing widget, no layout flicker.

## How this fits the builder

- The published site is fully static (`site/astro.config.mjs`, `output: "static"`).
  Every route is prerendered, so a variant is just a second prerendered page.
- Pages are block lists in `content/pages/<id>.json`. A variant is the same page
  with a different block list, so it is content, not code.
- The site target omits the preview gate's `middleware.js` (`TARGETS.site.omit` in
  `desktop/publish.cjs`). Vercel Edge Middleware is available on every plan, so a
  small site-target middleware can bucket visitors and rewrite the request to the
  variant page. A rewrite is invisible to the visitor and both pages stay static
  and CDN-cached.
- `noindex` pages already drop out of the sitemap and carry a robots meta, so a
  variant can hide from search engines with the plumbing that exists.
- `api/forms.js` is the one function on the published site. It can read the
  bucket cookie and tag submissions, which gives form conversions per version with
  no analytics account at all.

## Decisions to confirm with Rob

1. **Page-level tests first.** Whole-design tests (variation v01 versus v02 of the
   same site) are deferred: they mean two builds or a prefixed second design, with
   tokens and fonts doubled. Page tests answer most client questions.
2. **One running experiment per page, any number of pages.** Two versions (A and
   B). More arms later if asked.
3. **Rewrites, never redirects.** The visitor's URL never changes. This is what
   keeps caching correct and SEO safe.
4. **Measurement in two tiers.** Form submissions tagged by version always work.
   Page-view and click counts need an analytics sink; see Measurement.
5. **The experiment lives in content**, so a republish carries it and a git diff
   reads plainly.

## Data

### `content/pages/<id>.json` gains `experiment`

```json
{
  "title": "Home",
  "slug": "",
  "blocks": [ ...the A blocks, unchanged... ],
  "experiment": {
    "id": "home-hero-2026-09",
    "name": "Hero: photo vs illustration",
    "split": 50,
    "started": "2026-09-05T18:00:00Z",
    "goal": { "type": "form", "form": "contact" },
    "b": {
      "blocks": [ ...the B blocks... ]
    }
  }
}
```

- `blocks` stays the live page (A). Removing `experiment` restores a plain page;
  nothing else changes. That is the whole "stop the test" operation.
- `split` is the percentage that sees B (0 to 100).
- `goal` is what "winning" means: `form` (a submission of a named form), `click`
  (a CTA href), or `view` (a page reached, for example `/thank-you`). Optional; a
  test with no goal only records views.
- `b.blocks` is a full block list, not a diff, so the editor can open it with the
  same block editor and the build renders it with the same code path.
- Variant B has no SEO fields of its own; it inherits A's title and description.

### Build output

The variant renders at `/__ab/<page-route>` (home: `/__ab/`, about: `/__ab/about`).
The route is:

- flagged `noindex, nofollow` in its robots meta,
- excluded from the sitemap and from `llms.txt`,
- given a canonical pointing at A's URL,
- rendered with a `<meta name="ta-experiment" content="<id>:b">` and a
  `data-ta-variant="b"` attribute on `<body>` (A gets `a`), so any analytics
  script can read the version without a cookie.

`/__ab/` also disappears from prefetch and internal nav: `resolveNav` never links
it, and the header hydrates identically on both versions.

### `site/middleware.js` (CORE, shipped only with the site target)

Built into the deployment root as `middleware.js` by the publish path when at
least one page has an experiment. Reads a JSON manifest generated at build
(`dist-site/__ab/manifest.json`, inlined into the middleware source by the
publish step so the edge function has no file access to worry about):

```json
{ "/": { "id": "home-hero-2026-09", "split": 50, "to": "/__ab/" } }
```

Behaviour:

1. Matcher: only the routes in the manifest. Everything else never touches the
   function, so the site's edge cost is zero for untested pages.
2. On a request, read cookie `ta_ab`. Its value is `<experimentId>=<a|b>` pairs,
   one per experiment, so a visitor's buckets survive across pages and tests.
3. No bucket for this experiment: draw one (`Math.random() * 100 < split` → b),
   set the cookie (`Path=/`, `SameSite=Lax`, 90 days), and continue.
4. Bucket `b`: `NextResponse.rewrite(to)`. Bucket `a`: pass through.
5. Requests carrying `?ta_ab=a` or `?ta_ab=b` force a bucket and set the cookie.
   This is how the designer previews each version on the live site and how the
   app's Site tab shows B.
6. Bots (a user-agent list of the usual crawlers) are never bucketed and always
   see A, so what search engines index is the canonical page.

Cache correctness: the rewrite happens before the CDN cache lookup, so A and B
are cached as two URLs and never leak into each other. `Set-Cookie` responses
are not cached, which is fine because the cookie is set once per visitor.

### Measurement

**Tier 1, always on: form goals.** `site/src/lib/form-client.ts` and the native
form post both include the current version (read from `data-ta-variant`) as a
hidden `_ab` field. `api/forms.js` records it in the email subject suffix
(`[B]`) and, when the app has a results sink (below), posts a conversion event.

**Tier 2, needs a sink: views and clicks.** The site has no analytics today. Add
an optional `analytics` entry in `content/site.json` (Settings → Analytics),
which is useful on its own and not only for tests:

```json
"analytics": { "provider": "vercel" | "plausible" | "posthog" | "gtag", "id": "..." }
```

`Base.astro` injects the provider's script with the experiment id and version
as properties on every page view; the goal `click` binds a click listener on
matching CTA hrefs and sends one event. Vercel Web Analytics is the default
suggestion because the site already deploys there and custom events work on the
Pro plan.

**Results in the app.** Phase 1 shows results from the forms sink only: the
publish path enables a tiny KV (Vercel KV or Upstash via the existing env
wiring) that `api/forms.js` increments, and a `results` IPC reads it. Views
per version come from the middleware incrementing the same KV on bucket
assignment (one write per new visitor, not per request). This is enough for a
conversion rate per version with no third-party account. Phase 2 reads
provider APIs where they exist (Plausible and PostHog do; gtag does not).

A results card shows, per version: visitors, conversions, rate, and a plain
readout ("B is converting better, but there are not enough visitors yet to be
sure" using a simple two-proportion z-test at 95%). No charts in phase 1.

## App UI

**Site tab → a page → "Test a variant"** (a button beside Edit page)

1. Duplicates the page's blocks into `experiment.b.blocks`, names the experiment
   from the page title and date, split 50, and opens B in the block editor with a
   version toggle (A / B) in the editor's top bar. The preview switches with it
   via `?ta_ab=`.
2. Goal picker: a form on the page (listed from the page's form blocks), a CTA
   link on the page, or a page reached. Default: the first form on the page if
   there is one, else none.
3. Split slider, 10 to 90 in steps of 10, with a note that 50 finds a winner
   fastest.

**Settings → Experiments**: one row per running experiment (page, name,
started, split, results summary), with three actions:

- **Keep A** removes `experiment`.
- **Keep B** copies `b.blocks` over `blocks`, then removes `experiment`.
- **Pause** sets `split` to 0 (everyone sees A, the cookie and route stay so a
  resume does not rebucket).

Each action marks the site as needing a publish, the same way a content edit
does. The Publish panel's changed-files list shows the page JSON.

**The agent side.** The `/design-block` and Art Director flows do not know
about experiments in phase 1. The one hook: the Art Director's "Apply" on a page
with a running experiment asks which version to apply to.

## SEO and correctness rules

- `/__ab/*` is `noindex, nofollow`, out of the sitemap, out of `llms.txt`, with a
  canonical to A. Crawlers are never bucketed.
- Rewrites only. A redirect would expose `/__ab/` and split link equity.
- Both versions ship the same `<head>` apart from the experiment meta, so share
  cards and structured data are identical.
- Forms on B post to the same function with the same form id; only `_ab` differs.
- The honeypot and timing checks in `api/forms.js` apply unchanged.
- A page with a `parent` keeps its route logic; `/__ab/` is a prefix on the
  computed route, not a second page tree.

## Phases

- **P1 (mechanism):** `experiment` schema in `site/src/lib/types.ts` and the
  content collection; `/__ab/` rendering with the SEO rules; the middleware
  manifest and edge function; publish path ships `middleware.js` for the site
  target when experiments exist; `?ta_ab=` override; forms `_ab` tag and subject
  suffix. Verifiable by a site build, a mocked middleware test, and a live publish
  of a two-version home page.
- **P2 (app UI):** Test a variant, the A/B toggle in the block editor, the
  Experiments settings list with Keep A / Keep B / Pause.
- **P3 (results):** KV counters from the middleware and the forms function, the
  results card with the readout, Settings → Analytics with the provider script
  and view/click events.
- **P4 (later, if asked):** more than two arms; whole-design tests; reading
  provider analytics APIs into the results card.

## Open questions

1. Is a KV on the client's Vercel project acceptable, or should counts go
   through derive (a thinkany-hosted sink) so the client needs nothing extra?
   Derive already holds the relay for forms, so a results sink there is the
   consistent choice if Rob prefers the relay model.
2. Should Settings → Analytics land before this feature? It is independently
   useful and P3 depends on it.
3. Cookie consent: a bucket cookie is functional, not tracking, under most
   readings, but the analytics script is not. Phase 3 needs a consent note in
   the Analytics settings copy.
