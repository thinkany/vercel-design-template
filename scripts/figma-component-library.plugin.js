// ©2026 thinkany llc. All rights reserved.
//
// figma-component-library.plugin.js — the Figma Plugin API builder for the
// COMPONENT-LIBRARY export (the "Components" page). This file is NOT run by node;
// its body is embedded into a `use_figma` MCP call (Claude reads it and prepends
// the two inputs), exactly like scripts/figma-brand-library.plugin.js.
//
// CONTRACT — the caller MUST define these two consts ABOVE this body:
//     const MANIFEST = { ...library-{id}.json... };  // from export-library-to-figma.mjs
//     const PHASE = "components";
//
// WHAT IT BUILDS
//   Real Figma **component sets** on the "Components" Page, fills/text/strokes
//   BOUND to a "System" variable collection (shadcn primitives) — two cascade
//   levels: edit the master → instances update; edit a variable → every binder
//   updates. The manifest carries ONLY the components this design uses (the usage
//   scan in export-library-to-figma.mjs), so the page mirrors the design — not a
//   fixed default set. Component kinds, dispatched by the manifest's `builder`:
//   - ATOM (Button/Badge/Toggle): a variant matrix, single label/icon child (buildAtomSet).
//   - FIELD (Input): a fixed-width field, left-aligned placeholder, one variant per
//     interaction state (buildFieldSet).
//   - SLOTTED: a fixed multi-child structure — Alert (icon | title+description),
//     Switch (track+thumb), Checkbox (box+✓), Card (title+description). One
//     builder each (buildAlert/Switch/Checkbox/CardSet).
//   Variant properties are parsed from each child's `prop=value, …` name via
//   figma.combineAsVariants.
//
// IDEMPOTENT: the System variables are find-by-name/update. Component sets are
//   generated artifacts — deleted by name + rebuilt each run (this DETACHES any
//   existing instances; acceptable for a library page you don't hand-edit). A
//   PRUNE pass also removes any known-catalog set the design no longer uses, so a
//   usage-driven re-export leaves no stale components behind.
// Follows the figma-use rules: colors 0–1, fonts loaded before text writes,
//   one setCurrentPageAsync per call, returns all affected ids.

// ── shared helpers ────────────────────────────────────────────────────────────
function rgb(c) { return { r: c.r, g: c.g, b: c.b }; }
function solid(c, opacity) { return { type: "SOLID", color: rgb(c), opacity: opacity == null ? 1 : opacity }; }

// Frame a finished component set into the tidy grid on the page. `wrap` lets an
// atom set (many variants) reflow; slotted sets (few, wide) sit in one row.
function styleComponentSet(set, name, wrap) {
  set.name = name;
  set.clipsContent = false;
  set.layoutMode = "HORIZONTAL";
  set.layoutWrap = wrap ? "WRAP" : "NO_WRAP";
  set.counterAxisAlignItems = wrap ? "CENTER" : "MIN";
  set.itemSpacing = 24;
  set.counterAxisSpacing = 24;
  set.paddingLeft = set.paddingRight = set.paddingTop = set.paddingBottom = 40;
  set.cornerRadius = 12;
  set.fills = [solid({ r: 0.973, g: 0.969, b: 0.953 }, 1)]; // #f8f7f3 wash
  set.strokes = [solid({ r: 0.886, g: 0.878, b: 0.855 }, 1)];
  set.strokeWeight = 1;
  set.resize(1040, Math.max(set.height, 1)); // fixed width; hug height (modes AFTER resize)
  set.primaryAxisSizingMode = "FIXED";
  set.counterAxisSizingMode = "AUTO";
  return set;
}

async function getOrCreateCollection(name) {
  const cols = await figma.variables.getLocalVariableCollectionsAsync();
  let col = cols.find((c) => c.name === name);
  if (!col) col = figma.variables.createVariableCollection(name);
  const modeId = col.modes[0].modeId;
  col.renameMode(modeId, "Value");
  return { col, modeId };
}

if (PHASE === "components") {
  // ── 1. System variable collection (find-by-name/update) ─────────────────────
  const { col, modeId } = await getOrCreateCollection(MANIFEST.collectionName);
  const existingVars = (await figma.variables.getLocalVariablesAsync("COLOR"))
    .filter((v) => v.variableCollectionId === col.id);
  const varByName = {};
  const varResult = [];
  // Union of every variable any component needs.
  const allVars = new Map();
  for (const comp of MANIFEST.components) for (const v of comp.variables) allVars.set(v.figmaName, v);
  for (const v of allVars.values()) {
    let variable = existingVars.find((x) => x.name === v.figmaName);
    const created = !variable;
    if (!variable) variable = figma.variables.createVariable(v.figmaName, col, "COLOR");
    variable.setValueForMode(modeId, rgb(v.rgb));
    variable.scopes = ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL", "STROKE_COLOR"];
    variable.setVariableCodeSyntax("WEB", `var(${v.token})`);
    varByName[v.figmaName] = variable;
    varResult.push({ name: v.figmaName, id: variable.id, created });
  }

  // A paint from a manifest paint-ref: variable-bound when kind==="var", a solid
  // (with alpha) for literals, nothing for "none".
  function paintFor(ref) {
    if (!ref || ref.kind === "none") return null;
    const alpha = ref.a == null ? 1 : ref.a;
    // Fully transparent token (e.g. --input: transparent) → no paint. A bound
    // variable can't carry alpha (variables store RGB only) and
    // setBoundVariableForPaint forces the paint opaque, so binding it would render
    // solid black; the faithful result is simply no stroke/fill.
    if (alpha === 0) return null;
    if (ref.kind === "var" && varByName[ref.figmaName]) {
      const base = { type: "SOLID", color: rgb(ref.rgb), opacity: alpha };
      return figma.variables.setBoundVariableForPaint(base, "color", varByName[ref.figmaName]);
    }
    return solid(ref.rgb, alpha);
  }

  // ── 2. Components page (find-by-name/create) ────────────────────────────────
  const pageName = MANIFEST.componentsPageName || "Components";
  let page = figma.root.children.find((p) => p.name === pageName);
  if (!page) { page = figma.createPage(); page.name = pageName; }
  await figma.setCurrentPageAsync(page);

  // Remove the scaffold "Cover" (this page graduates from scaffold to real).
  for (const n of [...page.children]) if (n.name === "Cover") n.remove();

  // ── 3. Fonts (Inter Medium for labels/titles, Regular for descriptions) ─────
  const available = await figma.listAvailableFontsAsync();
  const hasInterMedium = available.some((a) => a.fontName.family === "Inter" && a.fontName.style === "Medium");
  const labelFont = hasInterMedium ? { family: "Inter", style: "Medium" } : { family: "Inter", style: "Regular" };
  const regularFont = { family: "Inter", style: "Regular" };
  await figma.loadFontAsync(labelFont);
  await figma.loadFontAsync(regularFont);

  // Position a finished set clear of existing content on the page.
  function placeSet(set) {
    const rightEdge = page.children.reduce((mx, n) => (n.id === set.id ? mx : Math.max(mx, n.x + n.width)), 0);
    set.x = rightEdge + 120; set.y = 0;
  }

  // ATOM set — variant matrix, a single label/icon child per variant.
  function buildAtomSet(comp) {
    const nodes = [];
    for (const v of comp.variants) {
      const node = figma.createComponent();
      node.name = v.name; // "variant=…, size=…" → parsed by combineAsVariants
      node.layoutMode = "HORIZONTAL";
      node.primaryAxisAlignItems = "CENTER";
      node.counterAxisAlignItems = "CENTER";
      node.itemSpacing = v.gap;
      node.paddingLeft = node.paddingRight = v.paddingX;
      node.paddingTop = node.paddingBottom = 0;
      node.cornerRadius = v.radius;

      const fill = paintFor(v.fill);
      node.fills = fill ? [fill] : [];
      const stroke = paintFor(v.border);
      if (stroke) { node.strokes = [stroke]; node.strokeWeight = 1; } else { node.strokes = []; }

      // Child FIRST (so the auto-layout parent can hug it), then size.
      if (v.iconOnly) {
        const box = figma.createRectangle();
        box.resize(16, 16); box.cornerRadius = 3;
        const t = paintFor(v.text);
        box.fills = t ? [t] : [solid({ r: 0, g: 0, b: 0 }, 1)];
        node.appendChild(box);
      } else {
        const label = figma.createText();
        label.fontName = labelFont;
        label.characters = comp.label;
        label.fontSize = v.fontSize;
        label.lineHeight = { unit: "AUTO" };
        const t = paintFor(v.text);
        label.fills = t ? [t] : [solid({ r: 0, g: 0, b: 0 }, 1)];
        if (v.underline) label.textDecoration = "UNDERLINE";
        node.appendChild(label);
      }

      // Size LAST: resize() resets sizing modes to FIXED, so set modes AFTER it.
      node.resize(v.iconOnly ? (v.width || v.height) : Math.max(v.height, 1), v.height);
      node.counterAxisSizingMode = "FIXED";
      node.primaryAxisSizingMode = v.iconOnly ? "FIXED" : "AUTO";
      nodes.push(node);
    }
    return styleComponentSet(figma.combineAsVariants(nodes, page), comp.name, true);
  }

  // SLOTTED set — Alert: [ icon | (title + description) ] per variant.
  function buildAlertSet(comp) {
    const g = comp.geometry;
    const nodes = [];
    for (const v of comp.variants) {
      const c = figma.createComponent();
      c.name = v.name;
      c.layoutMode = "HORIZONTAL";
      c.counterAxisAlignItems = "MIN"; // items-start (icon aligns to title top)
      c.itemSpacing = g.gap;
      c.paddingLeft = c.paddingRight = g.padX;
      c.paddingTop = c.paddingBottom = g.padY;
      c.cornerRadius = g.radius;
      const bg = paintFor(v.bg); c.fills = bg ? [bg] : [];
      const bd = paintFor(v.border); if (bd) { c.strokes = [bd]; c.strokeWeight = 1; } else { c.strokes = []; }
      // Width fixed FIRST so the content column can FILL the remaining space.
      c.resize(g.width, 10);
      c.primaryAxisSizingMode = "FIXED";

      const icon = figma.createRectangle();
      icon.resize(g.iconSize, g.iconSize); icon.cornerRadius = 2;
      const ic = paintFor(v.icon); icon.fills = ic ? [ic] : [solid({ r: 0, g: 0, b: 0 }, 1)];
      c.appendChild(icon);

      const content = figma.createAutoLayout("VERTICAL", { itemSpacing: g.contentGap });
      content.fills = [];
      c.appendChild(content); content.layoutSizingHorizontal = "FILL";

      const title = figma.createText();
      title.fontName = labelFont; title.characters = comp.content.title; title.fontSize = g.titleSize;
      title.letterSpacing = { unit: "PERCENT", value: -2.5 };
      const tp = paintFor(v.title); title.fills = tp ? [tp] : [solid({ r: 0, g: 0, b: 0 }, 1)];
      content.appendChild(title); title.layoutSizingHorizontal = "FILL"; title.textAutoResize = "HEIGHT";

      const desc = figma.createText();
      desc.fontName = regularFont; desc.characters = comp.content.description; desc.fontSize = g.descSize;
      desc.lineHeight = { unit: "PERCENT", value: 145 };
      const dp = paintFor(v.desc); desc.fills = dp ? [dp] : [solid({ r: 0, g: 0, b: 0 }, 1)];
      content.appendChild(desc); desc.layoutSizingHorizontal = "FILL"; desc.textAutoResize = "HEIGHT";

      c.counterAxisSizingMode = "AUTO"; // hug height (width stays FIXED)
      nodes.push(c);
    }
    return styleComponentSet(figma.combineAsVariants(nodes, page), comp.name, false);
  }

  // FIELD set — Input: a fixed-width field with a LEFT-aligned placeholder, one
  // variant per interaction state (default/focus/invalid/disabled). Disabled dims
  // via node.opacity (carried on the manifest variant).
  function buildFieldSet(comp) {
    const nodes = [];
    for (const v of comp.variants) {
      const node = figma.createComponent();
      node.name = v.name;
      node.layoutMode = "HORIZONTAL";
      node.primaryAxisAlignItems = "MIN";   // placeholder hugs the left
      node.counterAxisAlignItems = "CENTER";
      node.paddingLeft = node.paddingRight = v.paddingX;
      node.paddingTop = node.paddingBottom = 0;
      node.cornerRadius = v.radius;
      const fill = paintFor(v.fill); node.fills = fill ? [fill] : [];
      const stroke = paintFor(v.border);
      if (stroke) { node.strokes = [stroke]; node.strokeWeight = 1; } else { node.strokes = []; }

      const label = figma.createText();
      label.fontName = regularFont;
      label.characters = comp.placeholder || "Placeholder";
      label.fontSize = v.fontSize;
      label.lineHeight = { unit: "AUTO" };
      const t = paintFor(v.text); label.fills = t ? [t] : [solid({ r: 0, g: 0, b: 0 }, 1)];
      node.appendChild(label);

      node.resize(v.width || 260, v.height);
      node.primaryAxisSizingMode = "FIXED";
      node.counterAxisSizingMode = "FIXED";
      label.layoutSizingHorizontal = "FILL";
      label.textAutoResize = "HEIGHT";
      if (v.opacity != null && v.opacity < 1) node.opacity = v.opacity;
      nodes.push(node);
    }
    return styleComponentSet(figma.combineAsVariants(nodes, page), comp.name, true);
  }

  // SWITCH set — a rounded track with an absolutely-positioned thumb; the thumb
  // sits left (off) or right (on). No auto-layout (free thumb placement).
  function buildSwitchSet(comp) {
    const g = comp.geometry;
    const nodes = [];
    for (const v of comp.variants) {
      const c = figma.createComponent();
      c.name = v.name;
      c.clipsContent = false;
      c.resize(g.trackW, g.trackH);
      c.cornerRadius = g.trackH / 2;
      const track = paintFor(v.track); c.fills = track ? [track] : [];
      c.strokes = [];
      const thumb = figma.createEllipse();
      thumb.resize(g.thumb, g.thumb);
      const tp = paintFor(v.thumb); thumb.fills = tp ? [tp] : [solid({ r: 1, g: 1, b: 1 }, 1)];
      c.appendChild(thumb);
      const on = Object.values(v.props)[0] === "on";
      thumb.x = on ? g.trackW - g.thumb - g.pad : g.pad;
      thumb.y = (g.trackH - g.thumb) / 2;
      nodes.push(c);
    }
    return styleComponentSet(figma.combineAsVariants(nodes, page), comp.name, false);
  }

  // CHECKBOX set — a small rounded box; checked adds a ✓ glyph and swaps fill.
  function buildCheckboxSet(comp) {
    const g = comp.geometry;
    const nodes = [];
    for (const v of comp.variants) {
      const c = figma.createComponent();
      c.name = v.name;
      c.layoutMode = "HORIZONTAL";
      c.primaryAxisAlignItems = "CENTER";
      c.counterAxisAlignItems = "CENTER";
      c.cornerRadius = g.radius;
      const box = paintFor(v.box); c.fills = box ? [box] : [];
      const bd = paintFor(v.border); if (bd) { c.strokes = [bd]; c.strokeWeight = 1; } else { c.strokes = []; }
      const mark = paintFor(v.mark);
      if (mark) {
        const glyph = figma.createText();
        glyph.fontName = labelFont;
        glyph.characters = "✓"; // ✓
        glyph.fontSize = g.size - 4;
        glyph.fills = [mark];
        c.appendChild(glyph);
      }
      c.resize(g.size, g.size);
      c.primaryAxisSizingMode = "FIXED";
      c.counterAxisSizingMode = "FIXED";
      nodes.push(c);
    }
    return styleComponentSet(figma.combineAsVariants(nodes, page), comp.name, false);
  }

  // CARD set — a compositional container specimen: title + description in a padded,
  // bordered, rounded frame. Single "variant=default".
  function buildCardSet(comp) {
    const g = comp.geometry;
    const nodes = [];
    for (const v of comp.variants) {
      const c = figma.createComponent();
      c.name = v.name;
      c.layoutMode = "VERTICAL";
      c.itemSpacing = g.contentGap != null ? g.contentGap : g.gap;
      c.paddingLeft = c.paddingRight = c.paddingTop = c.paddingBottom = g.pad;
      c.cornerRadius = g.radius;
      const bg = paintFor(v.bg); c.fills = bg ? [bg] : [];
      const bd = paintFor(v.border); if (bd) { c.strokes = [bd]; c.strokeWeight = 1; } else { c.strokes = []; }
      c.resize(g.width, 10);
      c.counterAxisSizingMode = "FIXED"; // fixed width (counter axis of a vertical stack)

      const title = figma.createText();
      title.fontName = labelFont; title.characters = comp.content.title; title.fontSize = g.titleSize;
      title.letterSpacing = { unit: "PERCENT", value: -2.5 };
      const tp = paintFor(v.title); title.fills = tp ? [tp] : [solid({ r: 0, g: 0, b: 0 }, 1)];
      c.appendChild(title); title.layoutSizingHorizontal = "FILL"; title.textAutoResize = "HEIGHT";

      const desc = figma.createText();
      desc.fontName = regularFont; desc.characters = comp.content.description; desc.fontSize = g.descSize;
      desc.lineHeight = { unit: "PERCENT", value: 145 };
      const dp = paintFor(v.desc); desc.fills = dp ? [dp] : [solid({ r: 0, g: 0, b: 0 }, 1)];
      c.appendChild(desc); desc.layoutSizingHorizontal = "FILL"; desc.textAutoResize = "HEIGHT";

      c.primaryAxisSizingMode = "AUTO"; // hug height
      nodes.push(c);
    }
    return styleComponentSet(figma.combineAsVariants(nodes, page), comp.name, false);
  }

  // Dispatch a component spec to its builder by `builder` kind.
  const BUILDERS = {
    alert: buildAlertSet, field: buildFieldSet, switch: buildSwitchSet,
    checkbox: buildCheckboxSet, card: buildCardSet,
  };
  function buildSet(comp) { return (BUILDERS[comp.builder] || buildAtomSet)(comp); }

  // Usage-driven prune: the export mirrors what the design actually uses, so any
  // KNOWN catalog component still on the page but absent from this manifest (the
  // design stopped importing it — or uses none at all) is stale. Drop it. Only
  // touches catalog-owned names, so hand-added content on the page is left alone.
  const currentNames = new Set(MANIFEST.components.map((c) => c.name));
  const catalogNames = new Set(MANIFEST.catalogComponentNames || []);
  const pruned = [];
  for (const n of [...page.children]) {
    if ((n.type === "COMPONENT_SET" || n.type === "COMPONENT") && catalogNames.has(n.name) && !currentNames.has(n.name)) {
      pruned.push({ name: n.name, id: n.id }); n.remove();
    }
  }

  const built = [];
  for (const comp of MANIFEST.components) {
    // Idempotent: drop a prior set (or stray components) with this name.
    const removed = [];
    for (const n of [...page.children]) {
      if (n.name === comp.name && (n.type === "COMPONENT_SET" || n.type === "COMPONENT")) { removed.push(n.id); n.remove(); }
    }
    const set = buildSet(comp);
    placeSet(set);
    built.push({ component: comp.name, componentSetId: set.id, variants: comp.variants.length, removedPrior: removed });
  }

  return {
    phase: "components",
    page: pageName,
    collectionName: MANIFEST.collectionName,
    selectionMode: MANIFEST.selectionMode,
    variables: varResult,
    components: built,
    prunedStale: pruned, // catalog sets removed because the design no longer uses them
  };
}

throw new Error(`Unknown PHASE "${PHASE}" — expected "components"`);
