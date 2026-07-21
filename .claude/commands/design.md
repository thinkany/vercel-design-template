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
   hot-reloaded. Want me to adjust the hero copy or spacing?"

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

- **Design #1 = edit the base in place.** Replace the placeholder content in
  `src/app/components/Home.tsx` (the `HomeContent` function). Do **not** create a
  variation for the first design — variations are a deliberate later act (an
  *alternative* version of an existing design). The starter `Home.tsx` imports
  `siteConfig`; if your design stops using it, **drop the import too** or it dangles.
- **A variation** (`?v={id}` other than `v00`) → edit under
  `src/variations/{id}/components/` **only**, never the base, or you change every
  variation that falls back to v00.
- Check the `?v=` in the current preview URL to know the scope. When unsure, ask.

## 2. The one live read — the palette

Tokens change per project after `/setup-styleguide`, so **read
`src/styles/tokens.css` once** for the live `--ta-*` colors and `--ta-font-*`
families this project actually has. Use those tokens (via the Tailwind utilities
below) — **never hardcode a hex or font stack.** That single read replaces
crawling six files.

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
      className="min-h-full w-full bg-ta-cream flex flex-col items-center justify-center px-8 py-20 text-center"
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
   units so the preview and the Figma export agree.
2. **Tokens only, via utilities.** `bg-ta-*` / `text-ta-*` / `border-ta-*` for
   colors, `font-ta-display|serif|sans|mono` for type. Never raw hex/font stacks.
   Fall back to inline `style={{}}` only as a last resort.
3. **Mark every major section** on its root element with
   `data-block="{id}" data-block-name="{Name}"` (hero, feature grid, CTA, …).
   That marker is the entire declaration the Figma Block Library export needs.
4. **Content is single-source.** Author copy/images once; `DesignSurface` renders
   that one node in every device frame. Make breakpoints differ only through
   responsive *styling* — never branch content on `view`, never duplicate text
   per device. Edit the shared `Header.tsx`/`Footer.tsx` once, not per page.
5. **Reuse, don't rebuild.** 40 shadcn components in `src/app/components/ui/`
   (button, card, dialog, tabs, accordion, carousel, form, …), `lucide-react`
   icons, `motion` for animation, `recharts` for charts. Compose classNames with
   `cn()` from `ui/utils.ts`. Reach for these before hand-rolling.

## 5. Verify

The dev server hot-reloads, so the change is live at http://localhost:5173 the
moment you save — that's the verification surface (not Vercel, not a test suite).
Glance at the preview, then invite the next adjustment.

**Ignore IDE type noise.** Editing a `.tsx` here often lights up a wall of
`JSX.IntrinsicElements` / `Cannot find module '@/config/site'` /
`react/jsx-runtime` diagnostics — that's the editor's TS server failing to
resolve `node_modules` types, **not** real errors. Vite compiles fine and the
preview is the source of truth. Don't chase them; only act on a diagnostic that's
clearly yours (a dangling import, a typo, an undefined variable).

If `$ARGUMENTS` carries the designer's brief, treat it as the page request and
start building; otherwise ask what they want to design first.
