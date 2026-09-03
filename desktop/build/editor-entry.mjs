// Entry for desktop/vendor/editor.js (see bundle-editor.cjs). The renderer gets
// window.TAEditor.create(host, opts) → { editor, getMarkdown, setMarkdown, destroy }.
// Markdown is the file format: what the toolbar can't express can't get into the
// document, so what's saved always re-opens identically.
import { Editor, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "tiptap-markdown";

export function create(host, { markdown = "", onChange, placeholder = "", resolveSrc } = {}) {
  // Content keeps site paths (/images/x.avif); the preview needs a URL the app can load.
  const Img = Image.extend({
    renderHTML({ HTMLAttributes }) {
      const attrs = { ...HTMLAttributes };
      if (resolveSrc && attrs.src) attrs.src = resolveSrc(attrs.src);
      return ["img", mergeAttributes(this.options.HTMLAttributes, attrs)];
    },
  });
  const editor = new Editor({
    element: host,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] }, // the title is the H1
        underline: false,            // markdown can't carry it
        link: { openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: "https" },
      }),
      Img.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({ html: false, tightLists: true, bulletListMarker: "-", breaks: false, linkify: false, transformPastedText: true, transformCopiedText: false }),
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
