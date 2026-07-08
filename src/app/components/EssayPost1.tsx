// ©2004-2026 Deep Focus Review. All rights reserved.
import { Nav1 } from "./Nav1";
import { Footer1 } from "./Footer1";
import { SupportCTA } from "./SupportCTA";

interface Props {
  onNavigate: (page: string) => void;
}

const FILM = {
  title: "The Philadelphia Story",
  year: 1940,
  director: "George Cukor",
  cast: "Cary Grant, Katharine Hepburn, James Stewart, Ruth Hussey, John Howard, Roland Young",
  runtime: "112 min.",
  rated: "Unrated",
  release: "December 26, 1940",
  series: "The Definitives",
  author: "Brian Eggert",
  date: "May 26, 2026",
  rating: "★★★★",
  still: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/The-Philadelpha-Story-movie-still.png",
  poster: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/The-Philadelphia-Story-movie-poster.png",
};

const RECOMMENDED = [
  { title: "Crazy Rich Asians", year: 2018, image: "https://www.deepfocusreview.com/wp-content/uploads/2024/07/Crazy-Rich-Asians-2018.jpg" },
  { title: "Foreign Correspondent", year: 1940, image: "https://www.deepfocusreview.com/wp-content/uploads/2024/07/Foreign-Correspondent-1940.jpg" },
  { title: "Red River", year: 1948, image: "https://www.deepfocusreview.com/wp-content/uploads/2024/07/Red-River-1948.jpg" },
];

export function EssayPost1({ onNavigate }: Props) {
  return (
    <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", background: "#f8f7f3", minHeight: "100vh", color: "#111" }}>

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
        <Nav1 onNavigate={onNavigate} activePage="essay" />
        <div style={{ borderBottom: "3px solid #111111" }} />
      </div>

      {/* Breadcrumb */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 32px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.1em", color: "#888" }}>
          <button onClick={() => onNavigate("home")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.1em", color: "#888", padding: 0 }}>HOME</button>
          <span>›</span>
          <button onClick={() => onNavigate("definitives")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.1em", color: "#888", padding: 0 }}>THE DEFINITIVES</button>
          <span>›</span>
          <span style={{ color: "#333" }}>THE PHILADELPHIA STORY</span>
        </div>
      </div>

      {/* Article */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 32px 80px", display: "grid", gridTemplateColumns: "1fr 300px", gap: 60, alignItems: "start" }}>

        {/* Main column */}
        <article>
          {/* Series label */}
          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.16em", color: "#1e4b96", fontWeight: 600, marginBottom: 12 }}>THE DEFINITIVES</div>

          {/* Title block */}
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(36px, 5vw, 62px)", fontWeight: 700, lineHeight: 1.0, letterSpacing: "-0.025em", color: "#111", marginBottom: 8 }}>
            The Philadelphia Story
          </h1>
          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, color: "#777", letterSpacing: "0.06em", marginBottom: 20 }}>
            GEORGE CUKOR &nbsp;·&nbsp; 1940
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid rgba(0,0,0,0.1)" }}>
            <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, color: "#1e4b96" }}>{FILM.rating}</span>
            <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.06em", fontStyle: "italic" }}>By {FILM.author} &nbsp;·&nbsp; {FILM.date}</span>
          </div>

          {/* Hero still */}
          <div style={{ marginBottom: 32, overflow: "hidden", background: "#ddd" }}>
            <img src={FILM.still} alt="The Philadelphia Story" style={{ width: "100%", maxHeight: 480, objectFit: "cover", display: "block" }} />
          </div>

          {/* Essay body */}
          <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 18, lineHeight: 1.8, color: "#222" }}>
            <p style={{ marginBottom: 24 }}>
              In the winter of 1938, Katharine Hepburn was declared "box-office poison" by the Independent Theatre Owners of America — a verdict that felt, at the time, like the end of a career. Her films had underperformed. Studios grew cold. Hollywood, as it often does, began its preparations to forget her.
            </p>
            <p style={{ marginBottom: 24 }}>
              What happened next was not a rescue but a reclamation. Hepburn bought the film rights to Philip Barry's Broadway play <em>The Philadelphia Story</em> herself, secured Howard Hughes's financial backing, hand-picked her collaborators, and arrived in Hollywood holding all the cards. George Cukor was brought in to direct. Cary Grant and James Stewart were cast opposite her. The result — released on December 26, 1940 — was not merely a comeback. It was a statement of intent.
            </p>
            <p style={{ marginBottom: 24 }}>
              The film follows Tracy Lord (Hepburn), a socialite preparing to remarry, whose plans are disrupted by the arrival of her ex-husband C. K. Dexter Haven (Grant) and a pair of tabloid journalists (Stewart and Ruth Hussey). What unfolds is one of Hollywood's most dazzling exercises in screwball comedy: verbal sparring at extraordinary velocity, romantic triangles that keep rearranging themselves, and underneath all the wit, a searching examination of what it means to hold other people — and yourself — to impossible standards.
            </p>

            {/* Pull quote */}
            <blockquote style={{ borderLeft: "3px solid #1e4b96", paddingLeft: 24, margin: "36px 0", fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontStyle: "italic", lineHeight: 1.5, color: "#222" }}>
              "The film succeeded not by changing who Hepburn was, but by revealing the vulnerable, messy, and relatable human being beneath her perceived East Coast elitism."
            </blockquote>

            <p style={{ marginBottom: 24 }}>
              Cukor understood his star better than almost any director she worked with. He knew that Hepburn's particular brand of intelligence — sharp, unwilling to suffer fools — could read, in the wrong frame, as coldness. <em>The Philadelphia Story</em> lets that quality breathe, then punctures it with grace. Tracy Lord begins the film as an idol, untouchable and perfect, and ends it as something richer: a woman who has learned to forgive herself.
            </p>
            <p style={{ marginBottom: 24 }}>
              James Stewart, in a role that won him his only Academy Award, functions as the film's moral center — a writer of conscience who finds himself falling for Tracy precisely because she is not quite who she appears to be. Grant, given less conventional material, is arguably more interesting: quiet, watchful, deploying his charm as a kind of restraint. The three together create a chemistry that the film never overexplains, which is part of why it endures.
            </p>
          </div>

          {/* Patreon paywall */}
          <div style={{ margin: "40px 0", background: "#111", color: "#f8f7f3", padding: "32px", textAlign: "center" }}>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.16em", color: "#fff", marginBottom: 12 }}>CONTINUE READING</div>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 600, fontStyle: "italic", marginBottom: 12 }}>This essay continues on Patreon</div>
            <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 14, lineHeight: 1.6, color: "rgba(248,247,243,0.65)", marginBottom: 24, maxWidth: 460, margin: "0 auto 24px" }}>
              Supporters get early access to all Definitives essays — typically a full year before they appear publicly. The full piece runs approximately 3,500 words.
            </p>
            <button style={{ background: "#1e4b96", color: "#fff", border: "none", padding: "12px 28px", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, cursor: "pointer" }}>
              READ ON PATREON →
            </button>
          </div>

          <SupportCTA />

          {/* Recommended */}
          <div style={{ marginTop: 48 }}>
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
                  <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontWeight: 600, lineHeight: 1.2, marginBottom: 2 }}>{r.title}</div>
                  <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "#888", letterSpacing: "0.06em" }}>{r.year}</div>
                </div>
              ))}
            </div>
          </div>
        </article>

        {/* Sidebar */}
        <aside style={{ paddingTop: 4 }}>
          {/* Poster */}
          <div style={{ marginBottom: 28, overflow: "hidden", background: "#ddd", boxShadow: "4px 6px 20px rgba(0,0,0,0.15)" }}>
            <img src={FILM.poster} alt="The Philadelphia Story poster" style={{ width: "100%", display: "block" }} />
          </div>

          {/* Film details */}
          <div style={{ borderTop: "2px solid #111", paddingTop: 16, marginBottom: 24 }}>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, color: "#111", marginBottom: 16 }}>FILM DETAILS</div>
            {[
              { label: "DIRECTOR", node: <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "#1e4b96", textDecoration: "none" }} onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "underline")} onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "none")}>{FILM.director}</a> },
              { label: "CAST", node: <>{FILM.cast.split(", ").map((name, i) => <span key={name}>{i > 0 && ", "}<a href="#" onClick={(e) => e.preventDefault()} style={{ color: "#1e4b96", textDecoration: "none" }} onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "underline")} onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "none")}>{name}</a></span>)}</> },
              { label: "RUNTIME", node: FILM.runtime },
              { label: "RATED", node: FILM.rated },
              { label: "RELEASE", node: FILM.release },
            ].map(({ label, node }) => (
              <div key={label} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.14em", color: "#999", marginBottom: 3 }}>{label}</div>
                <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, lineHeight: 1.5, color: "#222" }}>{node}</div>
              </div>
            ))}
          </div>

          {/* Back to series */}
          <button onClick={() => onNavigate("definitives")}
            style={{ width: "100%", background: "none", border: "1px solid rgba(0,0,0,0.2)", padding: "10px 16px", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.12em", color: "#333", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>← BACK TO THE DEFINITIVES</span>
          </button>
        </aside>
      </div>
      <Footer1 onNavigate={onNavigate} />
    </div>
  );
}
