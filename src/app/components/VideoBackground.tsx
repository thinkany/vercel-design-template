// ©2026 thinkany llc. All rights reserved.
import type { CSSProperties, ReactNode } from "react";

/**
 * VideoBackground: a muted, looping clip behind a full-bleed section's copy. The
 * background half of the video contract (the in-flow half is <VideoFigure>): a section
 * that carries copy uses video as a BACKGROUND, never as content beside it.
 *
 * It is decoration, so it is always muted, always looping, never focusable and never
 * announced. Those are not props: an unmuted or controlled background video is not what
 * this component is for, and a designer who wants one should build a <VideoFigure>.
 *
 * Like <Reveal> and <Parallax>, the decision of whether to PLAY is made in CSS
 * (src/styles/motion.css), never in JavaScript: the markup always carries both the
 * poster and the clip, and the stylesheet hides the clip for reduced motion and in the
 * Figma capture. That is what lets the same component render as static HTML in a
 * promoted site block, where no React runtime exists to run an effect.
 *
 *   <section className="relative fill-screen …">
 *     <VideoBackground src="/video/hero.mp4" poster="/video/hero.poster.avif" />
 *     <div className="relative z-10 …">…copy…</div>
 *   </section>
 *
 * The default scrim derives from `ta-ink`, so it sits with the palette instead of a
 * hardcoded black. Pass `scrim="none"` and your own sibling overlay for a designed
 * treatment; put copy in a `relative z-10` sibling AFTER this, never inside it.
 */
export type VideoScrim = "ink" | "soft" | "none";

const SCRIMS: Record<Exclude<VideoScrim, "none">, string> = {
  // Written out in full: Tailwind can't see a class name built from a template.
  ink: "bg-gradient-to-t from-ta-ink/70 via-ta-ink/40 to-ta-ink/20",
  soft: "bg-gradient-to-t from-ta-ink/45 via-ta-ink/20 to-transparent",
};

export function VideoBackground({
  src,
  poster,
  scrim = "ink",
  className = "absolute inset-0",
  style,
  children,
}: {
  /** The clip, under public/video (e.g. "/video/hero.mp4"). */
  src: string;
  /** The poster still beside it (e.g. "/video/hero.poster.avif"). Required: it is what
   *  reduced motion, the Figma capture and the pre-play moment all show. */
  poster: string;
  /** Overlay between the clip and the copy. "none" when you supply your own sibling. */
  scrim?: VideoScrim;
  className?: string;
  style?: CSSProperties;
  /** A custom scrim/overlay, rendered above the clip. */
  children?: ReactNode;
}) {
  return (
    <div data-video-bg className={`overflow-clip ${className}`} style={style}>
      {/* The poster sits under the clip, so there is no black flash before the first
          frame paints and nothing missing if the clip 404s. It is also the whole
          picture wherever motion.css hides the video. */}
      <img
        src={poster}
        alt=""
        aria-hidden="true"
        className="ta-video-still absolute inset-0 h-full w-full object-cover"
      />
      <video
        className="ta-video-clip absolute inset-0 h-full w-full object-cover"
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        // Decoration: out of the tab order, and not announced.
        tabIndex={-1}
        aria-hidden="true"
      />
      {scrim !== "none" && <div className={`absolute inset-0 ${SCRIMS[scrim]}`} aria-hidden="true" />}
      {children}
    </div>
  );
}
