---
description: Diagnose a visual bug — "X isn't showing", cut off, mispositioned, or layered wrong. The screenshot-the-capture-route reflex + a symptom→cause→fix table for this scaffold's gotchas, so you resolve it without the designer opening dev tools.
---

Invoke this the moment a designer reports a **visual symptom** — something
**isn't showing, is cut off, sits in the wrong place, overlaps, is hidden behind
another element, or looks different from what they expect** — in the live preview
or the Figma export. The designer is not going to open dev tools; **you** find and
fix it. This is the playbook.

## 0. THE reflex — screenshot the capture route FIRST, then LOOK

Before theorizing, **see what the designer sees.** The design surface renders in
an isolated, chrome-free capture mode at:

```
http://localhost:5173/?v={id}&capture={view}
```

- `{id}` — the variation in the preview URL (`v00` is the base). Check the `?v=`
  the designer is on; when unsure, `v00`.
- `{view}` — `desktop` | `tablet` | `mobile`.
- **Menus:** add `&menu=open` for the **mobile drawer**; add
  `&menu=open&item={id}` (with `capture=desktop`) for a **desktop dropdown/mega**
  panel. This is the only way to snapshot a menu — it's an in-frame overlay, not a
  page section.

Headlessly screenshot it and **actually look at the image** — the same loop the
export tooling uses. Copy-pasteable driver (needs Node ≥ 20.19; `nvm use` first if
the shell node is older):

```js
// scratchpad/shot.mjs  →  node scratchpad/shot.mjs
import puppeteer from "puppeteer";
const WIDTHS = { desktop: 1440, tablet: 664, mobile: 370 }; // scaffold defaults
const view = process.argv[2] || "mobile";
const url  = process.argv[3] || `http://localhost:5173/?v=v00&capture=${view}`;
const b = await puppeteer.launch();
const p = await b.newPage();
await p.setViewport({ width: WIDTHS[view], height: 900, deviceScaleFactor: 2 });
await p.goto(url, { waitUntil: "networkidle0" });
await p.waitForSelector("[data-capture-ready]", { timeout: 15000 });
await p.screenshot({ path: `scratchpad/shot-${view}.png`, fullPage: true });
await b.close();
```

Then **Read the PNG** and compare against the designer's description. The capture
route uses the **real responsive CSS** (it sets the true viewport width, so
container queries reflow exactly as in preview *and* export) — so what you see
here is ground truth for both. If it looks wrong in the screenshot, it's a real
layout bug; if it looks right in the screenshot but wrong to the designer, it's an
**interactive-only** state (hover, click, scroll — see the menu note below).

**Pinpoint what's actually on top** when things overlap — inject a hit-test
instead of guessing z-index:

```js
const hit = await p.evaluate((x, y) => {
  const el = document.elementFromPoint(x, y);
  return el && { tag: el.tagName, cls: el.className, id: el.id };
}, 200, 120); // a point where the missing element should be
```

If `elementFromPoint` returns something *other* than the element that should be
there, that other element is covering it — a stacking/overlap problem (§ table).

## 1. Symptom → cause → check → fix

| Symptom | Likely cause | Check | Fix |
|---|---|---|---|
| Menu/dialog/overlay **missing or in the wrong spot** inside the phone/tablet frame | A **portal** overlay (shadcn `Sheet`/`Dialog`/`Drawer`/`Popover`/`Tooltip`) renders to `document.body`, escaping the device frame | Is it a Radix/shadcn portal component? Does it appear *outside* the frame in the real browser window? | Use **in-frame inline positioning** like `MobileMenu.tsx` / the Header menus (absolute inside the surface, no portal). Don't portal in-frame chrome. |
| Desktop nav/hamburger shows at the **wrong breakpoint** in the frame (e.g. desktop nav inside the phone) | `md:` / `lg:` / `vw` / `vh` read the **window**, not the fixed-width frame | Search the element for viewport variants/units | Switch to **container-query variants `@sm:`/`@lg:`…** and **`cqw`/`cqi`** units — they key off the frame width, so preview == export. |
| Content **resizes when the browser window height changes** | Content uses **`vh` / `min-h-screen` / `100dvh`** — viewport-height units always read the window, never a container | Grep the section for `vh`/`min-h-screen`/`dvh`/`svh` | Use **`min-h-full` / `h-full`** — resolves to the fixed device screen height. Never `vh` for in-frame content. |
| Element **cut off / clipped** at an edge | An **ancestor** has `overflow-hidden`/`overflow-clip` (or a fixed height) clipping the child | Walk up the parents for `overflow-hidden`, `overflow-clip`, `max-h-*`, fixed `h-*` | Remove/relax the clip on the clipping **ancestor**, or `overflow-visible` there. Don't just shrink the child. |
| Element **just not visible** though it's "there" in the DOM | Translated off-screen, `opacity-0`, `pointer-events-none`, or **0-size hug collapse** (a flex/inline child with no intrinsic size) | Hit-test the spot; check computed `transform`, `opacity`, width/height | Reset the offending property; for hug-collapse give it explicit size or a non-zero flex basis / `min-w`. |
| Element **hidden behind** another (the classic layering bug) | **Stacking context** — `z-index` only competes *within the same context*. A high `z-index` on the child loses if its **ancestor's** context sits below the covering element's | Identify who creates a stacking context (see below) and which contexts are actually competing | **Elevate the correct ANCESTOR's context** — e.g. Header is `sticky top-0 z-[60]` so its dropdown/mega panels clear page content; MobileMenu scrim/drawer sit `z-[70]/z-[80]` above it. **Don't** pile z-index on the child, and **don't** shove content behind with `z-index:-1` (a blunt hack that breaks other things). |
| Menu shows in the **`&menu=open` screenshot** but not when the designer hovers/clicks | Interactive **state**, not layout — hover target, toggle wiring, or `menuState`/`mobileMenu` shared state | Reproduce with the menu URL; if it renders there, layout is fine | Trace the toggle (`menu.ts` / `menuState.ts` / `mobileMenu.ts` / the Header hover handler), not the CSS. |

## 2. Stacking contexts — the one concept behind most "hidden behind" bugs

A `z-index` is only ranked **against siblings in the same stacking context**. An
element creates a **new** stacking context (trapping its children's z-index) when
it has any of:

- `position` other than `static` **with** a `z-index`
- `transform`, `filter`, `perspective`, `clip-path`, `mask` (any non-`none` value)
- `opacity` < 1
- `will-change` of a context-forming property
- `isolation: isolate`
- a flex/grid **item** with a `z-index`

So a dropdown deep inside a section can never rise above a *sibling section* of its
ancestor, no matter how big its `z-index`, if the ancestor's own context ranks
lower. **The fix is always at the ancestor boundary**: give the ancestor that
should win (usually the Header/overlay host) a stacking context that outranks the
content it must cover — which is exactly why the Header is `sticky top-0 z-[60]`.
When stuck, hit-test with `elementFromPoint` (§0) to learn the *actual* top
element, then walk up from it to find the context that's winning.

## 3. Close the loop

After a fix, **re-screenshot the same capture route** and confirm the symptom is
gone in the image before telling the designer. Report in plain language ("Fixed —
the mega panel now sits above the hero"), not CSS mechanics, unless they ask how.
