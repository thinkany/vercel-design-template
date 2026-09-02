// ©2026 thinkany llc. All rights reserved.
// SEO field group + helpers shared by every collection. Per-entry values win;
// the site-level defaults fill the gaps.
import { z } from "astro/zod";

export const seoFields = z.object({
  /** <title>. Falls back to the entry's title. */
  title: z.string().optional(),
  /** Meta description (also og:description). */
  description: z.string().optional(),
  /** Social share image, a public/ path or absolute URL. */
  image: z.string().optional(),
  /** Keep this entry out of search engines and the sitemap. */
  noindex: z.boolean().default(false),
  /** Override the canonical URL (rarely needed). */
  canonical: z.string().url().optional(),
});
export type Seo = z.infer<typeof seoFields>;

export interface ResolvedSeo {
  title: string;
  description: string;
  image?: string;
  noindex: boolean;
  canonical?: string;
}

export function resolveSeo(
  seo: Partial<Seo> | undefined,
  fallback: { title: string; description?: string; siteName: string },
): ResolvedSeo {
  const s = seo ?? {};
  const title = s.title || fallback.title;
  return {
    title: title === fallback.siteName ? title : `${title} | ${fallback.siteName}`,
    description: s.description || fallback.description || "",
    image: s.image,
    noindex: !!s.noindex,
    canonical: s.canonical,
  };
}
