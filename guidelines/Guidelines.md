# Deep Focus Review — Design System Guidelines

## Brand Colors

| Token | Tailwind class | Value | Usage |
|---|---|---|---|
| `--dfr-blue` | `bg-dfr-blue` / `text-dfr-blue` | `#1e4b96` | Links, accent borders, active states |
| `--dfr-red` | `bg-dfr-red` / `text-dfr-red` | `#c41230` | Star ratings, alert labels, promo badges |
| `--dfr-cream` | `bg-dfr-cream` | `#f8f7f3` | Page background, hero wash, card fills |
| `--dfr-ink` | `text-dfr-ink` | `#111111` | Primary body text, headings |
| `--dfr-gray-dark` | `text-dfr-gray-dark` | `#333333` | Secondary body text |
| `--dfr-gray-mid` | `text-dfr-gray-mid` | `#777777` | Metadata, captions, timestamps |
| `--dfr-gray-light` | `border-dfr-gray-light` | `#cccccc` | Dividers, subtle borders |

Never hardcode these hex values in component files — always use the CSS variable or Tailwind utility.

---

## Typography

### Font Families

| Token | Tailwind class | Stack | Role |
|---|---|---|---|
| `--font-fraunces` | `font-fraunces` | Fraunces, Georgia, serif | Display headings, film titles, hero text |
| `--font-source-serif` | `font-source-serif` | Source Serif 4, Georgia, serif | Body copy, review prose, long-form text |
| `--font-dm-sans` | `font-dm-sans` | DM Sans, system-ui, sans-serif | UI labels, nav, metadata, tags |
| `--font-dm-mono` | `font-dm-mono` | DM Mono, monospace | Ratings, scores, numeric data |

### Type Hierarchy (V8 layout)

| Level | Font | Weight | Size range | Usage |
|---|---|---|---|---|
| Hero title | Fraunces | 300–400 | `clamp(22px, 2.4vw, 34px)` | Lead review headline |
| Section heading | Fraunces | 400–600 | 18–22px | "New Reviews", "Definitives" labels |
| Film title | Fraunces italic | 400 | 15–19px | Card/sidebar titles |
| Body text | Source Serif 4 | 400 | 14–16px | Review excerpts, prose |
| UI labels | DM Sans | 400–500 | 9–13px | Metadata, dates, star ratings, tags |
| Ratings / scores | DM Mono | 400 | 11–13px | Star glyphs, numeric data |

---

## Spacing

Use Tailwind 4's built-in 4px scale. The V8 components use these values — Tailwind equivalents:

| px | Tailwind | Common use |
|---|---|---|
| 2px | `gap-0.5` | Tight metadata stacks |
| 6px | `gap-1.5` | Label/icon pairs |
| 12px | `p-3` / `gap-3` | Card internal padding |
| 14px | `p-3.5` | Compact card padding |
| 20px | `p-5` / `gap-5` | Section spacing |
| 24px | `p-6` | Column padding |
| 28px | `p-7` | Section top padding |
| 32px | `p-8` | Column gutter |
| 40px | `p-10` | Section vertical spacing |

Avoid arbitrary pixel values in new code. Use `clamp()` only for responsive hero/headline font sizes.

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 6px | Input fields, small chips |
| `--radius-md` | 8px | Buttons, small cards |
| `--radius-lg` | 10px (`--radius`) | Cards, panels |
| `--radius-xl` | 14px | Modals, large cards |
| `2px` (global) | — | Images (`img` in globals.css) |
| `50%` | — | Circular avatars only |

---

## Layout

- **Approved variant:** V8 series only — `Direction1V8.tsx`, `Definitives1V8.tsx`. Other variants (V2, V3, Mobile) exist but are not the active direction.
- **Grid:** Use CSS Grid or Flexbox. Never use absolute positioning for layout — only for decorative overlays or tooltips.
- **Column width:** Main content column caps at `~1280px`. Sidebar column is fixed-width within that grid.
- **Images:** All images use `border-radius: 2px` (set globally in `globals.css`). Do not override this per-component.

---

## Components

### Custom Components (`src/app/components/`)

| Component | Role |
|---|---|
| `Direction1V8` | Home page — hero, new reviews grid, sidebar |
| `Definitives1V8` | Definitives page — curated canonical films list |
| `Nav1` / `Nav2` / `Nav3` | Site navigation variants |
| `Footer1` / `Footer2` / `Footer3` | Site footer variants |
| `ReviewPost` | Single review page layout |
| `EssayPost1` / `EssayPost2` / `EssayPost3` | Essay/long-form article layout |
| `ReviewsAZ1` / `ReviewsAZ2` / `ReviewsAZ3` | A-Z review index |
| `AdUnit` | Advertisement placeholder |
| `SupportCTA` | Patreon/support call-to-action block |
| `ViewToggle` | Toggle between layout variants (dev tool) |
| `PhoneFrame` | Mobile preview wrapper (dev tool) |
| `MobileShared` | Shared mobile layout utilities |

### shadcn/ui Components (`src/app/components/ui/`)

40 components installed at default shadcn configuration. Customize via `theme.css` CSS variables — do not fork individual component files unless unavoidable.

---

## Code Conventions

- **No inline `style={{}}`** — use Tailwind utility classes or CSS variables. Phase 4 will migrate existing inline styles.
- **Colors:** Always reference `var(--dfr-*)` or Tailwind `text-dfr-*` / `bg-dfr-*` utilities. Never hardcode hex values.
- **Fonts:** Use `font-fraunces`, `font-source-serif`, `font-dm-sans`, `font-dm-mono` Tailwind classes.
- **Dark mode:** Supported via `.dark` class on `<html>`. Use `dark:` Tailwind variants, not manual media queries.
- **TypeScript:** All components are `.tsx`. Data files (`siteData.ts`, `navData.ts`, etc.) live in `src/app/components/` alongside components — move to `src/data/` when doing a cleanup pass.

---

## Content Notes

- **Image CDN:** Poster images pull from `deepfocusreview.com`'s WordPress CDN (`cdn.deepfocusreview.com` or `deepfocusreview.com/wp-content/...`). No local copies.
- **Star ratings:** Rendered as Unicode stars (`★☆`) in `font-dm-mono`, colored `text-dfr-red`.
- **Date format:** "Month DD YYYY" — e.g. "June 24 2026".
- **Film titles:** Always italicized in prose. In card UI, use Fraunces italic.
