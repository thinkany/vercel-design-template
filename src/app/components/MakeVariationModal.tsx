// ©2026 thinkany llc. All rights reserved.
import { useState } from "react";
import type { Variation } from "@/data/variations";
import {
  nextVariationId,
  nextVersionTag,
  formatNowDate,
  formatNowDateTime,
} from "@/data/variations";

const SRC_THUMB_W = 80;
const SRC_THUMB_H = Math.round(SRC_THUMB_W * 9 / 16); // 45
const SRC_SCALE = SRC_THUMB_W / 1280;

interface Props {
  variations: Variation[];
  onClose: () => void;
  onCreate: (variation: Variation) => void;
}

export function MakeVariationModal({ variations, onClose, onCreate }: Props) {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [needsStyleguide, setNeedsStyleguide] = useState(false);

  const newId = nextVariationId(variations);
  const newVersion = nextVersionTag(variations);
  const canCreate = selectedSource !== null && title.trim().length > 0;

  async function handleCreate() {
    if (!canCreate || isCreating) return;
    setIsCreating(true);
    setApiError(null);

    // Attempt dev-mode file copy; non-fatal if unavailable
    try {
      const res = await fetch("/api/variation/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: selectedSource, targetId: newId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.warn("Variation file copy failed:", data.error);
      }
    } catch {
      console.warn("Variation file copy API not reachable — skipping.");
    }

    const newVariation: Variation = {
      id: newId,
      version: newVersion,
      title: title.trim(),
      description: description.trim(),
      createdAt: formatNowDate(),
      modifiedAt: formatNowDateTime(),
      isBase: false,
      styleguideStatus: needsStyleguide ? "needs-review" : "updated",
      // A new variation inherits the source palette; flag it for review so its
      // Colors read as inherited/default until its own brand is established.
      brandStatus: needsStyleguide ? "needs-review" : "established",
    };

    setIsCreating(false);
    onCreate(newVariation);
  }

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
        width: "90%",
        maxWidth: 540,
        maxHeight: "88vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
      }}>
        {/* Header */}
        <div style={{
          padding: "24px 28px 18px",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.15em",
              color: "var(--admin-gray-mid)",
              textTransform: "uppercase",
              marginBottom: 6,
            }}>
              New Variation — {newVersion}
            </div>
            <h2 style={{
              fontFamily: "var(--admin-font-heading)",
              fontSize: 22,
              fontWeight: 300,
              color: "var(--admin-ink)",
              margin: 0,
              letterSpacing: "-0.01em",
            }}>
              Make New Variation
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--admin-gray-mid)",
              fontSize: 22,
              lineHeight: 1,
              padding: "2px 4px",
              marginTop: -2,
            }}
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>

          {/* Source selection */}
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.14em",
              color: "var(--admin-gray-mid)",
              textTransform: "uppercase",
              marginBottom: 12,
            }}>
              Duplicate from
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {variations.map((v) => {
                const selected = selectedSource === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedSource(v.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "10px 14px",
                      border: selected
                        ? "2px solid var(--admin-blue)"
                        : "1px solid rgba(0,0,0,0.12)",
                      borderRadius: 3,
                      background: selected ? "rgba(30,75,150,0.04)" : "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                      fontFamily: "inherit",
                    }}
                  >
                    {/* Mini thumbnail */}
                    <div style={{
                      width: SRC_THUMB_W,
                      height: SRC_THUMB_H,
                      overflow: "hidden",
                      borderRadius: 2,
                      position: "relative",
                      background: "#e8e6e0",
                      flexShrink: 0,
                    }}>
                      <iframe
                        src={`/?v=${v.id}`}
                        loading="lazy"
                        style={{
                          width: 1280,
                          height: 720,
                          transform: `scale(${SRC_SCALE})`,
                          transformOrigin: "top left",
                          border: "none",
                          pointerEvents: "none",
                        }}
                        title={v.title}
                      />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{
                          display: "inline-block",
                          padding: "1px 6px",
                          background: "var(--admin-blue)",
                          color: "#fff",
                          fontSize: 9,
                          fontWeight: 500,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          borderRadius: 2,
                        }}>
                          {v.version}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--admin-ink)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {v.title}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--admin-gray-mid)" }}>
                        Modified {v.modifiedAt}
                      </div>
                    </div>

                    {/* Radio */}
                    <div style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      border: `2px solid ${selected ? "var(--admin-blue)" : "rgba(0,0,0,0.2)"}`,
                      background: selected ? "var(--admin-blue)" : "transparent",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      {selected && (
                        <div style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#fff",
                        }} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ height: 1, background: "rgba(0,0,0,0.08)", marginBottom: 24 }} />

          {/* Name & description */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={{
                display: "block",
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.14em",
                color: "var(--admin-gray-mid)",
                textTransform: "uppercase",
                marginBottom: 8,
              }}>
                Variation Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Variation ${String(variations.length).padStart(2, "0")}`}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid rgba(0,0,0,0.18)",
                  borderRadius: 3,
                  fontSize: 14,
                  fontFamily: "inherit",
                  outline: "none",
                  color: "var(--admin-ink)",
                  background: "#fff",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{
                display: "block",
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.14em",
                color: "var(--admin-gray-mid)",
                textTransform: "uppercase",
                marginBottom: 8,
              }}>
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what's different about this variation…"
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid rgba(0,0,0,0.18)",
                  borderRadius: 3,
                  fontSize: 13,
                  fontFamily: "inherit",
                  outline: "none",
                  color: "var(--admin-ink)",
                  background: "#fff",
                  resize: "vertical",
                  lineHeight: 1.6,
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Styleguide prompt */}
          <div style={{ marginTop: 20, padding: "14px 16px", background: "rgba(30,75,150,0.04)", border: "1px solid rgba(30,75,150,0.12)", borderRadius: 4 }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={needsStyleguide}
                onChange={(e) => setNeedsStyleguide(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: "var(--admin-blue)", cursor: "pointer", flexShrink: 0 }}
              />
              <span>
                <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--admin-ink)", marginBottom: 3 }}>
                  This variation needs its own styleguide changes
                </span>
                <span style={{ display: "block", fontSize: 12, color: "var(--admin-gray-mid)", lineHeight: 1.5 }}>
                  The source styleguide is copied either way. Check this to flag the copy for review — its styleguide will show a setup reminder until you mark it updated.
                </span>
              </span>
            </label>
          </div>

          {apiError && (
            <p style={{ fontSize: 12, color: "var(--admin-red)", marginTop: 12 }}>
              {apiError}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 28px",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          display: "flex",
          gap: 10,
          justifyContent: "flex-end",
        }}>
          <button
            onClick={onClose}
            style={{
              padding: "9px 18px",
              border: "1px solid rgba(0,0,0,0.18)",
              borderRadius: 3,
              background: "transparent",
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
              letterSpacing: "0.08em",
              color: "var(--admin-gray-dark)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate || isCreating}
            style={{
              padding: "9px 20px",
              border: "none",
              borderRadius: 3,
              background: canCreate ? "var(--admin-blue)" : "var(--admin-gray-light)",
              color: "#fff",
              cursor: canCreate ? "pointer" : "not-allowed",
              fontSize: 12,
              fontFamily: "inherit",
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              transition: "background 0.15s",
            }}
          >
            {isCreating ? "Creating…" : "Create Variation"}
          </button>
        </div>
      </div>
    </div>
  );
}
