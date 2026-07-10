// ©2026 thinkany llc. All rights reserved.
import { useState, useEffect } from "react";

import { resolveComponent } from "./variationRegistry";
import { loadVariations, saveVariations } from "../data/variations";
import { siteConfig, styleguideReady, brandReady } from "../config/site";

import { Dashboard } from "./components/Dashboard";

function getInitialPage(): string {
  const params = new URLSearchParams(window.location.search);
  if (params.has("styleguide")) return "styleguide";
  if (params.has("v")) return "home";
  return "dashboard";
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
  const [view, setView] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const variationId = getVariationId();

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

  // Resolve page components for the active variation (falls back to base v00).
  const Home = resolveComponent(variationId, "Home");
  const Styles = resolveComponent(variationId, "StyleGuide");

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
      {page === "home" && <Home onNavigate={setPage} view={view} setView={setView} orientation={orientation} setOrientation={setOrientation} />}
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
