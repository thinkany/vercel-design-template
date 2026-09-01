# Developing this repo (the *thinkany design* app + template)

This is the app-development guide. It is **stripped from the scaffold snapshot**
(see `desktop/template-exclude.cjs`), so a scaffolded project never sees it.
Human-facing design docs are `README.md` + the scaffold's `CLAUDE.md`.

## One repo, one production line

`main` carries **both** halves of the product, flat at the repo root:

- **The Electron app** — `desktop/` (main.cjs, shell.js, copy.js, agent.mjs, build/…)
  and the root `package.json` (`main: desktop/main.cjs`, electron-builder).
- **The design-template scaffold** — `src/`, `scripts/`, `.claude/`, `index.html`,
  `vite.config.ts`, `middleware.js`, `CLAUDE.md`, etc. The app **embeds** this: a clean
  snapshot is generated into `desktop/template/` and copied into each new project.

The app's `package.json` is a superset (React/Vite/Tailwind **and** electron). The scaffold
needs its own electron-free `package.json` — that's `desktop/build/scaffold-package.json`,
which the snapshot build swaps in. **If the scaffold's deps change, update that file.**

## Branch model

- **`main`** = production-ready. Releases (DMGs) are built from here.
- **`feature/*`** = where new work happens. Branch off `main`, PR/merge back.
- Older branches (`feature/onboarding-intake`, `feat/*`, `poc/*`, `figma-*`) are historical;
  `feature/onboarding-intake` holds the app's granular pre-unification history.

## Develop from the `electron/` worktree

All app development happens in the **`electron/`** folder (a git worktree on `main`).
The old `project/` worktree (scaffold-only on `main`) is retired.

## Commands

- `npm run dev` — the scaffold's Vite dev server (design surface at :5173).
- `npm run desktop` — run the Electron app unpackaged (dev). It scaffolds/opens projects
  and, on project open, refreshes their framework files from the bundled snapshot.
- `node desktop/build/make-template.cjs` — **the local update without building**: regenerate
  the bundled `desktop/template/` snapshot from committed `main`. Run it after committing
  scaffold changes so `npm run desktop` (and refresh-on-open) pick them up — no DMG needed.
- `source notarize.env.local && npm run dist` — build + notarize the release DMGs. `predist`
  bumps the version, runs `make-template`, and ensures arch deps. **Build from a committed
  tree**: `dist` strips comments out of `desktop/*.{js,cjs,mjs}` in place, then restores them
  with `git checkout` once electron-builder is done (see below), so uncommitted edits to
  those files would be lost. The stripper refuses to start on a dirty tree for that reason.

## What ships in the bundle

The app code is packed into `app.asar`, so `Show Package Contents` no longer exposes a
readable `app/` directory. Four things must stay real files on disk and are listed in
`build.asarUnpack`: `desktop/bin/**` (spawned as executables, on the agent's PATH),
`desktop/template/**` (copied out to scaffold projects), `scripts/**` (resolved and spawned
by `ta-export`), and `node_modules/**` (cloned to userData; Vite's bin is spawned directly).

Paths derived from `__dirname` still read `app.asar`, so anything pointing at those four
must go through `unpacked()` in `main.cjs`. **If you add a spawn, an ESM `import()`, or a
file copied out of the bundle, route its path through that helper** or it will resolve to a
path inside the archive and fail only in the packaged app.

`strip-comments.cjs` removes comments from the shipped copy (~190KB), since they otherwise
name the cloud endpoints, the license gates, and where the design-variety moat lives. Logic
files keep their line numbering so stack traces stay meaningful; `copy.js` (a data catalog)
is additionally whitespace-collapsed, which is the only way to clear comments nested inside
its object literals. `desktop/template/` is deliberately left commented — it ships into the
designer's project, where the comments guide the designer and the agent.

## How the snapshot stays clean

`make-template.cjs` runs `git archive main`, strips `TEMPLATE_EXCLUDE`
(`desktop/`, the app docs, the Figma export IP), and swaps in
`scaffold-package.json`. The runtime scaffolder (`main.cjs`) applies the same strip +
swap on its dev `git archive` fallback; the packaged app copies the pre-built snapshot.

## Reaching existing projects

Scaffold/framework changes reach existing projects two ways: a **new DMG** (its bundled
snapshot refreshes CORE files on project open), or the designer running **`/upgrade`**.
CORE is overwritten, the designer's work (KEEP tier) is never touched — see
`upgrade.manifest.json`.
