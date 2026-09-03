---
description: Design a new block for the site (after /promote-blocks), a new section authored directly as a reusable block in the design's visual language, with a content schema, registered for the CMS, and placed on a page
---

Invoke this when the project has a **promoted site** (`content/site.json` pins a
design other than `v00`) and the designer asks for a **new section, block, or
component for the site**: "add a testimonials section", "design a pricing block",
"I need an FAQ", "make a team grid for the About page". After promotion, new
sections are designed **as blocks**: the design surface (Home tab) is the frozen
reference the site was built from, and `content/` is the source of truth for what
the site says. This skill keeps it that way.

Not this skill: a change to the *design* before promotion (that is `/design`), or
editing a block's *content* (the Pages panel does that, no model turn).

## 0. Communication protocol, same as `/design`

The designer is watching the Site tab. Suppress technical narration.

1. **Open with one sentence**: "Designing a testimonials block for the About page."
2. **TodoWrite in designer language**: `Designing the testimonials block`,
   `Adding it to the About page`, `Checking the site builds`.
3. **One short line per milestone.** Design terms, never code terms.
4. **Close** (§6): where it landed and that its text is now editable in Pages.

**No em-dashes** in anything you say or write.

## 1. Reads, once, batched

In ONE turn:

- `content/site.json` (the pinned design `v##`, the nav).
- `src/variations/{v##}/styles/tokens.css` (palette + fonts: the `--ta-*` roles).
- `site/blocks/index.ts`, `site/blocks/chrome.ts`, `site/blocks/lib/schema.ts`, and
  whatever else is in `site/blocks/lib/` (the design's motif kit: marks, textures,
  `Reveal`). These are the visual vocabulary the new block must speak.
- **One existing block** closest in role to the request (a cards section for a
  cards request, a text+image section for a story request). Read it fully: its
  spacing rhythm, type scale, eyebrow treatment, container width, `@lg:` breaks,
  how it uses the motifs. The new block is a sibling of that one.
- The page the block is for: `content/pages/<id>.json` (the designer named it, or
  `home.json`; if a name doesn't match a page, ask in one line).

Do NOT read `site/src/**`; the contract is inlined below. Do not read the
variation's `Home.tsx`: the promoted blocks ARE the design now.

## 2. The block contract (the same one `/promote-blocks` uses)

One file `site/blocks/<Name>.tsx`:

```tsx
import { z } from "astro/zod";
import { defineBlock } from "../src/lib/blocks";
import { Reveal } from "./lib/Reveal";
import { anchor, image, link } from "./lib/schema";

const props = z.object({
  id: anchor("testimonials"),      // only when nav links should reach it
  eyebrow: z.string().optional(),
  heading: z.string(),
  items: z.array(z.object({ quote: z.string(), name: z.string(), role: z.string().optional(), photo: image.optional() })).min(1),
});

function Testimonials({ id, eyebrow, heading, items }: z.infer<typeof props>) {
  return (
    <section id={id} data-block="testimonials" className="w-full bg-ta-surface px-8 py-28 @lg:px-16 @lg:py-40">
      …
    </section>
  );
}

export const testimonials = defineBlock({
  name: "Testimonials",
  description: "Three quotes with names and photos, staggered.",
  props,
  component: Testimonials,
});
```

Then one row in `site/blocks/index.ts` (`testimonials,` or `"team-grid": teamGrid,`).

**The rules that decide whether the block is any good:**

1. **Props are the CONTENT, markup is the DESIGN.** Every string a client would
   change is a prop; every class, motif, offset and color stays in the component.
   Repeated things are arrays of small objects; `.min()/.max()` when the layout
   only works for a range. Icons go through the design's `marks` map (extend it if
   the block needs a new mark, drawn in the same family); images are `image`.
2. **`.optional()` / `.default()` on everything but the one or two fields the
   block can't render without.** The CMS seeds every field from the schema, so
   optional means "the block still looks right without it".
3. **Speak the design's language.** Same `--ta-*` roles (`bg-ta-surface`,
   `text-ta-ink`…), same type scale and eyebrow treatment as the sibling block,
   same container width, same section rhythm (light/dark alternation, stagger),
   the same motif kit. A block that could belong to any site is wrong.
4. **Static HTML.** No `motion`, no `useState`, no `window`. Reveals are
   `<Reveal delay={…}>`; loops are keyframes in `site/blocks/blocks.css` (respect
   `prefers-reduced-motion`). Interactive pieces aren't supported in page blocks:
   if the request needs one (a carousel, tabs), say so and design the static
   version (a grid, an accordion of `<details>`).
5. **Keep every class in the design's idiom**: `@lg:` container variants, `cqi`
   units, `color-mix(...)` on tokens. The site wraps pages in `@container`.
6. **`data-block="{key}"`** on the root; `id` from the `anchor()` prop when nav
   should reach it.

## 3. Place it and fill it

- Add an instance to the page's `blocks` array in `content/pages/<id>.json`, in the
  position that reads right (after the hero for a feature, before the closing CTA
  for social proof), with **real, on-brief copy** in every field, in the site's
  voice (read the page's other blocks for it). Placeholder text is never written
  into content: the designer should be able to publish what you made.
- If the block should be reachable from the menu, add the link to `content/site.json`
  `nav` (`"/#<id>"` for a home-page section, `"/<page>#<id>"` otherwise).

## 4. Verify

`npx astro build --root site`. An unknown key, a schema/content mismatch, or a
class the site can't resolve fails here with the file and field named. Fix and
rebuild. The Site tab is live (Astro's dev server watches `site/` and `content/`),
so the designer sees the block the moment it builds. **No screenshots.**

## 5. Close

One short paragraph: what the block is, which page it's on (and its position),
that its text and images are now editable in the Pages panel, and that it's in
the block list for other pages. Mention anything you couldn't do (an interactive
piece designed static, a mark you didn't have), one line each.
