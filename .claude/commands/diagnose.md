---
description: Diagnose a visual bug, "X isn't showing", cut off, mispositioned, or layered wrong. The screenshot-the-capture-route reflex + a symptom→cause→fix table for this scaffold's gotchas, so you resolve it without the designer opening dev tools.
---

Invoke this the moment a designer reports a **visual symptom:** something
**isn't showing, is cut off, sits in the wrong place, overlaps, is hidden behind
another element, or looks different from what they expect:** in the live preview
or the Figma export. The designer is not going to open dev tools; **you** find and
fix it. This is the playbook.

**This is REACTIVE only.** The screenshot reflex below is for a symptom someone has
reported (or one you can already see is concretely broken), **never a proactive
"let me make sure the build looks right" check.** During a normal build you do not
screenshot your own work, the designer is watching the live preview and will tell
you if something's off (see [`/design`](design.md) §5). Each capture you Read costs
~1k+ tokens and stays in context the rest of the session, so spend one only on a
real symptom, not on speculation.

## 0. THE reflex, screenshot the capture route FIRST, then LOOK

Before theorizing, **see what the designer sees.** The design surface renders in
an isolated, chrome-free capture mode at the running preview's base URL:

```
{preview}/?v={id}&capture={view}
```

`{preview}` is the live dev-server base: **use `$TA_PREVIEW_URL`** (the app exports
it, set to this project's actual port), falling back to `http://localhost:5173`
when it isn't set. **Never hardcode `:5173`**, with more than one project open the
port can be `:5174`/`:5175`, and a stale capture against the wrong port silently
returns nothing.

- `{id}`, the variation in the preview URL (`v00` is the base). Check the `?v=`
  the designer is on; when unsure, `v00`.
- `{view}`, `desktop` | `tablet` | `mobile`.
- **Menus:** add `&menu=open` for the **mobile drawer**; add
  `&menu=open&item={id}` (with `capture=desktop`) for a **desktop dropdown/mega**
  panel. This is the only way to snapshot a menu, it's an in-frame overlay, not a
  page section.

Headlessly screenshot it and **actually look at the image:** the same loop the
export tooling uses. Copy-pasteable driver (needs Node ≥ 20.19; `nvm use` first if
the shell node is older):

```js
// scratchpad/shot.mjs  →  node scratchpad/shot.mjs
import puppeteer from "puppeteer";
const WIDTHS = { desktop: 1440, tablet: 664, mobile: 370 }; // scaffold defaults
const view = process.argv[2] || "mobile";
// The app sets TA_PREVIEW_URL to this project's real Vite port; fall back to :5173.
const base = (process.env.TA_PREVIEW_URL || "http://localhost:5173").replace(/\/+$/, "");
const url  = process.argv[3] || `${base}/?v=v00&capture=${view}`;
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
container queries reflow exactly as in preview *and* export), so what you see
here is ground truth for both. If it looks wrong in the screenshot, it's a real
layout bug; if it looks right in the screenshot but wrong to the designer, it's an
**interactive-only** state (hover, click, scroll, see the menu note below).

**Pinpoint what's actually on top** when things overlap, inject a hit-test
instead of guessing z-index:

```js
const hit = await p.evaluate((x, y) => {
  const el = document.elementFromPoint(x, y);
  return el && { tag: el.tagName, cls: el.className, id: el.id };
}, 200, 120); // a point where the missing element should be
```

If `elementFromPoint` returns something *other* than the element that should be
there, that other element is covering it, a stacking/overlap problem (§ table).

## 1. Symptom → cause → check → fix

| Symptom | Likely cause | Check | Fix |
|---|---|---|---|
| Menu/dialog/overlay **missing or in the wrong spot** inside the phone/tablet frame | A **portal** overlay (shadcn `Sheet`/`Dialog`/`Drawer`/`Popover`/`Tooltip`) renders to `document.body`, escaping the device frame | Is it a Radix/shadcn portal component? Does it appear *outside* the frame in the real browser window? | Use **in-frame inline positioning** like `MobileMenu.tsx` / the Header menus (absolute inside the surface, no portal). Don't portal in-frame chrome. |
| Desktop nav/hamburger shows at the **wrong breakpoint** in the frame (e.g. desktop nav inside the phone) | `md:` / `lg:` / `vw` / `vh` read the **window**, not the fixed-width frame | Search the element for viewport variants/units | Switch to **container-query variants `@sm:`/`@lg:`…** and **`cqw`/`cqi`** units, they key off the frame width, so preview == export. |
| Content **resizes when the browser window height changes** | Content uses **`vh` / `min-h-screen` / `100dvh`:** viewport-height units always read the window, never a container | Grep the section for `vh`/`min-h-screen`/`dvh`/`svh` | Use **`min-h-full` / `h-full`:** resolves to the fixed device screen height. Never `vh` for in-frame content. |
| A **full-screen hero doesn't fill the viewport / collapses to content height** on a longer page | The section uses **`min-h-full`** for a full-viewport fill — `min-height:100%` needs a definite-height parent, and on a normally-scrolling page there isn't one, so it resolves to content height | Grep the hero section for `min-h-full` (or `h-full`) where a full-screen fill was intended | Use the **`fill-screen`** utility instead (it's `100dvh` — reads the screen directly, no parent-height dependency; fills in preview and export alike). |
| A **full-screen hero fills the height but its content sits mis-centered**, or a stats/scroll strip **spills past the fold** | **Stacked full heights:** a second full-height block (`fill-screen`/`min-h-full`) *and*/or a sibling strip inside a **non-flex** `fill-screen` section, so heights add and exceed the frame | Does the `fill-screen` section have >1 in-flow child, or an inner block that ALSO carries a full-height class? | Make the section **`fill-screen flex flex-col`** and the fill region a **flex column** `flex-1 flex flex-col justify-center` (no second full-height class); a **`grid` there won't center** — its auto row hugs the top, so move any column split to an inner capped-width wrapper. Leave the strip as the pinned last child. |
| Element **cut off / clipped** at an edge | An **ancestor** has `overflow-hidden`/`overflow-clip` (or a fixed height) clipping the child | Walk up the parents for `overflow-hidden`, `overflow-clip`, `max-h-*`, fixed `h-*` | Remove/relax the clip on the clipping **ancestor**, or `overflow-visible` there. Don't just shrink the child. |
| Element **just not visible** though it's "there" in the DOM | Translated off-screen, `opacity-0`, `pointer-events-none`, or **0-size hug collapse** (a flex/inline child with no intrinsic size) | Hit-test the spot; check computed `transform`, `opacity`, width/height | Reset the offending property; for hug-collapse give it explicit size or a non-zero flex basis / `min-w`. |
| Heading (or paragraph) **wraps / stacks vertically far too early**, breaking a word or two per line, in much less horizontal space than intended | A **font-relative measure on a font-less wrapper:** `max-w-[Nch]`/`max-w-[Nem]` on an element with **no `font-*` class** wrapping a big-font descendant. `ch`/`em` resolve against the *declaring* element's inherited font (body ≈16px), not the heading's display font, so the cap is a fraction of the intended width (a `20ch` wrapper ≈170px vs the heading's ≈800px) | Walk the heading's ancestors for `max-w-[…ch]`/`max-w-[…em]` sitting on a wrapper that carries no `font-*` class | **Move the `max-w-[Nch]` onto the text element that carries the font** (the `h2`/`<p>`). Give wrappers `%`, `px`, a `max-w-*` scale, or a flex basis. (`rem` is safe, root-relative; uppercase under-measures vs the `0` glyph, so `Nch` is a rough target.) |
| A **section/footer/card background (or text) colour isn't showing** — the element renders on the page ground instead, and white/light text on it is nearly invisible | A **phantom `ta-*` utility:** `bg-ta-<name>` / `text-ta-<name>` for a `<name>` that isn't one of the seven registered roles (`primary/accent/surface/ink/body/muted/border`). Tailwind generates those utilities ONLY from `theme.css`'s `@theme`, so an invented extended-palette class (`bg-ta-sand`, `bg-ta-walnut`) emits **no CSS** and renders nothing | Grep the element for `-ta-<name>` where `<name>` isn't a registered role; confirm `--color-ta-<name>` is absent from `theme.css` | Define `--ta-<name>` in the variation's `tokens.css` and switch to **`bg-[var(--ta-<name>)]`** / `text-[var(--ta-<name>)]` (works per-variation, upgrade-safe), or use a registered role. Never a bare `bg-ta-<name>` for an unregistered color. |
| Element **hidden behind** another (the classic layering bug) | **Stacking context:** `z-index` only competes *within the same context*. A high `z-index` on the child loses if its **ancestor's** context sits below the covering element's | Identify who creates a stacking context (see below) and which contexts are actually competing | **Elevate the correct ANCESTOR's context:** e.g. Header is `sticky top-0 z-[60]` so its dropdown/mega panels clear page content; MobileMenu scrim/drawer sit `z-[70]/z-[80]` above it. **Don't** pile z-index on the child, and **don't** shove content behind with `z-index:-1` (a blunt hack that breaks other things). |
| Menu shows in the **`&menu=open` screenshot** but not when the designer hovers/clicks | Interactive **state**, not layout, hover target, toggle wiring, or `menuState`/`mobileMenu` shared state | Reproduce with the menu URL; if it renders there, layout is fine | Trace the toggle (`menu.ts` / `menuState.ts` / `mobileMenu.ts` / the Header hover handler), not the CSS. |

## 2. Stacking contexts, the one concept behind most "hidden behind" bugs

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
content it must cover, which is exactly why the Header is `sticky top-0 z-[60]`.
When stuck, hit-test with `elementFromPoint` (§0) to learn the *actual* top
element, then walk up from it to find the context that's winning.

## 3. Close the loop

After a fix, **re-screenshot the same capture route** and confirm the symptom is
gone in the image before telling the designer. Report in plain language ("Fixed,
the mega panel now sits above the hero"), not CSS mechanics, unless they ask how.
