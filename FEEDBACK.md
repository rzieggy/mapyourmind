# mapyourmind feedback list

Zieggy's feedback from real use, waiting for a fix. Newest at the bottom. Move an item to Done with the commit when it ships.

## Open

| # | Date | Area | Feedback | Expected | Notes |
| --- | --- | --- | --- | --- | --- |
| F11 | 2026-10-06 | Style panel / stroke | The "Remove stroke / Add stroke" button feels redundant now that stroke has a colour row. | Remove the button. The Stroke preset row gets a **transparent** swatch (the same checkered-with-slash swatch Fill uses), first in the row. Picking it makes the stroke transparent; picking any colour brings the stroke back. | Button: `#transparentStroke` (`web/index.html`, handler ~`web/app.js` L3180, visibility in `inspect()` ~L3021). Today a strokeless shape **hides** the stroke colour row (`strokeless` in `inspect()`); that has to go, or the colour row (and the way back) disappears. Keep stroke width/sloppiness visible as now, keep hiding stroke style while transparent. Images use the same button as "Remove border": give them the transparent swatch too (and keep the quiet 1px default when a border comes back), or decide images keep a button. Undo stays one step. Update the feedback.js stroke tests. |
| F12 | 2026-10-06 | Style panel / highlight | Highlight has no way to take a highlight off from the palette. | The Highlight row gets a **transparent** swatch (first in the row) that removes the highlight from the selected text. | Highlight swatches are built in `web/features.js` (~L455) and call `applyTextFormat("highlight", color)`. Check what value means "no highlight" in the marks (likely removing the `highlight` key rather than storing "transparent"), so saved marks stay valid for JS and native validation, and the toggle (⌘⇧H?) still works. |

## Done

| # | Fixed in | Note |
| --- | --- | --- |
| F9 | 2026-10-06 | Shift + drag on flowchart shapes locks the move to its main axis and lines the other axis up with a connected shape within 40 screen px (dashed guide), so that connector is straight; otherwise a plain axis lock. Pressing/releasing Shift mid-drag applies at once. |
| F10 | 2026-10-06 | The app version ("mapyourmind 1.x.y") shows at the bottom left of the sidebar, under Trash, in the app and in browser mode. |
| F5 | Batch B (2026-10-05) | New mind-map nodes carry `fitWidth: true` and fit their width to the longest line (text 60–320px, roots 120–360px); a hand resize of the width clears the flag. Existing nodes are unchanged. |
| F6 | Batch B (2026-10-05) | `layout` tracks up/down extents per subtree; a placeholder only adds to `up`, and an only child always sits on its parent's line. On a copy of the real library, documents without placeholders lay out identically (0 of 766 mind nodes moved). |
| F8 | Batch B (2026-10-05) | `M.placeholder` copies sloppiness, stroke width/colour/style, font family and size from its owner, keeps the yellow fill, and its height fits its text. |
| F1 | Batch C, `40aba6e` (2026-10-05) | A marquee also selects every connector whose drawn line or label touches the box, even with an end shape outside; font and other style changes then reach connector labels. |
| F4 | Batch C, `40aba6e` (2026-10-05) | A selected connector draws a soft blue halo along its `edgePolyline` path and behind its label (single and multi-select), under the shapes; never in View only, PNG or PDF. |
| F2 | Batch D, `f86238f` (2026-10-05) | Stroke and Text colour have the preset row (black, white, grey, red, orange, green, blue, violet) with the custom picker pinned at the right, like Fill. |
| F3 | Batch D, `f86238f` (2026-10-05) | No swatch in the style panel has a border; the selected one shows only the blue ring, and only white keeps an inset hairline. |
| F7 | Batch D, `fd74215` (2026-10-05) | Settings is four global choices (font, sloppiness, stroke width, font size) for new elements only; After Start / end removed (always a white rectangle); old per-shape preference files load and their entries are dropped. |
