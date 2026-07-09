// ©2004-2026 Deep Focus Review. All rights reserved.
import { Direction1Mobile } from "./Direction1Mobile";
import { PhoneFrame } from "./PhoneFrame";
import { SITE_REVIEWS, SITE_SECONDARY_REVIEWS } from "./siteData";
import { Nav1 } from "./Nav1";
import { Footer1 } from "./Footer1";

export function Direction1V8({ onNavigate, view, setView }: { onNavigate?: (page: string) => void; view: "desktop" | "mobile"; setView: (v: "desktop" | "mobile") => void }) {
  const navigate = onNavigate ?? (() => {});

  const hero = SITE_REVIEWS[0];
  const secondary = SITE_REVIEWS.slice(1);

  const ViewIcons = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <button onClick={() => setView("desktop")} title="Desktop view"
        style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", display: "flex", alignItems: "center", color: view === "desktop" ? "#111" : "#bbb", transition: "color 0.15s" }}>
        <svg width="16" height="13" viewBox="0 0 24 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="1" width="22" height="14" rx="2"/>
          <line x1="8" y1="19" x2="16" y2="19"/>
          <line x1="12" y1="15" x2="12" y2="19"/>
        </svg>
      </button>
      <button onClick={() => setView("mobile")} title="Mobile view"
        style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", display: "flex", alignItems: "center", color: view === "mobile" ? "#111" : "#bbb", transition: "color 0.15s" }}>
        <svg width="9" height="15" viewBox="0 0 14 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="1" width="12" height="20" rx="2"/>
          <circle cx="7" cy="18" r="0.8" fill="currentColor" stroke="none"/>
        </svg>
      </button>
    </div>
  );

  return (
    <div style={{ background: "#f8f7f3", minHeight: "100vh" }}>
      {view === "mobile" && (
        <PhoneFrame bg="#f8f7f3">
          {/* Toggle — scrolls with content, top-right of safe area */}
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 12px 0" }}>
            <ViewIcons />
          </div>
          <Direction1Mobile onNavigate={navigate} />
        </PhoneFrame>
      )}

      {view === "desktop" && (
        <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: "#111111" }}>

          {/* Masthead + nav */}
          <div style={{ padding: "28px 32px 0", maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ marginLeft: -6 }}>
                <img src="https://www.deepfocusreview.com/wp-content/uploads/2024/10/deepfocusreview-logo-header.png" alt="Deep Focus Review" style={{ width: "clamp(240px, 26.4vw, 360px)", height: "auto", display: "block" }} />
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#333", letterSpacing: "0.06em", marginTop: 5, paddingLeft: 8 }}>Independent Film Criticism Since 2004</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 20, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, letterSpacing: "0.1em", color: "#555" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <a href="#" onClick={(e) => e.preventDefault()} title="Letterboxd" style={{ color: "#777", display: "flex", alignItems: "center" }} onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#1e4b96")} onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#777")}><svg width="20" height="13" viewBox="0 0 54 36" fill="currentColor"><circle cx="18" cy="18" r="17"/><circle cx="36" cy="18" r="17" fillOpacity="0.45"/></svg></a>
                <a href="#" onClick={(e) => e.preventDefault()} title="Bluesky" style={{ color: "#777", display: "flex", alignItems: "center" }} onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#1e4b96")} onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#777")}><svg width="16" height="14" viewBox="0 0 64 57" fill="none"><path fill="currentColor" d="M13.873 3.805C21.21 9.332 29.103 20.537 32 26.55v15.882c0-.338-.13.044-.41.867-1.512 4.456-7.418 21.847-20.923 7.944-7.111-7.32-3.819-14.64 9.125-16.85-7.405 1.264-15.73-.825-18.014-9.015C1.12 23.022 0 8.51 0 6.55 0-3.268 8.579-.182 13.873 3.805ZM50.127 3.805C42.79 9.332 34.897 20.537 32 26.55v15.882c0-.338.13.044.41.867 1.512 4.456 7.418 21.847 20.923 7.944 7.111-7.32 3.819-14.64-9.125-16.85 7.405 1.264 15.73-.825 18.014-9.015C62.88 23.022 64 8.51 64 6.55c0-9.818-8.578-6.732-13.873-2.745Z"/></svg></a>
                <a href="#" onClick={(e) => e.preventDefault()} title="LinkedIn" style={{ color: "#777", display: "flex", alignItems: "center" }} onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#1e4b96")} onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#777")}><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>
              </div>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", bottom: "100%", right: 0, paddingBottom: 5, display: "flex", alignItems: "center", gap: 10 }}>
                  <ViewIcons />
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
            </div>
            <Nav1 onNavigate={navigate} activePage="home" />
        <div style={{ borderBottom: "3px solid #111111" }} />
          </div>

          {/* Content grid */}
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 32px 0", display: "grid", gridTemplateColumns: "1fr 340px", gap: "0 48px", alignItems: "start" }}>

            {/* ── FULL-WIDTH HERO: Newest Film Review ── */}
            <div style={{ gridColumn: "1 / -1", marginBottom: 0, cursor: "pointer" }} onClick={() => onNavigate("review")}>
              <div style={{ position: "relative", overflow: "hidden" }}>
                <img src={hero.image} alt={hero.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />

                {/* Text encasement — 1/3 width, scrim contained within */}
                <div style={{
                  position: "absolute",
                  bottom: 28,
                  left: 28,
                  width: "calc(39.333% - 28px)",
                  background: "linear-gradient(to bottom, rgba(8,8,8,0.55) 0%, rgba(8,8,8,0.82) 45%, rgba(8,8,8,0.97) 100%)",
                  borderRadius: 2,
                  padding: "24px 26px 22px",
                  boxShadow: "inset 0 2px 0 rgba(255,255,255,0.18), inset 0 -2px 0 rgba(255,255,255,0.18)",
                }}>
                  {hero.label && (
                    <div style={{ display: "inline-block", marginBottom: 11, background: "#1e4b96", color: "#fff", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.16em", fontWeight: 600, padding: "3px 8px" }}>{hero.label}</div>
                  )}
                  <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, letterSpacing: "0.14em", color: "rgba(255,255,255,0.65)", fontWeight: 600, marginBottom: 9 }}>{hero.category}</div>
                  <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(22px, 2.4vw, 34px)", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.01em", marginBottom: 7, color: "#fff" }}>{hero.title}</h1>
                  <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.55)", letterSpacing: "0.06em", marginBottom: 12 }}>{hero.director.toUpperCase()} &nbsp;·&nbsp; {hero.year}</div>
                  <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.82)", marginBottom: 16, fontStyle: "italic" }}>{hero.summary}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 21, color: "#fff", letterSpacing: "0.05em" }}>{hero.rating}</span>
                    <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, letterSpacing: "0.12em", color: "rgba(255,255,255,0.75)", borderBottom: "1px solid rgba(255,255,255,0.35)", paddingBottom: 1 }}>READ FULL REVIEW →</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── LEFT COLUMN ── */}
            <div style={{ paddingTop: 40 }}>
              <div style={{ borderTop: "2px solid #111111", paddingTop: 14, marginBottom: 24 }}>
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, letterSpacing: "0.16em", fontWeight: 700, color: "#111" }}>NEW REVIEWS</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                {secondary.map((r) => (
                  <div key={r.id} style={{ borderTop: "1px solid rgba(0,0,0,0.12)", paddingTop: 16, display: "flex", flexDirection: "column" }}>
                    <div style={{ marginBottom: 0, overflow: "hidden", background: "#ccc", position: "relative" }}>
                      <img src={r.image} alt={r.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                      <div style={{ position: "absolute", bottom: 8, left: 8, background: "#C41230", color: "#fff", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.16em", fontWeight: 700, padding: "3px 8px" }}>NEW</div>
                    </div>
                    <div style={{ background: "#efefef", paddingTop: 12, paddingBottom: 24, paddingLeft: 16, paddingRight: 16, flex: 1, display: "flex", flexDirection: "column" }}>
                      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.12em", color: "#1e4b96", marginBottom: 6 }}>{r.category}</div>
                      <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, lineHeight: 1.1, marginBottom: 4, letterSpacing: "-0.01em" }}>{r.title}</h3>
                      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#777", letterSpacing: "0.06em", marginBottom: 10 }}>{r.director.toUpperCase()} · {r.year}</div>
                      <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 14, lineHeight: 1.6, color: "#333" }}>{r.summary}</p>
                      <div style={{ marginTop: "auto", paddingTop: 10, fontFamily: "'Fraunces', Georgia, serif", fontSize: 14, color: "#1e4b96" }}>{r.rating}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent Articles */}
              <div style={{ borderTop: "2px solid #111111", paddingTop: 14, marginTop: 40, marginBottom: 24 }}>
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, letterSpacing: "0.16em", fontWeight: 700, color: "#111" }}>RECENT ARTICLES</div>
              </div>
              {[
                { category: "FESTIVAL COVERAGE", title: "Cannes 2026: Dispatches from the Croisette", byline: "Brian Eggert · May 20, 2026", excerpt: "A dispatch from the world's most glamorous film festival — on competition titles, surprise premieres, and why this may be the strongest Cannes lineup in a decade.", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Backrooms-movie-still-2.png" },
                { category: "ESSAY", title: "The Slow Cinema of Patient Dread", byline: "Brian Eggert · May 14, 2026", excerpt: "From Béla Tarr to Skinamarink, a tradition of films that weaponize duration — and why audiences are hungrier for them now than ever before.", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Pressure-movie-still-2.png" },
                { category: "LIST", title: "The 25 Best Films of the Decade So Far", byline: "Brian Eggert · May 7, 2026", excerpt: "A ranked accounting of the films that have most defined cinema in the 2020s — from Aftersun to The Zone of Interest, and everything in between.", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Renoir-movie-still.png" },
                { category: "INTERVIEW", title: "Kane Parsons on Building the Backrooms", byline: "Brian Eggert · April 30, 2026", excerpt: "The twenty-year-old director of A24's most unsettling debut in years talks YouTube, practical effects, and why he shot on film instead of digital.", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Backrooms-movie-still-1-1024x576.png" },
              ].map((article, i) => (
                <div key={i} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.1)", paddingTop: i === 0 ? 0 : 20, paddingBottom: 20, cursor: "pointer" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 20, alignItems: "start" }}>
                    <div style={{ overflow: "hidden", background: "#ddd" }}>
                      <img src={article.image} alt={article.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block", transition: "transform 0.3s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                      />
                    </div>
                    <div>
                      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.14em", color: "#1e4b96", fontWeight: 600, marginBottom: 6 }}>{article.category}</div>
                      <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.015em", marginBottom: 4, color: "#111" }}>{article.title}</h3>
                      <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "#888", letterSpacing: "0.06em", marginBottom: 8, fontStyle: "italic" }}>{article.byline}</div>
                      <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 14, lineHeight: 1.6, color: "#444" }}>{article.excerpt}</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* More Reviews — poster grid */}
              <div style={{ borderTop: "2px solid #111111", paddingTop: 14, marginTop: 40, marginBottom: 24 }}>
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, letterSpacing: "0.16em", fontWeight: 700, color: "#111" }}>MORE REVIEWS</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
                {[
                  { title: "Disclosure Day", year: 2026, rating: "★★★★", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/06/Disclosure-Day-movie-still-4.png" },
                  { title: "Christine", year: 1983, rating: "★★★", image: "https://www.deepfocusreview.com/wp-content/uploads/2025/06/Christine-1983-Movie-Poster.png" },
                  { title: "Masters of the Universe", year: 2026, rating: "★★★", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Masters-of-the-Universe-movie-poster.png" },
                  { title: "Chum", year: 2026, rating: "★★★", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Chum-movie-poster.png" },
                  { title: "Renoir", year: 2026, rating: "★★★½", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Renoir-movie-poster.png" },
                  { title: "Backrooms", year: 2026, rating: "★★★", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Backrooms-movie-poster.png" },
                  { title: "Passenger", year: 2026, rating: "★★★", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Passenger-movie-poster.png" },
                  { title: "Corporate Retreat", year: 2026, rating: "★★½", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Corporate-Retreat-movie-poster.png" },
                ].map((film) => (
                  <div key={film.title} style={{ cursor: "pointer", display: "flex", flexDirection: "column" }}>
                    <div style={{ overflow: "hidden", background: "#ccc", marginBottom: 0 }}>
                      <img src={film.image} alt={film.title} style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover", display: "block", transition: "transform 0.3s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                      />
                    </div>
                    <div style={{ background: "#efefef", paddingTop: 8, paddingBottom: 24, paddingLeft: 8, paddingRight: 8, flex: 1 }}>
                      <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 12, fontWeight: 600, lineHeight: 1.25, color: "#111", marginBottom: 3 }}>{film.title}</div>
                      <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 11, color: "#1e4b96" }}>{film.rating}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div style={{ paddingTop: 40 }}>
              {/* Recent Definitives Essay */}
              <div style={{ borderTop: "2px solid #111111", paddingTop: 14, marginBottom: 20 }}>
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, letterSpacing: "0.16em", fontWeight: 700, color: "#111" }}>RECENT DEFINITIVES ESSAY</div>
              </div>
              <div style={{ borderBottom: "1px solid rgba(0,0,0,0.1)", paddingBottom: 24, marginBottom: 24, cursor: "pointer" }} onClick={() => navigate("essay")}>
                <div style={{ marginBottom: 10, overflow: "hidden", background: "#e0e0e0" }}>
                  <img src="https://www.deepfocusreview.com/wp-content/uploads/2026/05/The-Philadelphia-Story-movie-poster.png" alt="The Philadelphia Story" style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover", display: "block" }} />
                </div>
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.12em", color: "#1e4b96", marginBottom: 6, fontWeight: 600 }}>THE DEFINITIVES</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <h4 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 17, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.01em" }}>The Philadelphia Story</h4>
                  <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 12, color: "#1e4b96", flexShrink: 0, marginLeft: 8 }}>★★★★</span>
                </div>
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "#888", letterSpacing: "0.08em", marginBottom: 6 }}>GEORGE CUKOR · 1940</div>
                <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, lineHeight: 1.55, color: "#444" }}>Hepburn's self-financed comeback is one of Hollywood's most dazzling screwball comedies — and a searching examination of impossible standards.</p>
              </div>

              {/* Recently Reviewed */}
              <div style={{ borderTop: "2px solid #111111", paddingTop: 14, marginBottom: 20 }}>
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, letterSpacing: "0.16em", fontWeight: 700, color: "#111" }}>RECENTLY REVIEWED</div>
              </div>
              {SITE_SECONDARY_REVIEWS.map((r, i) => (
                <div key={i} style={{ borderBottom: "1px solid rgba(0,0,0,0.1)", paddingBottom: 18, marginBottom: 18 }}>
                  <div style={{ marginBottom: 8, overflow: "hidden", background: "#e0e0e0" }}>
                    <img src={r.image} alt={r.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <h4 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.01em" }}>{r.title}</h4>
                    <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 12, color: "#1e4b96", flexShrink: 0, marginLeft: 8 }}>{r.rating}</span>
                  </div>
                  <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "#888", letterSpacing: "0.08em", marginBottom: 6 }}>{r.director.toUpperCase()}</div>
                  <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, lineHeight: 1.55, color: "#444" }}>{r.snippet}</p>
                </div>
              ))}
              <div className="ta-dark" style={{ background: "#111111", color: "#f8f7f3", padding: "24px 20px", marginTop: 8 }}>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 600, marginBottom: 8, fontStyle: "italic" }}>The Weekly Reel</div>
                <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, lineHeight: 1.55, color: "rgba(248,247,243,0.75)", marginBottom: 16 }}>New reviews, essays, and interviews delivered every Friday.</p>
                <input placeholder="your@email.com" style={{ width: "100%", padding: "8px 10px", background: "transparent", border: "1px solid rgba(248,247,243,0.3)", color: "#f8f7f3", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, marginBottom: 8, outline: "none", boxSizing: "border-box" }} />
                <button style={{ width: "100%", padding: "9px", background: "#1e4b96", color: "#fff", border: "none", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.14em", fontWeight: 600 }}>SUBSCRIBE</button>
              </div>
            </div>


          </div>
        </div>
      )}
      <Footer1 onNavigate={onNavigate} />
    </div>
  );
}
