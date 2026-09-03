// ©2026 thinkany llc. All rights reserved.
// content/site.json — the site-level settings (designer-owned, KEEP tier), read
// and validated here (CORE). Pins the design variation, carries the public URL,
// and the navigation the site chrome renders.
import { z } from "astro/zod";
import raw from "../../../content/site.json";

const navLink = z.object({
  label: z.string(),
  /** A path ("/about"), an in-page anchor ("#things-to-do") or a full URL. */
  href: z.string(),
});
export const navItem = navLink.extend({
  /** Sub-links (a dropdown on desktop, an inline accordion on mobile). */
  links: z.array(navLink).default([]),
});
export type NavItem = z.infer<typeof navItem>;

export const siteSchema = z.object({
  /** The design variation the site is built from ("v00" = the base). */
  design: z.string().default("v00"),
  /** Canonical public URL (SITE_URL in the environment overrides it). */
  url: z.string().url().optional(),
  /** Primary navigation, shared by the header and footer chrome. */
  nav: z.array(navItem).default([]),
  /** Footer-only links (legal, social…). */
  footerLinks: z.array(navLink).default([]),
  /** Search-engine settings (the CMS Settings tab). */
  seo: z.object({
    /** robots.txt Disallow: /, noindex on every page, no sitemap. */
    discourage: z.boolean().default(false),
    /** Build sitemap-index.xml (ignored while discourage is on). */
    sitemap: z.boolean().default(true),
    llms: z.object({
      enabled: z.boolean().default(true),
      /** Custom llms.txt content; null = generated from the site's content. */
      content: z.string().nullable().default(null),
    }).default({ enabled: true, content: null }),
    // zod 3 returns a `.default()` value as-is (inner defaults don't apply), so
    // the defaults are spelled out in full at both levels.
  }).default({ discourage: false, sitemap: true, llms: { enabled: true, content: null } }),
});
export type SiteSettings = z.infer<typeof siteSchema>;

const parsed = siteSchema.safeParse(raw);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
  throw new Error(`content/site.json is invalid:\n${issues}`);
}
export const site: SiteSettings = parsed.data;
