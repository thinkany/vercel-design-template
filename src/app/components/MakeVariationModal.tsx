// ©2026 thinkany llc. All rights reserved.
import { useState } from "react";
import type { Variation } from "@/data/variations";
import {
  nextVariationId,
  nextVersionTag,
  createVariation,
  defaultVariationMeta,
} from "@/data/variations";
import { copy } from "@/copy";

const SRC_THUMB_W = 80;
const SRC_THUMB_H = Math.round(SRC_THUMB_W * 9 / 16); // 45
const SRC_SCALE = SRC_THUMB_W / 1280;

interface Props {
  variations: Variation[];
  onClose: () => void;
  onCreate: () => void;
}

export function MakeVariationModal({ variations, onClose, onCreate }: Props) {
  const newId = nextVariationId(variations);
  const newVersion = nextVersionTag(variations);

  // Seed the form from the most recent variation ("prior"): its title and
  // description carried forward with the new version tag, so new variations stay
  // consistently named and the user starts from direction instead of a blank
  // form. The prior is also pre-selected as the duplication source.
  const prior = variations[variations.length - 1];
  const suggestTitle = (v: Variation) => `${v.title} ${newVersion}`;
  const suggestDescription = (v: Variation) =>
    v.description ? `${v.description} ${newVersion}` : "";

  const [selectedSource, setSelectedSource] = useState<string | null>(prior?.id ?? null);
  const [title, setTitle] = useState(prior ? suggestTitle(prior) : "");
  const [description, setDescription] = useState(prior ? suggestDescription(prior) : "");
  // Once the user edits a field, stop auto-syncing it from the source selection.
  const [titleDirty, setTitleDirty] = useState(false);
  const [descDirty, setDescDirty] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [needsStyleguide, setNeedsStyleguide] = useState(false);

  const canCreate = selectedSource !== null && title.trim().length > 0;

  // Pick a duplication source; keep any not-yet-edited field in sync with it so
  // the suggestion always reflects what's actually being copied.
  function selectSource(v: Variation) {
    setSelectedSource(v.id);
    if (!titleDirty) setTitle(suggestTitle(v));
    if (!descDirty) setDescription(suggestDescription(v));
  }

  async function handleCreate() {
    if (!canCreate || isCreating) return;
    setIsCreating(true);
    setApiError(null);

    // Create on disk: copy the source files + write the variation.json (its single
    // source of truth). A duplicate inherits the source palette; flag it for review
    // only if the designer said it needs its own styleguide.
    try {
      await createVariation(selectedSource!, newId, {
        ...defaultVariationMeta(newId),
        title: title.trim(),
        description: description.trim(),
        styleguideStatus: needsStyleguide ? "needs-review" : "updated",
        brandStatus: needsStyleguide ? "needs-review" : "established",
      });
    } catch {
      setApiError(copy.makeVariation.error);
      setIsCreating(false);
      return;
    }

    setIsCreating(false);
    onCreate();
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
              {copy.makeVariation.eyebrow(newVersion)}
            </div>
            <h2 style={{
              fontFamily: "var(--admin-font-heading)",
              fontSize: 22,
              fontWeight: 300,
              color: "var(--admin-ink)",
              margin: 0,
              letterSpacing: "-0.01em",
            }}>
              {copy.makeVariation.title}
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
              {copy.makeVariation.duplicateFrom}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {variations.map((v) => {
                const selected = selectedSource === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => selectSource(v)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "10px 14px",
                      border: selected
                        ? "2px solid var(--admin-accent)"
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
                          background: "var(--admin-accent)",
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
                        {copy.makeVariation.modifiedPrefix(v.modifiedAt)}
                      </div>
                    </div>

                    {/* Radio */}
                    <div style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      border: `2px solid ${selected ? "var(--admin-accent)" : "rgba(0,0,0,0.2)"}`,
                      background: selected ? "var(--admin-accent)" : "transparent",
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
                {copy.makeVariation.titleLabel}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setTitleDirty(true); }}
                placeholder={copy.makeVariation.titlePlaceholder(String(variations.length).padStart(2, "0"))}
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
                {copy.makeVariation.descriptionLabel}
              </label>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); setDescDirty(true); }}
                placeholder={copy.makeVariation.descriptionPlaceholder}
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
                style={{ marginTop: 2, width: 16, height: 16, accentColor: "var(--admin-accent)", cursor: "pointer", flexShrink: 0 }}
              />
              <span>
                <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--admin-ink)", marginBottom: 3 }}>
                  {copy.makeVariation.needsStyleguideTitle}
                </span>
                <span style={{ display: "block", fontSize: 12, color: "var(--admin-gray-mid)", lineHeight: 1.5 }}>
                  {copy.makeVariation.needsStyleguideHint}
                </span>
              </span>
            </label>
          </div>

          {apiError && (
            <p style={{ fontSize: 12, color: "var(--admin-danger)", marginTop: 12 }}>
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
            {copy.makeVariation.cancel}
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate || isCreating}
            style={{
              padding: "9px 20px",
              border: "none",
              borderRadius: 3,
              background: canCreate ? "var(--admin-accent)" : "var(--admin-gray-light)",
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
            {isCreating ? copy.makeVariation.creating : copy.makeVariation.create}
          </button>
        </div>
      </div>
    </div>
  );
}
