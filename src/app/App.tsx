// ©2026 thinkany llc. All rights reserved.
import { useState, useEffect } from "react";

import { resolveComponent } from "./variationRegistry";
import { fetchVariation, patchVariation, type Variation } from "../data/variations";
import { siteConfig, previewConfig, previewWidths, projectType } from "../config/site";
import type { View } from "../config/site";

import { Dashboard } from "./components/Dashboard";
import { designPages as authoredPages, defaultDesignPageId } from "./pages";
import { isPromoted, sitePages, SitePage, BlockPreview } from "./site-bridge";

// The pages the design surface renders. Before promotion: the designer's list in
// pages.ts. Once the design is promoted (content/site.json pins a design), the
// SITE's pages, rendered through the site's blocks and chrome (site-bridge), so
// the design tabs, capture mode and the Figma export follow the site.
const designPages = isPromoted ? sitePages() : authoredPages;

function getInitialPage(): string {
  const params = new URLSearchParams(window.location.search);
  if (params.has("blockpreview")) return "blockpreview"; // one block, for the CMS editor
  if (params.has("styleguide")) return "styleguide";
  // Explicit design-page route flags (e.g. ?v=v00&about). Home has no flag.
  for (const p of designPages) {
    if (p.route && params.has(p.route)) return p.id;
  }
  // `?v=…` (or an isolated `?capture=…`) with no page flag → the default page.
  if (params.has("v") || params.has("capture")) return defaultDesignPageId;
  return "dashboard";
}

// Isolated capture view requested via `?capture={desktop|tablet|mobile}` — the
// export tool (scripts/export-to-figma.mjs) loads one URL per active breakpoint.
function getCaptureView(): View | undefined {
  const raw = new URLSearchParams(window.location.search).get("capture");
  return raw === "desktop" || raw === "tablet" || raw === "mobile" ? raw : undefined;
}

function getVariationId(): string {
  return new URLSearchParams(window.location.search).get("v") ?? "v00";
}

// Lazy loaders for each variation's design tokens. Only the active variation's
// tokens.css is loaded (see effect below); it's injected after the base tokens
// so its :root values win, letting a variation diverge its own fonts/colors.
const variationTokenLoaders = import.meta.glob("../variations/*/styles/tokens.css");
// ...and its webfonts. A variation's fonts.css is where apply-brand / setup-styleguide
// put the brand's Google Fonts @import (and any @font-face), and the site loads it as
// its own stylesheet (Base.astro). The design surface must load it too, or the
// --ta-font-* families the variation's tokens name never arrive here and the preview
// falls back to a system face while the published site shows the brand type.
const variationFontLoaders = import.meta.glob("../variations/*/styles/fonts.css");
// ...and its globals: block-level CSS a design adds (keyframes, textures, scroll-driven
// rules) lives in the variation's globals.css, and the site loads that copy. Same rule:
// what the site loads, the design surface loads, or the two disagree.
const variationGlobalLoaders = import.meta.glob("../variations/*/styles/globals.css");

export default function App() {
  const [page, setPage] = useState(getInitialPage);
  const [view, setView] = useState<"desktop" | "tablet" | "mobile">(previewConfig.defaultView);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const variationId = getVariationId();
  const captureView = getCaptureView();

  // Expose the active breakpoint set + widths so the headless export tool can
  // read the project's real device matrix instead of hardcoding it. Tablet is
  // present here only when VITE_ENABLE_TABLET is on (see previewConfig).
  useEffect(() => {
    (window as unknown as { __PREVIEW_CONFIG__?: unknown }).__PREVIEW_CONFIG__ = {
      views: previewConfig.views,
      defaultView: previewConfig.defaultView,
      widths: previewWidths,
      pages: designPages.map(({ id, route, name }) => ({ id, route, name })),
    };
  }, []);

  useEffect(() => {
    if (page === "dashboard") {
      document.title = siteConfig.projectName
        ? `${siteConfig.projectName} : ${siteConfig.clientName}`
        : siteConfig.clientName;
      return;
    }
    // Version tag is derivable from the id (v00 → "v00", v01 → "v0.1"), so the
    // title needs no data fetch.
    const isBaseV = variationId === "v00";
    const n = parseInt(variationId.replace(/\D/g, ""), 10) || 0;
    const version = isBaseV ? "v00" : `v${Math.floor(n / 10)}.${n % 10}`;
    if (page === "styleguide") {
      document.title = `${version} Styles : ${siteConfig.clientName}`;
    } else {
      document.title = isBaseV
        ? `${version} base - ${siteConfig.clientName}`
        : `${version} ${siteConfig.clientName}`;
    }
  }, [variationId, page]);

  // Load the active variation's webfonts, design tokens and globals (each overrides the
  // base copy), in the same order index.css loads the base ones.
  useEffect(() => {
    if (variationId === "v00") return;
    const own = (p: string) => p.includes(`/variations/${variationId}/`);
    const load = async (loaders: Record<string, () => Promise<unknown>>) => {
      const key = Object.keys(loaders).find(own);
      if (key) await loaders[key]();
    };
    (async () => {
      await load(variationFontLoaders);
      await load(variationTokenLoaders);
      await load(variationGlobalLoaders);
    })();
  }, [variationId]);

  // Resolve chrome/mode components for the active variation (falls back to base).
  const Brand = resolveComponent(variationId, "Brand");
  const Styles = resolveComponent(variationId, "StyleGuide");

  // The active DESIGN page (Home or any page added to the manifest), resolved
  // for this variation. Adding a row to pages.ts makes a new page render here.
  const activeDesignPage = designPages.find(p => p.id === page);
  const DesignPageComponent = activeDesignPage && activeDesignPage.component !== "__site__"
    ? resolveComponent(variationId, activeDesignPage.component)
    : null;

  // Brand Guideline projects (VITE_PROJECT_TYPE="brand") render the Brand
  // placeholder in place of the Home design preview (no device frames).
  const isBrandProject = projectType === "brand";

  // Styleguide/brand setup state is per-variation, read from the variation's own
  // variation.json (via the manifest). Base (v00) is the pristine blueprint — it
  // never shows a banner. Marking done writes the file and reloads.
  const isBase = variationId === "v00";
  const [activeVariation, setActiveVariation] = useState<Variation | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    fetchVariation(variationId).then((v) => { if (!cancelled) setActiveVariation(v); });
    return () => { cancelled = true; };
  }, [variationId]);

  const styleguideNeedsSetup = isBase
    ? false
    : activeVariation?.styleguideStatus === "needs-review";

  function markStyleguideUpdated() {
    patchVariation(variationId, { styleguideStatus: "updated" }).then(() => window.location.reload());
  }

  const brandNeedsSetup = isBase
    ? false
    : activeVariation?.brandStatus === "needs-review";

  function markBrandEstablished() {
    patchVariation(variationId, { brandStatus: "established" }).then(() => window.location.reload());
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      {page === "dashboard" && <Dashboard />}
      {page === "blockpreview" && <BlockPreview type={new URLSearchParams(window.location.search).get("blockpreview") || ""} />}
      {activeDesignPage && activeDesignPage.component === "__site__" && (
        <SitePage pageId={activeDesignPage.id} onNavigate={setPage} view={view} setView={setView} orientation={orientation} setOrientation={setOrientation} capture={captureView} />
      )}
      {DesignPageComponent && (isBrandProject
        ? <Brand onNavigate={setPage} />
        : <DesignPageComponent onNavigate={setPage} view={view} setView={setView} orientation={orientation} setOrientation={setOrientation} capture={captureView} />
      )}
      {page === "styleguide" && (
        <Styles
          onNavigate={setPage}
          variationId={variationId}
          needsSetup={styleguideNeedsSetup}
          onMarkUpdated={isBase ? undefined : markStyleguideUpdated}
          brandNeedsSetup={brandNeedsSetup}
          onMarkBrandEstablished={isBase ? undefined : markBrandEstablished}
        />
      )}
    </div>
  );
}
