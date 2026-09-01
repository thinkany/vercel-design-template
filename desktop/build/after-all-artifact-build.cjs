// electron-builder afterAllArtifactBuild hook — sign + notarize + staple each DMG.
//
// mac.notarize handles the .app (signs, notarizes, staples it), but electron-builder
// leaves the DMG *container* unsigned + un-notarized, so a freshly downloaded DMG trips
// Gatekeeper on open ("no usable signature") even though the app inside is clean. For a
// warning-free DMG the container needs the full treatment IN ORDER: code-sign it, then
// notarize it (its contents are already Developer-ID signed + hardened), then staple the
// ticket. Signing must come first — signing changes the file, which would invalidate an
// earlier staple.
//
// Credentials come from the SAME env the signed build already uses (sourced from
// notarize.env.local): APPLE_API_KEY / APPLE_API_KEY_ID / APPLE_API_ISSUER. If those
// aren't set (an unsigned dev build), this is a clean no-op.
const { execFileSync } = require("node:child_process");

// The "Developer ID Application" cert in the login keychain (auto-detected so this
// isn't pinned to one machine/cert). Returns the 40-char SHA-1 or null.
function developerIdHash() {
  try {
    const out = execFileSync("security", ["find-identity", "-v", "-p", "codesigning"]).toString();
    const line = out.split("\n").find((l) => l.includes("Developer ID Application"));
    const m = line && line.match(/\b([0-9A-F]{40})\b/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

module.exports = async function afterAllArtifactBuild(buildResult) {
  const { APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER } = process.env;
  const dmgs = (buildResult.artifactPaths || []).filter((p) => p.endsWith(".dmg"));
  if (!dmgs.length) return [];
  if (!APPLE_API_KEY || !APPLE_API_KEY_ID || !APPLE_API_ISSUER) {
    console.log("[after-all] no Apple API creds in env — skipping DMG sign/notarize");
    return [];
  }
  const idHash = developerIdHash();
  if (!idHash) {
    console.log("[after-all] no Developer ID Application cert found — skipping DMG sign/notarize");
    return [];
  }
  for (const dmg of dmgs) {
    console.log(`[after-all] sign + notarize + staple DMG → ${dmg}`);
    execFileSync("codesign", ["--force", "--sign", idHash, "--timestamp", dmg], { stdio: "inherit" });
    execFileSync(
      "xcrun",
      ["notarytool", "submit", dmg, "--key", APPLE_API_KEY, "--key-id", APPLE_API_KEY_ID, "--issuer", APPLE_API_ISSUER, "--wait"],
      { stdio: "inherit" },
    );
    execFileSync("xcrun", ["stapler", "staple", dmg], { stdio: "inherit" });
  }
  return [];
};
