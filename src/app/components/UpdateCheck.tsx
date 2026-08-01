// ©2026 thinkany llc. All rights reserved.
//
// Dashboard "check for updates" affordance. Reads this copy's bundled version
// (compiled from public/version.json) and compares it to the canonical template
// deploy's published version. Quietly checks once on mount; the version pill is
// also clickable for a manual re-check. Fails silently — it's a convenience and
// must never block the dashboard. Rendered admin-only by the Dashboard.
import { useState, useEffect, useCallback } from "react";
import {
  TEMPLATE_VERSION,
  VERSION_SOURCE_URL,
  compareVersions,
  type VersionManifest,
} from "@/version";

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "current" }
  | { kind: "available"; latest: VersionManifest }
  | { kind: "error" };

export function UpdateCheck() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const check = useCallback(() => {
    setStatus({ kind: "checking" });
    // Cache-bust so a designer always sees the freshly published version, not an
    // edge/browser-cached copy.
    fetch(`${VERSION_SOURCE_URL}?t=${TEMPLATE_VERSION}-${performance.now()}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((latest: VersionManifest) => {
        if (latest?.version && compareVersions(latest.version, TEMPLATE_VERSION) > 0) {
          setStatus({ kind: "available", latest });
        } else {
          setStatus({ kind: "current" });
        }
      })
      .catch(() => setStatus({ kind: "error" }));
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const hasUpdate = status.kind === "available";

  const label = (() => {
    switch (status.kind) {
      case "checking":
        return "Checking…";
      case "available":
        return `Update available · v${status.latest.version}`;
      case "current":
        return `v${TEMPLATE_VERSION} · up to date`;
      case "error":
        return `v${TEMPLATE_VERSION} · check for updates`;
      default:
        return `v${TEMPLATE_VERSION}`;
    }
  })();

  const title =
    status.kind === "available"
      ? `${status.latest.notes ?? "A newer template version is available."}\nRun /upgrade in Claude Code to apply it.`
      : "Check for template updates";

  return (
    <button
      onClick={check}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: hasUpdate ? "var(--admin-accent)" : "transparent",
        border: hasUpdate ? "1px solid var(--admin-accent)" : "1px solid rgba(0,0,0,0.15)",
        borderRadius: 3,
        padding: "7px 12px",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        cursor: "pointer",
        color: hasUpdate ? "#fff" : "var(--admin-gray-mid)",
        fontFamily: "inherit",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      {hasUpdate && (
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#fff",
            display: "inline-block",
          }}
        />
      )}
      {label}
    </button>
  );
}
