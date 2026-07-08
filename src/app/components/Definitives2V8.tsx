// ©2004-2026 Deep Focus Review. All rights reserved.
import { useState } from "react";
import { DEFINITIVES_INTRO, LATEST_REVIEWS } from "./definitivesData";
import { Nav2 } from "./Nav2";
import { SITE_DEFINITIVES_FILMS } from "./siteData";
import { Footer2 } from "./Footer2";

interface Props {
  onNavigate: (page: string) => void;
}

export function Definitives2V8({ onNavigate }: Props) {
  const [page, setPage] = useState(1);
  const perPage = 5;
  const totalPages = Math.ceil(SITE_DEFINITIVES_FILMS.length / perPage);
  const visible = SITE_DEFINITIVES_FILMS.slice((page - 1) * perPage, page * perPage);

  return (
    <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", background: "#faf8f3", minHeight: "100vh", color: "#1a1612" }}>
      {/* Header */}
      <header style={{ maxWidth: 900, margin: "0 auto", padding: "48px 32px 0" }}>
        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, color: "#a0856a", marginBottom: 8, whiteSpace: "nowrap" }}>since 2004 ↓</div>
        <div style={{ borderBottom: "1.5px solid #c9b99a", paddingBottom: 24 }}>
          <button onClick={() => onNavigate("home")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
            <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(36px, 6vw, 62px)", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.025em", color: "#1a1612", marginBottom: 6 }}>Deep Focus Review</div>
            <p style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 17, fontStyle: "italic", color: "#7a6655", lineHeight: 1.4 }}>A film journal by Brian Eggert — notes from the dark.</p>
          </button>
        </div>
        <Nav2 onNavigate={onNavigate} activePage="definitives" />
      </header>

      {/* Page title */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "52px 32px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 48, alignItems: "start" }}>
          <div>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 16, color: "#a0856a", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <span>an ongoing series</span>
              <span style={{ flex: 1, borderBottom: "1px dashed #c9b99a" }} />
            </div>
            <h1 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(40px, 6vw, 68px)", fontWeight: 700, lineHeight: 0.95, letterSpacing: "-0.025em", color: "#1a1612", marginBottom: 24 }}>
              The<br /><em>Definitives</em>
            </h1>
            <blockquote style={{ borderLeft: "3px solid #c9b99a", paddingLeft: 20, margin: "0 0 32px", fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 17, fontStyle: "italic", lineHeight: 1.7, color: "#5a4a3c" }}>
              {DEFINITIVES_INTRO}
            </blockquote>
          </div>

          <div style={{ paddingTop: 60 }}>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 18, color: "#a0856a", marginBottom: 16, borderBottom: "1px dashed #c9b99a", paddingBottom: 10 }}>Archive</div>
            <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 42, fontWeight: 700, lineHeight: 1, color: "#1a1612", marginBottom: 4 }}>300+</div>
            <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 14, fontStyle: "italic", color: "#9a8070", marginBottom: 20 }}>essays, and counting.</div>
            <p style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 13, lineHeight: 1.6, fontStyle: "italic", color: "#7a6655" }}>
              New essays debut on Patreon — early access for supporters.
            </p>
            <a href="#" onClick={(e) => e.preventDefault()} style={{ display: "inline-block", marginTop: 12, fontFamily: "'Lora', Georgia, serif", fontSize: 13, fontStyle: "italic", color: "#7a6655", textDecoration: "underline", textDecorationColor: "#c9b99a", textUnderlineOffset: 3 }}>
              Join on Patreon →
            </a>
          </div>
        </div>

        {/* Main entries + sidebar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 48, marginTop: 48 }}>
          <div>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 20, color: "#a0856a", marginBottom: 28, display: "flex", alignItems: "center", gap: 10 }}>
              <span>Most recent essays</span>
              <span style={{ flex: 1, borderBottom: "1px dashed #c9b99a", marginBottom: 3 }} />
            </div>

            {visible.map((film) => (
              <article key={film.id} style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 20, marginBottom: 36, paddingBottom: 36, borderBottom: "1px solid #ddd2c0" }}>
                <div style={{ transform: "rotate(-0.4deg)", boxShadow: "2px 4px 12px rgba(0,0,0,0.1)", background: "#ccc", overflow: "hidden", flexShrink: 0 }}>
                  <img src={film.image} alt={film.title} style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
                </div>
                <div>
                  <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, color: "#b89a7e", marginBottom: 6 }}>{film.date} · {film.decade}</div>
                  <h2 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 22, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.015em", marginBottom: 3, color: "#1a1612" }}>{film.title}</h2>
                  <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 13, fontStyle: "italic", color: "#9a8070", marginBottom: 10 }}>{film.director}, {film.year}</div>
                  <p style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 16, lineHeight: 1.65, color: "#2d2420" }}>{film.excerpt}</p>
                  <a href="#" onClick={(e) => { e.preventDefault(); if (film.title === "The Philadelphia Story") onNavigate("essay"); }}
                    style={{ display: "inline-block", marginTop: 10, fontFamily: "'Lora', Georgia, serif", fontSize: 13, fontStyle: "italic", color: "#7a6655", textDecoration: "underline", textDecorationColor: "#c9b99a", textUnderlineOffset: 3 }}>
                    Read the essay →
                  </a>
                </div>
              </article>
            ))}

            {/* Pagination */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 8 }}>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: 30, height: 30, background: page === p ? "#7a6655" : "transparent", color: page === p ? "#faf8f3" : "#7a6655", border: "1px solid #c9b99a", fontFamily: "'Lora', Georgia, serif", fontSize: 13, cursor: "pointer", borderRadius: 1 }}>
                  {p}
                </button>
              ))}
              <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, color: "#b89a7e" }}>… 31</span>
              <button onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                style={{ background: "none", border: "none", fontFamily: "'Lora', Georgia, serif", fontSize: 13, fontStyle: "italic", color: "#7a6655", cursor: "pointer" }}>
                next →
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <aside>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 18, color: "#a0856a", marginBottom: 16, borderBottom: "1px dashed #c9b99a", paddingBottom: 10 }}>Latest reviews</div>
            {LATEST_REVIEWS.map((r, i) => (
              <div key={i} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(201,185,154,0.3)" }}>
                <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{r.title}</div>
                <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 13, fontStyle: "italic", color: "#9a8070" }}>{r.year} · {r.rating}</div>
              </div>
            ))}

            <div style={{ marginTop: 24, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 18, color: "#a0856a", marginBottom: 16, borderBottom: "1px dashed #c9b99a", paddingBottom: 10 }}>Browse by decade</div>
            {["1920s","1930s","1940s","1950s","1960s","1970s","1980s","1990s","2000s","2010s","2020s"].map((d) => (
              <a key={d} href="#" onClick={(e) => e.preventDefault()} style={{ display: "block", fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 14, fontStyle: "italic", color: "#7a6655", textDecoration: "none", padding: "4px 0", borderBottom: "1px solid rgba(201,185,154,0.2)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#1a1612")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#7a6655")}
              >{d}</a>
            ))}
          </aside>
        </div>
      </div>
      <div style={{ height: 80 }} />
      <Footer2 onNavigate={onNavigate} />
    </div>
  );
}
