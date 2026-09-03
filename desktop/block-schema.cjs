// ©2026 thinkany llc. All rights reserved.
// Block schema introspection for the CMS: bundles site/blocks/index.ts (esbuild),
// evaluates it with the project's own node_modules, and reads each block's zod
// schema into (a) DEFAULTS for a new block instance, (b) list-item TEMPLATES so an
// empty list can grow, (c) FIELD KINDS by dotted path (image fragments, enums with
// their options) so the editor never asks a designer to type a path or a name it
// can't know, and (d) the design's MARKS rendered to static SVG for a visual icon
// picker. Cached in .thinkany/blocks.json by the blocks folder's mtime.
const fs = require("node:fs");
const path = require("node:path");

function readJsonFile(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } }

// ---- Block schemas → default props ------------------------------------------
// The CMS edits a block's content from its props' SHAPE, so a block must start
// with every field present. The registry is TSX with zod schemas, so: bundle
// site/blocks/index.ts with esbuild (shipped for Vite), load it, and walk each
// block's zod schema into a default props object (strings "", numbers 0,
// booleans false, enums their first option, objects recursed, arrays with one
// example item when the schema requires one). Cached in .thinkany/blocks.json
// against the newest mtime under site/blocks.
function blocksMtime(dir) {
  let latest = 0;
  const walk = (d) => { let es = []; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; } for (const e of es) { const a = path.join(d, e.name); if (e.isDirectory()) walk(a); else { try { latest = Math.max(latest, fs.statSync(a).mtimeMs); } catch {} } } };
  walk(path.join(dir, "site", "blocks"));
  return latest;
}
function zodDefault(schema, depth = 0, templates = null, at = "") {
  if (!schema || !schema._def || depth > 8) return "";
  const d = schema._def;
  const t = d.typeName;
  const sub = (inner, key) => zodDefault(inner, depth + 1, templates, key === undefined ? at : (at ? `${at}.${key}` : key));
  switch (t) {
    case "ZodDefault": {
      // The declared default, merged over the inner shape's defaults when both are
      // plain objects, so optional sub-fields still appear in the editor.
      let dv; try { dv = d.defaultValue(); } catch { dv = undefined; }
      const inner = sub(d.innerType);
      if (dv && typeof dv === "object" && !Array.isArray(dv) && inner && typeof inner === "object" && !Array.isArray(inner)) return { ...inner, ...dv };
      return dv === undefined ? inner : dv;
    }
    case "ZodOptional": case "ZodNullable": return sub(d.innerType);
    case "ZodEffects": return sub(d.schema);
    case "ZodObject": { const out = {}; const shape = typeof d.shape === "function" ? d.shape() : d.shape; for (const [k, v] of Object.entries(shape)) out[k] = sub(v, k); return out; }
    case "ZodArray": {
      // Remember what one item looks like (by dotted path, indices skipped) so the
      // editor can add to an EMPTY list; seed one item when the schema needs one.
      const item = sub(d.type);
      if (templates && at) templates[at] = item;
      const min = d.minLength && d.minLength.value;
      return min > 0 ? [item] : [];
    }
    case "ZodString": return "";
    case "ZodNumber": return 0;
    case "ZodBoolean": return false;
    case "ZodEnum": return (d.values && d.values[0]) || "";
    case "ZodNativeEnum": { const vals = Object.values(d.values || {}); return vals[0] ?? ""; }
    case "ZodLiteral": return d.value;
    case "ZodUnion": return sub((d.options || [])[0]);
    case "ZodRecord": return {};
    default: return "";
  }
}
function introspectBlocks(dir, { esbuild } = {}) {
  const cachePath = path.join(dir, ".thinkany", "blocks.json");
  const mtime = blocksMtime(dir);
  const cached = readJsonFile(cachePath);
  if (cached && cached.mtime === mtime && cached.defaults && cached.fields && "megaMenu" in cached) return { defaults: cached.defaults, templates: cached.templates || {}, fields: cached.fields || {}, marks: cached.marks || {}, megaMenu: !!cached.megaMenu };
  let defaults = {}; let templates = {}; let fields = {}; let marks = {}; let megaMenu = false;
  try {
    if (!esbuild) esbuild = require("esbuild");
    const result = esbuild.buildSync({
      entryPoints: [path.join(dir, "site", "blocks", "index.ts")],
      bundle: true, write: false, platform: "node", format: "cjs", target: "node20",
      jsx: "automatic", tsconfig: path.join(dir, "site", "tsconfig.json"), logLevel: "silent",
      // Components only matter for their schemas here; keep the runtime deps external.
      external: ["react", "react-dom", "react/jsx-runtime", "lucide-react", "motion", "motion/*", "astro/zod", "astro:*"],
    });
    const code = result.outputFiles[0].text;
    const { createRequire } = require("node:module");
    const req = createRequire(path.join(dir, "package.json"));
    const mod = { exports: {} };
    new Function("require", "module", "exports", "__filename", "__dirname", code)(req, mod, mod.exports, path.join(dir, "site", "blocks", "index.ts"), path.join(dir, "site", "blocks"));
    const blocks = mod.exports.blocks || {};
    for (const [key, def] of Object.entries(blocks)) {
      const tpl = {};
      try { defaults[key] = def && def.props ? zodDefault(def.props, 0, tpl, "") : {}; } catch { defaults[key] = {}; }
      templates[key] = tpl;
      const fm = {};
      try { if (def && def.props) zodFields(def.props, fm, "", 0); } catch {}
      fields[key] = fm;
    }
    marks = renderMarks(dir, esbuild, req);
    megaMenu = headerAcceptsColumns(dir, esbuild, req);
  } catch (e) {
    console.warn(`[blocks] introspection failed: ${e.message}`);
    return cached && cached.defaults ? { defaults: cached.defaults, templates: cached.templates || {}, fields: cached.fields || {}, marks: cached.marks || {}, megaMenu: !!cached.megaMenu } : { defaults: {}, templates: {}, fields: {}, marks: {}, megaMenu: false };
  }
  try { fs.mkdirSync(path.dirname(cachePath), { recursive: true }); fs.writeFileSync(cachePath, JSON.stringify({ mtime, defaults, templates, fields, marks, megaMenu }, null, 2) + "\n"); } catch {}
  return { defaults, templates, fields, marks, megaMenu };
}


// Field kinds by dotted path (list indices skipped, matching the editor's paths).
// Leaves: image (the { src, alt } fragment), link ({ label, href }), enum (with
// options), string, number, boolean. Containers: object, list.
function zodFields(schema, out, at, depth, desc) {
  if (!schema || !schema._def || depth > 8) return;
  const d = schema._def;
  desc = d.description || desc; // .describe() may sit on a wrapper (.default().describe())
  const inner = (x) => zodFields(x, out, at, depth + 1, desc);
  switch (d.typeName) {
    case "ZodDefault": case "ZodOptional": case "ZodNullable": return inner(d.innerType);
    case "ZodEffects": return inner(d.schema);
    case "ZodObject": {
      const shape = typeof d.shape === "function" ? d.shape() : d.shape;
      const keys = Object.keys(shape);
      if (at) {
        if (keys.includes("src")) { out[at] = { kind: "image" }; return; }
        const list = out[at] && out[at].kind === "list"; // the items of a list keep the list's kind
        if (keys.length === 2 && keys.includes("label") && keys.includes("href")) { if (!list) out[at] = { kind: "link" }; }
        else if (!list) out[at] = { kind: "object" };
      }
      for (const [k, v] of Object.entries(shape)) zodFields(v, out, at ? `${at}.${k}` : k, depth + 1);
      return;
    }
    case "ZodArray": { if (at) out[at] = { kind: "list" }; return zodFields(d.type, out, at, depth + 1); }
    case "ZodEnum": { if (at) out[at] = { kind: "enum", options: (d.values || []).slice(), ...(desc === "side" ? { ui: "side" } : {}) }; return; }
    case "ZodNativeEnum": { if (at) out[at] = { kind: "enum", options: Object.values(d.values || {}) }; return; }
    case "ZodLiteral": { if (at) out[at] = { kind: "enum", options: [d.value] }; return; }
    case "ZodUnion": {
      // A union of literals is a choice; anything else takes its first option's kind.
      const opts = d.options || [];
      if (at && opts.length && opts.every((o) => o._def && o._def.typeName === "ZodLiteral")) { out[at] = { kind: "enum", options: opts.map((o) => o._def.value) }; return; }
      return inner(opts[0]);
    }
    case "ZodString": { if (at) out[at] = { kind: desc === "richtext" ? "richtext" : "string" }; return; }
    case "ZodNumber": { if (at) out[at] = { kind: "number" }; return; }
    case "ZodBoolean": { if (at) out[at] = { kind: "boolean" }; return; }
    default: return;
  }
}

// Does the site's Header block render a mega menu? True when its nav schema accepts
// `columns` (the navItem fragment). The CMS offers columns only then.
function headerAcceptsColumns(dir, esbuild, req) {
  const file = path.join(dir, "site", "blocks", "chrome.ts");
  if (!fs.existsSync(file)) return false;
  try {
    const result = esbuild.buildSync({
      entryPoints: [file], bundle: true, write: false, platform: "node", format: "cjs", target: "node20",
      jsx: "automatic", tsconfig: path.join(dir, "site", "tsconfig.json"), logLevel: "silent",
      external: ["react", "react-dom", "react/jsx-runtime", "lucide-react", "motion", "motion/*", "astro/zod", "astro:*"],
    });
    const mod = { exports: {} };
    new Function("require", "module", "exports", "__filename", "__dirname", result.outputFiles[0].text)(req, mod, mod.exports, file, path.dirname(file));
    const header = mod.exports.chrome && mod.exports.chrome.header;
    if (!header || !header.props) return false;
    const f = {}; zodFields(header.props, f, "", 0);
    return !!f["nav.columns"];
  } catch (e) { console.warn(`[blocks] chrome introspection failed: ${e.message}`); return false; }
}

// The design's marks (site/blocks/lib/marks.tsx exports MARKS: key → component),
// rendered to static SVG with the project's React so the editor can show them.
function renderMarks(dir, esbuild, req) {
  const file = path.join(dir, "site", "blocks", "lib", "marks.tsx");
  if (!fs.existsSync(file)) return {};
  try {
    const result = esbuild.buildSync({
      entryPoints: [file], bundle: true, write: false, platform: "node", format: "cjs", target: "node20",
      jsx: "automatic", tsconfig: path.join(dir, "site", "tsconfig.json"), logLevel: "silent",
      external: ["react", "react-dom", "react/jsx-runtime", "astro/zod", "astro:*"],
    });
    const mod = { exports: {} };
    new Function("require", "module", "exports", "__filename", "__dirname", result.outputFiles[0].text)(req, mod, mod.exports, file, path.dirname(file));
    const MARKS = mod.exports.MARKS || {};
    const React = req("react");
    const { renderToStaticMarkup } = req("react-dom/server");
    const out = {};
    for (const [k, C] of Object.entries(MARKS)) {
      try { const svg = renderToStaticMarkup(React.createElement(C, {})); if (/^<svg/i.test(svg)) out[k] = svg; } catch {}
    }
    return out;
  } catch (e) {
    console.warn(`[blocks] marks render failed: ${e.message}`);
    return {};
  }
}

module.exports = { introspectBlocks, zodDefault, zodFields, renderMarks, headerAcceptsColumns, blocksMtime };
