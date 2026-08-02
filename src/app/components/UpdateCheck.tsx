// ©2026 thinkany llc. All rights reserved.
//
// Dashboard update affordance (admin + local-dev only). Compares this copy's
// bundled version to the canonical template deploy; when a newer one exists, the
// pill turns actionable and opens a preview → confirm → apply flow that calls the
// local /api/upgrade endpoint (the dev server overlays the new template files onto
// this project — the browser can't, which is why upgrades are a local operation).
// Fails silently on the check; the apply is always explicit + git-gated.
import { useState, useEffect, useCallback, type ReactNode } from "react";
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

type UpgradeReport = {
  version: { from: string | null; to: string | null };
  applied: string[];
  review: string[];
  kept: string[];
  gitDirty: string[];
  gitAvailable: boolean;
  blocked: boolean;
  message: string;
};

type Upgrade =
  | null
  | { kind: "loading" }
  | { kind: "preview"; report: UpgradeReport }
  | { kind: "applying" }
  | { kind: "done"; report: UpgradeReport }
  | { kind: "error"; message: string };

export function UpdateCheck() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [upgrade, setUpgrade] = useState<Upgrade>(null);

  const check = useCallback(() => {
    setStatus({ kind: "checking" });
    fetch(`${VERSION_SOURCE_URL}?t=${TEMPLATE_VERSION}-${performance.now()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((latest: VersionManifest) => {
        setStatus(
          latest?.version && compareVersions(latest.version, TEMPLATE_VERSION) > 0
            ? { kind: "available", latest }
            : { kind: "current" },
        );
      })
      .catch(() => setStatus({ kind: "error" }));
  }, []);

  useEffect(() => { check(); }, [check]);

  const latest = status.kind === "available" ? status.latest : null;

  function callUpgrade(dryRun: boolean, force: boolean): Promise<UpgradeReport> {
    return fetch("/api/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: latest?.zipUrl, dryRun, force }),
    }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
  }

  function openUpgrade() {
    setUpgrade({ kind: "loading" });
    callUpgrade(true, false)
      .then((report) => setUpgrade({ kind: "preview", report }))
      .catch((e) => setUpgrade({ kind: "error", message: String(e.message || e) }));
  }

  function applyUpgrade(dirty: boolean) {
    setUpgrade({ kind: "applying" });
    callUpgrade(false, dirty)
      .then((report) =>
        setUpgrade(report.blocked ? { kind: "error", message: report.message } : { kind: "done", report }),
      )
      .catch((e) => setUpgrade({ kind: "error", message: String(e.message || e) }));
  }

  const hasUpdate = status.kind === "available";
  const label = (() => {
    switch (status.kind) {
      case "checking": return "Checking…";
      case "available": return `Update available · v${status.latest.version}`;
      case "current": return `v${TEMPLATE_VERSION} · up to date`;
      case "error": return `v${TEMPLATE_VERSION} · check for updates`;
      default: return `v${TEMPLATE_VERSION}`;
    }
  })();

  return (
    <>
      <button
        onClick={() => (hasUpdate ? openUpgrade() : check())}
        title={hasUpdate ? (latest?.notes ?? "A newer template version is available.") : "Check for template updates"}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: hasUpdate ? "var(--admin-accent)" : "transparent",
          border: hasUpdate ? "1px solid var(--admin-accent)" : "1px solid rgba(0,0,0,0.15)",
          borderRadius: 3, padding: "7px 12px", fontSize: 11, fontWeight: 500,
          letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
          color: hasUpdate ? "#fff" : "var(--admin-gray-mid)", fontFamily: "inherit",
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        {hasUpdate && <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
        {label}
      </button>

      {upgrade && latest && (
        <UpgradeModal
          latest={latest}
          state={upgrade}
          onApply={applyUpgrade}
          onClose={() => setUpgrade(null)}
        />
      )}
    </>
  );
}

function UpgradeModal({
  latest, state, onApply, onClose,
}: {
  latest: VersionManifest;
  state: Exclude<Upgrade, null>;
  onApply: (dirty: boolean) => void;
  onClose: () => void;
}) {
  const dirty = state.kind === "preview" ? state.report.gitDirty.length > 0 : false;
  const busy = state.kind === "loading" || state.kind === "applying";

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--admin-font-body)",
      }}
    >
      <div style={{ background: "#fff", borderRadius: 4, width: "90%", maxWidth: 520, maxHeight: "85vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.22)" }}>
        <div style={{ padding: "22px 26px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.15em", color: "var(--admin-gray-mid)", textTransform: "uppercase", marginBottom: 6 }}>
            Template update · v{latest.version}
          </div>
          <h2 style={{ fontFamily: "var(--admin-font-heading)", fontSize: 20, fontWeight: 300, color: "var(--admin-ink)", margin: 0 }}>
            {state.kind === "done" ? "Update applied" : "Update this project"}
          </h2>
        </div>

        <div style={{ padding: "20px 26px", fontSize: 13, color: "var(--admin-gray-dark)", lineHeight: 1.6 }}>
          {state.kind === "loading" && <p style={{ margin: 0 }}>Preparing update…</p>}
          {state.kind === "applying" && <p style={{ margin: 0 }}>Applying update — writing files…</p>}

          {state.kind === "error" && (
            <p style={{ margin: 0, color: "var(--admin-danger)" }}>{state.message}</p>
          )}

          {state.kind === "preview" && (
            <>
              {latest.notes && <p style={{ margin: "0 0 14px" }}>{latest.notes}</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
                <Row label="Version" value={`${state.report.version.from ?? "?"} → ${state.report.version.to ?? latest.version}`} />
                <Row label="Files to update" value={String(state.report.applied.length)} />
                {state.report.review.length > 0 && <Row label="Need review (sidecar)" value={String(state.report.review.length)} />}
                <Row label="Your files kept" value={String(state.report.kept.length)} />
              </div>
              {dirty ? (
                <div style={{ background: "#fef3c7", border: "1px solid #f0d488", borderRadius: 4, padding: "10px 12px", fontSize: 12, color: "#663d00" }}>
                  <strong>{state.report.gitDirty.length} uncommitted change(s).</strong> Commit or stash first so the
                  update shows up as a clean, reviewable <code>git diff</code>. You can still apply now if you understand it.
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: "var(--admin-gray-mid)" }}>
                  Your work is protected — <code>.env</code>, your variations, and your palette are never touched.
                  After applying, review with <code>git diff</code> and commit.
                </p>
              )}
              <p style={{ margin: "14px 0 0", fontSize: 13, fontWeight: 700, color: "var(--admin-ink)" }}>
                Update reminder: restart your dev server after applying.
              </p>
            </>
          )}

          {state.kind === "done" && (
            <>
              <p style={{ margin: "0 0 12px" }}>
                Updated to <strong>v{state.report.version.to ?? latest.version}</strong> — {state.report.applied.length} file(s) written.
              </p>
              {state.report.review.length > 0 && (
                <p style={{ margin: "0 0 12px", fontSize: 12 }}>
                  <strong>Review these</strong> (written alongside as <code>*.upgrade-new</code>, merge by hand):<br />
                  {state.report.review.join(", ")}
                </p>
              )}
              <div style={{ margin: 0, fontSize: 12, color: "#663d00", background: "#fef3c7", border: "1px solid #f0d488", borderRadius: 4, padding: "10px 12px" }}>
                <strong>Restart the dev server now.</strong> The update rewrote
                <code> vite.config.ts</code> and live modules, so a browser reload isn't
                enough: stop it (<code>Ctrl+C</code>), run <code>npm run dev</code> again,
                then hard-reload this page. Then review with <code>git diff</code> and commit.
              </div>
            </>
          )}
        </div>

        <div style={{ padding: "14px 26px", borderTop: "1px solid rgba(0,0,0,0.08)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {state.kind === "preview" && (
            <>
              <GhostBtn onClick={onClose}>Cancel</GhostBtn>
              <AccentBtn onClick={() => onApply(dirty)}>{dirty ? "Apply anyway" : "Apply update"}</AccentBtn>
            </>
          )}
          {state.kind === "done" && <AccentBtn onClick={onClose}>Got it</AccentBtn>}
          {state.kind === "error" && <GhostBtn onClick={onClose}>Close</GhostBtn>}
          {busy && <span style={{ fontSize: 12, color: "var(--admin-gray-mid)" }}>Working…</span>}
        </div>
      </div>
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
    <span style={{ color: "var(--admin-gray-mid)" }}>{label}</span>
    <span style={{ color: "var(--admin-ink)", fontWeight: 500 }}>{value}</span>
  </div>
);

const btnBase = {
  padding: "9px 18px", borderRadius: 3, fontSize: 12, fontWeight: 500,
  letterSpacing: "0.08em", cursor: "pointer", fontFamily: "inherit",
} as const;
const GhostBtn = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button onClick={onClick} style={{ ...btnBase, border: "1px solid rgba(0,0,0,0.18)", background: "transparent", color: "var(--admin-gray-dark)" }}>{children}</button>
);
const AccentBtn = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button onClick={onClick} style={{ ...btnBase, border: "none", background: "var(--admin-accent)", color: "#fff", textTransform: "uppercase" }}>{children}</button>
);
