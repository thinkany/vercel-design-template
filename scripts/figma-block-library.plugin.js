// ©2026 thinkany llc. All rights reserved.
//
// figma-block-library.plugin.js — the Figma Plugin API builder for the
// BLOCK-LIBRARY export (the "Block Library" page). NOT run by node; its body is
// embedded into a `use_figma` MCP call with MANIFEST + PHASE prepended, exactly
// like figma-component-library.plugin.js (atoms) and figma-brand-library.plugin.js.
//
// CONTRACT — the caller MUST define these two consts ABOVE this body:
//     const MANIFEST = { ...blocks-{id}.json... };  // from export-blocks-to-figma.mjs
//     const PHASE = "blocks";
//
// WHAT IT BUILDS
//   For each IMPLEMENTED block in the manifest, a real, editable Figma component
//   SET on the "Block Library" Page, one variant per `state` (e.g. a Header's
//   Desktop / Mobile / Mobile-open). Fills are BOUND to a "Brand" variable
//   collection (--ta-* colors), so editing a brand variable cascades to every
//   block, and editing a block master cascades to its instances.
//
//   Blocks are STRUCTURAL (not a data-driven variant matrix like atoms), so each
//   block has a dedicated build<Name>() function here. The manifest supplies the
//   data (colors, fonts, nav items, per-state width/padding). Add a block by
//   adding a row to src/app/blocks.ts AND a builder function below.
//
// IDEMPOTENT: Brand variables are find-by-name/update; each block's component set
//   is removed by name and rebuilt. Follows figma-use rules (colors 0–1, fonts
//   loaded before text writes, one setCurrentPageAsync per call, returns ids).

// ── shared helpers ────────────────────────────────────────────────────────────
async function getOrCreateCollection(name) {
  const cols = await figma.variables.getLocalVariableCollectionsAsync();
  let col = cols.find((c) => c.name === name);
  if (!col) col = figma.variables.createVariableCollection(name);
  const modeId = col.modes[0].modeId;
  col.renameMode(modeId, "Value");
  return { col, modeId };
}

// Role-based proxy faces when the project's real family isn't in Figma.
const ROLE_PROXY = { display: "Playfair Display", sans: "Inter" };

if (PHASE === "blocks") {
  // ── 1. Brand variable collection (find-by-name/update) ──────────────────────
  const { col, modeId } = await getOrCreateCollection(MANIFEST.brandCollectionName);
  const existing = (await figma.variables.getLocalVariablesAsync("COLOR")).filter((v) => v.variableCollectionId === col.id);
  const bv = {};
  const varResult = [];
  for (const c of MANIFEST.brandColors) {
    let v = existing.find((x) => x.name === c.name);
    const created = !v;
    if (!v) v = figma.variables.createVariable(c.name, col, "COLOR");
    v.setValueForMode(modeId, { r: c.rgb.r, g: c.rgb.g, b: c.rgb.b });
    v.scopes = ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL", "STROKE_COLOR"];
    v.setVariableCodeSyntax("WEB", `var(${c.token})`);
    bv[c.name] = v;
    varResult.push({ name: c.name, id: v.id, created });
  }
  const bfill = (name) => figma.variables.setBoundVariableForPaint({ type: "SOLID", color: { r: 0, g: 0, b: 0 } }, "color", bv[name]);
  const blackA = (a) => ({ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: a });

  // ── 2. Block Library page (find-by-name/create) ─────────────────────────────
  let page = figma.root.children.find((p) => p.name === MANIFEST.blockPageName);
  if (!page) { page = figma.createPage(); page.name = MANIFEST.blockPageName; }
  await figma.setCurrentPageAsync(page);
  for (const n of [...page.children]) if (n.name === "Cover") n.remove();

  // ── 3. Fonts: project family if Figma has it, else a role proxy ─────────────
  const avail = await figma.listAvailableFontsAsync();
  const hasFamily = (fam) => !!fam && avail.some((a) => a.fontName.family === fam);
  const resolveFamily = (role, wanted) => (hasFamily(wanted) ? wanted : (hasFamily(ROLE_PROXY[role]) ? ROLE_PROXY[role] : "Inter"));
  const displayFam = resolveFamily("display", MANIFEST.fonts.display.family);
  const sansFam = resolveFamily("sans", MANIFEST.fonts.sans.family);
  const displayFont = { family: displayFam, style: "Regular" };
  const sansFont = { family: sansFam, style: hasFamily(sansFam) && avail.some((a) => a.fontName.family === sansFam && a.fontName.style === "Medium") ? "Medium" : "Regular" };
  await figma.loadFontAsync(displayFont);
  await figma.loadFontAsync(sansFont);

  const ctx = { bfill, blackA, displayFont, sansFont, logoText: MANIFEST.logoText };

  // ── 4. Build each implemented block ─────────────────────────────────────────
  const builders = { header: buildHeader };
  const built = [];
  const skipped = [];
  for (const block of MANIFEST.blocks) {
    if (!block.implemented || !builders[block.id]) { skipped.push(block.name); continue; }
    // Idempotent: drop a prior set/component with this name.
    for (const n of [...page.children]) if (n.name === block.name && (n.type === "COMPONENT_SET" || n.type === "COMPONENT")) n.remove();
    const set = builders[block.id](block, ctx, page);
    built.push({ block: block.name, componentSetId: set.id, states: block.states.map((s) => s.name) });
  }

  // Lay the sets out down the page.
  let y = 80;
  for (const p of page.children.filter((n) => n.type === "COMPONENT_SET")) { p.x = 80; p.y = y; y += p.height + 64; }

  return { phase: "blocks", page: MANIFEST.blockPageName, brandCollection: MANIFEST.brandCollectionName, variables: varResult, built, skipped };
}

// ── Header block builder (Desktop / Mobile / Mobile-open state variants) ───────
function buildHeader(block, ctx, page) {
  const { bfill, blackA, displayFont, sansFont, logoText } = ctx;
  const navNames = block.navItems;

  const logo = () => { const t = figma.createText(); t.fontName = displayFont; t.characters = logoText; t.fontSize = 18; t.fills = [bfill("ink")]; return t; };
  const navText = (s) => { const t = figma.createText(); t.fontName = sansFont; t.characters = s.toUpperCase(); t.fontSize = 12; t.letterSpacing = { unit: "PIXELS", value: 1.2 }; t.fills = [bfill("gray-dark")]; return t; };
  const hamburger = () => { const h = figma.createAutoLayout("VERTICAL", { itemSpacing: 4 }); for (let i = 0; i < 3; i++) { const r = figma.createRectangle(); r.resize(20, 2); r.cornerRadius = 1; r.fills = [bfill("ink")]; h.appendChild(r); } return h; };
  const closeX = () => { const t = figma.createText(); t.fontName = sansFont; t.characters = "×"; t.fontSize = 26; t.fills = [bfill("ink")]; return t; };
  const divider = (w) => { const r = figma.createRectangle(); r.resize(w, 1); r.fills = [blackA(0.1)]; return r; };

  const stateByName = Object.fromEntries(block.states.map((s) => [s.name, s]));

  function buildState(stateName, rightEl, extraFn) {
    const s = stateByName[stateName];
    const c = figma.createComponent();
    c.name = `state=${stateName}`;
    c.layoutMode = "VERTICAL";
    c.fills = [bfill("cream")];
    c.resize(s.width, 10);
    const row = figma.createAutoLayout("HORIZONTAL");
    row.primaryAxisAlignItems = "SPACE_BETWEEN";
    row.counterAxisAlignItems = "CENTER";
    row.paddingLeft = row.paddingRight = s.padX;
    row.paddingTop = row.paddingBottom = 16;
    row.fills = [];
    c.appendChild(row); row.layoutSizingHorizontal = "FILL";
    row.appendChild(logo());
    row.appendChild(rightEl);
    if (extraFn) extraFn(c, s.width);
    else { const d = divider(s.width); c.appendChild(d); d.layoutSizingHorizontal = "FILL"; }
    c.primaryAxisSizingMode = "AUTO"; // hug height; width stays FIXED
    return c;
  }

  const nodes = [];

  if (stateByName["Desktop"]) {
    const deskNav = figma.createAutoLayout("HORIZONTAL", { itemSpacing: 32 });
    deskNav.counterAxisAlignItems = "CENTER";
    for (const n of navNames) deskNav.appendChild(navText(n));
    nodes.push(buildState("Desktop", deskNav));
  }
  if (stateByName["Mobile"]) nodes.push(buildState("Mobile", hamburger()));
  if (stateByName["Mobile-open"]) {
    nodes.push(buildState("Mobile-open", closeX(), (c, width) => {
      const topd = divider(width); c.appendChild(topd); topd.layoutSizingHorizontal = "FILL";
      const panel = figma.createAutoLayout("VERTICAL");
      panel.fills = [bfill("cream")];
      panel.effects = [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.12 }, offset: { x: 0, y: 6 }, radius: 16, spread: 0, visible: true, blendMode: "NORMAL" }];
      c.appendChild(panel); panel.layoutSizingHorizontal = "FILL";
      navNames.forEach((n, i) => {
        const item = figma.createAutoLayout("VERTICAL");
        item.fills = [];
        panel.appendChild(item); item.layoutSizingHorizontal = "FILL";
        if (i > 0) { const sep = divider(width); item.appendChild(sep); sep.layoutSizingHorizontal = "FILL"; }
        const inner = figma.createAutoLayout("HORIZONTAL");
        inner.paddingLeft = inner.paddingRight = 24; inner.paddingTop = inner.paddingBottom = 16;
        inner.fills = [];
        item.appendChild(inner); inner.layoutSizingHorizontal = "FILL";
        inner.appendChild(navText(n));
      });
      const botd = divider(width); c.appendChild(botd); botd.layoutSizingHorizontal = "FILL";
    }));
  }

  const set = figma.combineAsVariants(nodes, page);
  set.name = block.name;
  set.clipsContent = false;
  set.layoutMode = "VERTICAL";
  set.counterAxisAlignItems = "MIN";
  set.itemSpacing = 48;
  set.paddingLeft = set.paddingRight = set.paddingTop = set.paddingBottom = 48;
  set.cornerRadius = 12;
  set.fills = [{ type: "SOLID", color: { r: 0.97, g: 0.965, b: 0.955 } }];
  set.strokes = [{ type: "SOLID", color: { r: 0.886, g: 0.878, b: 0.855 } }];
  set.strokeWeight = 1;
  set.primaryAxisSizingMode = "AUTO";
  set.counterAxisSizingMode = "AUTO";
  return set;
}
