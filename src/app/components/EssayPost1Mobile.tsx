// ©2004-2026 Deep Focus Review. All rights reserved.
import { MobileMasthead, MobileFooter } from "./MobileShared";

const FILM = {
  title: "The Philadelphia Story",
  year: 1940,
  director: "George Cukor",
  cast: "Cary Grant, Katharine Hepburn, James Stewart, Ruth Hussey, John Howard, Roland Young",
  runtime: "112 min.",
  rated: "Unrated",
  release: "December 26, 1940",
  author: "Brian Eggert",
  date: "May 26, 2026",
  rating: "★★★★",
  still: "https://www.deepfocusreview.com/wp-content/uploads/2026/05/The-Philadelpha-Story-movie-still.png",
};

const RECOMMENDED = [
  { title: "Crazy Rich Asians", year: 2018, image: "https://www.deepfocusreview.com/wp-content/uploads/2024/07/Crazy-Rich-Asians-2018.jpg" },
  { title: "Foreign Correspondent", year: 1940, image: "https://www.deepfocusreview.com/wp-content/uploads/2024/07/Foreign-Correspondent-1940.jpg" },
  { title: "Red River", year: 1948, image: "https://www.deepfocusreview.com/wp-content/uploads/2024/07/Red-River-1948.jpg" },
];

export function EssayPost1Mobile({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const navigate = onNavigate ?? (() => {});

  return (
    <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", background: "#f8f7f3", minHeight: "100vh", color: "#111", maxWidth: 430, margin: "0 auto" }}>

      <MobileMasthead onNavigate={navigate} activePage="essay" />

      {/* Hero still — full width, 16:9 */}
      <img src={FILM.still} alt="The Philadelphia Story"
        style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />

      {/* Title block */}
      <div style={{ padding: "20px 16px 0" }}>
        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.16em", color: "#1e4b96", fontWeight: 600, marginBottom: 10 }}>
          THE DEFINITIVES
        </div>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 30, fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.02em", color: "#111", marginBottom: 6 }}>
          The Philadelphia Story
        </h1>
        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#777", letterSpacing: "0.06em", marginBottom: 14 }}>
          GEORGE CUKOR · 1940
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 16, borderBottom: "1px solid rgba(0,0,0,0.1)" }}>
          <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, color: "#1e4b96" }}>{FILM.rating}</span>
          <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#888", letterSpacing: "0.04em", fontStyle: "italic" }}>
            By {FILM.author} · {FILM.date}
          </span>
        </div>

        {/* Compact film details — 2-column grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px", padding: "16px 0", borderBottom: "1px solid rgba(0,0,0,0.1)", marginBottom: 24 }}>
          {[
            { label: "DIRECTOR", value: FILM.director },
            { label: "RUNTIME", value: FILM.runtime },
            { label: "RATED", value: FILM.rated },
            { label: "RELEASE", value: FILM.release },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.12em", color: "#999", marginBottom: 2 }}>{label}</div>
              <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, color: "#222", lineHeight: 1.3 }}>{value}</div>
            </div>
          ))}
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, letterSpacing: "0.12em", color: "#999", marginBottom: 2 }}>CAST</div>
            <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, color: "#222", lineHeight: 1.4 }}>{FILM.cast}</div>
          </div>
        </div>

        {/* Essay body */}
        <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 17, lineHeight: 1.8, color: "#222" }}>
          <p style={{ marginBottom: 22 }}>
            In the winter of 1938, Katharine Hepburn was declared "box-office poison" by the Independent Theatre Owners of America — a verdict that felt, at the time, like the end of a career. Her films had underperformed. Studios grew cold. Hollywood, as it often does, began its preparations to forget her.
          </p>
          <p style={{ marginBottom: 22 }}>
            What happened next was not a rescue but a reclamation. Hepburn bought the film rights to Philip Barry's Broadway play <em>The Philadelphia Story</em> herself, secured Howard Hughes's financial backing, hand-picked her collaborators, and arrived in Hollywood holding all the cards. George Cukor was brought in to direct. Cary Grant and James Stewart were cast opposite her. The result — released on December 26, 1940 — was not merely a comeback. It was a statement of intent.
          </p>
          <p style={{ marginBottom: 22 }}>
            The film follows Tracy Lord (Hepburn), a socialite preparing to remarry, whose plans are disrupted by the arrival of her ex-husband C. K. Dexter Haven (Grant) and a pair of tabloid journalists (Stewart and Ruth Hussey). What unfolds is one of Hollywood's most dazzling exercises in screwball comedy: verbal sparring at extraordinary velocity, romantic triangles that keep rearranging themselves, and underneath all the wit, a searching examination of what it means to hold other people — and yourself — to impossible standards.
          </p>

          {/* Pull quote */}
          <blockquote style={{ borderLeft: "3px solid #1e4b96", paddingLeft: 16, margin: "28px 0", fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, fontStyle: "italic", lineHeight: 1.5, color: "#222" }}>
            "The film succeeded not by changing who Hepburn was, but by revealing the vulnerable, messy, and relatable human being beneath her perceived East Coast elitism."
          </blockquote>

          <p style={{ marginBottom: 22 }}>
            Cukor understood his star better than almost any director she worked with. He knew that Hepburn's particular brand of intelligence — sharp, unwilling to suffer fools — could read, in the wrong frame, as coldness. <em>The Philadelphia Story</em> lets that quality breathe, then punctures it with grace.
          </p>
          <p style={{ marginBottom: 22 }}>
            James Stewart, in a role that won him his only Academy Award, functions as the film's moral center. Grant, given less conventional material, is arguably more interesting: quiet, watchful, deploying his charm as a kind of restraint. The three together create a chemistry that the film never overexplains, which is part of why it endures.
          </p>
        </div>

        {/* Patreon gate */}
        <div style={{ margin: "32px 0", background: "#111", color: "#f8f7f3", padding: "28px 20px", textAlign: "center" }}>
          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.16em", color: "#fff", marginBottom: 10 }}>CONTINUE READING</div>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 600, fontStyle: "italic", marginBottom: 10 }}>This essay continues on Patreon</div>
          <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, lineHeight: 1.6, color: "rgba(248,247,243,0.65)", marginBottom: 20 }}>
            Supporters get early access to all Definitives essays — a full year before public release. ~3,500 words total.
          </p>
          <button style={{ background: "#1e4b96", color: "#fff", border: "none", padding: "12px 24px", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, cursor: "pointer" }}>
            READ ON PATREON →
          </button>
        </div>

        {/* Support CTA — simplified */}
        <div style={{ margin: "24px 0", padding: "20px", background: "#eeeae4", borderLeft: "3px solid #1e4b96" }}>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#111" }}>
            Thank You for Supporting Independent Film Criticism
          </div>
          <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 13, lineHeight: 1.65, color: "#333", marginBottom: 12 }}>
            If DFR has added something meaningful to your love of movies, consider <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "#1e4b96" }}>supporting it</a> via <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "#1e4b96" }}>Patreon</a> or a <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "#1e4b96" }}>one-time donation</a>.
          </p>
          <p style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#555", fontStyle: "italic" }}>
            Brian Eggert · Critic, Founder · Deep Focus Review
          </p>
        </div>

        {/* Recommended */}
        <div style={{ marginTop: 32, marginBottom: 8 }}>
          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, letterSpacing: "0.14em", fontWeight: 700, color: "#111", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <span>RECOMMENDED</span>
            <span style={{ flex: 1, borderTop: "1px solid rgba(0,0,0,0.1)" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {RECOMMENDED.map((r) => (
              <div key={r.title} style={{ cursor: "pointer" }}>
                <div style={{ overflow: "hidden", background: "#ddd", marginBottom: 6 }}>
                  <img src={r.image} alt={r.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                </div>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 12, fontWeight: 600, lineHeight: 1.2, color: "#111", marginBottom: 1 }}>{r.title}</div>
                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 9, color: "#888" }}>{r.year}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Back to Definitives */}
        <button onClick={() => navigate("definitives")}
          style={{ width: "100%", margin: "24px 0 8px", background: "none", border: "1px solid rgba(0,0,0,0.2)", padding: "12px 16px", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.12em", color: "#333", cursor: "pointer", textAlign: "left" }}>
          ← BACK TO THE DEFINITIVES
        </button>

      </div>

      <MobileFooter onNavigate={navigate} />
    </div>
  );
}
