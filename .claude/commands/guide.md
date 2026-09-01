---
description: Show the commands this project offers (setup, design, preview), designers can type /guide at any time
---

Print a short, friendly list of the commands **this project** provides, so the
designer knows what's available. Present it as plain text (not a tool call), keep
it scannable, a title line, then each command with a one-line description, then
the preview/stop note. Use roughly this content, lightly adapted to the moment:

**Commands in this project**

- **/setup-project:** set the client/project name, project type, tablet preview,
  and menu style. Run this first on a fresh copy. (Your company identity, name,
  admin fonts, and login logo, is handled in the Company Profile panel, not here.)
- **/import-company:** reuse your agency identity: restore your company name,
  admin fonts, and login logo from a saved company profile (from a past project),
  so you don't re-enter them. The Company Profile panel does this too.
- **/export-company:** save your agency identity (name, admin fonts, logo) as one
  portable file to import into future projects. The Company Profile panel can also
  save it.
- **/setup-styleguide:** Phase II: set the client fonts & colors and finish the
  styleguide. `/setup-project` hands off into this automatically.
- **/design:** build or edit a design page (a hero, sections, a full landing).
  The everyday design command once setup is done.
- **/upgrade:** pull the latest template version into this project. Overlays the
  framework files, keeps your work (`.env`, your designs, your palette) untouched,
  and walks you through the diff. The dashboard's "Update available" button does the
  same thing in one click.
- **/guide:** show this list.

**Not commands, just ask in plain language:**
- **Something looks wrong:** if a menu, section, or element isn't showing, is cut
  off, or sits in the wrong place, just say so ("the mobile menu isn't showing").
  I'll screenshot the design and fix the layering/positioning myself, you don't
  need to open dev tools.
- **Export to Figma:** say "export to Figma" and I'll walk you through the scope
  options: the styleguide + blocks, the pages composed from those blocks, or both,
  as one cohesive, editable Figma file.
- **The preview runs itself.** The app starts and manages the live preview for
  you, there's no dev server to launch or stop, and no localhost URL to open.

**Claude Code's own commands** (separate from this project, help, config, model,
etc.) live under **/help**.

If the designer typed a question alongside `/guide`, answer it after the list.
