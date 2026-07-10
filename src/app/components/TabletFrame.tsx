// ©2026 thinkany llc. All rights reserved.
import { ReactNode } from "react";

type Orientation = "portrait" | "landscape";

export function TabletFrame({
  children,
  bg = "#fff",
  orientation = "portrait",
}: {
  children: ReactNode;
  bg?: string;
  orientation?: Orientation;
}) {
  const landscape = orientation === "landscape";
  const screenW = landscape ? 900 : 664;
  const screenH = landscape ? 664 : 900;
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 24px 60px", minHeight: "calc(100vh - 49px)", alignItems: "flex-start" }}>
      <div style={{ position: "relative", width: "auto", flexShrink: 0 }}>
        {/* Outer shell */}
        <div
          style={{
            background: "linear-gradient(135deg, #c9c6bf 0%, #a8a49d 40%, #918d86 60%, #b6b3ac 100%)",
            borderRadius: 36,
            padding: 18,
            boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 32px 80px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.04)",
            display: "flex",
            flexDirection: landscape ? "row" : "column",
            alignItems: "center",
          }}
        >
          {/* Front camera */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: landscape ? 0 : 10, marginRight: landscape ? 10 : 0 }}>
            <div style={{ background: "#0a0a0a", width: 8, height: 8, borderRadius: "50%" }} />
          </div>
          {/* Screen */}
          <div
            style={{
              borderRadius: 20,
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
        </div>
        {/* Side buttons — power on the top edge, volume on the near side */}
        {landscape ? (
          <>
            <div style={{ position: "absolute", top: -4, left: 90, height: 4, width: 56, background: "#6e6a64", borderRadius: "2px 2px 0 0" }} />
            <div style={{ position: "absolute", left: -4, top: 60, width: 4, height: 44, background: "#6e6a64", borderRadius: "2px 0 0 2px" }} />
          </>
        ) : (
          <>
            <div style={{ position: "absolute", top: -4, right: 90, height: 4, width: 56, background: "#6e6a64", borderRadius: "2px 2px 0 0" }} />
            <div style={{ position: "absolute", right: -4, top: 60, width: 4, height: 44, background: "#6e6a64", borderRadius: "0 2px 2px 0" }} />
          </>
        )}
      </div>
    </div>
  );
}
