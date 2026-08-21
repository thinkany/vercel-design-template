// Company profile — export / import the AGENCY identity so it can be reused across
// fresh template copies. The "company layer" is the handful of things /setup-project
// sets that are the SAME for every project a designer does (as opposed to the
// per-client --ta-* design + client/project names, which change each time):
//
//   • company name        → VITE_COMPANY_NAME in .env
//   • admin / gate fonts   → --admin-font-heading/body in tokens.css, the gate's
//                            inline fonts + <link> in middleware.js, app font load
//   • login logo           → public/brand/<file> + its wiring in middleware.js
//
// It is captured as ONE portable JSON file with the logo + any self-hosted font
// files base64-embedded, so the whole profile is a single self-contained text file
// (no zip). Base64 round-trips ANY binary format losslessly — PNG / WebP / JPG /
// SVG / woff2 alike — so the image format never matters.
//
// Import always targets the KNOWN pristine template CORE files (middleware.js /
// tokens.css / fonts.css), so the wiring is deterministic anchored substitution;
// anything that doesn't match the expected anchor is skipped and reported in
// `manualSteps` rather than clobbered.
//
// Pure Node, no dependencies. Exports runPack()/runUnpack() for the dev endpoints;
// also runnable as a CLI:
//   node scripts/company-profile.mjs pack   [--project DIR] [--out FILE]
//   node scripts/company-profile.mjs unpack --in FILE [--project DIR] [--force]
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PROFILE_KIND = "thinkany-company-profile";
const PROFILE_VERSION = 1;
const DEFAULT_FILENAME = "company-profile.json";

// ── pristine-template anchors (what /setup-project starts from) ────────────────
const DEFAULT_HEADING = "'DM Sans', system-ui, sans-serif"; // tokens --admin-font-heading
const DEFAULT_BODY = "'Inter', system-ui, sans-serif"; //     tokens --admin-font-body
const GATE_HEADING_LITERAL = "'DM Sans', sans-serif"; // .brand-name font-family in middleware
const GATE_BODY_LITERAL = "'Inter', sans-serif"; //     body/subtitle/label/input/button font-family
const DEFAULT_GATE_LINK =
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@700&family=Inter:wght@300&display=swap";
const MATCHER_LOOKAHEAD = "(?!_vercel|version.json|template-latest.zip)";

const IMAGE_MIME = {
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};
const FONT_MIME = {
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

// ── small file/text helpers ───────────────────────────────────────────────────
const read = (p) => readFile(p, "utf8");
const exists = (p) => existsSync(p);

async function listFiles(dir, extns) {
  if (!exists(dir)) return [];
  const out = [];
  for (const name of await readdir(dir)) {
    if (extns.includes(path.extname(name).toLowerCase())) out.push(name);
  }
  return out.sort();
}

function envValue(text, key) {
  const m = text.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]*)"?`, "m"));
  return m ? m[1].trim() : "";
}
function setEnvValue(text, key, value) {
  const line = `${key}="${value}"`;
  const re = new RegExp(`^${key}\\s*=.*$`, "m");
  return re.test(text) ? text.replace(re, line) : `${text.replace(/\n?$/, "\n")}${line}\n`;
}

function tokenValue(text, name) {
  const m = text.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : "";
}
function setToken(text, name, value) {
  const re = new RegExp(`(--${name}\\s*:\\s*)[^;]+;`);
  return re.test(text) ? text.replace(re, `$1${value};`) : text;
}

// ─────────────────────────────────────────────────────────────────────────────
// PACK — read the company layer out of a branded project → profile object
// ─────────────────────────────────────────────────────────────────────────────
export async function runPack({ project = process.cwd(), out } = {}) {
  const root = path.resolve(project);
  const p = (rel) => path.join(root, rel);

  const envText = exists(p(".env")) ? await read(p(".env")) : "";
  const tokensText = exists(p("src/styles/tokens.css")) ? await read(p("src/styles/tokens.css")) : "";
  const mwText = exists(p("middleware.js")) ? await read(p("middleware.js")) : "";
  const fontsText = exists(p("src/styles/fonts.css")) ? await read(p("src/styles/fonts.css")) : "";

  const companyName = envValue(envText, "VITE_COMPANY_NAME");
  const headingFamily = tokenValue(tokensText, "admin-font-heading") || DEFAULT_HEADING;
  const bodyFamily = tokenValue(tokensText, "admin-font-body") || DEFAULT_BODY;

  // ── fonts: self-hosted (files present) vs external stylesheet vs default ──────
  const fontFileNames = await listFiles(p("public/fonts"), Object.keys(FONT_MIME));
  const gateLinkHref = (mwText.match(/<link href="([^"]+)" rel="stylesheet"/) || [])[1] || "";

  let fonts;
  if (fontFileNames.length) {
    // Self-hosted: embed the files + capture @font-face blocks the designer added.
    const files = [];
    for (const name of fontFileNames) {
      const buf = await readFile(p(path.join("public/fonts", name)));
      files.push({
        name,
        mime: FONT_MIME[path.extname(name).toLowerCase()] || "application/octet-stream",
        b64: buf.toString("base64"),
      });
    }
    const faceBlocks = (fontsText.match(/@font-face\s*\{[^}]*\}/g) || []).join("\n\n");
    fonts = { mode: "selfhosted", headingFamily, bodyFamily, files, faceBlocks };
  } else if (gateLinkHref && gateLinkHref !== DEFAULT_GATE_LINK) {
    // External stylesheet (Google Fonts / Adobe / any host).
    let origin = "";
    try {
      origin = new URL(gateLinkHref).origin;
    } catch {}
    fonts = { mode: "external", headingFamily, bodyFamily, stylesheetHref: gateLinkHref, preconnect: origin };
  } else {
    fonts = { mode: "default", headingFamily, bodyFamily };
  }

  // ── logo: first image in public/brand ────────────────────────────────────────
  let logo = null;
  const logoNames = await listFiles(p("public/brand"), Object.keys(IMAGE_MIME));
  if (logoNames.length) {
    const name = logoNames[0];
    const buf = await readFile(p(path.join("public/brand", name)));
    logo = {
      filename: name,
      mime: IMAGE_MIME[path.extname(name).toLowerCase()] || "application/octet-stream",
      b64: buf.toString("base64"),
    };
  }

  const profile = {
    kind: PROFILE_KIND,
    version: PROFILE_VERSION,
    companyName,
    fonts,
    logo,
  };

  const outPath = out ? path.resolve(out) : p(DEFAULT_FILENAME);
  await writeFile(outPath, JSON.stringify(profile, null, 2) + "\n", "utf8");

  return {
    outPath,
    summary: {
      companyName: companyName || "(none set)",
      fontMode: fonts.mode,
      headingFamily,
      bodyFamily,
      fontFiles: fonts.files?.map((f) => f.name) || [],
      logo: logo?.filename || null,
    },
  };
}

// Build a company profile OBJECT (same shape as a packed profile.json) straight from
// form fields — the in-pane "Brand This Project" form's data, so it can be handed to
// runUnpack without a file on disk. Fonts entered as Google-Font family NAMES become
// an external stylesheet (loaded by both the gate and, via runUnpack §6, the app).
export function buildCompanyProfile({ companyName, headingFont, bodyFont, logo } = {}) {
  const heading = headingFont ? `'${headingFont}', system-ui, sans-serif` : DEFAULT_HEADING;
  const body = bodyFont ? `'${bodyFont}', system-ui, sans-serif` : DEFAULT_BODY;
  const names = [...new Set([headingFont, bodyFont].filter(Boolean))];
  // wght@400;700 only — virtually every Google font has both, so the css2 request
  // never 400s (an unavailable weight fails the whole stylesheet).
  const fam = (n) => `family=${encodeURIComponent(n).replace(/%20/g, "+")}:wght@400;700`;
  const fonts = names.length
    ? {
        mode: "external",
        headingFamily: heading,
        bodyFamily: body,
        stylesheetHref: `https://fonts.googleapis.com/css2?${names.map(fam).join("&")}&display=swap`,
        preconnect: "https://fonts.gstatic.com",
      }
    : { mode: "default", headingFamily: DEFAULT_HEADING, bodyFamily: DEFAULT_BODY };
  return {
    kind: PROFILE_KIND,
    version: PROFILE_VERSION,
    companyName: (companyName || "").trim(),
    fonts,
    logo: logo && logo.b64 ? { filename: logo.filename, mime: logo.mime || "image/png", b64: logo.b64 } : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UNPACK — apply a profile onto a target project (pristine CORE files)
// ─────────────────────────────────────────────────────────────────────────────
// `profile` (in-memory, from buildCompanyProfile) takes precedence over `input` (a
// packed profile.json path); one of the two must be provided.
export async function runUnpack({ project = process.cwd(), input, profile: inlineProfile, force = false } = {}) {
  const root = path.resolve(project);
  const p = (rel) => path.join(root, rel);
  const applied = [];
  const manualSteps = [];

  const profile = inlineProfile || JSON.parse(await read(path.resolve(input)));
  if (profile.kind !== PROFILE_KIND) {
    throw new Error(`Not a company profile (kind="${profile.kind}").`);
  }
  if (profile.version > PROFILE_VERSION && !force) {
    throw new Error(
      `Profile version ${profile.version} is newer than this template supports (${PROFILE_VERSION}). Re-export, or pass --force.`
    );
  }

  const fonts = profile.fonts || { mode: "default" };
  const headingFamily = fonts.headingFamily || DEFAULT_HEADING;
  const bodyFamily = fonts.bodyFamily || DEFAULT_BODY;

  // ── 1. company name → .env ───────────────────────────────────────────────────
  if (profile.companyName) {
    const envPath = p(".env");
    const envText = exists(envPath) ? await read(envPath) : "";
    await writeFile(envPath, setEnvValue(envText, "VITE_COMPANY_NAME", profile.companyName), "utf8");
    applied.push(`.env → VITE_COMPANY_NAME="${profile.companyName}"`);
  }

  // ── 2. admin fonts → tokens.css ──────────────────────────────────────────────
  if (fonts.mode !== "default" || headingFamily !== DEFAULT_HEADING || bodyFamily !== DEFAULT_BODY) {
    const tokPath = p("src/styles/tokens.css");
    if (exists(tokPath)) {
      let t = await read(tokPath);
      t = setToken(t, "admin-font-heading", headingFamily);
      t = setToken(t, "admin-font-body", bodyFamily);
      await writeFile(tokPath, t, "utf8");
      applied.push(`tokens.css → --admin-font-heading / --admin-font-body`);
    }
  }

  // ── 3. gate wiring → middleware.js (anchored; skip+report if diverged) ────────
  const mwPath = p("middleware.js");
  if (exists(mwPath)) {
    let mw = await read(mwPath);
    let mwTouched = false;

    // 3a. gate font families (only if the pristine literals are present)
    if (headingFamily !== DEFAULT_HEADING || bodyFamily !== DEFAULT_BODY || fonts.mode !== "default") {
      if (mw.includes(GATE_HEADING_LITERAL)) {
        mw = mw.split(GATE_HEADING_LITERAL).join(headingFamily);
        mwTouched = true;
      } else {
        manualSteps.push("middleware.js: could not find the default .brand-name font-family — set the wordmark font by hand.");
      }
      if (mw.includes(GATE_BODY_LITERAL)) {
        mw = mw.split(GATE_BODY_LITERAL).join(bodyFamily);
        mwTouched = true;
      } else {
        manualSteps.push("middleware.js: could not find the default body font-family — set the gate body font by hand.");
      }
    }

    // 3b. external stylesheet <link> + preconnect
    if (fonts.mode === "external" && fonts.stylesheetHref) {
      if (mw.includes(DEFAULT_GATE_LINK)) {
        mw = mw.replace(DEFAULT_GATE_LINK, fonts.stylesheetHref);
        mwTouched = true;
      } else {
        manualSteps.push(`middleware.js: set the gate <link rel="stylesheet"> href to ${fonts.stylesheetHref}`);
      }
      if (fonts.preconnect && !mw.includes(`preconnect" href="${fonts.preconnect}"`)) {
        manualSteps.push(`middleware.js + index.html: add <link rel="preconnect" href="${fonts.preconnect}" /> if the host isn't Google Fonts.`);
      }
    }

    // 3c. self-hosted @font-face into the gate's inline <style>
    if (fonts.mode === "selfhosted" && fonts.faceBlocks) {
      if (!mw.includes("@font-face")) {
        mw = mw.replace(/(<style>\s*)/, `$1\n${fonts.faceBlocks}\n`);
        mwTouched = true;
      }
    }

    // 3d. logo wiring
    if (profile.logo) {
      const src = `/brand/${profile.logo.filename}`;
      if (!mw.includes("brand-logo")) {
        // CSS rule just before the closing </style>
        const css = `\n    .brand-logo {\n      display: block;\n      width: 100%;\n      max-width: 360px;\n      height: auto;\n      margin: 0 auto 24px;\n      filter: grayscale(100%);\n    }\n`;
        mw = mw.replace(/(\n\s*<\/style>)/, `${css}$1`);
        // <img> as first child of .brand, directly above .brand-name (same indent)
        mw = mw.replace(
          /(\n(\s*))(<div class="brand-name">)/,
          `$1<img class="brand-logo" src="${src}" alt="\${CLIENT_NAME} logo" />$1$3`
        );
        mwTouched = true;
      }
    }

    // 3e. allowlist folders that must load pre-auth (logo + self-hosted fonts)
    const allow = [];
    if (profile.logo) allow.push("brand");
    if (fonts.mode === "selfhosted") allow.push("fonts");
    if (allow.length && mw.includes(MATCHER_LOOKAHEAD)) {
      const missing = allow.filter((a) => !mw.includes(`|${a}`));
      if (missing.length) {
        mw = mw.replace(MATCHER_LOOKAHEAD, `${MATCHER_LOOKAHEAD.slice(0, -1)}|${missing.join("|")})`);
        mwTouched = true;
      }
    } else if (allow.length) {
      manualSteps.push(`middleware.js: allowlist ${allow.join(" + ")} in the matcher so it loads before auth.`);
    }

    if (mwTouched) {
      await writeFile(mwPath, mw, "utf8");
      applied.push("middleware.js → gate fonts / logo / allowlist");
    }
  }

  // ── 4. restore logo file ─────────────────────────────────────────────────────
  if (profile.logo) {
    await mkdir(p("public/brand"), { recursive: true });
    await writeFile(p(path.join("public/brand", profile.logo.filename)), Buffer.from(profile.logo.b64, "base64"));
    applied.push(`public/brand/${profile.logo.filename}`);
  }

  // ── 5. restore self-hosted font files + app @font-face ───────────────────────
  if (fonts.mode === "selfhosted" && fonts.files?.length) {
    await mkdir(p("public/fonts"), { recursive: true });
    for (const f of fonts.files) {
      await writeFile(p(path.join("public/fonts", f.name)), Buffer.from(f.b64, "base64"));
    }
    applied.push(`public/fonts/ (${fonts.files.length} file${fonts.files.length > 1 ? "s" : ""})`);
    const fPath = p("src/styles/fonts.css");
    if (fonts.faceBlocks && exists(fPath)) {
      let f = await read(fPath);
      if (!f.includes("@font-face")) {
        await writeFile(fPath, `${f.replace(/\n?$/, "\n")}\n${fonts.faceBlocks}\n`, "utf8");
        applied.push("fonts.css → @font-face blocks");
      }
    }
  }

  // ── 6. external app font load → fonts.css @import (auto-wired) ───────────────
  // The gate loads its own copy (§3b); the APP loads its admin fonts from
  // src/styles/fonts.css. Add the stylesheet as a second @import (still valid: it
  // stays at the top, before any non-import rule). Idempotent.
  if (fonts.mode === "external" && fonts.stylesheetHref) {
    const fPath = p("src/styles/fonts.css");
    if (exists(fPath)) {
      let f = await read(fPath);
      if (!f.includes(fonts.stylesheetHref)) {
        const line = `@import url('${fonts.stylesheetHref}');`;
        const lastImport = f.lastIndexOf("@import");
        if (lastImport >= 0) {
          const eol = f.indexOf("\n", lastImport);
          const at = eol >= 0 ? eol + 1 : f.length;
          f = f.slice(0, at) + line + "\n" + f.slice(at);
        } else {
          f = `${line}\n${f}`;
        }
        await writeFile(fPath, f, "utf8");
        applied.push("fonts.css → app @import (admin fonts)");
      }
    } else {
      manualSteps.push(`App font load: add ${headingFamily} / ${bodyFamily} for the app (fonts.css @import / index.html <link>).`);
    }
  }

  return { applied, manualSteps, summary: runPackSummary(profile) };
}

function runPackSummary(profile) {
  return {
    companyName: profile.companyName || "(none set)",
    fontMode: profile.fonts?.mode || "default",
    logo: profile.logo?.filename || null,
    fontFiles: profile.fonts?.files?.map((f) => f.name) || [],
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--force" || t === "--dry-run") a[t.slice(2)] = true;
    else if (t.startsWith("--")) a[t.slice(2)] = argv[++i];
    else a._.push(t);
  }
  return a;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  try {
    if (cmd === "pack") {
      const { outPath, summary } = await runPack({ project: args.project, out: args.out });
      console.log(`Wrote ${outPath}`);
      console.log(JSON.stringify(summary, null, 2));
    } else if (cmd === "unpack") {
      if (!args.in) throw new Error("unpack needs --in <company-profile.json>");
      const res = await runUnpack({ project: args.project, input: args.in, force: args.force });
      console.log("Applied:\n  " + res.applied.join("\n  "));
      if (res.manualSteps.length) console.log("\nManual steps:\n  - " + res.manualSteps.join("\n  - "));
    } else {
      console.log("Usage: company-profile.mjs pack [--project DIR] [--out FILE]");
      console.log("       company-profile.mjs unpack --in FILE [--project DIR] [--force]");
      process.exit(cmd ? 1 : 0);
    }
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}
