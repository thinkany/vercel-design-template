// ©2026 thinkany llc. All rights reserved.
import { useEffect, useState } from "react";

type Credit = { file: string; source?: string; url?: string; free?: boolean };

/**
 * A single, unobtrusive alert (lower-left of the preview) shown when the design
 * uses images that are NOT free to reuse. It reads `public/images/credits.json`,
 * the manifest written when images are gathered (see `/design` §4b), and lists the
 * flagged images on hover so the designer knows to license or replace them before
 * shipping.
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
  const [open, setOpen] = useState(false);

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

  if (!import.meta.env.DEV || !flagged.length) return null;

  const n = flagged.length;
  return (
    <div
      style={{ position: "fixed", left: 16, bottom: 16, zIndex: 60, fontFamily: "system-ui, sans-serif" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            width: 264,
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
          <ul style={{ margin: "0 0 6px", padding: 0, listStyle: "none", maxHeight: 150, overflowY: "auto" }}>
            {flagged.map((c) => (
              <li key={c.file} style={{ padding: "2px 0", color: "#d7d7dd" }}>
                {c.file}
                {c.source ? ` · ${c.source}` : ""}
              </li>
            ))}
          </ul>
          <div style={{ color: "#9a9aa2" }}>License or replace these before you ship.</div>
        </div>
      )}
      <button
        type="button"
        aria-label={`${n} image${n > 1 ? "s" : ""} not free to reuse`}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 30,
          height: 30,
          borderRadius: "50%",
          cursor: "pointer",
          border: "none",
          background: open ? "rgba(23,23,27,.9)" : "rgba(23,23,27,.6)",
          color: "#fff",
          backdropFilter: "blur(4px)",
          transition: "background .15s",
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
