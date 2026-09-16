// ©2026 thinkany llc. All rights reserved.
// The chosen preview device per kind (phone / tablet), remembered per project in
// localStorage. Held here rather than in page props: every design page (the designer's
// own files included) forwards view/orientation down to DesignSurface, and adding a prop
// to that chain would touch files the template never overwrites. DesignSurface reads and
// sets the choice; App publishes it to the export tool via window.__PREVIEW_CONFIG__.
import { devices, previewWidths, previewHeights, siteConfig, type Device, type DeviceKind, type View } from "@/config/site";

const key = (kind: DeviceKind) => `ta:device:${siteConfig.projectName || ""}:${kind}`;

/** The chosen device of a kind, or the catalog's first (the default) when none is stored. */
export function getDevice(kind: DeviceKind): Device {
  const list = devices[kind];
  let id: string | null = null;
  try { id = localStorage.getItem(key(kind)); } catch { /* storage blocked: the default */ }
  return list.find((d) => d.id === id) ?? list[0];
}

export function setDevice(kind: DeviceKind, id: string): Device {
  try { localStorage.setItem(key(kind), id); } catch { /* storage blocked: this session only */ }
  publishPreviewDevices();
  return getDevice(kind);
}

/** The per-breakpoint viewport an export should use right now: the chosen devices, desktop fixed. */
export function currentPreviewSizes(): { widths: Record<View, number>; heights: Record<View, number> } {
  const m = getDevice("mobile");
  const t = getDevice("tablet");
  return {
    widths: { ...previewWidths, mobile: m.width, tablet: t.width },
    heights: { ...previewHeights, mobile: m.height, tablet: t.height },
  };
}

/** Patch window.__PREVIEW_CONFIG__ in place, so a device picked mid-session reaches the exporter. */
export function publishPreviewDevices() {
  const w = window as unknown as { __PREVIEW_CONFIG__?: Record<string, unknown> };
  if (!w.__PREVIEW_CONFIG__) return;
  Object.assign(w.__PREVIEW_CONFIG__, currentPreviewSizes());
}
