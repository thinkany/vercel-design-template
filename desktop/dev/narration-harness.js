// DEV-ONLY narration pacing harness — NOT shipped.
//
// Kept in git for future reference: if the quiet-build spine's pacing (dwell, walk, message
// rotation, finish flourish) needs re-tuning, this replays it with SIMULATED signals so you can
// eyeball it WITHOUT running a real build (no agent, no tokens). It is excluded from the
// packaged app (package.json build.files: "!desktop/dev/**") and only injected by shell.js when
// the app runs unpackaged (preload's `dev` flag ← main's --ta-dev additionalArgument).
//
// Triggers (after `npm run desktop`, then reload if needed):
//   taNarrationDemo()             → true-to-life timing (~38s): long understanding, a burst
//                                   through foundations→hero, a long "sections", then the finish
//   taNarrationDemo({ fast:true })→ same SHAPE, ~5x quicker (scales the spine's own timing too,
//                                   so it stays faithful — no artificial "race to the finish")
//   taNarrationDemo.stop()        → abort
//   Ctrl+Shift+N                  → fast run (Ctrl+Shift+Alt+N = real-time); press again to stop
//
// To re-tune, edit the pacing constants at the top of buildNarration in shell.js
// (MIN_DWELL_MS / ROTATE_MS / TICK_MS / FINISH_*), reload the renderer (Cmd+R), and re-run.

(function () {
  const api = window.__taNarration;
  if (!api) return; // shell.js only exposes this in dev
  const { buildNarration, computePhaseList, briefBits, showPreparing } = api;

  async function runNarrationDemo(opts = {}) {
    // A representative Brief so the copy interpolates real-looking tokens.
    const brief = {
      projectType: "website",
      sections: ["hero", "features", "hours", "contact"],
      heroLayout: "split",
      ctaType: "cta-form",
      colorSources: [{ value: "warm cream" }, { value: "ink" }],
      fontSources: [{ value: "Fraunces" }, { value: "Work Sans" }],
    };
    const phases = computePhaseList(brief, { research: opts.research !== false });
    const k = opts.fast ? 0.2 : 1; // {fast} compresses wall-clock, same shape
    showPreparing();
    // scale:k compresses the spine's OWN timing (dwell/rotation/finish) by the same factor as
    // the simulated signal gaps below, so fast mode is a faithful preview, not a race.
    buildNarration.begin(phases, briefBits(brief), { haiku: false, scale: k });
    const S = (ms) => new Promise((r) => setTimeout(r, ms));
    // [phase id, ms to wait BEFORE advancing to it] — mimics a real build's uneven cadence:
    // a long initial wait on "understanding", a burst through the foundation/page phases, a
    // long "sections", then a quick tail into the reveal.
    const seq = [
      ["research", 7000], ["foundations", 5000], ["header", 1000], ["hero", 1400],
      ["sections", 15000], ["contact", 5000], ["polish", 1500],
    ];
    for (const [id, gap] of seq) {
      if (!buildNarration.isActive()) return; // aborted via .stop()
      await S(gap * k);
      buildNarration.advanceTo(id);
    }
    await S(2000 * k);
    if (buildNarration.isActive()) await buildNarration.finish();
    console.log("%c[narration demo] complete — reload (Cmd+R) to restore the workspace", "color:#0a7");
  }

  window.taNarrationDemo = runNarrationDemo;
  window.taNarrationDemo.stop = () => buildNarration.end();
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === "N" || e.key === "n")) {
      e.preventDefault();
      if (buildNarration.isActive()) buildNarration.end();  // press again to stop
      else runNarrationDemo({ fast: !e.altKey });           // add Alt for real-time pacing
    }
  });
  console.log("%c[dev] narration harness → taNarrationDemo()  ·  or press Ctrl+Shift+N (add Alt for real-time)", "color:#0a7;font-weight:600");
})();
