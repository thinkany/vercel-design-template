// ©2026 thinkany llc. All rights reserved.
import { useEffect, useRef, useState } from "react";

type Credit = { file: string; source?: string; url?: string; free?: boolean };

// Soft ease-out that matches the app's overall motion feel.
const SOFT_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const HL_OUTLINE = "3px solid #e5484d";
const HL_OFFSET = "-2px";

/**
 * A single, unobtrusive alert (lower-left of the preview) shown when the design
 * uses images that are NOT free to reuse. It reads `public/images/credits.json`,
 * the manifest written when images are gathered (see `/design` §4b).
 *
 * Click the badge to PIN a list of the flagged images AND outline each one in the
 * design (scroll through to see exactly which need licensing/replacing). Click
 * again to turn it off.
 *
 * Scope, on purpose:
 * - **Local dev only** (`import.meta.env.DEV`): a designer's working aid, so it
 *   never appears on the shared Vercel preview the client sees.
 * - **Not in the Figma export:** DesignSurface renders this only in its interactive
 *   branch, never in `capture` mode.
 * - Renders nothing when there's no manifest, or nothing in it is flagged.
 */
export function ImageCredits() {
  const [flagged, setFlagged] = useState<Credit[]>([]);
  const [active, setActive] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let cancelled = false;
    fetch("/images/credits.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const list: Credit[] = Array.isArray(data) ? data : data.images || [];
        const nonFree = list.filter((c) => c && c.file && c.free === false);
        if (nonFree.length) setFlagged(nonFree);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // While active, outline every flagged image in the design; restore on toggle-off
  // or unmount. Outlines ride on the elements, so they scroll with the page.
  useEffect(() => {
    if (!active) return;
    const els = findImageElements(flagged.map((c) => c.file));
    applyHighlights(els);
    return () => clearHighlights(els);
  }, [active, flagged]);

  // Soft fade + rise for the list when it opens.
  useEffect(() => {
    if (active && panelRef.current) {
      panelRef.current.animate(
        [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "translateY(0px)" },
        ],
        { duration: 380, easing: SOFT_EASE, fill: "both" }
      );
    }
  }, [active]);

  if (!import.meta.env.DEV || !flagged.length) return null;

  const n = flagged.length;
  return (
    <div style={{ position: "fixed", left: 16, bottom: 16, zIndex: 60, fontFamily: "system-ui, sans-serif" }}>
      {active && (
        <div
          ref={panelRef}
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            width: 272,
            background: "#17171b",
            color: "#fff",
            borderRadius: 10,
            padding: "12px 14px",
            boxShadow: "0 8px 28px rgba(0,0,0,.28)",
            fontSize: 12.5,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {n} image{n > 1 ? "s" : ""} not free to reuse
          </div>
          <ul style={{ margin: "0 0 8px", padding: 0, listStyle: "none", maxHeight: 168, overflowY: "auto" }}>
            {flagged.map((c) => {
              const href = sourceLink(c);
              return (
                <li key={c.file} style={{ padding: "3px 0", color: "#d7d7dd" }}>
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#e5484d", marginRight: 7, verticalAlign: "middle" }} />
                  <span style={{ verticalAlign: "middle" }}>{c.file}</span>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#aab6ff", textDecoration: "none", verticalAlign: "middle" }}
                    >
                      {" · "}
                      {c.source || "source"} ↗
                    </a>
                  ) : c.source ? (
                    <span style={{ color: "#9a9aa2", verticalAlign: "middle" }}>{" · "}{c.source}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div style={{ color: "#9a9aa2" }}>Outlined in the design. License or replace them, then click the badge to turn this off.</div>
        </div>
      )}
      <button
        type="button"
        aria-pressed={active}
        title="Unlicensed Images"
        aria-label={`Unlicensed images: ${n} not free to reuse${active ? " (highlighting on)" : ""}`}
        onClick={() => setActive((a) => !a)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 30,
          height: 30,
          borderRadius: "50%",
          cursor: "pointer",
          border: "none",
          background: active ? "#e5484d" : "rgba(23,23,27,.6)",
          color: "#fff",
          backdropFilter: "blur(4px)",
          boxShadow: active ? "0 0 0 3px rgba(229,72,77,.28)" : "none",
          transition: "background .15s, box-shadow .15s",
        }}
      >
        {/* Circle with a diagonal slash (prohibition mark). */}
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
        </svg>
      </button>
    </div>
  );
}

// Where "visit the source" points: the exact origin URL if recorded, else the
// source domain. A non-domain label (e.g. a bare note) gets no link.
function sourceLink(c: Credit): string | null {
  if (c.url && /^https?:\/\//i.test(c.url)) return c.url;
  const dom = (c.source || "").replace(/^https?:\/\//i, "").trim();
  if (dom && /^[^\s/]+\.[^\s/]+/.test(dom)) return "https://" + dom;
  return null;
}

// Find every element in the design that renders one of the flagged files, whether
// as an <img> or a (inline or Tailwind) background-image.
function findImageElements(files: string[]): HTMLElement[] {
  const names = files.map((f) => (f || "").split("/").pop() || "").filter(Boolean);
  if (!names.length) return [];
  const matches = (s: string | null | undefined) => !!s && names.some((nm) => s.includes(nm));
  const out: HTMLElement[] = [];
  const seen = new Set<Element>();

  document.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    if (seen.has(img)) return;
    if (matches(img.getAttribute("src")) || matches(img.currentSrc)) {
      seen.add(img);
      out.push(img);
    }
  });
  document.querySelectorAll<HTMLElement>("*").forEach((el) => {
    if (seen.has(el) || el.tagName === "IMG") return;
    if (matches(el.style && el.style.backgroundImage)) {
      seen.add(el);
      out.push(el);
      return;
    }
    let cbg = "";
    try {
      cbg = getComputedStyle(el).backgroundImage;
    } catch {
      /* detached / cross-origin */
    }
    if (cbg && cbg !== "none" && matches(cbg)) {
      seen.add(el);
      out.push(el);
    }
  });
  return out;
}

function applyHighlights(els: HTMLElement[]) {
  els.forEach((el) => {
    if (el.dataset.taImgHl) return;
    el.dataset.taImgHl = "1";
    el.dataset.taImgHlO = el.style.outline;
    el.dataset.taImgHlOff = el.style.outlineOffset;
    el.style.outline = HL_OUTLINE;
    el.style.outlineOffset = HL_OFFSET;
  });
}

function clearHighlights(els: HTMLElement[]) {
  els.forEach((el) => {
    if (!el.dataset.taImgHl) return;
    el.style.outline = el.dataset.taImgHlO || "";
    el.style.outlineOffset = el.dataset.taImgHlOff || "";
    delete el.dataset.taImgHl;
    delete el.dataset.taImgHlO;
    delete el.dataset.taImgHlOff;
  });
}
