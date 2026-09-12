// ©2026 thinkany llc. All rights reserved.
/**
 * Video embeds in rich text (CORE). A YouTube or Vimeo address on a line of its own in
 * a richtext field IS the video, the way WordPress treats a pasted link: the file keeps
 * the plain URL (any markdown renderer still shows a link), the site renders the player
 * (richtext.ts), and the CMS editor shows the player in place. The app's editor bundle
 * imports this same file, so the two sides agree on what counts as a video address.
 */
export type VideoEmbed = {
  provider: "youtube" | "vimeo";
  id: string;
  /** The player: the host's controls, click to play, as quiet as its parameters allow. */
  src: string;
  title: string;
  /** A still the host publishes for the video (YouTube does; Vimeo needs an API call). */
  thumb?: string;
  /** Vimeo: an unlisted clip's hash, which the player needs. */
  hash?: string;
};

const YT_ID = /^[\w-]{6,20}$/;
const VIMEO_ID = /^\d{5,20}$/;
const VIMEO_HASH = /^[a-f0-9]{6,}$/i;

/** The video behind `url`, or null when it isn't a YouTube / Vimeo address. */
export function videoEmbed(url: string | undefined | null): VideoEmbed | null {
  const s = String(url || "").trim();
  if (!/^https?:\/\//i.test(s) || /\s/.test(s)) return null;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const seg = u.pathname.split("/").filter(Boolean);
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "youtu.be") {
    // youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts|embed|live|v/ID
    let id = "";
    if (host === "youtu.be") id = seg[0] || "";
    else if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
    else if (seg.length === 2 && ["embed", "shorts", "live", "v"].includes(seg[0])) id = seg[1];
    if (!YT_ID.test(id)) return null;
    // rel=0 keeps the end-screen suggestions to the same channel (YouTube dropped the
    // way to remove them in 2018); iv_load_policy=3 hides annotations; controls stay.
    return { provider: "youtube", id, src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&controls=1&playsinline=1&iv_load_policy=3`, title: "YouTube video", thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    // vimeo.com/ID, vimeo.com/channels/x/ID, player.vimeo.com/video/ID; an unlisted
    // clip's hash (vimeo.com/ID/abcdef12) rides along, since the player needs it.
    const i = seg.findIndex((p) => VIMEO_ID.test(p));
    if (i < 0) return null;
    const id = seg[i];
    const hash = seg[i + 1] && VIMEO_HASH.test(seg[i + 1]) ? seg[i + 1] : u.searchParams.get("h") || "";
    // dnt=1 no tracking; no title / byline / portrait overlays. Vimeo's end screen has
    // no player parameter: it is set on the video in Vimeo's own settings.
    return { provider: "vimeo", id, src: `https://player.vimeo.com/video/${id}?dnt=1&title=0&byline=0&portrait=0&playsinline=1${hash ? `&h=${hash}` : ""}`, title: "Vimeo video", hash: hash || undefined };
  }
  return null;
}

const ALLOW = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

/**
 * The <iframe> attributes, React-shaped, for a component that renders a hosted video.
 * A hosted video is always content: the host's player, its controls, started by the
 * visitor. It is never texture (no autoplay, no muted loop), so `title` names it.
 */
export function embedFrameProps(e: VideoEmbed, { title = "" } = {}) {
  return {
    src: e.src,
    title: title || e.title,
    allow: ALLOW,
    allowFullScreen: true,
    loading: "lazy" as const,
    referrerPolicy: "strict-origin-when-cross-origin" as const,
  };
}

/**
 * The player in rich text: a 16:9 box the surrounding prose sizes and spaces (it is a
 * plain block in the flow, no margins of its own); `.ta-embed` is the hook for a
 * design's own styling.
 */
export function embedHtml(e: VideoEmbed): string {
  return `<div class="ta-embed" data-embed="${e.provider}" style="aspect-ratio:16/9;width:100%"><iframe src="${e.src}" title="${e.title}" loading="lazy" allow="${ALLOW}" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" style="width:100%;height:100%;border:0;display:block"></iframe></div>`;
}
