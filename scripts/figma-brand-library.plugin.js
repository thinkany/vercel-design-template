// ©2026 thinkany llc. All rights reserved.
//
// figma-brand-library.plugin.js — the Figma Plugin API builder for the brand
// styleguide-library export. This file is NOT run by node; its body is embedded
// into a `use_figma` MCP call (Claude reads it and prepends the two inputs).
//
// CONTRACT — the caller MUST define these two consts ABOVE this body:
//     const MANIFEST = { ...brand-{id}.json... };   // from export-brand-to-figma.mjs
//     const PHASE = "scaffold" | "variables" | "textstyles" | "specimen";
//
// Run the phases as SEQUENTIAL use_figma calls (never parallel — see
// figma-generate-library rule 13), in this order:
//     1. "scaffold"   → the Figma Pages panel: one Page per design page, a
//                       separator, the Styleguide Page, then scaffold sections.
//                       Returns each design page's Figma page id (the capture
//                       target — mint generate_figma_design(fileKey, pageId) so
//                       breakpoint frames land on that named Page).
//     2. "variables"  → the Brand color variable collection (file-global)
//     3. "textstyles" → the Type/* text styles (file-global)
//     4. "specimen"   → the swatch + type specimen frame, built ON the Styleguide
//                       Page (created/reused; other pages untouched).
//   (Design-page frames themselves are captured between 1 and 4 via the page
//    export — see CLAUDE.md "Exporting the brand to Figma".)
//
// IDEMPOTENT: every phase finds existing objects BY NAME and updates in place
// (never duplicates), so re-running after a token change is safe. The specimen
// frame + scaffold covers are deleted + rebuilt (generated artifacts). Follows
// the figma-use rules: colors 0–1, fonts loaded before text writes, explicit
// scopes, one setCurrentPageAsync per call, returns all affected ids.

// ── shared helpers ────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const h = String(hex).replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}
function solid(hex) { return { type: "SOLID", color: hexToRgb(hex) }; }

async function getOrCreateCollection(name) {
  const cols = await figma.variables.getLocalVariableCollectionsAsync();
  let col = cols.find((c) => c.name === name);
  if (!col) col = figma.variables.createVariableCollection(name);
  const modeId = col.modes[0].modeId;
  col.renameMode(modeId, "Value");
  return { col, modeId };
}

// ── PHASE 0: file scaffold (the Figma Pages panel) ────────────────────────────
if (PHASE === "scaffold") {
  const findPage = (name) => figma.root.children.find((p) => p.name === name);
  const desiredOrder = [
    ...MANIFEST.designPages.map((p) => p.name),
    MANIFEST.separatorName,
    MANIFEST.styleguidePageName,
    ...MANIFEST.scaffoldSections.map((s) => s.name),
  ];

  // Design pages — empty Pages the page-capture step fills with breakpoint frames.
  const anchors = {};
  for (const p of MANIFEST.designPages) {
    let pg = findPage(p.name);
    if (!pg) { pg = figma.createPage(); pg.name = p.name; }
    anchors[p.id] = { pageName: p.name, pageId: pg.id };
  }
  // Visual separator in the panel.
  if (!findPage(MANIFEST.separatorName)) { const sp = figma.createPage(); sp.name = MANIFEST.separatorName; }
  // Styleguide Page — the specimen phase builds onto it.
  if (!findPage(MANIFEST.styleguidePageName)) { const sg = figma.createPage(); sg.name = MANIFEST.styleguidePageName; }

  // Scaffold section Pages, each with a titled cover (rebuilt idempotently).
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  for (const s of MANIFEST.scaffoldSections) {
    let pg = findPage(s.name);
    if (!pg) { pg = figma.createPage(); pg.name = s.name; }
    await figma.setCurrentPageAsync(pg);
    for (const n of [...pg.children]) if (n.name === "Cover") n.remove();
    const cover = figma.createAutoLayout("VERTICAL", { name: "Cover", itemSpacing: 12 });
    cover.paddingLeft = cover.paddingRight = cover.paddingTop = cover.paddingBottom = 64;
    cover.counterAxisSizingMode = "FIXED"; cover.resize(900, 100); cover.primaryAxisSizingMode = "AUTO";
    cover.fills = [solid("#f8f7f3")]; cover.x = 0; cover.y = 0;
    const t1 = figma.createText(); t1.fontName = { family: "Inter", style: "Bold" }; t1.characters = s.name; t1.fontSize = 32; t1.fills = [solid("#111111")]; cover.appendChild(t1);
    const badge = figma.createText(); badge.fontName = { family: "Inter", style: "Bold" }; badge.characters = "SCAFFOLD"; badge.fontSize = 11; badge.letterSpacing = { unit: "PIXELS", value: 1.5 }; badge.fills = [solid("#90683C")]; cover.appendChild(badge);
    const t2 = figma.createText(); t2.fontName = { family: "Inter", style: "Regular" }; t2.characters = s.blurb; t2.fontSize = 15; t2.fills = [solid("#333333")]; cover.appendChild(t2); t2.layoutSizingHorizontal = "FILL"; t2.textAutoResize = "HEIGHT";
  }

  // Best-effort reorder to the desired panel order (safe: caught if unsupported).
  try {
    let idx = 0;
    for (const name of desiredOrder) {
      const pg = findPage(name);
      if (pg) { figma.root.insertChild(idx, pg); idx++; }
    }
  } catch (e) { /* reorder API unavailable — creation order stands */ }

  // Remove a leftover empty default page not in our structure (never the last).
  for (const p of [...figma.root.children]) {
    if (!desiredOrder.includes(p.name) && p.children.length === 0 && figma.root.children.length > 1) p.remove();
  }

  return { phase: "scaffold", anchors, pagesInOrder: figma.root.children.map((p) => p.name) };
}

// ── PHASE 1: color variables ──────────────────────────────────────────────────
if (PHASE === "variables") {
  const { col, modeId } = await getOrCreateCollection(MANIFEST.collectionName);
  const existing = await figma.variables.getLocalVariablesAsync("COLOR");
  const inCol = existing.filter((v) => v.variableCollectionId === col.id);
  const result = [];
  for (const c of MANIFEST.colors) {
    let v = inCol.find((x) => x.name === c.figmaName);
    const created = !v;
    if (!v) v = figma.variables.createVariable(c.figmaName, col, "COLOR");
    v.setValueForMode(modeId, hexToRgb(c.hex));
    v.scopes = c.scopes;
    v.description = c.role;
    v.setVariableCodeSyntax("WEB", `var(${c.token})`);
    result.push({ name: c.figmaName, id: v.id, created });
  }
  return { phase: "variables", collectionId: col.id, collectionName: col.name, variables: result };
}

// ── PHASE 2: type text styles ─────────────────────────────────────────────────
if (PHASE === "textstyles") {
  const available = await figma.listAvailableFontsAsync();
  const families = new Set(available.map((f) => f.fontName.family));
  const styles = await figma.getLocalTextStylesAsync();
  const result = [];
  for (const f of MANIFEST.fonts) {
    // Prefer the project's real family if Figma actually has it; else the proxy.
    let family = f.requestedFamily && families.has(f.requestedFamily) ? f.requestedFamily : f.proxyFamily;
    if (!families.has(family)) family = "Inter"; // last-resort fallback
    let style = f.style || "Regular";
    // Verify the exact style string exists for this family; fall back to Regular.
    const hasStyle = available.some((a) => a.fontName.family === family && a.fontName.style === style);
    if (!hasStyle) style = "Regular";
    await figma.loadFontAsync({ family, style });

    let ts = styles.find((s) => s.name === f.figmaName);
    const created = !ts;
    if (!ts) ts = figma.createTextStyle();
    ts.name = f.figmaName;
    ts.fontName = { family, style };
    ts.fontSize = f.size;
    ts.lineHeight = { unit: "PERCENT", value: Math.round((f.lineHeight || 1.4) * 100) };
    ts.description = `${f.role} — token ${f.token}${f.isProxy ? " (proxy font)" : ""}`;
    result.push({ name: f.figmaName, id: ts.id, resolvedFont: `${family} ${style}`, proxy: f.isProxy, created });
  }
  return { phase: "textstyles", textStyles: result };
}

// ── PHASE 3: specimen frame (delete + rebuild, ON the Styleguide Page) ─────────
if (PHASE === "specimen") {
  // Build on the dedicated Styleguide Page (create/reuse) so it lands in the
  // right place in a cohesive file — not on whatever page happens to be active.
  const sgName = MANIFEST.styleguidePageName || "Styleguide";
  let sgPage = figma.root.children.find((p) => p.name === sgName);
  if (!sgPage) { sgPage = figma.createPage(); sgPage.name = sgName; }
  await figma.setCurrentPageAsync(sgPage);

  // Re-resolve variables + styles by name (phases are independent).
  const { col } = await getOrCreateCollection(MANIFEST.collectionName);
  const allVars = (await figma.variables.getLocalVariablesAsync("COLOR"))
    .filter((v) => v.variableCollectionId === col.id);
  const varByName = Object.fromEntries(allVars.map((v) => [v.name, v]));
  const styles = await figma.getLocalTextStylesAsync();
  const styleByName = Object.fromEntries(styles.map((s) => [s.name, s]));

  // Handy lookups keyed by token, so we can bind label colors semantically.
  const varByToken = {};
  for (const c of MANIFEST.colors) if (varByName[c.figmaName]) varByToken[c.token] = varByName[c.figmaName];
  const pageBg = varByToken["--ta-cream"] || Object.values(varByName)[0];
  const inkVar = varByToken["--ta-ink"];
  const midVar = varByToken["--ta-gray-mid"];
  const darkVar = varByToken["--ta-gray-dark"];

  const boundFill = (v) => [figma.variables.setBoundVariableForPaint({ type: "SOLID", color: { r: 0, g: 0, b: 0 } }, "color", v)];
  // Fonts needed for labels (specimen chrome is always Inter + JetBrains Mono).
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  const hasJBM = (await figma.listAvailableFontsAsync()).some((a) => a.fontName.family === "JetBrains Mono");
  const monoFam = hasJBM ? "JetBrains Mono" : "Inter";
  await figma.loadFontAsync({ family: monoFam, style: "Regular" });

  function label(chars, style, size, colorVar, fallbackHex) {
    const t = figma.createText();
    t.fontName = { family: style === "mono" ? monoFam : "Inter", style: style === "bold" ? "Bold" : "Regular" };
    t.characters = chars;
    t.fontSize = size;
    t.fills = colorVar ? boundFill(colorVar) : [solid(fallbackHex || "#111111")];
    return t;
  }

  // Idempotent: delete any prior specimen frame with our name on this page.
  const removed = [];
  for (const n of figma.currentPage.children) {
    if (n.name === MANIFEST.specimenFrameName) { removed.push(n.id); n.remove(); }
  }

  // Root
  const root = figma.createAutoLayout("VERTICAL", { name: MANIFEST.specimenFrameName, itemSpacing: 44 });
  root.paddingLeft = root.paddingRight = root.paddingTop = root.paddingBottom = 64;
  root.counterAxisSizingMode = "FIXED";
  root.resize(1040, 100);
  root.primaryAxisSizingMode = "AUTO";
  root.fills = pageBg ? boundFill(pageBg) : [solid("#f8f7f3")];
  // Position clear of existing content.
  const rightEdge = figma.currentPage.children.reduce((mx, n) => Math.max(mx, n.x + n.width), 0);
  root.x = rightEdge + 120; root.y = 0;

  // Header
  const header = figma.createAutoLayout("VERTICAL", { name: "Header", itemSpacing: 10 });
  root.appendChild(header); header.layoutSizingHorizontal = "FILL";
  const title = label("Brand Library", "bold", 40, inkVar, "#111111");
  // Title wants the Display face if we have a text style for it.
  const displayStyle = styleByName[(MANIFEST.fonts.find((f) => /display/i.test(f.name)) || {}).figmaName];
  if (displayStyle) { await figma.loadFontAsync(displayStyle.fontName); title.fontName = displayStyle.fontName; title.fontSize = 40; }
  header.appendChild(title);
  const sub = label(`Design tokens for “${MANIFEST.variationId}”, exported from the project styleguide — colors as Figma variables, type as text styles.`, "regular", 15, darkVar, "#333333");
  header.appendChild(sub); sub.layoutSizingHorizontal = "FILL"; sub.textAutoResize = "HEIGHT";

  // Colors
  const colSec = figma.createAutoLayout("VERTICAL", { name: "Color", itemSpacing: 18 });
  root.appendChild(colSec); colSec.layoutSizingHorizontal = "FILL";
  const colLbl = label("COLOR", "bold", 12, midVar, "#777777"); colLbl.letterSpacing = { unit: "PIXELS", value: 1.5 };
  colSec.appendChild(colLbl);
  const grid = figma.createAutoLayout("HORIZONTAL", { name: "Swatches", itemSpacing: 16 });
  colSec.appendChild(grid); grid.layoutSizingHorizontal = "FILL"; grid.layoutWrap = "WRAP"; grid.counterAxisSpacing = 24;
  for (const c of MANIFEST.colors) {
    const v = varByName[c.figmaName];
    const card = figma.createAutoLayout("VERTICAL", { name: `Swatch/${c.name}`, itemSpacing: 10 });
    grid.appendChild(card); card.layoutSizingHorizontal = "FIXED"; card.resize(232, card.height); card.primaryAxisSizingMode = "AUTO";
    const rect = figma.createRectangle(); rect.resize(232, 92); rect.cornerRadius = 8;
    rect.fills = v ? boundFill(v) : [solid(c.hex)];
    rect.strokes = [solid("#e2e0da")]; rect.strokeWeight = 1;
    card.appendChild(rect); rect.layoutSizingHorizontal = "FILL";
    const info = figma.createAutoLayout("VERTICAL", { name: "Info", itemSpacing: 3 });
    card.appendChild(info); info.layoutSizingHorizontal = "FILL";
    info.appendChild(label(c.name, "bold", 14, inkVar, "#111111"));
    const tk = label(`${c.token} · ${c.hex.toUpperCase()}`, "mono", 11.5, midVar, "#777777");
    info.appendChild(tk); tk.layoutSizingHorizontal = "FILL"; tk.textAutoResize = "HEIGHT";
    const rl = label(c.role, "regular", 12, darkVar, "#333333");
    info.appendChild(rl); rl.layoutSizingHorizontal = "FILL"; rl.textAutoResize = "HEIGHT";
  }

  // Typography
  const typeSec = figma.createAutoLayout("VERTICAL", { name: "Typography", itemSpacing: 28 });
  root.appendChild(typeSec); typeSec.layoutSizingHorizontal = "FILL";
  const typeLbl = label("TYPE", "bold", 12, midVar, "#777777"); typeLbl.letterSpacing = { unit: "PIXELS", value: 1.5 };
  typeSec.appendChild(typeLbl);
  for (const f of MANIFEST.fonts) {
    const ts = styleByName[f.figmaName];
    const block = figma.createAutoLayout("VERTICAL", { name: `Specimen/${f.name}`, itemSpacing: 8 });
    typeSec.appendChild(block); block.layoutSizingHorizontal = "FILL";
    const meta = figma.createAutoLayout("HORIZONTAL", { name: "Meta", itemSpacing: 10 });
    block.appendChild(meta); meta.counterAxisAlignItems = "CENTER";
    meta.appendChild(label(f.name, "bold", 13, inkVar, "#111111"));
    const fam = ts ? ts.fontName.family : (f.requestedFamily || f.proxyFamily);
    meta.appendChild(label(`${fam}${f.isProxy ? " (proxy)" : ""} · ${f.token}`, "mono", 11.5, midVar, "#777777"));
    // Sample — apply the text style if we have one, else render in the resolved face.
    const sample = figma.createText();
    if (ts) { await figma.loadFontAsync(ts.fontName); sample.fontName = ts.fontName; }
    else { sample.fontName = { family: "Inter", style: "Regular" }; }
    sample.characters = f.sample;
    sample.fontSize = 24;
    sample.fills = inkVar ? boundFill(inkVar) : [solid("#111111")];
    block.appendChild(sample);
    if (ts) await sample.setTextStyleIdAsync(ts.id);
    sample.layoutSizingHorizontal = "FILL"; sample.textAutoResize = "HEIGHT";
  }

  return { phase: "specimen", frameId: root.id, removedPriorFrames: removed, colors: MANIFEST.colors.length, fonts: MANIFEST.fonts.length };
}

throw new Error(`Unknown PHASE "${PHASE}" — expected "variables" | "textstyles" | "specimen"`);
