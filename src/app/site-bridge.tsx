// ©2026 thinkany llc. All rights reserved.
/**
 * SITE BRIDGE (framework machinery, CORE tier). Once a design has been PROMOTED
 * (content/site.json pins a design other than v00), the design surface stops
 * being a separate copy of the design and renders the SITE instead: the same
 * content/pages/*.json through the same site/blocks with the same site.json
 * navigation, inside <DesignSurface> as always. One truth, two renderers: the
 * Site tab (Astro) shows what the site emits, the design surface shows the same
 * pages with device frames, capture mode and the Figma export.
 *
 * Everything here is loaded through import.meta.glob so a project without a
 * site target (or one not yet promoted) still builds: the globs are simply empty
 * and App.tsx keeps the designer's pages.ts.
 */
import { useCallback, type MouseEvent, type ReactNode } from "react";
import { DesignSurface } from "./DesignSurface";
import type { DesignPage } from "./pages.schema";
import { siteConfig } from "@/config/site";

type AnyRecord = Record<string, unknown>;
type BlockInstance = { type: string; props?: AnyRecord };
type PageDoc = { title?: string; slug?: string; seo?: AnyRecord; blocks?: BlockInstance[] };
type BlockDef = { name: string; props: { safeParse: (v: unknown) => { success: boolean; data?: AnyRecord; error?: { issues: { path: (string | number)[]; message: string }[] } } }; component: (props: AnyRecord) => ReactNode };
type ChromeModule = { Header?: ((p: AnyRecord) => ReactNode) | null; Footer?: ((p: AnyRecord) => ReactNode) | null; chrome?: { header?: BlockDef; footer?: BlockDef } };

// content/site.json → { design, nav, footerLinks }
const siteFiles = import.meta.glob("../../content/site.json", { eager: true, import: "default" }) as Record<string, AnyRecord>;
const site = (Object.values(siteFiles)[0] || {}) as { design?: string; nav?: AnyRecord[]; footerLinks?: AnyRecord[] };

// content/pages/*.json → the site's pages
const pageFiles = import.meta.glob("../../content/pages/*.json", { eager: true, import: "default" }) as Record<string, PageDoc>;

// site/blocks/index.ts → the block registry; site/blocks/chrome.ts → Header/Footer
const registryFiles = import.meta.glob("../../site/blocks/index.ts", { eager: true }) as Record<string, { blocks?: Record<string, BlockDef> }>;
const chromeFiles = import.meta.glob("../../site/blocks/chrome.ts", { eager: true }) as Record<string, ChromeModule>;
const blocks: Record<string, BlockDef> = (Object.values(registryFiles)[0] || {}).blocks || {};
const chromeMod: ChromeModule = Object.values(chromeFiles)[0] || {};

// Block-owned CSS (keyframes the promoted blocks use), when the site target exists.
import.meta.glob("../../site/blocks/blocks.css", { eager: true });

/** True once the design was promoted: the design surface renders the site. */
export const isPromoted = !!site.design && site.design !== "v00" && Object.keys(pageFiles).length > 0 && Object.keys(blocks).length > 0;

function pageIdOf(file: string) { return file.replace(/^.*\//, "").replace(/\.json$/, ""); }

/** The site's pages as design pages, so App/export/nav enumerate them. */
export function sitePages(): DesignPage[] {
  const out = Object.entries(pageFiles).map(([file, doc]) => {
    const id = pageIdOf(file);
    const route = doc.slug ?? (id === "home" ? "" : id);
    return { id, route, name: doc.title || id, component: "__site__" };
  });
  out.sort((a, b) => (a.id === "home" ? -1 : b.id === "home" ? 1 : a.name.localeCompare(b.name)));
  return out;
}

function pageDoc(id: string): PageDoc | null {
  const hit = Object.entries(pageFiles).find(([file]) => pageIdOf(file) === id);
  return hit ? hit[1] : null;
}

type View = "desktop" | "tablet" | "mobile";
type Orientation = "portrait" | "landscape";
interface Props {
  pageId: string;
  onNavigate: (page: string) => void;
  view: View;
  setView: (v: View) => void;
  orientation: Orientation;
  setOrientation: (o: Orientation) => void;
  capture?: View;
}

/**
 * A content page rendered through the site's blocks and chrome, inside the
 * design surface. Links are intercepted so the preview never leaves the app's
 * single-page surface: "/#id" scrolls to the section, "/route" switches page,
 * "#id" scrolls, anything else opens as it would on the site.
 */
export function SitePage({ pageId, onNavigate, view, setView, orientation, setOrientation, capture }: Props) {
  const doc = pageDoc(pageId);
  const pages = sitePages();
  const Header = chromeMod.Header || null;
  const Footer = chromeMod.Footer || null;
  // The chrome's props go through its own schema (as Astro's layout does), so nav
  // items get their defaults (an item without `links` gets []).
  const rawChrome = { siteName: siteConfig.clientName, logo: siteConfig.logo || undefined, nav: (site.nav || []).map((l) => ({ links: [], ...(l as AnyRecord) })), footerLinks: site.footerLinks || [] };
  const parseChrome = (def?: BlockDef) => { const r = def?.props.safeParse(rawChrome); return r && r.success && r.data ? r.data : rawChrome; };
  const headerProps = parseChrome(chromeMod.chrome?.header);
  const footerProps = parseChrome(chromeMod.chrome?.footer);

  const onClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
    if (!a) return;
    const href = a.getAttribute("href") || "";
    const anchor = href.match(/^\/?#([A-Za-z0-9_-]+)$/);
    if (anchor) { e.preventDefault(); document.getElementById(anchor[1])?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    const internal = href.match(/^\/([A-Za-z0-9_-]*)(?:#([A-Za-z0-9_-]+))?$/);
    if (internal) {
      const target = pages.find((p) => p.route === internal[1]);
      if (target) {
        e.preventDefault();
        onNavigate(target.id);
        if (internal[2]) setTimeout(() => document.getElementById(internal[2]!)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
    }
  }, [pages, onNavigate]);

  const rendered = (doc?.blocks || []).map((b, i) => {
    const def = blocks[b.type];
    if (!def) return <BridgeNote key={i} text={`Unknown block "${b.type}" in content/pages/${pageId}.json`} />;
    const parsed = def.props.safeParse(b.props || {});
    if (!parsed.success) {
      const issues = (parsed.error?.issues || []).map((x) => `${x.path.join(".") || "(root)"}: ${x.message}`).join("; ");
      return <BridgeNote key={i} text={`Block "${b.type}" has invalid content (${issues})`} />;
    }
    const Block = def.component;
    return <Block key={i} {...(parsed.data as AnyRecord)} />;
  });

  return (
    <DesignSurface view={view} setView={setView} orientation={orientation} setOrientation={setOrientation} capture={capture} onNavigate={onNavigate} chrome={false}>
      <div className="flex-1 flex flex-col w-full" onClickCapture={onClick}>
        {Header && <Header {...headerProps} />}
        <div className="flex-1">{doc ? rendered : <BridgeNote text={`No content page "${pageId}"`} />}</div>
        {Footer && <Footer {...footerProps} />}
      </div>
    </DesignSurface>
  );
}

// A quiet in-surface notice for content the site build would reject too.
function BridgeNote({ text }: { text: string }) {
  return (
    <div className="mx-auto my-8 max-w-[720px] rounded-md border border-dashed border-ta-border bg-ta-surface px-5 py-4 font-ta-sans text-[13px] text-ta-body">
      {text}
    </div>
  );
}
