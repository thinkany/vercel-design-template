// ©2026 thinkany llc. All rights reserved.
// MENU SEED: the pure half of "the menu arrives describing THIS client".
//
// The configured header (header.config.ts + a CORE Header.tsx) guarantees the
// header the designer picked is the header that renders. It says nothing about
// what the menu CONTAINS — and the scaffold's starter content is a clothing shop
// ("Shop by Category", "Women", "Summer '26"), which on an architecture practice
// reads as a bug even though the structure is perfect.
//
// So before the build starts, the brief becomes the menu's DATA: one cheap model
// call turns "what we're making" plus the chosen sections into nav items with
// domain-correct links and columns, written into src/app/menu.ts. The design turn
// then inherits a menu that already describes this client's architecture, and has
// nothing to invent. Same shape as seo-fill.cjs: no I/O and no SDK here, main.cjs
// makes the one call.
//
//   node desktop/dev/menu-seed.test.cjs

// Every nav item shows its own menu, so a long list is a long hover surface. Four
// or five top-level items is what a marketing site actually carries.
const MAX_ITEMS = 6;
const MAX_LINKS = 6;     // links in one dropdown, or in one mega column
const MAX_COLUMNS = 4;   // mega columns, before the feature panel
const LABEL_MAX = 28;

/** A page id from a label: "Our Services" → "services". Stable and URL-safe. */
function idFor(label, taken) {
  const base = String(label || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 2)
    .join("-") || "page";
  if (!taken || !taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      description: "The site's top-level navigation, in the order they appear, home excluded.",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "The nav label as it appears in the bar, in this client's own words. Title Case, one or two words." },
          links: {
            type: "array",
            description: "For a dropdown: the links this item reveals. Empty when the item opens nothing or uses columns.",
            items: { type: "string" },
          },
          columns: {
            type: "array",
            description: "For a mega menu: the grouped columns this item reveals. Empty when the item is a dropdown or opens nothing.",
            items: {
              type: "object",
              properties: {
                heading: { type: "string", description: "The column's heading." },
                links: { type: "array", items: { type: "string" } },
              },
              required: ["heading", "links"],
              additionalProperties: false,
            },
          },
        },
        required: ["label", "links", "columns"],
        additionalProperties: false,
      },
    },
    featured: {
      type: "object",
      description: "The mega panel's featured block: this client's strongest single offer. Empty strings when the menu is not a mega.",
      properties: {
        label: { type: "string" },
        blurb: { type: "string", description: "One short sentence, at most 12 words." },
      },
      required: ["label", "blurb"],
      additionalProperties: false,
    },
  },
  required: ["items", "featured"],
  additionalProperties: false,
};

/**
 * The one call's prompt. `brief` is the intake Brief; `menuKind` is the header's
 * configured kind ("none" | "dropdown" | "mega").
 *
 * The instruction that carries the most weight is the last one: a thin brief must
 * still produce links that belong to THIS client's domain. Starter content the
 * designer edits down is the goal; wrong-industry content is the failure.
 */
function prompt(brief, menuKind) {
  const b = brief || {};
  const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
  const facts = [
    b.what ? `What we're making: ${String(b.what).trim()}` : "",
    b.clientName ? `Client: ${b.clientName}` : "",
    list(b.audience).length ? `Audience: ${b.audience.join(", ")}` : "",
    list(b.sections).length ? `Sections chosen for the home page: ${b.sections.join(", ")}` : "",
    b.tone ? `Tone: ${b.tone}` : "",
    list(b.notes).length ? `Also: ${b.notes.join("; ")}` : "",
  ].filter(Boolean).join("\n");

  const shape = menuKind === "mega"
    ? `Every item that opens a menu uses "columns" (2 to ${MAX_COLUMNS} columns, each with a heading and 2 to ${MAX_LINKS} links) and leaves "links" empty. Give the two or three items with real depth their columns; leave a genuinely flat item (Contact, About) with both empty. Fill "featured" with this client's strongest single offer.`
    : menuKind === "dropdown"
      ? `Every item that opens a menu uses "links" (3 to ${MAX_LINKS} links) and leaves "columns" empty. Leave a genuinely flat item (Contact) with both empty. Leave "featured" as empty strings.`
      : `No item opens a menu: leave both "links" and "columns" empty on every item, and "featured" as empty strings.`;

  const system = [
    "You lay out the navigation for a small business website. Reply only with the JSON shape requested.",
    "",
    "Rules:",
    `- items: ${MAX_ITEMS} at most, usually four or five. The pages a visitor expects for THIS business, in a sensible order, ending with Contact when the brief calls for one. Never include Home: the logo is the home link.`,
    `- Label everything in this client's own domain language, taken from the brief's wording where it gives you any. An architecture practice gets "Residential, Commercial, Heritage", not "Category One". A law firm gets its practice areas. Never use retail or clothing wording ("Shop by Category", "New Arrivals", "Sale") unless the brief actually describes a shop.`,
    `- ${shape}`,
    `- Labels are at most ${LABEL_MAX} characters, Title Case, no trailing punctuation, no articles at the start.`,
    "- Invent no facts: no prices, no locations, no team names, no awards, no phone numbers. Where the brief is thin, write the links a business of this kind plainly has, so the designer edits rather than deletes.",
    "- No em-dashes anywhere.",
  ].join("\n");

  const user = facts || "A small business website. The brief gives no detail, so use the plainest structure such a site has.";
  return { system, user };
}

/** Trim a label to the house rules; returns "" for anything unusable. */
function label(raw) {
  const s = String(raw == null ? "" : raw).replace(/\s+/g, " ").replace(/[.,;:]+$/, "").trim();
  if (!s || s.length > LABEL_MAX * 2) return "";
  return s.slice(0, LABEL_MAX).trim();
}

/**
 * The model's reply → the shape menu.ts holds. Defensive by construction: every
 * cap is re-applied here rather than trusted, an item whose label doesn't survive
 * is dropped, and a "Home" item is removed however it arrives (the logo is the
 * home link). Returns { items: [{ id, name, menu }], featured } where `menu`
 * matches src/app/menu.schema.ts's ItemMenu.
 */
function clean(raw, menuKind) {
  const r = raw && typeof raw === "object" ? raw : {};
  const taken = new Set(["home"]);
  const items = [];
  for (const it of Array.isArray(r.items) ? r.items : []) {
    const name = label(it && it.label);
    if (!name || /^home$/i.test(name)) continue;
    const id = idFor(name, taken);
    taken.add(id);

    let menu = { kind: "none" };
    if (menuKind === "dropdown") {
      const links = (Array.isArray(it.links) ? it.links : [])
        .map(label).filter(Boolean).slice(0, MAX_LINKS)
        .map((l) => ({ label: l }));
      if (links.length) menu = { kind: "dropdown", links };
    } else if (menuKind === "mega") {
      const sections = (Array.isArray(it.columns) ? it.columns : [])
        .map((c) => ({
          title: label(c && c.heading),
          links: (Array.isArray(c && c.links) ? c.links : []).map(label).filter(Boolean).slice(0, MAX_LINKS).map((l) => ({ label: l })),
        }))
        .filter((c) => c.title && c.links.length)
        .slice(0, MAX_COLUMNS);
      if (sections.length) menu = { kind: "mega", sections };
    }
    items.push({ id, name, menu });
    if (items.length >= MAX_ITEMS) break;
  }

  const f = r.featured && typeof r.featured === "object" ? r.featured : {};
  const fLabel = label(f.label);
  const fBlurb = String(f.blurb == null ? "" : f.blurb).replace(/\s+/g, " ").trim().slice(0, 120);
  const featured = menuKind === "mega" && fLabel && fBlurb ? { label: fLabel, blurb: fBlurb } : null;

  // The featured panel belongs to ONE item, not all of them: the first with columns.
  if (featured) {
    const host = items.find((i) => i.menu.kind === "mega");
    if (host) host.menu = { ...host.menu, featured };
  }
  return { items, featured };
}

const HEADER = `// ©2026 thinkany llc. All rights reserved.
/**
 * DESKTOP NAV MENUS — DATA (designer-owned, KEEP tier: a template upgrade NEVER
 * overwrites this file). \`navMenus\` is the per-item source of truth for what each
 * nav item reveals on hover.
 *
 * WRITTEN FROM THE BRIEF. The app seeded these entries from what the designer
 * described, so the menu already talks about this client rather than showing the
 * template's starter content. Edit any entry freely: mix mega, dropdown and none
 * per item, change the links, add or remove columns. Each distinct open state
 * exports as its own "Menu — {Item}" Block.
 *
 * The types and the lookup logic live in menu.schema.ts (CORE tier). The header's
 * STRUCTURE (where the logo sits, what opens) is header.config.ts; its LOOK is
 * components/header.skin.ts.
 */
import { designPages } from "./pages";
import { menuForIn, hasMenuIn, menuItemIdsIn, type ItemMenu } from "./menu.schema";
`;

const FOOTER = `
export const menuFor = (id: string): ItemMenu => menuForIn(navMenus, id);
export const hasMenu = (id: string): boolean => hasMenuIn(navMenus, id);
export const menuItemIds = (): string[] => menuItemIdsIn(navMenus);

export type { MenuKind, DropdownMenu, MegaMenu, MegaSection, ItemMenu } from "./menu.schema";
`;

const q = (s) => JSON.stringify(String(s));

/** One item's ItemMenu as TypeScript source. */
function menuLiteral(menu, indent = "  ") {
  const i2 = indent + "  ";
  const i3 = i2 + "  ";
  if (!menu || menu.kind === "none") return `{ kind: "none" }`;
  if (menu.kind === "dropdown") {
    const links = menu.links.map((l) => `{ label: ${q(l.label)} }`).join(", ");
    return `{\n${i2}kind: "dropdown",\n${i2}links: [${links}],\n${indent}}`;
  }
  const sections = menu.sections.map((s) => {
    const links = s.links.map((l) => `{ label: ${q(l.label)} }`).join(", ");
    return `${i3}{ title: ${q(s.title)}, links: [${links}] },`;
  }).join("\n");
  const feat = menu.featured
    ? `\n${i2}featured: { label: ${q(menu.featured.label)}, blurb: ${q(menu.featured.blurb)} },`
    : "";
  return `{\n${i2}kind: "mega",\n${i2}sections: [\n${sections}\n${i2}],${feat}\n${indent}}`;
}

/**
 * The seeded menu.ts, as source. Items whose id is NOT in pages.ts yet still get
 * an entry: the design turn adds those pages, and `menuForIn` simply returns
 * `none` for an id with no page, so a menu is never rendered for a page that
 * doesn't exist. That ordering is what lets the app seed before the build.
 */
function renderMenuTs(items) {
  if (!items || !items.length) {
    return `${HEADER}
/** Per nav-item menu, keyed by page id. No menus: every nav item is a plain link. */
export const navMenus: Record<string, ItemMenu> = Object.fromEntries(
  designPages.map((p) => [p.id, { kind: "none" } as ItemMenu]),
);
${FOOTER}`;
  }
  const entries = items.map((it) => `  ${/^[a-z][a-z0-9]*$/i.test(it.id) ? it.id : q(it.id)}: ${menuLiteral(it.menu)},`).join("\n");
  return `${HEADER}
/** Per nav-item menu, keyed by page id. Seeded from the brief; edit freely. */
export const navMenus: Record<string, ItemMenu> = {
${entries}
};
${FOOTER}`;
}

/**
 * The seeded pages.ts, as source. The nav items ARE the site's pages, so seeding
 * the menu without seeding the pages would leave a menu no header renders.
 * `component: "Home"` for every page is deliberate: the design turn creates the
 * real components and rewrites these rows, but until it does, every nav link
 * resolves to something rather than erroring.
 */
function renderPagesTs(items) {
  const rows = [
    `  { id: "home", route: "", name: "Home", component: "Home" },`,
    ...(items || []).map((it) => `  { id: ${q(it.id)}, route: ${q(it.id)}, name: ${q(it.name)}, component: "Home" },`),
  ].join("\n");
  return `// ©2026 thinkany llc. All rights reserved.
/**
 * DESIGN PAGES — DATA (designer-owned, KEEP tier: a template upgrade NEVER
 * overwrites this file). The list of design surfaces this project ships.
 *
 * WRITTEN FROM THE BRIEF. The app seeded these pages from what the designer
 * described, so the header's nav is this client's architecture from the first
 * frame. Every page starts pointing at the Home component; the design turn
 * builds each real page and updates its \`component\`. The framework contract
 * (the DesignPage shape) lives in pages.schema.ts (CORE tier).
 */
import type { DesignPage } from "./pages.schema";

export const designPages: DesignPage[] = [
${rows}
];

/** The default design page shown for \`?v={id}\` with no other page flag. */
export const defaultDesignPageId = "home";

export type { DesignPage } from "./pages.schema";
`;
}

module.exports = {
  prompt, clean, renderMenuTs, renderPagesTs, idFor, label, menuLiteral,
  SCHEMA, MAX_ITEMS, MAX_LINKS, MAX_COLUMNS, LABEL_MAX,
};
