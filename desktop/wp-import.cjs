// ©2026 thinkany llc. All rights reserved.
// WordPress migration (docs/wordpress-migration-spec.md): the deterministic half.
// Reads the payload the read-only plugin (desktop/wp-plugin/thinkany-export.php)
// produces and, with a mapping the designer confirmed, writes the site builder's
// content: pages as block lists, posts as markdown, custom types + entries, the nav,
// redirects from every old address, and a per-page report of what was dropped.
//
// Pure Node: no Electron import, so the fixture test (desktop/dev/wp-import.test.cjs)
// runs it directly. Media download and image conversion are injected (`fetchMedia`),
// the app supplies them from main.cjs.
//
//   fetchPayload(url, token)                 GET <site>/wp-json/thinkany/v1/export
//   validatePayload(payload)                 { ok, error }
//   inventory(payload)                       counts + structure (the card, the brief)
//   inventoryMarkdown(inv)                   the same as text
//   definitionsForSkill(payload)             slim JSON the mapping skill reads
//   mappingSkeleton(payload, blocks)         mapping.json with every slot present, targets empty
//   htmlToMarkdown(html)                     the site's markdown subset + lost nodes + tables
//   transform(projectDir, payload, mapping, { blocks, fetchMedia, blogPath })  → report
//   reportMarkdown(report)
const fs = require("node:fs");
const path = require("node:path");

const PAYLOAD_KIND = "thinkany-wordpress-export";
const PAYLOAD_VERSION = 1;
const MAPPING_VERSION = 1;

// ---- payload ------------------------------------------------------------------

async function fetchPayload(siteUrl, token, { timeoutMs = 120000 } = {}) {
  const base = String(siteUrl || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) throw new Error("The site address must start with http:// or https://");
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/wp-json/thinkany/v1/export`, { headers: { "x-thinkany-token": String(token || "").trim(), accept: "application/json" }, signal: ctl.signal });
    if (res.status === 401 || res.status === 403) throw new Error("The site refused the token. Check it under Settings → thinkany Export on the WordPress site.");
    if (res.status === 404) throw new Error("The site has no thinkany Export endpoint. Is the plugin installed and activated?");
    if (!res.ok) throw new Error(`The site answered ${res.status}.`);
    const payload = await res.json();
    const v = validatePayload(payload);
    if (!v.ok) throw new Error(v.error);
    return payload;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("The site took too long to answer. A large site may need the WP-CLI export instead.");
    throw e;
  } finally { clearTimeout(t); }
}

function validatePayload(p) {
  if (!p || typeof p !== "object") return { ok: false, error: "Not a payload." };
  if (p.kind !== PAYLOAD_KIND) return { ok: false, error: "That file isn't a thinkany WordPress export." };
  if (Number(p.version) !== PAYLOAD_VERSION) return { ok: false, error: `Payload version ${p.version} isn't supported (expected ${PAYLOAD_VERSION}). Update the plugin or the app.` };
  for (const k of ["site", "definitions", "entries", "media"]) if (!(k in p)) return { ok: false, error: `The payload has no "${k}" section.` };
  if (!Array.isArray(p.entries)) return { ok: false, error: "The payload's entries aren't a list." };
  return { ok: true };
}

// ---- inventory ------------------------------------------------------------------

// Fields that are the old theme's presentation settings (padding, colors, section ids,
// hide-on-mobile switches, a deactivate toggle), not content. They have no destination
// in a new design, so the skeleton, the skill and the report set them aside.
const LAYOUT_FIELD = /^(section_id|anchor|background(_color|_colour|_image)?(_full)?|bg_color|padding(_top|_bottom)?|margin(_top|_bottom)?|hide_on_(mobile|desktop|tablet)|deactivate(_block)?|disable(d)?|(block_)?settings|settings|image_corners|auto_format|title_size|text_size|[a-z_]*_height|add_copy_gradient|gradient|overlay|color_scheme|colour_scheme|theme|show_schema|animation|reveal)$/i;
const isLayoutField = (name) => LAYOUT_FIELD.test(String(name || ""));
// Names that read as a VARIANT: they change what renders or where, not how it is tuned.
const VARIANT_FIELD = /^(copy_side|image_side|side|layout(_type)?|variant|style|type|columns?|column_(count|width|alignment)|alignment|align|position_[a-z_]+|wider_[a-z_]+|show_[a-z_]+|add_[a-z_]+|has_[a-z_]+|enable_[a-z_]+|display_[a-z_]+|[a-z_]+_style|[a-z_]+_layout|[a-z_]+_position)$/i;
const OPTION_TYPES = new Set(["select", "radio", "button_group", "true_false", "checkbox", "number", "range"]);
const CONTENT_TYPES = new Set(["text", "textarea", "wysiwyg", "email", "url", "image", "file", "gallery", "link", "repeater", "group", "flexible_content", "oembed", "date_picker", "date_time_picker", "time_picker", "color_picker"]);
const REFERENCE_TYPES = new Set(["post_object", "relationship", "page_link", "taxonomy", "user", "forms", "gravityforms", "gf_form", "gravity_forms"]);

/**
 * Field purpose, per ACF block (and per custom type): what each field is FOR.
 *   content    text, images, links, repeaters: the copy that moves
 *   variant    an option that changes what renders or which fields show (a side,
 *              a layout type, a column count, a switch that reveals fields)
 *   layout     the old theme's tuning (padding, colors, section ids): set aside
 *   reference  points at another entry or a form
 * Signals, strongest first: ACF conditional logic (a field that gates others is a
 * variant; a gated field belongs to it), the ACF field type, the values actually
 * used across the site (an option that never changes is not a variant in use),
 * then the name. Returns { [blockName]: { fields: [...], byName: {...} } }.
 */
function classifyFields(p) {
  const defs = p.definitions || {};
  const out = {};
  const usage = {}; // block → field → value → count (top-level fields on instances)
  for (const e of p.entries || []) for (const b of e.blocks || []) {
    if (!b.name.startsWith("acf/") || !b.fields || typeof b.fields !== "object") continue;
    const u = usage[b.name] || (usage[b.name] = {});
    for (const [k, v] of Object.entries(b.fields)) {
      const key = v == null || v === "" ? "(empty)" : typeof v === "object" ? (Array.isArray(v) ? `(list of ${v.length})` : v.image ? "(image)" : v.url !== undefined ? "(link)" : "(object)") : String(v).slice(0, 40);
      const c = u[k] || (u[k] = {}); c[key] = (c[key] || 0) + 1;
    }
  }
  // Field groups located on a block (ACF location rule param "block").
  const groupsFor = (name) => (defs.fieldGroups || []).filter((g) => (g.location || []).some((and) => (and || []).some((r) => r && r.param === "block" && String(r.value) === name)));
  const names = new Set([...(defs.blocks || []).map((b) => b.name), ...Object.keys(usage)]);
  for (const name of names) {
    // Tabs, messages and accordions are editor chrome with no name and no value.
    const fields = groupsFor(name).flatMap((g) => g.fields || []).filter((f) => f && f.name && !["tab", "message", "accordion"].includes(f.type));
    const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
    const gates = {}; // gating field name → [revealed field names]
    for (const f of fields) for (const and of f.conditionalLogic || []) for (const r of and || []) { const g = byKey[r.field]; if (g) (gates[g.name] || (gates[g.name] = [])).push(f.name); }
    const seen = new Set();
    const rows = [];
    const classify = (f) => {
      const n = f.name; const t = f.type || ""; const u = (usage[name] || {})[n] || {};
      const values = Object.keys(u).filter((k) => k !== "(empty)");
      const revealedBy = fields.find((g) => (g.conditionalLogic || []).some((and) => (and || []).some((r) => byKey[r.field] && byKey[r.field].name !== n && g.name === n && byKey[r.field].name)));
      const gatedBy = (f.conditionalLogic || []).flatMap((and) => (and || []).map((r) => byKey[r.field] && byKey[r.field].name)).filter(Boolean);
      let purpose;
      if (isLayoutField(n) && !gates[n]) purpose = "layout";
      else if (gates[n]) purpose = "variant";
      else if (REFERENCE_TYPES.has(t) || /form/i.test(n) && (t === "select" || t === "" || t === "forms")) purpose = "reference";
      else if (OPTION_TYPES.has(t)) purpose = "variant";
      else if (CONTENT_TYPES.has(t)) purpose = "content";
      else if (VARIANT_FIELD.test(n)) purpose = "variant";
      else purpose = t ? "content" : (values.length && values.every((v) => /^(\d+|true|false)$/.test(v)) ? "variant" : "content"); // unknown field: a bare number/boolean reads as an option, anything else as content
      const row = { name: n, label: f.label || n, type: t || "unknown", purpose, required: !!f.required };
      if (f.choices) row.options = Object.fromEntries(Object.entries(f.choices).map(([k, v]) => [k, String(v)]));
      if (t === "true_false") row.options = { 1: f.ui_on_text || "Yes", 0: f.ui_off_text || "No" };
      if (f.default_value !== undefined) row.default = f.default_value;
      if (gates[n]) row.reveals = Array.from(new Set(gates[n]));
      if (gatedBy.length) row.revealedBy = Array.from(new Set(gatedBy));
      row.usage = u;
      row.inUse = purpose === "variant" ? (values.length > 1 || values.some((v) => v !== "0" && v !== "false" && v !== String(f.default_value ?? ""))) : values.length > 0;
      return row;
    };
    for (const f of fields) { if (seen.has(f.name)) continue; seen.add(f.name); rows.push(classify(f)); }
    // Fields seen on instances but absent from the definitions (a field group the export missed): classified by name and value only.
    for (const n of Object.keys(usage[name] || {})) if (n && !seen.has(n)) { seen.add(n); rows.push(classify({ name: n, label: n, type: "" })); }
    out[name] = { fields: rows, byName: Object.fromEntries(rows.map((r) => [r.name, r])) };
  }
  return out;
}
const purposeOf = (cls, block, field) => (cls[block] && cls[block].byName[field] && cls[block].byName[field].purpose) || (isLayoutField(field) ? "layout" : "content");

function blockNames(entry) {
  return Array.isArray(entry.blocks) ? entry.blocks.map((b) => b.name).filter(Boolean) : [];
}
function isBuiltinType(defs, key) {
  const d = (defs.postTypes || []).find((t) => t.key === key);
  return d ? !!d.builtin : ["post", "page"].includes(key);
}

function inventory(p) {
  const defs = p.definitions || {};
  const entries = p.entries || [];
  const byType = {};
  for (const e of entries) byType[e.type] = (byType[e.type] || 0) + 1;
  const blockTypes = {};
  const acfBlockFields = {};
  for (const e of entries) {
    for (const b of e.blocks || []) {
      blockTypes[b.name] = (blockTypes[b.name] || 0) + 1;
      if (b.name.startsWith("acf/") && b.fields && typeof b.fields === "object") {
        const set = acfBlockFields[b.name] || (acfBlockFields[b.name] = new Set());
        for (const k of Object.keys(b.fields)) if (k) set.add(k);
      }
    }
  }
  const pages = entries.filter((e) => e.type === "page").map((e) => ({
    id: e.id, title: e.title, path: e.path, parent: e.parent || 0, status: e.status, order: e.order || 0,
    home: p.site && Number(p.site.frontPage) === Number(e.id),
    blocks: blockNames(e), classic: !!e.classic, fields: e.fields ? Object.keys(e.fields) : [],
  }));
  const media = p.media || [];
  const images = media.filter((m) => /^image\//.test(m.mime || ""));
  const customTypes = (defs.postTypes || []).filter((t) => !t.builtin).map((t) => ({ key: t.key, label: t.label, count: byType[t.key] || 0 }));
  const menus = ((p.site && p.site.menus) || []).map((m) => ({ slug: m.slug, name: m.name, locations: m.locations || [], items: (m.items || []).length }));
  const cls = classifyFields(p);
  const fieldsOf = (name) => Array.from(acfBlockFields[name] || []);
  const ofPurpose = (name, purpose) => (cls[name] ? cls[name].fields.filter((f) => f.purpose === purpose) : fieldsOf(name).filter((f) => (purpose === "layout") === isLayoutField(f)).map((f) => ({ name: f, purpose })));
  return {
    site: { name: p.site && p.site.name, home: p.site && p.site.home, wpVersion: p.site && p.site.wpVersion, seoPlugin: p.site && p.site.seoPlugin, exported: p.exported, plugin: p.plugin },
    counts: {
      pages: byType.page || 0, posts: byType.post || 0, entries: entries.length, byType,
      fieldGroups: (defs.fieldGroups || []).length, acfBlocks: (defs.blocks || []).length,
      media: media.length, images: images.length, imagesMissingAlt: images.filter((m) => !(m.alt || "").trim()).length,
      forms: (p.forms || []).length, menus: menus.length,
      classicPages: pages.filter((x) => x.classic).length,
    },
    pages,
    blockTypes,
    acfBlocks: (defs.blocks || []).map((b) => ({
      name: b.name, title: b.title, description: b.description || "", uses: blockTypes[b.name] || 0,
      fields: ofPurpose(b.name, "content").map((f) => f.name),
      variants: ofPurpose(b.name, "variant").map((f) => ({ name: f.name, label: f.label, type: f.type, options: f.options || null, usage: f.usage || {}, inUse: !!f.inUse, ...(f.reveals ? { reveals: f.reveals } : {}) })),
      references: ofPurpose(b.name, "reference").map((f) => f.name),
      layoutFields: ofPurpose(b.name, "layout").map((f) => f.name),
    })),
    customTypes,
    taxonomies: (defs.taxonomies || []).map((t) => ({ key: t.key, label: t.label, terms: (t.terms || []).length })),
    forms: (p.forms || []).map((f) => ({ plugin: f.plugin, title: f.title, fields: (f.fields || []).length })),
    menus,
    classicPages: pages.filter((x) => x.classic).map((x) => ({ id: x.id, title: x.title, path: x.path })),
  };
}

function inventoryMarkdown(inv) {
  const c = inv.counts;
  const L = [];
  L.push(`# ${inv.site.name || "WordPress site"}`, "");
  L.push(`${inv.site.home || ""}${inv.site.wpVersion ? `, WordPress ${inv.site.wpVersion}` : ""}${inv.site.seoPlugin ? `, SEO: ${inv.site.seoPlugin}` : ""}`, "");
  L.push("## Content", "");
  L.push(`- ${c.pages} pages${c.classicPages ? ` (${c.classicPages} classic, no blocks)` : ""}`);
  L.push(`- ${c.posts} posts`);
  for (const t of inv.customTypes) if (t.count) L.push(`- ${t.count} ${t.label} (custom type "${t.key}")`);
  L.push(`- ${c.images} images${c.imagesMissingAlt ? `, ${c.imagesMissingAlt} without alt text` : ""}, ${c.media - c.images} other files`);
  if (c.forms) L.push(`- ${c.forms} forms (${inv.forms.map((f) => `${f.title}: ${f.fields} fields`).join("; ")})`);
  L.push(`- ${c.menus} menus${inv.menus.length ? ` (${inv.menus.map((m) => `${m.name}: ${m.items} items`).join("; ")})` : ""}`);
  L.push("", "## Pages", "");
  const byId = Object.fromEntries(inv.pages.map((x) => [x.id, x]));
  const depth = (x) => { let d = 0, cur = x; while (cur && cur.parent && byId[cur.parent] && d < 8) { d++; cur = byId[cur.parent]; } return d; };
  const sorted = [...inv.pages].sort((a, b) => (a.home ? -1 : b.home ? 1 : a.path.localeCompare(b.path)));
  const summarize = (names) => { const out = []; for (const n of names) { const s = n.replace(/^acf\//, ""); const last = out[out.length - 1]; if (last && last.n === s) last.k++; else out.push({ n: s, k: 1 }); } return out.map((x) => (x.k > 1 ? `${x.n} ×${x.k}` : x.n)).join(", "); };
  for (const x of sorted) { const addr = x.home ? "`/`" : x.status !== "publish" && x.path === "/" ? "(no address yet)" : `\`${x.path}\``; L.push(`${"  ".repeat(depth(x))}- ${x.title}${x.home ? " (home)" : ""} ${addr}${x.status !== "publish" ? ` [${x.status}]` : ""}: ${x.classic ? "classic HTML" : x.blocks.length ? summarize(x.blocks) : "empty"}`); }
  const used = inv.acfBlocks.filter((b) => b.uses), unused = inv.acfBlocks.filter((b) => !b.uses);
  if (used.length) {
    L.push("", "## Blocks (ACF)", "", "Content fields only; the old theme's layout settings (padding, colors, section ids, hide-on-mobile) are set aside.", "");
    for (const b of used) {
      L.push(`- ${b.title} \`${b.name}\`, used ${b.uses}×${b.fields.length ? `: ${b.fields.join(", ")}` : ""}`);
      const inUse = (b.variants || []).filter((v) => v.inUse);
      if (inUse.length) L.push(`  options: ${inUse.map((v) => `${v.name} (${Object.entries(v.usage).filter(([k]) => k !== "(empty)").map(([k, n]) => `${(v.options && v.options[k]) || k} ×${n}`).join(", ")})`).join("; ")}`);
      if ((b.references || []).length) L.push(`  refers to: ${b.references.join(", ")}`);
    }
  }
  if (unused.length) L.push("", `Registered but unused: ${unused.map((b) => b.title).join(", ")}.`);
  const core = Object.entries(inv.blockTypes).filter(([n]) => !n.startsWith("acf/")).sort((a, b) => b[1] - a[1]);
  if (core.length) L.push("", "## Other blocks in use", "", core.map(([n, k]) => `- ${n} ×${k}`).join("\n"));
  if (inv.classicPages.length) L.push("", "## Classic pages (hand pass)", "", inv.classicPages.map((x) => `- ${x.title} \`${x.path}\``).join("\n"));
  return L.join("\n") + "\n";
}

// What the mapping skill reads: definitions, each page's block sequence with the
// field NAMES per ACF block and a short sample value, never the full content.
function definitionsForSkill(p) {
  const inv = inventory(p);
  const cls = classifyFields(p);
  const sample = (v) => {
    if (v == null) return null;
    if (typeof v === "string") return plainText(v).slice(0, 80);
    if (typeof v === "number" || typeof v === "boolean") return v;
    if (Array.isArray(v)) return `[list of ${v.length}${v.length && v[0] && typeof v[0] === "object" ? `: ${Object.keys(v[0]).join(", ")}` : ""}]`;
    if (v.image) return `{image ${v.filename || v.url}}`;
    if (v.url && "title" in v) return `{link ${v.title} → ${v.url}}`;
    return `{${Object.keys(v).join(", ")}}`;
  };
  const pages = (p.entries || []).filter((e) => e.type === "page").map((e) => ({
    id: e.id, title: e.title, path: e.path, parent: e.parent || 0, status: e.status, home: inv.pages.find((x) => x.id === e.id)?.home || false,
    classic: !!e.classic,
    blocks: (e.blocks || []).map((b) => {
      if (!b.name.startsWith("acf/")) return { name: b.name, text: sample(b.rendered || b.html || "") };
      const f = b.fields || {};
      const pick = (purpose) => Object.fromEntries(Object.entries(f).filter(([k]) => purposeOf(cls, b.name, k) === purpose).map(([k, v]) => [k, purpose === "content" ? sample(v) : v]));
      const variants = pick("variant"); const refs = pick("reference");
      return { name: b.name, fields: pick("content"), ...(Object.keys(variants).length ? { variants } : {}), ...(Object.keys(refs).length ? { references: refs } : {}), ...(f.deactivate_block || f.deactivate ? { deactivated: true } : {}) };
    }),
    fields: e.fields ? Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k, sample(v)])) : undefined,
  }));
  return {
    site: inv.site, counts: inv.counts,
    postTypes: (p.definitions && p.definitions.postTypes) || [],
    taxonomies: inv.taxonomies,
    fieldGroups: (p.definitions && p.definitions.fieldGroups) || [],
    acfBlocks: inv.acfBlocks.map((b) => ({ ...b, fieldDetail: cls[b.name] ? cls[b.name].fields.map(({ usage, ...r }) => r) : [] })),
    blocksInUse: inv.blockTypes,
    pages,
    menus: (p.site && p.site.menus) || [],
    forms: p.forms || [],
    customTypeSamples: Object.fromEntries(inv.customTypes.map((t) => [t.key, (p.entries || []).filter((e) => e.type === t.key).slice(0, 2).map((e) => ({ title: e.title, path: e.path, fields: e.fields ? Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k, sample(v)])) : {} }))])),
  };
}

// ---- mapping -------------------------------------------------------------------

function slugify(s) {
  return String(s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// Every slot the transform reads, present and empty, so the designer (or the skill)
// fills targets instead of inventing keys. `blocks` is the app's registry
// ({ key, name, fields }) so the skeleton can list what exists.
function mappingSkeleton(p, blocks = []) {
  const inv = inventory(p);
  const defs = p.definitions || {};
  const menus = (p.site && p.site.menus) || [];
  const primary = menus.find((m) => (m.locations || []).some((l) => /primary|main|header/i.test(l))) || menus[0];
  const acfNames = Array.from(new Set([...(defs.blocks || []).map((b) => b.name), ...Object.keys(inv.blockTypes).filter((n) => n.startsWith("acf/"))]));
  const sampleFields = (name) => { const b = inv.acfBlocks.find((x) => x.name === name) || {}; return [...(b.fields || []), ...(b.layoutFields || [])]; };
  return {
    version: MAPPING_VERSION,
    _about: "Targets are empty until confirmed. A page with include:false is skipped (its old address redirects to the nearest kept ancestor). blocks: old ACF block name → new block key + prop ← field. A field value that starts with = is a constant. skipWhen names an old field that, when set, means the block was switched off on the old site (the instance is skipped). _variants are the old block's options in use (a side, a layout type, a switch that reveals fields): map one to a prop with { from, map } when the new block has such an option; with carry: true (the default) every variant value is also kept on the imported instance under _wp, for the design pass.",
    availableBlocks: blocks.map((b) => ({ key: b.key, name: b.name, fields: Object.keys(b.fields || {}) })),
    pages: inv.pages.sort((a, b) => (a.home ? -1 : b.home ? 1 : a.path.localeCompare(b.path))).map((x) => ({
      wp: x.id, title: x.title, wpPath: x.path, page: x.home ? "home" : slugify(x.path.split("/").filter(Boolean).pop() || x.title), parent: null, include: x.status === "publish" || x.status === "draft",
      ...(x.classic ? { classic: true } : {}), ...(x.fields.length ? { wpFields: x.fields } : {}),
    })),
    blocks: Object.fromEntries(acfNames.map((n) => {
      const b = inv.acfBlocks.find((x) => x.name === n) || { fields: sampleFields(n).filter((f) => !isLayoutField(f)), variants: [], references: [], layoutFields: sampleFields(n).filter(isLayoutField) };
      const off = [...b.fields, ...b.layoutFields, ...b.variants.map((v) => v.name)].find((f) => /^deactivate(_block)?$/.test(f));
      const variants = b.variants.filter((v) => v.inUse);
      return [n, { block: "", fields: {}, ...(off ? { skipWhen: off } : {}), carry: true, _wpFields: b.fields,
        ...(variants.length ? { _variants: Object.fromEntries(variants.map((v) => [v.name, { ...(v.options ? { options: v.options } : {}), used: Object.fromEntries(Object.entries(v.usage).filter(([k]) => k !== "(empty)")), ...(v.reveals ? { reveals: v.reveals } : {}) }])) } : {}),
        ...(b.references.length ? { _references: b.references } : {}), ...(b.layoutFields.length ? { _layoutFields: b.layoutFields } : {}) }];
    })),
    prose: { block: "", prop: "" },
    tables: { block: "table", rows: "rows", header: "header", caption: "caption" },
    posts: { import: (inv.counts.posts || 0) > 0, type: "post", categoriesAsTags: true },
    types: Object.fromEntries(inv.customTypes.map((t) => [t.key, { include: false, key: slugify(t.key), label: t.label, path: `/${slugify(t.key)}`, fields: {} }])),
    nav: primary ? primary.slug : null,
    forms: { import: (p.forms || []).length > 0, _found: (p.forms || []).map((f) => ({ id: String(f.id), plugin: f.plugin, title: f.title, fields: (f.fields || []).length })) },
    media: { download: true, folder: "wp" },
  };
}

// ---- forms (Gravity Forms, WPForms) → content/forms/<id>.json --------------------
// The site's forms are six field types. Anything else is skipped and named.
const FORM_TYPE = { text: "text", email: "email", phone: "phone", textarea: "textarea", select: "select", radio: "select", multiselect: "select", checkbox: "checkbox", consent: "checkbox", number: "text", website: "text", url: "text", name: "text", date: "text", time: "text", "gdpr-checkbox": "checkbox" };
const FORM_SKIP = new Set(["hidden", "html", "captcha", "section", "page", "fileupload", "file-upload", "list", "post_title", "post_content", "post_excerpt", "post_tags", "post_category", "post_image", "post_custom_field", "product", "quantity", "total", "shipping", "creditcard", "payment-single", "payment-multiple", "payment-total", "divider", "pagebreak", "password", "signature"]);
const FORM_RESERVED = new Set(["form", "website", "_t", "_ab", "submit", "token"]);
// A compound field (name, address) becomes one field per visible part. Gravity Forms
// names the parts in `inputs` (with the ones the form hides); WPForms names a format.
const NAME_LABEL = { prefix: "Prefix", first: "First name", middle: "Middle name", last: "Last name", suffix: "Suffix" };
const ADDRESS_LABEL = { street: "Street address", street2: "Address line 2", city: "City", state: "State", zip: "ZIP code", country: "Country" };
function expandCompound(x) {
  const t = String(x.type || "").toLowerCase();
  if (t !== "name" && t !== "address") return null;
  const part = (label) => {
    const l = String(label || "").toLowerCase();
    if (t === "name") return /prefix/.test(l) ? "prefix" : /first/.test(l) ? "first" : /middle/.test(l) ? "middle" : /last/.test(l) ? "last" : /suffix/.test(l) ? "suffix" : null;
    return /line 2|address 2|street 2/.test(l) ? "street2" : /street|address/.test(l) ? "street" : /city|town/.test(l) ? "city" : /state|province|region/.test(l) ? "state" : /zip|postal/.test(l) ? "zip" : /country/.test(l) ? "country" : null;
  };
  const labels = t === "name" ? NAME_LABEL : ADDRESS_LABEL;
  let parts;
  if (Array.isArray(x.inputs) && x.inputs.length) parts = x.inputs.filter((i) => !i.hidden).map((i) => part(i.label)).filter(Boolean);
  else if (t === "name") parts = x.format === "simple" ? null : x.format === "first-middle-last" ? ["first", "middle", "last"] : ["first", "last"];
  else parts = x.scheme === "international" ? ["street", "street2", "city", "state", "zip", "country"] : ["street", "street2", "city", "state", "zip"];
  if (!parts || !parts.length) return null; // a simple name: one text field, as before
  const optional = new Set(["prefix", "middle", "suffix", "street2"]);
  return parts.map((p) => ({ type: p === "country" ? "text" : "text", label: labels[p], required: !!x.required && !optional.has(p), choices: [] }));
}
function convertForm(f, slugifyFn) {
  const id = slugifyFn(f.title || `form-${f.id}`) || `form-${f.id}`;
  const fields = []; const skipped = []; const seen = new Set();
  const flat = [];
  for (const x of f.fields || []) { const parts = expandCompound(x); if (parts) flat.push(...parts); else flat.push(x); }
  for (const x of flat) {
    const t = String(x.type || "").toLowerCase();
    const label = plainText(x.label || "") || t;
    if (FORM_SKIP.has(t) || !FORM_TYPE[t]) { if (!["hidden", "html", "captcha", "section", "page", "divider", "pagebreak"].includes(t)) skipped.push({ label, type: t }); continue; }
    let fid = slugifyFn(label) || `field-${x.id}`;
    if (FORM_RESERVED.has(fid)) fid = `field-${fid}`;
    while (seen.has(fid)) fid = `${fid}-2`;
    seen.add(fid);
    const out = { id: fid, type: FORM_TYPE[t], label, required: !!x.required, placeholder: "", help: "" };
    if (out.type === "select") { out.options = (x.choices || []).map(plainText).filter(Boolean); if (!out.options.length) { skipped.push({ label, type: t, why: "no choices" }); continue; } }
    // a single-choice checkbox keeps its one choice as the label (a consent line)
    if (out.type === "checkbox" && (x.choices || []).length === 1 && plainText(x.choices[0])) out.label = plainText(x.choices[0]);
    if (out.type === "checkbox" && (x.choices || []).length > 1) { out.type = "select"; out.options = x.choices.map(plainText).filter(Boolean); }
    fields.push(out);
  }
  const email = fields.find((x) => x.type === "email");
  return { id, doc: { name: plainText(f.title || id), fields, submit: { label: "Send" }, after: { mode: "message", message: "Thanks, your message was sent.", page: null }, recipients: "", replyTo: "", replyToField: email ? email.id : "", recaptcha: false }, skipped };
}

function validateMapping(m, blocks = []) {
  const errors = [];
  if (!m || typeof m !== "object") return ["mapping.json isn't an object."];
  if (Number(m.version) !== MAPPING_VERSION) errors.push(`mapping version ${m.version} isn't supported (expected ${MAPPING_VERSION}).`);
  const known = new Set(blocks.map((b) => b.key));
  const seenPage = new Set();
  for (const pg of m.pages || []) {
    if (pg.include === false) continue;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(String(pg.page || ""))) errors.push(`Page "${pg.title}" (wp ${pg.wp}) needs a usable id (lowercase letters, digits, dashes); got "${pg.page}".`);
    if (seenPage.has(pg.page)) errors.push(`Two pages map to "${pg.page}".`); seenPage.add(pg.page);
  }
  for (const [name, bm] of Object.entries(m.blocks || {})) {
    if (bm && bm.block && known.size && !known.has(bm.block)) errors.push(`Block "${name}" maps to "${bm.block}", which isn't a block on this site.`);
  }
  if (m.prose && m.prose.block && known.size && !known.has(m.prose.block)) errors.push(`prose.block "${m.prose.block}" isn't a block on this site.`);
  for (const [wpType, t] of Object.entries(m.types || {})) {
    if (!t || t.include === false) continue;
    if (!/^[a-z][a-z0-9-]*$/.test(String(t.key || "")) || ["pages", "posts", "site", "types", "collections"].includes(t.key)) errors.push(`Type "${wpType}" needs a usable key; got "${t.key}".`);
    if (!/^\/[a-z0-9-]*$/.test(String(t.path || ""))) errors.push(`Type "${wpType}" needs a path like /team; got "${t.path}".`);
  }
  return errors;
}

// ---- HTML → the site's markdown subset -------------------------------------------
// Paragraphs, headings, bold/italic/strike, links, images, lists, quotes, code,
// dividers. Tables come out as data (for the Table block). Everything else
// (iframes, embeds, scripts, forms, shortcodes) is dropped and named.

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", copy: "©", reg: "®", trade: "™" };
function decode(s) {
  return String(s || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENT[e.toLowerCase()] ?? m;
  });
}
const VOID = new Set(["br", "hr", "img", "input", "meta", "link", "source", "wbr", "area", "col", "embed", "param", "track"]);
const DROP = new Set(["script", "style", "iframe", "embed", "object", "video", "audio", "form", "input", "button", "select", "textarea", "noscript", "svg", "canvas", "template"]);
const BLOCKISH = new Set(["p", "div", "section", "article", "header", "footer", "aside", "main", "nav", "figure", "figcaption", "ul", "ol", "li", "blockquote", "pre", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "details", "summary", "address"]);

function parseHtml(html) {
  const root = { tag: "#root", children: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)|(<)/g;
  let m;
  const attrs = (s) => { const o = {}; for (const a of String(s || "").matchAll(/([^\s=\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) o[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? ""); return o; };
  while ((m = re.exec(html))) {
    if (m[0].startsWith("<!--")) continue;
    if (m[1]) { // close
      const tag = m[1].toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; }
      continue;
    }
    if (m[2]) {
      const tag = m[2].toLowerCase();
      const node = { tag, attrs: attrs(m[3]), children: [] };
      if (tag === "p" || tag === "li") { // an unclosed p/li closes at the next one
        const top = stack[stack.length - 1]; if (top.tag === tag) stack.pop();
      }
      stack[stack.length - 1].children.push(node);
      if (!VOID.has(tag) && !m[4]) stack.push(node);
      continue;
    }
    if (m[5] != null) stack[stack.length - 1].children.push({ tag: "#text", text: decode(m[5]) });
    else if (m[6]) stack[stack.length - 1].children.push({ tag: "#text", text: "<" });
  }
  return root;
}

function htmlToMarkdown(html, opts = {}) {
  const mapLink = typeof opts.link === "function" ? opts.link : (h) => h;
  const mapImage = typeof opts.image === "function" ? opts.image : (src) => src;
  const lost = []; const segments = []; let buf = [];
  const flush = () => { const md = buf.join("\n\n").replace(/\n{3,}/g, "\n\n").trim(); if (md) segments.push({ kind: "md", md }); buf = []; };
  const note = (what, text) => lost.push({ node: what, ...(text ? { text: String(text).slice(0, 80) } : {}) });
  const textOf = (n) => n.tag === "#text" ? n.text : (n.children || []).map(textOf).join("");
  const inline = (nodes, ctx = {}) => nodes.map((n) => {
    if (n.tag === "#text") return n.text.replace(/\s+/g, " ");
    const t = n.tag; const kids = () => inline(n.children, ctx);
    if (DROP.has(t)) { note(t, n.attrs && (n.attrs.src || n.attrs.href)); return ""; }
    if (t === "br") return "  \n";
    if (t === "strong" || t === "b") { const s = kids().trim(); return s ? `**${s}**` : ""; }
    if (t === "em" || t === "i") { const s = kids().trim(); return s ? `*${s}*` : ""; }
    if (t === "s" || t === "del" || t === "strike") { const s = kids().trim(); return s ? `~~${s}~~` : ""; }
    if (t === "code") return `\`${textOf(n)}\``;
    if (t === "a") { const s = kids().trim(); const href = mapLink((n.attrs.href || "").trim()); return href ? `[${s || href}](${href})` : s; }
    if (t === "img") { const src = mapImage((n.attrs.src || "").trim()); if (!src) return ""; return `![${(n.attrs.alt || "").replace(/[\[\]]/g, "")}](${src})`; }
    if (t === "span" || t === "u" || t === "small" || t === "sup" || t === "sub" || t === "mark" || t === "abbr" || t === "cite" || t === "time" || t === "label") return kids();
    if (BLOCKISH.has(t)) { // a block inside inline context: render it into the stream
      blocks([n]); return "";
    }
    return kids();
  }).join("");
  const list = (n, ordered, depth) => {
    const items = n.children.filter((c) => c.tag === "li");
    return items.map((li, i) => {
      const sub = li.children.filter((c) => c.tag === "ul" || c.tag === "ol");
      const own = li.children.filter((c) => c.tag !== "ul" && c.tag !== "ol");
      const head = inline(own).replace(/\s+/g, " ").trim();
      const nested = sub.map((s) => list(s, s.tag === "ol", depth + 1)).join("\n");
      return `${"  ".repeat(depth)}${ordered ? `${i + 1}.` : "-"} ${head}${nested ? "\n" + nested : ""}`;
    }).join("\n");
  };
  const table = (n) => {
    const rows = []; let header = false;
    const walk = (x, inHead) => { for (const c of x.children || []) { if (c.tag === "tr") { const cells = c.children.filter((k) => k.tag === "td" || k.tag === "th"); if (cells.length) { rows.push(cells.map((k) => inline(k.children).replace(/\s+/g, " ").trim())); if (inHead || (rows.length === 1 && cells.every((k) => k.tag === "th"))) header = true; } } else if (c.tag === "thead" || c.tag === "tbody" || c.tag === "tfoot") walk(c, c.tag === "thead"); } };
    walk(n, false);
    const cap = n.children.find((c) => c.tag === "caption");
    const cells = n.children.flatMap((c) => c.children || []).flatMap((r) => r.children || []);
    if (cells.some((k) => k.attrs && (k.attrs.colspan || k.attrs.rowspan))) note("table-merged-cells");
    flush();
    segments.push({ kind: "table", rows, header, caption: cap ? textOf(cap).trim() : "" });
  };
  const blocks = (nodes) => {
    for (const n of nodes) {
      if (n.tag === "#text") { const s = n.text.trim(); if (s) buf.push(n.text.replace(/\s+/g, " ").trim()); continue; }
      const t = n.tag;
      if (DROP.has(t)) { note(t, n.attrs && (n.attrs.src || n.attrs.href || n.attrs.action)); continue; }
      if (/^h[1-6]$/.test(t)) { const s = inline(n.children).trim(); if (s) buf.push(`${"#".repeat(Number(t[1]))} ${s}`); continue; }
      if (t === "p") { const s = inline(n.children).trim(); if (s) buf.push(s); continue; }
      if (t === "ul" || t === "ol") { buf.push(list(n, t === "ol", 0)); continue; }
      if (t === "blockquote") { const inner = htmlToMarkdown(n.children.map(serialize).join(""), opts); for (const seg of inner.segments) if (seg.kind === "md") buf.push(seg.md.split("\n").map((l) => `> ${l}`).join("\n")); lost.push(...inner.lost); continue; }
      if (t === "pre") { buf.push("```\n" + textOf(n).replace(/^\n+|\n+$/g, "") + "\n```"); continue; }
      if (t === "hr") { buf.push("---"); continue; }
      if (t === "table") { table(n); continue; }
      if (t === "figure") { const img = n.children.find((c) => c.tag === "img") || (n.children.find((c) => c.tag === "a") || { children: [] }).children.find((c) => c.tag === "img"); const cap = n.children.find((c) => c.tag === "figcaption"); if (img) { buf.push(inline([img])); if (cap) buf.push(`*${textOf(cap).trim()}*`); } else blocks(n.children); continue; }
      if (t === "img") { buf.push(inline([n])); continue; }
      if (BLOCKISH.has(t) || t === "details" || t === "summary") { blocks(n.children); continue; } // unwrap containers
      // inline content at block level (a bare <strong>, <a>, text runs with <br>)
      const s = inline([n]).trim(); if (s) buf.push(s);
    }
  };
  const serialize = (n) => n.tag === "#text" ? n.text.replace(/&/g, "&amp;").replace(/</g, "&lt;") : `<${n.tag}${Object.entries(n.attrs || {}).map(([k, v]) => ` ${k}="${String(v).replace(/"/g, "&quot;")}"`).join("")}>${(n.children || []).map(serialize).join("")}</${n.tag}>`;
  // Shortcodes are named and removed before parsing (they render nothing off WordPress).
  const src = String(html || "").replace(/\[(\/?)([a-zA-Z_][\w-]*)([^\]]*)\]/g, (m, close, name) => { if (!close) note(`shortcode [${name}]`); return ""; });
  blocks(parseHtml(src).children);
  flush();
  const md = segments.filter((s) => s.kind === "md").map((s) => s.md).join("\n\n");
  return { md, segments, lost, tables: segments.filter((s) => s.kind === "table") };
}

function plainText(v) {
  if (v == null) return "";
  if (typeof v !== "string") return Array.isArray(v) ? v.map(plainText).filter(Boolean).join(", ") : typeof v === "object" ? (v.title || v.name || v.url || "") : String(v);
  return decode(v.replace(/<br\s*\/?>/gi, " ").replace(/<\/(?:p|div|li|h[1-6]|tr|td|th|blockquote|section)>/gi, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

// ---- transform -------------------------------------------------------------------

function fmQuote(v) {
  const s = String(v);
  return /^[A-Za-z0-9 .,!?()'&/-]*$/.test(s) && !/^(true|false|null|~|\d.*)$/.test(s) && !/^\s|\s$|:/.test(s) ? s : JSON.stringify(s);
}
function serializeFrontmatter(data) {
  const lines = [];
  for (const k of ["title", "slug", "date", "updated", "description", "image", "tags", "draft"]) {
    const v = data[k];
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) { if (v.length) lines.push(`${k}: [${v.map(fmQuote).join(", ")}]`); }
    else if (typeof v === "boolean") { if (v) lines.push(`${k}: true`); }
    else lines.push(`${k}: ${fmQuote(v)}`);
  }
  const seo = data.seo && typeof data.seo === "object" ? Object.entries(data.seo).filter(([, v]) => v !== "" && v != null && v !== false) : [];
  if (seo.length) { lines.push("seo:"); for (const [k, v] of seo) lines.push(`  ${k}: ${typeof v === "boolean" ? v : fmQuote(v)}`); }
  return `---\n${lines.join("\n")}\n---\n`;
}

function getPath(obj, p) { return String(p).split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function setPath(obj, p, value) {
  const parts = String(p).replace(/\[(\d+)\]/g, ".$1").split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]; const nextIsIndex = /^\d+$/.test(parts[i + 1]);
    if (cur[k] == null || typeof cur[k] !== "object") cur[k] = nextIsIndex ? [] : {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}
const stripIndex = (p) => String(p).replace(/\[\d+\]/g, "").replace(/\.\d+(?=\.|$)/g, "");
// Lists mapped by index (ctas[1] with no ctas[0]) leave holes; a hole is not a block prop.
function compact(v) {
  if (Array.isArray(v)) return v.filter((x) => x !== undefined && x !== null).map(compact);
  if (v && typeof v === "object") { for (const k of Object.keys(v)) v[k] = compact(v[k]); return v; }
  return v;
}
// The block's own defaults beneath the imported props (what the CMS does when a block is
// added), so a prop the old block never had is present with its default and the build
// validates. Imported lists win whole; a default's seeded example item never leaks in.
function withDefaults(defaults, props) {
  if (!defaults || typeof defaults !== "object" || Array.isArray(defaults)) return props;
  const out = { ...defaults };
  for (const [k, v] of Object.entries(props || {})) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && defaults[k] && typeof defaults[k] === "object" && !Array.isArray(defaults[k]) ? withDefaults(defaults[k], v) : v;
  }
  return out;
}

function seoOf(e) {
  const s = e.seo || {}; const out = {};
  if (s.title) out.title = plainText(s.title);
  const desc = s.description || e.excerpt; if (desc) out.description = plainText(desc).slice(0, 320);
  if (s.noindex) out.noindex = true;
  if (s.keyphrase) out.keyphrase = plainText(s.keyphrase);
  if (s.image) out.image = s.image;
  return out;
}

async function transform(projectDir, payload, mapping, { blocks = [], fetchMedia = null, blogPath = "blog", dry = false } = {}) {
  const errors = validateMapping(mapping, blocks);
  if (errors.length) return { ok: false, errors };
  const site = payload.site || {};
  const entries = payload.entries || [];
  const byWp = Object.fromEntries(entries.map((e) => [e.id, e]));
  const blockFields = Object.fromEntries(blocks.map((b) => [b.key, b.fields || {}]));
  const blockDefaults = Object.fromEntries(blocks.map((b) => [b.key, b.defaults || null]));
  const homeHost = (() => { try { return new URL(site.home).host; } catch { return ""; } })();
  const report = { pages: [], posts: { imported: 0, drafts: 0, lost: [] }, types: {}, forms: [], media: { downloaded: 0, failed: [], skipped: 0 }, redirects: 0, redirectsFlagged: [], unmappedBlocks: {}, unmappedFields: {}, skipped: [], variants: {}, files: [] };
  const cls = classifyFields(payload);
  const noteVariants = (name, fields) => { const v = report.variants[name] || (report.variants[name] = {}); for (const [k, val] of Object.entries(fields || {})) { if (purposeOf(cls, name, k) !== "variant") continue; const key = val == null || val === "" ? "(empty)" : typeof val === "object" ? "(object)" : String(val); (v[k] || (v[k] = {}))[key] = ((v[k] || {})[key] || 0) + 1; } };
  const written = [];
  const writeFile = (rel, text) => { written.push(rel); if (dry) return; const abs = path.join(projectDir, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, text); };
  const readJson = (rel) => { try { return JSON.parse(fs.readFileSync(path.join(projectDir, rel), "utf8")); } catch { return null; } };

  // ---- routes: where every old entry lands, decided before any content is written
  const pageMap = new Map(); // wp id → { id, slug, parent, include, ... }
  for (const pg of mapping.pages || []) pageMap.set(Number(pg.wp), pg);
  const pageIdOf = (wp) => { const pg = pageMap.get(Number(wp)); return pg && pg.include !== false ? pg.page : null; };
  const routeOfPage = (wp, guard = 0) => {
    const pg = pageMap.get(Number(wp)); if (!pg || pg.include === false || guard > 16) return null;
    if (pg.page === "home") return "";
    const e = byWp[wp] || {};
    const parentId = pg.parent != null ? pg.parent : (e.parent ? pageIdOf(e.parent) : null);
    const parentWp = pg.parent != null ? [...pageMap.entries()].find(([, x]) => x.page === pg.parent)?.[0] : e.parent;
    const slug = pg.slug || (pg.page === "home" ? "" : pg.page);
    const up = parentId && parentWp ? routeOfPage(parentWp, guard + 1) : null;
    return up ? `${up}/${slug}` : slug;
  };
  const typeCfg = (wpType) => { const t = (mapping.types || {})[wpType]; return t && t.include !== false && t.key ? t : null; };
  const postsCfg = mapping.posts || {};
  const postType = postsCfg.type || "post";
  const newRoute = (e) => {
    if (e.type === "page") { const r = routeOfPage(e.id); return r == null ? null : "/" + r; }
    if (e.type === postType && postsCfg.import !== false) return `/${blogPath}/${slugify(e.slug || e.title)}`;
    const t = typeCfg(e.type); if (t) return `${t.path}/${slugify(e.slug || e.title)}`;
    return null;
  };
  const oldToNew = new Map();
  for (const e of entries) { const r = newRoute(e); if (r != null && e.path) oldToNew.set(e.path.replace(/\/$/, "") || "/", r || "/"); }
  const nearestKept = (e, guard = 0) => { if (!e || guard > 16) return "/"; if (e.parent && byWp[e.parent]) { const r = newRoute(byWp[e.parent]); if (r != null) return r || "/"; return nearestKept(byWp[e.parent], guard + 1); } return "/"; };
  // Pages not kept: their old address goes to the nearest kept ancestor (flagged for the designer).
  for (const pg of mapping.pages || []) {
    const e = byWp[pg.wp]; if (!e || pg.include !== false || !e.path) continue;
    const key = e.path.replace(/\/$/, "") || "/"; if (key === "/" || oldToNew.has(key)) continue;
    const to = nearestKept(e); oldToNew.set(key, to); report.redirectsFlagged.push({ from: key, to, why: "page not kept" });
  }
  const rewriteUrl = (url) => {
    if (!url || typeof url !== "string") return "";
    let u = url.trim();
    try { const x = new URL(u, site.home || "http://localhost/"); if (homeHost && x.host === homeHost) u = x.pathname + x.search + x.hash; else if (/^https?:/i.test(u)) return u; } catch { return u; }
    if (u.startsWith("/")) { const key = u.replace(/\/$/, "").replace(/[?#].*$/, "") || "/"; const hit = oldToNew.get(key); if (hit != null) { const rest = u.slice(key === "/" ? 1 : key.length).replace(/^\/(?=$|[?#])/, ""); return ((hit || "/") + rest) || "/"; } return u.length > 1 ? u.replace(/\/(?=$|[?#])/, "") : u; }
    return u;
  };

  // ---- media: attachments become /images/<folder>/<file> through the injected fetcher
  const mediaById = Object.fromEntries((payload.media || []).map((m) => [m.id, m]));
  const mediaByUrl = Object.fromEntries((payload.media || []).map((m) => [m.url, m]));
  const mediaCache = new Map();
  const folder = (mapping.media && mapping.media.folder) || "wp";
  const wantMedia = !(mapping.media && mapping.media.download === false) && typeof fetchMedia === "function";
  async function media(ref) {
    const att = typeof ref === "number" ? mediaById[ref] : ref && ref.image ? (mediaById[ref.image] || { id: ref.image, url: ref.url, filename: ref.filename, mime: ref.mime, alt: ref.alt }) : typeof ref === "string" ? (mediaByUrl[ref] || { id: null, url: ref, filename: path.basename(ref.split("?")[0]), mime: "" }) : null;
    if (!att || !att.url) return null;
    const alt = (ref && typeof ref === "object" && ref.alt) || att.alt || "";
    const key = att.id || att.url;
    if (mediaCache.has(key)) return { src: mediaCache.get(key), alt };
    if (!wantMedia) { report.media.skipped++; const src = rewriteUrl(att.url); mediaCache.set(key, src); return { src, alt }; }
    try {
      const rel = await fetchMedia(att, folder);
      if (!rel) throw new Error("no file");
      mediaCache.set(key, rel); report.media.downloaded++;
      return { src: rel, alt };
    } catch (e) { report.media.failed.push({ id: att.id, url: att.url, error: e.message }); mediaCache.set(key, att.url); return { src: att.url, alt }; }
  }

  // ---- forms: written first so a block can bind to one by its new id
  const formsCfg = mapping.forms || {};
  const formIdByWp = {}; // old plugin form id → content/forms id
  if (formsCfg.import !== false && Array.isArray(payload.forms)) {
    for (const f of payload.forms) {
      const { id, doc, skipped } = convertForm(f, slugify);
      formIdByWp[String(f.id)] = id;
      const rel = path.join("content", "forms", `${id}.json`);
      const existing = readJson(rel);
      if (existing && formsCfg.overwrite !== true) { report.forms.push({ id, name: doc.name, fields: doc.fields.length, kept: true, skipped }); continue; }
      writeFile(rel, JSON.stringify({ ...doc, updated: new Date().toISOString() }, null, 2) + "\n");
      report.forms.push({ id, name: doc.name, fields: doc.fields.length, skipped });
    }
  }
  const formRef = (v) => { const raw = v && typeof v === "object" ? (v.id ?? v.ID ?? v.form_id ?? v.value) : v; const key = raw == null ? "" : String(raw); return formIdByWp[key] || (Object.values(formIdByWp).includes(slugify(key)) ? slugify(key) : undefined); };

  // ---- values by target kind
  async function coerce(kind, value, spec, ctx) {
    if (value === undefined || value === null) return undefined;
    switch (kind) {
      case "image": { if (typeof value === "string" && !/^https?:|^\//.test(value)) return undefined; const img = await media(typeof value === "object" && value.image ? value : typeof value === "number" ? value : String(value)); return img || undefined; }
      case "link": {
        if (typeof value === "string") return value ? { label: "", href: rewriteUrl(value) } : undefined;
        if (value && typeof value === "object") { const href = rewriteUrl(value.url || value.href || (value.post ? value.url : "")); return href ? { label: plainText(value.title || value.label || ""), href } : undefined; }
        return undefined;
      }
      case "richtext": {
        if (typeof value !== "string") return plainText(value);
        const r = htmlToMarkdown(value, await proseOpts(value));
        for (const l of r.lost) ctx.lost.push({ where: ctx.where, ...l });
        for (const t of r.tables) ctx.lost.push({ where: ctx.where, node: "table-in-richtext", text: `${t.rows.length} rows` });
        return r.md;
      }
      case "number": { const n = Number(typeof value === "object" ? NaN : value); return Number.isFinite(n) ? n : undefined; }
      case "boolean": return value === true || value === "1" || value === 1 || value === "true" || value === "yes";
      case "enum": {
        const options = (spec && spec.options) || [];
        const raw = Array.isArray(value) ? value[0] : value && typeof value === "object" ? (value.value ?? value.label) : value;
        const mapped = spec && spec.map && Object.prototype.hasOwnProperty.call(spec.map, String(raw)) ? spec.map[String(raw)] : raw;
        if (options.length && !options.includes(mapped)) { ctx.lost.push({ where: ctx.where, node: "enum-value", text: `${raw} → ${options[0]}` }); return options[0]; }
        return mapped;
      }
      case "list": {
        const arr = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [value];
        if (spec && spec.each) { const out = []; for (const item of arr) out.push(await mapFields(spec.each, item, ctx.targetFields, ctx.where, ctx.lost, ctx.prefix)); return out.filter((x) => x && Object.keys(x).length); }
        return arr.map(plainText).filter(Boolean);
      }
      case "object": return spec && spec.each ? mapFields(spec.each, value, ctx.targetFields, ctx.where, ctx.lost, ctx.prefix) : undefined;
      case "form": { const id = formRef(value); if (!id) ctx.lost.push({ where: ctx.where, node: "form-reference", text: String(value && typeof value === "object" ? (value.title || value.id) : value) }); return id; }
      default: { const str = plainText(value); return /^(https?:\/\/\S+|\/[^\s]*)$/.test(str) ? rewriteUrl(str) : str; }
    }
  }
  async function mapFields(fieldMap, src, targetFields, where, lost, prefix = "") {
    const props = {};
    for (const [target, spec] of Object.entries(fieldMap || {})) {
      const fullPath = prefix ? `${prefix}.${target}` : target;
      const meta = targetFields[stripIndex(fullPath)] || {};
      let value;
      let s = spec;
      if (typeof spec === "string") { if (spec.startsWith("=")) { value = spec.slice(1); s = null; } else value = getPath(src, spec); }
      else if (spec && typeof spec === "object") value = spec.from ? getPath(src, spec.from) : spec.value !== undefined ? spec.value : src;
      // pick: one wysiwyg field that holds a headline and its intro, split in two.
      // "heading" = the first heading's text; "rest" = everything after it.
      if (s && s.pick && typeof value === "string") {
        const m = value.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
        if (s.pick === "heading") value = m ? plainText(m[1]) : (s.fallback === "first" ? plainText(value.split(/<\/p>/i)[0]) : undefined);
        else if (s.pick === "rest") value = m ? value.slice(0, m.index) + value.slice(m.index + m[0].length) : value;
      }
      // flatMap: a repeater of groups (FAQ sections each holding questions) flattened to one list.
      if (s && s.flatMap && Array.isArray(value)) value = value.flatMap((g) => (g && Array.isArray(g[s.flatMap]) ? g[s.flatMap] : []));
      const indexed = /\[\d+\]$/.test(target);
      const kind = (s && s.as) || (indexed && s && s.each ? "object" : null) || (indexed && meta.kind === "list" ? null : meta.kind) || (meta.options ? "enum" : undefined) || (typeof value === "object" && value !== null ? (value.image ? "image" : Array.isArray(value) ? "list" : value.url !== undefined ? "link" : "object") : "string");
      const ctx = { where, lost, targetFields, prefix: stripIndex(fullPath) };
      const out = await coerce(kind, value, { ...(s || {}), options: meta.options }, ctx);
      if (out !== undefined && out !== "" && !(Array.isArray(out) && !out.length)) setPath(props, target, out);
    }
    return props;
  }

  // Prose conversion: links point at the new site, images referenced in the HTML come
  // through the media fetcher like any other attachment (resolved up front, since the
  // converter itself is synchronous).
  async function proseOpts(html) {
    const srcs = Array.from(new Set(Array.from(String(html || "").matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)).map((m) => decode(m[1]))));
    const images = {};
    for (const src of srcs) { const r = await media(src); if (r) images[src] = r.src; }
    return { link: rewriteUrl, image: (src) => images[src] || rewriteUrl(src) };
  }

  // ---- prose runs (core blocks, classic HTML) → the prose block + Table blocks
  const prose = mapping.prose || {};
  const tables = mapping.tables || {};
  const tableOk = tables.block && blocks.some((b) => b.key === tables.block);
  const proseOk = prose.block && prose.prop && blocks.some((b) => b.key === prose.block);
  async function proseToBlocks(html, where, lost, out) {
    const r = htmlToMarkdown(html, await proseOpts(html));
    for (const l of r.lost) lost.push({ where, ...l });
    for (const seg of r.segments) {
      if (seg.kind === "table") {
        if (tableOk) { const props = {}; setPath(props, tables.rows || "rows", seg.rows.map((cells) => ({ cells }))); if (tables.header) setPath(props, tables.header, !!seg.header); if (tables.caption && seg.caption) setPath(props, tables.caption, seg.caption); out.push({ type: tables.block, props }); }
        else lost.push({ where, node: "table", text: `${seg.rows.length} rows` });
      } else if (proseOk) out.push({ type: prose.block, props: { [prose.prop]: seg.md } });
      else lost.push({ where, node: "prose", text: seg.md.slice(0, 80) });
    }
  }
  const coreHtml = (b) => b.rendered || b.html || "";
  // Core blocks that are not prose: they have no destination in a richtext prop, so they
  // are named in the report (with their address) instead of leaking a bare URL into copy.
  const NON_PROSE = /^(core\/(embed|video|audio|html|shortcode|file|gallery|buttons?|cover|media-text|social-links?|calendar|rss|search|latest-(posts|comments)|archives|categories|tag-cloud|navigation|query|post-template)|core-embed\/|jetpack\/|woocommerce\/)/;
  const nonProse = (b, where, lost) => { if (!NON_PROSE.test(b.name)) return false; lost.push({ where, node: b.name, text: (b.attrs && (b.attrs.url || b.attrs.href)) || plainText(b.html || "").slice(0, 80) }); return true; };

  // ---- pages
  const pageDocs = [];
  for (const pg of mapping.pages || []) {
    const e = byWp[pg.wp]; if (!e) continue;
    if (pg.include === false) continue;
    const id = pg.page; const lost = []; const dropped = []; const out = [];
    let run = [];
    const flushRun = async () => { if (run.length) { await proseToBlocks(run.join("\n"), `${id}`, lost, out); run = []; } };
    if (e.classic) await proseToBlocks(e.html || "", id, lost, out);
    for (const b of e.blocks || []) {
      if (b.name.startsWith("acf/")) {
        await flushRun();
        const bm = (mapping.blocks || {})[b.name];
        if (bm && bm.skipWhen && b.fields && b.fields[bm.skipWhen]) { report.skipped.push({ where: id, block: b.name, why: bm.skipWhen }); continue; }
        if (!bm || !bm.block) { dropped.push(b.name); report.unmappedBlocks[b.name] = (report.unmappedBlocks[b.name] || 0) + 1; noteVariants(b.name, b.fields); continue; }
        const props = await mapFields(bm.fields || {}, b.fields || {}, blockFields[bm.block] || {}, `${id} › ${b.name}`, lost);
        const used = new Set(Object.values(bm.fields || {}).map((s) => typeof s === "string" ? s.split(".")[0] : s && s.from ? String(s.from).split(".")[0] : null));
        const unmapped = Object.keys(b.fields || {}).filter((k) => !used.has(k) && purposeOf(cls, b.name, k) === "content" && b.fields[k] !== "" && b.fields[k] !== null && b.fields[k] !== false && !(Array.isArray(b.fields[k]) && !b.fields[k].length));
        if (unmapped.length) report.unmappedFields[b.name] = Array.from(new Set([...(report.unmappedFields[b.name] || []), ...unmapped]));
        noteVariants(b.name, b.fields);
        // The old block's options ride along on the instance (under _wp: unknown to the
        // block's schema, so stripped at build, kept in content for the design pass).
        const carried = bm.carry === false ? {} : Object.fromEntries(Object.entries(b.fields || {}).filter(([k, v]) => purposeOf(cls, b.name, k) === "variant" && v !== "" && v != null && typeof v !== "object"));
        out.push({ type: bm.block, props: withDefaults(blockDefaults[bm.block], compact(props)), ...(Object.keys(carried).length ? { _wp: { block: b.name, ...carried } } : {}) });
      } else if (!nonProse(b, id, lost)) run.push(coreHtml(b));
    }
    await flushRun();
    if (e.fields && Object.keys(e.fields).length && !pg.fields) lost.push({ where: id, node: "page-fields", text: Object.keys(e.fields).join(", ") });
    const parentId = pg.parent != null ? pg.parent : (e.parent ? pageIdOf(e.parent) : null);
    const doc = { title: plainText(e.title) || id, ...(id !== "home" ? { slug: pg.slug || id } : {}), ...(parentId && id !== "home" ? { parent: parentId } : {}), ...(Number.isFinite(e.order) ? { order: e.order } : {}), ...(e.status !== "publish" ? { draft: true } : {}), seo: seoOf(e), blocks: out };
    if (doc.seo.image) { const img = await media(typeof doc.seo.image === "string" ? doc.seo.image : doc.seo.image); if (img) doc.seo.image = img.src; }
    pageDocs.push({ id, doc });
    report.pages.push({ id, title: doc.title, route: "/" + (routeOfPage(e.id) || ""), from: e.path, blocks: out.length, dropped, lost, classic: !!e.classic, draft: !!doc.draft });
  }
  for (const { id, doc } of pageDocs) writeFile(path.join("content", "pages", `${id}.json`), JSON.stringify(doc, null, 2) + "\n");

  // ---- posts
  if (postsCfg.import !== false) {
    for (const e of entries.filter((x) => x.type === postType)) {
      const lost = [];
      const html = e.classic ? e.html || "" : (e.blocks || []).map((b) => b.name.startsWith("acf/") || nonProse(b, e.slug, lost) ? "" : coreHtml(b)).join("\n");
      const r = htmlToMarkdown(html, await proseOpts(html));
      for (const l of r.lost) lost.push({ where: e.slug, ...l });
      const body = r.segments.map((s) => s.kind === "md" ? s.md : s.rows.map((row) => `| ${row.join(" | ")} |`).join("\n")).join("\n\n"); // a table in a post stays as a pipe table (text)
      for (const t of r.tables) lost.push({ where: e.slug, node: "table-as-text", text: `${t.rows.length} rows` });
      const slug = slugify(e.slug || e.title) || `post-${e.id}`;
      const tags = (e.terms || []).filter((t) => t.taxonomy === "post_tag" || (postsCfg.categoriesAsTags !== false && t.taxonomy === "category")).map((t) => t.name).filter((n) => n && n.toLowerCase() !== "uncategorized");
      const cover = e.featuredImage ? await media(Number(e.featuredImage)) : null;
      const fm = { title: plainText(e.title), date: String(e.date || "").slice(0, 10), updated: e.modified || undefined, description: plainText(e.excerpt) || (seoOf(e).description || ""), image: cover ? cover.src : "", tags: Array.from(new Set(tags)), draft: e.status !== "publish", seo: (() => { const s = seoOf(e); delete s.description; return s; })() };
      writeFile(path.join("content", "posts", `${slug}.md`), serializeFrontmatter(fm) + "\n" + body + "\n");
      report.posts.imported++; if (fm.draft) report.posts.drafts++; report.posts.lost.push(...lost);
    }
  }

  // ---- custom types
  const ACF_KIND = { text: "text", textarea: "textarea", wysiwyg: "richtext", number: "number", range: "number", true_false: "boolean", date_picker: "date", date_time_picker: "date", image: "image", select: "select", radio: "select", button_group: "select", url: "link", link: "link", page_link: "link", checkbox: "list", email: "text", oembed: "text", color_picker: "text", post_object: "reference", relationship: "reference" };
  const typesFile = readJson(path.join("content", "types.json")) || { types: [] };
  let typesChanged = false;
  for (const [wpType, t] of Object.entries(mapping.types || {})) {
    if (!t || t.include === false || !t.key) continue;
    const def = ((payload.definitions && payload.definitions.postTypes) || []).find((x) => x.key === wpType) || {};
    const groups = ((payload.definitions && payload.definitions.fieldGroups) || []).filter((g) => JSON.stringify(g.location || []).includes(`"${wpType}"`));
    const acfDefs = Object.fromEntries(groups.flatMap((g) => g.fields || []).map((f) => [f.name, f]));
    const fields = [];
    for (const [wpField, spec] of Object.entries(t.fields || {})) {
      const key = typeof spec === "string" ? spec : spec && spec.key; if (!key) continue;
      const acf = acfDefs[wpField] || {};
      const kind = (spec && spec.kind) || ACF_KIND[acf.type] || "text";
      const f = { key, label: (spec && spec.label) || acf.label || wpField, kind, required: !!acf.required };
      if (kind === "select") f.options = acf.choices ? Object.values(acf.choices).map(String) : (spec && spec.options) || [];
      if (kind === "reference" && spec && spec.reference) f.reference = spec.reference;
      fields.push(f);
    }
    const tdef = { key: t.key, label: t.label || def.label || wpType, ...(t.singular || def.singular ? { singular: t.singular || def.singular } : {}), path: t.path || `/${t.key}`, fields, template: Array.isArray(t.template) ? t.template : [], ...(t.index !== false ? { index: { title: t.label || def.label || wpType } } : {}) };
    const i = typesFile.types.findIndex((x) => x.key === t.key); if (i >= 0) typesFile.types[i] = tdef; else typesFile.types.push(tdef);
    typesChanged = true;
    const rep = { key: t.key, entries: 0, lost: [] };
    for (const e of entries.filter((x) => x.type === wpType)) {
      const slug = slugify(e.slug || e.title) || `${t.key}-${e.id}`;
      const doc = { title: plainText(e.title), slug, ...(e.status !== "publish" ? { draft: true } : {}), seo: seoOf(e) };
      const lost = [];
      for (const f of fields) {
        const wpField = Object.keys(t.fields).find((k) => (typeof t.fields[k] === "string" ? t.fields[k] : t.fields[k].key) === f.key);
        const raw = e.fields ? getPath(e.fields, wpField) : undefined;
        const kind = f.kind === "select" ? "enum" : f.kind === "textarea" || f.kind === "text" || f.kind === "date" ? "string" : f.kind === "reference" ? "string" : f.kind;
        const v = await coerce(kind, raw, { options: f.options }, { where: `${t.key}/${slug}`, lost, targetFields: {}, prefix: "" });
        if (v !== undefined && v !== "") doc[f.key] = f.kind === "reference" && v && typeof v === "object" ? slugify(v.slug || "") : v;
      }
      if (t.featuredImageField && e.featuredImage) { const img = await media(Number(e.featuredImage)); if (img) doc[t.featuredImageField] = img; }
      writeFile(path.join("content", t.key, `${slug}.json`), JSON.stringify(doc, null, 2) + "\n");
      rep.entries++; rep.lost.push(...lost);
    }
    report.types[wpType] = rep;
  }
  if (typesChanged) writeFile(path.join("content", "types.json"), JSON.stringify(typesFile, null, 2) + "\n");

  // ---- site.json: nav, site name, redirects
  const siteJson = readJson(path.join("content", "site.json")) || { design: "v00", nav: [], footerLinks: [] };
  if (mapping.nav) {
    const menu = (site.menus || []).find((m) => m.slug === mapping.nav || String(m.id) === String(mapping.nav));
    if (menu) {
      const hrefOf = (it) => { if (it.object === "page" && it.objectId) { const r = routeOfPage(it.objectId); if (r != null) return "/" + r; } return rewriteUrl(it.url); };
      const items = [...(menu.items || [])].sort((a, b) => a.order - b.order);
      const top = items.filter((it) => !it.parent);
      siteJson.nav = top.map((it) => ({ label: plainText(it.title), href: hrefOf(it), links: items.filter((c) => c.parent === it.id).map((c) => ({ label: plainText(c.title), href: hrefOf(c) })) })).map((n) => (n.links.length ? n : { label: n.label, href: n.href }));
      siteJson.manageNav = true;
    }
  }
  if (site.name && !(siteJson.seo && siteJson.seo.siteName)) siteJson.seo = { ...(siteJson.seo || {}), siteName: site.name };
  const have = new Map((siteJson.redirects || []).map((r) => [r.from.toLowerCase(), r]));
  let added = 0;
  const addRedirect = (from, to) => { if (!from || from === "/" || from === to || have.has(from.toLowerCase())) return; have.set(from.toLowerCase(), { from, to, type: 301 }); added++; };
  for (const [from, to] of oldToNew) if (from !== to) addRedirect(from, to || "/");
  if (added) siteJson.redirects = Array.from(have.values());
  report.redirects = added;
  writeFile(path.join("content", "site.json"), JSON.stringify(siteJson, null, 2) + "\n");

  report.files = written;
  return { ok: true, report };
}

function reportMarkdown(rep) {
  const L = ["# Import report", ""];
  L.push(`- ${rep.pages.length} pages written, ${rep.posts.imported} posts (${rep.posts.drafts} drafts), ${Object.values(rep.types).reduce((n, t) => n + t.entries, 0)} entries in ${Object.keys(rep.types).length} types`);
  if (rep.forms && rep.forms.length) L.push(`- ${rep.forms.length} form${rep.forms.length === 1 ? "" : "s"} in the Forms tab (${rep.forms.map((f) => `${f.name}: ${f.fields} fields${f.kept ? ", already there, left as is" : ""}${f.skipped.length ? `, ${f.skipped.length} skipped` : ""}`).join("; ")}). Recipients and delivery are set in the Forms tab.`);
  L.push(`- ${rep.media.downloaded} images brought in${rep.media.failed.length ? `, ${rep.media.failed.length} failed` : ""}${rep.media.skipped ? `, ${rep.media.skipped} left at their old address` : ""}`);
  L.push(`- ${rep.redirects} redirects added${rep.redirectsFlagged.length ? ` (${rep.redirectsFlagged.length} pages not kept, sent to the nearest kept page)` : ""}`);
  const ub = Object.entries(rep.unmappedBlocks);
  if (ub.length) L.push("", "## Blocks with no destination (dropped)", "", ...ub.map(([n, k]) => `- ${n} ×${k}`));
  if (rep.skipped && rep.skipped.length) L.push("", "## Switched off on the old site (skipped)", "", ...rep.skipped.map((x) => `- ${x.where}: ${x.block}`));
  const vr = Object.entries(rep.variants || {}).map(([n, fs]) => [n, Object.entries(fs).filter(([, c]) => Object.keys(c).some((k) => k !== "(empty)"))]).filter(([, fs]) => fs.length);
  if (vr.length) L.push("", "## Options seen on the old blocks", "", "Kept on each imported instance under _wp, for the design pass.", "", ...vr.map(([n, fs]) => `- ${n}: ${fs.map(([f, c]) => `${f} (${Object.entries(c).map(([k, x]) => `${k} ×${x}`).join(", ")})`).join("; ")}`));
  const uf = Object.entries(rep.unmappedFields);
  if (uf.length) L.push("", "## Fields with no destination", "", ...uf.map(([n, fs]) => `- ${n}: ${fs.join(", ")}`));
  L.push("", "## Pages", "");
  for (const p of rep.pages) {
    L.push(`### ${p.title} → ${p.route}${p.draft ? " (draft)" : ""}${p.classic ? " (classic HTML)" : ""}`);
    L.push(`${p.blocks} blocks${p.from && p.from !== p.route ? `, redirected from ${p.from}` : ""}`);
    for (const d of p.dropped) L.push(`- dropped block ${d}`);
    for (const l of p.lost) L.push(`- lost ${l.node}${l.text ? `: ${l.text}` : ""}`);
    L.push("");
  }
  if (rep.posts.lost.length) { L.push("## Posts: lost content", ""); for (const l of rep.posts.lost) L.push(`- ${l.where}: ${l.node}${l.text ? ` (${l.text})` : ""}`); L.push(""); }
  for (const [k, t] of Object.entries(rep.types)) if (t.lost.length) { L.push(`## ${k}: lost content`, ""); for (const l of t.lost) L.push(`- ${l.where}: ${l.node}${l.text ? ` (${l.text})` : ""}`); L.push(""); }
  const fsk = (rep.forms || []).filter((f) => f.skipped.length);
  if (fsk.length) { L.push("## Form fields the site can't take", ""); for (const f of fsk) for (const x of f.skipped) L.push(`- ${f.name}: ${x.label} (${x.type}${x.why ? `, ${x.why}` : ""})`); L.push(""); }
  if (rep.media.failed.length) { L.push("## Images that could not be fetched", ""); for (const f of rep.media.failed) L.push(`- ${f.url}: ${f.error}`); L.push(""); }
  return L.join("\n");
}

module.exports = { PAYLOAD_KIND, PAYLOAD_VERSION, MAPPING_VERSION, fetchPayload, validatePayload, inventory, inventoryMarkdown, definitionsForSkill, mappingSkeleton, validateMapping, classifyFields, convertForm, htmlToMarkdown, transform, reportMarkdown, slugify };
