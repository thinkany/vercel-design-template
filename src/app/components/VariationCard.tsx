// ©2026 thinkany llc. All rights reserved.
import { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Variation } from "@/data/variations";
import { getVariationUrl, getStylesUrl } from "@/data/variations";
import { resolveBrand } from "@/app/brandRegistry";
import { copy } from "@/copy";

// The `brief` field can hold the assembled Get-Designing prompt: a freeform lead
// sentence followed by ". Label: value" (and a few colon-less "Model … / Colors from
// … / Fonts …") segments. Split it into a lead quote + a tidy labeled list so the
// modal reads like the walkthrough's brief rail instead of one run-on paragraph. A
// plain chat-authored brief (no labels) just becomes the lead quote — backward safe.
const BRIEF_LABELS = [
  "Project type", "Client / company", "Project name",
  "Model the structure and feel on", "Colors from", "Fonts",
  "Include these sections", "Audience", "Tone", "Devices", "Also",
];
function parseBrief(raw: string): { lead: string; rows: { label: string; value: string }[] } {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const boundary = new RegExp(`\\.\\s+(?=(?:${BRIEF_LABELS.map(esc).join("|")})\\b)`);
  const parts = raw.split(boundary).map((s) => s.trim().replace(/\.\s*$/, "")).filter(Boolean);
  let lead = "";
  const rows: { label: string; value: string }[] = [];
  for (const p of parts) {
    const colon = p.match(/^([^:]+):\s*(.+)$/s);
    if (colon && BRIEF_LABELS.includes(colon[1].trim())) {
      rows.push({ label: colon[1].trim(), value: colon[2].trim() });
      continue;
    }
    const prose = p.match(/^(Model the structure and feel on|Colors from|Fonts)\s+(.+)$/s);
    if (prose) {
      const label = prose[1] === "Model the structure and feel on" ? "Model on" : prose[1];
      rows.push({ label, value: prose[2].trim() });
      continue;
    }
    if (!lead) lead = p; else rows.push({ label: "", value: p });
  }
  return { lead, rows };
}

// A brief-row value may contain hex colors (e.g. the "Colors from" row). Render each
// hex with a small circle swatch for reference; everything else stays plain text.
function renderBriefValue(value: string): ReactNode {
  const HEX = /#[0-9a-fA-F]{3,8}\b/g;
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = HEX.exec(value)) !== null) {
    if (m.index > last) parts.push(value.slice(last, m.index));
    const hex = m[0];
    parts.push(
      <span key={m.index} style={{ display: "inline-flex", alignItems: "center", gap: 5, verticalAlign: "middle" }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: hex, border: "1px solid rgba(0,0,0,0.15)", display: "inline-block" }} />
        {hex}
      </span>
    );
    last = m.index + hex.length;
  }
  if (parts.length === 0) return value; // no hex → plain text
  if (last < value.length) parts.push(value.slice(last));
  return parts;
}

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

  // Design-variety is a licensed add-on; the Electron shell injects `__taVarietyLicensed`
  // (and a `ta-variety-licensed` event) so the reroll control only appears when licensed
  // and running inside the app. Outside the app the flag is absent → the control stays hidden.
  const [varietyOn, setVarietyOn] = useState(
    typeof window !== "undefined" && !!(window as unknown as { __taVarietyLicensed?: boolean }).__taVarietyLicensed,
  );
  useEffect(() => {
    const on = (e: Event) => setVarietyOn(!!(e as CustomEvent).detail);
    window.addEventListener("ta-variety-licensed", on);
    if ((window as unknown as { __taVarietyLicensed?: boolean }).__taVarietyLicensed) setVarietyOn(true);
    return () => window.removeEventListener("ta-variety-licensed", on);
  }, []);

  // The thumbnail zone stretches to the card's full height (flex align-stretch),
  // so a fixed fit-width scale on the live-capture iframe leaves empty space below
  // it. Measure the zone and scale the iframe to COVER that height (top-anchored,
  // matching the static-screenshot path's object-position). Width overflow is
  // cropped by the zone's overflow:hidden.
  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbH, setThumbH] = useState(220);
  useEffect(() => {
    const elz = thumbRef.current;
    if (!elz || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const h = entry.contentRect.height;
      if (h > 0) setThumbH(h);
    });
    ro.observe(elz);
    return () => ro.disconnect();
  }, []);
  const THUMB_W = 260;
  // COVER: fill both the fixed 260 width and the measured height, take the larger.
  const coverScale = Math.max(THUMB_W / 1280, thumbH / 900);

  // The design's identity for the brief modal. Colors come live from the variation's
  // brand manifest (exact hexes); the primary FONT family isn't in the manifest (only a
  // CSS-var ref), so it reads the captured `primaryFont`, falling back to the role name.
  const brand = resolveBrand(variation.id);
  const swatches = brand.paletteGroups.flatMap((g) => g.colors);
  const primarySwatch = swatches.find((c) => c.token === "--ta-primary") || swatches[0];
  const primaryColor = variation.primaryColor || primarySwatch?.value || "";
  const primaryColorName = primarySwatch?.name || copy.variationCard.primaryFallbackName;
  const primaryFont = variation.primaryFont || brand.fonts[0]?.name || "";
  // Design-variety: the lens/style this design took (label captured into variation.json).
  const lens = variation.direction?.lensLabel || variation.direction?.lens || "";
  const hasBriefCard = !!(variation.brief || primaryColor || primaryFont || lens);
  const parsedBrief = variation.brief ? parseBrief(variation.brief) : null;

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
      <div ref={thumbRef} style={{
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
              alt={copy.variationCard.previewAlt(variation.title)}
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
                position: "absolute",
                top: 0,
                left: "50%",
                width: 1280,
                height: 900,
                transform: `translateX(-50%) scale(${coverScale})`,
                transformOrigin: "top center",
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
              {copy.variationCard.base}
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
            {variation.brief ? copy.variationCard.briefAndPalette : copy.variationCard.paletteAndType}
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
              {copy.variationCard.setupNudge.lead}{" "}
              <code style={{ background: "rgba(0,0,0,0.06)", padding: "1px 5px", borderRadius: 3, fontFamily: "ui-monospace, monospace", fontSize: 11.5 }}>{copy.variationCard.setupNudge.command}</code>{" "}
              for <strong style={{ fontWeight: 600 }}>{variation.version}</strong> {copy.variationCard.setupNudge.tail} <a href={stylesUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#663d00", textDecoration: "underline", textUnderlineOffset: 2 }}>{copy.variationCard.setupNudge.linkText}</a>.
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
              {copy.variationCard.created}
            </div>
            <div style={{ fontSize: 12, color: "var(--admin-gray-dark)", fontFamily: "var(--admin-font-body)" }}>
              {variation.createdAt}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", color: "var(--admin-gray-mid)", textTransform: "uppercase", marginBottom: 3, fontFamily: "var(--admin-font-body)" }}>
              {copy.variationCard.modified}
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
              {copy.variationCard.viewTooltip}
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
            {copy.variationCard.viewDesign}
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
          {copy.variationCard.styleguide}
        </a>

        {/* Confer with the Art Director — admin, non-base, dev only, and only once the
            design is built. Posts up to the Electron shell, which runs a READ-ONLY design
            review (rules + palette) and reports the findings in chat. Advisory, never edits.
            `import.meta.env.DEV` keeps this LOCAL-ONLY: Vercel serves a production `vite build`
            where DEV is statically false, so this whole block is dead-code-eliminated out of
            the deployed bundle — the client's published preview never sees it (same guard as
            the reroll + remove controls). */}
        {isAdmin && !variation.isBase && import.meta.env.DEV && variation.previewReady && (
          <button
            onClick={() => window.postMessage({ type: "ta-artdirector", variationId: variation.id }, "*")}
            style={{
              display: "block",
              width: "100%",
              boxSizing: "border-box",
              textAlign: "center",
              padding: "9px 20px",
              background: "transparent",
              color: "var(--admin-ink)",
              border: "1px solid var(--admin-gray-light)",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "var(--admin-font-body)",
            }}
          >
            {copy.variationCard.conferArtDirector}
          </button>
        )}

        {/* Try another direction (design-variety reroll) — admin, non-base, dev only, and
            only when the licensed feature is on. Posts up to the Electron shell, which forks
            a new variation and rebuilds it with a new design direction. */}
        {isAdmin && !variation.isBase && import.meta.env.DEV && varietyOn && (
          <button
            onClick={() => window.postMessage({ type: "ta-reroll", variationId: variation.id }, "*")}
            style={{
              display: "block",
              width: "100%",
              boxSizing: "border-box",
              textAlign: "center",
              padding: "9px 20px",
              background: "transparent",
              color: "var(--admin-ink)",
              border: "1px solid var(--admin-gray-light)",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "var(--admin-font-body)",
            }}
          >
            {copy.variationCard.tryAnotherDirection}
          </button>
        )}

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
            {copy.variationCard.remove}
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
            <button onClick={() => setBriefOpen(false)} aria-label={copy.variationCard.close} style={{ flex: "0 0 auto", width: 28, height: 28, border: "none", borderRadius: 999, background: "#f2f2f5", color: "#666", fontSize: 14, cursor: "pointer" }}>✕</button>
          </div>

          {parsedBrief && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "var(--admin-font-body)", fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--admin-gray-mid)", marginBottom: 6 }}>{copy.variationCard.briefHeading}</div>
              {parsedBrief.lead && (
                <p style={{ fontFamily: "var(--admin-font-body)", fontStyle: "italic", fontSize: 14, lineHeight: 1.55, color: "var(--admin-gray-dark)", margin: 0 }}>“{parsedBrief.lead}”</p>
              )}
              {parsedBrief.rows.length > 0 && (
                <div style={{ marginTop: parsedBrief.lead ? 12 : 0, display: "flex", flexDirection: "column", gap: 7 }}>
                  {parsedBrief.rows.map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                      {r.label && (
                        <div style={{ flex: "0 0 84px", fontFamily: "var(--admin-font-body)", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--admin-gray-mid)" }}>{r.label}</div>
                      )}
                      <div style={{ flex: 1, fontFamily: "var(--admin-font-body)", fontSize: 13, lineHeight: 1.45, color: "var(--admin-gray-dark)" }}>{renderBriefValue(r.value)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {lens && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "var(--admin-font-body)", fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--admin-gray-mid)", marginBottom: 6 }}>{copy.variationCard.directionHeading}</div>
              <div style={{ fontFamily: "var(--admin-font-heading)", fontSize: 16, fontWeight: 600, color: "var(--admin-ink)", lineHeight: 1.25 }}>{lens}</div>
            </div>
          )}

          {primaryColor && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "var(--admin-font-body)", fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--admin-gray-mid)", marginBottom: 8 }}>{copy.variationCard.paletteHeading}</div>
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
              <div style={{ fontFamily: "var(--admin-font-body)", fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--admin-gray-mid)", marginBottom: 6 }}>{copy.variationCard.typeHeading}</div>
              <div style={{ fontSize: 24, lineHeight: 1.2, color: "var(--admin-ink)", fontFamily: variation.primaryFont ? `'${variation.primaryFont}', Georgia, serif` : "var(--admin-font-heading)" }}>{primaryFont}</div>
              <div style={{ fontFamily: "var(--admin-font-body)", fontSize: 12, color: "var(--admin-gray-mid)", marginTop: 2 }}>{copy.variationCard.primaryTypeface}</div>
            </div>
          )}
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
