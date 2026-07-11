// ©2026 thinkany llc. All rights reserved.
import { useState, useEffect } from "react";

import { resolveComponent } from "./variationRegistry";
import { loadVariations, saveVariations } from "../data/variations";
import { siteConfig, styleguideReady, brandReady, previewConfig, previewWidths, projectType } from "../config/site";
import type { View } from "../config/site";

import { Dashboard } from "./components/Dashboard";
import { designPages, defaultDesignPageId } from "./pages";

function getInitialPage(): string {
  const params = new URLSearchParams(window.location.search);
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
    const variation = loadVariations().find(v => v.id === variationId);
    if (variation) {
      if (page === "styleguide") {
        document.title = `${variation.version} Styles : ${siteConfig.clientName}`;
      } else {
        document.title = variation.isBase
          ? `${variation.version} base - ${siteConfig.clientName}`
          : `${variation.version} ${siteConfig.clientName}`;
      }
    }
  }, [variationId, page]);

  // Load the active variation's design tokens (overrides the base tokens).
  useEffect(() => {
    if (variationId === "v00") return;
    const key = Object.keys(variationTokenLoaders).find(p =>
      p.includes(`/variations/${variationId}/`),
    );
    if (key) variationTokenLoaders[key]();
  }, [variationId]);

  // Resolve chrome/mode components for the active variation (falls back to base).
  const Brand = resolveComponent(variationId, "Brand");
  const Styles = resolveComponent(variationId, "StyleGuide");

  // The active DESIGN page (Home or any page added to the manifest), resolved
  // for this variation. Adding a row to pages.ts makes a new page render here.
  const activeDesignPage = designPages.find(p => p.id === page);
  const DesignPageComponent = activeDesignPage
    ? resolveComponent(variationId, activeDesignPage.component)
    : null;

  // Brand Guideline projects (VITE_PROJECT_TYPE="brand") render the Brand
  // placeholder in place of the Home design preview (no device frames).
  const isBrandProject = projectType === "brand";

  // Per-variation styleguide setup state. The base (v00) uses the committed
  // VITE_STYLEGUIDE_READY flag; variations carry their own styleguideStatus.
  const isBase = variationId === "v00";
  const activeVariation = loadVariations().find(v => v.id === variationId);
  const styleguideNeedsSetup = isBase
    ? !styleguideReady
    : activeVariation?.styleguideStatus === "needs-review";

  function markStyleguideUpdated() {
    const updated = loadVariations().map(v =>
      v.id === variationId ? { ...v, styleguideStatus: "updated" as const } : v,
    );
    saveVariations(updated);
    window.location.reload();
  }

  // Per-variation brand-palette state. Base (v00) uses the committed
  // VITE_BRAND_READY flag; variations carry their own brandStatus.
  const brandNeedsSetup = isBase
    ? !brandReady
    : activeVariation?.brandStatus === "needs-review";

  function markBrandEstablished() {
    const updated = loadVariations().map(v =>
      v.id === variationId ? { ...v, brandStatus: "established" as const } : v,
    );
    saveVariations(updated);
    window.location.reload();
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      {page === "dashboard" && <Dashboard />}
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
