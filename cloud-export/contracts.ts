// ©2026 thinkany llc. All rights reserved.
/**
 * contracts.ts — the wire contract between the LOCAL capture client and the
 * CLOUD derive service for the licensed Figma-export path.
 *
 * Two payloads cross the wire:
 *   1. CaptureBundle  — POSTed UP by the thin local client (dumb serialization).
 *   2. BuildSpec      — returned DOWN by the cloud derive (the IP: raw → intent).
 *
 * The build (Figma `use_figma` MCP calls) and the image bytes NEVER touch the
 * cloud — they stay in the local session under the user's Figma auth. The cloud
 * only ever sees raw computed-style strings + geometry, and only ever emits the
 * per-node Figma-intent spec. See ./README.md for the full data flow.
 *
 * SEAM RULE: geometry (rects/offsets/text-run boxes) is measured LOCALLY because
 * it needs live layout; EVERY interpretation of a style string (parse, resolve,
 * compact, bind) happens in the CLOUD. Keep new fields on that side of the line.
 */

/* ────────────────────────────── shared ────────────────────────────── */

/** sRGB 0–1. Colors are resolved in the CLOUD (culori), never in the bundle. */
export interface RGB { r: number; g: number; b: number; }
export interface RGBA extends RGB { a: number; }

/** A breakpoint id. The active set comes from the app's __PREVIEW_CONFIG__. */
export type View = string; // "desktop" | "tablet" | "mobile" | custom

/** Parent-relative box in CSS px, rounded. Measured locally (needs live layout). */
export interface Rect { x: number; y: number; w: number; h: number; }

/**
 * The whitelist of computed-style properties the cloud derive reads. The local
 * client ships these as RAW strings, verbatim from getComputedStyle — no parsing.
 * Kept as a named list so client and cloud can't drift on what's captured.
 */
export const CAPTURED_STYLE_PROPS = [
  "display", "flexDirection", "justifyContent", "alignItems", "gap",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "backgroundColor", "backgroundImage", "backgroundSize", "backgroundPosition",
  "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "borderTopLeftRadius", "borderTopRightRadius",
  "borderBottomRightRadius", "borderBottomLeftRadius",
  "boxShadow", "filter", "backdropFilter", "webkitBackdropFilter",
  "opacity", "transform", "rotate", "overflowX", "overflowY",
  "color", "fontFamily", "fontSize", "fontWeight", "lineHeight",
  "letterSpacing", "textAlign", "textTransform",
  "objectFit", "objectPosition", "position",
] as const;
export type CapturedStyleProp = (typeof CAPTURED_STYLE_PROPS)[number];
export type RawStyle = Partial<Record<CapturedStyleProp, string>>;

/* ─────────────────────── 1. CaptureBundle (UP) ─────────────────────── */

/**
 * One measured inline text run (a text child node), boxed via Range locally.
 * `kind:"text"` discriminates it from element nodes in a `children` array; it
 * inherits its PARENT RawNode's `style` (the cloud applies textStyle to that).
 */
export interface RawTextRun { kind: "text"; chars: string; rect: Rect; }

/** Ordered child: element or text run, interleaved in DOM order (order matters —
 *  a label + inline icon must keep their sequence). Discriminate on `kind`. */
export type RawChild = RawNode | RawTextRun;

/**
 * A raw serialized DOM ELEMENT node — faithful, un-interpreted. Carries raw
 * style + geometry; the cloud turns this into a SpecNode. svg carries markup;
 * img carries src; text children live inline in `children` as RawTextRun.
 */
export interface RawNode {
  tag: string;                 // lowercased tagName
  rect: Rect;                  // parent-relative (root is 0,0)
  offset?: { w: number; h: number }; // offsetW/H — for un-rotating a rotated leaf
  style?: RawStyle;            // raw computed-style strings (whitelist above)
  svgMarkup?: string;          // set iff tag === "svg" (outerHTML)
  imgSrc?: string;             // set iff tag === "img" (currentSrc, may be http/data)
  children?: RawChild[];       // element + text children, interleaved in DOM order
}

/** Raw brand read from :root — RAW values; cloud resolves + titles + binds. */
export interface RawBrand {
  /** --ta-* color custom properties (excluding --ta-font-*): name→raw value. */
  colorVars: Record<string, string>;
  /** Font-role raw values: --ta-font-{display,serif,sans,mono}. */
  fontVars: Partial<Record<"display" | "serif" | "sans" | "mono", string>>;
}

/** One block captured at one view — the raw tree the cloud will derive. */
export interface CapturedBlock {
  blockId: string;             // data-block
  name: string;                // data-block-name (falls back to blockId)
  page: string;                // page id it first appeared on
  route: string;               // page route ("" for home)
  view: View;
  root: RawNode;               // the [data-block] subtree, raw
}

/** Asset the LOCAL client already downloaded + re-encoded to PNG (bytes local). */
export interface AssetRef {
  name: string;                // stable name, referenced from BuildSpec fills
  srcUrl: string;              // original url (for local dedupe/debug only)
  // NB: bytes/path are held LOCALLY and never serialized into the bundle.
}

/**
 * The full payload the thin local client POSTs to the cloud derive endpoint.
 * Auth (API key / license token) travels in the request HEADER, not here.
 */
export interface CaptureBundle {
  contract: 1;                 // bump on any breaking shape change
  variation: string;          // e.g. "v00"
  views: View[];              // active breakpoints, in order (primary first)
  widths: Record<View, number>;
  brand: RawBrand;
  /** Per-page block ORDER for Part-2 compose (first-active-view order). */
  pages: { id: string; name: string; route: string; blocks: { blockId: string; name: string }[] }[];
  /** Every unique block × active view. */
  blocks: CapturedBlock[];
  /** Asset manifest — names only; the client holds the bytes for upload_assets. */
  assets: AssetRef[];
}

/* ─────────────────────── 2. BuildSpec (DOWN) ───────────────────────── */

/** A resolved brand color, ready to become a Figma Brand variable. */
export interface BrandColor { name: string; token: string; rgb: RGB; }
export interface FontRole { family: string; role: "display" | "serif" | "sans" | "mono"; }

export type Fill =
  | { type: "solid"; color: RGBA }
  | { type: "gradient"; angle: number; stops: { color: RGBA; pos: number }[] }
  | { type: "image"; asset: string; size?: string; pos?: string };

export type Stroke =
  | { color: RGBA; weight: number }
  | { color: RGBA; weights: { t: number; r: number; b: number; l: number } };

export interface Shadow { x: number; y: number; blur: number; spread: number; color: RGBA; inset: boolean; }
export interface Blur { type: "layer" | "background"; radius: number; }

export interface Layout {
  mode: "row" | "column" | "grid";
  justify: string;             // raw justify-content
  align: string;               // raw align-items
  gap?: number;
  padding?: { t: number; r: number; b: number; l: number };
}

export interface TextStyle {
  family: string; size: number; weight: number; color: RGBA;
  lineHeight?: number; letter?: number;
  transform?: string;          // text-transform (omitted when "none")
  align?: "center" | "right" | "justified"; // omitted for left/start default
}

/**
 * A derived Figma-intent node. OMIT-DEFAULTS holds: absent field ⇒ default
 * (kind→"box", position→flow, opacity→1, radius→0, no fills/stroke/layout/kids).
 * This is the shape the builder plugin consumes 1:1 — do not change without
 * updating figma-reconstruct-library.plugin.js in lockstep.
 */
export type SpecNode =
  | (SpecBox & { kind?: undefined })
  | { kind: "text"; x: number; y: number; w: number; h: number; text: { chars: string } & TextStyle }
  | { kind: "svg"; x: number; y: number; w: number; h: number; svg: string; color: RGBA | null };

export interface SpecBox {
  tag: string;
  x: number; y: number; w: number; h: number;
  position?: "absolute";
  opacity?: number;
  rotate?: number;
  radius?: number;
  radii?: { tl: number; tr: number; br: number; bl: number };
  clip?: true;
  fills?: Fill[];
  stroke?: Stroke;
  shadows?: Shadow[];
  blur?: Blur;
  layout?: Layout;
  children?: SpecNode[];
}

/** One block, derived, keyed by view — mirrors reconstruct-{id}.json today. */
export interface SpecBlock {
  blockId: string;
  name: string;
  page: string;
  route: string;
  views: Record<View, SpecNode>;
}

/**
 * The payload the cloud derive returns. This is the existing
 * reconstruct-{variation}.json manifest, formalized. The local orchestrator
 * feeds it to the builder (via use_figma) exactly as it does today — the cloud
 * hop is transparent to Part 1 / Part 2.
 */
export interface BuildSpec {
  contract: 1;
  variation: string;
  blockPageName: "Block Library";
  brandCollectionName: "Brand";
  brandColors: BrandColor[];
  fonts: { display: FontRole; serif: FontRole; sans: FontRole; mono: FontRole };
  views: View[];
  widths: Record<View, number>;
  pruneStale: true;
  blocks: SpecBlock[];
  pages: { id: string; name: string; route: string; blocks: { blockId: string; name: string }[] }[];
  /** Asset names the builder will upload_assets locally (bytes never left home). */
  assets: { name: string }[];
}
