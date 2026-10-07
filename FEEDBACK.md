# mapyourmind feedback list

Zieggy's feedback from real use, waiting for a fix. Newest at the bottom. Move an item to Done with the commit when it ships.

## Open

| # | Date | Area | Feedback | Expected | Notes |
| --- | --- | --- | --- | --- | --- |

## Done

| # | Fixed in | Note |
| --- | --- | --- |
| F19 | 2026-10-07 | Folders in the sidebar (new folder, drag in/out, Move to folder, fold, delete keeps documents) and double-click rename for documents and folders. |
| F21 | 2026-10-06 | Tab/Enter from an older (one-line) rectangle now makes a new three-line rectangle; the old one keeps its size. A rectangle growing past three lines keeps growing up and down evenly so Tab chains stay straight (Zieggy, 2026-10-06). |
| F20 | 2026-10-06 | Bug: typing in a new mind-map child (or any text) and deleting it all made the field two lines tall. WebKit leaves a placeholder `<br>` in an emptied contenteditable, which was read as a newline. `placeholderBreak` in `web/rich-text.js` now skips it when reading the editor. Covered for mind-map text, rectangles and free text. |
| F14 | `b050301` (2026-10-06) | No columns: each mind-map child starts 92px after its own parent's right edge (80px below its bottom in vertical maps, plus room for its row's tallest placeholder), so connectors have one length and short branches stay compact. Fit-width maximum raised to 440px text / 480px roots (about 45 characters). Existing maps reflow the next time they are edited. On a copy of the library 7 of 21 mind maps change; the mean visible connector gap drops from 99px (max 345) to 91px (max 110). |
| F15 | `9372eb6` (2026-10-06) | While a text-style mind-map node is edited, the field has a 1px #2474D0 outline 3px outside it, growing with the text, no handles; gone on commit, never exported. Shapes and free text keep the borderless field. |
| F17 | `3d6784d` (2026-10-06) | New free text (Text tool, double-click, pasted text) fits its width like mind-map text (60–440px, height from lines, no fill/stroke); a hand resize fixes the width. Mind-map nodes stay `kind: "mind"`; older free text keeps its width. |
| F16 | `e89d01a` (2026-10-06) | New rectangles carry `minLines: 3`: 180px wide, at least three lines tall at their font size, centred text; 1–3 lines never resize, line 4 grows the box (about its centre, via `reflow`). Tab/Enter copy the marker, After Start / end sets it; older rectangles keep their size. |
| F18 | `e5b2fb0` (2026-10-06) | "Open in browser" button (globe icon) at the top right of the editor header and in the document title menu; hidden inside browser mode. Kept for Notes, which browser mode also serves. |
| F13 | 2026-10-06 | View only and the header Pointer button are gone. Pointer is a rail tool (P with nothing selected, or the button; native menu View › Pointer). While on: no selection or edits, red fading trail, zoom/Space-drag/Find/fold still work and folds are temporary. Esc, P or any other tool leaves it. |
| F11 | 2026-10-06 | The Remove/Add stroke (and image Remove/Add border) button is gone. The Stroke row starts with a No stroke swatch for shapes and images (hidden for free text, stickers and connectors); the row stays visible while strokeless, and any colour brings the stroke back (an image border returns thin, solid and clean). |
| F12 | 2026-10-06 | The Highlight row starts with a No highlight swatch that removes the highlight (stored as no `highlight` key, never a colour). |
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
