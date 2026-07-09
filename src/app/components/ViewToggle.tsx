// ©2004-2026 Deep Focus Review. All rights reserved.
const DesktopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="3" width="20" height="14" rx="1" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const MobileIcon = () => (
  <svg width="11" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <circle cx="12" cy="18" r="0.8" fill="currentColor" />
  </svg>
);

interface ViewToggleProps {
  view: "desktop" | "mobile";
  onChange: (v: "desktop" | "mobile") => void;
  /** Inline style overrides for the bar wrapper */
  barStyle?: React.CSSProperties;
}

export function ViewToggle({ view, onChange, barStyle }: ViewToggleProps) {
  return (
    <div
      style={{
        background: "#fff",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        padding: "10px 32px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        justifyContent: "flex-end",
        ...barStyle,
      }}
    >
      <span style={{ fontFamily: "var(--admin-font-body)", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--admin-gray-mid)", marginRight: 6 }}>
        View
      </span>
      {(["desktop", "mobile"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            background: view === v ? "var(--admin-blue)" : "transparent",
            border: `1px solid ${view === v ? "var(--admin-blue)" : "rgba(0,0,0,0.2)"}`,
            color: view === v ? "#fff" : "var(--admin-gray-dark)",
            fontFamily: "var(--admin-font-body)",
            fontSize: 12,
            fontWeight: 500,
            padding: "4px 12px",
            cursor: "pointer",
            borderRadius: 3,
            transition: "background 0.15s, color 0.15s",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {v === "desktop" ? <DesktopIcon /> : <MobileIcon />}
          {v.charAt(0).toUpperCase() + v.slice(1)}
        </button>
      ))}
    </div>
  );
}
