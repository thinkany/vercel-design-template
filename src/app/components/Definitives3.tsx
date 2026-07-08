// ©2004-2026 Deep Focus Review. All rights reserved.
import { useState } from "react";
import { DEFINITIVES_FILMS, DEFINITIVES_INTRO, LATEST_REVIEWS } from "./definitivesData";
import { Nav3 } from "./Nav3";
import { Footer3 } from "./Footer3";
import { useC3Theme } from "./c3Theme";

interface Props {
  onNavigate: (page: string) => void;
}

const DECADES = ["1920s","1930s","1940s","1950s","1960s","1970s","1980s","1990s","2000s","2010s","2020s"];

export function Definitives3({ onNavigate }: Props) {
  const { c } = useC3Theme();
  const [page, setPage] = useState(1);
  const [hovered, setHovered] = useState<number | null>(null);
  const perPage = 6;
  const totalPages = Math.ceil(DEFINITIVES_FILMS.length / perPage);
  const visible = DEFINITIVES_FILMS.slice((page - 1) * perPage, page * perPage);

  return (
    <div style={{ background: c.pageBg, minHeight: "100vh", color: c.textPrimary, fontFamily: "'EB Garamond', Georgia, serif", transition: "background 0.2s" }}>
      <Nav3 onNavigate={onNavigate} activePage="definitives" />

      {/* Page hero */}
      <div style={{ position: "relative", height: 320, overflow: "hidden" }}>
        <img src="https://www.deepfocusreview.com/wp-content/uploads/2026/05/The-Philadelpha-Story-movie-still.png" alt="cinema" style={{ width: "100%", height: "100%", objectFit: "cover", filter: c.imgFilterHero, display: "block" }} />
        <div style={{ position: "absolute", inset: 0, background: c.heroGradientTop }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "0 48px 40px" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.22em", color: c.gold, marginBottom: 12 }}>ONGOING SERIES</div>
            <h1 style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: "clamp(36px, 4.9vw, 67px)", fontWeight: 700, lineHeight: 0.9, letterSpacing: "-0.01em", color: c.textHero, marginBottom: 16 }}>
              The<br /><em>Definitives</em>
            </h1>
            <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 17, lineHeight: 1.6, color: "rgba(237,233,224,0.7)", maxWidth: 560, fontStyle: "italic" }}>
              {DEFINITIVES_INTRO}
            </p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ borderBottom: `1px solid ${c.divider}`, padding: "16px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 48px", display: "flex", gap: 48, alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 28, fontWeight: 700, color: c.gold, lineHeight: 1 }}>300+</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: c.textDimmer, marginTop: 3 }}>ESSAYS</div>
          </div>
          <div style={{ width: 1, height: 32, background: c.divider }} />
          <div>
            <div style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 28, fontWeight: 700, color: c.gold, lineHeight: 1 }}>31</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: c.textDimmer, marginTop: 3 }}>ARCHIVE PAGES</div>
          </div>
          <div style={{ width: 1, height: 32, background: c.divider }} />
          <div>
            <div style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 28, fontWeight: 700, color: c.gold, lineHeight: 1 }}>2006</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: c.textDimmer, marginTop: 3 }}>FOUNDED</div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <a href="#" onClick={(e) => e.preventDefault()} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.18em", color: c.gold, textDecoration: "none", border: `1px solid ${c.gold}`, padding: "8px 16px" }}>
              EARLY ACCESS ON PATREON
            </a>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 48px", display: "grid", gridTemplateColumns: "1fr 260px", gap: 56 }}>
        {/* Film grid */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 36 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.22em", color: c.textFaint, whiteSpace: "nowrap" }}>MOST RECENT ENTRIES</div>
            <div style={{ flex: 1, height: 1, background: c.divider }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
            {visible.map((film) => (
              <div key={film.id} style={{ cursor: "pointer" }} onMouseEnter={() => setHovered(film.id)} onMouseLeave={() => setHovered(null)}>
                <div style={{ position: "relative", overflow: "hidden", background: c.cardBg, marginBottom: 14 }}>
                  <img src={film.image} alt={film.title} style={{ width: "100%", height: 150, objectFit: "cover", display: "block", filter: hovered === film.id ? c.imgFilter2 : c.imgFilter, transition: "filter 0.3s, transform 0.3s", transform: hovered === film.id ? "scale(1.04)" : "scale(1)" }} />
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: "linear-gradient(to top, rgba(13,12,11,0.85), transparent)" }} />
                  <div style={{ position: "absolute", top: 8, right: 8, fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.12em", color: c.gold, background: c.pageBg + "d9", padding: "3px 7px", border: `1px solid ${c.goldFainter}` }}>
                    {film.decade}
                  </div>
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.14em", color: c.textDimmer, marginBottom: 6 }}>{film.date}</div>
                <h3 style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 18, fontWeight: 600, lineHeight: 1.15, marginBottom: 3, color: hovered === film.id ? c.gold : c.textPrimary, transition: "color 0.2s", letterSpacing: "-0.01em" }}>{film.title}</h3>
                <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 13, fontStyle: "italic", color: c.textFaint, marginBottom: 8 }}>{film.director}, {film.year}</div>
                <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 13, lineHeight: 1.55, color: c.textMuted }}>{film.excerpt}</p>
                <a href="#" onClick={(e) => { e.preventDefault(); if (film.title === "The Philadelphia Story") onNavigate("essay"); }}
                  style={{ display: "inline-block", marginTop: 10, fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: "0.14em", color: c.textFaint, textDecoration: "none", borderBottom: `1px solid ${c.textDimmer}`, paddingBottom: 1 }}>READ ESSAY</a>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 40, paddingTop: 24, borderTop: `1px solid ${c.divider}` }}>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)}
                style={{ width: 32, height: 32, background: page === p ? c.gold : "transparent", color: page === p ? "#0d0c0b" : c.textFaint, border: `1px solid ${c.divider}`, fontFamily: "'DM Mono', monospace", fontSize: 10, cursor: "pointer" }}>
                {p}
              </button>
            ))}
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: c.textDimmer, marginLeft: 4 }}>… 31</span>
            <button onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              style={{ marginLeft: 8, background: "transparent", border: `1px solid ${c.divider}`, padding: "6px 16px", fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: c.textMuted, cursor: "pointer" }}>
              NEXT →
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.22em", color: c.textFaint, marginBottom: 20, borderBottom: `1px solid ${c.divider}`, paddingBottom: 14 }}>LATEST REVIEWS</div>
          {LATEST_REVIEWS.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "11px 0", borderBottom: `1px solid ${c.divider}` }}>
              <div>
                <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 15, color: c.textPrimary }}>{r.title}</div>
                <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 12, fontStyle: "italic", color: c.textDimmer, marginTop: 2 }}>{r.year}</div>
              </div>
              <div style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 16, color: c.gold, fontWeight: 600 }}>{r.rating}</div>
            </div>
          ))}

          {/* Decade index */}
          <div style={{ marginTop: 32, borderTop: `1px solid ${c.divider}`, paddingTop: 20 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.22em", color: c.textFaint, marginBottom: 16 }}>BROWSE BY DECADE</div>
            {DECADES.map((d) => (
              <a key={d} href="#" onClick={(e) => e.preventDefault()}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${c.divider}`, fontFamily: "'EB Garamond', Georgia, serif", fontSize: 14, color: c.textMuted, textDecoration: "none", transition: "color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = c.gold)}
                onMouseLeave={(e) => (e.currentTarget.style.color = c.textMuted)}
              >
                <span>{d}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em" }}>→</span>
              </a>
            ))}
          </div>

          {/* Patreon CTA */}
          <div style={{ marginTop: 32, border: `1px solid ${c.goldFainter}`, padding: "20px" }}>
            <div style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 16, fontWeight: 600, fontStyle: "italic", color: c.textPrimary, marginBottom: 8 }}>Read Ahead</div>
            <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 13, lineHeight: 1.6, fontStyle: "italic", color: c.textFaint, marginBottom: 14 }}>
              New Definitives essays appear on Patreon a full year before public release.
            </p>
            <a href="#" onClick={(e) => e.preventDefault()} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.16em", color: c.gold, textDecoration: "none" }}>JOIN ON PATREON →</a>
          </div>
        </div>
      </div>
      <Footer3 onNavigate={onNavigate} />
    </div>
  );
}
