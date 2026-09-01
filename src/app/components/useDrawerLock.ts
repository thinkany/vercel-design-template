// ©2026 thinkany llc. All rights reserved.
import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/** Nearest scrollable ancestor — the device-frame screen in preview, the page otherwise. */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let n = el?.parentElement ?? null;
  while (n) {
    const oy = getComputedStyle(n).overflowY;
    if (oy === "auto" || oy === "scroll") return n;
    n = n.parentElement;
  }
  return null;
}

/**
 * Pins a full-height in-frame drawer to the VISIBLE area of its scroll container and locks
 * background scroll while it's open.
 *
 * Why: the drawer is an in-frame overlay (`absolute`, not a portal — see MobileMenu), so it
 * anchors to the tall design surface, not the device screen. Without this it spans the whole
 * scrollable page and scrolls away with it (the sticky hamburger lets you open it anywhere).
 * We measure the scroll container's current viewport (scrollTop + clientHeight) so the drawer
 * covers exactly what's on screen, and freeze the container's scroll so it stays put; the
 * drawer's own list then scrolls internally only when the items overflow that height.
 *
 * Returns a ref to put on the drawer root, and the measured box (null while closed → the
 * caller falls back to its normal full-height styling for the off-screen slide).
 */
export function useDrawerLock<T extends HTMLElement>(
  open: boolean,
): { ref: RefObject<T | null>; box: { top: number; height: number } | null } {
  const ref = useRef<T | null>(null);
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setBox(null);
      return;
    }
    const sc = scrollParent(ref.current);
    const measure = () => setBox(sc ? { top: sc.scrollTop, height: sc.clientHeight } : { top: 0, height: 0 });
    measure();
    let prevOverflowY = "";
    if (sc) {
      prevOverflowY = sc.style.overflowY;
      sc.style.overflowY = "hidden"; // freeze background scroll while open
    }
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      if (sc) sc.style.overflowY = prevOverflowY;
    };
  }, [open]);

  return { ref, box };
}
