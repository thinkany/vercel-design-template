// ©2026 thinkany llc. All rights reserved.
// content/site.json — the site-level settings (designer-owned, KEEP tier), read
// and validated here (CORE). Pins the design variation, carries the public URL,
// and the navigation the site chrome renders.
import { z } from "astro/zod";
import raw from "../../../content/site.json";
import { navColumn } from "./blocks";
import { pageRoute } from "./pages";

const navLink = z.object({
  label: z.string(),
  /** A path ("/about"), an in-page anchor ("#things-to-do") or a full URL. */
  href: z.string(),
});
export const navItem = navLink.extend({
  /** Sub-links (a dropdown on desktop, an inline accordion on mobile). */
  links: z.array(navLink).default([]),
  /** Mega-menu columns (rendered only by a header whose schema accepts them). */
  columns: z.array(navColumn).default([]),
});
export type NavItem = z.infer<typeof navItem>;

export const siteSchema = z.object({
  /** The design variation the site is built from ("v00" = the base). */
  design: z.string().default("v00"),
  /** Canonical public URL (SITE_URL in the environment overrides it). */
  url: z.string().url().optional(),
  /** Primary navigation, shared by the header and footer chrome. */
  nav: z.array(navItem).default([]),
  /** The footer's own links, independent of the header menu. An item with `links` is a COLUMN: its label is the heading (href optional). */
  footerLinks: z.array(navLink.extend({ href: z.string().default(""), links: z.array(navLink).default([]) })).default([]),
  /** The legal line: copyright ({year} and {siteName} are filled in) + privacy / terms links. */
  legal: z.object({ copyright: z.string().optional(), links: z.array(navLink).default([]) }).default({ links: [] }),
  /**
   * The footer's own copy (the Footer schema's props beyond the chrome set: a tagline, a
   * short line), edited in the CMS under Navigation → Footer. Absent fields fall back to
   * the schema's defaults, the design's words. See chromeCopy in lib/blocks.
   */
  footer: z.record(z.unknown()).default({}),
  /** Contact details (email, phone, address): the footer shows what is set; the Organization structured data carries them. */
  contact: z.object({ email: z.string().default(""), phone: z.string().default(""), address: z.string().default("") }).default({ email: "", phone: "", address: "" }),
  /**
   * true: the header menu is `nav` above, edited in the CMS. false: the menu follows
   * the page outline (top-level pages in order, their children as sub-links).
   */
  manageNav: z.boolean().default(true),
  /**
   * Scripts injected ONLY on the published site (a Vercel build), never in local dev,
   * the local build check or the gated design previews. gtm: a GTM container id
   * (GTM-XXXXXXX, both snippets are generated) or a pasted snippet (head). extra:
   * named scripts with a placement.
   */
  scripts: z.object({
    gtm: z.string().default(""),
    extra: z.array(z.object({
      name: z.string().default(""),
      placement: z.enum(["head", "bodyStart", "bodyEnd"]).default("head"),
      code: z.string().default(""),
    })).default([]),
  }).default({ gtm: "", extra: [] }),
  /** Logos per slot (Settings → Logos) + the wordmark shown when a slot has no logo. */
  logos: z.object({
    items: z.array(z.object({ slot: z.enum(["header", "headerMobile", "footer", "footerMobile"]), src: z.string() })).default([]),
    wordmark: z.string().optional(),
  }).default({ items: [] }),
  /**
   * Form delivery (the Forms tab's Delivery card): which mail provider sends
   * submissions and as whom. The provider KEY is not here: the app keeps it and
   * sets it on the site's Vercel project at publish (FORMS_PROVIDER_KEY).
   */
  forms: z.object({
    provider: z.enum(["", "resend", "postmark", "sendgrid"]).default(""),
    /** The verified sender, "Website <forms@client.com>". */
    from: z.string().default(""),
    /** Cloudflare Turnstile site key (public): the widget a protected form renders. Written by the app at publish, or pasted by hand. */
    turnstileSiteKey: z.string().default(""),
  }).default({ provider: "", from: "", turnstileSiteKey: "" }),
  /** Redirects (Settings): an old path to a new path or address, with the status code. */
  redirects: z.array(z.object({ from: z.string(), to: z.string(), type: z.number().default(301) })).default([]),
  /** CMS display names per block key (recognition only; the site doesn't use them). */
  blockNames: z.record(z.string()).default({}),
  /** The posts directory: posts are listed at /<path> and served at /<path>/<post>. */
  blog: z.object({
    path: z.string().default("blog"),
    /** The page the posts directory sits under (a page id), or "" for the root: /blog vs /resources/blog. */
    parent: z.string().default(""),
    /** The built-in Posts block (Settings → Blog): how many posts, a tag filter, and its style. */
    posts: z.object({
      count: z.number().int().min(0).default(6),
      filter: z.boolean().default(false),
      filterKind: z.enum(["pills", "select"]).default("pills"),
    }).default({ count: 6, filter: false, filterKind: "pills" }),
  }).default({ path: "blog", parent: "", posts: { count: 6, filter: false, filterKind: "pills" } }),
  /** Site icons (the CMS Settings tab): paths under public/, e.g. "/images/icon.svg". */
  favicon: z.object({
    /** Browser tab / bookmark icon: SVG (best) or a square PNG. */
    icon: z.string().optional(),
    /** Home-screen icon on phones: a 180×180 PNG. */
    touch: z.string().optional(),
  }).default({}),
  /** Search-engine settings (the CMS Settings tab). */
  seo: z.object({
    /** The website name in titles and og:site_name (defaults to the project's client name). */
    siteName: z.string().optional(),
    /** Between a page title and the website name: "Island Guide | Visit Hawaii". */
    separator: z.string().default("|"),
    /** The share image used when a page or post has none of its own. */
    image: z.string().optional(),
    /** Structured data: who publishes the site (Organization / Person / LocalBusiness). */
    schema: z.object({
      type: z.enum(["Organization", "Person", "LocalBusiness"]).default("Organization"),
      name: z.string().optional(),
      logo: z.string().optional(),
      sameAs: z.array(z.string()).default([]),
      phone: z.string().optional(),
      address: z.string().optional(),
      hours: z.string().optional(),
    }).default({ type: "Organization", sameAs: [] }),
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
  }).default({ separator: "|", discourage: false, sitemap: true, llms: { enabled: true, content: null } }),
});
export type SiteSettings = z.infer<typeof siteSchema>;

const parsed = siteSchema.safeParse(raw);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
  throw new Error(`content/site.json is invalid:\n${issues}`);
}
export const site: SiteSettings = parsed.data;
/** The posts directory's own segment, normalized: no slashes, lower-case ("blog"). */
export const blogDir: string = (site.blog.path || "blog").replace(/^\/+|\/+$/g, "").toLowerCase() || "blog";
/** The page it sits under (Settings → Blog), or "" for the root. */
export const blogParent: string = String(site.blog.parent || "");
// The parent's route needs the pages (content/pages/*.json). An eager glob in a
// try/catch, as entries.ts does: the app's schema introspection bundles this for
// Node, where import.meta.glob doesn't exist; a parent that no longer exists is ignored.
const pagesRaw: Record<string, { slug?: string; parent?: string }> = (() => { try { return import.meta.glob("../../../content/pages/*.json", { eager: true, import: "default" }) as Record<string, { slug?: string; parent?: string }>; } catch { return {}; } })();
const pageList = Object.entries(pagesRaw).map(([file, data]) => ({ id: file.replace(/^.*\//, "").replace(/\.json$/, ""), data: data || {} }));
const parentPage = blogParent ? pageList.find((q) => q.id === blogParent) : undefined;
/** The posts directory's full route, no leading slash: "blog", or "resources/blog" under a parent page. */
export const blogPath: string = parentPage ? [pageRoute(parentPage, pageList), blogDir].filter(Boolean).join("/") : blogDir;
