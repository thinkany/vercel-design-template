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
import { copy } from "@/copy";

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

type RevertInfo = { canRevert: boolean; from?: string; to?: string; count?: number };
type Revert =
  | null
  | { kind: "confirm" }
  | { kind: "doing" }
  | { kind: "done"; msg: string }
  | { kind: "error"; msg: string };

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

  // Revert availability — a backup left by the last applied update, if any.
  const [revertInfo, setRevertInfo] = useState<RevertInfo | null>(null);
  const refreshRevert = useCallback(() => {
    fetch("/api/upgrade/revert").then((r) => (r.ok ? r.json() : null)).then(setRevertInfo).catch(() => {});
  }, []);
  useEffect(() => { refreshRevert(); }, [refreshRevert]);

  const [revert, setRevert] = useState<Revert>(null);
  function doRevert() {
    setRevert({ kind: "doing" });
    fetch("/api/upgrade/revert", { method: "POST" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((res) => setRevert({ kind: "done", msg: res.message || copy.updateCheck.revertModal.defaultMsg }))
      .catch((e) => setRevert({ kind: "error", msg: String(e.message || e) }));
  }

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
      .then((report) => {
        if (!report.blocked) refreshRevert(); // a backup now exists → offer revert
        setUpgrade(report.blocked ? { kind: "error", message: report.message } : { kind: "done", report });
      })
      .catch((e) => setUpgrade({ kind: "error", message: String(e.message || e) }));
  }

  const hasUpdate = status.kind === "available";
  const label = (() => {
    switch (status.kind) {
      case "checking": return copy.updateCheck.checking;
      case "available": return copy.updateCheck.available(status.latest.version);
      case "current": return copy.updateCheck.current(TEMPLATE_VERSION);
      case "error": return copy.updateCheck.checkForUpdates(TEMPLATE_VERSION);
      default: return copy.updateCheck.idle(TEMPLATE_VERSION);
    }
  })();

  return (
    <>
      <button
        onClick={() => (hasUpdate ? openUpgrade() : check())}
        title={hasUpdate ? (latest?.notes ?? copy.updateCheck.titleAvailable) : copy.updateCheck.titleCheck}
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

      {revertInfo?.canRevert && (
        <button
          onClick={() => setRevert({ kind: "confirm" })}
          title={copy.updateCheck.revertTitle(revertInfo.to ?? "?", revertInfo.from ?? "?")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: "transparent", border: "1px solid rgba(0,0,0,0.15)",
            borderRadius: 3, padding: "7px 12px", fontSize: 11, fontWeight: 500,
            letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
            color: "var(--admin-gray-mid)", fontFamily: "inherit",
          }}
        >
          {copy.updateCheck.revert}
        </button>
      )}

      {upgrade && latest && (
        <UpgradeModal
          latest={latest}
          state={upgrade}
          onApply={applyUpgrade}
          onClose={() => setUpgrade(null)}
        />
      )}

      {revert && (
        <RevertModal
          state={revert}
          info={revertInfo}
          onConfirm={doRevert}
          onClose={() => {
            const wasDone = revert.kind === "done";
            setRevert(null);
            if (wasDone) { refreshRevert(); window.location.reload(); }
          }}
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
            {copy.updateCheck.modal.eyebrow(latest.version)}
          </div>
          <h2 style={{ fontFamily: "var(--admin-font-heading)", fontSize: 20, fontWeight: 300, color: "var(--admin-ink)", margin: 0 }}>
            {state.kind === "done" ? copy.updateCheck.modal.titleApplied : copy.updateCheck.modal.titleApply}
          </h2>
        </div>

        <div style={{ padding: "20px 26px", fontSize: 13, color: "var(--admin-gray-dark)", lineHeight: 1.6 }}>
          {state.kind === "loading" && <p style={{ margin: 0 }}>{copy.updateCheck.modal.preparing}</p>}
          {state.kind === "applying" && <p style={{ margin: 0 }}>{copy.updateCheck.modal.applying}</p>}

          {state.kind === "error" && (
            <p style={{ margin: 0, color: "var(--admin-danger)" }}>{state.message}</p>
          )}

          {state.kind === "preview" && (
            <>
              {latest.notes && <p style={{ margin: "0 0 14px" }}>{latest.notes}</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
                <Row label={copy.updateCheck.modal.rowVersion} value={`${state.report.version.from ?? "?"} → ${state.report.version.to ?? latest.version}`} />
                <Row label={copy.updateCheck.modal.rowApplied} value={String(state.report.applied.length)} />
                {state.report.review.length > 0 && <Row label={copy.updateCheck.modal.rowReview} value={String(state.report.review.length)} />}
                <Row label={copy.updateCheck.modal.rowKept} value={String(state.report.kept.length)} />
              </div>
              {/* copy: the multi-<code>-chip upgrade-guidance paragraphs below stay inline
                  (fragmenting them into src/copy strands glue words); Phase-2 slot renderer. */}
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
                After applying, refresh the page — restart the dev server only if something looks off.
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
              <p style={{ margin: 0, fontSize: 12, color: "var(--admin-gray-mid)", lineHeight: 1.6 }}>
                <strong>Refresh</strong> to see the update. If anything looks off, restart the
                dev server (<code>Ctrl+C</code> → <code>npm run dev</code>) — it rewrote
                <code> vite.config.ts</code>. Then review with <code>git diff</code> and commit.
              </p>
            </>
          )}
        </div>

        <div style={{ padding: "14px 26px", borderTop: "1px solid rgba(0,0,0,0.08)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {state.kind === "preview" && (
            <>
              <GhostBtn onClick={onClose}>{copy.updateCheck.modal.cancel}</GhostBtn>
              <AccentBtn onClick={() => onApply(dirty)}>{dirty ? copy.updateCheck.modal.applyAnyway : copy.updateCheck.modal.apply}</AccentBtn>
            </>
          )}
          {state.kind === "done" && (
            <>
              <GhostBtn onClick={onClose}>{copy.updateCheck.modal.close}</GhostBtn>
              <AccentBtn onClick={() => window.location.reload()}>{copy.updateCheck.modal.refresh}</AccentBtn>
            </>
          )}
          {state.kind === "error" && <GhostBtn onClick={onClose}>{copy.updateCheck.modal.close}</GhostBtn>}
          {busy && <span style={{ fontSize: 12, color: "var(--admin-gray-mid)" }}>{copy.updateCheck.modal.working}</span>}
        </div>
      </div>
    </div>
  );
}

function RevertModal({
  state, info, onConfirm, onClose,
}: {
  state: Exclude<Revert, null>;
  info: RevertInfo | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const busy = state.kind === "doing";
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--admin-font-body)" }}
    >
      <div style={{ background: "#fff", borderRadius: 4, width: "90%", maxWidth: 460, boxShadow: "0 24px 64px rgba(0,0,0,0.22)" }}>
        <div style={{ padding: "22px 26px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
          <h2 style={{ fontFamily: "var(--admin-font-heading)", fontSize: 20, fontWeight: 300, color: "var(--admin-ink)", margin: 0 }}>
            {state.kind === "done" ? copy.updateCheck.revertModal.titleReverted : copy.updateCheck.revertModal.titleConfirm}
          </h2>
        </div>
        <div style={{ padding: "20px 26px", fontSize: 13, color: "var(--admin-gray-dark)", lineHeight: 1.6 }}>
          {state.kind === "confirm" && (
            <p style={{ margin: 0 }}>
              This restores the {info?.count ?? "changed"} file(s) from before the last update
              {info?.from ? <> (back to <strong>v{info.from}</strong>)</> : null}, and removes anything it added.
              Your work — <code>.env</code>, your variations, your palette — is untouched either way.
            </p>
          )}
          {state.kind === "doing" && <p style={{ margin: 0 }}>{copy.updateCheck.revertModal.restoring}</p>}
          {state.kind === "done" && <p style={{ margin: 0 }}>{state.msg} Reload to see the restored version, then restart the dev server if anything looks off.</p>}
          {state.kind === "error" && <p style={{ margin: 0, color: "var(--admin-danger)" }}>{state.msg}</p>}
        </div>
        <div style={{ padding: "14px 26px", borderTop: "1px solid rgba(0,0,0,0.08)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {state.kind === "confirm" && (<><GhostBtn onClick={onClose}>{copy.updateCheck.revertModal.cancel}</GhostBtn><AccentBtn onClick={onConfirm}>{copy.updateCheck.revertModal.revert}</AccentBtn></>)}
          {state.kind === "done" && <AccentBtn onClick={onClose}>{copy.updateCheck.revertModal.reload}</AccentBtn>}
          {state.kind === "error" && <GhostBtn onClick={onClose}>{copy.updateCheck.revertModal.close}</GhostBtn>}
          {busy && <span style={{ fontSize: 12, color: "var(--admin-gray-mid)" }}>{copy.updateCheck.revertModal.working}</span>}
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
