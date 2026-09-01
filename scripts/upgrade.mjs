// Template upgrade overlay — the single engine behind the dashboard's one-click
// upgrade (/api/upgrade) and the /upgrade Claude command.
//
// Given a NEW template source (a zip URL, a local zip, or an extracted dir) and a
// TARGET project dir, it overlays files by tier from upgrade.manifest.json:
//   CORE    → overwrite (default for everything not listed)
//   KEEP    → never touched (designer-owned)
//   REVIEW  → written to '<path>.upgrade-new' + flagged, never overwritten in place
// The designer's own git diff is the safety net, so by default it refuses to run on
// a dirty tree (pass force to override, e.g. after an explicit UI confirm).
//
// Pure Node, no dependencies (uses the zero-dep zip module). Exports runUpgrade()
// for the dev endpoint; also runnable as a CLI:
//   node scripts/upgrade.mjs --url https://create.thinkany.design/template-latest.zip
//   node scripts/upgrade.mjs --zip ./template-latest.zip --target /path/to/project
//   node scripts/upgrade.mjs --source ./fresh-template --dry-run
import { readFile, writeFile, mkdir, readdir, stat, cp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const { extractZip } = await import(new URL("./lib/zip.mjs", import.meta.url).href);

// ── glob matching (repo-relative POSIX paths) ─────────────────────────────────
function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    if (glob[i] === "*" && glob[i + 1] === "*") {
      re += ".*";
      i++;
      if (glob[i + 1] === "/") i++; // consume the slash after ** so 'a/**' matches 'a'
    } else if (glob[i] === "*") {
      re += "[^/]*";
    } else {
      re += glob[i].replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp("^" + re + "$");
}

/** Classify a repo-relative path against the manifest. Default is 'core'. */
export function classify(rel, manifest) {
  const anyMatch = (list) => (list || []).some((g) => globToRegExp(g).test(rel));
  if (anyMatch(manifest.keep)) return "keep";
  if (anyMatch(manifest.review)) return "review";
  return "core";
}

// ── load the new source into a Map<relPath, Buffer> ───────────────────────────
async function walkDir(dir, base = dir, out = new Map()) {
  const IGNORE = new Set(["node_modules", ".git", "dist", "figma-export"]);
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (IGNORE.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walkDir(full, base, out);
    else out.set(path.relative(base, full).split(path.sep).join("/"), await readFile(full));
  }
  return out;
}

async function loadSource({ url, zip, source }) {
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch ${url} → ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return new Map(extractZip(buf).map((e) => [e.name, e.data]));
  }
  if (zip) {
    return new Map(extractZip(await readFile(zip)).map((e) => [e.name, e.data]));
  }
  if (source) return walkDir(path.resolve(source));
  throw new Error("No source: pass { url } | { zip } | { source }");
}

// ── git-clean gate ────────────────────────────────────────────────────────────
function gitDirtyFiles(targetDir) {
  try {
    const out = execFileSync("git", ["status", "--porcelain"], {
      cwd: targetDir, encoding: "utf8",
    });
    return out.split("\n").map((l) => l.slice(3).trim()).filter(Boolean);
  } catch {
    return null; // not a git repo / git missing → caller decides
  }
}

/**
 * Run the overlay.
 * @param {{targetDir?: string, url?: string, zip?: string, source?: string,
 *          dryRun?: boolean, force?: boolean}} opts
 * @returns {Promise<object>} report
 */
export async function runUpgrade(opts = {}) {
  const targetDir = path.resolve(opts.targetDir || process.cwd());
  const files = await loadSource(opts);

  const manifestBuf = files.get("upgrade.manifest.json");
  if (!manifestBuf) throw new Error("Source has no upgrade.manifest.json");
  const manifest = JSON.parse(manifestBuf);

  const dirty = gitDirtyFiles(targetDir);
  const report = {
    targetDir,
    dryRun: !!opts.dryRun,
    gitDirty: dirty || [],
    gitAvailable: dirty !== null,
    version: { from: null, to: null },
    applied: [], // CORE files written
    review: [], // REVIEW sidecars written
    kept: [], // KEEP files skipped
    blocked: false,
    message: "",
  };

  // version from/to
  try {
    const cur = JSON.parse(await readFile(path.join(targetDir, "public/version.json"), "utf8"));
    report.version.from = cur.version ?? null;
  } catch {}
  try { const v = files.get("public/version.json"); if (v) report.version.to = JSON.parse(v).version ?? null; } catch {}

  // Safety gate: refuse to WRITE on a dirty tree unless forced (so the diff is
  // reviewable). A dry run always previews — it reports gitDirty so callers can warn.
  if (!opts.dryRun && report.gitAvailable && report.gitDirty.length && !opts.force) {
    report.blocked = true;
    report.message =
      `Working tree has ${report.gitDirty.length} uncommitted change(s). Commit or stash first so the upgrade is reviewable via git diff — or re-run with force.`;
    return report;
  }

  // Dry run: classify + report only, nothing written or backed up.
  if (opts.dryRun) {
    for (const [rel] of files) {
      const tier = classify(rel, manifest);
      if (tier === "keep") report.kept.push(rel);
      else (tier === "review" ? report.review : report.applied).push(rel);
    }
    report.message = `Dry run: ${report.applied.length} core file(s) would update, ${report.review.length} need review, ${report.kept.length} kept.`;
    return report;
  }

  // Plan every write (dest path + whether the target already exists), so we can
  // back up before touching anything.
  const plan = [];
  for (const [rel, data] of files) {
    const tier = classify(rel, manifest);
    if (tier === "keep") { report.kept.push(rel); continue; }
    const dest = tier === "review" ? rel + ".upgrade-new" : rel;
    const abs = path.join(targetDir, dest);
    plan.push({ data, dest, abs, tier, existed: await fileExists(abs) });
    (tier === "review" ? report.review : report.applied).push(rel);
  }

  // Backup pass — copy every file we'll OVERWRITE into .upgrade-backup/<ts>/, and
  // record files we ADD (revert deletes those). Written BEFORE any apply, so a
  // crash mid-write is still fully revertible.
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(targetDir, ".upgrade-backup", ts);
  const filesOverwritten = [], filesAdded = [];
  for (const item of plan) {
    if (item.existed) {
      const bAbs = path.join(backupDir, item.dest);
      await mkdir(path.dirname(bAbs), { recursive: true });
      await cp(item.abs, bAbs);
      filesOverwritten.push(item.dest);
    } else {
      filesAdded.push(item.dest);
    }
  }
  const backupManifest = {
    fromVersion: report.version.from, toVersion: report.version.to,
    date: ts, filesOverwritten, filesAdded,
  };
  await mkdir(backupDir, { recursive: true });
  await writeFile(path.join(backupDir, "manifest.json"), JSON.stringify(backupManifest, null, 2));

  // Apply pass.
  for (const item of plan) {
    await mkdir(path.dirname(item.abs), { recursive: true });
    await writeFile(item.abs, item.data);
  }

  report.backup = { dir: path.relative(targetDir, backupDir), ...backupManifest };
  report.message = `Applied ${report.applied.length} core file(s); ${report.review.length} sidecar(s) for review; ${report.kept.length} kept. Revert available.`;
  return report;
}

async function fileExists(p) { try { await stat(p); return true; } catch { return false; } }

/**
 * Silent, diff-only CORE refresh — the app runs this on project OPEN so a newer app
 * build carries new framework behavior (commands, CLAUDE.md, base chrome, build config)
 * into projects scaffolded by an older build. Unlike runUpgrade this:
 *   • writes ONLY the CORE files whose bytes actually differ (nothing churns when the
 *     project is already current, so it won't trigger a Vite rebuild for no reason),
 *   • never touches KEEP (the designer's work) and SKIPS REVIEW entirely (hybrid files
 *     like package.json stay a manual `/upgrade` concern, so deps are never clobbered),
 *   • has no git gate (framework files aren't designer-reviewed) but still snapshots a
 *     one-shot revert backup (only when it actually changes something).
 * @param {{targetDir: string, source: string}} opts  source = an extracted template dir
 * @returns {Promise<{changed: string[], fromVersion: any, toVersion: any, backupDir?: string, message: string}>}
 */
export async function runRefresh({ targetDir, source } = {}) {
  targetDir = path.resolve(targetDir);
  const files = await loadSource({ source });
  const manifestBuf = files.get("upgrade.manifest.json");
  if (!manifestBuf) throw new Error("Source has no upgrade.manifest.json");
  const manifest = JSON.parse(manifestBuf);

  // Plan only CORE files whose content differs from what's on disk.
  const toWrite = [];
  for (const [rel, data] of files) {
    if (classify(rel, manifest) !== "core") continue; // keep + review untouched
    const abs = path.join(targetDir, rel);
    let cur = null;
    try { cur = await readFile(abs); } catch {}
    if (cur && cur.equals(data)) continue; // identical → skip (no churn)
    toWrite.push({ abs, rel, data, existed: !!cur });
  }

  let fromVersion = null, toVersion = null;
  try { fromVersion = JSON.parse(await readFile(path.join(targetDir, "public/version.json"), "utf8")).version ?? null; } catch {}
  try { const v = files.get("public/version.json"); if (v) toVersion = JSON.parse(v).version ?? null; } catch {}

  if (!toWrite.length) return { changed: [], fromVersion, toVersion, message: "Framework already current." };

  // Backup pass — only overwritten files, into the same store runRevert reads.
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(targetDir, ".upgrade-backup", ts);
  const filesOverwritten = [], filesAdded = [];
  for (const it of toWrite) {
    if (it.existed) {
      const bAbs = path.join(backupDir, it.rel);
      await mkdir(path.dirname(bAbs), { recursive: true });
      await cp(it.abs, bAbs);
      filesOverwritten.push(it.rel);
    } else filesAdded.push(it.rel);
  }
  await mkdir(backupDir, { recursive: true });
  await writeFile(path.join(backupDir, "manifest.json"),
    JSON.stringify({ fromVersion, toVersion, date: ts, filesOverwritten, filesAdded }, null, 2));

  // Apply pass.
  for (const it of toWrite) {
    await mkdir(path.dirname(it.abs), { recursive: true });
    await writeFile(it.abs, it.data);
  }

  const changed = toWrite.map((it) => it.rel);
  return { changed, fromVersion, toVersion, backupDir: path.relative(targetDir, backupDir),
    message: `Refreshed ${changed.length} framework file(s).` };
}

/** Newest backup stamp dir (sortable ISO name), or null. */
async function latestBackup(targetDir) {
  const root = path.join(targetDir, ".upgrade-backup");
  try {
    const stamps = (await readdir(root, { withFileTypes: true }))
      .filter((e) => e.isDirectory()).map((e) => e.name).sort();
    return stamps.length ? path.join(root, stamps[stamps.length - 1]) : null;
  } catch { return null; }
}

/** Whether a revert is available (a backup exists), + a summary for the UI. */
export async function revertStatus(targetDir = process.cwd()) {
  const dir = await latestBackup(path.resolve(targetDir));
  if (!dir) return { canRevert: false };
  try {
    const bm = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8"));
    return {
      canRevert: true, from: bm.toVersion, to: bm.fromVersion,
      count: (bm.filesOverwritten?.length || 0) + (bm.filesAdded?.length || 0),
    };
  } catch { return { canRevert: false }; }
}

/**
 * Revert the most recent update: restore every overwritten file from the backup,
 * delete every file the update added (incl. *.upgrade-new sidecars), then remove
 * the backup so revert is one-shot. Returns a report.
 */
export async function runRevert(targetDir = process.cwd()) {
  targetDir = path.resolve(targetDir);
  const dir = await latestBackup(targetDir);
  if (!dir) return { reverted: false, message: "No upgrade backup found — nothing to revert." };
  const bm = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8"));
  const restored = [], deleted = [];
  for (const rel of bm.filesOverwritten || []) {
    const dst = path.join(targetDir, rel);
    await mkdir(path.dirname(dst), { recursive: true });
    await cp(path.join(dir, rel), dst);
    restored.push(rel);
  }
  for (const rel of bm.filesAdded || []) {
    try { await rm(path.join(targetDir, rel)); deleted.push(rel); } catch {}
  }
  await rm(dir, { recursive: true, force: true });
  return {
    reverted: true, from: bm.toVersion, to: bm.fromVersion, restored, deleted,
    message: `Reverted (v${bm.toVersion ?? "?"} → v${bm.fromVersion ?? "?"}): restored ${restored.length} file(s), removed ${deleted.length}.`,
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") o.dryRun = true;
    else if (a === "--force") o.force = true;
    else if (a === "--revert") o.revert = true;
    else if (a === "--url") o.url = argv[++i];
    else if (a === "--zip") o.zip = argv[++i];
    else if (a === "--source") o.source = argv[++i];
    else if (a === "--target") o.targetDir = argv[++i];
  }
  return o;
}

// Run as CLI only when invoked directly (not when imported by the dev endpoint).
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.revert) {
    runRevert(opts.targetDir)
      .then((r) => { console.log("\n" + r.message); if (!r.reverted) process.exit(2); })
      .catch((e) => { console.error("revert failed:", e.message); process.exit(1); });
  } else {
  if (!opts.url && !opts.zip && !opts.source) {
    opts.url = "https://create.thinkany.design/template-latest.zip";
  }
  runUpgrade(opts)
    .then((r) => {
      console.log(`\nTemplate upgrade ${r.version.from ?? "?"} → ${r.version.to ?? "?"}  (${r.targetDir})`);
      if (r.blocked) { console.error("\n⚠ " + r.message); process.exit(2); }
      console.log("\n" + r.message);
      if (r.applied.length) console.log("\nUpdated (CORE):\n  " + r.applied.join("\n  "));
      if (r.review.length) console.log("\nReview these (written as *.upgrade-new):\n  " + r.review.join("\n  "));
      console.log("\nReview everything with `git diff`, then commit.");
      if (r.backup) console.log("Changed your mind? `node scripts/upgrade.mjs --revert` restores the pre-update state.");
    })
    .catch((e) => { console.error("upgrade failed:", e.message); process.exit(1); });
  }
}
