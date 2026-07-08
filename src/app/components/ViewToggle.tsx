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
  /** Tailwind-compatible inline style overrides for the bar wrapper */
  barStyle?: React.CSSProperties;
  activeColor?: string;
  activeBg?: string;
}

export function ViewToggle({ view, onChange, barStyle, activeColor = "#7a6655", activeBg = "#7a6655" }: ViewToggleProps) {
  return (
    <div
      style={{
        background: "#f0e8da",
        borderBottom: "1px solid #c9b99a",
        padding: "10px 32px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        justifyContent: "flex-end",
        ...barStyle,
      }}
    >
      <span style={{ fontFamily: "'Caveat', cursive", fontSize: 13, color: "#a0856a", marginRight: 8 }}>
        View as:
      </span>
      {(["desktop", "mobile"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            background: view === v ? activeBg : "transparent",
            border: `1px solid ${activeColor}`,
            color: view === v ? "#faf8f3" : activeColor,
            fontFamily: "'Lora', Georgia, serif",
            fontSize: 12,
            fontStyle: "italic",
            padding: "4px 14px",
            cursor: "pointer",
            borderRadius: 2,
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
