// ©2026 thinkany llc. All rights reserved.
import type { CSSProperties, ReactNode } from "react";

/**
 * Parallax: a masked layer (a photo, usually) that drifts slower than the page as it
 * scrolls through the viewport. Pure CSS (src/styles/motion.css, a scroll-driven
 * animation on a view timeline), so it runs inside the phone/tablet frames, on the
 * desktop page and on the published site, stays still in the Figma capture and for
 * reduced motion, and needs no JavaScript.
 *
 * The wrapper is the mask: give it the box (`absolute inset-0` behind a section's
 * copy, or an in-flow `aspect-[4/3] rounded-lg` figure). The child fills it
 * (an <img> is sized to cover automatically). Put the scrim and the copy as
 * siblings AFTER it (`relative z-10`), not inside it.
 *
 *   <section className="relative fill-screen …">
 *     <Parallax className="absolute inset-0" strength="medium">
 *       <img src="/images/hero.jpg" alt="" />
 *     </Parallax>
 *     <div className="absolute inset-0 bg-gradient-to-t from-ta-ink/70" />
 *     <div className="relative z-10 …">…copy…</div>
 *   </section>
 *
 * Never put `overflow-hidden` between this and its section (hidden makes a scroll
 * container and freezes the effect; the wrapper already clips). Don't reach for
 * `background-attachment: fixed` or a window scroll listener instead: neither works
 * inside the device frames.
 */
export type ParallaxStrength = "soft" | "medium" | "strong";

export function Parallax({
  children,
  strength = "medium",
  className,
  style,
}: {
  children: ReactNode;
  /** How far the layer drifts: soft 6%, medium 12%, strong 20% of its height. */
  strength?: ParallaxStrength;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div data-parallax={strength} className={className} style={style}>
      <div className="ta-parallax-layer">{children}</div>
    </div>
  );
}
