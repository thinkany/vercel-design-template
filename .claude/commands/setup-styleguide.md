---
description: Phase II — configure the styleguide (fonts, colors, example sections) for this project
---

This is **Phase II** of standing up a new project from this template, done
*after* `/setup-project` (which sets the brand name/subtitle in `.env`)
and *before* any real page/site design work. `/setup-project` **hands off directly
to this command**, so the designer usually arrives here mid-flow — treat it as one
continuous setup, not a fresh start, and don't re-introduce the whole project.

The styleguide (`src/app/components/StyleGuide.tsx`, viewable at `/?styleguide`)
is the living reference every later design decision is checked against. It ships
mostly-universal, with one **generic example** per component level as a
copy-me pattern. Your job here is to make its foundation reflect *this* project.

**Make this interactive.** Drive the designer's choices with the
`AskUserQuestion` tool rather than plain text prompts — it renders clickable
options plus an "Other → type your own" field and behaves identically in the IDE
and Claude Desktop. Batch related questions into one call (max 4 per panel).
Every question includes a free-text "Other", so open values (font-family
strings, hex codes, stylesheet URLs) are typed there while presets stay one
click away. Step 2 (the example sections) is the exception — it's a short
**informational** heads-up, not a question.

Walk the designer through these steps:

## 1. Set the Primitives — the token layer (colors first, then fonts)

The single source of truth is **`src/styles/tokens.css`** — pure CSS custom
properties that both the live site and the styleguide read from. Do **colors
first**, then fonts.

> **Scope — never mix palettes.** This step configures the **project** palette
> (`--ta-*`) *only*. The tooling/chrome palette (`--admin-*`, in the same file)
> belongs to the admin UI (dashboard, styleguide chrome, the gated page) and is
> configured elsewhere — leave every `--admin-*` token untouched here.

### 1a. Colors — build the scope's `--ta-*` brand palette

**Determine the scope first.** This command configures ONE scope, and each scope
is fully siloed — a red-based variation and a blue-based one never cross. Check
the `?v=` in the styleguide URL (or ask):
- **Base (v00)** → write to `src/styles/…`, and the flag is `VITE_BRAND_READY` in `.env`.
- **Variation `{id}`** → write to `src/variations/{id}/styles/…` ONLY (never the
  base, never a sibling), and the flag is that variation's `brandStatus` record.

The brand palette lives in **two coupled files that must stay in sync**, both in
the scope's `styles/` folder:
1. **`brand.ts`** — the manifest the styleguide renders its **Primitives → Colors**
   swatches from. Its `brand.paletteGroups` array holds **named color groups**,
   each `{ title, description?, colors: [{ name, token, value, text, role }] }`.
   Each group renders as its own titled subsection.
2. **`tokens.css`** — the CSS declarations under `/* ── Brand colors ── */` (e.g.
   `--ta-blue: #1e4b96;`) that components actually consume via `var(--ta-*)`.

The styleguide no longer has a hardcoded color array — it reads `brand.ts` through
`resolveBrand(variationId)`, so writing the manifest is what makes swatches appear.

**Color groups are the extensible unit.** To **create** a color section, add a new
`{ title, colors: [...] }` group; to **remove** one, delete its group. The shadcn
**System Palette** is a FIXED reference (hardcoded in `StyleGuide.tsx`) — it is NOT
a group and must never be added to, removed, or mixed with `--ta-*` here.

This step **replaces** the default 7-token placeholder palette (blue / red /
cream / ink / grays) with the scope's real palette. After writing, grep that
scope's components for `var(--ta-…)` references to any token name you removed and
remap or update them so nothing falls back to unstyled.

**First, ask how the designer wants to supply the palette** — one
`AskUserQuestion`, header **"Client Palette"**, `question` text below (blank
line before the parenthetical — a real `\n\n` in the string):

> How would you like to supply the client's color palette?
>
> (You will have the opportunity to create multiple palettes, this is for the
> initial design variation)

Three options, **in this order** (first = default):
- **From a website** — paste a URL; you'll extract its palette from the live CSS.
- **Enter all colors manually** — you'll prompt for each color one at a time.
- **Let Claude create from a single primary color** — give a single brand hex;
  you'll derive a full system.

Then, per method:

**Method A — Manual (iterative, one color at a time).**
Loop: for each color, one `AskUserQuestion` panel with three questions —
1. "Color name" (e.g. `Brand Blue`) — you'll slugify it to the token name.
2. "Hex value" (e.g. `#1e4b96`).
3. "Description / role" (e.g. `Links, active nav, accent borders`).
After each color, ask "Add another color?" (**Add another / Done**). Continue
until the designer chooses Done.

**Method B — From a website URL.**
`WebFetch` the URL and inspect its stylesheets / inline styles. Extract the
recurring brand colors (ignore near-duplicate shades and incidental one-off
greys). Propose a named, described palette (name + hex + role per color) and show
it back via `AskUserQuestion` for the designer to confirm, rename, or drop entries
**before** writing. Never write a scraped palette without confirmation.

**Method C — From one primary color.**
Ask for a single primary hex, then derive a coherent system from it with sensible
color theory — typically one or two accents (e.g. a complementary/secondary), a
neutral ramp (a near-black ink plus 2–3 greys), and a page background. Present the
derived palette (name + hex + role) via `AskUserQuestion` to confirm/tweak before
writing.

**Token naming (all methods).** Generate each token as `--ta-<slug>`, where
`<slug>` is the color name lowercased with spaces → hyphens and non-alphanumerics
stripped (`Brand Blue` → `--ta-brand-blue`). Ensure slugs are unique (suffix
`-2`, `-3`… on collision).

**Contrast (`text`) field.** For each color entry, compute a legible overlay text
color from the hex's luminance — dark swatch → `#ffffff`, light swatch → a
near-black. The styleguide uses this both for legibility and to decide which
swatches get a hairline border, so set it accurately.

**Group the colors.** Ask which group these belong to (default **"Brand Palette"**,
or a new named group like "Semantic States" / "Data Viz"). A full palette setup
usually replaces the single default group; an "add a section" request appends a
new group and leaves existing ones intact.

**Write both files** in the scope's `styles/` folder for the confirmed palette:
- In **`brand.ts`**, write the colors into the target group inside
  `brand.paletteGroups` (`{ title, description?, colors: [{ name, token,
  value: "#hex", text, role }] }`) — replacing the default group for a full setup,
  or appending a new group to add a section. The styleguide derives its swatch
  count, group headings, and "N brand tokens" prose automatically — no other edit.
- In **`tokens.css`**, write the matching `--ta-*` declarations under
  `/* ── Brand colors ── */` (same hex values), leaving `--admin-*`,
  `--ta-font-*`, and the system palette untouched.

**Set the brand flag** so the styleguide stops showing the "template defaults" notice:
- **Base** → set `VITE_BRAND_READY="true"` in `.env`.
- **Variation** → the flag lives in the variation's localStorage record, which
  a file edit can't reach; tell the designer to click **"Mark brand established"**
  in that variation's styleguide Colors section.

### 1b. Fonts

In the scope's `styles/` folder: declare/import the families in `fonts.css`, then
point the `--ta-font-*` tokens in `tokens.css` at them. The type specimens render
from `brand.fonts` in `brand.ts` (the four roles — Display / Serif / Sans / Mono);
edit a role's `name`/`role`/`sample` there if needed, but the family value itself
lives only in `tokens.css` (the manifest references it via `var(--ta-font-*)`).

Confirm the changes show up in the styleguide's **Primitives → Colors / Type
Scale** sections — those swatches read the live token values, so they should
reflect your edits immediately.

## 2. The example sections are flexible — just inform (no question)

Do **not** walk the designer through a per-section Keep/Replace/Remove decision
during setup. Give one short, **informational** heads-up (no `AskUserQuestion`, no
options) — verbatim or close to it:

> The Styleguide's sections can be adjusted/renamed etc. at any time. The default
> layout is for example purposes only. Ask Claude to adjust to your preference or
> simply re-work the template.

Then leave the sections as they are — they get shaped later, as the project's real
components get built (Atoms → Molecules → Organisms → Templates → Pages). Keep the
universal Primitives and generic Atoms (buttons, badges, form controls, icons)
unless there's a strong reason not to.

## 3. Mark it done

Once the scope's tokens and sections reflect its foundation, clear the two markers
for that scope:
- **Brand palette** → `VITE_BRAND_READY="true"` (base) or **"Mark brand
  established"** in the Colors section (variation) — see step 1a.
- **Styleguide overall** → `VITE_STYLEGUIDE_READY=true` in `.env` (base) or the
  **Mark as updated** button (variation), which clears the top-of-page setup banner.

(Vite reloads on `.env` changes.)

## 4. Sign off — onboarding complete

Both phases are now done (brand + company fonts in Phase I, client colors + fonts
and the styleguide here in Phase II). Give the warm wrap and the local-preview
reminder that `/setup-project` deferred to this point (its step 0d): they can
preview anytime with **`npm run dev`** (http://localhost:5173) for instant,
hot-reloading feedback — separate from the Vercel preview deploy — and they're now
ready to start designing pages.

## 5. One last comfort tip — smoother iterating (friendly, never pushy)

As the designer heads into building pages — the phase with the most repetitive
edit approvals — **lead with a warm recommendation first** (this is the standard
message), and only *then* offer the concrete ways to act on it. A designer who's
happy approving each change should feel completely fine waving this off.

Present the recommendation roughly like this — friendly, low-pressure, clearly
optional (adapt the wording, keep the spirit):

> One quick comfort tip before you dive in — totally optional.
>
> Designing is hands-on: I'll be making lots of small edits as we shape your pages
> together, and by default I pause to ask before each one. That's perfect when you
> want to eyeball every change — but it can interrupt the flow when you're moving
> quickly.
>
> **What I'd gently suggest:** let me apply edits as we go, so you can watch the
> design take shape instead of confirming every step. You stay in charge of the
> direction — I just stop interrupting for the small stuff, and you can switch it
> back whenever you like.
>
> If you'd rather approve each change, that's completely fine too — there's no
> wrong answer here.
>
> You'll still be asked before I run any commands or send anything out — this only
> smooths the small file edits.

Only **after** that recommendation, offer the two concrete ways to do it (a line or
two each, not a lecture — you can't flip these for them; they're user-controlled):
- **Auto-accept edits** — press **`Shift+Tab`** to cycle the permission mode until
  it reads *"auto-accept edits on"*. File edits/writes then apply without asking
  (commands still prompt). Closest analog to Desktop's "auto," and the best default
  for iterating on designs.
- **`/fewer-permission-prompts`** — offer to run this skill; it scans recent
  activity and writes a tailored allowlist into `.claude/settings.json` so the
  common Bash command approvals stop recurring. Ask before running it.

## Variations carry their own styleguide — fully siloed

This command configures **one scope**. The base (v00) lives in `src/styles/` +
`src/app/components/`; each variation is a full copy under `src/variations/{id}/`
(including its own `styles/brand.ts` + `styles/tokens.css`), rendered at
`/?v={id}&styleguide`. There is **zero crossover**: `resolveBrand({id})` returns
only that variation's manifest, and App injects only that variation's `tokens.css`.
So running `/setup-styleguide` for a variation gathers and applies values to **that
variation alone**.

Both markers are per-scope: the base uses the committed `VITE_STYLEGUIDE_READY` /
`VITE_BRAND_READY` env flags; each variation carries its own `styleguideStatus`
and `brandStatus` in its record (cleared via the in-page buttons, no `.env` edit).

---

If arguments were passed in `$ARGUMENTS`, treat them as the designer's answers or
focus (e.g. a specific step) and proceed accordingly; otherwise work through the
steps interactively, pausing for the designer's fonts/colors and decisions.
