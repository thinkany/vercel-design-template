// Entry for desktop/vendor/editor.js (see bundle-editor.cjs). The renderer gets
// window.TAEditor.create(host, opts) → { editor, getMarkdown, setMarkdown, destroy }.
// Markdown is the file format. Two things markdown can't say are written as small
// HTML blocks inside it, which every renderer here carries and the editor reads back:
// an ALIGNED paragraph / heading (<p style="text-align:center">…</p>) and an ALIGNED
// image (<img … data-align="right" style="float:right…">). A third, the VIDEO EMBED,
// needs no HTML at all: it is a YouTube / Vimeo address on a line of its own, which
// the site renders as the player (site/src/lib/embed.ts, shared with this bundle).
// Everything else stays plain markdown, so what's saved always re-opens identically.
import { Editor, Node, Extension, mergeAttributes, getHTMLFromFragment } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { videoEmbed } from "../../site/src/lib/embed.ts";
import StarterKit from "@tiptap/starter-kit";
import Paragraph from "@tiptap/extension-paragraph";
import Heading from "@tiptap/extension-heading";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "tiptap-markdown";
import { defaultMarkdownSerializer } from "prosemirror-markdown";

const aligned = (node) => node.attrs.textAlign && node.attrs.textAlign !== "left";
// An aligned block is written as its HTML (inline marks included), on its own lines.
const writeHtml = (state, node) => { state.write(getHTMLFromFragment(Fragment.from(node), node.type.schema)); state.closeBlock(node); };

const AlignedParagraph = Paragraph.extend({
  addStorage() { return { markdown: {
    serialize(state, node) { if (aligned(node)) writeHtml(state, node); else defaultMarkdownSerializer.nodes.paragraph(state, node); },
    parse: {},
  } }; },
});
const AlignedHeading = Heading.extend({
  addStorage() { return { markdown: {
    serialize(state, node) { if (aligned(node)) writeHtml(state, node); else defaultMarkdownSerializer.nodes.heading(state, node); },
    parse: {},
  } }; },
});
// Image alignment: left / right float with text wrapping, or centered on its own line.
const IMG_STYLE = { left: "float:left;margin:0 1.25em 1em 0;max-width:50%", right: "float:right;margin:0 0 1em 1.25em;max-width:50%", center: "display:block;margin:0 auto" };
function makeImage(resolveSrc) {
  return Image.extend({
    addAttributes() {
      return { ...this.parent?.(), textAlign: { default: "left", parseHTML: (el) => el.getAttribute("data-align") || "left", renderHTML: (attrs) => (attrs.textAlign && attrs.textAlign !== "left" ? { "data-align": attrs.textAlign, style: IMG_STYLE[attrs.textAlign] } : {}) } };
    },
    renderHTML({ HTMLAttributes }) {
      const attrs = { ...HTMLAttributes };
      if (resolveSrc && attrs.src) attrs.src = resolveSrc(attrs.src); // preview needs a loadable URL
      return ["img", mergeAttributes(this.options.HTMLAttributes, attrs)];
    },
    addStorage() { return { markdown: {
      serialize(state, node) {
        if (aligned(node)) {
          const a = node.attrs.textAlign;
          const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
          state.write(`<img src="${esc(node.attrs.src)}" alt="${esc(node.attrs.alt)}" data-align="${a}" style="${IMG_STYLE[a]}">`); state.closeBlock(node);
        } else { defaultMarkdownSerializer.nodes.image(state, node); state.closeBlock(node); } // a block image ends its line
      },
      parse: {},
    } }; },
  });
}

// A video embed, the WordPress way: paste a YouTube or Vimeo link and the player appears
// in place. On disk it is the bare address on its own line; reading the file back turns a
// paragraph that is only such an address into this node again.
// Default priority, deliberately: the schema registers nodes in priority order, and the
// first "block" type without required attributes is what ProseMirror creates when it
// needs a default block (after an atom insert, on Enter). Registered ahead of paragraph,
// this node became that default, and every embed arrived with an empty twin under it.
// The paste handler, which does need to run before Link's, is its own extension below.
const VideoEmbed = Node.create({
  name: "videoEmbed",
  group: "block", atom: true, draggable: true, selectable: true,
  addAttributes() { return { url: { default: "" } }; },
  parseHTML() {
    return [
      { tag: "div[data-video-embed]", getAttrs: (el) => { const url = el.getAttribute("data-video-embed") || ""; return url ? { url } : false; } },
      // The file form: markdown gives a bare address on its own line as <p>address</p>.
      { tag: "p", priority: 60, getAttrs: (el) => { const t = (el.textContent || "").trim(); return videoEmbed(t) ? { url: t } : false; } },
    ];
  },
  // Shown as a still with a play badge, not the player: YouTube refuses to play inside a
  // page served from file:// (the app's renderer), and an editor doesn't need it to. The
  // still is YouTube's own thumbnail; Vimeo has none without an API call, so its card is
  // the provider name over the address.
  renderHTML({ node }) {
    const e = videoEmbed(node.attrs.url);
    const box = { "data-video-embed": node.attrs.url, class: "ta-embed", "data-embed": e ? e.provider : "" };
    const kids = [];
    if (e && e.provider === "youtube") kids.push(["img", { src: `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`, alt: "", draggable: "false" }]);
    kids.push(["span", { class: "ta-embed-play" }]);
    kids.push(["span", { class: "ta-embed-label" }, e ? `${e.title} · ${node.attrs.url}` : node.attrs.url]);
    return ["div", box, ...kids];
  },
  addCommands() {
    return { setVideoEmbed: ({ url }) => ({ commands }) => (videoEmbed(url) ? commands.insertContent({ type: this.name, attrs: { url: String(url).trim() } }) : false) };
  },
  addStorage() { return { markdown: {
    serialize(state, node) { if (!node.attrs.url) return; state.write(node.attrs.url); state.closeBlock(node); },
    parse: {},
  } }; },
});
// The paste: a video address on the clipboard becomes the embed. Runs before Link's own
// paste handler (priority 1000), which would otherwise link a selection with it.
const VideoEmbedPaste = Extension.create({
  name: "videoEmbedPaste",
  priority: 1100,
  addProseMirrorPlugins() {
    const { editor } = this;
    return [new Plugin({
      key: new PluginKey("videoEmbedPaste"),
      props: {
        handlePaste: (view, event) => {
          const text = ((event.clipboardData && event.clipboardData.getData("text/plain")) || "").trim();
          if (!videoEmbed(text)) return false;
          // Selected TEXT plus a pasted link means "link this", Link's job. A selection
          // that holds no text (a node, a range across a boundary) is treated as a caret.
          const { from, to, empty } = view.state.selection;
          if (!empty && view.state.doc.textBetween(from, to, " ").trim()) return false;
          return editor.commands.insertContent({ type: "videoEmbed", attrs: { url: text } });
        },
      },
    })];
  },
});

export { videoEmbed }; // the toolbar validates an address before asking the editor to embed it

export function create(host, { markdown = "", onChange, placeholder = "", resolveSrc } = {}) {
  const editor = new Editor({
    element: host,
    extensions: [
      StarterKit.configure({
        paragraph: false, heading: false, // replaced below (alignment-aware)
        underline: false,                 // markdown can't carry it
        link: { openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: "https" },
      }),
      AlignedParagraph,
      AlignedHeading.configure({ levels: [2, 3, 4, 5, 6] }), // the title is the H1
      makeImage(resolveSrc).configure({ inline: false, allowBase64: false }),
      VideoEmbed, VideoEmbedPaste,
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"], defaultAlignment: "left" }),
      Placeholder.configure({ placeholder }),
      // html: true lets the aligned blocks above round-trip; everything else is still markdown.
      Markdown.configure({ html: true, tightLists: true, bulletListMarker: "-", breaks: false, linkify: false, transformPastedText: true, transformCopiedText: false }),
    ],
    content: markdown,
    onUpdate: () => { if (onChange) onChange(); },
  });
  return {
    editor,
    getMarkdown: () => editor.storage.markdown.getMarkdown(),
    setMarkdown: (md) => editor.commands.setContent(md || ""),
    destroy: () => editor.destroy(),
  };
}
