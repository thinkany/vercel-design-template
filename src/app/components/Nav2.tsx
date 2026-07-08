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

export function Nav2({ onNavigate, activePage }: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const open = (label: string) => { if (timeoutRef.current) clearTimeout(timeoutRef.current); setOpenMenu(label); };
  const close = () => { timeoutRef.current = setTimeout(() => setOpenMenu(null), 120); };

  return (
    <nav style={{ paddingTop: 16, paddingBottom: 4, display: "flex", gap: 0, position: "relative" }}>
      {NAV_ITEMS.map((item, i) => {
        const isActive = (item.label === "The Definitives" && activePage === "definitives")
          || (item.label === "Reviews" && activePage === "reviews");
        return (
          <div key={item.label} style={{ position: "relative" }}
            onMouseEnter={() => item.sub ? open(item.label) : setOpenMenu(null)}
            onMouseLeave={close}
          >
            <a href="#"
              onClick={(e) => { e.preventDefault(); handleTopClick(item.label, onNavigate); }}
              style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 14, fontStyle: i % 2 === 0 ? "italic" : "normal", color: isActive ? "#1a1612" : "#7a6655", textDecoration: isActive ? "underline" : "none", textDecorationColor: "#c9b99a", textUnderlineOffset: 3, marginRight: 24, display: "inline-flex", alignItems: "center", gap: 4, paddingBottom: 2 }}>
              {item.label}
              {item.sub && <svg width="7" height="4" viewBox="0 0 8 5" fill="none"><path d="M1 1l3 3 3-3" stroke="#9a8070" strokeWidth="1.2" strokeLinecap="round" /></svg>}
            </a>
            {item.sub && openMenu === item.label && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: "#faf8f3", border: "1px solid #c9b99a", borderTop: "2px solid #7a6655", minWidth: 200, zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
                onMouseEnter={() => open(item.label)} onMouseLeave={close}>
                {item.sub.map((sub) => (
                  <a key={sub.label} href="#"
                    onClick={(e) => { e.preventDefault(); handleSubClick(sub.label, onNavigate); }}
                    style={{ display: "block", padding: "8px 14px", fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 14, fontStyle: "italic", color: "#7a6655", textDecoration: "none", borderBottom: "1px solid rgba(201,185,154,0.3)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f0e8da")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >{sub.label}</a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
