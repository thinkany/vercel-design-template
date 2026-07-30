---
description: Show the commands this project offers (setup, design, preview) — designers can type /guide at any time
---

Print a short, friendly list of the commands **this project** provides, so the
designer knows what's available. Present it as plain text (not a tool call), keep
it scannable — a title line, then each command with a one-line description, then
the preview/stop note. Use roughly this content, lightly adapted to the moment:

**Commands in this project**

- **/setup-project** — brand the template: set the client/project name and the
  company (admin) fonts. Run this first on a fresh copy.
- **/setup-styleguide** — Phase II: set the client fonts & colors and finish the
  styleguide. `/setup-project` hands off into this automatically.
- **/design** — build or edit a design page (a hero, sections, a full landing).
  The everyday design command once setup is done.
- **/guide** — show this list.

**Not commands — just ask in plain language:**
- **Something looks wrong** — if a menu, section, or element isn't showing, is cut
  off, or sits in the wrong place, just say so ("the mobile menu isn't showing").
  I'll screenshot the design and fix the layering/positioning myself — you don't
  need to open dev tools.
- **Export to Figma** — say "export to Figma" and I'll walk you through the scope
  options: the styleguide + blocks, the pages composed from those blocks, or both —
  as one cohesive, editable Figma file.
- **Run / stop the preview** — say "start the dev server" or "stop the server."
  The live preview runs at http://localhost:5173 (`npm run dev`). If you have multiple projects open :5173 might be a different port (:5174, :5175) so it's always a good idea to stop the server when leaving a project.

**Claude Code's own commands** (separate from this project — help, config, model,
etc.) live under **/help**.

If the designer typed a question alongside `/guide`, answer it after the list.
