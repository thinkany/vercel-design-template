# Close-and-travel: answering a card without a snap

The movement the first-run key steps use when a step is answered, and the one the Get
Designing intake should use when a question is. Built and tuned on the setup stepper
(2026-09-11); `closeAndTravel()` in `desktop/shell.js` is the shared implementation.

## The movement

An open card is answered. Rather than vanishing and being replaced by a summary row in
the same frame, it:

1. **Closes around its own midline.** The centre stays where it is while the height goes,
   so it shuts like a door closing from both edges rather than the bottom riding up to a
   fixed top. 260ms.
2. **Floats up into its resting slot**, decelerating the whole way. A train pulling into
   a station, not a cut. 620ms.

Nothing else on screen moves during either beat. The next card arrives afterwards.

## Why it is fiddly

The animation itself is four keyframes. Every bug in this was an **ordering** problem
between the animation and the layout around it, and each one was visible:

| Rule | What happens if you get it wrong |
|---|---|
| **1. Leave the flow BEFORE closing** | The flow spends the whole close pulling the rows up to meet the shrinking card. By the time it travels, the space above has already closed, so it "rejoins" a list that moved under it instead of floating through anything. |
| **2. Measure the destination AFTER that reflow** | It targets where the slot used to be, and arrives a row's height out. |
| **3. Hold the container's height for the trip; never animate it down mid-move** | In a flex column a shrinking container drags its rows toward the top, so the finished rows *above* appear to slide down to meet the closing card and then ride up with it. The exact collective shuffle the whole thing exists to avoid. |
| **4. Rebuild BEFORE releasing the held height** | One frame where the travelling card is still `absolute` and the container has no in-flow children at all: it collapses to nothing and everything above reflows. Shows as a flash, and **only on the first card**, because every later one still has finished rows holding the container open. |
| **5. Keep expensive side effects out of the movement** | `refreshRailActivation()` resolves four IPC round-trips then toggles icon visibility. Called from the key row's save handler, it landed mid-flight and flashed beside the card. Run it after the landing. |

Rule 4's "only the first card" symptom is worth remembering: **a glitch that appears on
exactly one item in a list is usually about what is or isn't left holding the container
open**, not about that item.

## The geometry

Closing on the midline moves the top edge down by half the height lost, so the travel has
to undo that as well as cover the distance:

```
midlineOffset = (openHeight - rowHeight) / 2     // top edge drops by this during the close
lift          = restTop - (startTop + midlineOffset)
finalTransform = midlineOffset + lift            // lands exactly on restTop
```

Worth checking with real numbers when adapting it. A 260px card becoming a 44px row at
`startTop: 300`, resting at `120`: `midlineOffset` 108, the midline holds at 430
throughout the close, `lift` is -288, and the final top is 300 + 108 - 288 = 120. Correct.

## Using it

```js
const moved = await closeAndTravel({
  card,                  // the open element, a child of `container`
  container,             // its flow parent; needs `position: relative`
  restTop: () => …,      // px from the container's top; a function is called AFTER the
                         // card leaves the flow, which is what rule 2 wants
  toHeight, toPadding, toBorderColor,   // the row's geometry: MEASURE it (see below)
  becomeRow: (el) => …,  // swap the card's contents for the summary, between the beats
  rebuild: () => …,      // redraw the real list with the row in place, once it lands
});
if (!moved) await rebuild();   // reduced motion, or no Web Animations
```

`closeAndTravel` returns `false` without touching anything when it should not run, so
**every caller needs a plain fallback**. Reduced motion takes that path.

### Measure, never guess

Both ends come from real laid-out elements, so a padding change in the stylesheet can't
leave the animation landing half a pixel out:

- **The row's geometry**: build it in a hidden clone of the container
  (`position:absolute; visibility:hidden; left:-9999px`, with the container's width),
  read `getBoundingClientRect()` and `getComputedStyle()`, remove the clone.
  `measureDoneRow()` is the example.
- **The resting slot**: walk the items already settled *above* this one, summing their
  real heights plus the container's own `gap`. `setupRestingTop()` is the example.

## Applying it to Get Designing

The intake collapses instantly today (`collapse()` in the intake card sets
`display: none` and paints the answer). It is a good fit for this movement, with two
differences to plan for:

1. **Intake groups can hold several cards.** The setup stepper answers one card at a
   time. A group answering as a unit either travels as one element, or each card travels
   in sequence with a small stagger. Travelling as one is closer to what this does.
2. **The intake stack scrolls**, and centres the live group (`intakeCenterTarget`). The
   setup stack does not scroll. A card that travels while the container is also scrolling
   will need the scroll settled first, or the two movements will fight.

The five rules hold regardless, and `closeAndTravel` already encodes them.

## Tests

`desktop/dev/setup-stepper.test.cjs` pins all five rules against the helper's source, so
a future edit that reintroduces one fails rather than merely looking wrong. Keep those
assertions pointed at `closeAndTravel` when it gains callers.
