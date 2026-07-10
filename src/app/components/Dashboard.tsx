// ©2026 thinkany llc. All rights reserved.
import { useState } from "react";
import { loadVariations, saveVariations, type Variation } from "@/data/variations";
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
  const [variations, setVariations] = useState<Variation[]>(() => loadVariations());
  const [showMakeModal, setShowMakeModal] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);

  function handleRemoveClick(variation: Variation) {
    if (variation.isBase) {
      setDialog({ type: "base-guard" });
    } else {
      setDialog({ type: "remove", variation });
    }
  }

  function confirmRemove(id: string) {
    const updated = variations.filter((v) => v.id !== id);
    setVariations(updated);
    saveVariations(updated);
    setDialog(null);
  }

  function handleCreate(newVariation: Variation) {
    const updated = [...variations, newVariation];
    setVariations(updated);
    saveVariations(updated);
    setShowMakeModal(false);
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--admin-cream)",
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.16em",
            color: "var(--admin-gray-mid)",
            textTransform: "uppercase",
          }}>
            {siteConfig.companyName}
          </span>
          {siteConfig.projectName && (
            <>
              <span style={{ color: "var(--admin-gray-light)", fontSize: 16 }}>·</span>
              <span style={{
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.14em",
                color: "var(--admin-gray-mid)",
                textTransform: "uppercase",
              }}>
                {siteConfig.projectName}
              </span>
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
        {isAdmin && (
          <button
            onClick={() => setShowMakeModal(true)}
            style={{
              background: "var(--admin-blue)",
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
            {variations.length} design variation{variations.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Divider */}
        <div style={{
          borderBottom: "2px solid rgba(0,0,0,0.1)",
          marginBottom: 10,
        }} />

        {/* Variation list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {variations.map((v) => (
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
                background: "var(--admin-blue)",
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
                background: "var(--admin-red)",
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
