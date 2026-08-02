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
click away. Step 3 (the example sections) is the exception — it's a short
**informational** heads-up, not a question.

Walk the designer through these steps:

## 0. Establish the working design variation (scope for everything below)

This template's model: **base v00 is the pristine blueprint — the designer's real
design *and* styleguide live in a variation**, which keeps the base clean so template
upgrades can refresh the framework without clobbering their work. So the first thing
this command does is make sure a working variation exists; **every step below then
configures THAT variation, never the base.**

**Check what's already there** (the `?v=` in the styleguide URL, or `ls src/variations`):
- **A design variation already exists** (e.g. the designer arrived at
  `/?v=v01&styleguide`) → that's the scope. Skip to Step 1.
- **Only base v00 exists** → create the working variation now by copying the base
  files on disk (use the next free `vNN` — `v01` on a fresh project):

  ```bash
  mkdir -p src/variations/v01
  cp -R src/app/components src/variations/v01/components
  cp -R src/styles src/variations/v01/styles
  ```

  The dashboard auto-discovers it through the variations manifest — there's no
  localStorage record to write from here. Tell the designer in one plain line that
  you've set up their working design copy and the base stays the clean starting point.

**From here, `{id}` = that variation.** Everything this command writes goes to
`src/variations/{id}/styles/…` (and its `components/` for the logo step) — **never the
base.**

## 1. Set the Primitives — the token layer (colors first, then fonts)

The single source of truth is **`src/styles/tokens.css`** — pure CSS custom
properties that both the live site and the styleguide read from. Do **colors
first**, then fonts.

> **Scope — never mix palettes.** This step configures the **project** palette
> (`--ta-*`) *only*. The tooling/chrome palette (`--admin-*`, in the same file)
> belongs to the admin UI (dashboard, styleguide chrome, the gated page) and is
> configured elsewhere — leave every `--admin-*` token untouched here.

### 1a. Colors — build the scope's `--ta-*` brand palette

**The scope is the working variation from Step 0** (`{id}`). Write to
`src/variations/{id}/styles/…` **ONLY** — never the base, never a sibling. Each scope
is fully siloed: a red-based variation and a blue-based one never cross. The
brand-ready marker is that variation's `brandStatus` record field, cleared via the
in-page "Mark brand established" button (a file edit can't reach localStorage).

The brand palette lives in **two coupled files that must stay in sync**, both in
the scope's `styles/` folder:
1. **`brand.ts`** — the manifest the styleguide renders its **Primitives → Colors**
   swatches from. Its `brand.paletteGroups` array holds **named color groups**,
   each `{ title, description?, colors: [{ name, token, value, text, role }] }`.
   Each group renders as its own titled subsection.
2. **`tokens.css`** — the CSS declarations under the Brand colors block (e.g.
   `--ta-primary: #1e4b96;`) that components actually consume via `var(--ta-*)`.

The styleguide no longer has a hardcoded color array — it reads `brand.ts` through
`resolveBrand(variationId)`, so writing the manifest is what makes swatches appear.

**Color groups are the extensible unit.** To **create** a color section, add a new
`{ title, colors: [...] }` group; to **remove** one, delete its group. The shadcn
**System Palette** is a FIXED reference (hardcoded in `StyleGuide.tsx`) — it is NOT
a group and must never be added to, removed, or mixed with `--ta-*` here.

**Colors are SEMANTIC ROLES, not color names — this is the key rule.** The palette
ships as seven stable role tokens (`--ta-primary`, `--ta-accent`, `--ta-surface`,
`--ta-ink`, `--ta-body`, `--ta-muted`, `--ta-border`), and every component
references those roles. So you **set each role's VALUE and personalize its display
`name`** (e.g. rename "Primary" → "Navy") — but you **never rename the token slug,
and you never touch component files.** Because the slugs are stable, a palette
change can't orphan a component reference, so there is **no grep-and-remap step** —
that whole class of breakage is gone. (If the designer supplies extra colors beyond
the seven roles, add them as additional tokens/groups, but keep the seven roles
filled — components depend on them.)

**First, ask how the designer wants to supply the palette** — one
`AskUserQuestion`, header **"Client Palette"**, `question` text below (blank
line before the parenthetical — a real `\n\n` in the string):

> How would you like to supply the client's color palette?
>
> (You will have the opportunity to create multiple palettes, this is for the
> initial design variation)

Three options, **in this order** (first = default):
- **From a website** — paste a URL; you'll read its palette (and fonts) straight
  from the site's CSS, no browser needed.
- **Enter all colors manually** — you'll prompt for each color one at a time.
- **Let Claude create from a single primary color** — give a single brand hex;
  you'll derive a full system.

Then, per method:

**Method A — Manual (iterative, one color at a time).**
Loop: for each color, one `AskUserQuestion` panel with three questions —
1. "Color name" (e.g. `Navy`) — becomes the swatch's display `name`.
2. "Hex value" (e.g. `#1e4b96`).
3. "Role" — which of the seven roles it fills (primary / accent / surface / ink /
   body / muted / border), which decides the token slug it maps to.
After each color, ask "Add another color?" (**Add another / Done**). Continue
until the designer chooses Done.

**Method B — From a website URL.** Use the **non-browser CSS-fetch** method — it's
the consistent one. **Do NOT open a headless/automation browser or take
screenshots to read colors** — that path gets permission-gated and produces
inconsistent results; stay with plain HTTP fetches of the markup + stylesheets.

1. **Fetch the source.** First try `WebFetch` with an extraction prompt that asks for
   the raw style values **verbatim, not summarized** — **every hex / `rgb()` /
   `hsl()` color, CSS custom properties (`--*`), `<meta name="theme-color">`, and
   `font-family` stacks** — in the page's inline styles **and** its linked
   stylesheets. If `WebFetch` still returns prose instead of real values, fall back
   to a **plain curl + grep**.

   **Keep that fallback command statically analyzable** so the committed `curl` /
   `grep` allowlist can auto-approve it instead of prompting. **Do NOT** wrap it in
   shell the permission matcher can't decompose: **no `UA="…"` variable, no
   `cd … || cd …` fallback, no browser User-Agent string full of `;()`** — any of
   those makes the *whole* command unanalyzable, so it prompts even though `curl` is
   allowed. Use a single plain `curl` to a scratch file, then plain `grep`s, e.g.:

   ```
   curl -fsS --max-time 10 -A "Mozilla/5.0" "<url>" -o /tmp/site.html
   grep -oiE '#[0-9a-f]{6}' /tmp/site.html | sort | uniq -c | sort -rn | head -20
   grep -oE 'href="[^"]*\.css[^"]*"' /tmp/site.html | head -20
   ```

   Then `curl` any promising `.css` hrefs the same way and grep those for the same
   tokens. (All non-browser — no puppeteer.)
2. **Rank + winnow.** Keep the recurring brand colors by prominence/frequency;
   drop near-duplicate shades and incidental one-off greys. Note the site's real
   `font-family` stacks too — offer them as suggested type roles (Display / body),
   though actual font wiring still follows the Fonts step (1b).
3. **Preview + confirm before writing.** Assemble the named, described palette
   (name + hex + role per color), **publish the swatch preview** (see *Swatch
   preview* below) so the designer sees the actual colors, then confirm / rename /
   drop entries via `AskUserQuestion`. **Never write a fetched palette without
   confirmation.**
4. **If the site yields too little** (a JS-heavy SPA with no usable CSS in the
   fetched source), **do not escalate to a browser.** Say so plainly and fall back:
   ask the designer for the brand hex(es) or logo, or switch to **Method C** (derive
   from one primary color).

**Method C — From one primary color.**
Ask for a single primary hex, then derive a coherent system from it with sensible
color theory — typically one or two accents (e.g. a complementary/secondary), a
neutral ramp (a near-black ink plus 2–3 greys), and a page background. **Publish the
swatch preview** (see *Swatch preview* below) so the designer sees the actual
colors, then present the derived palette (name + hex + role) via `AskUserQuestion`
to confirm/tweak before writing.

**Swatch preview (Artifact) — proposed palettes (Methods B & C only).**
`AskUserQuestion` options are text-only (no color chips), so for a *proposed*
palette, show the real colors as an **Artifact** first — it renders inline in
Claude Desktop, before anything is written to disk. (Method A / manual entry skips
this — the designer is supplying the hexes themselves.)

- Write a **self-contained HTML** file to the scratchpad: a responsive grid of
  cards, each = a filled color block (`background:{hex}`) above its **name**, the
  **hex** (mono), and the **role**. Theme-aware, favicon `🎨`. Load the
  `artifact-design` skill first (the Artifact tool requires it) but keep the
  investment **minimal** — this is a quick utility swatch card, not a showcase.
- **Publish it** with the Artifact tool (private by default), then run the
  `AskUserQuestion` confirm. If the designer renames/drops/re-tints a color, **edit
  the same file and re-publish** (same path → same URL updates in place).
- Only **after** they confirm do you write `tokens.css` + `brand.ts`.

**Map to the seven roles (all methods) — do NOT invent slugs from color names.**
The token slugs are FIXED: `--ta-primary`, `--ta-accent`, `--ta-surface`, `--ta-ink`,
`--ta-body`, `--ta-muted`, `--ta-border`. For each color the designer gives you,
decide which role it fills (primary = links/buttons; accent = highlights/badges;
surface = backgrounds; ink = headings; body = paragraph text; muted = captions;
border = dividers) and set that role's **value**. Put the designer's own color name
in the `name` field (e.g. `name: "Navy"`, `token: "--ta-primary"`). This is what makes
a palette change safe — components reference the role slugs, so you never rename a
slug and never edit a component. If the designer has MORE colors than the seven roles,
add the extras as additional `--ta-*` tokens (own slugs fine) in a separate group, but
always keep the seven roles filled.

**Contrast (`text`) field.** For each color entry, compute a legible overlay text
color from the hex's luminance — dark swatch → `#ffffff`, light swatch → a
near-black. The styleguide uses this both for legibility and to decide which
swatches get a hairline border, so set it accurately.

**Group the colors.** Ask which group these belong to (default **"Brand Palette"**,
or a new named group like "Semantic States" / "Data Viz"). A full palette setup
usually replaces the single default group; an "add a section" request appends a
new group and leaves existing ones intact.

**Write both files** in the scope's `styles/` folder for the confirmed palette:
- In **`brand.ts`**, update each of the seven role entries in the "Brand Palette"
  group — set its `value`, `name` (the designer's color name), `text`, and `role` —
  **keeping the seven `token` slugs unchanged.** Append a new group only for extra
  colors beyond the roles. The styleguide derives its swatch count, group headings,
  and "N brand tokens" prose automatically — no other edit.
- In **`tokens.css`**, set the matching `--ta-*` role **values** under the Brand
  colors block (keep the slugs), leaving `--admin-*`, `--ta-font-*`, and the system
  palette untouched.

**Clear the brand marker** so the variation's styleguide stops flagging its Colors as
template defaults: the marker lives in the variation's localStorage record, which a
file edit can't reach — tell the designer to click **"Mark brand established"** in that
variation's styleguide Colors section.

### 1b. Fonts

In the scope's `styles/` folder: declare/import the families in `fonts.css`, then
point the `--ta-font-*` tokens in `tokens.css` at them. The type specimens render
from `brand.fonts` in `brand.ts` (the four roles — Display / Serif / Sans / Mono);
edit a role's `name`/`role`/`sample` there if needed, but the family value itself
lives only in `tokens.css` (the manifest references it via `var(--ta-font-*)`).

Confirm the changes show up in the styleguide's **Primitives → Colors / Type
Scale** sections — those swatches read the live token values, so they should
reflect your edits immediately.

### 1c. Bridge the shadcn primitives to the brand

The `--ta-*` tokens above style the *designed pages*. But the 40 shadcn/ui
components in `src/app/components/ui/` (Button, Badge, Alert, form controls…) read
a **separate** namespace — `--primary`, `--secondary`, `--destructive`,
`--foreground`, … — which ships at stock shadcn defaults (near-black navy, red).
Until they're bridged, every shadcn component renders **off-brand** in the live app
*and* in the Figma **Components** export (which faithfully mirrors whatever those
primitives currently are). This step points the brand-carrying primitives at the
palette you just set, so the components inherit the brand everywhere.

> **Scope.** This bridges the **client** palette (`--ta-*`) into the **shadcn**
> primitives only. Do **not** touch `--admin-*` (tooling chrome) — those stay
> neutral and constant. Write the mappings as `var(--ta-*)` **references** (not
> copied hex) so there's still one source of truth, and only in the `:root` block —
> leave the `.dark` overrides alone (the palette + the Figma export are single
> light mode).

**Auto-map — do NOT ask.** Apply the mapping below automatically; don't prompt the
designer whether or how to bridge. The seven semantic role tokens make it
deterministic — there's a right target for every row — so just do it. Write the
mappings into the scope's `tokens.css`, **`:root` only**, replacing each primitive's
value with the `var()` **reference** (leave the `.dark` overrides alone). Afterward,
tell the designer in **one line** that their buttons/badges/inputs now carry the
brand — informational, not a decision.

| shadcn primitive | ← maps to (semantic role) |
|---|---|
| `--primary` | `var(--ta-primary)` |
| `--primary-foreground` | the primary's contrast — its `text` field from `brand.ts` (or `#ffffff`) |
| `--secondary` | `var(--ta-surface)` |
| `--secondary-foreground` | `var(--ta-ink)` |
| `--accent` | `var(--ta-surface)` |
| `--accent-foreground` | `var(--ta-ink)` |
| `--muted-foreground` | `var(--ta-muted)` |
| `--ring` | `var(--ta-primary)` |
| `--destructive` / `-foreground` | **keep stock** (unless the brand explicitly defines a semantic red) |
| surfaces (`--background`, `--card`, `--popover`, `--foreground`, `--border`, `--input`) | **leave neutral** — only map `--foreground` → `var(--ta-ink)` if the brand wants non-black ink |
| `--chart-*`, `--sidebar-*` | **leave alone** (data-viz has its own palette; sidebar is tooling) |

After writing, confirm the shadcn components in the styleguide's **Atoms** section
(buttons/badges) now render in the brand palette. The Figma **Components** export
reads these same primitives — the exporter follows the `var()` references to the
resolved brand color — so a later component export is on-brand automatically.

### 1d. Client logo — the design-page header

The global site header (`src/app/components/Header.tsx`, rendered on every design
page by `DesignSurface`) has a **logo lockup**. Out of the box it shows the client
name as a **text wordmark** (`{siteConfig.clientName}` in the display font). This
step offers to swap in a real logo image for the first design pass.

> **Scope.** This is the **design** logo (the pages' header) — distinct from the
> **login-screen** logo `/setup-project` sets in `middleware.js`. They're often the
> same file; they don't have to be. Edit the **working variation's**
> `src/variations/{id}/components/Header.tsx` (created in Step 0) — never the base.

**First, read the current state** so you ask the right question:
- Open `src/variations/{id}/components/Header.tsx` and look at the logo lockup (the
  button that calls `onNavigate("home")`).
  - Renders **only the text wordmark** (`siteConfig.clientName`, no `<img>`) → the
    logo is **BLANK**.
  - Renders an **`<img src="/brand/…">`** → a logo is **IN PLACE**.
- Also list **`public/brand/`** — a file may already sit there from the login-logo
  step (`/setup-project` 2a); if so, note its name so you can offer to reuse it.

**Then branch with one `AskUserQuestion`, header "Design logo":**

**If BLANK** — *"Your design pages currently show **{clientName}** as a text
wordmark in the header. Add a logo image for this first design pass?"*
- **Yes — add a logo** (first) → give the copy-in instructions below.
- **Reuse my login logo (`/brand/{file}`)** → *offer this option only if a logo
  already exists in `public/brand/`* — wire that same file in, no new copy needed.
- **Not now — keep the wordmark** → leave `Header.tsx` as-is; note they can add one
  anytime.

**If IN PLACE** — *"Your header already uses a logo (`/brand/{file}`). Use this one
for the design, or swap in a different file?"*
- **Use this one** (first) → nothing to do; confirm and move on.
- **Add a different file** → give the copy-in instructions below, then rewire.

**Copy-in instructions (when they choose to add/replace a file).** Images can't be
pasted into chat, so the designer places the file themselves. Give these **exact**
steps:
1. **Where.** Copy the logo into the project's **`public/brand/`** folder — full
   path **`<project-root>/public/brand/`**. **Create the `brand` folder if it isn't
   there yet** (it won't be on a fresh copy).
2. **What.** Prefer an **SVG** (crisp at any size) or a **transparent PNG**. Give it
   a simple name, e.g. **`logo.svg`**.
3. **Tell me the filename** once it's in place. Anything under `public/` is served
   from the site root, so `public/brand/logo.svg` is referenced as **`/brand/logo.svg`**
   (the `public/` prefix is dropped from the URL).

**Wire it in.** Replace the text lockup in `Header.tsx` with the image, keeping the
home-nav button wrapper:

```tsx
{/* Logo lockup */}
<button
  onClick={() => onNavigate("home")}
  className="cursor-pointer leading-none"
>
  <img
    src="/brand/logo.svg"
    alt={`${siteConfig.clientName} logo`}
    className="h-7 @lg:h-8 w-auto"
  />
</button>
```

Tune the height to the logo's aspect (keep `w-auto` so it never distorts); a very
wide wordmark logo may want a smaller height. Confirm it renders in the live
preview's header (and in the phone frame, where it should scale down cleanly).

> **Heads-up — a committed asset.** Files in `public/` are committed to the repo and
> deployed, so the logo ships in git and is publicly reachable on the Vercel preview
> at `/brand/<file>`. If the client would rather it not live in this project, keep
> the wordmark instead.

## 2. The working variation's name (just inform)

The dashboard lists each design as a **variation**. The working variation you created
in Step 0 appears with an auto title (e.g. **"Design 1"**); the base keeps its **"Base"**
blueprint label. Its title/description live in that variation's **localStorage record**
— a file edit can't reach it — so there's nothing to write here. If the designer wants
a specific name, that's a dashboard-side rename, not a setup step. Don't touch
`INITIAL_VARIATIONS` (that's the base blueprint's seed, which stays "Base").

## 3. The example sections are flexible — just inform (no question)

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

## 4. Readiness is automatic — nothing to mark

You don't need to mark anything done. The working variation was created by Step 0's
file copy, so the dashboard records it as **already configured** (that's the default
for a disk-discovered variation under this flow) — its styleguide shows **no setup
banner**. Base v00 never shows one either (it's the pristine blueprint).

The only time the "inherited the base styleguide" banner appears is when a designer
later **duplicates** a variation via *Make New Variation* and checks "needs its own
styleguide" — then that copy carries the banner + an in-page **Mark as updated** /
**Mark brand established** button until they clear it. It never applies to the
variation this setup just configured.

## 5. Sign off — onboarding complete

Both phases are now done (brand + company fonts in Phase I, client colors + fonts
and the styleguide here in Phase II). Give the warm wrap and the local-preview
reminder that `/setup-project` deferred to this point (its step 0d): they can
preview anytime with **`npm run dev`** (http://localhost:5173) for instant,
hot-reloading feedback — separate from the Vercel preview deploy — and they're now
ready to start designing pages.

Point them to **`/guide`** as well: they can type it at any time to see every
command this project offers (setup, design, Figma export, preview controls). The quickest next
step is simply to describe the page they want — that kicks off `/design`, which
will also offer to start the preview server if it isn't already running.

## 6. One last comfort tip — smoother iterating (friendly, never pushy)

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

This command configures **one variation**. Base v00 is the pristine template
blueprint in `src/styles/` + `src/app/components/`; each variation is a full copy
under `src/variations/{id}/` (including its own `styles/brand.ts` +
`styles/tokens.css`), rendered at `/?v={id}&styleguide`. There is **zero crossover**:
`resolveBrand({id})` returns only that variation's manifest, and App injects only
that variation's `tokens.css`. So `/setup-styleguide` gathers and applies values to
**that variation alone**.

Readiness is a per-variation concept only: each variation carries its own
`styleguideStatus` and `brandStatus` in its record, cleared via the in-page buttons
(no `.env` flags — those are retired). Base has no readiness state.

---

If arguments were passed in `$ARGUMENTS`, treat them as the designer's answers or
focus (e.g. a specific step) and proceed accordingly; otherwise work through the
steps interactively, pausing for the designer's fonts/colors and decisions.
