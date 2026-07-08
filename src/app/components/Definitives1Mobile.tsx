// ©2004-2026 Deep Focus Review. All rights reserved.
import { useState } from "react";
import { SITE_DEFINITIVES_FILMS } from "./siteData";
import { DEFINITIVES_INTRO } from "./definitivesData";
import { MobileMasthead, MobileSectionHeader, MobileFooter } from "./MobileShared";

const PER_PAGE = 5;

export function Definitives1Mobile({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const navigate = onNavigate ?? (() => {});
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(SITE_DEFINITIVES_FILMS.length / PER_PAGE);
  const visible = SITE_DEFINITIVES_FILMS.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", background: "#f8f7f3", minHeight: "100vh", color: "#111", maxWidth: 430, margin: "0 auto" }}>

      <MobileMasthead onNavigate={navigate} activePage="definitives" />

      {/* Page hero */}
      <div style={{ padding: "24px 16px 20px", borderBottom: "1px solid rgba(0,0,0,0.1)" }}>
        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.16em", color: "#1e4b96", fontWeight: 600, marginBottom: 10 }}>ONGOING SERIES</div>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 40, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.025em", color: "#111", marginBottom: 4 }}>
          The<br /><em style={{ fontWeight: 300, fontStyle: "italic" }}>Definitives</em>
        </h1>
        <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 14, lineHeight: 1.65, color: "#555", marginTop: 14 }}>
          {DEFINITIVES_INTRO}
        </p>

        {/* Stats */}
        <div style={{ display: "flex", gap: 24, marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
          <div>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 700, color: "#111", lineHeight: 1 }}>300+</div>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.12em", color: "#888", marginTop: 2 }}>ESSAYS</div>
          </div>
          <div style={{ width: 1, background: "rgba(0,0,0,0.1)" }} />
          <div>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 700, color: "#111", lineHeight: 1 }}>2006</div>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.12em", color: "#888", marginTop: 2 }}>FOUNDED</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
            <a href="#" onClick={(e) => e.preventDefault()}
              style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.14em", fontWeight: 600, color: "#1e4b96", textDecoration: "none", border: "1px solid #1e4b96", padding: "7px 12px" }}>
              EARLY ACCESS →
            </a>
          </div>
        </div>
      </div>

      {/* Film entries */}
      <div style={{ padding: "0 16px" }}>
        <MobileSectionHeader label="MOST RECENT ENTRIES" topMargin={24} />

        {visible.map((film, i) => (
          <div key={film.id}
            style={{ borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.08)", paddingTop: i === 0 ? 0 : 20, paddingBottom: 20, cursor: "pointer" }}
            onClick={() => { if (film.title === "The Philadelphia Story") navigate("essay"); }}
          >
            {/* Horizontal layout: image left, text right */}
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 100, flexShrink: 0, overflow: "hidden", background: "#ddd" }}>
                <img src={film.image} alt={film.title}
                  style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.1em", color: "#888", marginBottom: 4 }}>
                  {film.date.toUpperCase()} · {film.decade}
                </div>
                <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 17, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.01em", marginBottom: 2, color: "#111" }}>
                  {film.title}
                </h2>
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "#777", letterSpacing: "0.06em", marginBottom: 6 }}>
                  {film.director.toUpperCase()} · {film.year}
                </div>
                <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, lineHeight: 1.55, color: "#444", marginBottom: 8 }}>
                  {film.excerpt}
                </p>
                <a href="#" onClick={(e) => { e.preventDefault(); if (film.title === "The Philadelphia Story") navigate("essay"); }}
                  style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.1em", color: "#1e4b96", textDecoration: "none", fontWeight: 500 }}>
                  READ ESSAY →
                </a>
              </div>
            </div>
          </div>
        ))}

        {/* Pagination */}
        <div style={{ borderTop: "2px solid #111", paddingTop: 16, marginTop: 8, marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1}
            style={{ background: "none", border: "1px solid rgba(0,0,0,0.2)", padding: "8px 16px", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.1em", cursor: page === 1 ? "default" : "pointer", color: page === 1 ? "#ccc" : "#333" }}>
            ← PREV
          </button>
          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#888" }}>
            {page} / {totalPages}
          </div>
          <button onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page === totalPages}
            style={{ background: "none", border: "1px solid rgba(0,0,0,0.2)", padding: "8px 16px", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.1em", cursor: page === totalPages ? "default" : "pointer", color: page === totalPages ? "#ccc" : "#333" }}>
            NEXT →
          </button>
        </div>

        {/* Patreon CTA */}
        <div style={{ background: "#111", color: "#f8f7f3", padding: "20px 16px", marginBottom: 8 }}>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 17, fontWeight: 600, fontStyle: "italic", marginBottom: 8 }}>Read Ahead</div>
          <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, lineHeight: 1.55, color: "rgba(248,247,243,0.7)", marginBottom: 14 }}>
            New Definitives essays appear on Patreon a full year before public release.
          </p>
          <a href="#" onClick={(e) => e.preventDefault()}
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, color: "#fff", textDecoration: "underline" }}>
            JOIN ON PATREON →
          </a>
        </div>
      </div>

      <MobileFooter onNavigate={navigate} />
    </div>
  );
}
