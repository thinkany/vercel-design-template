# Spec: browser-free capture for the agent's diagnose reflex

**Status:** draft / deferred (logged 2026-08-12)
**Where it lands:** the Electron app (`capture-bridge.cjs` + a new `desktop/bin` CLI + env plumbing) and the scaffold (`.claude/commands/diagnose.md`).
**Priority:** medium. Not urgent, the acute failure it caused is already fixed (see "Context"). The real driver is distribution robustness.

## Problem

The `/diagnose` skill's core reflex is "headlessly screenshot the `?capture=` route and LOOK." Its copy-pasteable driver (`diagnose.md` §0) uses **puppeteer** via `import puppeteer`. But:

- **puppeteer is NOT a dependency** of the app or the scaffold (confirmed 2026-08-12). So the documented script fails, and the model **improvises**, it launched **Google Chrome** (`--headless=new --screenshot`) found on the machine.
- That improvised path is **slow** (cold Chrome launch + virtual-time budget per width, looped over 3 widths) and **fragile for distribution**: it relies on Google Chrome being installed. Fine on Rob's Mac; not guaranteed for a shipped designer.
- The model **self-initiates** this mid-build (not instructed by the build prompt), to check its own responsive layout.

Meanwhile the app already ships a **native, browser-free capture path** (`desktop/capture-bridge.cjs`: a loopback HTTP server backed by a hidden `BrowserWindow`, driven by `scripts/lib/page-driver.mjs` → `RemotePageDriver`), used puppeteer-free by the Figma export. But it only exposes DOM-serialization primitives (goto / setContentSize / waitSelector / executeJavaScript / close), **no pixel screenshot op**, and it is **not reachable by the agent's Bash** (no CLI, no token/port in the agent env).

## Context (why this is deferred, not urgent)

The symptom that surfaced this (a ~21-min build looping on captures) was caused by the captures hitting a **dead port** (hardcoded `localhost:5173` while the project's Vite had drifted to 5174+). That is already fixed:
- **P1** (`71d309d`, feature/onboarding-intake): tree-kill Vite so servers stop orphaning, 5173 stays the project's port.
- **P2** (`28a9581`, main): `diagnose.md` + `design.md` read `$TA_PREVIEW_URL` (the app's real port) with a `:5173` fallback.

Post-P1/P2, an improvised Chrome capture at least hits the right port and returns a real image. So what remains is speed + the Chrome-installed dependency, quality, not a broken experience.

## Proposed fix (the right one)

Give the agent a **browser-free, app-native capture command** and point the diagnose reflex at it.

1. **Add a screenshot op to `capture-bridge.cjs`.** The bridge already runs a hidden `BrowserWindow`; add an op that `goto`s the capture route at a given viewport width, waits for `[data-capture-ready]`, and returns `webContents.capturePage()` as a PNG. NOTE: the preview `?capture=` route is a normal web page (not a PDF), so `capturePage()` in a hidden window works fine here, unlike the PDF-plugin case that forced us to mupdf for reference ingest (see [[reference-ingest-feature]]).
2. **Add a tiny CLI** in `desktop/bin` (mirror `ta-export`): e.g. `ta-capture <view> [route] -o scratchpad/shot-<view>.png`, resolving the base from `$TA_PREVIEW_URL`, hitting the bridge's loopback + per-launch token.
3. **Expose the bridge's loopback URL + token to the agent's Bash env** (same channel as `TA_PREVIEW_URL` / `TA_CAPTURE_*`), so the CLI can reach it. The bridge is per-session; main.cjs starts it and sets the env before spawning the agent.
4. **Repoint `diagnose.md` §0** from the puppeteer script to `ta-capture`. Keep a puppeteer fallback ONLY for the out-of-app CLI/VS Code path (where puppeteer may be installed), clearly gated ("in the app, use `ta-capture`").
5. **Optional behavioral gate:** discourage proactive mid-build screenshotting, reserve the capture reflex for an actual reported visual symptom, so a normal build doesn't self-verify via captures.

## Rejected alternative

**Add puppeteer as a dependency.** Heavy (~300MB Chromium download), redundant with the native bridge already in the app, and still a browser launch. The bridge path is lighter and already present.

## Testability

None of this runs in the agent sandbox (Electron GPU/renderer child processes are blocked there, see [[app-onboarding-robustness-bugs]]). `capturePage` of a normal page in a hidden window must be verified in the real app. Build one step at a time and verify live.
