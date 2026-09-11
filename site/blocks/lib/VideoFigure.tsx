// ©2026 thinkany llc. All rights reserved.
// In-flow video for site blocks (KEEP tier). The same markup as the design surface's
// src/app/components/VideoFigure.tsx: the poster still and the clip together, with
// src/styles/motion.css choosing between them, so a block stays static HTML. Texture is
// decorative and silent; `controls` marks a clip that carries meaning and names it.
import type { CSSProperties } from "react";

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
