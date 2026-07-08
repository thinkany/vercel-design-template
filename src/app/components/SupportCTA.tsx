// ©2004-2026 Deep Focus Review. All rights reserved.
interface Props {
  heading?: string;
  body?: string;
  donationHref?: string;
  patreonHref?: string;
  supportHref?: string;
  authorName?: string;
  authorTitle?: string;
}

export function SupportCTA({
  heading = "Thank You for Supporting Independent Film Criticism",
  body = "If the work on DFR has added something meaningful to your love of movies, please consider supporting it.",
  donationHref = "#",
  patreonHref = "#",
  supportHref = "#",
  authorName = "Brian Eggert",
  authorTitle = "Critic, Founder · Deep Focus Review",
}: Props) {
  return (
    <div style={{
      margin: "48px 0",
      padding: "36px 40px",
      background: "#eeeae4",
      borderLeft: "3px solid #1e4b96",
    }}>
      <h3 style={{
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: 20,
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: "-0.01em",
        color: "#111",
        marginBottom: 16,
      }}>
        {heading}
      </h3>
      <p style={{
        fontFamily: "'Source Serif 4', Georgia, serif",
        fontSize: 15,
        lineHeight: 1.75,
        color: "#333",
        marginBottom: 12,
      }}>
        {body}
      </p>
      <p style={{
        fontFamily: "'Source Serif 4', Georgia, serif",
        fontSize: 15,
        lineHeight: 1.75,
        color: "#333",
        marginBottom: 12,
      }}>
        Here are a few ways to show your support: make a{" "}
        <a href={donationHref} onClick={(e) => e.preventDefault()} style={{ color: "#1e4b96", textDecoration: "underline" }}>one-time donation</a>,
        {" "}join DFR's{" "}
        <a href={patreonHref} onClick={(e) => e.preventDefault()} style={{ color: "#1e4b96", textDecoration: "underline" }}>Patreon</a>
        {" "}for access to exclusive writing, or{" "}
        <a href={supportHref} onClick={(e) => e.preventDefault()} style={{ color: "#1e4b96", textDecoration: "underline", fontWeight: 600 }}>show your support in other ways</a>.
      </p>
      <p style={{
        fontFamily: "'Source Serif 4', Georgia, serif",
        fontSize: 15,
        lineHeight: 1.75,
        color: "#333",
        marginBottom: 12,
      }}>
        Your contribution helps keep this site running independently. However you choose to support the site, please know that it's appreciated.
      </p>
      <p style={{
        fontFamily: "'Source Serif 4', Georgia, serif",
        fontSize: 15,
        lineHeight: 1.75,
        color: "#333",
        marginBottom: 20,
      }}>
        Thank you for reading, and for making this work possible.
      </p>
      <p style={{
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontSize: 12,
        letterSpacing: "0.04em",
        color: "#555",
        fontWeight: 600,
      }}>
        {authorName}<br />
        <span style={{ fontWeight: 400, color: "#777" }}>{authorTitle}</span>
      </p>
    </div>
  );
}
