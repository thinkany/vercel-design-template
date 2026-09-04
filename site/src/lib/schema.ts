// ©2026 thinkany llc. All rights reserved.
/**
 * STRUCTURED DATA (CORE). One JSON-LD graph per page, generated from what the
 * site already knows, so a designer writes none of it: the WebSite and the
 * Organization (or Person / LocalBusiness) from Settings, then the page itself
 * (WebPage with breadcrumbs from the page outline, BlogPosting for a post,
 * CollectionPage for an index), plus any custom JSON-LD the page carries.
 * Pure: no Astro imports, so the design surface uses the same builder.
 */
export type SchemaSettings = {
  type?: "Organization" | "Person" | "LocalBusiness";
  name?: string;
  logo?: string;
  sameAs?: string[];
  phone?: string;
  address?: string;
  hours?: string;
};
export type Crumb = { name: string; url: string };
export type LdPage =
  | { kind: "page"; crumbs?: Crumb[] }
  | { kind: "post"; datePublished?: string; dateModified?: string; tags?: string[] }
  | { kind: "collection" };
export type LdInput = {
  siteUrl: string;        // absolute origin, no trailing slash
  siteName: string;
  logo?: string;          // brand logo path or URL
  schema?: SchemaSettings;
  url: string;            // canonical page URL (absolute)
  title: string;          // the page title (without the site name)
  description?: string;
  image?: string;         // absolute share image URL
  page: LdPage;
  blocks?: Record<string, unknown>[]; // entities declared by the page's blocks (BlockDef.schema)
  custom?: string;        // the page's own JSON-LD (a string, validated on save)
};

// Types that may appear ONCE per page: instances merge into one node, their list
// property concatenated (two FAQ blocks → one FAQPage with every question).
const MERGE_ONCE: Record<string, string> = { FAQPage: "mainEntity", ItemList: "itemListElement" };

/** Merge extra entities into a page graph: once-only types merged, duplicates by @id dropped. */
export function mergeEntities(extras: Record<string, unknown>[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const ids = new Set<string>();
  const once = new Map<string, Record<string, unknown>>();
  for (const e of extras) {
    if (!e || typeof e !== "object") continue;
    const type = String((e as { "@type"?: unknown })["@type"] || "");
    const listKey = MERGE_ONCE[type];
    if (listKey) {
      const items = Array.isArray(e[listKey]) ? (e[listKey] as unknown[]) : [];
      const cur = once.get(type);
      if (cur) { (cur[listKey] as unknown[]).push(...items); }
      else { const node = { ...e, [listKey]: [...items] }; once.set(type, node); out.push(node); }
      continue;
    }
    const id = (e as { "@id"?: unknown })["@id"];
    if (typeof id === "string") { if (ids.has(id)) continue; ids.add(id); }
    out.push(e);
  }
  return out;
}

const abs = (base: string, p?: string) => (p ? (/^https?:/i.test(p) ? p : base.replace(/\/$/, "") + (p.startsWith("/") ? p : "/" + p)) : undefined);

export function buildJsonLd(i: LdInput): Record<string, unknown>[] {
  const base = i.siteUrl.replace(/\/$/, "");
  const s = i.schema || {};
  const orgType = s.type || "Organization";
  const orgId = `${base}/#organization`;
  const siteId = `${base}/#website`;
  const org: Record<string, unknown> = { "@type": orgType, "@id": orgId, name: s.name || i.siteName, url: base + "/" };
  const logo = abs(base, s.logo || i.logo);
  if (logo) org[orgType === "Person" ? "image" : "logo"] = logo;
  if (s.sameAs && s.sameAs.length) org.sameAs = s.sameAs;
  if (s.phone) org.telephone = s.phone;
  if (s.address) org.address = { "@type": "PostalAddress", streetAddress: s.address };
  if (orgType === "LocalBusiness" && s.hours) org.openingHours = s.hours;
  const website: Record<string, unknown> = { "@type": "WebSite", "@id": siteId, name: i.siteName, url: base + "/", publisher: { "@id": orgId } };
  const graph: Record<string, unknown>[] = [org, website];

  const common = { url: i.url, name: i.title, ...(i.description ? { description: i.description } : {}), ...(i.image ? { image: i.image } : {}), isPartOf: { "@id": siteId } };
  if (i.page.kind === "post") {
    graph.push({ "@type": "BlogPosting", "@id": `${i.url}#article`, headline: i.title, ...(i.description ? { description: i.description } : {}), ...(i.image ? { image: i.image } : {}),
      ...(i.page.datePublished ? { datePublished: i.page.datePublished } : {}), ...(i.page.dateModified ? { dateModified: i.page.dateModified } : {}),
      ...(i.page.tags && i.page.tags.length ? { keywords: i.page.tags.join(", ") } : {}),
      author: { "@id": orgId }, publisher: { "@id": orgId }, mainEntityOfPage: { "@type": "WebPage", "@id": i.url }, isPartOf: { "@id": siteId } });
  } else if (i.page.kind === "collection") {
    graph.push({ "@type": "CollectionPage", "@id": i.url, ...common });
  } else {
    graph.push({ "@type": "WebPage", "@id": i.url, ...common, ...(i.page.crumbs && i.page.crumbs.length ? { breadcrumb: { "@id": `${i.url}#breadcrumb` } } : {}) });
    if (i.page.crumbs && i.page.crumbs.length) {
      graph.push({ "@type": "BreadcrumbList", "@id": `${i.url}#breadcrumb`, itemListElement: i.page.crumbs.map((c, n) => ({ "@type": "ListItem", position: n + 1, name: c.name, item: c.url })) });
    }
  }
  // Blocks' entities + the page's custom block, merged so once-only types stay single.
  const extras: Record<string, unknown>[] = [...(i.blocks || [])];
  if (i.custom && i.custom.trim()) {
    try { const c = JSON.parse(i.custom); if (Array.isArray(c)) extras.push(...(c as Record<string, unknown>[])); else if (c && typeof c === "object") extras.push(c as Record<string, unknown>); } catch { /* validated on save; a bad value is skipped, never breaks the page */ }
  }
  graph.push(...mergeEntities(extras));
  return graph;
}

/** The document as a single JSON-LD script body. */
export function jsonLdText(i: LdInput): string {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": buildJsonLd(i) });
}
