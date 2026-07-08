// ©2004-2026 Deep Focus Review. All rights reserved.
import { Nav3 } from "./Nav3";
import { Footer3 } from "./Footer3";
import { useC3Theme } from "./c3Theme";

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

export function EssayPost3({ onNavigate }: Props) {
  const { c } = useC3Theme();
  return (
    <div style={{ background: c.pageBg, minHeight: "100vh", color: c.textPrimary, transition: "background 0.2s" }}>

      <Nav3 onNavigate={onNavigate} activePage="essay" />

      {/* Hero still — full-bleed cinematic */}
      <div style={{ position: "relative", height: 480, overflow: "hidden" }}>
        <img src={FILM.still} alt="The Philadelphia Story" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: c.imgFilter2 }} />
        <div style={{ position: "absolute", inset: 0, background: c.heroGradient }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 48px 40px" }}>
            <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 11, letterSpacing: "0.2em", color: c.gold, marginBottom: 12 }}>THE DEFINITIVES</div>
            <h1 style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: "clamp(25px, 3.5vw, 45px)", fontWeight: 700, lineHeight: 1.0, letterSpacing: "0.02em", color: c.textHero, marginBottom: 12 }}>
              The Philadelphia Story
            </h1>
            <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 17, fontStyle: "italic", color: "rgba(240,232,216,0.6)" }}>
              George Cukor, 1940
            </div>
          </div>
        </div>
      </div>

      {/* Article body */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 48px 80px", display: "grid", gridTemplateColumns: "1fr 260px", gap: 64, alignItems: "start" }}>

        <article>
          {/* Byline + breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40, paddingBottom: 24, borderBottom: `1px solid ${c.border}` }}>
            <div>
              <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 14, color: c.goldMuted, letterSpacing: "0.1em" }}>{FILM.author} &nbsp;·&nbsp; {FILM.date}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 22, color: c.gold }}>{FILM.rating}</span>
              <button onClick={() => onNavigate("definitives")} style={{ background: "none", border: `1px solid ${c.goldFainter}`, padding: "6px 14px", cursor: "pointer", fontFamily: "'EB Garamond', Georgia, serif", fontSize: 12, letterSpacing: "0.1em", color: c.goldMuted }}>
                ← The Definitives
              </button>
            </div>
          </div>

          {/* Essay body */}
          <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 19, lineHeight: 1.85, color: c.textBody }}>
            <p style={{ marginBottom: 28 }}>
              In the winter of 1938, Katharine Hepburn was declared "box-office poison" by the Independent Theatre Owners of America — a verdict that felt, at the time, like the end of a career. Her films had underperformed. Studios grew cold. Hollywood, as it often does, began its preparations to forget her.
            </p>
            <p style={{ marginBottom: 28 }}>
              What happened next was not a rescue but a reclamation. Hepburn bought the film rights to Philip Barry's Broadway play <em>The Philadelphia Story</em> herself, secured Howard Hughes's financial backing, hand-picked her collaborators, and arrived in Hollywood holding all the cards. George Cukor was brought in to direct. Cary Grant and James Stewart were cast opposite her. The result — released on December 26, 1940 — was not merely a comeback. It was a statement of intent.
            </p>
            <p style={{ marginBottom: 28 }}>
              The film follows Tracy Lord (Hepburn), a socialite preparing to remarry, whose plans are disrupted by the arrival of her ex-husband C. K. Dexter Haven (Grant) and a pair of tabloid journalists (Stewart and Ruth Hussey). What unfolds is one of Hollywood's most dazzling exercises in screwball comedy: verbal sparring at extraordinary velocity, romantic triangles that keep rearranging themselves, and underneath all the wit, a searching examination of what it means to hold other people — and yourself — to impossible standards.
            </p>

            {/* Pull quote */}
            <div style={{ margin: "44px 0", padding: "28px 36px", border: `1px solid ${c.goldFainter}`, borderLeft: `3px solid ${c.gold}`, background: c.surfaceTint }}>
              <p style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 21, fontStyle: "italic", lineHeight: 1.55, color: c.gold, margin: 0 }}>
                "The film succeeded not by changing who Hepburn was, but by revealing the vulnerable, messy, and relatable human being beneath her perceived East Coast elitism."
              </p>
            </div>

            <p style={{ marginBottom: 28 }}>
              Cukor understood his star better than almost any director she worked with. He knew that Hepburn's particular brand of intelligence — sharp, unwilling to suffer fools — could read, in the wrong frame, as coldness. <em>The Philadelphia Story</em> lets that quality breathe, then punctures it with grace. Tracy Lord begins the film as an idol, untouchable and perfect, and ends it as something richer: a woman who has learned to forgive herself.
            </p>
            <p style={{ marginBottom: 28 }}>
              James Stewart, in a role that won him his only Academy Award, functions as the film's moral center — a writer of conscience who finds himself falling for Tracy precisely because she is not quite who she appears to be. Grant, given less conventional material, is arguably more interesting: quiet, watchful, deploying his charm as a kind of restraint. The three together create a chemistry that the film never overexplains, which is part of why it endures.
            </p>
          </div>

          {/* Patreon gate */}
          <div style={{ margin: "48px 0", padding: "36px", border: `1px solid ${c.goldFainter}`, background: c.surfaceTint, textAlign: "center" }}>
            <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 11, letterSpacing: "0.2em", color: c.gold, marginBottom: 14 }}>CONTINUE READING</div>
            <div style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 24, fontWeight: 700, color: c.textPrimary, marginBottom: 12 }}>This essay continues on Patreon</div>
            <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 16, lineHeight: 1.7, color: c.textMuted, marginBottom: 28, maxWidth: 440, margin: "0 auto 28px" }}>
              Supporters read new Definitives essays a full year before they appear publicly. The complete piece runs to approximately 3,500 words.
            </p>
            <button style={{ background: "transparent", border: `1px solid ${c.gold}`, color: c.gold, padding: "12px 32px", fontFamily: "'EB Garamond', Georgia, serif", fontSize: 13, letterSpacing: "0.14em", cursor: "pointer" }}>
              Join on Patreon →
            </button>
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
                    <img src={r.image} alt={r.title} style={{ width: "100%", height: 120, objectFit: "cover", display: "block", filter: c.imgFilter }}
                      onMouseEnter={(e) => (e.currentTarget.style.filter = c.imgFilter2)}
                      onMouseLeave={(e) => (e.currentTarget.style.filter = c.imgFilter)}
                    />
                  </div>
                  <div style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 14, color: c.textPrimary, marginBottom: 2 }}>{r.title}</div>
                  <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 12, color: c.goldMuted, letterSpacing: "0.06em" }}>{r.year}</div>
                </div>
              ))}
            </div>
          </div>
        </article>

        {/* Sidebar */}
        <aside style={{ paddingTop: 4 }}>
          <div style={{ marginBottom: 32, overflow: "hidden", background: c.cardBg, boxShadow: "6px 8px 30px rgba(0,0,0,0.25)" }}>
            <img src={FILM.poster} alt="The Philadelphia Story poster" style={{ width: "100%", display: "block", opacity: 0.92 }} />
          </div>

          <div style={{ borderTop: `1px solid ${c.goldFaint}`, paddingTop: 20, marginBottom: 24 }}>
            <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 10, letterSpacing: "0.18em", color: c.gold, marginBottom: 20 }}>FILM DETAILS</div>
            {[
              { label: "DIRECTOR", value: FILM.director },
              { label: "CAST", value: FILM.cast },
              { label: "RUNTIME", value: FILM.runtime },
              { label: "RELEASE", value: FILM.release },
            ].map(({ label, value }) => (
              <div key={label} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${c.borderFaint}` }}>
                <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 9, letterSpacing: "0.16em", color: c.goldMuted, marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 14, lineHeight: 1.5, color: c.textSub }}>{value}</div>
              </div>
            ))}
          </div>
        </aside>
      </div>
      <Footer3 onNavigate={onNavigate} />
    </div>
  );
}
