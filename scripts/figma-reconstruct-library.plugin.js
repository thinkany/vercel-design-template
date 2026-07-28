// ©2026 thinkany llc. All rights reserved.
//
// figma-reconstruct-library.plugin.js — the Figma Plugin API builder for the
// RECONSTRUCT block export (replaces figma-block-library.plugin.js's capture-based
// `blocks` phase). NOT run by node; its body is embedded into a `use_figma` call
// with MANIFEST + PHASE prepended, like the other library builders.
//
// CONTRACT — define these ABOVE this body:
//     const MANIFEST = { ...reconstruct-{id}.json (or a per-block slice) ... };
//     const PHASE = "reconstruct" | "compose";
//
// RECONSTRUCT MODEL (derive-everything, NO html.to.design)
//   The extractor (export-reconstruct-to-figma.mjs) walked each [data-block] at
//   each breakpoint into a uniform ordered node spec (box/text/svg). THIS builder
//   turns each spec into REAL Figma nodes:
//     • flex row/column → auto-layout; grid → horizontal wrap; block-flow +
//       absolute overlays → absolute (measured x/y, layoutPositioning ABSOLUTE)
//     • text runs → real text (font resolved to the project family, else a role
//       proxy); svg → real vectors (recolored); gradients → GRADIENT_LINEAR
//     • image fills → a placeholder rect whose { nodeId, asset } is RETURNED so the
//       caller sets the real photo via upload_assets(nodeId)
//     • a childless semi-transparent SOLID (an overlay wash) puts its alpha on NODE
//       opacity — paint opacity is stripped by setBoundVariableForPaint + instancing
//   Then per block it BINDS fills to the Brand collection (opacity-preserving) and
//   COMPONENTIZES each breakpoint into a `View=…` COMPONENT_SET. `compose` (below,
//   unchanged from the block builder) instances those onto the design Pages.
//
// IDEMPOTENT: Brand vars find-by-name (bind canonical var(--ta-*) from the brand
//   `variables` phase when present). Each block's set is removed by name + rebuilt;
//   stale sets not in the manifest are pruned. Follows figma-use rules.

// ── shared helpers ────────────────────────────────────────────────────────────
async function getOrCreateCollection(name) {
  const cols = await figma.variables.getLocalVariableCollectionsAsync();
  let col = cols.find((c) => c.name === name);
  if (!col) col = figma.variables.createVariableCollection(name);
  const modeId = col.modes[0].modeId;
  col.renameMode(modeId, "Value");
  return { col, modeId };
}
const ROLE_PROXY = { display: "Playfair Display", serif: "Lora", sans: "Inter", mono: "JetBrains Mono" };
const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

function styleSet(node, name) {
  node.name = name;
  node.clipsContent = false;
  if (node.type === "COMPONENT_SET") {
    node.layoutMode = "VERTICAL";
    node.counterAxisAlignItems = "MIN";
    node.itemSpacing = 48;
    node.paddingLeft = node.paddingRight = node.paddingTop = node.paddingBottom = 48;
    node.cornerRadius = 12;
    node.fills = [{ type: "SOLID", color: { r: 0.97, g: 0.965, b: 0.955 } }];
    node.strokes = [{ type: "SOLID", color: { r: 0.886, g: 0.878, b: 0.855 } }];
    node.strokeWeight = 1;
    node.primaryAxisSizingMode = "AUTO";
    node.counterAxisSizingMode = "AUTO";
  }
  return node;
}

if (PHASE === "reconstruct") {
  // ── 1. Brand collection + variables (bind canonical when present) ───────────
  const { col, modeId } = await getOrCreateCollection(MANIFEST.brandCollectionName);
  const existing = (await figma.variables.getLocalVariablesAsync("COLOR")).filter((v) => v.variableCollectionId === col.id);
  const codeMatch = (x, token) => { try { return x.codeSyntax && x.codeSyntax.WEB === `var(${token})`; } catch { return false; } };
  const brandVars = []; const varResult = [];
  for (const c of MANIFEST.brandColors) {
    const canonical = existing.find((x) => codeMatch(x, c.token) && x.name !== c.name);
    let v = canonical || existing.find((x) => x.name === c.name);
    const created = !v;
    if (!canonical) {
      if (!v) v = figma.variables.createVariable(c.name, col, "COLOR");
      v.setValueForMode(modeId, { r: c.rgb.r, g: c.rgb.g, b: c.rgb.b });
      v.scopes = ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL", "STROKE_COLOR"];
      v.setVariableCodeSyntax("WEB", `var(${c.token})`);
    }
    brandVars.push({ name: c.name, token: c.token, rgb: c.rgb, variable: v });
    varResult.push({ name: v.name, id: v.id, created, boundCanonical: !!canonical });
  }
  const TOL = 0.02;
  const nearestVar = (color) => { let best = null, bd = 1e9; for (const b of brandVars) { const d = Math.abs(color.r - b.rgb.r) + Math.abs(color.g - b.rgb.g) + Math.abs(color.b - b.rgb.b); if (d < bd) { bd = d; best = b; } } return bd < TOL ? best : null; };
  let boundCount = 0;
  // Bind only FULLY-OPAQUE solids to Brand variables. A variable-bound SOLID paint
  // reverts its opacity to 1 when the component is INSTANCED (a Figma limitation), so
  // binding a semi-transparent wash — a `bg-white/5` glass card or `bg-white/10` chip
  // that has CHILDREN — turns the surface solid at instance time and buries its content
  // (this was the Contact cards going solid white). Leaving sub-1-alpha fills as RAW,
  // unbound paints preserves their opacity through instancing; a wash isn't a brand token
  // anyway. Childless overlay washes are handled separately (their alpha rides on
  // node.opacity with an opaque paint — see overlayAlpha — so they arrive here opacity-1
  // and still bind).
  const bindPaints = (node, key) => {
    const arr = node[key];
    if (!Array.isArray(arr) || !arr.length) return;
    let changed = false;
    const next = arr.map((p) => { if (p.type !== "SOLID") return p; if (p.opacity != null && p.opacity < 1) return p; const m = nearestVar(p.color); if (!m) return p; changed = true; boundCount++; const bp = figma.variables.setBoundVariableForPaint(p, "color", m.variable); return { ...bp, opacity: 1 }; });
    if (changed) node[key] = next;
  };

  // ── 2. Block Library page ───────────────────────────────────────────────────
  let page = figma.root.children.find((p) => p.name === MANIFEST.blockPageName);
  if (!page) { page = figma.createPage(); page.name = MANIFEST.blockPageName; }
  await figma.setCurrentPageAsync(page);
  for (const n of [...page.children]) if (n.name === "Cover") n.remove();

  // ── 3. Fonts: project family when installed, else role proxy ────────────────
  const avail = await figma.listAvailableFontsAsync();
  const famStyles = {};
  for (const a of avail) { (famStyles[a.fontName.family] = famStyles[a.fontName.family] || new Set()).add(a.fontName.style); }
  const hasFam = (f) => !!famStyles[f];
  const F = MANIFEST.fonts || {};
  const familyRole = {};
  for (const role of ["display", "serif", "sans", "mono"]) if (F[role] && F[role].family) familyRole[F[role].family] = role;
  const roleFromFamily = (fam) => { if (familyRole[fam]) return familyRole[fam]; const f = (fam || "").toLowerCase(); if (/mono|courier|consol/.test(f)) return "mono"; if (/times|georgia|serif|garamond|playfair|lora|merri|book|fraunces/.test(f)) return "serif"; return "sans"; };
  const styleForWeight = (fam, w) => { const styles = famStyles[fam] || new Set(); const names = { 300: ["Light"], 400: ["Regular"], 500: ["Medium"], 600: ["SemiBold", "Semi Bold", "DemiBold"], 700: ["Bold"], 800: ["ExtraBold", "Extra Bold"] }; for (const cand of (names[w] || ["Regular"])) if (styles.has(cand)) return cand; return styles.has("Regular") ? "Regular" : [...styles][0]; };
  const proxies = new Set();
  const resolveFont = (fam, w) => {
    let useFam = fam;
    if (!hasFam(fam)) { const proxy = ROLE_PROXY[roleFromFamily(fam)]; useFam = hasFam(proxy) ? proxy : (hasFam("Inter") ? "Inter" : (avail[0] && avail[0].fontName.family)); proxies.add(fam); }
    return { family: useFam, style: styleForWeight(useFam, w) };
  };

  // ── 4. spec → nodes (see RECONSTRUCT MODEL). Collects photo rects per view. ──
  const solid = (c) => ({ type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: c.a == null ? 1 : c.a });
  const gradT = (deg) => { const a = (deg - 90) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [[c, s, (1 - c - s) / 2], [-s, c, (1 + s - c) / 2]]; };
  const paintFor = (f) => { if (f.type === "solid") return solid(f.color); if (f.type === "gradient") return { type: "GRADIENT_LINEAR", gradientTransform: gradT(f.angle), gradientStops: f.stops.map((st) => ({ position: Math.max(0, Math.min(1, st.pos)), color: { r: st.color.r, g: st.color.g, b: st.color.b, a: st.color.a == null ? 1 : st.color.a } })) }; return null; };
  const JUST = { "flex-start": "MIN", "start": "MIN", "normal": "MIN", "left": "MIN", "center": "CENTER", "flex-end": "MAX", "end": "MAX", "right": "MAX", "space-between": "SPACE_BETWEEN", "space-around": "SPACE_BETWEEN", "space-evenly": "SPACE_BETWEEN" };
  const ALIGN = { "flex-start": "MIN", "start": "MIN", "normal": "MIN", "baseline": "MIN", "center": "CENTER", "flex-end": "MAX", "end": "MAX", "stretch": "MIN" };
  // Shrunk specs OMIT kind on boxes (default). A node is a box iff not text/svg.
  const isBox = (n) => n.kind !== "text" && n.kind !== "svg";
  const isAutoNode = (n) => isBox(n) && n.layout && (n.layout.mode === "row" || n.layout.mode === "column" || n.layout.mode === "grid");
  const overlayAlpha = (n) => (isBox(n) && (!n.children || !n.children.length) && (n.fills || []).length === 1 && n.fills[0].type === "solid" && n.fills[0].color.a != null && n.fills[0].color.a < 1) ? n.fills[0].color.a : null;
  // Grid analysis from MEASURED geometry (not the ambiguous CSS `gap`, whose 2-value
  // `row col` form and sub-pixel rounding mis-drove the old wrap). Classifies a grid as
  // uniform "cards" (→ wrap auto-layout with the real col/row gaps) vs "positional" (→
  // absolute placement from x/y, e.g. a header's nav|logo|actions column track that a
  // 1-D flow can't reproduce), and derives the true gaps from sibling positions.
  const median = (arr, fb) => arr.length ? arr.slice().sort((a, b) => a - b)[arr.length >> 1] : fb;
  const gridInfo = (node) => {
    const fl = (node.children || []).filter((c) => isBox(c) && c.position !== "absolute" && (c.w || 0) > 0);
    if (fl.length < 2) return { kind: "positional", colGap: 0, rowGap: 0, flowN: fl.length };
    const ws = fl.map((c) => c.w).sort((a, b) => a - b);
    const uniform = (ws[ws.length - 1] - ws[0]) <= Math.max(2, 0.1 * ws[ws.length >> 1]);
    if (!uniform) return { kind: "positional", colGap: 0, rowGap: 0, flowN: fl.length };
    const rows = [];
    for (const c of fl.slice().sort((a, b) => a.y - b.y || a.x - b.x)) {
      const r = rows.find((r) => Math.abs(r.y - c.y) <= Math.max(4, c.h * 0.4));
      if (r) r.items.push(c); else rows.push({ y: c.y, items: [c] });
    }
    const colGaps = [], rowGaps = [];
    for (const r of rows) { r.items.sort((a, b) => a.x - b.x); for (let i = 1; i < r.items.length; i++) { const g = r.items[i].x - (r.items[i - 1].x + r.items[i - 1].w); if (g >= 0) colGaps.push(g); } r.maxB = Math.max(...r.items.map((c) => c.y + c.h)); }
    rows.sort((a, b) => a.y - b.y);
    for (let j = 1; j < rows.length; j++) { const g = rows[j].y - rows[j - 1].maxB; if (g >= 0) rowGaps.push(g); }
    const fb = node.layout.gap || 0;
    return { kind: "cards", colGap: Math.round(median(colGaps, fb)), rowGap: Math.round(median(rowGaps, fb)), flowN: fl.length };
  };

  async function build(node, parent, isRoot, photos) {
    if (node.kind === "text") {
      const t = node.text; const rf = resolveFont(t.family, t.weight);
      await figma.loadFontAsync(rf);
      const tn = figma.createText(); parent.appendChild(tn);
      tn.fontName = rf; tn.fontSize = t.size; tn.textAutoResize = "WIDTH_AND_HEIGHT";
      tn.characters = t.transform === "uppercase" ? t.chars.toUpperCase() : t.chars;
      if (t.transform === "uppercase") tn.textCase = "UPPER";
      if (t.letter) tn.letterSpacing = { unit: "PIXELS", value: t.letter };
      if (t.lineHeight) tn.lineHeight = { unit: "PIXELS", value: t.lineHeight };
      tn.fills = [solid(t.color)];
      // Honor the DOM's text-align. The tight Range bbox of centered/right copy is
      // already positioned correctly for the FIRST line, but Figma left-aligns every
      // line within the box unless told otherwise — so a wrapped `text-center`
      // paragraph (e.g. a SectionHeading sub) renders left-aligned without this.
      // Left is the default (align omitted); the bbox is horizontally centered in its
      // content box, so keeping the measured x/width + CENTER reproduces the DOM.
      tn.textAlignHorizontal = t.align === "center" ? "CENTER" : t.align === "right" ? "RIGHT" : t.align === "justified" ? "JUSTIFIED" : "LEFT";
      // Wrapping paragraphs (captured height spans >1 line at the measured width)
      // must KEEP that width and wrap; the default WIDTH_AND_HEIGHT re-lays them onto
      // one long line that overflows the frame and breaks the column's centering.
      const lh = t.lineHeight || t.size * 1.3;
      if (node.w > 0 && node.h > lh * 1.4) { tn.textAutoResize = "HEIGHT"; tn.resize(Math.max(1, node.w), tn.height); }
      return tn;
    }
    if (node.kind === "svg") {
      const g = figma.createNodeFromSvg(node.svg); parent.appendChild(g);
      try { g.resize(Math.max(1, node.w), Math.max(1, node.h)); } catch (e) {}
      // Recolor to the CSS `color` ONLY for monochrome `currentColor` icons (map-pin,
      // player silhouette) — they render black otherwise. A multi-color illustration
      // with EXPLICIT hex fills (e.g. the hero baseball-field SVG: green/gold/white) must
      // keep its own colors; recoloring everything to the ink `color` would paint it solid
      // black. Gate on the raw markup actually using currentColor.
      if ((node.svg || "").includes("currentColor")) {
        const col = node.color ? { r: node.color.r, g: node.color.g, b: node.color.b } : { r: 0, g: 0, b: 0 };
        const op = node.color && node.color.a != null ? node.color.a : 1;
        for (const v of g.findAll((n) => "strokes" in n)) { if (v.strokes && v.strokes.length) v.strokes = [{ type: "SOLID", color: col, opacity: op }]; }
        for (const v of g.findAll((n) => "fills" in n)) { if (Array.isArray(v.fills) && v.fills.length) v.fills = v.fills.map((p) => p.type === "SOLID" ? { ...p, color: col, opacity: op } : p); }
      }
      return g;
    }
    // Positional grids (non-uniform column tracks like a header) can't be a 1-D flow —
    // drop them to a plain frame with absolutely-placed children (measured x/y = exact).
    const gi = (isBox(node) && node.layout && node.layout.mode === "grid") ? gridInfo(node) : null;
    const auto = isAutoNode(node) && !(gi && gi.kind === "positional");
    const isGrid = auto && node.layout.mode === "grid";
    const frame = auto ? figma.createAutoLayout(node.layout.mode === "column" ? "VERTICAL" : "HORIZONTAL") : figma.createFrame();
    // Honor the DOM's overflow: an `overflow-hidden rounded-*` container must CLIP so
    // its rounded corners cut opaque children (else a square photo/gradient avatar
    // paints over the rounded top). Default off — non-clipping boxes keep showing
    // reconstructed content that slightly overflows their measured box.
    frame.name = node.tag || "box"; frame.clipsContent = node.clip === true;
    const wash = overlayAlpha(node);
    const paints = [];
    for (const f of node.fills || []) {
      if (f.type === "image") { photos.push({ nodeId: null, asset: f.asset, _frame: frame }); paints.push({ type: "SOLID", color: { r: 0.55, g: 0.55, b: 0.55 } }); }
      else { const p = paintFor(f); if (p) { if (wash != null && p.type === "SOLID") p.opacity = 1; paints.push(p); } }
    }
    frame.fills = paints;
    if (node.stroke) {
      frame.strokes = [solid(node.stroke.color)];
      // Per-side weights (a `border-t-4` accent) → individual stroke weights so only the
      // bordered edges paint; else a uniform weight. INSIDE align matches CSS border-box.
      if (node.stroke.weights) { const w = node.stroke.weights; frame.strokeAlign = "INSIDE"; frame.strokeTopWeight = w.t || 0; frame.strokeRightWeight = w.r || 0; frame.strokeBottomWeight = w.b || 0; frame.strokeLeftWeight = w.l || 0; }
      else frame.strokeWeight = Math.max(1, node.stroke.weight);
    }
    // Per-corner radii (`radii`) when the DOM corners differ, else uniform `radius`.
    if (node.radii) { frame.topLeftRadius = node.radii.tl; frame.topRightRadius = node.radii.tr; frame.bottomRightRadius = node.radii.br; frame.bottomLeftRadius = node.radii.bl; }
    else if (node.radius) frame.cornerRadius = node.radius;
    // Effects: box-shadows → DROP/INNER_SHADOW, filter/backdrop blur → LAYER/BACKGROUND_BLUR.
    const effects = [];
    for (const s of node.shadows || []) effects.push({ type: s.inset ? "INNER_SHADOW" : "DROP_SHADOW", color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a == null ? 1 : s.color.a }, offset: { x: s.x || 0, y: s.y || 0 }, radius: Math.max(0, s.blur || 0), spread: s.spread || 0, visible: true, blendMode: "NORMAL" });
    if (node.blur) effects.push({ type: node.blur.type === "background" ? "BACKGROUND_BLUR" : "LAYER_BLUR", radius: Math.max(0, node.blur.radius || 0), visible: true });
    if (effects.length) frame.effects = effects;
    const nodeOpacity = wash != null ? wash : node.opacity;
    if (nodeOpacity != null && nodeOpacity !== 1) frame.opacity = nodeOpacity;
    parent.appendChild(frame);
    if (auto) {
      const L = node.layout; const P = L.padding || {}; // padding omitted when all-zero (shrunk spec)
      // Item spacing: for row/column, DERIVE it from the measured gaps between in-flow
      // children so child MARGINS (e.g. a stat icon's `mb-3`) are honored — CSS `gap`
      // alone misses them, collapsing icon↔number to 0. Grids keep their captured gap;
      // space-between distributes and ignores itemSpacing, so skip it there.
      let spacing = L.gap || 0;
      if (!isGrid && !/space/.test(L.justify || "")) {
        const flow = (node.children || []).filter((c) => c.position !== "absolute" && ((c.w || 0) > 0 || (c.h || 0) > 0));
        if (flow.length >= 2) {
          const vert = L.mode === "column"; const gaps = [];
          for (let k = 1; k < flow.length; k++) { const a = flow[k - 1], b = flow[k]; const g = vert ? (b.y - (a.y + a.h)) : (b.x - (a.x + a.w)); if (g >= 0) gaps.push(g); }
          if (gaps.length) spacing = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
        }
      }
      frame.itemSpacing = spacing; frame.paddingTop = P.t || 0; frame.paddingRight = P.r || 0; frame.paddingBottom = P.b || 0; frame.paddingLeft = P.l || 0;
      frame.primaryAxisAlignItems = JUST[L.justify] || "MIN"; frame.counterAxisAlignItems = ALIGN[L.align] || "MIN";
      // Grid → wrap: FIX the primary (row width / column height) so items wrap onto
      // multiple rows, and HUG the counter axis so the block grows to fit every row.
      // (Fixing the counter axis instead left the width hugging → everything strung
      // into one overflowing row, e.g. the 4×2 roster grid became a single 8-wide row.)
      // Card grid → wrap. Use the MEASURED column gap (horizontal itemSpacing) and row
      // gap (counterAxisSpacing) from gridInfo, not the CSS `gap` (which conflates the two
      // and mis-wrapped, e.g. `40px 24px` spacing cards 40 apart so a 4-up row overflowed).
      // +flowN px of primary slack absorbs sub-pixel width rounding (each column rounds up
      // ≤1px) so a row that fits in the browser isn't forced to wrap early; a genuine extra
      // item overflows by hundreds of px and still wraps.
      if (isGrid) { frame.layoutWrap = "WRAP"; frame.itemSpacing = gi.colGap; frame.counterAxisSpacing = gi.rowGap; frame.resize(Math.max(1, node.w + gi.flowN), Math.max(1, node.h)); frame.primaryAxisSizingMode = "FIXED"; frame.counterAxisSizingMode = "AUTO"; }
      // Non-grid: preserve the DOM's measured box on EVERY auto frame (not just root).
      // Keep BOTH axes FIXED — width so justify (space-between/center) has room, height
      // so fixed-aspect boxes (icon circles, date badges, card headers) don't collapse
      // to their content height. clipsContent=false already prevents clipping, so
      // there's no need to hug height (an earlier pass did, which squashed those boxes).
      else frame.resize(Math.max(1, node.w), Math.max(1, node.h));
    } else { frame.layoutMode = "NONE"; frame.resize(Math.max(1, node.w), Math.max(1, node.h)); }
    // Place a child by x/y, or by a rotation transform about its centre when `rotate`
    // is set (the spec's x/y/w/h are the UN-rotated box; CSS rotate is CW = Figma's
    // y-down matrix with +angle).
    const placeChild = (child, c) => {
      if (c.rotate) { const a = c.rotate * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a), hx = c.w / 2, hy = c.h / 2, cx = c.x + hx, cy = c.y + hy; child.relativeTransform = [[cos, -sin, cx - (cos * hx - sin * hy)], [sin, cos, cy - (sin * hx + cos * hy)]]; }
      else { child.x = c.x; child.y = c.y; }
    };
    for (const c of node.children || []) {
      // Skip display:none / zero-box elements: they carry no pixels but, as flex
      // items, corrupt justification (a hidden 0-w nav turns a 2-item space-between
      // into a 3-item one that centers the nav) and leave stray hidden-menu text.
      if ((c.w || 0) <= 0 && (c.h || 0) <= 0) continue;
      const child = await build(c, frame, false, photos);
      if (auto) { if (c.position === "absolute") { child.layoutPositioning = "ABSOLUTE"; placeChild(child, c); } }
      else { placeChild(child, c); }
    }
    return frame;
  }

  // ── 5. per block: build each view → bind → COMPONENT → View= set ────────────
  // TEMP mode (MANIFEST.temp): a big block whose two breakpoints exceed one call's
  // 50K code limit is built one view at a time. Each view becomes a standalone
  // `__tmp:{blockId}:{view}` component (NOT combined, NOT pruned); the `combine`
  // phase later merges them into the `View=` set. No cross-call deletion: temp names
  // are unique per block×view, so parallel/sequential temp calls never clobber.
  const TEMP = MANIFEST.temp === true;
  const manifestIds = new Set(MANIFEST.blocks.map((b) => b.name));
  const built = [];
  const temps = [];
  const skipped = [];
  const photoOut = []; // { blockId, view, asset, nodeId }
  for (const blk of MANIFEST.blocks) {
    if (!TEMP) for (const n of [...page.children]) if (n.name === blk.name && (n.type === "COMPONENT_SET" || n.type === "COMPONENT")) n.remove();
    const views = Object.keys(blk.views);
    const variants = [];
    for (const view of views) {
      const spec = blk.views[view];
      if (!spec) continue;
      const photos = [];
      const root = await build(spec, page, true, photos);
      for (const n of [root, ...root.findAll(() => true)]) { if ("fills" in n) bindPaints(n, "fills"); if ("strokes" in n) bindPaints(n, "strokes"); }
      for (const p of photos) { p.nodeId = p._frame.id; photoOut.push({ blockId: blk.blockId, view, asset: p.asset, nodeId: p._frame.id }); }
      if (TEMP) {
        const tname = `__tmp:${blk.blockId}:${view}`;
        for (const n of [...page.children]) if (n.name === tname && (n.type === "COMPONENT" || n.type === "COMPONENT_SET")) n.remove(); // idempotent
        root.name = tname;
        const comp = figma.createComponentFromNode(root);
        temps.push({ blockId: blk.blockId, view, componentId: comp.id, name: tname });
      } else {
        root.name = `View=${cap(view)}`;
        variants.push(figma.createComponentFromNode(root));
      }
    }
    if (TEMP) continue;
    if (!variants.length) { skipped.push(blk.name); continue; }
    let result;
    if (variants.length === 1) { result = variants[0]; result.name = blk.name; }
    else { result = styleSet(figma.combineAsVariants(variants, page), blk.name); }
    built.push({ blockId: blk.blockId, block: blk.name, componentId: result.id, type: result.type, views });
  }

  // prune stale sets — ONLY when the manifest represents the FULL design
  // (pruneStale). A per-block emit-calls slice lists just its own block, so pruning
  // there would delete every OTHER block built by sibling calls. Gated off by default.
  const pruned = [];
  if (!TEMP && MANIFEST.pruneStale === true) { for (const n of [...page.children]) if ((n.type === "COMPONENT_SET" || n.type === "COMPONENT") && !n.name.startsWith("__tmp:") && !manifestIds.has(n.name)) { pruned.push(n.name); n.remove(); } }

  // lay the finished blocks down the page (skip temps — combine positions the finals)
  let y = 80;
  for (const p of page.children.filter((n) => (n.type === "COMPONENT_SET" || n.type === "COMPONENT") && !n.name.startsWith("__tmp:"))) { p.x = 80; p.y = y; y += p.height + 64; }

  return { phase: "reconstruct", temp: TEMP, page: MANIFEST.blockPageName, brandCollection: MANIFEST.brandCollectionName, variables: varResult, built, temps, skipped, pruned, photos: photoOut, boundPaints: boundCount, proxiedFonts: [...proxies] };
}

// ── PHASE "combine" — merge per-view __tmp components into View= sets ───────────
// For oversized blocks built one view at a time (reconstruct + MANIFEST.temp), this
// collects each block's `__tmp:{blockId}:{view}` components and combines them into
// the final `View=…` set — no re-build, no photo re-upload (photos set on temp nodes
// survive combineAsVariants). Idempotent per block name (drops a prior final set).
// CONTRACT: MANIFEST = { blockPageName, combine: [{ blockId, name, views:[...] }] }.
if (PHASE === "combine") {
  const page = figma.root.children.find((p) => p.name === MANIFEST.blockPageName);
  if (!page) throw new Error(`Block page "${MANIFEST.blockPageName}" not found`);
  await figma.setCurrentPageAsync(page);
  const built = [];
  const missing = [];
  for (const b of MANIFEST.combine) {
    for (const n of [...page.children]) if (n.name === b.name && (n.type === "COMPONENT_SET" || n.type === "COMPONENT")) n.remove();
    const variants = [];
    for (const view of b.views) {
      const t = page.children.find((n) => n.name === `__tmp:${b.blockId}:${view}` && n.type === "COMPONENT");
      if (!t) { missing.push(`${b.blockId}/${view}`); continue; }
      t.name = `View=${cap(view)}`;
      variants.push(t);
    }
    if (!variants.length) continue;
    let result;
    if (variants.length === 1) { result = variants[0]; result.name = b.name; }
    else { result = styleSet(figma.combineAsVariants(variants, page), b.name); }
    built.push({ blockId: b.blockId, block: b.name, componentId: result.id, type: result.type, views: b.views });
  }
  let y = 80;
  for (const p of page.children.filter((n) => (n.type === "COMPONENT_SET" || n.type === "COMPONENT") && !n.name.startsWith("__tmp:"))) { p.x = 80; p.y = y; y += p.height + 64; }
  return { phase: "combine", built, missing };
}

// ── PHASE "compose" — build ONE design Page from block INSTANCES (unchanged) ────
// Same contract/behavior as figma-block-library.plugin.js compose: one page per
// call, fanned out in parallel by the caller. componentIds come from the
// `reconstruct` phase's built[].
if (PHASE === "compose") {
  const pg = MANIFEST.page;
  const views = MANIFEST.views && MANIFEST.views.length ? MANIFEST.views : ["desktop"];
  const widths = MANIFEST.widths || {};
  const fallbackW = { desktop: 1440, tablet: 664, mobile: 390 };

  // Resolve each block to its component. Prefer an in-memory componentId (the bundled
  // "Both" flow passes it straight from the reconstruct phase). When it's absent — the
  // STANDALONE Part 2 "Pages from blocks" flow — look the component up BY NAME on the
  // Block Library page. Load pages first so that page's children are readable (compose
  // still switches currentPage exactly once, to the design page, below). Guard: if there
  // is no Block Library page, Part 1 hasn't run — fail loudly, don't compose empty pages.
  const blockPageName = MANIFEST.blockPageName || "Block Library";
  let byName = null;
  if (pg.blocks.some((b) => !b.componentId)) {
    if (figma.loadAllPagesAsync) { try { await figma.loadAllPagesAsync(); } catch (e) {} }
    const bp = figma.root.children.find((p) => p.name === blockPageName);
    if (!bp) throw new Error(`Block Library page "${blockPageName}" not found — run Part 1 (Styleguide + Blocks) before composing Pages.`);
    if (bp.loadAsync) { try { await bp.loadAsync(); } catch (e) {} }
    byName = {};
    for (const n of bp.children) if (n.type === "COMPONENT_SET" || n.type === "COMPONENT") byName[n.name] = n;
  }
  const comps = {};
  for (const b of pg.blocks) comps[b.blockId] = b.componentId ? await figma.getNodeByIdAsync(b.componentId) : (byName ? (byName[b.name] || null) : null);

  const pickVariant = (comp, view) => {
    if (!comp) return null;
    if (comp.type === "COMPONENT") return comp;
    if (comp.type === "COMPONENT_SET") return comp.children.find((c) => c.name === `View=${cap(view)}`) || comp.defaultVariant || comp.children[0];
    return null;
  };

  let dpage = figma.root.children.find((p) => p.name === pg.name);
  if (!dpage) { dpage = figma.createPage(); dpage.name = pg.name; }
  await figma.setCurrentPageAsync(dpage);
  for (const n of [...dpage.children]) if (n.name.startsWith(`${pg.name} — `)) n.remove();

  const frames = [];
  const missing = [];
  let x = 80;
  for (const view of views) {
    const w = widths[view] || fallbackW[view] || 1440;
    const frame = figma.createAutoLayout("VERTICAL");
    frame.name = `${pg.name} — ${cap(view)}`;
    frame.itemSpacing = 0;
    frame.fills = [];
    frame.resize(w, 10);
    frame.layoutSizingHorizontal = "FIXED";
    frame.x = x; frame.y = 80;
    for (const b of pg.blocks) {
      const variant = pickVariant(comps[b.blockId], view);
      if (!variant) { missing.push(`${b.name || b.blockId}/${view}`); continue; }
      const inst = variant.createInstance();
      frame.appendChild(inst);
      inst.layoutSizingHorizontal = "FILL";
    }
    frame.primaryAxisSizingMode = "AUTO";
    frames.push({ view, id: frame.id, blocks: frame.children.length });
    x += w + 120;
  }
  return { phase: "compose", page: pg.name, resolvedBy: byName ? "name" : "id", frames, missing };
}
