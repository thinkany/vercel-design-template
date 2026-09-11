// ©2026 thinkany llc. All rights reserved.
// Prop fragments shared by this site's blocks (KEEP tier). Extend here rather
// than redefining the same shapes per block.
import { z } from "astro/zod";

export const image = z.object({
  /** A public/ path ("/images/hero.jpg") or absolute URL. */
  src: z.string(),
  alt: z.string().default(""),
});

/**
 * A clip and the poster still that stands in for it. The `poster` key is what tells
 * the CMS this is video rather than an image, so both are required together: a clip
 * with no poster is blank for reduced motion and in the Figma export.
 */
export const video = z.object({
  /** A public/ path ("/video/hero.mp4"). */
  src: z.string(),
  /** The still beside it ("/video/hero.poster.avif"). */
  poster: z.string(),
  alt: z.string().default(""),
});

export const link = z.object({
  label: z.string(),
  /** A path, an in-page anchor ("#plan-your-trip") or a full URL. */
  href: z.string(),
});

/** Section anchor id; nav links point at "#<id>". */
export const anchor = (fallback: string) => z.string().default(fallback);
