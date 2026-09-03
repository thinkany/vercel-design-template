---
description: Build or edit a design page (the post-setup design phase), the condensed authoring contract + progress protocol, so you go straight to designing without re-deriving the rules
---

Use this the moment a designer asks to **build, design, create, lay out, or edit
a page/section/hero/landing** after `/setup-project` + `/setup-styleguide`, the
freeform design phase.

**Carve-out, once the site exists.** If `content/site.json` pins a design other
than `v00` (the design was promoted with `/promote-blocks`), a request for a **new
section, block or component for the site** is `/design-block`, not this: after
promotion new sections are designed as blocks and `content/` holds the copy. This
skill still handles the *design itself* (a redesign to re-promote, the styleguide,
a change to the reference design the designer explicitly wants there). It exists to make the FIRST design fast: it inlines the
authoring contract so you don't re-read `Home.tsx`, `DesignSurface.tsx`,
`pages.ts`, and `site.ts` every time. Read this, do the **one** live read below,
then build.

## 0. Communication protocol, calm, plain-language, low-chatter

The designer is watching the live preview, not the terminal. During a build,
**suppress technical narration** (imports, prop threading, token mechanics,
file-by-file play-by-play). Instead:

1. **Open with one sentence** naming what you're about to build ("Building your
   home page, top nav, hero, a feature row, and footer.").
2. **Post a TodoWrite list phrased in designer language**, one item per section,
   e.g. `Creating top navigation`, `Building hero`, `Adding feature grid`,
   `Wiring footer`. That list IS the progress surface. Mark each `in_progress`
   as you start it and `completed` as it lands. No prose per todo.
3. **One short plain-language line per milestone**, only when a section is done
   and visible ("Hero's in, headline, subhead, two buttons on the cream
   background."). Talk in design terms (nav, hero, cards, CTA), never in code
   terms (components, props, tokens, hooks).
4. **Close** by pointing at the preview: "Done, it's live at localhost:5173,
   hot-reloaded. Want me to adjust the hero copy or spacing?" **If any images fell
   back to placeholders** (see §4b), list them here so the designer can supply the
   real assets, don't leave them unmentioned.

**No em-dashes** in what you say to the designer or write into the design (see
CLAUDE.md Conventions): use a comma, a colon, parentheses, or a second sentence.

Keep technical detail for when the designer explicitly asks "how did you…". If
something genuinely blocks you (a missing token, an ambiguous request), say so
plainly and briefly.

## 0b. Work in as few calls as it takes, tool discipline

A build is a long chain of calls, and **every call re-sends the whole growing
context**, so fewer calls is a direct saving. Keep the loop tight:

- **Batch independent calls in one message.** Reading two files, or editing two
  unrelated spots, go in a single turn (parallel tool calls), not one per turn.
- **Build a section in one write, not a trickle of edits.** Compose the whole
  section's markup (or the whole `HomeContent`) in one Write/Edit; don't nudge it
  line-by-line across many tiny Edits.
- **Don't re-verify with Bash.** The scaffold layout, token names, and file roles
  are inlined here (§2, §3, §3b), so **no `ls` / `grep` / `cat` / `git status` to
  "check"**, and don't test that a file exists before Reading it (a failed Read
  tells you). Don't `curl` the preview to confirm a change landed (the designer is
  watching it live; you don't screenshot to self-verify either, §5).
- **One session-start check, batched.** On the first build of a session, the single
  command in "Preview server" below does the server ping AND the three env flags
  (`IMAGES` / `RESEARCH` / `BROAD`) in one call. Read them there; §2b and §4b then
  reference that result instead of each running its own `echo`.

## Preview server, make sure it's live (do this on the FIRST build of a session)

The design only appears if the Vite dev server is running. On the **first** build
request of a session, check before diving in:

- **Is it up + what mode am I in? One batched call** does the server ping AND reads
  the design-mode flags together, so §2b/§4b/§4d never spawn their own `echo`:
  ```bash
  echo "http=$(curl -s -o /dev/null -w '%{http_code}' "${TA_PREVIEW_URL:-http://localhost:5173}") IMAGES=${TA_DESIGN_IMAGES:-off} RESEARCH=${TA_DESIGN_RESEARCH:-off} BROAD=${TA_DESIGN_RESEARCH_BROAD:-off} A11Y=${TA_DESIGN_A11Y:-off}"
  ```
  `http=200` means the preview is live (anything else, it isn't; `$TA_PREVIEW_URL`
  is the app's real port, falling back to `:5173`). Note the flags for §2b (research),
  §4b (images), and §4d (accessibility, `A11Y=aa`), don't re-`echo` them later in the build.
- **If it's not running, OFFER to start it** (it's a command, ask first, don't
  silently launch): run **`npm run dev`** in the background. This project needs
  **Node ≥ 20.19** (`.nvmrc` pins 22); if the shell's active node is older, select
  the pinned version first (e.g. `nvm use`) then `npm run dev`.
- Once it's up (or already was), point the designer at **http://localhost:5173**
  and build.

**Stopping it, tell the designer how.** They can stop the preview whenever: just
say "stop the server" / "free port 5173" and you'll shut it down, or press
**Ctrl+C** in the terminal that's running it.

**Remind them of `/guide`.** Mention they can type **`/guide`** at any time to see
every command this project offers (setup, design, this guide, preview controls).

## Save the original brief (first build of a design only)

When a designer kicks off a design with a natural-language request ("a homepage
with a hero, three product highlights, and a newsletter signup"), **save that
request verbatim** so it's on record in the dashboard. On the **first** build in a
working variation (design #1, before or right as you start building), add a
`"brief"` field to that variation's `src/variations/{id}/variation.json` holding the
designer's original words, unedited, not paraphrased or cleaned up. The dashboard
card renders it under "Original brief."

- Only the **first** build sets it. Don't overwrite an existing `brief` on later
  edits/refinements, it's the *starting* request, kept as a reference point.
- Use their actual message. If they gave the request across a couple of sentences,
  capture the substantive design ask (skip pure pleasantries). Don't invent one, if
  there's genuinely no stated brief (e.g. they just said "start designing"), leave
  it unset.
- This is a silent bookkeeping step, don't narrate it to the designer.

## 1. Fastest path, where the design goes

**Every design is a variation. Base v00 is the pristine template blueprint, never
edit it for a design.** Designing in a variation keeps the base clean, so template
upgrades can refresh the framework without ever touching the designer's work.

- **Check the `?v=` in the current preview URL to know the scope.** `?v=v01` (or any
  non-`v00` id) → you're in a design variation: edit under
  `src/variations/{id}/components/` **only** (its `Home.tsx` is design #1). Never edit
  the base, or you change every variation that falls back to v00. The starter
  `Home.tsx` imports `siteConfig`; if your design stops using it, **drop the import
  too** or it dangles.
- **On base (`v00`), or no variation exists yet?** The designer needs their working
  variation first. Normally `/setup-styleguide` creates it (`v01`) during onboarding;
  if they skipped that, point them at the dashboard's **"Start designing"** button
  (one click, copies base → `v01`), then design in `v01`. **Don't design into the
  base as a shortcut.**

## 2. The palette cheat-sheet, know these, don't re-read to recall them

The `--ta-*` **role names are stable across every project**, only their VALUES
change per project/variation. So you already know the utilities, don't re-Read
`tokens.css` / `theme.css` / `brand.ts` to remember them:

**Color roles**, each is a `bg-ta-*` / `text-ta-*` / `border-ta-*` utility:
`primary` (links, buttons, active states) · `accent` (highlights, badges) ·
`surface` (page/section/card backgrounds) · `ink` (headings, strong text) ·
`body` (paragraphs) · `muted` (captions, metadata) · `border` (dividers,
hairlines). **The `bg-ta-*`/`text-ta-*` utilities exist ONLY for these seven roles**
(they're what `theme.css` registers in `@theme`). Fill them first. **Need an extra
named color** (a poster / extended palette, e.g. `sand`, `walnut`)? Define `--ta-<name>`
in the variation's `tokens.css` and use it as **`bg-[var(--ta-<name>)]`** /
`text-[var(--ta-<name>)]` — a bare **`bg-ta-<name>` is a PHANTOM class** Tailwind never
generates (a per-variation `@theme` can't register utilities at runtime), so it silently
renders nothing and the element falls through to its parent background.

**Font roles**, each a `font-ta-*` utility: `display` (headings) · `serif` ·
`sans` (body) · `mono`.

Use these utilities, **never a raw hex or font stack** (inline `style={{}}` only as
a last resort). For **spacing & radius** use Tailwind's own scale (`p-*`, `gap-*`,
`rounded-*`), already on-brand, no token lookup needed.

**The one live read, only if you need actual VALUES** (an exact hue to judge
contrast, or to see which fonts the project picked): read the active variation's
`src/variations/{id}/styles/tokens.css` **once** (it falls back to base
`src/styles/tokens.css` if the variation hasn't diverged its palette). For plain
authoring the role names above are all you need, skip the read.

## 2b. Research the field (licensed + gated, usually SKIP)
**Check `RESEARCH=` from the session-start call (§ Preview server).** If it's
anything other than `on`, **skip this step entirely** (the default, it's a licensed
add-on, per the active variation's toggle). Don't mention it when off, and don't
re-`echo` it, you already have it.

When it prints `on`, apply research **only to a SUBSTANTIAL (re)design:** a whole
page, a fresh hero, a major new/re-imagined section ("re-imagine the home page", "new
landing", "redo the features section"). **Do NOT** run it for small tweaks (copy edits,
color/size changes, moving one element), those build immediately as always.

For a qualifying request: **tell the designer up front it adds time** (e.g. *"Studying a
few comparable sites to shape this, it'll take a little longer than usual."*), then:
1. **Discover 3–5 comparable sites.** Any the designer named; else `WebSearch` the
   project's own category (infer it from the existing brand/styleguide + current design,
   e.g. a fitness-booking site, a fintech landing). Cap at 5.
2. **Read each:** `node scripts/extract-layout.mjs <url>` for its section skeleton + nav
   pattern. Bounded; skip any that fail.
3. **Synthesize** the common structure (table stakes) vs. what strong ones do differently,
   and let it inform the (re)design, **grammar only, never clone a site.**

**Broad mode, `BROAD=` from that same session-start call.** If it's `on`, look **beyond
same-category competitors** (say so, it takes even longer). Decompose the intent into three
axes and search each SEPARATELY: **function** (what it is → structure/IA), **aesthetic/tone**
(the *feel*, "luxury", "lifestyle", "editorial" → **cross-category** exemplars that embody
the vibe, any industry, for visual language), and **region/mood** (e.g. "west coast" → imagery
& atmosphere). Then **blend:** structure from function peers, feel from the aesthetic
exemplars, mood from region. Still **grammar/feel only, never clone.** If broad is `off`, do
the competitor-only version above.

This grounds a re-imagining in real conventions instead of guesswork. It respects the
same gate as `/design-brief` (license + the variation's on/off + broad), so a variation with it
**on** researches while another with it **off** designs straight away.

## 3. The authoring contract (already inlined, don't re-read the source)

Every design page is a **content function wrapped in `<DesignSurface>`**.
`DesignSurface` supplies the responsive preview, the device frames, isolated
Figma-capture mode, and the global Header/Footer, so the page only supplies
content. For **Home**, edit `HomeContent`. For a **new page**, paste this
skeleton (swap `About`):

```tsx
// ©2026 thinkany llc. All rights reserved.
import { DesignSurface } from "../DesignSurface";

type View = "desktop" | "tablet" | "mobile";
type Orientation = "portrait" | "landscape";

interface Props {
  onNavigate: (page: string) => void;
  view: View;
  setView: (v: View) => void;
  orientation: Orientation;
  setOrientation: (o: Orientation) => void;
  capture?: View;
}

function AboutContent({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <section
      data-block="about-hero"
      data-block-name="About Hero"
      className="min-h-full w-full bg-ta-surface flex flex-col items-center justify-center px-8 py-20 text-center"
    >
      {/* design content here */}
    </section>
  );
}

export function About({ onNavigate, view, setView, orientation, setOrientation, capture }: Props) {
  return (
    <DesignSurface
      view={view} setView={setView}
      orientation={orientation} setOrientation={setOrientation}
      capture={capture} onNavigate={onNavigate}
    >
      <AboutContent onNavigate={onNavigate} />
    </DesignSurface>
  );
}
```

Then **register it** with one row in `src/app/pages.ts`:
`{ id: "about", route: "about", name: "About", component: "About" }`, that wires
routing (`?v={id}&about`), rendering, the nav link, and Figma export. No
`App.tsx` edit. Full-bleed landing with no Header/Footer? add `chrome={false}` to
`<DesignSurface>`.

## 3b. Read only what you EDIT, the rest is already inlined

The shape of the scaffold's shared files is captured in this doc, so **don't re-Read
them to "recall the pattern"**, each full Read is ~0.5–2k tokens that then sit in
context the rest of the session (the single biggest source of re-read waste). Read a
file only when you're about to **change** it:

- **Editing → Read first** (you must, before an Edit): the section's `Home.tsx`, or
  the specific page/component you're modifying, under `src/variations/{id}/components/`.
- **Already inlined here, don't re-Read to recall:** `DesignSurface.tsx` + `pages.ts`
  (contract + registration, §3), `Header.tsx` / `Footer.tsx` / `menu.ts` (global
  chrome, §4c), `tokens.css` / `theme.css` / `brand.ts` (token names, §2). Open one
  only to actually edit it, e.g. `Header.tsx` when the designer wants different nav,
  `brand.ts` + `tokens.css` together for a palette change.
- **`brand.ts`** holds the styleguide manifest + the `spacing`/`radii`/`typeScale`
  scales; you rarely need it mid-design (use Tailwind's scales). Never open it just to
  recall a color, §2 is the source for that.

## 4. The five rules that matter (the rest is noise for this phase)

1. **Container queries, NOT viewport.** The design renders in a fixed-width device
   frame inside the real window, so `md:`/`lg:` and `vw`/`vh` read the *window*,
   not the frame. Use container variants **`@sm:` / `@lg:` …** and **`cqw`/`cqi`**
   units so the preview and the Figma export agree. For **device-relative height**,
   use **`min-h-full`:** it keys off the frame, not the window, and **never
   `vh`/`min-h-screen`/`100dvh`**, which read the browser window, so the section
   resizes as the browser resizes and diverges from the frame + the export.
   **Clip oversized decoration:** a decorative element sized larger than its container
   (a full-bleed sunburst/blob/oversized shape in `cqi`/`vw`, or anything centered with
   `-translate-x-1/2` at `>100%` width) **MUST sit in a section with `overflow-hidden`**
   (`cqi` is a % of the whole surface, not the parent, so it leaks past the page edge
   otherwise). The page must **never scroll horizontally.**
   **A full-screen ("fill the viewport") section uses the `fill-screen` utility for its
   height, then FLEXES its content, it never stacks two full heights.** Make the section
   **`fill-screen flex flex-col`**, `fill-screen` reads the screen directly (it's the one
   sanctioned viewport-height tool, use it, NOT raw `min-h-full`/`vh`, for a full-screen
   hero) so it fills in both the live preview and a Figma export with no parent-height
   plumbing. Its main content region fills with **`flex-1`** (never a *second* full-height
   declaration), and any secondary strip (stats row, scroll cue, logo bar) is a normal
   last child the flex pins to the bottom. Make that `flex-1` region a **flex column**
   (`flex flex-col justify-center`, or `justify-end` etc.) so its content actually centers
   in the slack, a **`grid` there won't center**, its single auto row hugs the top and
   leaves the slack below (put any multi-column split on an inner wrapper, e.g. a
   capped-width `@lg:w-7/12`). A second full-height block inside the section, or a
   full-height block *plus* a sibling, **ADD up and overflow:** it fills the screen but the
   content mis-centers and the strip spills past the fold.
   **Font-relative measures go on the element that carries the font.** `ch`/`em`
   resolve against the *declaring* element's own computed font, not its descendants'.
   So `max-w-[20ch]` on a plain wrapper around a big `font-ta-display` heading sizes to
   ~20 characters of *body* text (≈170px), not of the heading (≈800px), and the heading
   breaks a word or two per line (the "heading stacking vertically" bug). **Put
   `max-w-[Nch]` on the heading / `<p>` itself, never a font-less wrapper;** wrappers get
   `%`, `px`, a `max-w-*` scale value, or a flex basis. (`rem` is root-relative, so it's
   safe anywhere; and `Nch` on an UPPERCASE display line still under-measures, caps run
   wider than the `0` glyph `ch` samples, so treat it as a rough target, not a character count.)
2. **Tokens only, via utilities.** `bg-ta-*` / `text-ta-*` / `border-ta-*` for
   colors, `font-ta-display|serif|sans|mono` for type. Never raw hex/font stacks.
   Fall back to inline `style={{}}` only as a last resort. **Image scrims count:**
   the dark wash over a hero/CTA photo is still a token, use **`from-ta-ink/NN`**
   on the gradient (not `from-[#…]`), and for a rgba scrim inside an arbitrary value
   use `color-mix(in_srgb,var(--ta-ink)_NN%,transparent)`, never a raw `rgba(…)`.
3. **Mark every major section** on its root element with
   `data-block="{id}" data-block-name="{Name}"` (hero, feature grid, CTA, …).
   That marker is the entire declaration the Figma Block Library export needs.
   **Put it on the element that owns the section's spacing & background, not an
   inner card.** A block's box is exactly the marked element, and composed pages
   stack blocks flush (no gap added between them, the gap comes from each block's
   own `py-*`). So if the `py-*`/full-bleed `bg-*` lives on a **wrapper**
   (`<Reveal className="… pb-24">`, a `bg-* w-full` ancestor) while the marker sits
   on an inner card, that spacing/background is **outside** the block and the
   section exports flush / bare. Mark the outermost element carrying the `py-*`/`bg-*`
   (or, if a component wrapper like `Reveal` can't take the marker, wrap the card in
   a `<div data-block=…>` that holds the padding).
4. **Content is single-source.** Author copy/images once; `DesignSurface` renders
   that one node in every device frame. Make breakpoints differ only through
   responsive *styling*, never branch content on `view`, never duplicate text
   per device. Edit the variation's own `Header.tsx`/`Footer.tsx` once (its copy
   under `src/variations/{id}/components/`), not per page.
5. **Reuse, don't rebuild.** 40 shadcn components in `src/app/components/ui/`
   (button, card, dialog, tabs, accordion, carousel, form, …), `lucide-react`
   icons, `motion` for animation, `recharts` for charts. Compose classNames with
   `cn()` from `ui/utils.ts`. Reach for these before hand-rolling.
6. **Named `react` imports, never the `React.` namespace.** When you author a NEW
   component (a divergent `Header.tsx`, a menu, a section wrapper), import types and
   hooks by name, `import type { ReactNode } from "react"`, `import { useState } from
   "react"`, matching the app components. Do **not** reach for `React.ReactNode` /
   `React.useState`: page files have no global `React` (automatic JSX runtime), so it
   errors and costs a self-correction. (The shadcn `ui/*` files use `React.` only
   because they `import * as React`, don't copy that into a page/chrome component.)

## 4a. Honor the Design direction (when the prompt carries one)

Get-Designing builds inject a **`## Design direction`** block into the prompt: a sampled
compositional direction (a lens + specific motif choices) that keeps designs from
converging on the same generic layout. **When that block is present, it is authoritative
for the design's composition and look**, above your defaults:

- **Apply the lens character + directives** (grid, type feel, section rhythm, hero, motif
  vocabulary, density) as the design's visual language throughout.
- **Use the specific compositional choices it names** exactly (the eyebrow treatment, hero
  archetype, section rhythm, feature/content layout, dividers), not your habitual ones. If
  it says "no eyebrow labels" or "an asymmetric hero," do that, don't reflex back to a
  numbered eyebrow or a centered two-button hero.
- **Respect the "do not use" list.** The named overused defaults (numbered eyebrows,
  centered hero + two buttons, the identical hero→features→testimonials→pricing order,
  "X reasons why") are off unless the direction explicitly calls for them.
- **Hold it across the WHOLE page.** The strongest failure mode is opening on-direction then
  drifting back to the centroid halfway down. Re-read the block's choices as you build each
  section.
- **It governs TREATMENT; the brief/outline still governs CONTENT.** Which sections exist
  and what they say comes from the brief (and any reference outline); the direction governs
  *how* they are composed. Where a reference's canonical order would reproduce the exact
  centroid, let the direction's rhythm reshape it.
- **Never override an explicitly-named brand asset to fit the direction.** The fonts and
  colors the designer named (in the brief / the applied `--ta-*` tokens) are their choice,
  use them. The direction's "type feel" directive shapes *how* their font is used (weight,
  scale, pairing, as-texture), it does NOT license swapping in a different font family, and
  the same holds for the palette. Style their tokens to the direction; don't replace them.

No `## Design direction` block in the prompt = design as usual.

## 4b. Images, non-browser, download to `public/`, else placeholder

**Check `IMAGES=` from the session-start call.** If it's **`placeholder`**, the
designer chose *No images, placeholders only*: source nothing (no `curl`, no
`credits.json`), and hold every image spot with the FPO component,
`<ImagePlaceholder className="aspect-video w-full rounded-xl" label="Hero image" />`
(from `@/app/components/ImagePlaceholder`; real aspect/rounding + a short `label`).
Note in the wrap-up they're placeholders **by preference**, not failures. Any other
value = the sourcing flow below.

**Never open a headless browser or screenshot to find images** (gated, inconsistent).
Source over plain HTTP:

1. **Download into `public/`.** A same-origin file resolves in both the preview and
   the Figma export; external CDN URLs render in preview but the export *skips* any
   that stall/CORS. One bounded attempt:
   `curl -fsS --max-time 8 -o public/images/hero.jpg "<url>"`, reference `/images/hero.jpg`.
2. **Fast 200 → use it. Anything else (timeout/non-200/error) → placeholder, move on.**
   The `curl` is allowlisted (never prompts) and bounded (can't hang). **Don't retry,
   escalate to a browser, or stop to ask**, drop the network-free `<ImagePlaceholder>`
   at the right aspect ratio and keep building.
3. **Track every placeholder and report them in the closing summary** (which section,
   what it should be), e.g. "2 images couldn't be fetched, placeholders in the hero and
   testimonial, send them and I'll drop them in." Never leave silent placeholders.
4. **Single-source** (rule 4): author each image once; `DesignSurface` renders it in
   every device frame.
5. **Record each image's licence → `public/images/credits.json`** (fresh per design,
   only images you actually used; placeholders get no entry):
   ```json
   { "images": [
     { "file": "hero.jpg",  "source": "unsplash.com", "url": "<url>", "free": true },
     { "file": "team1.jpg", "source": "acme.com",     "url": "<url>", "free": false }
   ] }
   ```
   **`free: true` ONLY** for a known free source (Unsplash, Pexels, Pixabay, Wikimedia,
   explicit public-domain/CC0); everything else (brand site, generic CDN, search result)
   is **`free: false`** (unsure → false). `source` = origin domain, `url` = the exact URL
   fetched (the badge links to it). `DesignSurface` reads this and shows a small "not free
   to reuse" badge (lower-left, local-dev only, excluded from the Figma export + Vercel
   preview).

## 4c. Global chrome & menus, shipped by DesignSurface, don't rebuild

The **Header, Footer, and mobile menu are already built and rendered globally** by
`DesignSurface` (once, for every page/breakpoint/variation), so a design page never
hand-rolls site nav. What you touch:

- **Header/Footer live in the variation's own components** (`src/variations/{id}/
  components/Header.tsx` / `Footer.tsx`, resolved per-variation, falling back to base).
  Both map [`pages.ts`](../../src/app/pages.ts), so **adding a page auto-adds its nav
  link**, don't wire nav by hand. Edit these once; the change cascades everywhere
  (single-source, rule 4).
- **Brand logo:** when the brief supplied a logo, `VITE_BRAND_LOGO` is set and
  `siteConfig.logo` is a `public/` path. The base Header/Footer already render it (an
  `<img>` in place of the `siteConfig.clientName` wordmark). **If you author a divergent
  `Header.tsx`/`Footer.tsx`, keep that logo-vs-wordmark branch** (`siteConfig.logo ?
  <img …/> : siteConfig.clientName`) so the logo isn't lost, capped to a sensible height
  with aspect preserved.
- **The logo/wordmark IS the home link, don't add a standalone "Home" nav item.** A
  separate "Home" link reads dated; the brand lockup fills that role. Link the logo to
  home (`?v={id}`) and **omit the home page from the nav list** (filter it out of the
  `pages.ts` map when rendering nav, keep About / Work / Pricing / Contact / etc.).
- **Vary the header's height + proportion to the design, it's a design choice, not a
  constant.** Don't default every site to the same thin fixed bar. Let the direction and
  brand drive it: a bold / editorial / luxury design can carry a taller, more generous
  header (larger logo, more padding, even a two-row or split header); a dense / utility one
  stays compact. Match the header's weight to the design instead of reaching for one stock
  height every time.
- **Mobile menu ships by default** ([MobileMenu.tsx](../../src/app/components/MobileMenu.tsx)),
  a slide-in drawer, the designer never has to ask for one. It's an **in-frame overlay**
  (not a portal), the Header hamburger toggles it via shared state, and it slides from
  **`MENU_SIDE`** (the same edge the hamburger sits on, one constant positions both).
  Diverge per variation by dropping `MobileMenu.tsx` into the variation folder.
- **Desktop nav dropdown/mega panels** are configured per nav item in
  [`menu.ts`](../../src/app/menu.ts) (`none` / `dropdown` / `mega`, seeded from the
  setup `VITE_MENU_STYLE`, mix per item there). Panels are in-frame overlays in the
  Header (mega spans the content column). Open/active state is shared via
  [`menuState.ts`](../../src/app/menuState.ts). **Both dropdown AND mega panels render at
  HEADER level (not inside the nav item) with `absolute top-full`, so they anchor flush to
  the header's BOTTOM edge**, a dropdown measures its trigger (`[data-menu-item]`) to
  position under it. **Never anchor a dropdown inside its `relative` nav item** (its
  `top-full` then lands at the item's bottom, mid-header, floating beneath the item instead
  of dropping from the header). Match the base `Header.tsx` pattern when you diverge one.
- **In-frame chrome must not portal.** shadcn `Sheet`/`Dialog`/`Drawer`/`Popover`
  render to `document.body` and escape the device frame, use inline absolute
  positioning (like `MobileMenu` / the Header menus) for anything meant to live inside
  the frame. (If a menu/overlay shows in the wrong place, that's the classic symptom
  for [`/diagnose`](diagnose.md).)
- **Chrome is website-only** (`projectType === "website"`); app/brand projects render
  none. A single page opts out with **`chrome={false}`** on `<DesignSurface>` (e.g. a
  full-bleed landing).

## 4d. Accessibility (WCAG 2.1 AA), opt-in

**Accessibility is OPT-IN, and OFF by default** — so it never constrains the creative work.
**Only engage this section when `A11Y=aa`** (from the session-start flags, alongside
`IMAGES`/`RESEARCH`). When it's off (the default), **ignore §4d entirely and author with full
freedom**; nothing here applies.

When `A11Y=aa`, the design ships **built to WCAG 2.1 AA**. Color contrast is handled for you:
the `--ta-*` tokens are made contrast-safe as *pairs* at brand-apply time (`apply-brand.mjs
--aa` + `scripts/lib/contrast.mjs`), so you never hand-check a ratio, **just use the tokens,
never hardcode a hex** (rule 1). The rest is markup discipline, follow these while authoring:

1. **Structure & landmarks.** Exactly **one `<h1>`** per page, then headings in order
   with **no level skips** (`h1→h2→h3`, never `h1→h3`). Use real landmarks
   (`<main>` for the page body; `<section>` with a heading per block; `<nav>`/`<header>`/
   `<footer>` come from the global chrome). Use `<ul>/<ol>` for lists, `<button>` for
   actions, `<a>` for navigation, never a `<div>` with an onClick.
2. **Images.** Every `<img>` has an `alt`: a **meaningful** description for content
   images, **`alt=""`** for purely decorative ones. The FPO `ImagePlaceholder` already
   sets `role="img"` + a label, so placeholders are covered.
3. **Color is never the only signal.** Don't convey meaning with color alone (state,
   required, error). **Links in body copy get a non-color affordance, an underline**
   (or equivalent), not just the brand color, this honors the P7/P8 link flag from the
   contrast gate and covers color-blind readers.
4. **Focus is always visible.** Every interactive element shows a clear focus ring;
   **never remove `outline` without replacing it** (`focus-visible:ring-2 ring-ta-primary`
   or similar). Keep focus order = reading order (don't reorder with positive `tabindex`).
5. **Targets ≥ 24×24px.** Interactive targets (icon buttons, close X's, nav toggles) are
   at least 24px each way (SC 2.5.8); give small glyphs padding to reach it.
6. **Respect reduced motion.** Wrap non-essential animation/parallax/autoplay in
   `motion-reduce:*` utilities or a `prefers-reduced-motion` guard (also for any `motion`/
   WAAPI you drive), so it stills for users who ask.
7. **Forms.** Every control has a programmatic label (`<label htmlFor>` or `aria-label`),
   not just a placeholder; errors are conveyed in **text**, not color alone; group related
   inputs with `<fieldset>/<legend>`.

The shadcn/Radix `ui/*` components are already keyboard- and ARIA-accessible, so when AA mode
is on, composing from them (rather than hand-rolling) starts you compliant. In AA mode these
rules are in force and the post-turn audit checks them. **Off (the default): none of this
applies — the palette is written exactly as chosen and the design is authored freely.**

## 5. Verify, the designer's eyes, not a screenshot

The dev server hot-reloads, so the change is live at http://localhost:5173 the
moment you save, and **the designer is watching it there.** That live preview is
the verification surface (not Vercel, not a test suite, and **not a screenshot**).
Save, note the milestone in plain language, and invite the next adjustment.

**Do NOT screenshot your own work to "check it looks right."** You have no eyes on
the browser, the designer does, and every capture you Read costs ~1k+ tokens and
piles up fast across a build (a dozen self-checks is a dozen images sitting in
context for the rest of the session). Trust the hot-reload; let the designer be the
one to say something's off. Screenshotting is a **diagnostic** tool, reserved for a
reported symptom, not a routine post-section habit.

**Only when a visual bug is actually reported**, the designer says something isn't
showing, is cut off, mispositioned, or hidden behind another element, do you reach
for the capture route: invoke [`/diagnose`](diagnose.md). It carries the reflex
(headlessly screenshot the `?capture=` route and *look*) plus a symptom→cause→fix
table for this scaffold's layering, clipping, and container-query gotchas. Don't
spelunk the code blind, don't ask the designer to open dev tools, and don't
screenshot speculatively before there's a symptom to chase.

**Ignore IDE type noise.** Editing a `.tsx` here often lights up a wall of
`JSX.IntrinsicElements` / `Cannot find module '@/config/site'` /
`react/jsx-runtime` diagnostics, that's the editor's TS server failing to
resolve `node_modules` types, **not** real errors. Vite compiles fine and the
preview is the source of truth. Don't chase them; only act on a diagnostic that's
clearly yours (a dangling import, a typo, an undefined variable).

If `$ARGUMENTS` carries the designer's brief, treat it as the page request and
start building; otherwise ask what they want to design first.
