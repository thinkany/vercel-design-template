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
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
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

  for (const [rel, data] of files) {
    const tier = classify(rel, manifest);
    if (tier === "keep") { report.kept.push(rel); continue; }

    const dest = tier === "review" ? rel + ".upgrade-new" : rel;
    const abs = path.join(targetDir, dest);
    if (!opts.dryRun) {
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, data);
    }
    (tier === "review" ? report.review : report.applied).push(rel);
  }

  report.message = report.dryRun
    ? `Dry run: ${report.applied.length} core file(s) would update, ${report.review.length} need review, ${report.kept.length} kept.`
    : `Applied ${report.applied.length} core file(s); ${report.review.length} sidecar(s) for review; ${report.kept.length} kept.`;
  return report;
}

// ── CLI ───────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") o.dryRun = true;
    else if (a === "--force") o.force = true;
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
    })
    .catch((e) => { console.error("upgrade failed:", e.message); process.exit(1); });
}
