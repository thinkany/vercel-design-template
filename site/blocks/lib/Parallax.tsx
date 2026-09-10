// ©2026 thinkany llc. All rights reserved.
// Parallax for site blocks (KEEP tier). The same markup as the design surface's
// src/app/components/Parallax.tsx: a masked wrapper + a `.ta-parallax-layer` child,
// animated by src/styles/motion.css (a CSS scroll-driven animation the site
// imports through site.css), so blocks stay static HTML with no React runtime.
// Stills for prefers-reduced-motion; where the browser lacks the CSS (Firefox) the
// layout's parallax-fallback script drives the layer from scroll events.
import type { CSSProperties, ReactNode } from "react";

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
