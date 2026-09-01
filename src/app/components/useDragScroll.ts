// ©2026 thinkany llc. All rights reserved.
import { useRef, type PointerEvent } from "react";

/**
 * Mouse "touch-scroll" for the device-frame previews: drag the screen to pan it, like a
 * finger on a touchscreen, IN ADDITION to the normal mouse wheel (which still scrolls).
 *
 * It engages only for a MOUSE drag past a small threshold, so a plain click still reaches
 * the buttons/links underneath, and real touch / trackpad keep their own native scrolling
 * (we bail on non-mouse pointers). Pair it with the `.ta-touch-surface` class (globals.css)
 * that swaps the arrow for the Figma-style circle "touch" cursor.
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const st = useRef({ startY: 0, startTop: 0, id: -1, active: false, armed: false });

  const onPointerDown = (e: PointerEvent<T>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return; // touch/pen use native scroll
    const el = ref.current;
    if (!el) return;
    if (getComputedStyle(el).overflowY === "hidden") return; // scroll frozen (e.g. drawer open)
    st.current = { startY: e.clientY, startTop: el.scrollTop, id: e.pointerId, active: false, armed: true };
  };

  const onPointerMove = (e: PointerEvent<T>) => {
    const s = st.current;
    const el = ref.current;
    if (!s.armed || !el) return;
    const dy = e.clientY - s.startY;
    if (!s.active) {
      if (Math.abs(dy) < 5) return; // below threshold → let a click through to the target
      s.active = true;
      el.setPointerCapture?.(s.id);
      el.style.userSelect = "none";
    }
    el.scrollTop = s.startTop - dy;
  };

  const end = () => {
    const s = st.current;
    const el = ref.current;
    if (s.active && el) {
      try { el.releasePointerCapture?.(s.id); } catch { /* already released */ }
      el.style.userSelect = "";
    }
    st.current = { startY: 0, startTop: 0, id: -1, active: false, armed: false };
  };

  return {
    ref,
    handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end },
  };
}
