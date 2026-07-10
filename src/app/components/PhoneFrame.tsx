// ©2026 thinkany llc. All rights reserved.
import { ReactNode } from "react";

type Orientation = "portrait" | "landscape";

export function PhoneFrame({
  children,
  bg = "#fff",
  orientation = "portrait",
}: {
  children: ReactNode;
  bg?: string;
  orientation?: Orientation;
}) {
  const landscape = orientation === "landscape";
  const screenW = landscape ? 780 : 370;
  const screenH = landscape ? 370 : 780;
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 24px 60px", minHeight: "calc(100vh - 49px)", alignItems: "flex-start" }}>
      <div style={{ position: "relative", width: landscape ? "auto" : 390, flexShrink: 0 }}>
        {/* Outer shell */}
        <div
          style={{
            background: "#2a211a",
            borderRadius: 48,
            padding: landscape ? "10px 14px" : "14px 10px",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 32px 80px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.04)",
            display: "flex",
            flexDirection: landscape ? "row" : "column",
            alignItems: "center",
          }}
        >
          {/* Dynamic Island */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: landscape ? 0 : 10, marginRight: landscape ? 10 : 0 }}>
            <div style={{ background: "#1a1210", width: landscape ? 34 : 120, height: landscape ? 120 : 34, borderRadius: 20 }} />
          </div>
          {/* Screen */}
          <div
            style={{
              borderRadius: 36,
              overflow: "hidden",
              width: screenW,
              height: screenH,
              overflowY: "auto",
              scrollbarWidth: "none",
              background: bg,
              position: "relative",
              flexShrink: 0,
            }}
          >
            {children}
          </div>
          {/* Home indicator */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: landscape ? 0 : 10, marginLeft: landscape ? 10 : 0 }}>
            <div style={{ background: "rgba(255,255,255,0.25)", width: landscape ? 5 : 120, height: landscape ? 120 : 5, borderRadius: 3 }} />
          </div>
        </div>
        {/* Side buttons — on the top edge in landscape, left/right edges in portrait */}
        {landscape ? (
          <>
            <div style={{ position: "absolute", top: -4, right: 120, height: 4, width: 70, background: "#1a1210", borderRadius: "2px 2px 0 0" }} />
            <div style={{ position: "absolute", top: -4, left: 100, height: 4, width: 36, background: "#1a1210", borderRadius: "2px 2px 0 0" }} />
            <div style={{ position: "absolute", top: -4, left: 148, height: 4, width: 64, background: "#1a1210", borderRadius: "2px 2px 0 0" }} />
            <div style={{ position: "absolute", top: -4, left: 224, height: 4, width: 64, background: "#1a1210", borderRadius: "2px 2px 0 0" }} />
          </>
        ) : (
          <>
            <div style={{ position: "absolute", right: -4, top: 120, width: 4, height: 70, background: "#1a1210", borderRadius: "0 2px 2px 0" }} />
            <div style={{ position: "absolute", left: -4, top: 100, width: 4, height: 36, background: "#1a1210", borderRadius: "2px 0 0 2px" }} />
            <div style={{ position: "absolute", left: -4, top: 148, width: 4, height: 64, background: "#1a1210", borderRadius: "2px 0 0 2px" }} />
            <div style={{ position: "absolute", left: -4, top: 224, width: 4, height: 64, background: "#1a1210", borderRadius: "2px 0 0 2px" }} />
          </>
        )}
      </div>
    </div>
  );
}
