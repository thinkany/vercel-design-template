// Guarantees BOTH macOS arches (arm64 + x64) of every arch-specific native module
// are present before packaging, so `npm run dist` always produces working arm64 AND
// x64 DMGs regardless of which kind of Mac runs the build.
//
// Why this is needed: these native modules ship as separate per-arch npm packages
// selected by `os`/`cpu`, so a normal `npm install` only installs the HOST arch's
// copy. The app bundles and RUNS the Vite/Tailwind toolchain, so the foreign-arch
// DMG needs the foreign-arch binaries too. This force-installs whichever arch is
// missing, at the same version as the one already installed.

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");

// Base names; the real packages are `${base}-arm64` and `${base}-x64`.
const BASES = [
  "@anthropic-ai/claude-agent-sdk-darwin", // the Claude CLI binary (shipped via afterPack)
  "@esbuild/darwin", // Vite dev/build transform
  "lightningcss-darwin", // Tailwind v4 / Vite CSS
  "@tailwindcss/oxide-darwin", // Tailwind v4 engine
  "@rollup/rollup-darwin", // Vite production bundler
];

function versionOf(name) {
  try {
    return require(path.join(ROOT, "node_modules", name, "package.json")).version;
  } catch {
    return null;
  }
}

const missing = [];
for (const base of BASES) {
  const arm = `${base}-arm64`;
  const x64 = `${base}-x64`;
  const version = versionOf(arm) || versionOf(x64);
  if (!version) {
    console.warn(`[ensure-arch] neither arch of ${base} is installed — skipping (run npm install first).`);
    continue;
  }
  if (!fs.existsSync(path.join(ROOT, "node_modules", arm))) missing.push(`${arm}@${version}`);
  if (!fs.existsSync(path.join(ROOT, "node_modules", x64))) missing.push(`${x64}@${version}`);
}

if (!missing.length) {
  console.log("[ensure-arch] both arm64 + x64 native modules present. Nothing to do.");
  process.exit(0);
}

console.log("[ensure-arch] installing missing arch variants:\n  " + missing.join("\n  "));
// --force bypasses the os/cpu (EBADPLATFORM) guard; --no-save keeps package.json
// clean; --ignore-scripts avoids any arch-checking postinstall on prebuilt binaries.
execSync(`npm install --no-save --force --ignore-scripts ${missing.join(" ")}`, { cwd: ROOT, stdio: "inherit" });
console.log("[ensure-arch] done.");
