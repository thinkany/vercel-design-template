import { parseColor } from "./color.mjs";
import { derive } from "./derive.mjs";

// ── color unit checks ──
const approx = (a, b) => Math.abs(a - b) < 0.02;
const c1 = parseColor("rgb(255, 0, 0)");
console.assert(c1 && approx(c1.r, 1) && approx(c1.g, 0) && c1.a === 1, "rgb red");
const c2 = parseColor("rgba(0,128,255,0.5)");
console.assert(c2 && approx(c2.b, 1) && approx(c2.a, 0.5), "rgba alpha");
const c3 = parseColor("#3366ff");
console.assert(c3 && approx(c3.r, 0.2) && approx(c3.g, 0.4) && approx(c3.b, 1), "hex");
const c4 = parseColor("oklch(0.7 0.15 250)"); // a blue-ish
console.assert(c4 && c4.b > c4.r, `oklch blue-ish (got ${JSON.stringify(c4)})`);
const c5 = parseColor("transparent");
console.assert(c5 && c5.a === 0, "transparent");
const c6 = parseColor("hsl(120, 100%, 50%)"); // green
console.assert(c6 && approx(c6.g, 1) && approx(c6.r, 0), `hsl green (got ${JSON.stringify(c6)})`);

// ── synthetic CaptureBundle exercising fills, gradient, border, radius, text, svg, img ──
const bundle = {
  contract: 1, variation: "v00",
  views: ["desktop"], widths: { desktop: 1440 },
  brand: { colorVars: { "--ta-primary": "oklch(0.6 0.2 25)", "--ta-surface-muted": "#f5f5f5" }, fontVars: { display: '"Playfair Display", serif', sans: "Inter, sans-serif" } },
  pages: [{ id: "home", name: "Home", route: "", blocks: [{ blockId: "hero", name: "Hero" }] }],
  assets: [{ name: "asset-0.png", srcUrl: "http://localhost:5173/logo.webp" }],
  blocks: [{
    blockId: "hero", name: "Hero", page: "home", route: "", view: "desktop",
    root: {
      tag: "section", rect: { x: 0, y: 0, w: 1440, h: 600 }, offset: { w: 1440, h: 600 },
      style: {
        display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "24px",
        paddingTop: "80px", paddingBottom: "80px", paddingLeft: "0px", paddingRight: "0px",
        backgroundColor: "rgb(20, 20, 30)",
        backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 100%)",
        borderBottomWidth: "4px", borderBottomColor: "rgb(255, 80, 0)",
        borderTopWidth: "0px", borderLeftWidth: "0px", borderRightWidth: "0px",
        borderTopLeftRadius: "0px", borderTopRightRadius: "0px", borderBottomLeftRadius: "0px", borderBottomRightRadius: "0px",
        boxShadow: "rgba(0,0,0,0.25) 0px 10px 30px 0px",
        opacity: "1", overflowX: "hidden", overflowY: "visible", position: "relative",
      },
      children: [
        { tag: "img", rect: { x: 620, y: 40, w: 200, h: 60 }, offset: { w: 200, h: 60 },
          style: { objectFit: "contain", objectPosition: "center", borderTopLeftRadius: "8px", borderTopRightRadius: "8px", borderBottomLeftRadius: "8px", borderBottomRightRadius: "8px" }, imgSrc: "http://localhost:5173/logo.webp" },
        { tag: "h1", rect: { x: 400, y: 200, w: 640, h: 80 }, offset: { w: 640, h: 80 },
          style: { color: "oklch(0.98 0 0)", fontFamily: '"Playfair Display", serif', fontSize: "64px", fontWeight: "700", textAlign: "center", lineHeight: "72px", letterSpacing: "normal", textTransform: "none" },
          children: [{ kind: "text", chars: "Welcome", rect: { x: 0, y: 0, w: 640, h: 80 } }] },
        { tag: "svg", rect: { x: 700, y: 320, w: 40, h: 40 }, style: { color: "rgb(255, 80, 0)" }, svgMarkup: "<svg><path d='M0 0'/></svg>" },
      ],
    },
  }],
};

const spec = derive(bundle);
const root = spec.blocks[0].views.desktop;

// structural assertions
console.assert(spec.brandColors.length === 2, `2 brand colors (got ${spec.brandColors.length})`);
console.assert(spec.brandColors[0].name === "Primary", `titled 'Primary' (got ${spec.brandColors[0].name})`);
console.assert(spec.fonts.display.family === "Playfair Display", `display font (got ${spec.fonts.display.family})`);
console.assert(root.layout && root.layout.mode === "column" && root.layout.gap === 24, "layout column gap24");
console.assert(root.layout.padding.t === 80, "padding top 80");
console.assert(root.fills && root.fills[0].type === "solid" && root.fills.some(f => f.type === "gradient"), "solid + gradient fills");
console.assert(root.stroke && root.stroke.weights.b === 4 && root.stroke.weights.t === 0, "bottom-only border 4px");
console.assert(root.shadows && root.shadows[0].y === 10 && root.shadows[0].blur === 30, "shadow y10 blur30");
console.assert(root.clip === true, "overflow-hidden → clip");
const img = root.children.find(c => c.tag === "img");
console.assert(img.fills && img.fills[0].type === "image" && img.fills[0].asset === "asset-0.png", "img → asset fill");
console.assert(img.radius === 8, "img uniform radius 8");
const h1 = root.children.find(c => c.tag === "h1");
const txt = h1.children[0];
console.assert(txt.kind === "text" && txt.text.chars === "Welcome" && txt.text.size === 64 && txt.text.weight === 700 && txt.text.align === "center" && txt.text.lineHeight === 72, `text style (got ${JSON.stringify(txt.text)})`);
const svg = root.children.find(c => c.kind === "svg");
console.assert(svg.svg.includes("<path") && svg.color && svg.color.r > 0.9, "svg markup + color");
// omit-defaults: opacity 1 not emitted, top/left border absent
console.assert(root.opacity === undefined, "opacity default omitted");

console.log("ALL DERIVE TESTS PASSED");
console.log(JSON.stringify({ brandColors: spec.brandColors, rootFills: root.fills, stroke: root.stroke, text: txt.text }, null, 2));
