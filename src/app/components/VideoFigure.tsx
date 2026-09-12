// ©2026 thinkany llc. All rights reserved.
import type { CSSProperties } from "react";
import { videoEmbed, embedFrameProps } from "../../../site/src/lib/embed";

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
  /** The clip, under public/video (e.g. "/video/process.mp4"), or a YouTube / Vimeo address. */
  src: string;
  /** The poster still beside it: reduced motion and the Figma capture show it. A YouTube
   *  address brings its own when this is empty; a clip or a Vimeo address needs one. */
  poster: string;
  /** What the clip shows. Announced when it is content; the still's alt text. */
  label?: string;
  /** The clip carries meaning: give it controls, focus and a name. */
  controls?: boolean;
  /** The box: aspect ratio, width, rounding, e.g. "aspect-[4/3] w-full rounded-xl". */
  className?: string;
  style?: CSSProperties;
}) {
  // A YouTube / Vimeo address in `src` is the same figure with the host's player in the
  // clip's place. A hosted video is always content (the visitor starts it, with the
  // host's controls), whatever `controls` says: it is never texture. YouTube's own
  // thumbnail stands in for a missing poster; the still shows in the Figma capture.
  const embed = videoEmbed(src);
  const still = poster || (embed && embed.thumb) || "";
  const content = controls || !!embed;
  return (
    <div data-video-figure className={`relative overflow-clip ${className}`} style={style}>
      {/* The still: what reduced motion and the Figma capture show, and what remains if
          the clip cannot load. Named when the clip is content, decorative when texture. */}
      {still ? (
        <img
          src={still}
          alt={content && label ? label : ""}
          className="ta-video-still absolute inset-0 h-full w-full object-cover"
          aria-hidden={content ? undefined : "true"}
        />
      ) : null}
      {embed ? (
        // Content the visitor starts, not motion: reduced motion keeps it, and only the
        // Figma capture swaps it for the still (motion.css, `.ta-video-embed`).
        <iframe
          {...embedFrameProps(embed, { title: label })}
          className="ta-video-embed absolute inset-0 h-full w-full border-0"
        />
      ) : (
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
      )}
    </div>
  );
}
