// ©2026 thinkany llc. All rights reserved.
// Scroll reveal for site blocks (a template primitive: CORE, refreshed on open,
// see upgrade.manifest.json). The design surface animates with motion's
// whileInView; the site marks the element instead, and site.css + Base.astro
// animate it with CSS and one IntersectionObserver, so blocks stay static HTML
// with no React runtime. Stagger with `delay` (seconds).
//
// Two ways in, one mechanism. Both emit the same data-reveal + --reveal-delay
// that site.css and the Base.astro observer read:
//
//   <Reveal delay={0.1}>…</Reveal>        wrap, when an extra div is harmless
//   <h2 className={H2} {...reveal(0.1)}>  spread, when it is not
import type { CSSProperties, ReactNode } from "react";

/**
 * The reveal as PROPS to spread onto an element you already have.
 *
 * Prefer this inside a grid or a flex row. <Reveal> wraps its children in a div,
 * and that div becomes the grid item, so the element you meant to place stops
 * being one and the layout shifts. Spreading marks the real element instead.
 */
export function reveal(delay = 0): { "data-reveal": true; style?: CSSProperties } {
  return delay
    ? { "data-reveal": true, style: { "--reveal-delay": `${delay}s` } as CSSProperties }
    : { "data-reveal": true };
}

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const style = delay ? ({ "--reveal-delay": `${delay}s` } as CSSProperties) : undefined;
  return (
    <div data-reveal style={style} className={className}>
      {children}
    </div>
  );
}
