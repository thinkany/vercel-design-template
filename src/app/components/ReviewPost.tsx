// ©2004-2026 Deep Focus Review. All rights reserved.
import { Nav1 } from "./Nav1";
import { SupportCTA } from "./SupportCTA";
import { Nav2 } from "./Nav2";
import { Nav3 } from "./Nav3";
import { Footer1 } from "./Footer1";
import { Footer2 } from "./Footer2";
import { Footer3 } from "./Footer3";
import { useC3Theme } from "./c3Theme";

interface Props {
  onNavigate: (page: string) => void;
  direction: 1 | 2 | 3;
}

const FILM = {
  title: "Backrooms",
  year: 2026,
  director: "Kane Parsons",
  rating: "★★★",
  mpaa: "R",
  runtime: "110 min.",
  release: "May 29, 2026",
  distributor: "A24",
  cast: [
    { actor: "Chiwetel Ejiofor", role: "Clark" },
    { actor: "Renate Reinsve", role: "Dr. Mary Kline" },
    { actor: "Mark Duplass", role: "Async scientist" },
    { actor: "Finn Bennett", role: "videographer boyfriend" },
    { actor: "Lukita Maxwell", role: "Clark's employee" },
  ],
  author: "Brian Eggert",
  date: "May 29, 2026",
  still1: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Backrooms-movie-still-2.png",
  still2: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Backrooms-movie-still-1-1024x576.png",
  poster: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Backrooms-movie-poster.png",
};

const RECOMMENDED = [
  { title: "The Wailing", year: 2016, image: "https://www.deepfocusreview.com/wp-content/uploads/2024/07/The-Wailing-2016.jpg" },
  { title: "Heretic", year: 2024, image: "https://www.deepfocusreview.com/wp-content/uploads/2024/11/Heretic-Movie-Poster.png" },
  { title: "The Fearless Vampire Killers", year: 1967, image: "https://www.deepfocusreview.com/wp-content/uploads/2024/07/The-Fearless-Vampire-Killers-or-Pardon-Me-But-Your-Teeth-Are-in-My-Neck-1967.jpg" },
];

const LATEST = [
  { title: "Chum", year: 2026, image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Chum-movie-poster.png" },
  { title: "Renoir", year: 2026, image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Renoir-movie-poster.png" },
  { title: "Backrooms", year: 2026, image: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/Backrooms-movie-poster.png" },
];

const BODY_PARAGRAPHS = [
  `Kane Parsons began making YouTube shorts at sixteen. He was twenty when he shot Backrooms, a remarkably assured debut feature set largely inside an abandoned, decades-old waiting room that keeps going — and going — until the geometry of the place stops obeying the rules of the world outside. It is, at various moments, an M.C. Escher drawing, a Salvador Dalí canvas, and a very plausible explanation for why certain corridors feel wrong.`,
  `The backrooms concept traces to a 2019 anonymous post on 4chan: a single image of a yellowed office space, captioned with lore. Parsons ran with it. His 24-episode web series, The Backrooms: Found Footage, released under the alias Kane Pixels in 2022, accumulated millions of views and secured a $10 million feature deal. The premise was already a phenomenon. The question was whether a feature could justify it.`,
  `Set in 1990 — the aesthetic commitment is total — the film opens with a VHS found-footage prologue before introducing Clark (Chiwetel Ejiofor), a furniture store owner sleeping in his own showroom after a separation. He discovers the place by accident, enters it, and cannot immediately leave. His therapist, Dr. Mary Kline (Renate Reinsve), carries her own unresolved grief into their sessions. When Clark enlists his employee and her boyfriend to document what he's found, the group sets off into spaces that seem to know them.`,
  `Something lurks inside — tall, angular creatures that recall the environmental horror of Silent Hill. The film's monster design is practical and uncanny, built from Blender composites and real sets that cinematographer Jeremy Cox shoots on unsettling wide-angle lenses with close-following handheld work. Production designer Danny Vermette supplies the film's variety: yellow carpeted rooms, white-tiled chambers flooding with water, and a central hub that mirrors Escher's Relativity. Mary eventually enters the backrooms herself, through a tiny door that could have come from Alice in Wonderland.`,
  `Will Soodik's screenplay deploys psychological framing with a light touch. Mary explains: "We all have our loops" — a thesis tied to childhood patterns the characters carry into the space. The structure recalls Lost in its layering of mysterious agency, metaphysical rules, and a mythology that always feels on the cusp of a new revelation. Eggert places the film within a liminal horror subgenre alongside Skinamarink (2023) and Exit 8 — works where the horror is spatial rather than narrative, where dread lives in the wrongness of a given room.`,
  `Reinsve is especially good. Her performance is the film's emotional anchor: precise, economical, alert to the way Mary's composed professional manner keeps failing at the edges. Ejiofor does strong work with a more reactive role. Together they make a strange, convincing pair. The film earns its comparison to Annihilation — not in ambition or scale, but in its understanding that the most frightening thing a space can do is reflect something back.`,
  `Backrooms is not without wobble. The third act reaches for revelation and finds something a little shy of it — the mythology, in explanation, is less interesting than the mystery it answers. But Parsons holds his nerve through the slow stretches, trusts his images, and delivers a well-crafted, horrifying, experiential funhouse ride. For a first feature made by someone who learned filmmaking on YouTube, it is genuinely remarkable.`,
];

// ── Direction 1 layout ─────────────────────────────────────────────────────

function Layout1({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", background: "#f8f7f3", minHeight: "100vh", color: "#111" }}>

      

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
        <Nav1 onNavigate={onNavigate} activePage="reviews" />
        <div style={{ borderBottom: "3px solid #111111" }} />
      </div>

      {/* Breadcrumb */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 32px 0", display: "flex", alignItems: "center", gap: 8, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.1em", color: "#888" }}>
        <button onClick={() => onNavigate("home")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", letterSpacing: "inherit", color: "inherit", padding: 0 }}>HOME</button>
        <span>›</span>
        <button onClick={() => onNavigate("reviews")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", letterSpacing: "inherit", color: "inherit", padding: 0 }}>REVIEWS A–Z</button>
        <span>›</span>
        <span style={{ color: "#333" }}>BACKROOMS</span>
      </div>

      {/* Hero still */}
      <div style={{ maxWidth: 1200, margin: "24px auto 0", padding: "0 32px" }}>
        <div style={{ overflow: "hidden", background: "#ddd" }}>
          <img src={FILM.still1} alt="Backrooms" style={{ width: "100%", maxHeight: 520, objectFit: "cover", display: "block" }} />
        </div>
      </div>

      {/* Article + sidebar */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 32px 80px", display: "grid", gridTemplateColumns: "1fr 300px", gap: 56, alignItems: "start" }}>

        <article>
          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.16em", color: "#1e4b96", fontWeight: 600, marginBottom: 12 }}>FILM REVIEW</div>
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 700, lineHeight: 1.0, letterSpacing: "-0.025em", color: "#111", marginBottom: 6 }}>Backrooms</h1>
          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, color: "#777", letterSpacing: "0.06em", marginBottom: 20 }}>KANE PARSONS &nbsp;·&nbsp; 2026</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid rgba(0,0,0,0.1)" }}>
            <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, color: "#1e4b96" }}>{FILM.rating}</span>
            <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.06em", fontStyle: "italic" }}>By {FILM.author} &nbsp;·&nbsp; {FILM.date}</span>
          </div>

          <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 18, lineHeight: 1.85, color: "#222" }}>
            {BODY_PARAGRAPHS.map((p, i) => (
              <p key={i} style={{ marginBottom: 24 }}>{p}</p>
            ))}
          </div>

          {/* Second still mid-article */}
          <div style={{ margin: "36px 0", overflow: "hidden", background: "#ddd" }}>
            <img src={FILM.still2} alt="Backrooms still" style={{ width: "100%", objectFit: "cover", display: "block" }} />
          </div>

          {/* Star rating footer */}
          <div style={{ borderTop: "2px solid #111", paddingTop: 20, display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, color: "#1e4b96" }}>{FILM.rating}</span>
            <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.08em" }}>{FILM.title.toUpperCase()} &nbsp;·&nbsp; {FILM.year} &nbsp;·&nbsp; {FILM.director.toUpperCase()}</span>
          </div>

          <SupportCTA />

          {/* Recommended */}
          <div style={{ marginTop: 56 }}>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, color: "#111", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <span>RECOMMENDED</span>
              <span style={{ flex: 1, borderTop: "1px solid rgba(0,0,0,0.1)" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
              {RECOMMENDED.map((r) => (
                <div key={r.title} style={{ cursor: "pointer" }}>
                  <div style={{ overflow: "hidden", background: "#ddd", marginBottom: 10 }}>
                    <img src={r.image} alt={r.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    />
                  </div>
                  <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{r.title}</div>
                  <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "#888", letterSpacing: "0.06em" }}>{r.year}</div>
                </div>
              ))}
            </div>
          </div>
        </article>

        {/* Sidebar */}
        <aside style={{ paddingTop: 4 }}>
          <div style={{ overflow: "hidden", background: "#ddd", marginBottom: 28, boxShadow: "4px 6px 20px rgba(0,0,0,0.15)" }}>
            <img src={FILM.poster} alt="Backrooms poster" style={{ width: "100%", display: "block" }} />
          </div>

          <div style={{ borderTop: "2px solid #111", paddingTop: 16, marginBottom: 24 }}>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, color: "#111", marginBottom: 16 }}>FILM DETAILS</div>
            {[
              { label: "DIRECTOR", node: <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "#1e4b96", textDecoration: "none" }} onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "underline")} onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "none")}>{FILM.director}</a> },
              { label: "CAST", node: <>{FILM.cast.map((c, i) => <span key={c.actor}>{i > 0 && ", "}<a href="#" onClick={(e) => e.preventDefault()} style={{ color: "#1e4b96", textDecoration: "none" }} onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "underline")} onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "none")}>{c.actor}</a><span style={{ color: "#555" }}>{` as ${c.role}`}</span></span>)}</> },
              { label: "RATED", node: FILM.mpaa },
              { label: "RUNTIME", node: FILM.runtime },
              { label: "RELEASE", node: FILM.release },
              { label: "DISTRIBUTOR", node: FILM.distributor },
            ].map(({ label, node }) => (
              <div key={label} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.14em", color: "#999", marginBottom: 3 }}>{label}</div>
                <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, lineHeight: 1.5, color: "#222" }}>{node}</div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: "2px solid #111", paddingTop: 16 }}>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, color: "#111", marginBottom: 16 }}>LATEST REVIEWS</div>
            {LATEST.map((r) => (
              <div key={r.title} style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: 10, marginBottom: 14, alignItems: "center" }}>
                <img src={r.image} alt={r.title} style={{ width: 48, height: 68, objectFit: "cover", display: "block" }} />
                <div>
                  <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 13, fontWeight: 600, color: "#111" }}>{r.title}</div>
                  <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "#888", letterSpacing: "0.04em", marginTop: 2 }}>{r.year}</div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => onNavigate("reviews")} style={{ marginTop: 20, width: "100%", background: "none", border: "1px solid rgba(0,0,0,0.2)", padding: "10px 16px", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.12em", color: "#333", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between" }}>
            <span>← ALL REVIEWS A–Z</span>
          </button>
        </aside>
      </div>
      <Footer1 onNavigate={onNavigate} />
    </div>
  );
}

// ── Direction 2 layout ─────────────────────────────────────────────────────

function Layout2({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", background: "#faf8f3", minHeight: "100vh", color: "#1a1612" }}>

      <header style={{ maxWidth: 900, margin: "0 auto", padding: "48px 32px 0" }}>
        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, color: "#a0856a", marginBottom: 8, whiteSpace: "nowrap" }}>since 2004 ↓</div>
        <div style={{ borderBottom: "1.5px solid #c9b99a", paddingBottom: 24 }}>
          <button onClick={() => onNavigate("home")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
            <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(36px, 6vw, 62px)", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.025em", color: "#1a1612", marginBottom: 6 }}>Deep Focus Review</div>
            <p style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 17, fontStyle: "italic", color: "#7a6655", lineHeight: 1.4 }}>A film journal by Brian Eggert — notes from the dark.</p>
          </button>
        </div>
        <Nav2 onNavigate={onNavigate} activePage="reviews" />
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 32px 80px", display: "grid", gridTemplateColumns: "1fr 200px", gap: 48, alignItems: "start" }}>

        <article>
          {/* Breadcrumb */}
          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, color: "#b89a7e", marginBottom: 20 }}>
            <button onClick={() => onNavigate("reviews")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, color: "#b89a7e", padding: 0 }}>← Reviews A–Z</button>
          </div>

          {/* Hero still */}
          <div style={{ marginBottom: 32, transform: "rotate(-0.4deg)", boxShadow: "4px 6px 20px rgba(0,0,0,0.12)", background: "#ccc", overflow: "hidden" }}>
            <img src={FILM.still1} alt="Backrooms" style={{ width: "100%", maxHeight: 400, objectFit: "cover", display: "block" }} />
          </div>

          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 15, color: "#a0856a", marginBottom: 8 }}>film review</div>
          <h1 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(30px, 5vw, 50px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.02em", color: "#1a1612", marginBottom: 6 }}>Backrooms</h1>
          <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 16, fontStyle: "italic", color: "#9a8070", marginBottom: 12 }}>{FILM.director}, {FILM.year}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid #ddd2c0" }}>
            <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 20, color: "#7a6655" }}>{FILM.rating}</span>
            <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, color: "#b89a7e" }}>{FILM.author} · {FILM.date}</span>
          </div>

          <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 19, lineHeight: 1.85, color: "#2d2420" }}>
            {BODY_PARAGRAPHS.map((p, i) => (
              <p key={i} style={{ marginBottom: 26 }}>{p}</p>
            ))}
          </div>

          {/* Pull quote */}
          <div style={{ margin: "40px 0", padding: "20px 24px", borderLeft: "3px solid #c9b99a", background: "#f0e8da" }}>
            <p style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 18, color: "#7a6655", lineHeight: 1.6, margin: 0 }}>
              "A well-crafted, horrifying, experiential funhouse ride from a talented first-time filmmaker."
            </p>
          </div>

          {/* Second still */}
          <div style={{ margin: "36px 0", transform: "rotate(0.3deg)", boxShadow: "3px 4px 16px rgba(0,0,0,0.1)", background: "#ccc", overflow: "hidden" }}>
            <img src={FILM.still2} alt="Backrooms still" style={{ width: "100%", objectFit: "cover", display: "block" }} />
          </div>

          {/* Rating footer */}
          <div style={{ borderTop: "1.5px solid #c9b99a", paddingTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 26, color: "#7a6655" }}>{FILM.rating}</span>
            <span style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 14, fontStyle: "italic", color: "#9a8070" }}>{FILM.title}, {FILM.year}</span>
          </div>

          {/* Recommended */}
          <div style={{ marginTop: 52 }}>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 20, color: "#a0856a", marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
              <span>You might also enjoy</span>
              <span style={{ flex: 1, borderBottom: "1px dashed #c9b99a", marginBottom: 3 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
              {RECOMMENDED.map((r) => (
                <div key={r.title}>
                  <div style={{ transform: "rotate(-0.3deg)", boxShadow: "2px 4px 12px rgba(0,0,0,0.1)", background: "#ccc", overflow: "hidden", marginBottom: 10 }}>
                    <img src={r.image} alt={r.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                  </div>
                  <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 14, fontWeight: 600, color: "#1a1612", marginBottom: 2 }}>{r.title}</div>
                  <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 12, fontStyle: "italic", color: "#9a8070" }}>{r.year}</div>
                </div>
              ))}
            </div>
          </div>
        </article>

        {/* Sidebar */}
        <aside style={{ paddingTop: 4 }}>
          <div style={{ transform: "rotate(0.5deg)", boxShadow: "3px 5px 16px rgba(0,0,0,0.15)", background: "#ccc", overflow: "hidden", marginBottom: 28 }}>
            <img src={FILM.poster} alt="Backrooms poster" style={{ width: "100%", display: "block" }} />
          </div>

          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 16, color: "#a0856a", marginBottom: 14, borderBottom: "1px dashed #c9b99a", paddingBottom: 8 }}>Film details</div>
          {[
            { label: "Director", value: FILM.director },
            { label: "Rated", value: FILM.mpaa },
            { label: "Runtime", value: FILM.runtime },
            { label: "Release", value: FILM.release },
            { label: "Distributor", value: FILM.distributor },
          ].map(({ label, value }) => (
            <div key={label} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid rgba(201,185,154,0.3)" }}>
              <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, color: "#b89a7e", marginBottom: 2 }}>{label}</div>
              <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 13, lineHeight: 1.5, fontStyle: "italic", color: "#5a4a3c" }}>{value}</div>
            </div>
          ))}

          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 16, color: "#a0856a", marginBottom: 14, marginTop: 24, borderBottom: "1px dashed #c9b99a", paddingBottom: 8 }}>Latest</div>
          {LATEST.map((r) => (
            <div key={r.title} style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 8, marginBottom: 12, alignItems: "center" }}>
              <img src={r.image} alt={r.title} style={{ width: 44, height: 62, objectFit: "cover", display: "block" }} />
              <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 13, fontStyle: "italic", color: "#5a4a3c" }}>{r.title} <span style={{ color: "#b89a7e" }}>({r.year})</span></div>
            </div>
          ))}
        </aside>
      </div>
      <Footer2 onNavigate={onNavigate} />
    </div>
  );
}

// ── Direction 3 layout ─────────────────────────────────────────────────────

function Layout3({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { c } = useC3Theme();
  return (
    <div style={{ background: c.pageBg, minHeight: "100vh", color: c.textPrimary, transition: "background 0.2s" }}>

      <Nav3 onNavigate={onNavigate} activePage="reviews" />

      {/* Full-bleed hero */}
      <div style={{ position: "relative", height: 480, overflow: "hidden" }}>
        <img src={FILM.still1} alt="Backrooms" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: c.imgFilter2 }} />
        <div style={{ position: "absolute", inset: 0, background: c.heroGradient }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 48px 40px" }}>
            <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 11, letterSpacing: "0.2em", color: c.gold, marginBottom: 10 }}>FILM REVIEW · A24 · {FILM.year}</div>
            <h1 style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: "clamp(28px, 4.2vw, 50px)", fontWeight: 700, lineHeight: 1, letterSpacing: "0.02em", color: c.textHero, marginBottom: 10 }}>Backrooms</h1>
            <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 17, fontStyle: "italic", color: "rgba(240,232,216,0.55)" }}>Kane Parsons, 2026</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 48px 80px", display: "grid", gridTemplateColumns: "1fr 260px", gap: 64, alignItems: "start" }}>

        <article>
          {/* Breadcrumb + byline */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36, paddingBottom: 20, borderBottom: `1px solid ${c.border}` }}>
            <button onClick={() => onNavigate("reviews")} style={{ background: "none", border: `1px solid ${c.goldFainter}`, padding: "6px 14px", cursor: "pointer", fontFamily: "'EB Garamond', Georgia, serif", fontSize: 12, letterSpacing: "0.1em", color: c.goldMuted }}>
              ← Reviews A–Z
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 24, color: c.gold }}>{FILM.rating}</span>
              <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 13, color: c.goldMuted, letterSpacing: "0.06em" }}>{FILM.author} · {FILM.date}</span>
            </div>
          </div>

          <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 19, lineHeight: 1.9, color: c.textBody }}>
            {BODY_PARAGRAPHS.map((p, i) => (
              <p key={i} style={{ marginBottom: 28 }}>{p}</p>
            ))}
          </div>

          {/* Pull quote */}
          <div style={{ margin: "44px 0", padding: "28px 36px", border: `1px solid ${c.goldFainter}`, borderLeft: `3px solid ${c.gold}`, background: c.surfaceTint }}>
            <p style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 20, fontStyle: "italic", lineHeight: 1.55, color: c.gold, margin: 0 }}>
              "A well-crafted, horrifying, experiential funhouse ride from a talented first-time filmmaker."
            </p>
          </div>

          {/* Second still */}
          <div style={{ margin: "36px 0", overflow: "hidden", background: c.cardBg }}>
            <img src={FILM.still2} alt="Backrooms still" style={{ width: "100%", objectFit: "cover", display: "block", opacity: 0.88 }} />
          </div>

          {/* Rating footer */}
          <div style={{ borderTop: `1px solid ${c.goldFainter}`, paddingTop: 24, display: "flex", alignItems: "center", gap: 20 }}>
            <span style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 32, color: c.gold }}>{FILM.rating}</span>
            <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 14, fontStyle: "italic", color: c.goldMuted, letterSpacing: "0.06em" }}>{FILM.title}, {FILM.year} · {FILM.director}</span>
          </div>

          {/* Recommended */}
          <div style={{ marginTop: 56 }}>
            <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 11, letterSpacing: "0.2em", color: c.gold, marginBottom: 24, display: "flex", alignItems: "center", gap: 16 }}>
              <span>RECOMMENDED</span>
              <span style={{ flex: 1, borderTop: `1px solid ${c.border}` }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
              {RECOMMENDED.map((r) => (
                <div key={r.title} style={{ cursor: "pointer" }}>
                  <div style={{ overflow: "hidden", background: c.cardBg, marginBottom: 12 }}>
                    <img src={r.image} alt={r.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block", filter: c.imgFilter }}
                      onMouseEnter={(e) => (e.currentTarget.style.filter = c.imgFilter2)}
                      onMouseLeave={(e) => (e.currentTarget.style.filter = c.imgFilter)}
                    />
                  </div>
                  <div style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 14, color: c.textPrimary, marginBottom: 2 }}>{r.title}</div>
                  <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 12, color: c.goldFaint, letterSpacing: "0.06em" }}>{r.year}</div>
                </div>
              ))}
            </div>
          </div>
        </article>

        {/* Sidebar */}
        <aside style={{ paddingTop: 4 }}>
          <div style={{ overflow: "hidden", background: c.cardBg, marginBottom: 32, boxShadow: "6px 8px 30px rgba(0,0,0,0.35)" }}>
            <img src={FILM.poster} alt="Backrooms poster" style={{ width: "100%", display: "block", opacity: 0.92 }} />
          </div>

          <div style={{ borderTop: `1px solid ${c.goldFaint}`, paddingTop: 20, marginBottom: 24 }}>
            <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 10, letterSpacing: "0.18em", color: c.gold, marginBottom: 20 }}>FILM DETAILS</div>
            {[
              { label: "DIRECTOR", value: FILM.director },
              { label: "RATED", value: FILM.mpaa },
              { label: "RUNTIME", value: FILM.runtime },
              { label: "RELEASE", value: FILM.release },
              { label: "DISTRIBUTOR", value: FILM.distributor },
              { label: "CAST", value: FILM.cast.map(fc => fc.actor).join(", ") },
            ].map(({ label, value }) => (
              <div key={label} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${c.borderFaint}` }}>
                <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 9, letterSpacing: "0.16em", color: c.goldMuted, marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 14, lineHeight: 1.5, color: c.textSub }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 20 }}>
            <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 10, letterSpacing: "0.18em", color: c.gold, marginBottom: 16 }}>LATEST REVIEWS</div>
            {LATEST.map((r) => (
              <div key={r.title} style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 10, marginBottom: 14, alignItems: "center" }}>
                <img src={r.image} alt={r.title} style={{ width: 44, height: 62, objectFit: "cover", display: "block", filter: c.imgFilter }} />
                <div>
                  <div style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 13, color: c.textPrimary }}>{r.title}</div>
                  <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 11, color: c.goldFaint, marginTop: 2 }}>{r.year}</div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
      <Footer3 onNavigate={onNavigate} />
    </div>
  );
}

// ── Export ──────────────────────────────────────────────────────────────────

export function ReviewPost({ onNavigate, direction }: Props) {
  if (direction === 2) return <Layout2 onNavigate={onNavigate} />;
  if (direction === 3) return <Layout3 onNavigate={onNavigate} />;
  return <Layout1 onNavigate={onNavigate} />;
}
