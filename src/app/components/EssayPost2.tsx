// ©2004-2026 Deep Focus Review. All rights reserved.
import { Nav2 } from "./Nav2";
import { Footer2 } from "./Footer2";

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

export function EssayPost2({ onNavigate }: Props) {
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
        <Nav2 onNavigate={onNavigate} activePage="essay" />
      </header>

      {/* Article */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 32px 80px", display: "grid", gridTemplateColumns: "1fr 200px", gap: 52, alignItems: "start" }}>

        <article>
          {/* Breadcrumb */}
          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, color: "#b89a7e", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => onNavigate("definitives")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, color: "#b89a7e", padding: 0 }}>← The Definitives</button>
          </div>

          {/* Series label */}
          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 15, color: "#a0856a", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
            <span>an ongoing series</span>
            <span style={{ flex: 1, maxWidth: 60, borderBottom: "1px dashed #c9b99a" }} />
          </div>

          {/* Title */}
          <h1 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 700, lineHeight: 1.0, letterSpacing: "-0.02em", color: "#1a1612", marginBottom: 8 }}>
            The Philadelphia Story
          </h1>
          <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 16, fontStyle: "italic", color: "#9a8070", marginBottom: 8 }}>{FILM.director}, {FILM.year}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
            <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 18, color: "#7a6655" }}>{FILM.rating}</span>
            <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, color: "#b89a7e" }}>{FILM.author} · {FILM.date}</span>
          </div>

          {/* Hero still — slight tilt, handmade feel */}
          <div style={{ marginBottom: 36, transform: "rotate(-0.5deg)", boxShadow: "4px 6px 20px rgba(0,0,0,0.14)", background: "#ccc" }}>
            <img src={FILM.still} alt="The Philadelphia Story" style={{ width: "100%", maxHeight: 420, objectFit: "cover", display: "block" }} />
          </div>

          {/* Essay body */}
          <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 19, lineHeight: 1.8, color: "#2d2420" }}>
            <p style={{ marginBottom: 24 }}>
              In the winter of 1938, Katharine Hepburn was declared "box-office poison" by the Independent Theatre Owners of America — a verdict that felt, at the time, like the end of a career. Her films had underperformed. Studios grew cold. Hollywood, as it often does, began its preparations to forget her.
            </p>
            <p style={{ marginBottom: 24 }}>
              What happened next was not a rescue but a reclamation. Hepburn bought the film rights to Philip Barry's Broadway play <em>The Philadelphia Story</em> herself, secured Howard Hughes's financial backing, hand-picked her collaborators, and arrived in Hollywood holding all the cards. George Cukor was brought in to direct. Cary Grant and James Stewart were cast opposite her. The result — released on December 26, 1940 — was not merely a comeback. It was a statement of intent.
            </p>
            <p style={{ marginBottom: 24 }}>
              The film follows Tracy Lord (Hepburn), a socialite preparing to remarry, whose plans are disrupted by the arrival of her ex-husband C. K. Dexter Haven (Grant) and a pair of tabloid journalists (Stewart and Ruth Hussey). What unfolds is one of Hollywood's most dazzling exercises in screwball comedy: verbal sparring at extraordinary velocity, romantic triangles that keep rearranging themselves, and underneath all the wit, a searching examination of what it means to hold other people — and yourself — to impossible standards.
            </p>

            {/* Handwritten margin note feel */}
            <div style={{ margin: "36px 0", padding: "20px 24px", borderLeft: "3px solid #c9b99a", background: "#f0e8da" }}>
              <p style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 18, color: "#7a6655", lineHeight: 1.6, margin: 0 }}>
                "The film succeeded not by changing who Hepburn was, but by revealing the vulnerable, messy, and relatable human being beneath her perceived East Coast elitism."
              </p>
            </div>

            <p style={{ marginBottom: 24 }}>
              Cukor understood his star better than almost any director she worked with. He knew that Hepburn's particular brand of intelligence — sharp, unwilling to suffer fools — could read, in the wrong frame, as coldness. <em>The Philadelphia Story</em> lets that quality breathe, then punctures it with grace. Tracy Lord begins the film as an idol, untouchable and perfect, and ends it as something richer: a woman who has learned to forgive herself.
            </p>
            <p style={{ marginBottom: 24 }}>
              James Stewart, in a role that won him his only Academy Award, functions as the film's moral center — a writer of conscience who finds himself falling for Tracy precisely because she is not quite who she appears to be. Grant, given less conventional material, is arguably more interesting: quiet, watchful, deploying his charm as a kind of restraint. The three together create a chemistry that the film never overexplains, which is part of why it endures.
            </p>
          </div>

          {/* Patreon paywall */}
          <div style={{ margin: "40px 0", padding: "28px", background: "#f0e8da", borderTop: "1.5px solid #c9b99a" }}>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 18, color: "#a0856a", marginBottom: 10 }}>this essay continues on Patreon</div>
            <p style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 15, lineHeight: 1.65, color: "#7a6655", fontStyle: "italic", marginBottom: 20 }}>
              Supporters read new Definitives essays a full year before they appear here publicly. The complete piece runs to approximately 3,500 words.
            </p>
            <a href="#" onClick={(e) => e.preventDefault()}
              style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 14, fontStyle: "italic", color: "#7a6655", textDecoration: "underline", textDecorationColor: "#c9b99a", textUnderlineOffset: 3 }}>
              Join on Patreon →
            </a>
          </div>

          {/* Recommended */}
          <div style={{ marginTop: 48 }}>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 20, color: "#a0856a", marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
              <span>You might also enjoy</span>
              <span style={{ flex: 1, borderBottom: "1px dashed #c9b99a", marginBottom: 3 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
              {RECOMMENDED.map((r) => (
                <div key={r.title}>
                  <div style={{ transform: "rotate(-0.3deg)", boxShadow: "2px 4px 12px rgba(0,0,0,0.1)", background: "#ccc", overflow: "hidden", marginBottom: 10 }}>
                    <img src={r.image} alt={r.title} style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }} />
                  </div>
                  <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 14, fontWeight: 600, color: "#1a1612", marginBottom: 2 }}>{r.title}</div>
                  <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 12, fontStyle: "italic", color: "#9a8070" }}>{r.year}</div>
                </div>
              ))}
            </div>
          </div>
        </article>

        {/* Sidebar */}
        <aside style={{ paddingTop: 60 }}>
          <div style={{ transform: "rotate(0.5deg)", boxShadow: "3px 5px 16px rgba(0,0,0,0.15)", background: "#ccc", overflow: "hidden", marginBottom: 28 }}>
            <img src={FILM.poster} alt="The Philadelphia Story poster" style={{ width: "100%", display: "block" }} />
          </div>

          <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 16, color: "#a0856a", marginBottom: 14, borderBottom: "1px dashed #c9b99a", paddingBottom: 8 }}>Film details</div>
          {[
            { label: "Director", value: FILM.director },
            { label: "Cast", value: FILM.cast },
            { label: "Runtime", value: FILM.runtime },
            { label: "Release", value: FILM.release },
          ].map(({ label, value }) => (
            <div key={label} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid rgba(201,185,154,0.3)" }}>
              <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, color: "#b89a7e", marginBottom: 2 }}>{label}</div>
              <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 13, lineHeight: 1.5, fontStyle: "italic", color: "#5a4a3c" }}>{value}</div>
            </div>
          ))}
        </aside>
      </div>
      <Footer2 onNavigate={onNavigate} />
    </div>
  );
}
