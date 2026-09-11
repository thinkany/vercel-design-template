// ©2026 thinkany llc. All rights reserved.
import type { CSSProperties } from "react";

/**
 * VideoFigure: a clip sitting IN the flow, where an image would go. The in-flow half of
 * the video contract (the background half is <VideoBackground>): an alternating
 * copy/media row may hold a clip in its media half, and it behaves like the photo it
 * replaces, taking its box from `className` and obeying the anchored two-column rule.
 *
 *   <VideoFigure src="/video/process.mp4" poster="/video/process.poster.avif"
 *                className="aspect-[4/3] w-full rounded-xl" label="Our process" />
 *
 * Two kinds of clip live here, and the difference is whether it MEANS anything:
 *
 *  - texture (the default): muted, looping, decorative, out of the tab order, exactly
 *    like a photograph that happens to move;
 *  - content (`controls`): it says something, so it gets a visible play control, is
 *    focusable and keyboard-operable, and is announced by `label`.
 *
 * As with the background, whether the clip PLAYS is decided in CSS (motion.css), not in
 * JavaScript: both the poster and the clip are always in the markup, so this renders
 * correctly as static HTML in a promoted site block, where no effect would ever run.
 */
export function VideoFigure({
  src,
  poster,
  label,
  controls = false,
  className = "",
  style,
}: {
  /** The clip, under public/video (e.g. "/video/process.mp4"). */
  src: string;
  /** The poster still beside it. Required: reduced motion and the Figma capture show it. */
  poster: string;
  /** What the clip shows. Announced when it is content; the still's alt text. */
  label?: string;
  /** The clip carries meaning: give it controls, focus and a name. */
  controls?: boolean;
  /** The box: aspect ratio, width, rounding, e.g. "aspect-[4/3] w-full rounded-xl". */
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div data-video-figure className={`relative overflow-clip ${className}`} style={style}>
      {/* The still: what reduced motion and the Figma capture show, and what remains if
          the clip cannot load. Named when the clip is content, decorative when texture. */}
      <img
        src={poster}
        alt={controls && label ? label : ""}
        className="ta-video-still absolute inset-0 h-full w-full object-cover"
        aria-hidden={controls ? undefined : "true"}
      />
      <video
        className="ta-video-clip absolute inset-0 h-full w-full object-cover"
        src={src}
        poster={poster}
        autoPlay={!controls}
        muted
        loop
        playsInline
        preload="metadata"
        controls={controls}
        // Texture is decoration: out of the tab order and unannounced. Content is not.
        tabIndex={controls ? undefined : -1}
        aria-hidden={controls ? undefined : "true"}
        aria-label={controls ? label : undefined}
      />
    </div>
  );
}
