// ©2026 thinkany llc. All rights reserved.
import { useState, useEffect, useCallback } from "react";
import {
  fetchVariations,
  createVariation,
  patchVariation,
  defaultVariationMeta,
  nextVariationId,
  BASE,
  type Variation,
} from "@/data/variations";
import { siteConfig } from "@/config/site";
import { getRole } from "@/data/role";
import { VariationCard } from "./VariationCard";
import { MakeVariationModal } from "./MakeVariationModal";

type Dialog =
  | { type: "remove"; variation: Variation }
  | { type: "base-guard" }
  | null;

export function Dashboard() {
  const isAdmin = getRole() === "admin";
  const [variations, setVariations] = useState<Variation[]>([BASE]);
  const [showMakeModal, setShowMakeModal] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Load the gallery from the file-based manifest (/variations.json — every on-disk
  // variation with its committed metadata) + real "Modified" dates from design-file
  // mtimes. No localStorage: identical, correct data in every browser and on Vercel.
  const refresh = useCallback(async () => {
    const vars = await fetchVariations();
    let mtimes: Record<string, string> | null = null;
    try {
      const r = await fetch("/api/variation/mtimes");
      if (r.ok) mtimes = await r.json();
    } catch {}
    setVariations(
      mtimes ? vars.map((v) => (mtimes![v.id] ? { ...v, modifiedAt: mtimes![v.id] } : v)) : vars,
    );
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  function handleRemoveClick(variation: Variation) {
    if (variation.isBase) {
      setDialog({ type: "base-guard" });
    } else {
      setDialog({ type: "remove", variation });
    }
  }

  function confirmRemove(id: string) {
    setVariations((prev) => prev.filter((v) => v.id !== id)); // optimistic hide
    patchVariation(id, { removed: true }); // files kept; the manifest excludes it
    setDialog(null);
  }

  // The modal created the variation on disk (files + variation.json); just refresh.
  function handleCreate() {
    setShowMakeModal(false);
    refresh();
  }

  // Fallback creation path for Option A (design #1 = a variation): when the only
  // thing here is base v00, spin up the first working variation in one click —
  // copies base's files and writes its variation.json (unconfigured → needs-review,
  // since setup was skipped). The primary path is /setup-styleguide. Navigates
  // straight into the new variation to start designing.
  async function handleStartDesigning() {
    if (isStarting) return;
    setIsStarting(true);
    const newId = nextVariationId(variations);
    try {
      await createVariation("v00", newId, {
        ...defaultVariationMeta(newId),
        styleguideStatus: "needs-review",
        brandStatus: "needs-review",
      });
      window.location.href = `/?v=${newId}`;
    } finally {
      setIsStarting(false);
    }
  }

  // Base v00 is the blueprint, not a design. Once any design variation exists,
  // hide the base card — the designer works in their variation(s). Base only
  // shows on its own, when setup was skipped (a bare `npm run dev`), where it
  // sits beside the "Start designing" prompt.
  const hasDesignVariation = variations.some((v) => !v.isBase);
  const visibleVariations = hasDesignVariation
    ? variations.filter((v) => !v.isBase)
    : variations;

  // Only base exists → the designer hasn't started a design yet.
  const onlyBase = variations.length === 1 && variations[0]?.isBase;

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--admin-surface)",
      fontFamily: "var(--admin-font-body)",
      fontWeight: 300,
    }}>

      {/* Sticky header */}
      <header style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "#fff",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 40px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.14em",
            color: "var(--admin-gray-light)",
            textTransform: "uppercase",
          }}>
            Designed by
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.14em",
            color: "var(--admin-gray-mid)",
            textTransform: "uppercase",
          }}>
            {siteConfig.companyName}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Sign Out clears the preview-gate cookies — only meaningful on the deployed
              (Vercel) preview where middleware.js sets them. Hidden in the app / local
              dev, where there is no gate to sign out of. */}
          {import.meta.env.PROD && (
          <button
            onClick={() => {
              document.cookie = "ta-auth=; path=/; max-age=0";
              document.cookie = "ta-role=; path=/; max-age=0";
              window.location.href = "/";
            }}
            style={{
              background: "transparent",
              border: "1px solid rgba(0,0,0,0.15)",
              borderRadius: 3,
              padding: "7px 14px",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer",
              color: "var(--admin-gray-mid)",
              fontFamily: "inherit",
            }}
          >
            Sign Out
          </button>
          )}
          {/* Brand This Project — shown only while the project is UNBRANDED (a designer
              who used "Get Designing" skipped /setup-project). Runs /setup-project in the
              app chat via the window.open("tacmd:…") → preview:open-url command bridge.
              Dev + admin only (branding is an in-app action; no chat on the Vercel deploy). */}
          {!siteConfig.isBranded && isAdmin && import.meta.env.DEV && (
          <button
            onClick={() => window.open("tacmd:/setup-project")}
            style={{
              background: "transparent",
              border: "1px solid var(--admin-accent)",
              borderRadius: 3,
              padding: "9px 18px",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer",
              color: "var(--admin-accent)",
              fontFamily: "inherit",
            }}
          >
            Brand This Project
          </button>
          )}
        {isAdmin && import.meta.env.DEV && (
          <button
            onClick={() => setShowMakeModal(true)}
            style={{
              background: "var(--admin-accent)",
              color: "#fff",
              border: "none",
              borderRadius: 3,
              padding: "9px 18px",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            + Make New Variation
          </button>
        )}
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 32px 80px" }}>

        {/* Page heading */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{
            fontFamily: "var(--admin-font-heading)",
            fontSize: 36,
            color: "var(--admin-ink)",
            margin: "0 0 8px",
            letterSpacing: "-0.02em",
          }}>
            <span style={{ fontWeight: 700 }}>
              {siteConfig.clientName}{siteConfig.projectName ? " :" : ""}
            </span>
            {siteConfig.projectName && (
              <span style={{ fontFamily: "var(--admin-font-body)", fontWeight: 300 }}>
                {" "}{siteConfig.projectName}
              </span>
            )}
          </h1>
          <p style={{ fontSize: 14, color: "var(--admin-gray-mid)", margin: 0 }}>
            {visibleVariations.length} design variation{visibleVariations.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Divider */}
        <div style={{
          borderBottom: "2px solid rgba(0,0,0,0.1)",
          marginBottom: 10,
        }} />

        {/* Start-designing prompt — only when base is the sole entry, admin, and
            in local dev (creation is a dev-server capability). The first design is
            a variation (base stays the pristine template); this is the fallback for
            designers who skipped /setup-styleguide, which normally creates it. */}
        {isAdmin && import.meta.env.DEV && onlyBase && (
          <button
            onClick={handleStartDesigning}
            disabled={isStarting}
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 4,
              padding: "20px 22px",
              marginBottom: 16,
              border: "1px dashed var(--admin-accent)",
              borderRadius: 4,
              background: "rgba(30,75,150,0.04)",
              cursor: isStarting ? "wait" : "pointer",
              fontFamily: "inherit",
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--admin-ink)" }}>
              {isStarting ? "Creating your first design…" : "▶  Start designing"}
            </span>
            <span style={{ fontSize: 12, color: "var(--admin-gray-mid)" }}>
              Creates your working copy from the base template — your design lives
              there, base stays the clean starting point.
            </span>
          </button>
        )}

        {/* Variation list — base hidden once a design variation exists. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visibleVariations.map((v) => (
            <VariationCard
              key={v.id}
              variation={v}
              isAdmin={isAdmin}
              onRemove={() => handleRemoveClick(v)}
            />
          ))}
        </div>
      </main>

      {/* Make New Variation modal */}
      {showMakeModal && (
        <MakeVariationModal
          variations={variations}
          onClose={() => setShowMakeModal(false)}
          onCreate={handleCreate}
        />
      )}

      {/* Base-guard dialog */}
      {dialog?.type === "base-guard" && (
        <Overlay onClose={() => setDialog(null)}>
          <h3 style={{ fontFamily: "var(--admin-font-heading)", fontSize: 22, fontWeight: 300, color: "var(--admin-ink)", margin: "0 0 12px" }}>
            Can't remove this one
          </h3>
          <p style={{ fontSize: 14, color: "var(--admin-gray-dark)", lineHeight: 1.65, margin: "0 0 28px" }}>
            Oh sorry! We can not remove the base variation, we need it as our foundation.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => setDialog(null)}
              style={{
                padding: "10px 22px",
                border: "none",
                borderRadius: 3,
                background: "var(--admin-accent)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
                fontWeight: 500,
              }}
            >
              Got it
            </button>
          </div>
        </Overlay>
      )}

      {/* Remove confirmation dialog */}
      {dialog?.type === "remove" && (
        <Overlay onClose={() => setDialog(null)}>
          <h3 style={{ fontFamily: "var(--admin-font-heading)", fontSize: 22, fontWeight: 300, color: "var(--admin-ink)", margin: "0 0 10px" }}>
            Remove this variation?
          </h3>
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--admin-ink)", margin: "0 0 6px" }}>
            {dialog.variation.title}
          </p>
          <p style={{ fontSize: 13, color: "var(--admin-gray-mid)", lineHeight: 1.65, margin: "0 0 28px" }}>
            This removes it from the dashboard. Files on disk are not deleted.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={() => setDialog(null)}
              style={{
                padding: "9px 18px",
                border: "1px solid rgba(0,0,0,0.18)",
                borderRadius: 3,
                background: "transparent",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => confirmRemove(dialog.variation.id)}
              style={{
                padding: "9px 18px",
                border: "none",
                borderRadius: 3,
                background: "var(--admin-danger)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
                fontWeight: 500,
              }}
            >
              Remove
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        fontFamily: "var(--admin-font-body)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff",
        borderRadius: 4,
        padding: "32px",
        maxWidth: 440,
        width: "90%",
        boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
      }}>
        {children}
      </div>
    </div>
  );
}
