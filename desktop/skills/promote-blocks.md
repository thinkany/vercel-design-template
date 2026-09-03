---
description: Promote an approved design into site blocks + content (the start of a Site Build), each section becomes a block with a props schema, its copy and images move into content/, the header/footer become the site chrome, then the site builds
---

Invoke this when a designer says the design is **approved / final / ready to build
the site**, or asks to **start the site build, turn the design into a site, make it
a real website, promote to blocks**. It is the bridge from the design phase to the
site phase: after it, pages are composed from blocks and edited as content.

Read this, do the reads in §1, then promote. The contract is inlined; don't
re-derive it from `site/src`.

## 0. Communication protocol, same as `/design`

The designer is watching the app, not the terminal. Suppress technical
narration (imports, schemas, aliases).

1. **Open with one sentence** naming what you'll do: "Turning your approved design
   into site blocks: six sections plus the header and footer."
4. **TodoWrite in designer language**, one item per section plus the chrome:
   `Promoting hero`, `Promoting island guide`, …, `Promoting header and footer`,
   `Composing the home page`, `Building the site`. Mark `in_progress` /
   `completed` as you go. No prose per todo.
5. **One short line per milestone** only when something is done. Design terms
   (sections, header, cards), never code terms (props, zod, hydration).
6. **Close** with what exists now and what to do next (§6).

**No em-dashes** in anything you say or write.

## 1. Reads, once, batched

In ONE turn read:

- `content/site.json` (note its `design` value). **If it doesn't exist** (a project
  scaffolded before the site target), create it in §4 with `design`, `url:
  "https://example.com"`, `nav`, `footerLinks: []`; likewise create
  `site/blocks/index.ts`, `chrome.ts`, `lib/Reveal.tsx`, `lib/schema.ts` from the
  shapes in §2 when missing. `site/src/**` must already be present (the app's
  refresh-on-open delivers it); if it isn't, stop and say the project needs the
  template refresh first.
- Every `variation.json` under `src/variations/*/` (which design is approved).
- The approved variation's design pages (`src/variations/{id}/components/Home.tsx`
  plus any page listed in `src/app/pages.ts`) and its chrome:
  `Header.tsx`, `Footer.tsx`, `MobileMenu.tsx`, and `nav.ts` if present.
- `site/blocks/index.ts`, `site/blocks/chrome.ts`, `site/blocks/lib/schema.ts`
  (what is already registered; a re-run must extend, not duplicate).

**Which design?** The variation the designer is on. If `site.json.design` already
names one, that is the pin. If several variations look final and nothing points
at one, ask, one line, before touching anything: "Promote v01 (the terracotta
mid-century one) or v02?" Never promote the base `v00` unless it is the only
design.

Do NOT read `site/src/**`. Its contract is inlined below.

## 2. What a block is (the contract, inlined)

A block is one file in `site/blocks/`, exporting a definition:

```tsx
import { z } from "astro/zod";
import { defineBlock, richtext } from "../src/lib/blocks";
import { Rich } from "../src/lib/Rich";
import { Reveal } from "./lib/Reveal";
import { anchor, image, link } from "./lib/schema";

const props = z.object({
  id: anchor("island-guide"),          // only for sections nav links point at
  eyebrow: z.string().optional(),
  heading: z.string(),
  body: richtext.optional(),           // prose: the CMS edits it as rich text
  tags: z.array(z.string()).default([]),
  image,
});

function IslandGuide({ id, eyebrow, heading, body, tags, image: img }: z.infer<typeof props>) {
  return (
    <section id={id} data-block="island-guide" className="…the design's classes, unchanged…">
      …
    </section>
  );
}

export const islandGuide = defineBlock({
  name: "Island Guide",
  description: "Text left, photo right, with a row of pill tags.",
  props,
  component: IslandGuide,
});
```

Then one row in `site/blocks/index.ts`: `"island-guide": islandGuide`. The key is
the content name (`{ "type": "island-guide" }`), kebab-case, matching the
section's `data-block` in the design.

**Rules that decide whether the promotion is any good:**

1. **Two columns carry `side: mediaSide`** (from `../src/lib/blocks`): any section
   with media beside text (photo + copy, panel + list) gets the prop and renders
   BOTH directions (swap the column widths and add `@lg:order-1/2` on the two
   cells when `side === "left"` vs `"right"`; keep the design's classes for its own
   direction and set that value in content). If the design repeats the same
   structure flipped (alternating feature rows), promote ONE block and set `side`
   per instance, not two blocks. The CMS shows Image left / Image right and
   alternates new blocks automatically.
3. **Body copy is `richtext`** (from `../src/lib/blocks`), rendered with
   `<Rich text={body} className="…the <p>'s classes…" />` in place of the design's
   `<p>`: paragraphs, card bodies, quotes, any prose a client would edit. The CMS
   gives it a rich text editor; markdown on disk. Titles, eyebrows, labels and
   button text stay `z.string()`.
2. **Props are the CONTENT, markup is the DESIGN.** Everything a client might
   change (headline, body, eyebrow, button labels and targets, image src/alt, card
   titles/bodies, tags, list items) becomes a prop. Everything that makes it look
   like this design (classes, layout, motifs, textures, stagger offsets, colors,
   type scale) stays in the component, verbatim. When unsure, ask "would the
   client change this without a designer?": yes → prop, no → markup.
2. **Repeated things are arrays of objects** with a small shape (`{ title, body,
   icon }`, `{ label, href }`), with `.min()/.max()` when the layout only works for
   a range (three staggered cards → `.min(1).max(3)`). **Every icon a section
   shows per item becomes a mark**: an SVG drawn inline in the design, an icon
   imported from a library (`lucide-react` etc: inline its paths), or a mark
   already in the design's set all move to `site/blocks/lib/marks.tsx` as a keyed
   map of inline SVG components (`fill="currentColor"`, so the block can color and
   animate fill and stroke), and the prop is `z.enum(keys)`. Never `z.string()`
   holding an icon name, and never SVG markup in content: the CMS turns the enum
   into a visual picker of the marks, and a string into a text box the designer
   can't fill.
3. **Keep every class exactly.** `@lg:`, `cqi`, `color-mix(...)`, arbitrary values,
   token utilities: the site wraps pages in the same `@container` the design
   surface uses, so nothing needs translating. Don't "clean up" while promoting.
4. **Keep `data-block="{id}"`** on the section root (drop `data-block-name`).
7. **`.optional()` / `.default()` on everything but the one or two fields the
   section can't render without** (usually `heading`, sometimes `image`).
8. **Every image is the `image` fragment** (`{ src, alt }`), whether it's content or
   a background, a photo, a logo or a poster: never a bare string path. The CMS
   turns `image` props into an upload field and enum props into a choice; a designer
   is never asked to type a path or a name.
9. **Shared prop fragments** come from `site/blocks/lib/schema.ts` (`image`,
   `link`, `anchor`); extend that file rather than redefining shapes per block.

**Chrome** (header/footer) goes in `site/blocks/chrome.ts`, NOT the registry:

```ts
import type { Chrome } from "../src/lib/blocks";
import { header } from "./Header";
import { footer } from "./Footer";
export { Header } from "./Header";   // by NAME: this is what lets the header hydrate
export { Footer } from "./Footer";
export const chrome: Chrome = { header, footer };
```

Chrome components receive `{ siteName, logo, nav, footerLinks }` from the layout
(nav comes from `content/site.json`), so their props schema is:

```ts
const navLink = z.object({ label: z.string(), href: z.string() });
const props = z.object({
  siteName: z.string(),
  logo: z.string().optional(),
  nav: z.array(navLink.extend({ links: z.array(navLink).default([]) })).default([]),
  footerLinks: z.array(navLink).default([]),
});
```

The Header is the one block that runs in the browser: `hydrate: "load"` on its
definition, and **`export function Header(...)`** (a named export) in its file.
Fold `MobileMenu` INTO the Header block (own `useState`, no shared context). The
Footer is static.

## 3. What does NOT carry over (translate these, every time)

The design surface is an app; the site is static HTML. These patterns appear in
almost every design and each has one translation:

| In the design | In the block |
|---|---|
| `motion` / `<Reveal>` from `motion/react` (whileInView, initial/animate) | `<Reveal delay={0.15}>` from `./lib/Reveal` (a `data-reveal` div; the site animates it with CSS + one observer, no runtime) |
| Infinite `motion` loops (a rotating motif, a bobbing cue) | a CSS keyframe in `site/blocks/blocks.css` + a class (`ta-drift`, `ta-bob`); respect `prefers-reduced-motion` there |
| `useFrameHeight` / `frameH` on the hero | `min-h-[100dvh]` |
| `onNavigate("home")`, `scrollTo(id)`, `scrollToSection(id)` | plain `<a href="/">`, `<a href="#id">` (the site has `scroll-behavior: smooth`) |
| `<button onClick={scroll…}>` CTAs | `<a href="…" className="…same classes… no-underline inline-block">` |
| `useMenuState()` / `MenuStateContext` / `MENU_SIDE` | local `useState` inside the Header block; `MENU_SIDE` a const in the file |
| `useDrawerLock`, frame-box positioning (`box.top`) | `fixed inset-0` scrim + `fixed inset-y-0` panel; lock scroll with `document.documentElement.style.overflow` |
| `siteConfig.clientName` / `siteConfig.logo` in chrome | the `siteName` / `logo` props |
| `NAV_ITEMS` in `nav.ts` / hardcoded footer links | `content/site.json` `nav` (see §4) |
| `getVariationId()`, `window.location.search`, `?v=` | nothing; the site is pinned in `site.json` |
| `DesignSurface`, `ViewToggle`, device frames, `capture` prop | nothing; the layout provides the shell |
| `data-block-name`, `data-capture-ready` | dropped |

Anything else that reads `window` or React state in a page section: move it to
CSS if you can; if you can't, leave the block static and tell the designer that
piece (a carousel, a tabbed panel) needs a hydrated block, which isn't supported
yet. Never set `hydrate` on a page block; the build rejects it.

## 4. Content: the copy leaves the components

Write, in the same turn as the last block:

- **`content/site.json`**: set `design` to the promoted variation id; build `nav`
  from the design's nav source. Anchor links are `"/#section-id"` so they work
  from every page; sub-links (dropdowns) go in `links`. Keep `url` as is.
- **`content/pages/home.json`** (one per design page, `about.json` for an About
  page, `slug` = the page's route): `title`, `seo.description` (a real one-line
  summary of the page, from the hero copy), and `blocks` in the design's order,
  each `{ "type": "<key>", "props": { …every string, image and list from that
  section, verbatim… } }`. Copy is content now: don't rewrite it, don't fix its
  typos, don't drop a sentence.
- Image paths stay as the design has them (`/images/hero.jpg`); the site serves
  the project's `public/`.

## 5. Build, and make it pass

`npx astro build --root site` (not `npm run site:build`: a project that predates
the site target has no such script, since `package.json` is designer-owned and
never rewritten by a refresh). A block that references an unknown key, or content
whose shape doesn't match a schema, fails with the page, block and field named. Fix it
and rebuild; don't loosen a schema to make an error go away unless the schema was
wrong. Two things the build won't catch, so check them by reading your own files
once: every section's `data-reveal` staggers (delays) match the design's, and
every `href` in nav/CTAs points at an `id` some block actually renders.

The build is the verification. **No screenshots**, the designer will look.

## 6. Close

Say what exists now, in one short paragraph: the blocks, the pages composed from
them, that the header and footer are the site's chrome, and that from now on the
Home tab shows the site itself (the design surface renders the promoted blocks
and content), so what they see there and in the Site tab is one and the same. Then the
next step: the designer can now add pages and edit copy as content, and the app's
CMS is where that happens (the CMS rail item: pages, posts, types, navigation, settings).

Mention anything you could not carry over (a hydrated piece, an image you
couldn't resolve), one line each. Don't leave it unmentioned.
