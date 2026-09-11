# Video sourcing + FPO video spec

Status: **spec'd, not built** (2026-09-11). Part 1 of 2, part 2 is a separate document.

Designs are stills-only today. Nothing in the intake asks about video, no `<video>` element
exists anywhere in the scaffold, and `find-images.mjs` sources photos alone. This spec adds
demo/FPO video as a first-class material the design build can reach for, sourced from the
same designer-owned keys the photo path already uses.

The bet: a muted loop behind a hero, or a short clip in a content row, does more for "this
reads as a finished site" than any amount of still photography. It is also the thing a
designer hand-builds anyway, so the build should offer it rather than make them ask twice.

---

## 0. What exists today (verified 2026-09-11)

| Piece | Where | State |
|---|---|---|
| Photo sourcing | `scripts/find-images.mjs` (257 lines) | Unsplash + Pexels, paced, per-library hourly budget, `auto` picks first connected library with budget |
| Usage/credit store | `.thinkany/image-usage.json` (via `IMAGE_USAGE_FILE`), `public/images/credits.json` | Per-library `{limit, remaining, requests, hourStart, photos}`; credits keyed by file |
| Keys UI | Keys & Licenses drawer, `unsplash:*` / `pexels:*` IPC (`main.cjs:4478-4516`) | Validate-on-save, stored like licences, injected into `process.env` on boot (`main.cjs:5701`) |
| Agent awareness | `projectStateForAgent()` → `imageSources: []` (`main.cjs:581-584`) | Ordered list of connected libraries, rides project state |
| Hero picker | `HERO_LAYOUTS` (`shell.js:11866`) + `HERO_LAYOUT_PHRASES` (`main.cjs:3651`) | 5 ids: centered, split, full-screen, minimal, showcase |
| Brief schema | `desktop/intake/brief.cjs` | `heroLayout`, `ctaType` are the gated-picker precedent |
| Motion primitive | `src/app/components/Parallax.tsx` + `src/styles/motion.css` | CSS scroll-driven; moves in frames + site, still in capture + reduced motion |
| Video | — | **Nothing. No `<video>`, no video component, no video sourcing.** |

**Existing drift to fix in passing:** `design.md` §4b tells the model to check `IMAGES=`,
`UNSPLASH=on`, `PEXELS=on` "from the session-start call". Those env pairs are not what the
app sends; the real signal is `imageSources` in project state. The skill text should be
corrected to match when §4b is touched for video (§6 below).

---

## 1. Providers

Sourcing order, per the designer's call:

- **Images:** Unsplash → Pexels → Pixabay
- **Video:** Pexels → Pixabay

### Pixabay (new, both media)

One key covers both: `https://pixabay.com/api/` (images) and `https://pixabay.com/api/videos/`
(video). Key param is `?key=`, not a header. Notes that shape the adapter:

- **No `X-Ratelimit-*` headers in the same shape.** Pixabay sends `X-RateLimit-Limit`,
  `X-RateLimit-Remaining`, `X-RateLimit-Reset` (100/min by default). `api()` reads the
  lowercase names via `res.headers.get()`, which is case-insensitive, so the existing
  parse works, but the **window is per-minute, not per-hour**. The budget store's
  `hourStart` bucketing must special-case Pixabay to a minute bucket, or (simpler, and
  what this spec picks) treat `X-RateLimit-Reset` seconds as authoritative when present
  and fall back to the hour bucket when absent. See §2.3.
- **No hotlinking.** Pixabay's terms ask that their CDN not be hotlinked in production.
  We already download into `public/`, so this is satisfied, not a change.
- **Quality is the trade.** Larger, less curated than the other two. Correct as the third
  image fallback, and as the second video fallback: it catches what the better-curated
  libraries miss rather than leading.
- **Attribution not required** by licence, but we record a credit row anyway for
  consistency and so the designer can see provenance. `free: true`.
- **Video sizes** come back as `videos.{large,medium,small,tiny}` each with `url`, `width`,
  `height`, `size` (bytes). Pick by §3.2's ladder.

### Pexels video

`https://api.pexels.com/videos/search`, same `Authorization: <key>` header as photos, same
200/hr budget, **shared with the photo budget** (one key, one quota). The budget store
therefore keeps counting Pexels under a single `pexels` id across both media, which the
current schema already does correctly by accident.

`video_files[]` gives `{link, width, height, quality, file_type}`; `video_pictures[]` gives
poster frame candidates. `duration` is in seconds.

### Unsplash

Stills only. Unchanged. A designer with only an Unsplash key gets images and **no video**,
and every video affordance gates itself off rather than failing mid-build (§5.4).

---

## 2. `scripts/find-video.mjs`

A sibling to `find-images.mjs`, not an extension of it. Same CLI shape, same budget store,
same credit ledger, different media.

```bash
node scripts/find-video.mjs search "<query>" [--orientation landscape|portrait]
                                            [--min-duration 6] [--max-duration 30] [--per 8]
node scripts/find-video.mjs get <id> --out public/video/<name>.mp4 [--width 1920] [--poster]
node scripts/find-video.mjs status
```

### 2.1 Shared module

Extract from `find-images.mjs` into `scripts/lib/stock-budget.mjs` (the `scripts/lib/`
directory already exists):

- `api(id, label, url, headers)` — pacing, budget refusal, usage write
- `readUsage` / `writeUsage` / `budgetLeft` / `hourStart`
- `BudgetError`
- `recordCredit(root, file, credit)` — generalised to take a subdirectory so video credits
  can live in `public/video/credits.json` (§2.5)

`find-images.mjs` then imports these rather than defining them. This is a real refactor of
a working file, so it lands as its own commit with the photo path re-verified before video
is added on top.

### 2.2 Cascade: per-request, not per-project

**This is the behavioural change the designer called out, and it applies to both media.**

`pickSource()` today chooses one library and stays there. It becomes a *generator* of
candidates in preference order, and `search` walks it:

```
for (const src of sourcesInOrder(media, forced)) {
  if (!src.key()) continue;
  if (!budgetLeft(src.id)) continue;
  try {
    const results = await src.search(params);
    if (results.length) return { source: src.id, results };
    // zero results is a miss, not an error: fall through to the next library
  } catch (e) {
    if (e instanceof BudgetError) continue;   // spill, don't stop
    if (isTransient(e)) continue;             // 429/5xx: spill
    throw e;                                  // 401 on a forced source: report it
  }
}
// nothing anywhere → exit 5 (see §2.6), the caller falls back to placeholder/plain path
```

So "Unsplash returned nothing useful for *aerial coastline*" moves that **one query** to
Pexels, and a spent Unsplash hour moves the **rest of the build's queries** to Pexels
without a decision having been made once at project start.

`sourcesInOrder(media)`:
- `media === "image"` → `[unsplash, pexels, pixabay]`
- `media === "video"` → `[pexels, pixabay]`

`--source <name>` still forces exactly one and disables the cascade (so a designer can say
"try Pixabay for this one"). A `get` must name the source its `search` reported, as today.

### 2.3 Budget windows

`stock-budget.mjs` gains a per-source window declaration:

```js
{ id: "pixabay", window: "reset-header", fallbackWindowMs: 60_000 }
{ id: "unsplash", window: "hour" }
{ id: "pexels",   window: "hour" }
```

For `reset-header`, the usage record stores `resetAt = Date.now() + X-RateLimit-Reset*1000`
and `budgetLeft` compares against that instead of the hour bucket. When the header is
absent, fall back to a 60s bucket. The existing hour-bucket logic is untouched for the two
libraries that use it, which keeps the refactor's blast radius small.

Pixabay's own docs also ask that API responses be cached ~24h; the `photos`/`videos` cache
in the usage file already does this within a session and should not be shortened.

### 2.4 What `search` returns

Same envelope as images plus video-specific fields:

```json
{ "source": "pexels", "query": "…", "results": [
  { "id": "…", "description": "", "alt": "…", "width": 3840, "height": 2160,
    "orientation": "landscape", "duration": 12, "photographer": "…",
    "poster": "<url>", "thumb": "<url>",
    "sizes": [ { "quality": "hd", "width": 1920, "height": 1080, "bytes": 4200000 } ] }
] }
```

`duration` and `bytes` are the two fields the model does not have for photos and genuinely
needs: they drive the §3.2 weight ladder and the §3.1 loop-length judgement.

### 2.5 What `get` writes

1. **The clip** → `public/video/<name>.mp4` (H.264/AAC MP4, the one format that plays
   everywhere without a second encode). `--out` is validated to stay under `public/video/`,
   mirroring the `public/images/` guard.
2. **A poster still** → `public/video/<name>.poster.avif`, always, not optionally. The
   poster is load-bearing in four places (reduced motion, Figma capture, the `<video>`
   `poster` attribute, and the no-video fallback), so it is never skipped. Sourced from the
   provider's poster/preview URL and written through the existing `writeImage()` so it gets
   the same AVIF treatment as photos.
3. **A credit row** → `public/video/credits.json`, same shape as the image ledger
   (`file`, `source`, `url`, `free`, `author`, `authorUrl`, `description`), plus `poster`
   naming the still. `free: true` for all three libraries.

No transcoding, no ffmpeg dependency. We take the provider's MP4 at the chosen rung.

### 2.6 Exit codes

Aligned with `find-images.mjs` so the skill text can speak about both the same way:

| Code | Meaning | The build's response |
|---|---|---|
| 0 | OK | use it |
| 2 | usage error | fix the call |
| 3 | no video-capable key connected | no video this build, silently |
| 4 | every candidate library's budget is spent | poster/placeholder for this spot |
| 5 | searched every library, nothing matched | poster/placeholder for this spot |
| 1 | anything else | poster/placeholder, report in the wrap-up |

---

## 3. `<VideoBackground>` and `<VideoFigure>` (CORE components)

Two components, because the designer drew a real distinction: **full-screen sections with
content use video only as background; alternating content rows may contain video as the
media half.** That is a compositional rule, and the cleanest way to enforce it is to make
the two cases two different primitives rather than one component with a `variant` prop the
model can misuse.

Both live in `src/app/components/`, are CORE (framework-refreshed, KEEP-protected), and
follow `Parallax.tsx` as the model for "behaves correctly in frames, capture, and the
promoted site".

### 3.1 `<VideoBackground>`

```tsx
<VideoBackground
  src="/video/hero-loop.mp4"
  poster="/video/hero-loop.poster.avif"
  scrim="ink"            // "ink" | "none" | a custom overlay as children
  className="absolute inset-0"
/>
```

Non-negotiable behaviour, baked in so the model cannot author the tacky version:

- `muted autoPlay loop playsInline preload="metadata"` — always, not props. An unmuted or
  non-looping background video is never what this component is for.
- **No controls, not focusable, `aria-hidden`.** It is decoration; it must not land in the
  tab order or be announced.
- **`poster` is required**, and the poster renders as a CSS `background-image` on the
  wrapper too, so there is never a black flash before the first frame paints.
- **Scrim derives from `ta-ink`**, not a hardcoded colour. This closes the known nit where
  the model hardcodes image-scrim colours instead of using the token
  (`get-designing-bug-round`). Default: a `to-b` gradient from `ta-ink/60` to `ta-ink/30`,
  overridable via children for a designed treatment.
- **`prefers-reduced-motion: reduce` → the poster still, no video element mounted.**
  Handled in `motion.css` + a matchMedia guard, matching how `Parallax` already respects it.
- **`capture` mode → the poster still.** `DesignSurface` already threads a `capture` prop;
  `VideoBackground` reads the same signal and renders `<img src={poster}>` instead of
  `<video>`. This is exactly the trick the hero-slider spec uses for its single-slide
  render, and it is what keeps the Figma export from emitting an empty box.
- **Site-safe.** Promotes through `/promote-blocks` unchanged; the Astro site renders the
  same element and serves the same `public/video/` file.

### 3.2 `<VideoFigure>`

The in-flow sibling, for the media half of an alternating content row.

```tsx
<VideoFigure
  src="/video/process.mp4"
  poster="/video/process.poster.avif"
  className="aspect-[4/3] w-full rounded-xl"
  label="Our process"
/>
```

Differences from the background:

- **In flow**, takes an aspect ratio like an image would, obeys the anchored two-column
  rule (`design.md` rule 7) when it is the photo half of a pair.
- **Muted + loop by default, but `playsInline` with a click-to-play affordance is allowed**
  when the clip is content rather than texture. When it carries meaning, it gets a visible
  play control and is focusable; when it is texture, it stays `aria-hidden` like the
  background.
- `label` populates `aria-label` when focusable, and the FPO caption when the clip is
  missing.
- Same poster, reduced-motion, and capture rules.

### 3.3 Weight ladder

FPO video should not silently drop 40 MB into a project. `get` picks the smallest rung that
clears the spot's need:

| Spot | Target | Cap |
|---|---|---|
| `VideoBackground`, full-bleed | 1920×1080 | 8 MB |
| `VideoFigure`, content row | 1280×720 | 4 MB |

If no rung is under the cap, take the smallest available and **report the size in the
wrap-up** rather than refusing. The designer decides whether a heavy clip is acceptable;
the build's job is to not hide it.

### 3.4 Publish

`public/video/` ships with the site like `public/images/`. Two additions:

- The publish drawer's size summary counts video separately, so a 12 MB `public/video/` is
  visible before deploy rather than discovered after.
- A wrap-up line whenever video was used: which spots, total added weight.

---

## 4. Where video is allowed to appear

The designer's rule, stated as the build contract:

> **Full-screen sections with content → video only as background.**
> **Alternating content rows (copy/image) → the media half may be video.**

Concretely, in `design.md` §4b-video:

| Section shape | Video treatment |
|---|---|
| Full-screen hero with overlaid copy | `<VideoBackground>` + scrim + `relative z-10` copy |
| Full-bleed interstitial / CTA band | `<VideoBackground>` + scrim |
| Alternating copy/media row | `<VideoFigure>` in the media half |
| Showcase / product section | `<VideoFigure>`, in flow |
| Split hero | `<VideoFigure>` in the visual half |
| Card grids, testimonials, logo rows, footers | **No video.** Stills only. |

Beyond that, **the build may use video anywhere it judges worthy**, and the designer may
ask for it anywhere. The table constrains *how* video appears in a given shape, not *where*
the build is permitted to consider it.

Hard limits, so a design does not turn into a video reel:

- **At most one `VideoBackground` per page.** Two autoplaying full-bleed loops on one page
  is the failure mode this rule exists to prevent.
- **At most two video spots per page**, total, unless the designer asks for more.
- **Never video in the first paint of a page whose brief asks for speed/performance.**

---

## 5. Intake + brief

### 5.1 Hero picker: no new tile

Video is **not** a sixth `HERO_LAYOUTS` tile. That was my first instinct and it is wrong:
video is a *material*, orthogonal to layout. "Full Screen" + video and "Split" + video are
both valid, and a sixth tile would force a false choice between layout and medium.

Instead: **when `full-screen` is the picked hero layout and a video-capable key is
connected**, a nested sub-choice appears beneath the tile (the nested-reveal UX the
hero-slider spec already proposes):

> Hero background: **Image** · **Video**

Default **Image**. The value lands as `heroMedia: "image" | "video" | null` in the brief.

### 5.2 Brief field

`desktop/intake/brief.cjs` gains:

```js
/** @property {string|null} heroMedia  Hero background material ("image" | "video"). */
"heroMedia",
```

and `main.cjs` gains the phrase pair, following `HERO_LAYOUT_PHRASES` / `CTA_TYPE_BUILD`:

```js
const HERO_MEDIA_PHRASES = {
  video: "a full-screen hero with a muted background video loop behind the copy",
};
const HERO_MEDIA_BUILD = {
  video: "Build the hero background with <VideoBackground> from " +
    "@/app/components/VideoBackground (never a bare <video>): source the clip with " +
    "scripts/find-video.mjs, always take the poster still it writes, and keep the copy " +
    "in a `relative z-10` sibling above the scrim. If no video-capable library is " +
    "connected or nothing matches, build the same hero with a still image instead and " +
    "say so in the wrap-up.",
};
```

Same split the CTA picker already uses: `PHRASES` goes in the designer-facing brief body
(no library names, no file paths, no mechanics), `BUILD` is appended after it for the model.
This matters because the brief body is saved verbatim as the variation's brief and shown on
the dashboard card.

### 5.3 Weighting a mentioned brief

**The designer's requirement: if the user mentions video in their brief, they expect to see
it.** A free-text mention must outrank the build's own judgement.

In `buildDesignPrompt()`, after the brief body is assembled, scan the designer's own words
(`b.what`, reference reasons, the intake's free-text answers) for video intent:

```
/\b(video|footage|clip|reel|motion|b-roll|showreel|film(ed|ing)?|cinemagraph|loop(ing)?)\b/i
```

On a hit, and when a video-capable key is connected, append an **emphatic** build block,
distinct in force from the `heroMedia` instruction:

> **The designer asked for video.** They will be looking for it in this first design. Source
> real footage with `scripts/find-video.mjs` and place at least one video spot, the hero
> background if the hero is full-screen, otherwise the media half of the most prominent
> content row. Do not substitute a still image unless sourcing genuinely fails, and if it
> does, say so plainly in the wrap-up.

On a hit with **no** video-capable key, append instead:

> The designer asked for video, but no video library is connected. Build the spots they'd
> expect as stills, and in the wrap-up tell them that adding a Pexels or Pixabay key under
> Keys & Licenses would let you source real footage.

This second branch is the one that keeps the feature honest: the designer gets told why
their expectation was not met, rather than quietly receiving a stills design.

### 5.4 Gating

Every video affordance is gated on `videoSources.length > 0`, where `videoSources` is the
video-capable subset of connected libraries. `projectStateForAgent()` gains it alongside
`imageSources`:

```js
const videoSources = [];
if (pexelsKey) videoSources.push("pexels");
if (pixabayKey) videoSources.push("pixabay");
```

No key → no sub-choice in the intake, no video instruction in the prompt, no mention in the
skill's build path. The feature is invisible rather than broken.

### 5.5 Keys UI

Pixabay joins Keys & Licenses as a third optional library, identical in shape to the Pexels
row (`pixabay:status` / `pixabay:save` / `pixabay:clear`, validate-on-save, last-4 hint,
unplug to clear). Its row notes that the key covers **images and video**, which is the
reason a designer would add it over Pexels alone.

The usage table gains video request counts per library, sharing the Pexels row since the
quota is shared.

---

## 6. Skill changes

`desktop/skills/design.md`:

- **§4b**, correct the stale env references (`IMAGES=`, `UNSPLASH=on`, `PEXELS=on`) to the
  real `imageSources` project-state signal, and add Pixabay to the cascade description and
  to the `free: true` source list (it is already named there).
- **New §4b-video**, the video sourcing flow, the §4 placement table, the two components,
  the weight ladder, and the "poster always" rule. Kept adjacent to §4b so the model reads
  images and video as one material decision.
- **§4e (motion contract)**, add video: `VideoBackground` and `VideoFigure` carry to the
  published site; both hold still in capture and under reduced motion.
- **Rule 7 (anchored two-column)**, note that `VideoFigure` obeys it exactly as an image does.

`desktop/skills/promote-blocks.md`: video spots promote as a `video` + `poster` prop pair on
the block schema, so the CMS can swap a clip the way it swaps an image.

`desktop/skills/design-block.md`: a block may declare a video field; same schema pair.

---

## 7. Build order

Each phase is independently shippable and independently verifiable.

**P1, sourcing spine.** Extract `scripts/lib/stock-budget.mjs`; add Pixabay to
`find-images.mjs`; make the cascade per-request; re-verify the photo path end to end. No
video yet. *This phase stands on its own: it makes image sourcing better regardless of
whether video ever ships.*

**P2, `find-video.mjs`.** Pexels + Pixabay video search/get, poster always, credits ledger,
weight ladder, exit codes.

**P3, components.** `VideoBackground` + `VideoFigure`, `motion.css` rules, capture-mode
poster swap, reduced-motion path. Verified in all three device frames, in a Figma export,
and on a promoted site.

**P4, intake + brief.** `heroMedia` sub-choice, phrase pairs, the §5.3 brief-mention
weighting, `videoSources` gating, Pixabay in Keys & Licenses.

**P5, skills + promote.** `design.md` §4b-video and the §4b corrections, motion contract,
promote-blocks/design-block schema pair, publish weight summary.

---

## 8. Open questions

1. **Does `capture` reach arbitrary components?** `Home.tsx` threads a `capture` prop, but
   `VideoBackground` may sit several levels down inside an authored section. Either the
   prop threads further (invasive) or the component reads the `?capture=` search param
   directly (simpler, and what P3 should try first). **Verify in P3 before building the
   poster swap.**
2. **Astro/site parity for reduced motion.** `motion.css` is shared, but the site build
   does not mount React the same way. Confirm the reduced-motion poster fallback works in
   the promoted Astro site, not just the design surface.
3. **Pixabay rate-window behaviour under real load.** The 100/min limit and the
   `X-RateLimit-Reset` header shape are from the docs, not observed. P1 should log actual
   headers on the first live calls and adjust §2.3 if they differ.
4. **Video in the WordPress import path.** An imported site may already have hero video.
   Out of scope here, but the `video`/`poster` prop pair chosen in P5 should be the same
   shape the importer would target.

---

## 9. Deliberately out of scope

- **Transcoding.** No ffmpeg. We take the provider's MP4.
- **WebM/AV1 alternates.** One format, everywhere. Revisit only if weight becomes a real
  complaint.
- **Designer video upload.** The media picker and phone-upload path could carry video
  later; this spec is about *sourced* FPO footage.
- **Video in the CMS beyond a swappable clip.** No playlists, no galleries, no chapters.
- **Audio.** Every clip this feature places is muted. A design that needs sound is a
  designer's deliberate hand-build, not FPO.
