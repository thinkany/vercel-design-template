// ©2004-2026 Deep Focus Review. All rights reserved.
import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import type { Variation } from "@/data/variations";
import { getVariationUrl, getStylesUrl } from "@/data/variations";

interface Props {
  variation: Variation;
  isAdmin: boolean;
  onRemove: () => void;
}

export function VariationCard({ variation, isAdmin, onRemove }: Props) {
  const siteUrl = getVariationUrl(variation);
  const stylesUrl = getStylesUrl(variation);
  const [hoveringView, setHoveringView] = useState(false);
  const [hoveringThumb, setHoveringThumb] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLAnchorElement>(null);

  function handleMouseEnter() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setTooltipPos({ top: r.top - 8, right: window.innerWidth - r.right });
    }
    setHoveringView(true);
  }

  return (
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
        {/* Thumbnail */}
        {variation.screenshot && (
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
            <img
              src={variation.screenshot}
              alt={`Preview: ${variation.title}`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top center",
                display: "block",
                opacity: hoveringThumb ? 0.54 : 0.24,
                transition: "opacity 0.18s ease",
              }}
            />
          </a>
        )}

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
          background: "linear-gradient(to top, rgba(30,75,150,0.88) 0%, rgba(30,75,150,0.28) 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          opacity: hoveringThumb ? 1 : 0.76,
          transition: "opacity 0.18s ease",
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
          {/* 1. Label — filled blue */}
          <span style={{
            display: "inline-block",
            padding: "2px 8px",
            background: "var(--admin-blue)",
            color: "#fff",
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            borderRadius: 2,
            fontFamily: "var(--admin-font-body)",
          }}>
            {variation.label ?? (variation.isBase ? "Original" : "Client Edits")}
          </span>
          {/* 2. Version — outlined gray */}
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
              background: "var(--admin-blue)",
              color: "#fff",
              border: "1px solid var(--admin-blue)",
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
            color: "var(--admin-blue)",
            border: "1px solid var(--admin-blue)",
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

        {/* Remove — admin only, not on base */}
        {isAdmin && !variation.isBase && (
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
  );
}
