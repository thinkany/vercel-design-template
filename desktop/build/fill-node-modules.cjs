// Fill the packaged app's node_modules so every production package resolves.
//
// electron-builder collects node_modules from `npm ls` and, when a package is
// reached from more than one parent, nests it under the FIRST parent it saw
// (e.g. node_modules/rehype/node_modules/rehype-stringify). Node's resolver
// walks UP from the importer, so a sibling that also needs it (here
// @astrojs/markdown-remark) can't find it, and the packaged app's Astro site
// server died with ERR_MODULE_NOT_FOUND. npm's own layout is flat: those
// packages sit at the top level of node_modules, where everyone can reach them.
//
// This walks the lockfile from the app's production dependencies and copies
// each reachable package that is missing from the bundle's top level, from the
// worktree's node_modules, keeping the worktree's nested node_modules inside it
// (npm put them there for a reason). Skipped: packages for other platforms,
// type-only packages, and the Claude SDK platform packages (shipped separately
// as claude-bin by after-pack.cjs).

const fs = require("node:fs");
const path = require("node:path");

const SKIP_PREFIX = ["@anthropic-ai/claude-agent-sdk-", "@types/"];

// electron-builder also strips `.d.ts` (and a few other extensions) from every
// package as "dev only". Astro reads templates/content/types.d.ts at RUNTIME to
// generate a project's .astro/types.d.ts, so its dev server died on ENOENT. These
// package subtrees are restored file-for-file from the worktree.
const RESTORE = ["astro/templates"];

function reachableProduction(appRoot) {
  const lock = JSON.parse(fs.readFileSync(path.join(appRoot, "package-lock.json"), "utf8"));
  const pk = lock.packages || {};
  const root = pk[""] || {};
  // Resolve `name` from a package path the way node does: nearest node_modules up the chain.
  const resolve = (from, name) => {
    let base = from;
    for (;;) {
      const cand = (base ? base + "/" : "") + "node_modules/" + name;
      if (pk[cand]) return cand;
      if (!base) return null;
      const i = base.lastIndexOf("/node_modules/");
      base = i >= 0 ? base.slice(0, i) : "";
    }
  };
  const seen = new Set(); const names = new Set();
  const stack = Object.keys(root.dependencies || {}).map((d) => ["", d]);
  while (stack.length) {
    const [from, name] = stack.pop();
    const p = resolve(from, name);
    if (!p || seen.has(p)) continue;
    seen.add(p); names.add(name);
    const deps = { ...(pk[p].dependencies || {}), ...(pk[p].optionalDependencies || {}) };
    for (const d of Object.keys(deps)) stack.push([p, d]);
  }
  return names;
}

function forThisPlatform(pkgDir) {
  let pj; try { pj = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8")); } catch { return false; }
  const os = pj.os, cpu = pj.cpu;
  if (Array.isArray(os) && os.length && !os.includes("darwin") && !os.some((o) => String(o).startsWith("!"))) return false;
  if (Array.isArray(cpu) && cpu.length && !cpu.includes("arm64") && !cpu.includes("x64")) return false;
  return true;
}

function fill({ appRoot, unpackedModules, log = console.log }) {
  const src = path.join(appRoot, "node_modules");
  const added = [];
  for (const name of [...reachableProduction(appRoot)].sort()) {
    if (SKIP_PREFIX.some((p) => name.startsWith(p))) continue;
    const dest = path.join(unpackedModules, name);
    if (fs.existsSync(dest)) continue;
    const from = path.join(src, name);
    if (!fs.existsSync(from) || !forThisPlatform(from)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(from, dest, { recursive: true, dereference: false, verbatimSymlinks: true, filter: (p) => path.basename(p) !== ".bin" });
    added.push(name);
  }
  log(`[fill-node-modules] added ${added.length} package(s) to the bundle's top level${added.length ? ": " + added.join(", ") : ""}`);
  let restored = 0;
  for (const sub of RESTORE) {
    const from = path.join(src, sub), to = path.join(unpackedModules, sub);
    if (!fs.existsSync(from)) continue;
    const walk = (dir) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, ent.name);
        if (ent.isDirectory()) { walk(f); continue; }
        const dest = path.join(to, path.relative(from, f));
        if (fs.existsSync(dest)) continue;
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(f, dest);
        restored++;
      }
    };
    walk(from);
  }
  log(`[fill-node-modules] restored ${restored} runtime file(s) under ${RESTORE.join(", ")}`);
  return added;
}

module.exports = { fill, reachableProduction };
