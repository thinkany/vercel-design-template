// Round-trip + standards test for the zero-dep zip module.
// Run: node scripts/lib/zip.test.mjs
import { createZip, extractZip } from "./zip.mjs";
import { writeFileSync, mkdtempSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

let failures = 0;
const ok = (cond, msg) => { if (!cond) { failures++; console.error("  ✗ " + msg); } else console.log("  ✓ " + msg); };

const entries = [
  { name: "a.txt", data: Buffer.from("hello world\n") },
  { name: "nested/dir/file.tsx", data: Buffer.from("export const x = 1;\n// ünïcode ✓ 🎨\n") },
  { name: "big.bin", data: Buffer.from(Array.from({ length: 50000 }, (_, i) => i % 256)) },
  { name: "empty.txt", data: Buffer.alloc(0) },
];

const zip = createZip(entries);

// 1. Internal round-trip: extract equals input.
const back = extractZip(zip);
ok(back.length === entries.length, `entry count preserved (${back.length})`);
for (const e of entries) {
  const got = back.find((b) => b.name === e.name);
  ok(got && Buffer.compare(got.data, e.data) === 0, `round-trips identically: ${e.name}`);
}

// 2. Standards check: the system `unzip` can list + extract it.
let hasUnzip = true;
try { execSync("command -v unzip", { stdio: "ignore" }); } catch { hasUnzip = false; }
if (!hasUnzip) {
  console.log("  ⚠ system unzip not available — skipped external validation");
} else {
  const dir = mkdtempSync(join(tmpdir(), "ziptest-"));
  const zipPath = join(dir, "t.zip");
  writeFileSync(zipPath, zip);
  execSync(`unzip -tqq ${zipPath}`, { stdio: "ignore" }); // integrity test
  ok(true, "system `unzip -t` integrity check passed");
  execSync(`unzip -qq ${zipPath} -d ${join(dir, "out")}`, { stdio: "ignore" });
  const extracted = execSync(`cat ${join(dir, "out", "nested/dir/file.tsx")}`).toString();
  ok(extracted.includes("ünïcode ✓ 🎨"), "system unzip extracted unicode content correctly");
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
