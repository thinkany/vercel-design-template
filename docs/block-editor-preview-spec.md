# Block editor with live preview

**Status:** spec'd 2026-09-03, building the same day (Rob: "write the spec then build").

## Goal

Editing a block's content on a page shows the block as designed while you edit it:
fields on the left, the rendered block on the right, updating as you type. The
designer never edits blind.

## Decisions (made with Rob's brief)

1. **Default, not opt-in.** Every block's "Edit content" opens the two-pane view.
   There is no separate "edit with preview" action.
2. **The block alone first.** The preview renders the one block at the site's
   container width, without header, footer or neighbours. Showing neighbours dimmed
   (for rhythm and alternating layouts) is a later refinement.

## How it works

- **Left pane**: the existing props editor for the block (text, rich text, images,
  choices, lists, side), unchanged.
- **Right pane**: a webview onto the design surface in a new mode,
  `/?v=<design>&blockpreview=<type>`, which renders one block from props pushed
  into the page (`window.__taSetBlockProps(props)`). The design surface already
  shares the block code and Tailwind sources with the Site tab, so the preview is
  the real block with the design's tokens, fonts and images.
- **Live**: every editor change (already an `onChange` callback) pushes the draft
  props, debounced by 150 ms. Invalid content (a required field emptied) shows the
  same in-surface note the site build would raise, instead of a broken block.
- **Width**: Desktop renders the block at 1280 px and scales the webview to the
  pane (zoom factor), so proportions match the site; Mobile renders at 390 px.
- **Save** is unchanged: the page's Save writes the file; the preview shows the
  unsaved draft until then.

## Out of scope (for now)

Neighbouring blocks in the preview; previewing a content type's template (its
`{{field}}` placeholders would render literally); previewing chrome (header,
footer), which is edited in Navigation and shown on the Site tab.

## Files

- `src/app/site-bridge.tsx`: `BlockPreview` (CORE, ships to projects on refresh).
- `src/app/App.tsx`: the `blockpreview` mode.
- `desktop/shell.js`: `siteBlockPreview()` + the two-pane layout in the page editor.
