// ©2004-2026 Deep Focus Review. All rights reserved.
import { useState, useEffect } from "react";
import { DEFINITIVES_FILMS, DEFINITIVES_INTRO, LATEST_REVIEWS } from "./definitivesData";
import { Nav1 } from "./Nav1";
import { SkyscraperAd, RectangleAd } from "./AdUnit";

interface Props {
  onNavigate: (page: string) => void;
}

function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1400);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
}

export function Definitives1({ onNavigate }: Props) {
  const [page, setPage] = useState(1);
  const windowWidth = useWindowWidth();
  const showFlankingAds = windowWidth >= 1400;
  const showMobileInlineAd = windowWidth < 900;
  const perPage = 6;
  const totalPages = Math.ceil(DEFINITIVES_FILMS.length / perPage);
  const visible = DEFINITIVES_FILMS.slice((page - 1) * perPage, page * perPage);

  return (
    <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", background: "#f8f7f3", minHeight: "100vh", color: "#111111" }}>

      {/* Utility bar */}
      <div style={{ background: "#111111", color: "#f8f7f3", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: "11px", letterSpacing: "0.08em", padding: "6px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", display: "flex", justifyContent: "space-between" }}>
          <span style={{ opacity: 0.6 }}>TUESDAY, JUNE 3, 2025</span>
          <span style={{ opacity: 0.6 }}>INDEPENDENT FILM CRITICISM SINCE 2004</span>
        </div>
      </div>

      {/* Masthead */}
      <div style={{ borderBottom: "3px solid #111111", padding: "28px 32px 0", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <button onClick={() => onNavigate("home")} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(42px, 6vw, 72px)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1, color: "#111111" }}>Deep Focus</div>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(42px, 6vw, 72px)", fontWeight: 300, fontStyle: "italic", letterSpacing: "-0.02em", lineHeight: 1, color: "#111111" }}>Review</div>
          </button>
          <div style={{ textAlign: "right", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, letterSpacing: "0.1em", color: "#555" }}>
            <div style={{ marginBottom: 6 }}>SUBSCRIBE</div>
            <div>SIGN IN</div>
          </div>
        </div>
        <Nav1 onNavigate={onNavigate} activePage="definitives" />
      </div>

      {/* Page intro header — full width within max container */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 32px 0" }}>
        <div style={{ borderBottom: "1px solid rgba(0,0,0,0.1)", paddingBottom: 32, marginBottom: 0, display: "grid", gridTemplateColumns: "1fr 340px", gap: 48, alignItems: "end" }}>
          <div>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.16em", color: "#1e4b96", fontWeight: 600, marginBottom: 12 }}>SERIES</div>
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(40px, 6vw, 72px)", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.025em", color: "#111", marginBottom: 20 }}>
              The<br /><em style={{ fontWeight: 300 }}>Definitives</em>
            </h1>
            <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 16, lineHeight: 1.7, color: "#444", maxWidth: 560 }}>
              {DEFINITIVES_INTRO}
            </p>
          </div>
          <div style={{ borderLeft: "1px solid rgba(0,0,0,0.1)", paddingLeft: 48 }}>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.14em", color: "#777", marginBottom: 16, fontWeight: 500 }}>ARCHIVE</div>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 48, fontWeight: 700, color: "#111", lineHeight: 1, marginBottom: 4 }}>300+</div>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, letterSpacing: "0.08em", color: "#777", marginBottom: 24 }}>ESSAYS PUBLISHED</div>
            <div style={{ background: "#111", color: "#f8f7f3", padding: "12px 16px", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <span>SUPPORT ON PATREON</span>
              <span style={{ marginLeft: "auto" }}>→</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── FLANKING AD LAYOUT ─────────────────────────────────────────────────
           Outer wrapper: full viewport width
           Three columns: [left ad] [editorial center] [right ad]
           Left/right ad columns are hidden below ~1400px and the center
           expands back to its normal max-width.
      ───────────────────────────────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: showFlankingAds ? "180px 1fr 180px" : "1fr",
        gap: 0,
        alignItems: "start",
        maxWidth: showFlankingAds ? 1600 : 1200,
        margin: "0 auto",
        padding: "40px 16px 64px",
      }}>

        {/* LEFT SKYSCRAPER AD — only rendered when wide enough */}
        {showFlankingAds && (
          <div style={{ paddingTop: 8, display: "flex", justifyContent: "center", position: "sticky", top: 80, alignSelf: "start" }}>
            <SkyscraperAd borderColor="rgba(0,0,0,0.1)" />
          </div>
        )}

        {/* CENTER: editorial content + right sidebar */}
        <div style={{ minWidth: 0, padding: showFlankingAds ? "0 24px" : "0 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 48 }}>

            {/* Film entries */}
            <div>
              <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, color: "#111", marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
                <span>MOST RECENT ENTRIES</span>
                <span style={{ flex: 1, borderTop: "1px solid rgba(0,0,0,0.1)" }} />
              </div>

              {/* Entries with inline ad after 4th item on mobile, hidden on desktop */}
              {visible.map((film, i) => (
                <div key={film.id}>
                  <div style={{ borderTop: i === 0 ? "2px solid #111" : "1px solid rgba(0,0,0,0.1)", paddingTop: 20, paddingBottom: 24 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 20, alignItems: "start" }}>
                      <div style={{ overflow: "hidden", background: "#ddd", flexShrink: 0 }}>
                        <img
                          src={film.image}
                          alt={film.title}
                          style={{ width: "100%", height: 130, objectFit: "cover", display: "block", transition: "transform 0.3s" }}
                          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
                          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                        />
                      </div>
                      <div>
                        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.14em", color: "#777", marginBottom: 6 }}>
                          {film.date.toUpperCase()} &nbsp;·&nbsp; {film.decade}
                        </div>
                        <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.015em", marginBottom: 3, color: "#111" }}>{film.title}</h2>
                        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#777", letterSpacing: "0.06em", marginBottom: 10 }}>
                          {film.director.toUpperCase()} &nbsp;·&nbsp; {film.year}
                        </div>
                        <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 14, lineHeight: 1.65, color: "#333" }}>{film.excerpt}</p>
                        <a href="#" onClick={(e) => e.preventDefault()} style={{ display: "inline-block", marginTop: 10, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.1em", color: "#1e4b96", textDecoration: "none", fontWeight: 500 }}>
                          READ ESSAY →
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Inline ad after 3rd entry on mobile */}
                  {i === 2 && showMobileInlineAd && (
                    <div style={{ padding: "8px 0 24px", display: "flex", justifyContent: "center" }}>
                      <RectangleAd borderColor="rgba(0,0,0,0.1)" />
                    </div>
                  )}
                </div>
              ))}

              {/* Pagination */}
              <div style={{ borderTop: "2px solid #111", paddingTop: 20, marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)}
                    style={{ width: 32, height: 32, background: page === p ? "#111" : "transparent", color: page === p ? "#f8f7f3" : "#333", border: "1px solid rgba(0,0,0,0.15)", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>
                    {p}
                  </button>
                ))}
                <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#777", marginLeft: 4 }}>… 31</span>
                <button onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  style={{ marginLeft: 8, background: "none", border: "1px solid rgba(0,0,0,0.2)", padding: "6px 14px", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer", color: "#333" }}>
                  NEXT →
                </button>
              </div>
            </div>

            {/* Right sidebar */}
            <div>
              <div style={{ borderTop: "2px solid #111", paddingTop: 14, marginBottom: 20 }}>
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.16em", fontWeight: 600, color: "#111" }}>LATEST REVIEWS</div>
              </div>
              {LATEST_REVIEWS.map((r, i) => (
                <div key={i} style={{ borderBottom: "1px solid rgba(0,0,0,0.1)", paddingBottom: 14, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div>
                    <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontWeight: 600 }}>{r.title}</div>
                    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "#888", letterSpacing: "0.06em", marginTop: 2 }}>{r.year}</div>
                  </div>
                  <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 13, color: "#1e4b96", marginLeft: 10, flexShrink: 0 }}>{r.rating}</span>
                </div>
              ))}

              {/* Sidebar 300×250 ad */}
              <div style={{ marginTop: 24 }}>
                <RectangleAd borderColor="rgba(0,0,0,0.1)" />
              </div>

              {/* About the series */}
              <div style={{ background: "#111", color: "#f8f7f3", padding: "20px", marginTop: 24 }}>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontWeight: 600, fontStyle: "italic", marginBottom: 8 }}>About The Definitives</div>
                <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, lineHeight: 1.6, color: "rgba(248,247,243,0.7)", marginBottom: 14 }}>
                  Essays on essential cinema, published since 2006. New entries appear first on Patreon.
                </p>
                <a href="#" onClick={(e) => e.preventDefault()} style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.14em", color: "#1e4b96", textDecoration: "none", fontWeight: 600 }}>
                  JOIN ON PATREON →
                </a>
              </div>

              {/* Decade index */}
              <div style={{ marginTop: 24, borderTop: "1px solid rgba(0,0,0,0.1)", paddingTop: 16 }}>
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, color: "#111", marginBottom: 12 }}>BROWSE BY DECADE</div>
                {["1920s","1930s","1940s","1950s","1960s","1970s","1980s","1990s","2000s","2010s","2020s"].map((d) => (
                  <a key={d} href="#" onClick={(e) => e.preventDefault()}
                    style={{ display: "block", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#555", textDecoration: "none", padding: "5px 0", borderBottom: "1px solid rgba(0,0,0,0.05)", letterSpacing: "0.06em" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#1e4b96")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
                  >{d}</a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SKYSCRAPER AD — only rendered when wide enough */}
        {showFlankingAds && (
          <div style={{ paddingTop: 8, display: "flex", justifyContent: "center", position: "sticky", top: 80, alignSelf: "start" }}>
            <SkyscraperAd borderColor="rgba(0,0,0,0.1)" />
          </div>
        )}
      </div>

    </div>
  );
}
