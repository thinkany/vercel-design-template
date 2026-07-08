// ©2004-2026 Deep Focus Review. All rights reserved.
interface Props {
  onNavigate: (page: string) => void;
}

export function Footer2({ onNavigate }: Props) {
  return (
    <footer style={{ background: "#f0e8da", borderTop: "1.5px solid #c9b99a", marginTop: 80, fontFamily: "'Crimson Pro', Georgia, serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 48px 36px" }}>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 48, marginBottom: 40 }}>

          {/* Brand */}
          <div>
            <button onClick={() => onNavigate("home")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
              <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 24, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em", color: "#1a1612" }}>Deep Focus Review</div>
            </button>
            <p style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 15, lineHeight: 1.7, fontStyle: "italic", color: "#7a6655", marginTop: 12 }}>
              A film journal by Brian Eggert.<br />Independent criticism since 2004.
            </p>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, color: "#a0856a", marginTop: 16, transform: "rotate(-0.8deg)", display: "inline-block" }}>
              hello@deepfocusreview.com
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 18 }}>
              {["Patreon", "Letterboxd", "Twitter"].map((s) => (
                <a key={s} href="#" onClick={(e) => e.preventDefault()}
                  style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 13, fontStyle: "italic", color: "#9a8070", textDecoration: "underline", textDecorationColor: "#c9b99a", textUnderlineOffset: 3 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#1a1612")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#9a8070")}
                >{s}</a>
              ))}
            </div>
          </div>

          {/* Browse */}
          <div>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 18, color: "#a0856a", marginBottom: 14, borderBottom: "1px dashed #c9b99a", paddingBottom: 8 }}>Browse</div>
            {[["Reviews A–Z", "reviews"], ["The Definitives", "definitives"], ["Features", "home"], ["Lists", "home"], ["Festival Coverage", "home"]].map(([label, page]) => (
              <a key={label} href="#" onClick={(e) => { e.preventDefault(); onNavigate(page); }}
                style={{ display: "block", fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 15, color: "#7a6655", textDecoration: "none", marginBottom: 8 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#1a1612")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#7a6655")}
              >{label}</a>
            ))}
          </div>

          {/* About */}
          <div>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 18, color: "#a0856a", marginBottom: 14, borderBottom: "1px dashed #c9b99a", paddingBottom: 8 }}>About</div>
            {["About DFR", "Contact", "Support DFR", "Bibliography", "Friends & Critics"].map((link) => (
              <a key={link} href="#" onClick={(e) => e.preventDefault()}
                style={{ display: "block", fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 15, color: "#7a6655", textDecoration: "none", marginBottom: 8 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#1a1612")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#7a6655")}
              >{link}</a>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: "1px solid #c9b99a", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 13, fontStyle: "italic", color: "#a0856a" }}>
            © 2004–2026 Deep Focus Review
          </div>
          <a href="#" onClick={(e) => e.preventDefault()}
            style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 13, fontStyle: "italic", color: "#7a6655", textDecoration: "underline", textDecorationColor: "#c9b99a", textUnderlineOffset: 3 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#1a1612")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#7a6655")}
          >Support on Patreon →</a>
        </div>
      </div>
    </footer>
  );
}
