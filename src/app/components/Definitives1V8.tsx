// ©2004-2026 Deep Focus Review. All rights reserved.
import { useState, useEffect } from "react";
import { DEFINITIVES_INTRO, LATEST_REVIEWS } from "./definitivesData";
import { Nav1 } from "./Nav1";
import { SITE_DEFINITIVES_FILMS } from "./siteData";
import { SkyscraperAd, RectangleAd } from "./AdUnit";
import { Footer1 } from "./Footer1";

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

export function Definitives1V8({ onNavigate }: Props) {
  const [page, setPage] = useState(1);
  const windowWidth = useWindowWidth();
  const showFlankingAds = windowWidth >= 1400;
  const showMobileInlineAd = windowWidth < 900;
  const perPage = 6;
  const totalPages = Math.ceil(SITE_DEFINITIVES_FILMS.length / perPage);
  const visible = SITE_DEFINITIVES_FILMS.slice((page - 1) * perPage, page * perPage);

  return (
    <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", background: "#f8f7f3", minHeight: "100vh", color: "#111111" }}>

      {/* Masthead */}
      <div style={{ padding: "28px 32px 0", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => onNavigate("home")} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0, marginLeft: -6 }}>
            <img src="https://www.deepfocusreview.com/wp-content/uploads/2024/10/deepfocusreview-logo-header.png" alt="Deep Focus Review" style={{ width: "clamp(240px, 26.4vw, 360px)", height: "auto", display: "block" }} />
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#333", letterSpacing: "0.06em", marginTop: 5, paddingLeft: 8 }}>Independent Film Criticism Since 2004</div>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 20, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, letterSpacing: "0.1em", color: "#555" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <a href="#" onClick={(e) => e.preventDefault()} title="Letterboxd" style={{ color: "#777", display: "flex", alignItems: "center" }} onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#1e4b96")} onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#777")}><svg width="20" height="13" viewBox="0 0 54 36" fill="currentColor"><circle cx="18" cy="18" r="17"/><circle cx="36" cy="18" r="17" fillOpacity="0.45"/></svg></a>
                <a href="#" onClick={(e) => e.preventDefault()} title="Bluesky" style={{ color: "#777", display: "flex", alignItems: "center" }} onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#1e4b96")} onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#777")}><svg width="16" height="14" viewBox="0 0 64 57" fill="none"><path fill="currentColor" d="M13.873 3.805C21.21 9.332 29.103 20.537 32 26.55v15.882c0-.338-.13.044-.41.867-1.512 4.456-7.418 21.847-20.923 7.944-7.111-7.32-3.819-14.64 9.125-16.85-7.405 1.264-15.73-.825-18.014-9.015C1.12 23.022 0 8.51 0 6.55 0-3.268 8.579-.182 13.873 3.805ZM50.127 3.805C42.79 9.332 34.897 20.537 32 26.55v15.882c0-.338.13.044.41.867 1.512 4.456 7.418 21.847 20.923 7.944 7.111-7.32 3.819-14.64-9.125-16.85 7.405 1.264 15.73-.825 18.014-9.015C62.88 23.022 64 8.51 64 6.55c0-9.818-8.578-6.732-13.873-2.745Z"/></svg></a>
                <a href="#" onClick={(e) => e.preventDefault()} title="LinkedIn" style={{ color: "#777", display: "flex", alignItems: "center" }} onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#1e4b96")} onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#777")}><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>
              </div>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #555", padding: "5px 10px", gap: 6, background: "transparent" }}>
                <input
                  placeholder="Search..."
                  style={{ border: "none", outline: "none", background: "transparent", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#111", width: 140, letterSpacing: "0.04em" }}
                />
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
        </div>
          </div>
        <Nav1 onNavigate={onNavigate} activePage="definitives" />
        <div style={{ borderBottom: "3px solid #111111" }} />
      </div>

      {/* Page intro header */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 32px 0" }}>
        <div style={{ borderBottom: "1px solid rgba(0,0,0,0.1)", paddingBottom: 32, marginBottom: 0, display: "grid", gridTemplateColumns: "1fr 340px", gap: 48, alignItems: "end" }}>
          <div>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.16em", color: "#1e4b96", fontWeight: 600, marginBottom: 12 }}>SERIES</div>
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(40px, 6vw, 72px)", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.025em", color: "#111", marginBottom: 20 }}>
              <em style={{ fontWeight: 300, fontStyle: "italic" }}>The</em><br /><span style={{ fontWeight: 700 }}>Definitives</span>
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

      {/* Flanking ad layout */}
      <div style={{
        display: "grid",
        gridTemplateColumns: showFlankingAds ? "180px 1fr 180px" : "1fr",
        gap: 0,
        alignItems: "start",
        maxWidth: showFlankingAds ? 1600 : 1200,
        margin: "0 auto",
        padding: "40px 16px 64px",
      }}>

        {showFlankingAds && (
          <div style={{ paddingTop: 8, display: "flex", justifyContent: "center", position: "sticky", top: 80, alignSelf: "start" }}>
            <SkyscraperAd borderColor="rgba(0,0,0,0.1)" />
          </div>
        )}

        <div style={{ minWidth: 0, padding: showFlankingAds ? "0 24px" : "0 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 48 }}>

            {/* Film entries */}
            <div>
              <div style={{ borderTop: "2px solid #111", paddingTop: 12, marginBottom: 20 }}>
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, color: "#111" }}>MOST RECENT ENTRIES</div>
              </div>

              {visible.map((film, i) => (
                <div key={film.id}>
                  <div style={{ borderTop: "1px solid rgba(0,0,0,0.1)", paddingTop: 20, paddingBottom: 24 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 20, alignItems: "start" }}>
                      <div style={{ overflow: "hidden", background: "#ddd", flexShrink: 0, cursor: "pointer" }}
                        onClick={() => { if (film.title === "The Philadelphia Story") onNavigate("essay"); }}>
                        <img
                          src={film.image}
                          alt={film.title}
                          style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block", transition: "transform 0.3s" }}
                          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
                          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                        />
                      </div>
                      <div>
                        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.14em", color: "#777", marginBottom: 6 }}>
                          {film.date.toUpperCase()} &nbsp;·&nbsp; {film.decade}
                        </div>
                        <h2 onClick={() => { if (film.title === "The Philadelphia Story") onNavigate("essay"); }} style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.015em", marginBottom: 3, color: "#111", cursor: "pointer" }}>{film.title}</h2>
                        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#777", letterSpacing: "0.06em", marginBottom: 10 }}>
                          {film.director.toUpperCase()} &nbsp;·&nbsp; {film.year}
                        </div>
                        <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 14, lineHeight: 1.65, color: "#333" }}>{film.excerpt}</p>
                        <a href="#" onClick={(e) => { e.preventDefault(); if (film.title === "The Philadelphia Story") onNavigate("essay"); }}
                          style={{ display: "inline-block", marginTop: 10, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.1em", color: "#1e4b96", textDecoration: "none", fontWeight: 500 }}>
                          READ ESSAY →
                        </a>
                      </div>
                    </div>
                  </div>

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

              <div style={{ marginTop: 24 }}>
                <RectangleAd borderColor="rgba(0,0,0,0.1)" />
              </div>

              <div className="ta-dark" style={{ background: "#111", color: "#f8f7f3", padding: "20px", marginTop: 24 }}>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontWeight: 600, fontStyle: "italic", marginBottom: 8 }}>About The Definitives</div>
                <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, lineHeight: 1.6, color: "rgba(248,247,243,0.7)", marginBottom: 14 }}>
                  Essays on essential cinema, published since 2006. New entries appear first on Patreon.
                </p>
                <a href="#" onClick={(e) => e.preventDefault()} style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.14em", fontWeight: 600 }}>
                  JOIN ON PATREON →
                </a>
              </div>

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

        {showFlankingAds && (
          <div style={{ paddingTop: 8, display: "flex", justifyContent: "center", position: "sticky", top: 80, alignSelf: "start" }}>
            <SkyscraperAd borderColor="rgba(0,0,0,0.1)" />
          </div>
        )}
      </div>
      <Footer1 onNavigate={onNavigate} />
    </div>
  );
}
