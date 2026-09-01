// electron-builder afterPack hook.
//
// Places the ARCH-MATCHING Claude binary at Contents/Resources/claude-bin/claude
// for each per-arch build. This replaces the old hardcoded (arm64-only)
// `extraResources` copy, which would have shipped an arm64 binary inside the x64
// DMG. Runs once per arch electron-builder builds (arm64, then x64).
//
// The runtime (desktop/agent.mjs resolveClaudeExecutable) looks for the binary at
// a fixed `claude-bin/claude` path, so each arch's app must have its own matching
// binary there — which is exactly what this hook guarantees.

const fs = require("node:fs");
const path = require("node:path");

// builder-util's Arch enum values (numeric) → the darwin platform-package suffix.
const ARCH = { 0: "ia32", 1: "x64", 2: "armv7l", 3: "arm64", 4: "universal" };

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const archStr = ARCH[context.arch] || "x64";
  // A universal build is produced by MERGING the two per-arch builds; each of
  // those per-arch passes already placed its own binary, so skip the merge pass.
  if (archStr === "universal") return;

  const appRoot = path.resolve(__dirname, "..", "..");
  const src = path.join(appRoot, "node_modules", "@anthropic-ai", `claude-agent-sdk-darwin-${archStr}`, "claude");
  if (!fs.existsSync(src)) {
    throw new Error(
      `[afterPack] Claude binary for ${archStr} not found at ${src}.\n` +
      `The x64 platform packages may be missing — run \`node desktop/build/ensure-arch-deps.cjs\` (predist does this automatically).`
    );
  }

  const productFilename = context.packager.appInfo.productFilename; // "thinkany design"
  const dest = path.join(context.appOutDir, `${productFilename}.app`, "Contents", "Resources", "claude-bin", "claude");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  fs.chmodSync(dest, 0o755);
  console.log(`[afterPack] claude (darwin-${archStr}) -> ${path.relative(context.appOutDir, dest)}`);
};
