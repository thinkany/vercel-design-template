// ©2026 thinkany llc. All rights reserved.
// The header menu (CORE). With content/site.json `manageNav: false` the menu is
// DERIVED from the page outline: top-level pages in their order, each child page
// a sub-link, home left out (the logo links home). Otherwise it is `site.nav` as
// edited in the CMS. The design surface mirrors this in src/app/site-bridge.tsx.
import { getCollection } from "astro:content";
import { pageRoute } from "./pages";
import type { NavItem, SiteSettings } from "./site";

export async function resolveNav(site: SiteSettings): Promise<NavItem[]> {
  if (site.manageNav !== false) return site.nav;
  const pages = await getCollection("pages");
  const kids = (pid: string | null) => pages.filter((p) => p.id !== "home" && (p.data.parent ?? null) === pid)
    .sort((a, b) => ((a.data.order ?? 1e9) - (b.data.order ?? 1e9)) || a.data.title.localeCompare(b.data.title));
  return kids(null).map((p) => ({
    label: p.data.title,
    href: "/" + pageRoute(p, pages),
    links: kids(p.id).map((c) => ({ label: c.data.title, href: "/" + pageRoute(c, pages) })),
    columns: [],
  }));
}
