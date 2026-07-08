---
description: Phase II — configure the styleguide (fonts, colors, example sections) for this project
---

This is **Phase II** of standing up a new project from this template, done
*after* `/setup-project` (which sets the brand name/subtitle/tagline in `.env`)
and *before* any real page/site design work.

The styleguide (`src/app/components/StyleGuide.tsx`, viewable at `/?styleguide`)
is the living reference every later design decision is checked against. It ships
mostly-universal, with one **generic example** per component level as a
copy-me pattern. Your job here is to make its foundation reflect *this* project.

Walk the designer through these steps:

## 1. Set the Primitives — fonts & colors (the token layer)

The single source of truth is **`src/styles/tokens.css`** — pure CSS custom
properties that both the live site and the styleguide read from. Edit:

- **Colors** → the `--dfr-*` brand tokens (and the system palette) in
  `src/styles/tokens.css`. Set colors here, never as hardcoded hex in components.
- **Fonts** → declare/import the families in `src/styles/fonts.css`, then point
  the `--dfr-font-*` tokens in `src/styles/tokens.css` at them.

Confirm the changes show up in the styleguide's **Primitives → Colors / Type
Scale** sections — those swatches read the live token values, so they should
reflect your edits immediately.

## 2. Adapt the example sections

Go level by level in the styleguide (Atoms → Molecules → Organisms → Templates
→ Pages). For each generic example:

- **Keep & restyle** it if the pattern applies to this project, or
- **Replace** it with this project's real component as you build it, or
- **Remove** it if the project doesn't need it.

Keep the universal Primitives and generic Atoms (buttons, badges, form controls,
icons) unless there's a strong reason not to.

## 3. Mark it done

Once the styleguide's tokens and sections reflect the project's foundation, set
`VITE_STYLEGUIDE_READY=true` in `.env`. That clears the setup banner at the top
of the styleguide page. (Vite reloads on the change.)

## Variations carry their own styleguide

This command configures the **base (v00)** styleguide. Each design variation
created from the dashboard gets its *own* copy of the styleguide (and tokens) as
a starting point, rendered at `/?v={id}&styleguide`. At creation the designer is
asked whether that variation needs its own styleguide changes; if so, its
styleguide shows an inline "inherited — review" banner with a **Mark as updated**
button (per-variation state, no `.env` edit needed). So `VITE_STYLEGUIDE_READY`
governs the base only; variations manage themselves.

---

If arguments were passed in `$ARGUMENTS`, treat them as the designer's answers or
focus (e.g. a specific step) and proceed accordingly; otherwise work through the
steps interactively, pausing for the designer's fonts/colors and decisions.
