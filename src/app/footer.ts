// ©2026 thinkany llc. All rights reserved.
/**
 * FOOTER DATA (designer-owned, KEEP tier: a template upgrade never overwrites
 * this file). The footer has its OWN links, independent of the header menu, so
 * the two can be managed separately from the design phase onward: seeded from
 * the page list once, then yours to edit. `legal` is the copyright line and the
 * small legal links (privacy, terms) the footer shows beneath everything else.
 * When the design is promoted these move to content/site.json (footerLinks,
 * legal) and the CMS edits them in Navigation.
 */
import { designPages } from "./pages";
import { siteConfig } from "@/config/site";

export type FooterLink = { label: string; page?: string; href?: string };

/** Footer links: a page id (in-app navigation) or an href (anchor / URL). */
export const footerLinks: FooterLink[] = designPages
  .filter((p) => p.id !== "home")
  .map((p) => ({ label: p.name, page: p.id }));

/** {year} and {siteName} are filled in when rendered. */
export const legal: { copyright: string; links: FooterLink[] } = {
  copyright: `© {year} ${siteConfig.clientName || "{siteName}"}`,
  links: [],
};

export function fillCopyright(text: string): string {
  return text.replace(/\{year\}/g, String(new Date().getFullYear())).replace(/\{siteName\}/g, siteConfig.clientName || "");
}
