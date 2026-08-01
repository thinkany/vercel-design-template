---
description: Build or edit a design page (the post-setup design phase) — the condensed authoring contract + progress protocol, so you go straight to designing without re-deriving the rules
---

Use this the moment a designer asks to **build, design, create, lay out, or edit
a page/section/hero/landing** after `/setup-project` + `/setup-styleguide` — the
freeform design phase. It exists to make the FIRST design fast: it inlines the
authoring contract so you don't re-read `Home.tsx`, `DesignSurface.tsx`,
`pages.ts`, and `site.ts` every time. Read this, do the **one** live read below,
then build.

## 0. Communication protocol — calm, plain-language, low-chatter

The designer is watching the live preview, not the terminal. During a build,
**suppress technical narration** (imports, prop threading, token mechanics,
file-by-file play-by-play). Instead:

1. **Open with one sentence** naming what you're about to build ("Building your
   home page — top nav, hero, a feature row, and footer.").
2. **Post a TodoWrite list phrased in designer language**, one item per section —
   e.g. `Creating top navigation`, `Building hero`, `Adding feature grid`,
   `Wiring footer`. That list IS the progress surface. Mark each `in_progress`
   as you start it and `completed` as it lands. No prose per todo.
3. **One short plain-language line per milestone**, only when a section is done
   and visible ("Hero's in — headline, subhead, two buttons on the cream
   background."). Talk in design terms (nav, hero, cards, CTA), never in code
   terms (components, props, tokens, hooks).
4. **Close** by pointing at the preview: "Done — it's live at localhost:5173,
   hot-reloaded. Want me to adjust the hero copy or spacing?" **If any images fell
   back to placeholders** (see §4b), list them here so the designer can supply the
   real assets — don't leave them unmentioned.

Keep technical detail for when the designer explicitly asks "how did you…". If
something genuinely blocks you (a missing token, an ambiguous request), say so
plainly and briefly.

## Preview server — make sure it's live (do this on the FIRST build of a session)

The design only appears if the Vite dev server is running. On the **first** build
request of a session, check before diving in:

- **Is it up?** `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173` —
  `200` means live; anything else means it isn't.
- **If it's not running, OFFER to start it** (it's a command — ask first, don't
  silently launch): run **`npm run dev`** in the background. This project needs
  **Node ≥ 20.19** (`.nvmrc` pins 22); if the shell's active node is older, select
  the pinned version first (e.g. `nvm use`) then `npm run dev`.
- Once it's up (or already was), point the designer at **http://localhost:5173**
  and build.

**Stopping it — tell the designer how.** They can stop the preview whenever: just
say "stop the server" / "free port 5173" and you'll shut it down, or press
**Ctrl+C** in the terminal that's running it.

**Remind them of `/guide`.** Mention they can type **`/guide`** at any time to see
every command this project offers (setup, design, this guide, preview controls).

## 1. Fastest path — where the design goes

**Every design is a variation. Base v00 is the pristine template blueprint — never
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
  (one click — copies base → `v01`), then design in `v01`. **Don't design into the
  base as a shortcut.**

## 2. The one live read — the palette

Tokens change per project — and per variation — after `/setup-styleguide`, so
**read the active variation's `src/variations/{id}/styles/tokens.css` once** (it
falls back to base `src/styles/tokens.css` if the variation hasn't diverged its
palette) for the live `--ta-*` colors and `--ta-font-*` families. Use those tokens
(via the Tailwind utilities below) — **never hardcode a hex or font stack.** That
single read replaces crawling six files.

## 3. The authoring contract (already inlined — don't re-read the source)

Every design page is a **content function wrapped in `<DesignSurface>`**.
`DesignSurface` supplies the responsive preview, the device frames, isolated
Figma-capture mode, and the global Header/Footer — so the page only supplies
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
`{ id: "about", route: "about", name: "About", component: "About" }` — that wires
routing (`?v={id}&about`), rendering, the nav link, and Figma export. No
`App.tsx` edit. Full-bleed landing with no Header/Footer? add `chrome={false}` to
`<DesignSurface>`.

## 4. The five rules that matter (the rest is noise for this phase)

1. **Container queries, NOT viewport.** The design renders in a fixed-width device
   frame inside the real window, so `md:`/`lg:` and `vw`/`vh` read the *window*,
   not the frame. Use container variants **`@sm:` / `@lg:` …** and **`cqw`/`cqi`**
   units so the preview and the Figma export agree. For **device-relative height**,
   use **`min-h-full`** — it keys off the frame, not the window — and **never
   `vh`/`min-h-screen`/`100dvh`**, which read the browser window, so the section
   resizes as the browser resizes and diverges from the frame + the export.
2. **Tokens only, via utilities.** `bg-ta-*` / `text-ta-*` / `border-ta-*` for
   colors, `font-ta-display|serif|sans|mono` for type. Never raw hex/font stacks.
   Fall back to inline `style={{}}` only as a last resort.
3. **Mark every major section** on its root element with
   `data-block="{id}" data-block-name="{Name}"` (hero, feature grid, CTA, …).
   That marker is the entire declaration the Figma Block Library export needs.
4. **Content is single-source.** Author copy/images once; `DesignSurface` renders
   that one node in every device frame. Make breakpoints differ only through
   responsive *styling* — never branch content on `view`, never duplicate text
   per device. Edit the variation's own `Header.tsx`/`Footer.tsx` once (its copy
   under `src/variations/{id}/components/`), not per page.
5. **Reuse, don't rebuild.** 40 shadcn components in `src/app/components/ui/`
   (button, card, dialog, tabs, accordion, carousel, form, …), `lucide-react`
   icons, `motion` for animation, `recharts` for charts. Compose classNames with
   `cn()` from `ui/utils.ts`. Reach for these before hand-rolling.

## 4b. Images — non-browser, download to `public/`, else placeholder

Design generation is code — no browser. Gathering images is the same:
**never open a headless/automation browser or screenshot to find images** (it gets
permission-gated and is inconsistent). Source them over plain HTTP instead:

1. **Default: download into `public/`.** A same-origin local file always resolves —
   in the live preview **and** in the Figma export's asset-fetch (external CDN URLs
   render in preview but the export *skips* any that block/stall — see below). One
   **bounded, fast** attempt from a stable URL, e.g.
   `curl -fsS --max-time 8 -o public/images/hero.jpg "<url>"` (`-f` = fail on
   non-200, `--max-time` = don't hang). Reference it as `/images/hero.jpg`.
2. **Quick 200 → use it. Anything else → placeholder, move on.** The fetch is
   **non-interactive** (the scaffold allowlists `curl`, so it never prompts) and
   **bounded** (it can't hang). If it isn't a fast success (timeout, non-200,
   error), **do not retry, do not escalate to a browser, do not stop to ask** —
   drop in a **network-free placeholder** (a token-colored block at the right aspect
   ratio, e.g. `<div className="aspect-video bg-ta-border rounded" />`) and keep
   building. **Don't interrupt the design over a missing image.**
3. **Track placeholders → report them in the closing summary.** Keep a running list
   of every image that fell back to a placeholder (which section, what it should
   be). When the design is ready to view, tell the designer plainly in the wrap-up —
   e.g. "Heads-up: 2 images couldn't be fetched, so I used placeholders in the hero
   and the testimonial — send me those and I'll drop them in." Never leave silent
   placeholders.
4. **Single-source still applies** (rule 4): author the image once; `DesignSurface`
   renders it across every device frame.

Why local over hotlinking: the Figma export fetches each image URL with a bounded
timeout and **skips a slow/blocked/CORS'd CDN image** (empty box in Figma), so a
`public/` file is the only source guaranteed to survive both preview and export.

## 5. Verify

The dev server hot-reloads, so the change is live at http://localhost:5173 the
moment you save — that's the verification surface (not Vercel, not a test suite).
Glance at the preview, then invite the next adjustment.

**Something not showing / cut off / mispositioned / hidden behind another
element?** Don't spelunk the code blind or ask the designer to open dev tools —
invoke [`/diagnose`](diagnose.md). It carries the reflex (headlessly screenshot
the `?capture=` route and *look*) plus a symptom→cause→fix table for this
scaffold's layering, clipping, and container-query gotchas.

**Ignore IDE type noise.** Editing a `.tsx` here often lights up a wall of
`JSX.IntrinsicElements` / `Cannot find module '@/config/site'` /
`react/jsx-runtime` diagnostics — that's the editor's TS server failing to
resolve `node_modules` types, **not** real errors. Vite compiles fine and the
preview is the source of truth. Don't chase them; only act on a diagnostic that's
clearly yours (a dangling import, a typo, an undefined variable).

If `$ARGUMENTS` carries the designer's brief, treat it as the page request and
start building; otherwise ask what they want to design first.
