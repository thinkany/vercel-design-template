// Entry for desktop/vendor/editor.js (see bundle-editor.cjs). The renderer gets
// window.TAEditor.create(host, opts) → { editor, getMarkdown, setMarkdown, destroy }.
// Markdown is the file format. Two things markdown can't say are written as small
// HTML blocks inside it, which every renderer here carries and the editor reads back:
// an ALIGNED paragraph / heading (<p style="text-align:center">…</p>) and an ALIGNED
// image (<img … data-align="right" style="float:right…">). Everything else stays
// plain markdown, so what's saved always re-opens identically.
import { Editor, mergeAttributes, getHTMLFromFragment } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
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
