// ©2004-2026 Deep Focus Review. All rights reserved.
import { ReactNode } from "react";

export function PhoneFrame({ children, bg = "#fff" }: { children: ReactNode; bg?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 24px 60px", minHeight: "calc(100vh - 49px)", alignItems: "flex-start" }}>
      <div style={{ position: "relative", width: 390, flexShrink: 0 }}>
        {/* Outer shell */}
        <div
          style={{
            background: "#2a211a",
            borderRadius: 48,
            padding: "14px 10px",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 32px 80px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          {/* Dynamic Island */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <div style={{ background: "#1a1210", width: 120, height: 34, borderRadius: 20 }} />
          </div>
          {/* Screen */}
          <div
            style={{
              borderRadius: 36,
              overflow: "hidden",
              height: 780,
              overflowY: "auto",
              scrollbarWidth: "none",
              background: bg,
              position: "relative",
            }}
          >
            {children}
          </div>
          {/* Home indicator */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
            <div style={{ background: "rgba(255,255,255,0.25)", width: 120, height: 5, borderRadius: 3 }} />
          </div>
        </div>
        {/* Side buttons */}
        <div style={{ position: "absolute", right: -4, top: 120, width: 4, height: 70, background: "#1a1210", borderRadius: "0 2px 2px 0" }} />
        <div style={{ position: "absolute", left: -4, top: 100, width: 4, height: 36, background: "#1a1210", borderRadius: "2px 0 0 2px" }} />
        <div style={{ position: "absolute", left: -4, top: 148, width: 4, height: 64, background: "#1a1210", borderRadius: "2px 0 0 2px" }} />
        <div style={{ position: "absolute", left: -4, top: 224, width: 4, height: 64, background: "#1a1210", borderRadius: "2px 0 0 2px" }} />
      </div>
    </div>
  );
}
