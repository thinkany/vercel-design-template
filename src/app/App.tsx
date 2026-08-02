// ©2026 thinkany llc. All rights reserved.
import { useState, useEffect } from "react";

import { resolveComponent } from "./variationRegistry";
import { fetchVariation, patchVariation, type Variation } from "../data/variations";
import { siteConfig, previewConfig, previewWidths, projectType } from "../config/site";
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
