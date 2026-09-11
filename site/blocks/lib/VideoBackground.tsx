// ©2026 thinkany llc. All rights reserved.
// Background video for site blocks (KEEP tier). The same markup as the design surface's
// src/app/components/VideoBackground.tsx: a wrapper holding BOTH the poster still and
// the clip, with src/styles/motion.css (imported through site.css) deciding which shows.
// No effect, no hydration: blocks stay static HTML with no React runtime, and the clip
// is dropped for prefers-reduced-motion and in the Figma capture.
import type { CSSProperties, ReactNode } from "react";

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
