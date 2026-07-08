// ©2004-2026 Deep Focus Review. All rights reserved.
import { useState, useRef } from "react";
import { NAV_ITEMS } from "./navData";

interface Props {
  onNavigate: (page: string) => void;
  activePage?: string;
}

function handleSubClick(label: string, onNavigate: (page: string) => void) {
  if (label === "Reviews A-Z") onNavigate("reviews");
  else if (label === "The Definitives") onNavigate("definitives");
}

function handleTopClick(label: string, onNavigate: (page: string) => void) {
  if (label === "The Definitives") onNavigate("definitives");
  else if (label === "Reviews") onNavigate("reviews");
  else if (label === "Patreon") { /* external */ }
  else onNavigate("home");
}

export function Nav1({ onNavigate, activePage }: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const open = (label: string) => { if (timeoutRef.current) clearTimeout(timeoutRef.current); setOpenMenu(label); };
  const close = () => { timeoutRef.current = setTimeout(() => setOpenMenu(null), 120); };

  return (
    <div style={{ borderTop: "1px solid rgba(0,0,0,0.15)", marginTop: 20, paddingTop: 12, display: "flex", gap: 0, position: "relative" }}>
      {NAV_ITEMS.map((item) => {
        const isActive = (item.label === "The Definitives" && activePage === "definitives")
          || (item.label === "Reviews" && activePage === "reviews");
        return (
          <div key={item.label} style={{ position: "relative" }}
            onMouseEnter={() => item.sub ? open(item.label) : setOpenMenu(null)}
            onMouseLeave={close}
          >
            <button
              onClick={() => handleTopClick(item.label, onNavigate)}
              style={{ background: "none", border: "none", padding: "0 32px 10px 0", cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 15, fontWeight: 500, letterSpacing: "0.12em", color: isActive ? "#1e4b96" : "#333", borderBottom: isActive ? "2px solid #1e4b96" : "2px solid transparent", display: "flex", alignItems: "center", gap: 4 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#1e4b96")}
              onMouseLeave={(e) => (e.currentTarget.style.color = isActive ? "#1e4b96" : "#333")}
            >
              {item.label.toUpperCase()}
              {item.sub && <svg width="8" height="5" viewBox="0 0 8 5" fill="none"><path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>}
            </button>
            {item.sub && openMenu === item.label && (
              <div style={{ position: "absolute", top: "100%", left: 0, background: "#f8f7f3", border: "1px solid rgba(0,0,0,0.1)", borderTop: "2px solid #1e4b96", minWidth: 200, zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}
                onMouseEnter={() => open(item.label)} onMouseLeave={close}>
                {item.sub.map((sub) => (
                  <a key={sub.label} href="#"
                    onClick={(e) => { e.preventDefault(); handleSubClick(sub.label, onNavigate); }}
                    style={{ display: "block", padding: "9px 16px", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 15, letterSpacing: "0.06em", color: "#333", textDecoration: "none", borderBottom: "1px solid rgba(0,0,0,0.05)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#1e4b96"; e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#333"; }}
                  >{sub.label}</a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
