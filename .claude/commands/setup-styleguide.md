---
description: Phase II, configure the styleguide (fonts, colors, example sections) for this project
---

This is **Phase II** of standing up a new project from this template, done
*after* `/setup-project` (which sets the brand name/subtitle in `.env`)
and *before* any real page/site design work. `/setup-project` **hands off directly
to this command**, so the designer usually arrives here mid-flow, treat it as one
continuous setup, not a fresh start, and don't re-introduce the whole project.

The styleguide (`src/app/components/StyleGuide.tsx`, viewable at `/?styleguide`)
is the living reference every later design decision is checked against. It ships
mostly-universal, with one **generic example** per component level as a
copy-me pattern. Your job here is to make its foundation reflect *this* project.

**Make this interactive, ONE question at a time.** Drive the designer's choices
with the `AskUserQuestion` tool rather than plain text prompts, it renders
clickable options plus an "Other → type your own" field and behaves identically in
the IDE and Claude Desktop. **Ask EXACTLY ONE question per `AskUserQuestion` call
and WAIT for the answer before the next, never bundle two or more questions into
one call.** The designer only ever sees a single prompt at a time. Every question
includes a free-text "Other", so open values (font-family strings, hex codes,
stylesheet URLs) are typed there while presets stay one click away. Step 3 (the
example sections) is the exception, it's a short **informational** heads-up, not a
question.

Walk the designer through these steps:

## 0. Establish the working design variation (scope for everything below)

This template's model: **base v00 is the pristine blueprint, the designer's real
design *and* styleguide live in a variation**, which keeps the base clean so template
upgrades can refresh the framework without clobbering their work. So the first thing
this command does is make sure a working variation exists; **every step below then
configures THAT variation, never the base.**

**Check what's already there** (the `?v=` in the styleguide URL, or `ls src/variations`):
- **A design variation already exists** (e.g. the designer arrived at
  `/?v=v01&styleguide`) → that's the scope. Skip to Step 1.
- **Only base v00 exists** → create the working variation now (use the next free
  `vNN`, `v01` on a fresh project). Copy the base files on disk:

  ```bash
  mkdir -p src/variations/v01
  cp -R src/app/components src/variations/v01/components
  cp -R src/styles src/variations/v01/styles
  ```

  Then **write its metadata file** `src/variations/v01/variation.json` (use the Write
  tool, not a heredoc), this is the variation's single source of truth, read by the
  dashboard manifest. Because setup configures it, mark it **already done** (no setup
  banner):

  ```json
  {
    "version": "v0.1",
    "title": "Initial Design",
    "description": "Initial Design Concept, color and font variations.",
    "createdAt": "MM/DD/YYYY",
    "styleguideStatus": "updated",
    "brandStatus": "established",
    "previewReady": false
  }
  ```

  Set `createdAt` to **today's date** (`MM/DD/YYYY`, no time). `modifiedAt` is filled
  live from the design files' mtimes, so don't hardcode it.

  **`previewReady: false` keeps the app's live preview CLOSED for now.** The variation
  folder exists the instant you copy the base, but its styleguide has no client colors
  yet, so opening the preview here would pop a blank/base page mid-setup. The app waits
  for `previewReady: true`, which you flip **at the end of the Fonts step** (Step 1b),
  once colors AND fonts are both in, that's when there's real content to show and the
  right moment for the browser to open. (Only the desktop app reads this field; it's a
  harmless no-op elsewhere.)

  The dashboard reads this file directly, no localStorage, so it shows the right
  title/status in every browser. Tell the designer in one plain line that you've set
  up their working design copy and the base stays the clean starting point.

**From here, `{id}` = that variation.** Everything this command writes goes to
`src/variations/{id}/styles/…` (and its `components/` for the logo step), **never the
base.**

## 0.5. Design references, optional, seeds the palette + fonts

Before choosing colors and fonts from scratch, offer to base them on any reference
material the designer already has, a **brand guide, moodboard, screenshots, or an
existing site**. If they share some, the app **ingests it** (stores it privately under
`.thinkany/references/`, rasterizes PDF pages, and distills a digest with the **exact
palette + fonts**), and you use that as the starting point for Steps 1a/1b, the same
references pipeline the "Get Designing" path uses.

**Ask once** with `AskUserQuestion`, header **"Design references"** (that exact header
is what turns the card's 📎 button into a *references upload*, ingested, not a plain
file attach). `question`:

> Do you have design references to base this on, a brand guide, moodboard,
> screenshots, or an existing site? Upload them with the button and I'll pull the
> palette and fonts, or we can set them together.

Options (the app adds the **📎 Upload references** button automatically, so these are
just the alternatives):
- **No references, we'll choose colors and fonts together** (first / default)
- **I'll paste a website URL in the color step** (→ handled by Step 1a, Method B)

**If they upload references** (the answer will say the references were ingested and
point you at the digest):
1. **Read `.thinkany/references/digest.json`.** Use its `palette` (exact hexes) as the
   basis for the colors and its `fonts` for the type roles; `digest.md` carries the
   style direction (overall feel, imagery, do/don'ts), let it inform the role names and
   mood, not just raw values. (The app waits for the ingest to finish before handing
   off, so the digest is complete when you read it, exact palette **and** the style
   read. On a very large upload that timed out, the exact palette is still there.)
2. **Then do Steps 1a/1b with those values:** map the digest palette to the seven roles
   and write `tokens.css` + `brand.ts`, wire the digest fonts in `fonts.css` +
   `tokens.css`, exactly as below, but you already have the values, so **skip re-asking
   "how would you like to supply the palette"** and go straight to write → preview →
   adjust live. Tell the designer in one line what you pulled ("I took the palette and
   type from your brand guide, here they are, tweak anything").

**If they skip or choose the URL path,** proceed to Step 1a normally (the URL path is
Method B there). Never block on this step, it's an optional shortcut.

## 1. Set the Primitives, the token layer (colors first, then fonts)

The single source of truth is **`src/styles/tokens.css`:** pure CSS custom
properties that both the live site and the styleguide read from. Do **colors
first**, then fonts.

> **Scope, never mix palettes.** This step configures the **project** palette
> (`--ta-*`) *only*. The tooling/chrome palette (`--admin-*`, in the same file)
> belongs to the admin UI (dashboard, styleguide chrome, the gated page) and is
> configured elsewhere, leave every `--admin-*` token untouched here.

### 1a. Colors, build the scope's `--ta-*` brand palette

**The scope is the working variation from Step 0** (`{id}`). Write to
`src/variations/{id}/styles/…` **ONLY:** never the base, never a sibling. Each scope
is fully siloed: a red-based variation and a blue-based one never cross. Its
brand-ready marker lives in `src/variations/{id}/variation.json`, Step 0 already
wrote it as `"established"`, so there's nothing to click; the styleguide shows no
banner.

The brand palette lives in **two coupled files that must stay in sync**, both in
the scope's `styles/` folder:
1. **`brand.ts`:** the manifest the styleguide renders its **Primitives → Colors**
   swatches from. Its `brand.paletteGroups` array holds **named color groups**,
   each `{ title, description?, colors: [{ name, token, value, text, role }] }`.
   Each group renders as its own titled subsection.
2. **`tokens.css`:** the CSS declarations under the Brand colors block (e.g.
   `--ta-primary: #1e4b96;`) that components actually consume via `var(--ta-*)`.

The styleguide no longer has a hardcoded color array, it reads `brand.ts` through
`resolveBrand(variationId)`, so writing the manifest is what makes swatches appear.

**Color groups are the extensible unit.** To **create** a color section, add a new
`{ title, colors: [...] }` group; to **remove** one, delete its group. The shadcn
**System Palette** is a FIXED reference (hardcoded in `StyleGuide.tsx`), it is NOT
a group and must never be added to, removed, or mixed with `--ta-*` here.

**Colors are SEMANTIC ROLES, not color names, this is the key rule.** The palette
ships as seven stable role tokens (`--ta-primary`, `--ta-accent`, `--ta-surface`,
`--ta-ink`, `--ta-body`, `--ta-muted`, `--ta-border`), and every component
references those roles. So you **set each role's VALUE and personalize its display
`name`** (e.g. rename "Primary" → "Navy"), but you **never rename the token slug,
and you never touch component files.** Because the slugs are stable, a palette
change can't orphan a component reference, so there is **no grep-and-remap step**,
that whole class of breakage is gone. (If the designer supplies extra colors beyond
the seven roles, add them as additional tokens/groups, but keep the seven roles
filled, components depend on them.)

**If Step 0.5 already ingested references,** you already have the exact palette + fonts
from `.thinkany/references/digest.json`, **skip the supply question below** and go
straight to mapping those values to the seven roles + write → preview → adjust live.

**Otherwise, ask how the designer wants to supply the palette:** one
`AskUserQuestion`, header **"Client Palette"**, `question` text below (blank
line before the parenthetical, a real `\n\n` in the string):

> How would you like to supply the client's color palette?
>
> (You will have the opportunity to create multiple palettes, this is for the
> initial design variation)

Three options, **in this order** (first = default):
- **From a website:** paste a URL; you'll read its palette (and fonts) straight
  from the site's CSS, no browser needed.
- **Enter all colors manually:** you'll prompt for each color one at a time.
- **Let Claude create from a single primary color:** give a single brand hex;
  you'll derive a full system.

Then, per method:

**Method A, Manual (iterative, one color at a time).**
Loop: for each color, one `AskUserQuestion` panel with three questions,
1. "Color name" (e.g. `Navy`), becomes the swatch's display `name`.
2. "Hex value" (e.g. `#1e4b96`).
3. "Role", which of the seven roles it fills (primary / accent / surface / ink /
   body / muted / border), which decides the token slug it maps to.
After each color, ask "Add another color?" (**Add another / Done**). Continue
until the designer chooses Done.

**Method B, From a website URL.** Use the **non-browser CSS-fetch** method, it's
the consistent one. **Do NOT open a headless/automation browser or take
screenshots to read colors:** that path gets permission-gated and produces
inconsistent results; stay with plain HTTP fetches of the markup + stylesheets.

1. **Fetch the source.** First try `WebFetch` with an extraction prompt that asks for
   the raw style values **verbatim, not summarized:** **every hex / `rgb()` /
   `hsl()` color, CSS custom properties (`--*`), `<meta name="theme-color">`, and
   `font-family` stacks:** in the page's inline styles **and** its linked
   stylesheets. If `WebFetch` still returns prose instead of real values, fall back
   to a **plain curl + grep**.

   **Keep that fallback command statically analyzable** so the committed `curl` /
   `grep` allowlist can auto-approve it instead of prompting. **Do NOT** wrap it in
   shell the permission matcher can't decompose: **no `UA="…"` variable, no
   `cd … || cd …` fallback, no browser User-Agent string full of `;()`:** any of
   those makes the *whole* command unanalyzable, so it prompts even though `curl` is
   allowed. Use a single plain `curl` to a scratch file, then plain `grep`s, e.g.:

   ```
   curl -fsS --max-time 10 -A "Mozilla/5.0" "<url>" -o /tmp/site.html
   grep -oiE '#[0-9a-f]{6}' /tmp/site.html | sort | uniq -c | sort -rn | head -20
   grep -oE 'href="[^"]*\.css[^"]*"' /tmp/site.html | head -20
   ```

   Then `curl` any promising `.css` hrefs the same way and grep those for the same
   tokens. (All non-browser, no puppeteer.)
2. **Rank + winnow.** Keep the recurring brand colors by prominence/frequency;
   drop near-duplicate shades and incidental one-off greys. Note the site's real
   `font-family` stacks too, offer them as suggested type roles (Display / body),
   though actual font wiring still follows the Fonts step (1b).
3. **Assemble, then write + preview live.** Build the named palette (name + hex +
   role per color), then write it (see "Map to the seven roles" + "Write both
   files" below). The **live styleguide preview** shows the real swatches, that's
   where the designer confirms and adjusts. Do NOT publish a claude.ai Artifact or
   hold a text-only confirm first; write, let the preview render, then refine live.
4. **If the site yields too little** (a JS-heavy SPA with no usable CSS in the
   fetched source), **do not escalate to a browser.** Say so plainly and fall back:
   ask the designer for the brand hex(es) or logo, or switch to **Method C** (derive
   from one primary color).

**Method C, From one primary color.**
Ask for a single primary hex, then derive a coherent system from it with sensible
color theory, typically one or two accents (e.g. a complementary/secondary), a
neutral ramp (a near-black ink plus 2–3 greys), and a page background. Write the
derived palette (below); the **live styleguide preview** then shows the real
colors and the designer confirms/tweaks from there. No artifact, no
confirm-before-write.

**Swatch preview = the LIVE styleguide, NOT a claude.ai Artifact.** This scaffold
has a live styleguide preview, the desktop app opens its **Style guide** tab
automatically once the palette is written (in the IDE / Claude Desktop it's the
running dev server at `/?v={id}&styleguide`). Its **Primitives → Colors** section
renders every color as a real chip, that IS the swatch view. So **do NOT publish
an Artifact** (a `claude.ai/…/artifact` link) for the palette; that's the wrong
surface here. The flow is **write → preview → adjust live**:

- Map the colors to the seven roles and **write** `tokens.css` + `brand.ts` (below).
- Flip `previewReady: true` (below), the Style guide tab opens on the real swatches.
- Then invite adjustments in plain language ("Want the primary a touch warmer, the
  surface lighter?"); each tweak is an edit to `brand.ts` / `tokens.css` and the
  preview hot-reloads. Refine there instead of re-confirming a text list. (Manual
  entry / Method A: the designer supplied the hexes, so just write + preview.)

**Map to the seven roles (all methods), do NOT invent slugs from color names.**
The token slugs are FIXED: `--ta-primary`, `--ta-accent`, `--ta-surface`, `--ta-ink`,
`--ta-body`, `--ta-muted`, `--ta-border`. For each color the designer gives you,
decide which role it fills (primary = links/buttons; accent = highlights/badges;
surface = backgrounds; ink = headings; body = paragraph text; muted = captions;
border = dividers) and set that role's **value**. Put the designer's own color name
in the `name` field (e.g. `name: "Navy"`, `token: "--ta-primary"`). This is what makes
a palette change safe, components reference the role slugs, so you never rename a
slug and never edit a component. If the designer has MORE colors than the seven roles,
add the extras as additional `--ta-*` tokens (own slugs fine) in a separate group, but
always keep the seven roles filled.

**Contrast (`text`) field.** For each color entry, compute a legible overlay text
color from the hex's luminance, dark swatch → `#ffffff`, light swatch → a
near-black. The styleguide uses this both for legibility and to decide which
swatches get a hairline border, so set it accurately.

**Group the colors.** Ask which group these belong to (default **"Brand Palette"**,
or a new named group like "Semantic States" / "Data Viz"). A full palette setup
usually replaces the single default group; an "add a section" request appends a
new group and leaves existing ones intact.

**Write both files** in the scope's `styles/` folder for the confirmed palette:
- In **`brand.ts`**, update each of the seven role entries in the "Brand Palette"
  group, set its `value`, `name` (the designer's color name), `text`, and `role`,
  **keeping the seven `token` slugs unchanged.** Append a new group only for extra
  colors beyond the roles. The styleguide derives its swatch count, group headings,
  and "N brand tokens" prose automatically, no other edit.
- In **`tokens.css`**, set the matching `--ta-*` role **values** under the Brand
  colors block (keep the slugs), leaving `--admin-*`, `--ta-font-*`, and the system
  palette untouched.

**The brand marker is already clear.** Step 0 wrote `"brandStatus": "established"` into
`variation.json`, so the styleguide won't flag its Colors as template defaults,
nothing to click. (If you ever need to re-flag/clear it by hand, edit that field in
`src/variations/{id}/variation.json`.)

**Leave the preview closed for now, fonts come next.** Keep `previewReady: false`
(Step 0's value), do **not** flip it here. The palette is written, but the app must
not pop the styleguide browser open mid-setup, before the client's fonts are chosen.
You flip `previewReady` to `true` at the **end of the Fonts step (1b)**, so the
preview opens **once**, on the real colors AND fonts together. Not earlier, not
per-color.

### 1b. Fonts

**When you offer font pairings with `AskUserQuestion`, make the options renderable in
their real typefaces.** The app shows each font option **in its actual faces** (the
display family drawn large in itself, a body sample in its companion) so the designer
can *see* a pairing instead of researching names. For that to work:
- Use **real [Google Fonts](https://fonts.google.com) family names**, spelled exactly
  (e.g. `Playfair Display`, `Source Sans 3`, `Fraunces`), not descriptive nicknames.
- Format each option's **`label`** as **`{Display Family} + {Body Family}`**, the app
  splits on the `+` (also `/`, `·`, `&`, "and", "with") to know which face is heading
  vs body. One family alone (no separator) is fine for a single-font option.
- Put the pairing's *character* ("elegant editorial", "clean and modern") in the
  **`description`**, not the label, the label is the faces themselves.
- Keep families to ones actually on Google Fonts so they load; an unknown name simply
  falls back to a system face (still selectable, just not previewed).

In the scope's `styles/` folder: declare/import the families in `fonts.css`, then
point the `--ta-font-*` tokens in `tokens.css` at them. The type specimens render
from `brand.fonts` in `brand.ts` (the four roles, Display / Serif / Sans / Mono);
edit a role's `name`/`role`/`sample` there if needed, but the family value itself
lives only in `tokens.css` (the manifest references it via `var(--ta-font-*)`).

Confirm the changes show up in the styleguide's **Primitives → Colors / Type
Scale** sections, those swatches read the live token values, so they should
reflect your edits immediately.

**Now open the live preview, set `"previewReady": true`.** Colors AND fonts are both
written, so this is the point where the styleguide has the real palette and type to
show, and the right moment for the browser to open. Edit the `previewReady` field in
`src/variations/{id}/variation.json` (Step 0 wrote it as `false`) to `true`. That flip
is the signal the desktop app waits on: it holds the preview closed while the variation
is created and the palette + fonts are set, then opens the styleguide + home tabs on the
real design. Flip it **once, here at the end of fonts:** not earlier, not per-color, and
never before the fonts are in.

**In the same edit, capture the design's identity** for the dashboard's brief modal:
add **`primaryColor`** (the `--ta-primary` hex you set in 1a) and **`primaryFont`** (the
primary/display font family, the first family in `--ta-font-display`) to
`variation.json`. The modal shows these; the brand manifest stores only a CSS-var ref
for fonts, so recording the family here is what lets it display accurately. (The
`/design-brief` path writes these automatically via `apply-brand.mjs`; this line covers
the manual setup path.)

### 1c. Bridge the shadcn primitives to the brand

The `--ta-*` tokens above style the *designed pages*. But the 40 shadcn/ui
components in `src/app/components/ui/` (Button, Badge, Alert, form controls…) read
a **separate** namespace, `--primary`, `--secondary`, `--destructive`,
`--foreground`, …, which ships at stock shadcn defaults (near-black navy, red).
Until they're bridged, every shadcn component renders **off-brand** in the live app
*and* in the Figma **Components** export (which faithfully mirrors whatever those
primitives currently are). This step points the brand-carrying primitives at the
palette you just set, so the components inherit the brand everywhere.

> **Scope.** This bridges the **client** palette (`--ta-*`) into the **shadcn**
> primitives only. Do **not** touch `--admin-*` (tooling chrome), those stay
> neutral and constant. Write the mappings as `var(--ta-*)` **references** (not
> copied hex) so there's still one source of truth, and only in the `:root` block,
> leave the `.dark` overrides alone (the palette + the Figma export are single
> light mode).

**Auto-map, do NOT ask.** Apply the mapping below automatically; don't prompt the
designer whether or how to bridge. The seven semantic role tokens make it
deterministic, there's a right target for every row, so just do it. Write the
mappings into the scope's `tokens.css`, **`:root` only**, replacing each primitive's
value with the `var()` **reference** (leave the `.dark` overrides alone). Afterward,
tell the designer in **one line** that their buttons/badges/inputs now carry the
brand, informational, not a decision.

| shadcn primitive | ← maps to (semantic role) |
|---|---|
| `--primary` | `var(--ta-primary)` |
| `--primary-foreground` | the primary's contrast, its `text` field from `brand.ts` (or `#ffffff`) |
| `--secondary` | `var(--ta-surface)` |
| `--secondary-foreground` | `var(--ta-ink)` |
| `--accent` | `var(--ta-surface)` |
| `--accent-foreground` | `var(--ta-ink)` |
| `--muted-foreground` | `var(--ta-muted)` |
| `--ring` | `var(--ta-primary)` |
| `--destructive` / `-foreground` | **keep stock** (unless the brand explicitly defines a semantic red) |
| surfaces (`--background`, `--card`, `--popover`, `--foreground`, `--border`, `--input`) | **leave neutral:** only map `--foreground` → `var(--ta-ink)` if the brand wants non-black ink |
| `--chart-*`, `--sidebar-*` | **leave alone** (data-viz has its own palette; sidebar is tooling) |

After writing, confirm the shadcn components in the styleguide's **Atoms** section
(buttons/badges) now render in the brand palette. The Figma **Components** export
reads these same primitives, the exporter follows the `var()` references to the
resolved brand color, so a later component export is on-brand automatically.

### 1d. Client logo, the design-page header

The global site header (`src/app/components/Header.tsx`, rendered on every design
page by `DesignSurface`) has a **logo lockup**. Out of the box it shows the client
name as a **text wordmark** (`{siteConfig.clientName}` in the display font). This
step offers to swap in a real logo image for the first design pass.

> **Scope.** This is the **design** logo (the pages' header), distinct from the
> **login-screen** logo `/setup-project` sets in `middleware.js`. They're often the
> same file; they don't have to be. Edit the **working variation's**
> `src/variations/{id}/components/Header.tsx` (created in Step 0), never the base.

**First, read the current state** so you ask the right question:
- Open `src/variations/{id}/components/Header.tsx` and look at the logo lockup (the
  button that calls `onNavigate("home")`).
  - Renders **only the text wordmark** (`siteConfig.clientName`, no `<img>`) → the
    logo is **BLANK**.
  - Renders an **`<img src="/brand/…">`** → a logo is **IN PLACE**.
- Also list **`public/brand/`:** a file may already sit there from the login-logo
  step (`/setup-project` 2a); if so, note its name so you can offer to reuse it.

**Then branch with one `AskUserQuestion`, header "Design logo":**

**If BLANK:** *"Your design pages currently show **{clientName}** as a text
wordmark in the header. Add a logo image for this first design pass?"*
- **Yes, add a logo** (first) → give the copy-in instructions below.
- **Reuse my login logo (`/brand/{file}`)** → *offer this option only if a logo
  already exists in `public/brand/`*, wire that same file in, no new copy needed.
- **Not now, keep the wordmark** → leave `Header.tsx` as-is; note they can add one
  anytime.

**If IN PLACE:** *"Your header already uses a logo (`/brand/{file}`). Use this one
for the design, or swap in a different file?"*
- **Use this one** (first) → nothing to do; confirm and move on.
- **Add a different file** → give the copy-in instructions below, then rewire.

**Copy-in instructions (when they choose to add/replace a file).** That question's
card carries an **📎 Upload** button (and accepts drag-drop), the easy path since
images can't be pasted into chat. Get the file into **`public/brand/`**:
1. **If they uploaded** → the answer is the **path where the app placed the file**
   (e.g. `./public/images/<name>`). **Move it into `public/brand/`** (create the
   `brand` folder if it isn't there yet, it won't be on a fresh copy).
2. **If they didn't upload** → point them to the **Upload** button on that card, or
   have them copy the file into **`public/brand/`** themselves and tell you the
   filename.
3. **What.** Prefer an **SVG** (crisp at any size) or a **transparent PNG**, e.g.
   **`logo.svg`**. Anything under `public/` is served from the site root, so
   `public/brand/logo.svg` is referenced as **`/brand/logo.svg`** (the `public/`
   prefix is dropped from the URL).

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

> **Heads-up, a committed asset.** Files in `public/` are committed to the repo and
> deployed, so the logo ships in git and is publicly reachable on the Vercel preview
> at `/brand/<file>`. If the client would rather it not live in this project, keep
> the wordmark instead.

## 1.5. Copy voice, optional, rules for how the words read

The design's **copy voice** is how the AI writes the words *in* the design (rules like
"no em dashes", "active voice", "sentence-case headings"), separate from the visual look
you just set. Any **global** rules the designer carries across projects are already in
effect and appear in your working context, this step lets them add rules for **this**
project.

- **Ask once, with `AskUserQuestion`** (header **"Copy voice"**), and make it clearly
  optional (most will skip): *"Any rules for how I should write this design's copy?"*.
  Offer a few examples as options (e.g. *No em dashes*, *Short, clear sentences*,
  *Active voice*, *Sentence-case headings*); the tool appends "Other → type your own", so
  they can add their own. If global rules are already in effect, mention them in one line
  so the designer sees what's in play before adding.
- **If they add any**, save them as this project's rules: read
  `.thinkany/copy-voice.json` if it exists (shape
  `{ "tone": "", "rules": [], "declineGlobal": false }`, default to that if absent),
  **append** the new rules to `rules` (trim, drop case-insensitive duplicates), and write
  the file back (create `.thinkany/` if needed). Only add to this project's `rules`, never
  touch global rules, they live outside the project.
- **If they skip**, write nothing and move on.

One question, no recap. Then continue to step 2.

## 2. The working variation's name (just inform)

The dashboard lists each design as a **variation**. Step 0 already titled the working
variation **"Initial Design"**. If you mention it, keep it plain: the working design is
titled "Initial Design" in the dashboard, and they can rename it any time by just saying
so. No action is needed during setup.

**Never expose implementation detail in designer-facing copy.** Do not mention file
paths, `variation.json`, `src/…`, or the internal **"Base"** blueprint in anything the
designer reads (chat replies, summaries, sign-offs). Those are internal, they read as
noise to a designer. Say "the working design in the dashboard," not where it lives on
disk.

## 3. The example sections are flexible, just inform (no question)

Do **not** walk the designer through a per-section Keep/Replace/Remove decision
during setup. Give one short, **informational** heads-up (no `AskUserQuestion`, no
options), verbatim or close to it:

> The Styleguide's sections can be adjusted/renamed etc. at any time. The default
> layout is for example purposes only. Ask Claude to adjust to your preference or
> simply re-work the template.

Then leave the sections as they are, they get shaped later, as the project's real
components get built (Atoms → Molecules → Organisms → Templates → Pages). Keep the
universal Primitives and generic Atoms (buttons, badges, form controls, icons)
unless there's a strong reason not to.

## 4. Readiness is automatic, nothing to mark

You don't need to mark anything done. Step 0 wrote `"styleguideStatus": "updated"` and
`"brandStatus": "established"` into the variation's `variation.json`, so its styleguide
shows **no setup banner**. Base v00 never shows one either (it's the pristine blueprint).

The only time the "inherited the base styleguide" banner appears is when a designer
later **duplicates** a variation via *Make New Variation* and checks "needs its own
styleguide", then that copy carries the banner + an in-page **Mark as updated** /
**Mark brand established** button (which writes the variation's `variation.json`) until
they clear it. It never applies to the variation this setup just configured.

## 5. Sign off, onboarding complete

This is the **true end of onboarding** and the one place the Phase I deferrals land.
Deliver them here, **in this order**, and only now (there's finally a design worth
sharing). **If `/setup-styleguide` was run standalone** (not reached via the
`/setup-project` handoff), skip 5a–5c, those are Phase I's, and go straight to the
wrap (5d).

### 5a. Branding recap + build-time note

Give the concise recap of what's now in place (this is the recap deliberately held
back from setup-project step 7): **Company** (from the Company Profile), **Client**,
**Project**, **Type** (with the active previews), and **Menus**. Then the build-time
note: these are Vite build-time
values, so the local preview picks them up on reload, but a published build only
reflects changes on a fresh publish.

### 5b. Publish, it's built into the app

Now introduce sharing (held back from setup-project step 7). Sharing a live, client-
ready preview is one button, the **Publish** icon in the left rail. The app does the
whole job: **no GitHub push, no manual Vercel import, no environment variables to
paste**. What to tell them:
- **Connect once.** In the Publish drawer, **Connect with Vercel** (a free account is
  enough; sign-in opens in your browser) or paste a Vercel access token.
- **Publish.** One click uploads the design, lets Vercel build it, and returns a
  private, **password-gated URL** to send the client. The app **generates the preview
  password** and shows it right after publishing (you can reset it any time).
  Re-publishing later keeps the same URL and just ships the latest.
- **The sign-in screen brands itself** from this project's company/client info, so the
  branding above is what makes the shared link look like theirs.

Under the hood the gate runs on Vercel's edge (`middleware.js`, which can't read
`.env`/`VITE_*`), but the app sets its config + secrets (`CLIENT_NAME` /
`PROJECT_TITLE` / `ADMIN_PASS`) in the Vercel project, so the designer never touches
environment variables and secrets never go in `.env`.

### 5c. Point them to the Company Profile for reuse

The company layer (name, admin fonts, logo) is the **same for every project** this
designer does, and the app already owns it: the **Company Profile panel** saves it as
a reusable default and auto-applies it to each new project. So don't run a save/export
flow here, just a **one-line pointer** so they know it exists, e.g. *"Your company
identity is saved in the Company Profile panel and reused automatically on your next
project, no need to set it up again."* Skip even that if it's obviously already
familiar to them.

### 5d. Warm wrap

Give a short, warm wrap: they're branded and ready to start designing pages.

For the full list of commands, point them to the **life buoy (help) icon** rather
than any typed command.

Then, **on its own line** (separated from the help note), give the next-step nudge
close to verbatim:

> The quickest next step is just to describe the page you want ("a homepage with a
> hero, three product highlights, and a newsletter signup") and I'll start designing it.

## Variations carry their own styleguide, fully siloed

This command configures **one variation**. Base v00 is the pristine template
blueprint in `src/styles/` + `src/app/components/`; each variation is a full copy
under `src/variations/{id}/` (including its own `styles/brand.ts` +
`styles/tokens.css`), rendered at `/?v={id}&styleguide`. There is **zero crossover**:
`resolveBrand({id})` returns only that variation's manifest, and App injects only
that variation's `tokens.css`. So `/setup-styleguide` gathers and applies values to
**that variation alone**.

Readiness is a per-variation concept only: each variation carries its own
`styleguideStatus` and `brandStatus` in its **`variation.json`** (set by Step 0, or
via the in-page buttons for a later duplicate, no `.env` flags, those are retired).
Base has no readiness state.

---

If arguments were passed in `$ARGUMENTS`, treat them as the designer's answers or
focus (e.g. a specific step) and proceed accordingly; otherwise work through the
steps interactively, pausing for the designer's fonts/colors and decisions.
