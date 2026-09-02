// ©2026 thinkany llc. All rights reserved.
// Scroll reveal for site blocks (KEEP tier). The design surface animates with
// motion's whileInView; the site marks the element instead, and site.css +
// Base.astro animate it with CSS and one IntersectionObserver, so blocks stay
// static HTML with no React runtime. Stagger with `delay` (seconds).
import type { CSSProperties, ReactNode } from "react";

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const style = delay ? ({ "--reveal-delay": `${delay}s` } as CSSProperties) : undefined;
  return (
    <div data-reveal style={style} className={className}>
      {children}
    </div>
  );
}
