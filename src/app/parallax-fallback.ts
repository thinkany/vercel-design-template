// ©2026 thinkany llc. All rights reserved.
/**
 * Parallax fallback (CORE). <Parallax> is driven by a CSS scroll-driven animation in
 * src/styles/motion.css, which Firefox does not implement yet. This module runs ONLY
 * when the browser lacks it: it drives the same layer from scroll events instead, so
 * the design surface and the published site behave the same everywhere. In a browser
 * with the CSS it returns at once and adds nothing. Loaded by the design surface
 * (main.tsx) and the site layout (Base.astro); no dependencies.
 *
 * The maths mirror the CSS: progress p runs 0 → 1 as the wrapper travels from below the
 * scrollport to above it (the "cover" range of a view timeline), and the layer sits at
 * translateY((2p - 1) × travel) where travel is the wrapper's --ta-parallax-travel (a
 * percentage of the layer's own height, as the keyframes use it).
 */
const SUPPORTED = typeof CSS !== "undefined" && CSS.supports && CSS.supports("animation-timeline: view()");
const REDUCED = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The nearest ancestor that scrolls (the phone/tablet screen in the app), else the viewport. */
function scrollerOf(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === "auto" || o === "scroll") return p;
  }
  return null;
}

function travelOf(wrapper: HTMLElement): number {
  const raw = getComputedStyle(wrapper).getPropertyValue("--ta-parallax-travel").trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n / 100 : 0.12;
}

function update() {
  const wrappers = document.querySelectorAll<HTMLElement>("[data-parallax]");
  wrappers.forEach((wrapper) => {
    const layer = wrapper.querySelector<HTMLElement>(":scope > .ta-parallax-layer");
    if (!layer || wrapper.closest("[data-capture-ready]")) return;
    const scroller = scrollerOf(wrapper);
    const port = scroller ? scroller.getBoundingClientRect() : { top: 0, height: window.innerHeight };
    const r = wrapper.getBoundingClientRect();
    // 0 when the wrapper's top edge meets the scrollport's bottom, 1 when its bottom edge leaves the top.
    const p = Math.min(1, Math.max(0, (port.top + port.height - r.top) / (port.height + r.height)));
    const y = (2 * p - 1) * travelOf(wrapper) * layer.getBoundingClientRect().height;
    layer.style.transform = `translateY(${y.toFixed(1)}px)`;
  });
}

let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; update(); });
}

if (!SUPPORTED && !REDUCED && typeof document !== "undefined") {
  // Marks the fallback as active: motion.css stops any (absent) CSS animation from competing.
  document.documentElement.classList.add("ta-parallax-js");
  // Capture phase catches scroll inside nested containers (the device frames) as well as the window.
  document.addEventListener("scroll", schedule, { capture: true, passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("load", schedule);
  // React mounts after this module runs and pages re-render; a cheap poll of the frame
  // keeps newly mounted wrappers in step without wiring every render site.
  const mo = typeof MutationObserver === "function" ? new MutationObserver(schedule) : null;
  if (mo) mo.observe(document.documentElement, { childList: true, subtree: true });
  schedule();
}

export {};
