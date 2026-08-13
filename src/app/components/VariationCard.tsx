// ©2026 thinkany llc. All rights reserved.
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Variation } from "@/data/variations";
import { getVariationUrl, getStylesUrl } from "@/data/variations";
import { resolveBrand } from "@/app/brandRegistry";

interface Props {
  variation: Variation;
  isAdmin: boolean;
  onRemove: () => void;
}

export function VariationCard({ variation, isAdmin, onRemove }: Props) {
  const siteUrl = getVariationUrl(variation);
  const stylesUrl = getStylesUrl(variation);
  // Option B: the setup nudge persists until BOTH the styleguide (fonts/sections)
  // and the brand palette are done for THIS variation — because /setup-styleguide
  // configures both. It reads the same flags on the same record the styleguide
  // banner does, so marking either done in the styleguide clears it from here too;
  // it fully disappears once both are resolved. Never shown on base (v00).
  const needsSetup =
    !variation.isBase &&
    (variation.styleguideStatus === "needs-review" ||
      variation.brandStatus === "needs-review");
  const [hoveringView, setHoveringView] = useState(false);
  const [hoveringThumb, setHoveringThumb] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLAnchorElement>(null);
  const [briefOpen, setBriefOpen] = useState(false);

  // The design's identity for the brief modal. Colors come live from the variation's
  // brand manifest (exact hexes); the primary FONT family isn't in the manifest (only a
  // CSS-var ref), so it reads the captured `primaryFont`, falling back to the role name.
  const brand = resolveBrand(variation.id);
  const swatches = brand.paletteGroups.flatMap((g) => g.colors);
  const primarySwatch = swatches.find((c) => c.token === "--ta-primary") || swatches[0];
  const primaryColor = variation.primaryColor || primarySwatch?.value || "";
  const primaryColorName = primarySwatch?.name || "Primary";
  const primaryFont = variation.primaryFont || brand.fonts[0]?.name || "";
  const hasBriefCard = !!(variation.brief || primaryColor || primaryFont);

  useEffect(() => {
    if (!briefOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setBriefOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [briefOpen]);

  function handleMouseEnter() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setTooltipPos({ top: r.top - 8, right: window.innerWidth - r.right });
    }
    setHoveringView(true);
  }

  return (
    <>
    <div style={{
      display: "flex",
      alignItems: "stretch",
      background: "#fff",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 3,
      overflow: "hidden",
    }}>
      {/* Thumbnail zone */}
      <div style={{
        width: 260,
        minWidth: 260,
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
        background: "#fff",
        borderRight: "1px solid rgba(0,0,0,0.06)",
      }}>
        {/* Thumbnail — the live design behind the version badge. A static
            `screenshot` wins if one was ever set; otherwise a scaled, live capture
            of the design itself (same approach as the Make-Variation modal, using
            the bare `&capture` route so there's no ViewToggle chrome). */}
        <a
          href={siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={() => setHoveringThumb(true)}
          onMouseLeave={() => setHoveringThumb(false)}
          style={{
            position: "absolute",
            inset: 0,
            display: "block",
            overflow: "hidden",
            textDecoration: "none",
            cursor: "pointer",
            zIndex: 1,
          }}
        >
          {variation.screenshot ? (
            <img
              src={variation.screenshot}
              alt={`Preview: ${variation.title}`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top center",
                display: "block",
                opacity: hoveringThumb ? 0.7 : 0.42,
                transition: "opacity 0.18s ease",
              }}
            />
          ) : (
            <iframe
              src={`/?v=${variation.id}&capture=desktop`}
              loading="lazy"
              tabIndex={-1}
              aria-hidden="true"
              title=""
              style={{
                width: 1280,
                height: 900,
                transform: `scale(${260 / 1280})`,
                transformOrigin: "top left",
                border: "none",
                pointerEvents: "none",
                opacity: hoveringThumb ? 0.7 : 0.42,
                transition: "opacity 0.18s ease",
              }}
            />
          )}
        </a>

        {/* Gradient scrim — full zone */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.3) 100%)",
          pointerEvents: "none",
          zIndex: 2,
        }} />

        {/* Version badge — centered in zone */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 10,
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          // Softly clear the number circle on hover so the live screenshot behind it
          // reads unobstructed; it eases back in when the pointer leaves.
          opacity: hoveringThumb ? 0 : 0.76,
          transition: "opacity 0.4s ease",
        }}>
          <span style={{
            fontFamily: "var(--admin-font-heading)",
            fontStyle: "italic",
            fontSize: 45,
            fontWeight: 700,
            color: "#fff",
            lineHeight: 1,
            letterSpacing: "-0.02em",
            textShadow: "0 2px 8px rgba(0,0,0,0.55)",
          }}>
            {variation.version.replace(/^v/, "")}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        padding: "22px 28px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 0,
      }}>
        {/* Eyebrow row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {/* Version — outlined gray (the variant number) */}
          <span style={{
            display: "inline-block",
            padding: "2px 8px",
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            border: "1px solid rgba(0,0,0,0.15)",
            borderRadius: 2,
            color: "var(--admin-gray-mid)",
            fontFamily: "var(--admin-font-body)",
          }}>
            {variation.version}
          </span>
          {/* 3. Base — outlined gray, v1.2 only */}
          {variation.isBase && (
            <span style={{
              display: "inline-block",
              padding: "2px 8px",
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              border: "1px solid rgba(0,0,0,0.15)",
              borderRadius: 2,
              color: "var(--admin-gray-mid)",
              fontFamily: "var(--admin-font-body)",
            }}>
              Base
            </span>
          )}
        </div>

        {/* Title */}
        <h2 style={{
          fontFamily: "var(--admin-font-heading)",
          fontSize: 20,
          fontWeight: 700,
          fontStyle: "italic",
          color: "var(--admin-ink)",
          margin: 0,
          lineHeight: 1.25,
          letterSpacing: "-0.01em",
        }}>
          {variation.title}
        </h2>

        {/* Description */}
        <p style={{
          fontSize: 15,
          color: "var(--admin-gray-dark)",
          lineHeight: 1.65,
          margin: 0,
        }}>
          {variation.description}
        </p>

        {/* Brief & palette — opens a modal (moved off the card so the thumbnail fills the
            zone instead of leaving dead space below a fixed-height frame). */}
        {hasBriefCard && (
          <button
            onClick={() => setBriefOpen(true)}
            style={{
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              margin: "2px 0",
              padding: "6px 12px 6px 8px",
              background: "transparent",
              border: "1px solid rgba(0,0,0,0.14)",
              borderRadius: 999,
              cursor: "pointer",
              fontFamily: "var(--admin-font-body)",
              fontSize: 12,
              color: "var(--admin-gray-dark)",
            }}
          >
            {primaryColor && (
              <span style={{ width: 12, height: 12, borderRadius: 3, background: primaryColor, border: "1px solid rgba(0,0,0,0.14)" }} />
            )}
            {variation.brief ? "Brief & palette" : "Palette & type"}
          </button>
        )}

        {/* Styleguide setup nudge — same amber language as the styleguide's own
            banner, so the two surfaces read as one state. Persists until this
            variation's fonts AND palette are configured (Option B). */}
        {needsSetup && (
          <div style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            background: "#fef3c7",
            border: "1px solid #f0d488",
            borderRadius: 3,
            padding: "9px 12px",
            fontFamily: "var(--admin-font-body)",
            fontSize: 12.5,
            color: "#663d00",
            lineHeight: 1.5,
          }}>
            <span style={{ fontSize: 13, lineHeight: 1.3 }}>⚙</span>
            <span>
              Styleguide not configured yet — run{" "}
              <code style={{ background: "rgba(0,0,0,0.06)", padding: "1px 5px", borderRadius: 3, fontFamily: "ui-monospace, monospace", fontSize: 11.5 }}>/setup-styleguide</code>{" "}
              for <strong style={{ fontWeight: 600 }}>{variation.version}</strong> to set its fonts &amp; colors, then mark it done on its <a href={stylesUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#663d00", textDecoration: "underline", textUnderlineOffset: 2 }}>styleguide</a>.
            </span>
          </div>
        )}

        {/* Dates */}
        <div style={{
          marginTop: "auto",
          paddingTop: 14,
          display: "flex",
          gap: 28,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", color: "var(--admin-gray-mid)", textTransform: "uppercase", marginBottom: 3, fontFamily: "var(--admin-font-body)" }}>
              Created
            </div>
            <div style={{ fontSize: 12, color: "var(--admin-gray-dark)", fontFamily: "var(--admin-font-body)" }}>
              {variation.createdAt}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", color: "var(--admin-gray-mid)", textTransform: "uppercase", marginBottom: 3, fontFamily: "var(--admin-font-body)" }}>
              Modified
            </div>
            <div style={{ fontSize: 12, color: "var(--admin-gray-dark)", fontFamily: "var(--admin-font-body)" }}>
              {variation.modifiedAt}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "22px 24px",
        minWidth: 196,
        flexShrink: 0,
        borderLeft: "1px solid rgba(0,0,0,0.06)",
      }}>
        {/* View button */}
        <div style={{ display: "block", width: "100%" }}>
          {hoveringView && createPortal(
            <div style={{
              position: "fixed",
              top: tooltipPos.top,
              right: tooltipPos.right,
              transform: "translateY(-100%) translateY(-6px)",
              background: "var(--admin-ink)",
              color: "#fff",
              fontSize: 11,
              lineHeight: 1.4,
              padding: "6px 10px",
              borderRadius: 3,
              whiteSpace: "nowrap",
              fontFamily: "var(--admin-font-body)",
              pointerEvents: "none",
              zIndex: 9999,
            }}>
              Variation opens in a new browser tab.
              <div style={{
                position: "absolute",
                top: "100%",
                right: 14,
                width: 0,
                height: 0,
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: "5px solid var(--admin-ink)",
              }} />
            </div>,
            document.body
          )}
          <a
            ref={btnRef}
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setHoveringView(false)}
            style={{
              display: "block",
              width: "100%",
              boxSizing: "border-box",
              textAlign: "center",
              padding: "9px 20px",
              background: "var(--admin-accent)",
              color: "#fff",
              border: "1px solid var(--admin-accent)",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              textDecoration: "none",
              whiteSpace: "nowrap",
              fontFamily: "var(--admin-font-body)",
            }}
          >
            View Design ↗
          </a>
        </div>

        {/* View Site Styles */}
        <a
          href={stylesUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            width: "100%",
            boxSizing: "border-box",
            textAlign: "center",
            padding: "9px 20px",
            background: "transparent",
            color: "var(--admin-accent)",
            border: "1px solid var(--admin-accent)",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            textDecoration: "none",
            whiteSpace: "nowrap",
            fontFamily: "var(--admin-font-body)",
          }}
        >
          Styleguide ↗
        </a>

        {/* Remove — admin only, not on base, and only during local design (dev).
            Removal is a dev-server capability; the hosted/published preview is
            read-only, so the control is hidden there. */}
        {isAdmin && !variation.isBase && import.meta.env.DEV && (
          <button
            onClick={onRemove}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--admin-gray-mid)",
              fontSize: 11,
              letterSpacing: "0.08em",
              cursor: "pointer",
              padding: "4px 0",
              fontFamily: "var(--admin-font-body)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Remove
          </button>
        )}
      </div>
    </div>

    {/* Brief modal — the design's brief + captured palette & type, on demand. */}
    {briefOpen && createPortal(
      <div
        onClick={() => setBriefOpen(false)}
        style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(16,16,22,0.62)", padding: 40 }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ background: "#fff", borderRadius: 8, width: "min(480px, 92vw)", maxHeight: "84vh", overflowY: "auto", padding: "22px 24px 24px", boxShadow: "0 18px 60px rgba(0,0,0,0.4)", cursor: "default" }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: "var(--admin-font-heading)", fontStyle: "italic", fontSize: 18, fontWeight: 700, color: "var(--admin-ink)", lineHeight: 1.2 }}>{variation.title}</div>
              <div style={{ fontFamily: "var(--admin-font-body)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--admin-gray-mid)", marginTop: 3 }}>{variation.version}</div>
            </div>
            <button onClick={() => setBriefOpen(false)} aria-label="Close" style={{ flex: "0 0 auto", width: 28, height: 28, border: "none", borderRadius: 999, background: "#f2f2f5", color: "#666", fontSize: 14, cursor: "pointer" }}>✕</button>
          </div>

          {variation.brief && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "var(--admin-font-body)", fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--admin-gray-mid)", marginBottom: 6 }}>Original brief</div>
              <p style={{ fontFamily: "var(--admin-font-body)", fontStyle: "italic", fontSize: 14, lineHeight: 1.6, color: "var(--admin-gray-dark)", margin: 0 }}>“{variation.brief}”</p>
            </div>
          )}

          {primaryColor && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "var(--admin-font-body)", fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--admin-gray-mid)", marginBottom: 8 }}>Palette</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: 6, background: primaryColor, border: "1px solid rgba(0,0,0,0.12)", flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: "var(--admin-font-body)", fontSize: 13, color: "var(--admin-ink)", fontWeight: 600 }}>{primaryColorName}</div>
                  <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "var(--admin-gray-mid)" }}>{primaryColor}</div>
                </div>
              </div>
              {swatches.length > 1 && (
                <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                  {swatches.map((c) => (
                    <span key={c.token} title={`${c.name} · ${c.value}`} style={{ width: 22, height: 22, borderRadius: 4, background: c.value, border: "1px solid rgba(0,0,0,0.12)" }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {primaryFont && (
            <div>
              <div style={{ fontFamily: "var(--admin-font-body)", fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--admin-gray-mid)", marginBottom: 6 }}>Type</div>
              <div style={{ fontSize: 24, lineHeight: 1.2, color: "var(--admin-ink)", fontFamily: variation.primaryFont ? `'${variation.primaryFont}', Georgia, serif` : "var(--admin-font-heading)" }}>{primaryFont}</div>
              <div style={{ fontFamily: "var(--admin-font-body)", fontSize: 12, color: "var(--admin-gray-mid)", marginTop: 2 }}>Primary typeface</div>
            </div>
          )}
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
