# CLAUDE.md — developing the *thinkany design* app

This repo is the **thinkany design Electron app** and the **design-template scaffold** it
ships, on one branch (`main`). You are here to **develop the app**, not to design a client
site. Read [DEVELOPMENT.md](DEVELOPMENT.md) for the full structure + workflow; this file is
the short contract.

> The scaffold's own designer-facing contract is **not** this file — it lives at
> `desktop/build/scaffold-CLAUDE.md` and is injected into each scaffolded project as its
> `CLAUDE.md`. Don't edit the scaffold's design behavior expecting *this* file to govern it.

## Layout
- **App** → `desktop/`: `main.cjs` (Electron main + IPC), `shell.js` (renderer/UI),
  `copy.js` (user-facing copy catalog), `agent.mjs` (Claude Agent SDK + personas),
  `build/` (make-template, electron-builder, notarize). Root `package.json` is the app's.
- **Scaffold** → repo root (`src/`, `scripts/`, `.claude/`, `index.html`, `vite.config.ts`,
  `middleware.js`, …). The app embeds it as a clean snapshot in `desktop/template/`.

## Branch model
`main` = production-ready (DMGs build from it). Branch `feature/*` off `main` for new work.

## Commands
- `npm run desktop` — run the app unpackaged (dev).
- `node desktop/build/make-template.cjs` — regenerate the bundled scaffold snapshot from
  committed `main` (the **local update, no DMG**). Run after committing scaffold changes.
- `source notarize.env.local && npm run dist` — build + notarize the release DMGs.

## Keeping the snapshot clean (when touching the scaffold or app boundary)
`make-template.cjs` + `desktop/template-exclude.cjs` strip app-internal files (`desktop/`,
`CLAUDE.md`, `DEVELOPMENT.md`, app docs, Figma export IP) and inject the scaffold's own
`package.json` + `CLAUDE.md` (`desktop/build/scaffold-package.json`,
`desktop/build/scaffold-CLAUDE.md`). If the scaffold's deps or its designer contract change,
update those two assets. The dev `git archive` fallback in `main.cjs` mirrors the same swaps.

## House rules
- **No em-dashes** in anything a person reads (chat, code comments, copy, docs). Use a comma,
  colon, parentheses, or two sentences.
- **Don't narrate routine tool calls.** Speak for milestones, findings, decisions, blockers.
- Match the surrounding code's idiom; user-facing app strings live keyed in `desktop/copy.js`.
