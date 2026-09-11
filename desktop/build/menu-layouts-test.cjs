// ©2026 thinkany llc. All rights reserved.
// THE NINE LAYOUTS — P1's test, run through P4's check.
//
//   npx electron desktop/build/menu-layouts-test.cjs [--shots]
//
// The configured header's claim is "whichever of the nine the designer picks, it
// renders correctly, first pass, every time". This proves it the only way that
// claim can be proved: it stands up a real scaffold with a real nav, writes each
// of the nine configs in turn, and runs the deterministic menu check against the
// live preview at every breakpoint. Nine layouts × three widths × every panel.
//
// It also proves the check itself, by rigging one layout to fail (a custom header
// with the 2026-08-29 centred-logo bug: a col-start-2 logo after the col-start-3
// nav, with no row-start-1) and asserting the check names the right rule.
//
// `--shots` also writes a PNG per layout per width into the run folder, for the
// one-time eyeball the spec's P1 test asks for.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { app } = require("electron");

const REPO = path.resolve(__dirname, "..", "..");
const SHOTS = process.argv.includes("--shots");
const RUN = path.join(os.tmpdir(), "ta-menu-layouts");

const LAYOUTS = [
  "simple-left-right", "simple-left-center", "simple-center-split",
  "dropdown-left-right", "dropdown-left-center", "dropdown-center-split",
  "mega-left-right", "mega-left-center", "mega-center-split",
];
const CONFIG = {
  "simple-left-right": { menuKind: "none", placement: "left-right" },
  "simple-left-center": { menuKind: "none", placement: "left-center" },
  "simple-center-split": { menuKind: "none", placement: "center-split" },
  "dropdown-left-right": { menuKind: "dropdown", placement: "left-right" },
  "dropdown-left-center": { menuKind: "dropdown", placement: "left-center" },
  "dropdown-center-split": { menuKind: "dropdown", placement: "center-split" },
  "mega-left-right": { menuKind: "mega", placement: "left-right" },
  "mega-left-center": { menuKind: "mega", placement: "left-center" },
  "mega-center-split": { menuKind: "mega", placement: "center-split" },
};

// A real multi-page nav — one page is not a menu. Five items exercise the
// center-split odd/even rule (2 left, 3 right) and give every panel a trigger.
const PAGES = `// ©2026 thinkany llc. All rights reserved.
import type { DesignPage } from "./pages.schema";

export const designPages: DesignPage[] = [
  { id: "home", route: "", name: "Home", component: "Home" },
  { id: "work", route: "work", name: "Work", component: "Home" },
  { id: "services", route: "services", name: "Services", component: "Home" },
  { id: "about", route: "about", name: "About", component: "Home" },
  { id: "contact", route: "contact", name: "Contact", component: "Home" },
];

export const defaultDesignPageId = "home";

export type { DesignPage } from "./pages.schema";
`;

// The custom header that SHOULD fail: the exact centred-logo bug the spec names.
// A col-start-2 logo declared after the col-start-3 nav, with no row-start-1, gets
// bumped to an implicit second row — links on top, wordmark below.
const BROKEN_HEADER = `// A deliberately broken custom header (menu-layouts-test).
import { designPages } from "@/app/pages";
import { siteConfig } from "@/config/site";

export function Header({ onNavigate }: { onNavigate: (page: string) => void }) {
  const pages = designPages;
  const half = Math.floor(pages.length / 2);
  return (
    <header data-block="header" data-block-name="Header" className="sticky top-0 z-[60] w-full border-b border-black/10 bg-ta-surface">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-6 py-4">
        <nav data-header-nav="left" className="col-start-1 hidden items-center justify-end gap-8 @lg:flex">
          {pages.slice(0, half).map((p) => (
            <button key={p.id} data-nav-link={p.id} onClick={() => onNavigate(p.id)} className="font-ta-sans text-xs uppercase text-ta-body">{p.name}</button>
          ))}
        </nav>
        <nav data-header-nav="right" className="col-start-3 hidden items-center justify-start gap-8 @lg:flex">
          {pages.slice(half).map((p) => (
            <button key={p.id} data-nav-link={p.id} onClick={() => onNavigate(p.id)} className="font-ta-sans text-xs uppercase text-ta-body">{p.name}</button>
          ))}
        </nav>
        <div className="col-start-2 flex items-center justify-center">
          <button data-header-logo onClick={() => onNavigate("home")} className="font-ta-display text-lg text-ta-ink">{siteConfig.clientName}</button>
        </div>
      </div>
    </header>
  );
}
`;

function sh(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", ...opts });
    p.on("error", reject);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

/** A clean scaffold from the committed tree, with node_modules linked from the repo. */
async function makeProject(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  await sh("git", ["-C", REPO, "checkout-index", "-a", "-f", `--prefix=${dir}${path.sep}`]);
  // The scaffold's own package.json, as make-template injects it.
  const scaffoldPkg = path.join(REPO, "desktop", "build", "scaffold-package.json");
  if (fs.existsSync(scaffoldPkg)) fs.copyFileSync(scaffoldPkg, path.join(dir, "package.json"));
  fs.rmSync(path.join(dir, "desktop"), { recursive: true, force: true });
  try { fs.symlinkSync(path.join(REPO, "node_modules"), path.join(dir, "node_modules"), "dir"); }
  catch { /* already there */ }
  // A branded, multi-page project with the tablet preview on.
  fs.writeFileSync(path.join(dir, "src", "app", "pages.ts"), PAGES);
  let env = fs.readFileSync(path.join(dir, ".env"), "utf8");
  env = env.replace(/VITE_CLIENT_NAME=.*/, 'VITE_CLIENT_NAME="Fieldnote"')
           .replace(/VITE_PROJECT_TYPE=.*/, 'VITE_PROJECT_TYPE="website"');
  if (!/VITE_ENABLE_TABLET/.test(env)) env += '\nVITE_ENABLE_TABLET="true"\n';
  else env = env.replace(/VITE_ENABLE_TABLET=.*/, 'VITE_ENABLE_TABLET="true"');
  fs.writeFileSync(path.join(dir, ".env"), env);
}

function writeConfig(dir, layout) {
  const cfg = CONFIG[layout];
  const file = path.join(dir, "src", "app", "header.config.ts");
  let src = fs.readFileSync(file, "utf8");
  const at = src.indexOf("export const headerConfig");
  const head = src.slice(0, at);
  const tail = src.slice(at)
    .replace(/(placement:\s*)["'][^"']*["']/, `$1"${cfg.placement}"`)
    .replace(/(menuKind:\s*)["'][^"']*["']/, `$1"${cfg.menuKind}"`);
  fs.writeFileSync(file, head + tail);
}

function startVite(dir) {
  return new Promise((resolve, reject) => {
    // Electron's own binary as a plain node (ELECTRON_RUN_AS_NODE), the same way
    // the app launches vite in a packaged build.
    const proc = spawn(process.execPath, [path.join(REPO, "node_modules", "vite", "bin", "vite.js")], {
      cwd: dir,
      // NO_COLOR as well as FORCE_COLOR=0: vite still emits SGR codes with only the
      // latter, and they land mid-URL ("localhost:<ESC>[1m5173"), defeating the match.
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", FORCE_COLOR: "0", NO_COLOR: "1", BROWSER: "none" },
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    let settled = false;
    let log = "";
    const onData = (buf) => {
      // Strip any SGR escapes that survive NO_COLOR before matching.
      log += String(buf).replace(/\x1b\[[0-9;]*m/g, "");
      const m = log.match(/https?:\/\/localhost:(\d+)/);
      if (m && !settled) { settled = true; resolve({ proc, url: m[0] }); }
    };
    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.on("error", reject);
    setTimeout(() => {
      if (!settled) reject(new Error(`vite never reported a URL. Output:\n${log.slice(0, 2000)}`));
    }, 90000);
  });
}

async function main() {
  const { runMenuCheck, summarize } = require(path.join(REPO, "desktop", "menu-check.cjs"));
  const { runCaptureOp, stopCaptureBridge } = require(path.join(REPO, "desktop", "capture-bridge.cjs"));
  const dir = path.join(RUN, "project");
  const outDir = path.join(RUN, "out");
  fs.mkdirSync(outDir, { recursive: true });

  console.log("scaffolding a project from the committed tree…");
  await makeProject(dir);
  const { proc, url } = await startVite(dir);
  console.log(`preview at ${url}\n`);

  const rows = [];
  let failures = 0;
  try {
    for (const layout of LAYOUTS) {
      writeConfig(dir, layout);
      // Vite re-serves the edited module on the next request; give HMR a beat.
      await new Promise((r) => setTimeout(r, 700));
      const result = await runMenuCheck({
        projectDir: dir, previewUrl: url, variationId: "v00",
        captureOp: runCaptureOp, headerMode: "configured",
      });
      const ok = result.ok === true;
      if (!ok) failures++;
      rows.push({ layout, ok, findings: result.findings || [], error: result.error });
      console.log(`${ok ? "PASS" : "FAIL"}  ${layout.padEnd(22)} ${result.error || summarize(result)}`);
      for (const f of result.findings || []) {
        console.log(`      ${f.rule}/${f.width}${f.item ? ` (${f.item})` : ""}: expected ${f.expected}; got ${f.actual}`);
      }
      if (SHOTS) {
        for (const bp of [{ n: "desktop", w: 1440, h: 900 }, { n: "tablet", w: 834, h: 1112 }, { n: "mobile", w: 390, h: 780 }]) {
          await runCaptureOp({ op: "viewport", width: bp.w, height: bp.h });
          await runCaptureOp({ op: "goto", url: `${url}/?v=v00&capture=${bp.n}` });
          await runCaptureOp({ op: "waitSelector", selector: "header", timeout: 15000 });
          const shot = await runCaptureOp({ op: "screenshot", fullPage: false });
          if (shot && shot.ok) fs.writeFileSync(path.join(outDir, `${layout}-${bp.n}.png`), Buffer.from(shot.dataUrl, "base64"));
        }
      }
    }

    // ---- A THICK-BORDERED skin (the 2026-09-11 GUI run) ---------------------
    // A design that sets border-b-2 on the bar is an ordinary skin choice, and it
    // used to make every panel read as "2px above" the header: top-full resolves
    // against the padding box, getBoundingClientRect reports the border box. The
    // header was right and the CHECK was wrong, which is the worse failure of the
    // two, so it gets a permanent case.
    console.log("\nchecking a thick-bordered skin (border-b-2) still reads flush…");
    writeConfig(dir, "mega-left-right");
    const skinPath = path.join(dir, "src", "app", "components", "header.skin.ts");
    const skinSrc = fs.readFileSync(skinPath, "utf8");
    fs.writeFileSync(skinPath, skinSrc.replace(/bar: "[^"]*"/, 'bar: "border-b-4 border-black bg-ta-surface"'));
    await new Promise((r) => setTimeout(r, 900));
    const thick = await runMenuCheck({
      projectDir: dir, previewUrl: url, variationId: "v00",
      captureOp: runCaptureOp, headerMode: "configured", widths: ["desktop"],
    });
    console.log(`${thick.ok ? "PASS" : "FAIL"}  thick-bordered skin  ${summarize(thick)}`);
    for (const f of thick.findings || []) console.log(`      ${f.rule}/${f.width}: expected ${f.expected}; got ${f.actual}`);
    if (!thick.ok) failures++;
    rows.push({ layout: "thick-bordered-skin", ok: thick.ok, findings: thick.findings || [] });
    fs.writeFileSync(skinPath, skinSrc); // put the default skin back

    // ---- The negative case: a custom header with the centred-logo bug --------
    console.log("\nchecking that a deliberately broken custom header FAILS…");
    writeConfig(dir, "simple-center-split");
    const varDir = path.join(dir, "src", "variations", "v01", "components");
    fs.mkdirSync(varDir, { recursive: true });
    fs.writeFileSync(path.join(varDir, "Header.tsx"), BROKEN_HEADER);
    await new Promise((r) => setTimeout(r, 1200));
    const broken = await runMenuCheck({
      projectDir: dir, previewUrl: url, variationId: "v01",
      captureOp: runCaptureOp, headerMode: "custom", widths: ["desktop"],
    });
    const caught = (broken.findings || []).some((f) => f.rule === "placement" || f.rule === "fold");
    console.log(`${caught ? "PASS" : "FAIL"}  broken custom header  ${summarize(broken)}`);
    for (const f of broken.findings || []) {
      console.log(`      ${f.rule}/${f.width}: expected ${f.expected}; got ${f.actual}`);
    }
    if (!caught) failures++;
    rows.push({ layout: "broken-custom-header", ok: caught, findings: broken.findings || [] });
  } finally {
    try { process.kill(-proc.pid); } catch { try { proc.kill(); } catch {} }
    stopCaptureBridge();
  }

  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(rows, null, 2));
  console.log(`\n${LAYOUTS.length - failures + (failures ? 0 : 1)}/${LAYOUTS.length + 1} checks pass. Results in ${outDir}`);
  if (SHOTS) console.log(`Screenshots in ${outDir}`);
  app.exit(failures ? 1 : 0);
}

app.whenReady().then(() =>
  main().catch((e) => { console.error(e); app.exit(1); })
);
