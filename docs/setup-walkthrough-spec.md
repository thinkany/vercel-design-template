# Guided key setup spec

Status: **spec'd, not built** (2026-09-11). Part 2 of 2; part 1 is
[video-sourcing-spec.md](video-sourcing-spec.md).

Today a new install asks how the app will be used, then asks for the Claude key, then drops
the designer at "Choose a project". Every other credential (Figma, Design/Research, Unsplash,
Pexels) is discovered later, or never, by opening the padlock in the rail. The image keys in
particular are effectively invisible: a designer has to already know they exist to go find
them, which is why "builds never ask for video" is only half a video problem and half a
*setup* problem.

This spec turns first-run into a paced, Get-Designing-style walkthrough that introduces every
key in a deliberate order, each one revealed only after the previous is answered, with the
answered ones collapsing into a stack above. It ends with an explicit **Done setting up!**
button that hands off to the existing Help walkthrough.

**This reorders part 1.** The image/video keys stop being a thing a designer stumbles onto and
become something they were *offered* during setup. That materially raises the odds a Pexels or
Pixabay key is present when the first design runs, which is the precondition for video FPO
being useful at all. Part 1's §5.4 gating (no key → the feature is invisible) stays exactly as
written; this spec just makes the no-key case much rarer.

---

## 0. What exists today (verified 2026-09-11)

| Piece | Where | State |
|---|---|---|
| Stage machine | `showStage()` (`shell.js:969`) | Stages: `usage`, `key`, `project`, `workspace`. `gated = stage === "key" \|\| stage === "usage"` |
| Gate show/hide | `toggleGate()` (`shell.js:898`) | Unhide → double-rAF → `.show`; 480ms fade out. Already the right primitive |
| Gate markup | `shell.html:2308-2348` | `#usagegate`, `#keygate`, `#projectgate`, all `.gate > .gate-inner`, `data-copy` keyed |
| Key save | `saveKey()` (`shell.js:1129`) | On success: `queueTour()` → `boot()` → `flushPendingTour()` |
| Tour trigger | `queueTour` / `flushPendingTour` (`shell.js:1653`) | Fires 650ms after the stage following the key save paints; `TOUR_DONE_KEY` guards replay |
| **Reusable key row** | `licenseSection(body, opts)` (`shell.js:2812`) | **Host-agnostic**: takes any `body` element + `{label, desc, stepsHtml, getStatus, save, clear, extraRows}` |
| Claude key row | `claudeKeySection()` | Same shape, Claude-specific |
| Keys drawer | `renderLicenses()` (`shell.js:2688`) | Composes the above into folds: Claude, Unsplash, Pexels, then Figma + Design licences |
| Rail activation | `refreshRailActivation()` (`shell.js:1018`) | Icons colour on connect; Figma/Site icons hide entirely without their licence |

**The key finding:** `licenseSection` already renders into any container and owns validate,
save, clear, error, and reveal. The setup flow does **not** need new key UI. It needs a host
that calls the same function with the same options, plus sequencing and a skip affordance.
That drops this from "build a wizard" to "build a stepper around an existing renderer".

---

## 1. Flow

```
usage  ──▶  setup ─┬─ 1. Claude       (required, cannot skip)
                   ├─ 2. Photos & Video (all three at once, skippable)
                   ├─ 3. Figma        (skippable)
                   └─ 4. Research     (skippable)
                                │
                          [Done setting up!]
                                │
                            project  ──▶  Help walkthrough
```

Replaces the single `key` stage with a `setup` stage holding four **steps**. `usage` and
`project` are untouched.

**Order** (`SETUP_ORDER` in `shell.js`, declared apart from the step definitions so it is a
one-line change): the keys a designer supplies themselves come first, Claude and then the
photo/video libraries, and the two licences follow. That is the order the Keys drawer
already lists them in and the order the walkthrough tips walk, so someone meeting them in
setup and revisiting them later is told the same story twice. A test pins all three.

### 1.1 Step reveal

Each step is a card in a vertical stack in the big pane.

- **Unanswered steps below the current one are not rendered at all.** Not dimmed, not
  disabled: absent. The designer sees one live card and cannot be daunted by a queue of
  credentials.
- **On answer (connected or skipped), the card collapses upward into a compact done-row** and
  the next step fades in beneath it, using the same double-rAF + `.show` idiom as `toggleGate`.
- A done-row shows: step name, a state chip (**Connected** with the last-4 hint, or **Skipped**),
  and a text button to reopen it. Reopening expands that card back to full and pushes the
  others down; it never resets progress.
- The stack scrolls if it outgrows the pane, with the live card scrolled into view on reveal.

This is the "moves up" behaviour asked for, and it mirrors the intake's answered-group
treatment, so it will feel like the same app rather than a bolted-on wizard.

### 1.2 Step 1: Claude (required)

Identical content to today's `#keygate`: heading, intro, password field, Save & connect, the
platform.claude.com link, the keychain note. All existing `COPY.keygate.*` entries are reused
verbatim; no rewording.

**No skip.** Nothing in the app works without it, and the read-only no-key workspace already
exists for people who close the window instead. On success the card collapses to
`Claude · Connected · ····ab12` and step 2 appears.

The existing `saveKey()` keeps its job but **loses its tour trigger** (§4).

### 1.3 Step 2: Figma (skippable)

Renders `licenseSection` with the Figma licence's existing `getStatus` / `save` / `clear`,
plus the `stepsHtml` the drawer already shows. Copy explains what the licence unlocks (export
a design to Figma as editable layers) so the choice is informed rather than a blank field.

**Skip this step** is a ghost button beside the save. Skipping records nothing, it just
advances; the licence stays available in the padlock drawer forever.

### 1.4 Step 3: Research (skippable)

Same shape, the Design/Research licence (`getDesignLicenseStatus` / `saveDesignLicense` /
`clearDesignLicense`). Copy names what it unlocks: design research, the lens deck, and the
site builder (the CMS rail icon is gated on this licence today).

One honesty requirement: this licence gates the **CMS/Site** icon as well as research. The copy
must say so, because a designer who skips it and later wonders where the site builder went has
been mildly misled by a step called "Research".

### 1.5 Step 4: Images & Video (all three at once, skippable)

The one step that shows three fields together, because they are alternatives to each other
rather than a sequence, and because presenting them as three more sequential gates after two
skippable ones would read as nagging.

One card, a short shared intro, then three `licenseSection` calls stacked inside it:

| Library | Media | Note in the row |
|---|---|---|
| **Unsplash** | Images | Best-curated stills. Free key, 50 requests/hour. |
| **Pexels** | Images **and video** | Free key, 200/hour, shared across photos and footage. |
| **Pixabay** | Images **and video** | One key covers both. Largest library, less curated. |

Each row keeps its own connect/clear state and its own `stepsHtml` link to where the key comes
from. The shared intro states the sourcing order plainly, since it is the thing a designer
would otherwise have to guess:

> Images are searched Unsplash → Pexels → Pixabay, and video Pexels → Pixabay. Connect any or
> all; the build uses whichever is connected and still has requests left. Without a video-capable
> key, designs stay stills-only.

That last sentence is the part that makes part 1 land. It is the only place in the product
where a designer is told, before their first build, that video is a thing they can have.

**Skip this step** advances with none connected. Per part 1 §5.4, the video affordances then
gate themselves off silently.

### 1.6 Done

Beneath the stack, once every step is answered, a primary **Done setting up!** button fades in.
Clicking it:

1. Marks setup complete (§3).
2. Advances to the `project` stage.
3. Queues the Help walkthrough, which fires once the project gate has painted (§4).

Before every step is answered the button is absent, not disabled: the live card is the only
call to action, which keeps the screen single-purpose.

---

## 2. Markup + rendering

### 2.1 New gate

`shell.html` gains `#setupgate` beside the others, replacing `#keygate` in the stage machine:

```html
<div id="setupgate" class="gate" hidden>
  <div class="gate-inner gate-wide">
    <h2 data-copy="setupGate.heading"></h2>
    <p data-copy="setupGate.intro"></p>
    <div id="setup-stack"></div>
    <button id="setup-done" class="btn-primary" data-copy="setupGate.done" hidden></button>
  </div>
</div>
```

`#setup-stack` is rendered by JS, the way `#intake-stack` already is. `gate-wide` is the class
the usage gate already uses for a roomier inner column.

**`#keygate` stays in the markup.** It is still the right UI for the *reconnect* case: an
existing install whose key was cleared or rejected should get the single focused key screen,
not a four-step setup walkthrough it already completed. §3 covers which one shows when.

### 2.2 The stepper

A small module in `shell.js`, near the intake stack renderer it parallels:

```js
const SETUP_STEPS = [
  { id: "claude",   required: true,  render: renderSetupClaude },
  { id: "figma",    skippable: true, render: renderSetupFigma },
  { id: "research", skippable: true, render: renderSetupResearch },
  { id: "media",    skippable: true, render: renderSetupMedia },
];
```

Each `render(host)` delegates to `claudeKeySection` / `licenseSection` with the **same options
the drawer passes**, plus an `onConnected` callback so the stepper learns of a successful save.

`licenseSection` needs one addition: an optional `onConnected` hook invoked after a successful
save. It currently updates its own rows and returns. This is a two-line change and is the only
modification to existing key UI this spec requires.

State is in-memory only (`{ claude: "connected", figma: "skipped", … }`), rebuilt from live
status on mount. Nothing new is persisted per step; connected keys already persist themselves
in the keychain, and a skip is not worth remembering beyond the session.

### 2.3 Copy

New `COPY.setupGate` block: heading, intro, the four step titles and descriptions, the media
intro, `skip`, `done`, and the done-row chips (`connected`, `skipped`, `reopen`). Existing
`COPY.keygate.*` and `COPY.licenses.*` entries are reused wherever the same words apply, rather
than duplicated, so a wording change in the drawer does not silently diverge from setup.

---

## 3. When setup shows

This is the part most likely to annoy existing users if it is got wrong.

| Situation | Screen |
|---|---|
| Fresh install, no key | `usage` → **`setup`** |
| Existing install, key present, setup never completed | **No setup.** Straight to `project`/`workspace` |
| Existing install, key cleared or rejected | **`keygate`** (the focused reconnect screen) |
| Anyone, any time | The padlock drawer, unchanged |

An install that already has a working key has already been through the old flow; re-running a
four-step setup on it would be a regression dressed as an improvement. A `ta-setup-done`
localStorage flag is set both by finishing setup **and** retroactively on first launch of a
build where a key already exists, so upgraders never see it.

The distinction between `setup` and `keygate` is exactly the distinction between *first run*
and *reconnect*, which is why `#keygate` survives rather than being deleted.

---

## 4. Walkthrough handoff

Today the tour is queued inside `saveKey()`, so it fires the moment the Claude key is accepted.
That is wrong under this flow: it would interrupt at step 2.

- **Remove `queueTour()` from `saveKey()`.**
- **Call it from the Done button instead**, immediately before advancing to `project`.
  `flushPendingTour()` already waits for the next stage to paint and adds its 650ms settle, so
  the tour lands on the project gate exactly as it does today.
- `TOUR_DONE_KEY` still guards replay, so a designer who reconnects a key later does not get
  the walkthrough again.
- The reconnect path (`keygate`) does **not** queue the tour at all. Reconnecting is not
  first-run.

One consequence worth stating: the tour's `unsplashKey` step (`shell.js:1304`) points at the
drawer's Unsplash fold. With the media step now introducing all three libraries during setup,
that tour step is partly redundant. It should be **retargeted to the media group as a whole**
and reworded to "your photo and video libraries live here", so the walkthrough tells the
designer where to *return*, not what they just did. Its copy also carries the skipped-media
message (§4.1).

### 4.1 Telling a designer what skipping cost them

A designer who skips step 4 gets stills-only designs forever and has no obvious way to connect
the two facts. Two messages cover it, at two different moments, and **both are conditional on
no media key being connected** so a designer who connected one never sees either.

**In the walkthrough** (the retargeted library step, `COPY.tour.steps.unsplashKey`). The tour
runs right after Done, so this reads as "here's what you passed on, and where it lives":

> **Photo & video libraries, optional**
> You skipped these during setup. Add an Unsplash, Pexels or Pixabay key here any time and a
> build will search for photos that match the brief, download them, and record the credit.
> Pexels and Pixabay also carry video, so a hero can hold a moving background instead of a
> still. All three are free. Without one, designs use placeholders and stills only.

The step's copy picks by context the way `tourStepCopy()` already supports (`copy` may be a
function), so the **connected** variant stays close to today's wording and only the skipped
variant carries the nudge.

**In the first build's wrap-up**, once, app-wide. The walkthrough lands before a designer has
seen a single design, which is the wrong moment to feel the absence; the first build is the
right one, because the placeholders are on screen. `design.md` §4b already tells the model to
report placeholders in the closing summary, so this is one more sentence in a report it is
already writing:

> These are placeholders. Connecting a photo library under Keys & Licenses (Unsplash, Pexels
> or Pixabay, all free) would let me source real images, and with Pexels or Pixabay, video.

Guarded by a `ta-media-nudge-done` localStorage flag set when it fires, so it appears after the
**first** build only and never again, whether or not the designer acts on it. The app appends
it to the design prompt's state block on that one build rather than the skill carrying it
unconditionally, so the model is never told to say it when a key is present.

---

## 5. Rail behaviour during setup

`showStage` currently treats `gated` as "rail inert, chat collapsed". `setup` is gated the same
way, with one change: as each licence connects mid-setup, `refreshRailActivation()` runs, so
the Figma and Site icons **appear in the rail as they are unlocked**, behind the inert overlay.

That is a deliberate small reward: the rail visibly fills in as the designer works down the
stack, which makes the skippable steps feel like they do something rather than like a form.

---

## 6. Build order

**P1, the stepper shell.** `#setupgate`, the stage change, the step stack, reveal/collapse/
reopen, done-rows, the Done button. Step 1 wired to the existing Claude key path. Steps 2-4
stubbed. Ship-able and testable on its own.

**P2, steps 2-4.** The `onConnected` hook on `licenseSection`; Figma, Research, and the
three-row media card rendered through it.

**P3, gating + handoff.** The `ta-setup-done` flag, the setup-vs-keygate decision, moving
`queueTour()` to Done, retargeting the tour's library step, and both skipped-media messages
(§4.1): the context-picked tour copy and the one-time first-build wrap-up line behind
`ta-media-nudge-done`.

**P4, Pixabay.** The third media row, which depends on part 1's P4 (Pixabay IPC + validation)
existing. **Until then the media step shows Unsplash and Pexels only**, and the shared intro
omits Pixabay from the stated order.

Sequencing note: P1-P3 are independent of part 1 entirely, and could ship first. P4 is the
single join between the two specs.

---

## 7. Open questions

1. ~~**Research step naming.**~~ RESOLVED in the build: the step is titled "Design research &
   site building" and carries a second, quieter line naming the site builder explicitly, so
   skipping it can't silently remove the CMS icon on someone. Renaming alone would have left
   the drawer's own label saying something different; a step can now declare what else its
   key unlocks (`also`), which is the general fix.
2. **Does `licenseSection`'s fold chrome suit a card?** The drawer wraps each call in
   `licensesFold`. Setup wants the section without the fold. `licenseSection` takes a plain
   `body`, so this should just work, but P2 should confirm there is no fold-specific styling
   leaking in.

---

## 8. Deliberately out of scope

- **Changing any key's validation, storage, or IPC.** Setup is a new host for existing rows.
- **The usage gate.** Untouched, still first.
- **Vercel/publish connection.** It belongs to publishing, not first-run, and adding it would
  make setup five steps for something most designers do days later.
- **Re-running setup on demand.** The padlock drawer is the permanent home for every key; a
  "run setup again" affordance would duplicate it.
