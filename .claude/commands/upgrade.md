---
description: Apply the latest template version to this project (overlay CORE files, keep the designer's work), then walk the diff
---

Update this project to the newest template version. This is the **transparent
front door** to the same overlay engine the dashboard's one-click "Update" button
uses (`scripts/upgrade.mjs`) — here you run it, explain the result, help merge any
review files, and walk the git diff. It's a **local** operation (needs Node + a git
repo); it never runs on Vercel.

**How the overlay is safe:** `upgrade.manifest.json` splits files into tiers —
**CORE** overwritten (framework: build config, `scripts/`, App/registry machinery,
base chrome + `Home`, `ui/*`, `*.schema.ts`, base styles), **KEEP** never touched
(the designer's work: `.env`, `src/variations/**`, `public/images`, `pages.ts` /
`menu.ts` data, base `tokens.css`/`brand.ts`), and **REVIEW** written to a
`*.upgrade-new` sidecar so the designer merges by hand (`package.json`,
`.claude/settings.json`). The designer's own `git diff` is the safety net, so the
engine refuses to write on a dirty tree unless forced.

Walk these steps:

## 1. Preflight

- Confirm this is the project root (a `package.json` + a `.git` dir). If there's no
  `scripts/upgrade.mjs`, this copy predates the upgrade system — tell the designer to
  update once by hand (or re-download) and stop.
- Check the tree is clean: `git status --porcelain`. **If dirty**, tell the designer
  plainly and recommend committing or stashing first (so the upgrade lands as a clean,
  reviewable diff). Offer to proceed anyway only if they insist (that's `--force`).

## 2. Preview (dry run)

Run the engine's dry run — it fetches the latest zip from `create.thinkany.design`,
compares versions, and reports without writing:

```
node scripts/upgrade.mjs --dry-run
```

Read the output and tell the designer, in plain language: the version jump
(`X → Y`), how many files will update, how many need review, and that their work is
kept. If it says "up to date" (no newer version), say so and stop. If the fetch
fails (offline / gated), say so and stop — don't guess.

## 3. Apply

Once they're ready (and the tree is clean, or they chose to force):

```
node scripts/upgrade.mjs            # or add --force if they accepted a dirty tree
```

## 4. Walk the result

- **REVIEW sidecars.** For each `*.upgrade-new` the report lists, diff it against the
  file in place (e.g. `git --no-pager diff --no-index package.json package.json.upgrade-new`)
  and help the designer merge the template's changes into their file, then delete the
  sidecar. These are usually small (a new script, a new permission).
- **Show the diff.** `git --no-pager diff --stat` for the shape, and offer to walk any
  specific file.
- **Undo is always available.** Before writing anything, the overlay snapshots every
  file it will overwrite into `.upgrade-backup/<timestamp>/` (gitignored). To roll the
  whole update back — restore the overwritten files, delete what it added, remove the
  sidecars — run **`node scripts/upgrade.mjs --revert`** (or the dashboard's **"Revert
  update"** button). Git works too (`git restore .`) on a clean tree; the backup covers
  non-git / forced applies as well.
- **A dev-server restart is usually NOT needed** — a browser refresh picks up most
  updates. Only restart `npm run dev` if something looks off after refreshing (the
  overlay does rewrite `vite.config.ts`).

## 5. Commit

Offer to commit the upgrade as its own commit (e.g. `chore: upgrade template to vY`),
keeping it separate from design work so it's easy to find or revert later.

If `$ARGUMENTS` names a specific zip/url/source (e.g. a local `--zip path`), pass it
through to `scripts/upgrade.mjs`; otherwise the default canonical URL is used.
