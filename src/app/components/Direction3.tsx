// ©2004-2026 Deep Focus Review. All rights reserved.
import { useState } from "react";
import { Direction3Mobile } from "./Direction3Mobile";
import { PhoneFrame } from "./PhoneFrame";
import { ViewToggle } from "./ViewToggle";
import { Nav3 } from "./Nav3";
import { Footer3 } from "./Footer3";
import { SITE_SECONDARY_REVIEWS } from "./siteData";
import { useC3Theme } from "./c3Theme";

const featured = {
  title: "Backrooms",
  director: "Kane Parsons",
  year: 2026,
  rating: "★★★",
  genre: "HORROR · FOUND FOOTAGE",
  runtime: "110 min",
  lead: "A24's liminal-space debut traps its characters inside an abandoned geometry that keeps going — and going. Kane Parsons's assured first feature earns its dread through patience and wrongness.",
  image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Backrooms-movie-still-2.png",
};

const curated = [
  { id: 1, title: "Chum", director: "Josh Mond", year: 2026, rating: "★★★", genre: "DRAMA", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Chum-movie-still-2.png", excerpt: "Mond captures something about male friendship that most films fumble." },
  { id: 2, title: "Renoir", director: "Gilles Bourdos", year: 2026, rating: "★★★½", genre: "BIOPIC · DRAMA", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Renoir-movie-still.png", excerpt: "Ravishing and sun-drenched — a portrait of an artist's final years." },
  { id: 3, title: "Pressure", director: "John Hillcoat", year: 2026, rating: "★★★½", genre: "THRILLER", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Pressure-movie-still-2.png", excerpt: "Hillcoat returns to form with a taut submarine thriller." },
  { id: 4, title: "Power Ballad", director: "Claire Oakley", year: 2026, rating: "★★★", genre: "COMING OF AGE", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Power-Ballad-Movie-Still-2.png", excerpt: "A coming-of-age story told through the language of rock music." },
  { id: 5, title: "Passenger", director: "Ridley Scott", year: 2026, rating: "★★★", genre: "SCI-FI · DRAMA", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Passenger-movie-still-1.png", excerpt: "Visually spectacular if narratively thin deep-space drama." },
  { id: 6, title: "Corporate Retreat", director: "Various", year: 2026, rating: "★★½", genre: "COMEDY · SATIRE", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Corporate-Retreat-movie-still-1.png", excerpt: "Sharp satire undercut by a predictable second half." },
  { id: 7, title: "Backrooms", director: "Kane Parsons", year: 2026, rating: "★★★", genre: "HORROR", image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Backrooms-movie-still-1-1024x576.png", excerpt: "Found footage as a form of collective memory — patient and genuinely strange." },
];

const gradeFilms = SITE_SECONDARY_REVIEWS.map((r) => ({
  title: r.title,
  director: r.director,
  rating: r.rating,
}));

export function Direction3({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { c } = useC3Theme();
  const [hovered, setHovered] = useState<number | null>(null);
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const [carouselPage, setCarouselPage] = useState(0);
  const navigate = onNavigate ?? (() => {});
  const perPage = 4;
  const totalPages = Math.ceil(curated.length / perPage);
  const visibleCards = curated.slice(carouselPage * perPage, carouselPage * perPage + perPage);

  return (
    <div style={{ background: view === "mobile" ? "#1a1410" : c.pageBg, minHeight: "100vh", transition: "background 0.2s" }}>
      <ViewToggle view={view} onChange={setView} barStyle={{ background: "#1a1410", borderColor: "rgba(255,255,255,0.1)" }} activeColor="#c9a84c" activeBg="#c9a84c" />

      {view === "mobile" && (
        <PhoneFrame bg="#0d0c0b">
          <Direction3Mobile />
        </PhoneFrame>
      )}

      {view === "desktop" && (
        <div style={{ color: c.textPrimary, fontFamily: "'EB Garamond', Georgia, serif" }}>
          <Nav3 onNavigate={navigate} activePage="home" />

          {/* Hero — constrained to body margins */}
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 48px" }}>
            <div style={{ position: "relative", overflow: "hidden", borderRadius: 2 }}>
              <img src={featured.image} alt={featured.title} style={{ width: "100%", height: 520, objectFit: "cover", display: "block", filter: c.imgFilterFeatured }} />
              <div style={{ position: "absolute", inset: 0, background: c.heroCardOverlay }} />
              <div style={{ position: "absolute", bottom: 44, left: 40, right: 40 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.22em", color: c.gold, marginBottom: 14 }}>{featured.genre} &nbsp;·&nbsp; {featured.runtime}</div>
                <h1 style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: "clamp(40px, 5.5vw, 72px)", fontWeight: 700, lineHeight: 0.95, letterSpacing: "-0.01em", color: c.textHero, marginBottom: 6 }}>{featured.title}</h1>
                <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 16, fontStyle: "italic", color: "rgba(237,233,224,0.55)", marginBottom: 18 }}>{featured.director}, {featured.year}</div>
                <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 18, lineHeight: 1.6, color: "rgba(237,233,224,0.82)", maxWidth: 580, marginBottom: 22 }}>{featured.lead}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 24, fontWeight: 700, color: c.gold, border: `1px solid ${c.gold}`, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center" }}>{featured.rating}</div>
                  <a href="#" onClick={(e) => { e.preventDefault(); navigate("review"); }} style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.18em", color: c.textHero, textDecoration: "none", borderBottom: "1px solid rgba(237,233,224,0.3)", paddingBottom: 2 }}>READ THE FULL REVIEW</a>
                </div>
              </div>
            </div>
          </div>

          {/* Recently Graded — horizontal strip below hero */}
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 48px" }}>
            <div style={{ borderTop: `1px solid ${c.divider}`, borderBottom: `1px solid ${c.divider}`, display: "flex", alignItems: "stretch" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.22em", color: c.textDimmer, display: "flex", alignItems: "center", paddingRight: 28, whiteSpace: "nowrap", flexShrink: 0 }}>RECENTLY GRADED</div>
              {gradeFilms.map((film, i) => (
                <div key={i} style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderLeft: `1px solid ${c.divider}` }}>
                  <div>
                    <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 15, color: c.textPrimary, marginBottom: 2 }}>{film.title}</div>
                    <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 12, fontStyle: "italic", color: c.textDimmer }}>{film.director}</div>
                  </div>
                  <div style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 16, color: c.gold, fontWeight: 600, marginLeft: 12, flexShrink: 0 }}>{film.rating}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Current Season — 4-card carousel */}
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 48px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.22em", color: c.textFaint }}>CURRENT SEASON</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setCarouselPage((p) => Math.max(p - 1, 0))} disabled={carouselPage === 0}
                  style={{ width: 28, height: 28, background: "transparent", border: `1px solid ${c.divider}`, color: carouselPage === 0 ? c.textDimmer : c.textMuted, cursor: carouselPage === 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>‹</button>
                <button onClick={() => setCarouselPage((p) => Math.min(p + 1, totalPages - 1))} disabled={carouselPage === totalPages - 1}
                  style={{ width: 28, height: 28, background: "transparent", border: `1px solid ${c.divider}`, color: carouselPage === totalPages - 1 ? c.textDimmer : c.textMuted, cursor: carouselPage === totalPages - 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>›</button>
                <a href="#" onClick={(e) => e.preventDefault()} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.18em", color: c.textFaint, textDecoration: "none", marginLeft: 8, borderBottom: `1px solid ${c.textDimmer}`, paddingBottom: 1 }}>VIEW ALL →</a>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
              {visibleCards.map((film) => (
                <div key={film.id} style={{ cursor: "pointer" }} onMouseEnter={() => setHovered(film.id)} onMouseLeave={() => setHovered(null)}>
                  <div style={{ overflow: "hidden", marginBottom: 14, position: "relative", background: c.cardBg }}>
                    <img src={film.image} alt={film.title} style={{ width: "100%", height: 220, objectFit: "cover", display: "block", filter: hovered === film.id ? c.imgFilter2 : c.imgFilter, transition: "filter 0.3s, transform 0.3s", transform: hovered === film.id ? "scale(1.03)" : "scale(1)" }} />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(13,12,11,0.8) 0%, transparent 55%)" }} />
                    <div style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.16em", color: c.goldMuted, marginBottom: 5 }}>{film.genre}</div>
                      <h3 style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 18, fontWeight: 600, lineHeight: 1.1, color: "#ede9e0", letterSpacing: "-0.01em", marginBottom: 2 }}>{film.title}</h3>
                      <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 12, fontStyle: "italic", color: "rgba(237,233,224,0.5)" }}>{film.director}, {film.year}</div>
                    </div>
                  </div>
                  <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 14, lineHeight: 1.55, color: c.textMuted, marginBottom: 8 }}>{film.excerpt}</p>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.1em", color: c.textDimmer }}>REVIEW BY <span style={{ color: c.gold }}>Brian Eggert</span></div>
                </div>
              ))}
            </div>
          </div>

          {/* Subscribe strip */}
          <div style={{ maxWidth: 1200, margin: "48px auto 0", padding: "0 48px" }}>
            <div style={{ borderTop: `1px solid ${c.divider}`, paddingTop: 36, display: "flex", alignItems: "center", gap: 32 }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 18, fontWeight: 600, fontStyle: "italic", color: c.textPrimary, marginBottom: 4 }}>The Letter</div>
                <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 14, fontStyle: "italic", color: c.textFaint, maxWidth: 280 }}>Weekly dispatches for the devoted cinephile.</p>
              </div>
              <div style={{ display: "flex", gap: 8, flex: 1, maxWidth: 480 }}>
                <input placeholder="your@email.com" style={{ flex: 1, padding: "10px 12px", background: c.surfaceTint, border: `1px solid ${c.border}`, color: c.textPrimary, fontFamily: "'EB Garamond', Georgia, serif", fontSize: 14, outline: "none" }} />
                <button style={{ padding: "10px 24px", background: "transparent", color: c.gold, border: `1px solid ${c.gold}`, cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.2em", whiteSpace: "nowrap" }}>SUBSCRIBE</button>
              </div>
            </div>
          </div>
          <Footer3 onNavigate={navigate} />
        </div>
      )}
    </div>
  );
}
