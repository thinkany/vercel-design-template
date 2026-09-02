// ©2026 thinkany llc. All rights reserved.
// Build the licensed-skills bundle the derive service serves at GET /api/skills.
//
// The canonical skill playbooks live in desktop/skills/*.md (app-internal: excluded
// from the packaged app AND from the scaffold snapshot, since desktop/ never ships).
// The scaffold keeps a one-paragraph STUB per skill under .claude/commands/ so the
// slash command autocompletes and /guide lists it; the real body reaches the model
// only through the app (desktop/skills-client.cjs), which fetches this bundle with
// the Design license and expands the command before the SDK sees it.
//
// Same dual-home pattern as the lens deck (desktop/intake/lenses.cjs ↔ derive/
// direction/). Run after editing a skill, then commit + deploy the derive repo:
//
//   node desktop/build/sync-skills.cjs            # → ../derive/skills/bundle.json
//   DERIVE_REPO=/path/to/derive node desktop/build/sync-skills.cjs
//
// Output is deterministic (sorted keys, LF) so the derive repo's diff is the diff.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const appRoot = path.resolve(__dirname, "..", "..");
const srcDir = path.join(appRoot, "desktop", "skills");
const deriveRepo = process.env.DERIVE_REPO || path.resolve(appRoot, "..", "derive");
const outFile = path.join(deriveRepo, "skills", "bundle.json");

// Split "---\n<frontmatter>\n---\n<body>". Only `description` is read from the
// frontmatter; the body is served verbatim (it is what the model runs).
function parseSkill(md, name) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${name}.md: missing frontmatter`);
  const desc = (m[1].match(/^description:\s*(.*)$/m) || [])[1];
  if (!desc) throw new Error(`${name}.md: frontmatter has no description`);
  const body = m[2].replace(/\r\n/g, "\n").trim() + "\n";
  return { description: desc.trim(), body, sha: crypto.createHash("sha256").update(body).digest("hex").slice(0, 16) };
}

function buildBundle() {
  const skills = {};
  for (const f of fs.readdirSync(srcDir).sort()) {
    if (!f.endsWith(".md")) continue;
    const name = f.replace(/\.md$/, "");
    skills[name] = parseSkill(fs.readFileSync(path.join(srcDir, f), "utf8"), name);
  }
  if (!Object.keys(skills).length) throw new Error(`no skills in ${srcDir}`);
  return { skills };
}

function run() {
  const bundle = buildBundle();
  if (!fs.existsSync(deriveRepo)) throw new Error(`derive repo not found at ${deriveRepo} (set DERIVE_REPO)`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(bundle, null, 2) + "\n");
  const names = Object.keys(bundle.skills);
  console.log(`[sync-skills] ${names.length} skill(s) → ${path.relative(appRoot, outFile)}: ${names.join(", ")}`);
}

if (require.main === module) run();
module.exports = { buildBundle, parseSkill };
