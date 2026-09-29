# mapyourmind Interaction Quality PRD

**Status:** Planning draft for review  
**Target product name:** `mapyourmind`  
**Current product baseline:** Excalidravv 1.3  
**Document type:** Product interaction specification and delivery plan  
**Implementation status:** Not started; this document intentionally makes no source-code changes  
**Primary benchmark:** Whimsical's interaction discipline, not its branding or full product surface  
**Last product-decision update:** 2026-09-28

---

## Revision note — 2026-09-28

This revision locks five newly approved directions:

1. Rename the user-facing application from Excalidravv to lowercase `mapyourmind`, without changing the legacy identity and storage paths that protect existing local documents.
2. Give mind-map parent-to-child connectors destination arrows by default, using the same arrow renderer as Flowchart connectors and a targeted non-routing migration for existing tree edges.
3. Treat the supplied Google Sans caret/glyph collision as a Release A blocker, with cross-font metric, zoom, line-wrap, Unicode, and caret-boundary acceptance tests.
4. Add a dedicated Line element as an independent canvas primitive for axes, dividers, separators, and diagram scaffolding; it is not an unattached connector.
5. Add a minimal offline built-in template system, with an original editable Eisenhower Matrix as the first template and acceptance fixture.

No implementation is authorized or included in this revision.

---

## 1. Executive summary

This PRD renames Excalidravv to **`mapyourmind`** and upgrades it from a capable local diagram editor into an editor that feels dependable, fast, and spatially intelligent.

The proposal does **not** attempt to reproduce Whimsical wholesale. `mapyourmind` should remain a compact, offline, Mac-native flowchart and mind-map tool with its current hand-drawn identity. The useful lesson from Whimsical is its interaction model:

- the canvas receives most of the user's attention;
- common actions are immediate and contextual;
- keyboard creation is a first-class workflow;
- new objects behave predictably relative to their source;
- alignment and connector routing quietly maintain visual order;
- advanced actions remain discoverable without permanently occupying the canvas.

The work is organized into six connected programs:

1. **Canvas trust:** pasted content must appear visibly, selected text and carets must stay crisp and correctly positioned across supported fonts, and right-click must never leave an unexplained blue state.
2. **Contextual inspector:** transparent colors, horizontally scrollable swatches, layer controls, and object-specific sections must fit without squeezing the panel.
3. **Keyboard-first creation:** `Tab` and `Enter` must create nodes that inherit the complete visual style of their source node, while preserving the structural rules of flowcharts and mind maps.
4. **Composition and reusable starting points:** Line must provide lightweight visual structure, while built-in templates insert ordinary editable elements instead of trapping content inside a special template object.
5. **Spatial intelligence:** dragging must communicate alignment, snapping, equal spacing, and axis constraints without fighting the user.
6. **Connector quality:** connectors must maintain deliberate clearances, stable routes, attractive bends, predictable attachment points, manual flexibility, and consistent source-to-destination arrows in both Flowchart and Mind Map modes.

The recommended delivery order is deliberately conservative:

- **Release A — Trust:** paste visibility, selection clarity, text and caret fidelity, swatches, and layer controls.
- **Release B — Speed:** full style inheritance and a command menu.
- **Release C — Composition and templates:** Line, built-in template insertion, and the Eisenhower Matrix starter.
- **Release D — Spatial intelligence:** drag guides, snapping rules, spacing indicators, and multi-object layout actions.
- **Release E — Connector quality:** automatic orthogonal routing, stable rerouting, manual waypoints, and connector editing.

Connector work comes last because it depends on reliable selection, movement, layering, undo, and property inheritance. A visually sophisticated connector system will still feel broken if the underlying canvas is unpredictable.

---

## 2. Background and evidence

### 2.1 Current Excalidravv baseline

Excalidravv 1.3 already includes substantial foundations that should be preserved:

- offline local document storage;
- Flowchart and Mind Map modes;
- `Tab` and `Enter` node creation;
- hover connection ports;
- straight, curved, and elbow connectors;
- persistent connector attachment after node movement or resizing;
- mind-map layout and branch reordering;
- grouping, alignment, and distribution;
- selection, duplicate, copy, paste, undo, and redo;
- rich text, highlighting, comments, collapsed branches, and image paste;
- consistent Canvas and PNG rendering using seeded Rough.js geometry.

This plan is therefore a refinement of an existing interaction system, not a rebuild.

### 2.2 Current implementation observations

The existing implementation explains several reported behaviors:

- Editable paste preserves the copied object's original world coordinates and adds a fixed 36-pixel offset. When the destination document has a different camera position or the copied objects were far from the origin, the elements can be added to the model while remaining outside the visible viewport.
- New nodes created by `Tab` or `Enter` are constructed from defaults. They do not currently copy the source node's visual properties.
- The text editor overlay is positioned in canvas coordinates and scaled with a CSS transform. Fractional zoom values can cause browser rasterization that makes active text appear blurry.
- In the supplied Google Sans example, the caret visually intersects the final letter instead of occupying a clean boundary between grapheme clusters. This indicates a font-metric or editor-geometry mismatch, not merely an aesthetic difference between fonts.
- Right-click explicitly replaces the current selection with the clicked node before displaying the menu. Combined with pointer-event sequencing, this can produce a persistent or visually confusing selection state.
- Alignment guides and snapping already exist for non-mind-map nodes, but their modifier behavior and presentation do not match the desired interaction.
- Connectors already render behind nodes and use stable seeded sketch geometry. This is a strong base for better routing.
- The inspector has a fixed width and the color swatches are a non-wrapping flex row without an explicit overflow strategy, so adding colors can visually squeeze the available space.

### 2.3 Reference-product observations

The Whimsical reference is valuable for the following principles:

- minimal permanent chrome around the canvas;
- predictable, restrained connector visuals;
- connector clearance that makes relationships readable;
- automatic alignment and tidy spacing;
- keyboard-first diagram growth;
- a searchable, contextual command menu;
- progressive disclosure: advanced features appear when relevant instead of remaining permanently visible.

The following Whimsical areas are explicitly **not** part of this plan:

- a cloud template marketplace, community template discovery, or remote template download;
- workspace collaboration;
- accounts, sharing, comments with identity, or cloud presence;
- a full left-side Whimsical tool rail;
- AI creation;
- wireframing tools;
- a broad visual rebrand beyond changing the product name to `mapyourmind`.

### 2.4 Product naming decision

The product's user-facing name becomes **`mapyourmind`**, written in lowercase.

The rename covers the eventual implementation surfaces below:

- application display name;
- executable and `.app` package display name;
- menu-bar application name;
- About dialog and window title;
- home/library branding;
- default export naming where the product name is used;
- distributable archive names;
- README, user guide, changelog, and handoff documentation;
- accessibility labels or help text that mention the old product name.

Compatibility constraints:

- Keep the existing bundle identifier `app.localflowchart.mac` unless a separately approved migration proves a new identifier can preserve all documents safely.
- Keep the existing data directory `~/Library/Application Support/Local Flowchart/` for continuity.
- Existing documents must appear automatically after the rename; the rename must not create a second empty document library.
- Saved document format and schema remain independent from the marketing/display name.
- Do not rewrite user document content merely because the application name changed.
- Package and documentation filenames may adopt `mapyourmind`, but compatibility paths must remain intentionally legacy where required.

The name change is a product-label migration, not authorization for a new logo, color system, or broad visual redesign.

---

## 3. Product goal

### 3.1 Primary goal

A user should be able to build and rearrange a readable diagram at the speed of thought without repeatedly correcting styles, hunting for pasted content, manually repairing connector routes, or wondering why the canvas changed state.

### 3.2 Desired user perception

After the work is complete, `mapyourmind` should feel:

- **dependable:** actions always produce visible, reversible results;
- **fast:** repeated diagram creation does not require repeated styling;
- **calm:** the UI reveals complexity only when relevant;
- **spatially aware:** objects and connectors naturally settle into readable positions;
- **flexible:** automatic behavior assists but never traps the user;
- **local and lightweight:** none of the improvements add an account, network dependency, or heavy application framework.

### 3.3 Core success scenarios

1. A user copies a 200-element diagram from one document, opens a new document, pastes it, and immediately sees the pasted diagram selected in the viewport.
2. A user styles one node, presses `Tab` or `Enter` repeatedly, and every new node matches the source node without restyling.
3. A user right-clicks a node, chooses or dismisses an action, and the selection state remains understandable and easy to clear.
4. A user edits text in Excalifont, Google Sans when available, and supported fallbacks at 57%, 100%, and 175% zoom; glyphs stay sharp and the caret remains between characters rather than intersecting them.
5. A user drags a node while holding `Shift`, receives useful axis and alignment feedback, and can still deliberately position the node elsewhere.
6. A user moves nodes around a flowchart and connectors reroute into stable, readable paths with appropriate clearance.
7. A user manually adjusts a connector path and `mapyourmind` preserves that intentional route during later node movement.
8. A user draws a Line as a visual axis or divider, edits its endpoints, and the element never binds or reroutes like a connector.
9. A user chooses the built-in Eisenhower Matrix template and receives a visible, selected, undoable set of normal editable shapes, lines, and text in the current document.

---

## 4. Product principles

### 4.1 Predictability before cleverness

Automatic placement and routing must never make the user's diagram jump unpredictably. Stable, slightly imperfect behavior is preferable to a constantly changing “optimal” route.

### 4.2 Source node as the style authority

For keyboard-created nodes, the selected source node is the visual template. Global defaults are used only when there is no eligible source node.

### 4.3 Automation must be reversible

Every auto-placement, auto-route, alignment, layering, and inheritance action must be covered by undo and must not erase manual intent.

### 4.4 Canvas space is more valuable than persistent controls

High-frequency actions may appear contextually. Low-frequency actions belong in the inspector, right-click menu, application menu, or command menu.

### 4.5 Selection is an overlay, not a restyle

Selecting or right-clicking an object must not alter its fill, text rendering, opacity, or persistent visual properties. Selection visuals must be drawn independently from document content.

### 4.6 Auto behavior should degrade gracefully

When the routing or alignment engine cannot produce a clearly better answer, it should preserve the last valid state rather than generating a surprising layout.

### 4.7 Existing documents remain visually stable except for approved migrations

New defaults and routing rules apply to newly created elements unless a user explicitly requests a cleanup or reset. Opening an older document must not silently re-route connectors or reorder nodes.

Two explicitly approved compatibility-safe presentation changes are exceptions:

- the application chrome uses the new `mapyourmind` name;
- existing structural mind-map tree connectors gain a destination arrow so old and new mind maps share the same directional language.

The tree-arrow migration must not change connector endpoints, curves, node positions, parentage, or manual cross-links.

---

## 5. Scope

### 5.1 In scope

- reliable placement of pasted editable elements, images, and plain text;
- crisp text editing, accurate caret placement, and selection rendering across zoom levels and supported fonts;
- right-click and selection-state corrections;
- transparent fill option;
- horizontally scrollable color swatches without a visible scrollbar;
- layer controls in the right inspector;
- contextual organization of the inspector;
- complete source-style inheritance for `Tab` and `Enter` creation;
- command menu with contextual actions;
- independent Line element with endpoint editing, optional arrowheads, and normal arrange/group/copy/paste behavior;
- built-in offline template picker and insertion pipeline;
- original editable Eisenhower Matrix template;
- axis locking, snapping guides, alignment guides, and equal-spacing feedback;
- improved multi-object alignment and distribution behavior;
- automatic connector side selection;
- improved straight, curved, and orthogonal connector routing;
- arrowed parent-to-child mind-map tree connectors by default;
- stable rerouting after movement and resize;
- manual connector waypoints;
- undo, redo, save, reopen, editable copy, and PNG-export compatibility;
- keyboard and assistive-technology considerations for all new controls.

### 5.2 Explicitly out of scope

- cloud, community, or marketplace template galleries;
- importing user-authored template packages in the first template release;
- syncing templates between devices;
- cloud synchronization or collaboration;
- user accounts or shared cursors;
- AI diagram generation;
- importing or exporting editable Whimsical, Excalidraw, SVG, or PDF files;
- full automatic graph layout for arbitrary flowcharts;
- connector labels in the first connector-quality release;
- animation-heavy transitions;
- mobile or touch-first editing;
- a complete redesign of the home/document library;
- a new visual identity beyond the approved `mapyourmind` name change;
- bundling or redistributing a Google Sans font file without a separately verified right to do so;
- changes to the bundle identifier or local data directory.

---

## 6. Information architecture and UI model

### 6.1 Preserve the current top toolbar

The plan does not move all tools to a Whimsical-style left rail. That would be an expensive visual rewrite with little direct benefit to the reported problems.

The top toolbar remains responsible for mode-level tools:

- Select;
- Hand/Pan;
- Shape;
- Mind Map;
- Text;
- Connector;
- Line;
- Templates.

Line is a drawing tool. Templates opens a lightweight chooser and is not itself a persistent canvas mode. If the added buttons make the toolbar crowded, Templates may live in an Insert control with a clearly labeled command-menu entry; it must not be hidden only behind keyboard search.

The toolbar must remain compact and must not absorb style, arrangement, or routing controls.

### 6.2 Right inspector structure

The right inspector becomes a contextual property panel with clear sections. Sections appear only when they apply to the current selection.

#### Single shape selection

1. **Appearance**
   - shape type;
   - fill;
   - stroke color;
   - stroke width;
   - stroke style/sloppiness when supported;
   - opacity when supported.
2. **Text**
   - font family;
   - font size;
   - text color;
   - text alignment;
   - bold, underline, and highlight;
   - highlight color.
3. **Arrange**
   - bring to front;
   - bring forward one step;
   - send backward one step;
   - send to back.
4. **Actions**
   - comment;
   - duplicate;
   - delete.

#### Multiple shape selection

1. common or mixed appearance values;
2. align controls;
3. distribute controls;
4. group or ungroup;
5. arrange controls;
6. duplicate and delete.

#### Connector selection

1. connector type;
2. line color and width;
3. arrowhead state;
4. automatic or manual routing state;
5. reset route;
6. reverse direction when introduced;
7. delete.

#### Line selection

1. stroke color and width;
2. solid, dashed, or dotted stroke style;
3. sloppiness/roughness when supported;
4. opacity when supported;
5. start and end arrowhead controls, both off by default;
6. arrange controls;
7. duplicate and delete.

#### Image selection

1. arrange controls;
2. duplicate;
3. delete;
4. future image-specific properties only when implemented.

### 6.3 Inspector width and scrolling

- Keep the existing narrow footprint; target width is approximately 200–220 pixels.
- The inspector may vertically scroll, but the browser's visible scrollbar should remain subtle.
- Color rows must never shrink their swatches to fit.
- Color rows use horizontal scrolling with hidden scrollbar chrome.
- Trackpad horizontal swipe, Shift+wheel, and keyboard arrow navigation must work.
- The leftmost swatch must remain reachable without scrolling.

### 6.4 Contextual action strip

A small contextual action strip may be introduced after the trust release. It is not required for Release A.

Recommended contents:

- **single node:** fill, stroke, duplicate, quick-connect;
- **multiple nodes:** align, distribute, group;
- **connector:** route type, arrowhead, reset route.

The strip must not duplicate the entire inspector. It exists only to reduce travel for the most frequent actions.

### 6.5 Command menu

`Command K` opens a centered command menu. `Control K` may be supported for consistency in the embedded web layer, but the user-facing Mac shortcut is `Command K`.

The command menu contains:

- a search input;
- recently used commands;
- commands filtered by the current context;
- shortcut labels;
- categories when browsing all commands.

Initial categories:

- Tools;
- Edit;
- Object;
- Insert;
- Arrange;
- Connector;
- View;
- Document;
- Help.

Context rules:

- Object actions rank first when a node is selected.
- Connector actions rank first when a connector is selected.
- Align and distribute actions appear when multiple eligible objects are selected.
- Commands that cannot run may be omitted rather than shown disabled, except when their presence teaches an important capability.
- Commands must use descriptive verbs: “Bring to front,” not “Front.”
- `Insert template…` and `Line tool` are searchable from any non-modal canvas state.

Keyboard behavior:

- typing filters immediately;
- Up/Down moves through results;
- Enter runs the highlighted command;
- Escape closes the menu and restores canvas focus;
- focus is trapped inside the menu while open;
- the menu closes after a successful command unless the command explicitly opens another surface.

---

## 7. Detailed interaction specification

## 7.1 Paste visibility and placement

### Problem

The element count increases after paste, but the pasted result can remain outside the visible viewport because its original world coordinates are preserved with only a small fixed offset.

### Desired behavior

Every successful paste produces a visible, selected result.

### Placement algorithm

For editable diagram content:

1. Parse and validate the clipboard payload.
2. Compute the complete pasted bounds from nodes and internal connectors.
3. Preserve all relative node positions and internal connector relationships.
4. Calculate the visible canvas rectangle in world coordinates, excluding practical obstruction from the right inspector.
5. Place the center of the pasted bounds at the center of the usable viewport.
6. Apply a cascade offset for repeated paste of the same clipboard payload.
7. Clamp the result so at least the selection's meaningful leading area remains inside a safe viewport margin.
8. Select all pasted elements.
9. Draw the selection bounds immediately.
10. Record the entire paste as one undoable operation.

### Repeated-paste behavior

- First paste: centered in the usable viewport.
- Consecutive paste from the unchanged clipboard: offset by 24 screen pixels right and 24 screen pixels down.
- Offset is screen-relative, not world-relative, so it remains perceptible at every zoom.
- If the offset would place the selection outside the safe viewport, restart the cascade near the center.
- Changing the clipboard, changing documents, or clicking elsewhere resets the cascade.

### Large pasted diagrams

- Do not automatically zoom out on ordinary paste.
- If the pasted bounds are larger than the usable viewport in both dimensions, center the diagram and minimally zoom out only far enough to show a meaningful portion, with a lower zoom limit consistent with the existing application.
- Never alter zoom if the pasted content already fits.
- A future “Zoom to selection” command remains available for intentional framing.

### Plain text paste

- Plain text pasted on the canvas creates a free-text element at the usable viewport center.
- The new element is selected and visible.
- Long text may auto-size within existing limits but must not extend entirely behind the inspector.

### Image paste

- Image paste follows the same usable-viewport centering rule.
- Images larger than the viewport are proportionally downscaled for initial placement without changing their embedded source data.
- Undo removes the image in one step.

### Failure behavior

- Invalid editable payload falls back to image or text only when those clipboard representations exist.
- A rejected or unsupported paste shows a concise toast and creates nothing.
- Partial paste is not allowed: either the complete validated payload is inserted or no model change occurs.

### Acceptance criteria

- Pasting into a new empty document always places content visibly.
- Pasting while panned far from the document origin remains visible.
- Pasting at 25%, 57%, 100%, and 200% zoom remains visible.
- Repeated paste creates distinguishable cascaded copies.
- A 200-element payload preserves its internal geometry and connectors.
- Undo removes the entire pasted selection in one action; redo restores it in the same position.
- Save and reopen preserve the pasted content.

---

## 7.2 Selection and right-click behavior

### Problem

Right-click can create an unexplained blue or persistent selection state that is difficult to dismiss. Selection must remain clearly distinct from object styling.

### Selection rules

- Left-click an unselected node: select only that node.
- Left-click a selected node: keep it selected and prepare for drag.
- Shift+click: toggle the clicked object in the selection.
- Click empty canvas: clear the selection.
- Escape: cancel an active interaction first; otherwise close transient UI; otherwise clear selection.
- Selecting a connector does not change its underlying line color.
- Selection overlays are not included in PNG export.

### Right-click rules

- Right-click an unselected node: select that node and open its context menu.
- Right-click a node already included in a multi-selection: preserve the multi-selection and open a context menu for the selection.
- Right-click empty canvas: close the menu; future canvas commands may be added separately.
- Right-click never starts a marquee, move, pan, connector drag, or text selection.
- Dismissing the menu does not create a second selection mutation.

### Visual treatment

- Use a neutral dashed or solid outline around the selected node.
- Do not place a colored translucent wash over the node content.
- Resize handles remain white with neutral borders.
- Connector selection may use a wider, low-opacity neutral hit highlight beneath the actual connector.
- Focus and selection colors must remain distinguishable without relying on blue alone.

### Context-menu contents

Single node:

- Comment;
- Add child or sibling when applicable;
- Duplicate;
- Copy style;
- Paste style when available;
- Collapse/Expand branch when applicable;
- Arrange submenu;
- Delete.

Multi-selection:

- Align submenu;
- Distribute submenu;
- Group/Ungroup;
- Arrange submenu;
- Duplicate;
- Delete.

Connector:

- Connector type;
- Reset route;
- Reverse direction when implemented;
- Delete.

### Acceptance criteria

- Right-click never produces a canvas-wide or node-wide blue overlay.
- Menu dismissal through Escape, outside click, or command completion leaves a valid selection state.
- One Escape from an idle selected state clears the selection.
- Right-clicking one member of a multi-selection does not unexpectedly discard the other members.
- The menu is fully keyboard navigable.

---

## 7.3 Font, text, and caret fidelity at every zoom

### Problem

The editing overlay is scaled using a CSS transform. Fractional transforms can rasterize text and caret edges, causing blur while a node is selected or actively edited.

The 2026-09-28 Google Sans screenshot adds a separate correctness issue: the caret appears to cut through the final `s` in “Risk assess.” A user can no longer reliably tell whether the caret is before, inside, or after the character. This is a blocker for a keyboard-first editor.

### Font-compatibility contract

The canvas renderer and the active editor must use the same effective typography for a node:

- font family and ordered fallback stack;
- font size;
- font weight;
- font style;
- letter spacing;
- word spacing;
- line height;
- text alignment;
- text-transform behavior;
- horizontal and vertical padding;
- width available for line wrapping.

The caret must be positioned by the active editing surface using the same font metrics that produce the visible glyphs. No manual character-width approximation may determine caret placement.

Supported-font policy:

- Excalifont remains supported.
- Google Sans is a required compatibility case when it is legitimately available in the runtime environment.
- `mapyourmind` must provide a defined fallback when Google Sans is unavailable; it must not silently use different fonts for Canvas paint and active editing.
- This PRD does not authorize bundling or redistributing a Google Sans font file. Font packaging requires a separate rights and distribution decision.
- The app must behave correctly with proportional sans-serif metrics, not only handwriting-font metrics.

### Rendering decision

The active text editor should be laid out directly in screen coordinates rather than rendered at document scale and then transformed.

Conceptually:

- node position and size are converted from world space to screen space;
- the editor receives final pixel `left`, `top`, `width`, and `height` values;
- font size, padding, and border values are calculated at the active zoom;
- no fractional parent transform scales the entire editor surface;
- the resolved font family is applied directly to the editor instead of being overridden by a global UI-font rule;
- document text continues using the existing canonical model and rich-text marks.

### Pixel alignment

- Round screen-space boundaries to device-pixel-aware values.
- Keep caret and glyph positioning stable when the canvas pans.
- Do not visibly jump between the painted node and the editing overlay.
- Preserve current text alignment and vertical centering.
- Keep the caret at valid grapheme boundaries; it must never visually divide the interior stroke of the adjacent glyph.
- Preserve browser-native selection and caret behavior rather than drawing a simulated caret.

### Zoom behavior

- At very small zoom, entering edit mode may temporarily render text at a legible minimum while keeping the node bounds visibly anchored.
- The minimum edit font must not change the stored font size.
- On commit, painted text must match stored size and alignment.

### Rich-text compatibility

- Bold, underline, highlight, list formatting, selection ranges, IME composition, and Unicode must continue to work.
- Changing inspector properties while editing must preserve the text selection.
- Selection handles and the active editor must not visually overlap in a way that makes the node appear double-bordered.
- Switching fonts while editing must preserve the text, selection range, and node alignment.

### Acceptance criteria

- Text appears sharp at 50%, 57%, 75%, 100%, 125%, 150%, and 200% zoom on a Retina display.
- No visible position jump occurs when entering or leaving edit mode.
- Caret placement matches the clicked character.
- With the exact string `Risk assess`, placing the caret after the final `s` displays it after the glyph, not through the glyph.
- Google Sans, when available, and the defined sans-serif fallback pass the same caret test at every supported font size.
- Arrow-key navigation moves through expected grapheme boundaries for ASCII, accented characters, emoji, and composed Unicode.
- Canvas paint and active editing use the same line breaks for the same node width.
- Rich formatting and IME composition remain functional.
- PNG output remains unchanged because export continues to use the canvas renderer.

---

## 7.4 Color rows and transparent fill

### Transparent fill

- Transparent is the first fill option.
- It uses a recognizable transparent treatment: checkerboard or diagonal slash, not an empty white circle.
- Its accessible name is “Transparent fill.”
- Transparent applies only to fill; stroke and text remain unaffected.

### Swatch layout

- Each swatch has a fixed size and may not shrink.
- The row does not wrap.
- Overflow scrolls horizontally.
- The visual scrollbar is hidden.
- A trackpad swipe moves the row naturally.
- Arrow keys move focus between swatches.
- Home/End move to the first/last swatch.
- The selected swatch uses both an outline and an accessible selected state.

### Highlight colors

- Highlight color uses the same horizontal-row behavior.
- Transparent/no highlight is the first option.
- Choosing no highlight removes highlighting from the active range or entire selected node according to current formatting rules.

### Mixed selection

- If selected nodes have different fill values, no swatch appears falsely selected.
- Applying a swatch sets that property across all eligible selected nodes.

### Acceptance criteria

- The inspector width does not change as colors are added.
- No swatch becomes narrower than its designed size.
- Every color is reachable by pointer, trackpad, and keyboard.
- The scrollbar is not visible during normal use.
- Transparent fill exports correctly on transparent and white PNG backgrounds.

---

## 7.5 Object layering

### Controls

The Arrange section includes four actions:

1. Bring to front;
2. Bring forward;
3. Send backward;
4. Send to back.

Each action uses an icon, tooltip, accessible label, and command-menu entry.

### Ordering model

- Node array order remains the node paint order unless a dedicated z-order value becomes necessary.
- Hit testing continues from front to back, matching paint order.
- Connectors remain behind nodes regardless of node ordering.
- Note badges and selection overlays remain above content as UI overlays.

### Multi-selection behavior

- Bring to front moves the selected block above unselected nodes while preserving relative order inside the selection.
- Send to back moves the selected block behind unselected nodes while preserving relative order.
- Bring forward moves each selected block one unselected layer forward without reversing internal order.
- Send backward behaves symmetrically.
- Grouped elements retain their internal order.

### Mind-map considerations

- Layering changes paint and hit-test order only.
- It must not change parentage, sibling order, layout direction, or connector ownership.

### Acceptance criteria

- All four actions are undoable and redoable.
- Save and reopen preserve the chosen order.
- Copy and editable paste preserve relative order inside the copied selection.
- Layer changes do not alter connector attachments or mind-map hierarchy.

---

## 7.6 Keyboard-first node creation

### Structural semantics

Flowchart mode:

- `Tab`: create a connected node in the primary forward direction, currently to the right.
- `Enter`: create a connected node in the secondary direction, currently below.

Mind Map mode:

- `Tab`: create a child of the selected node.
- `Enter`: create a sibling after the selected node.
- `Enter` on a root: create another independent root according to existing behavior.
- `Shift Tab`: future candidate for moving selection to the parent; excluded from the first inheritance release unless explicitly approved.

### Interaction sequence

1. User selects or finishes editing a node.
2. User presses `Tab` or `Enter`.
3. `mapyourmind` creates one new node.
4. The new node receives its structure and position from the mode rules.
5. The new node receives its visual style from the source node.
6. A new structural connector is created using connector defaults appropriate to the mode.
7. The new node becomes selected.
8. Text editing begins immediately.
9. The node is kept inside the visible viewport.
10. The creation and initial text commit behave as one understandable undo sequence.

### Style-inheritance contract

The source node donates all eligible visual properties.

| Property | Inherit? | Notes |
| --- | --- | --- |
| Node kind | Yes | Flow node stays flow; mind node stays mind. |
| Shape | Yes | Includes rectangle, decision, pill, input/output, and note. |
| Width and height | Yes | New text may later auto-expand according to existing sizing rules. |
| Fill | Yes | Includes transparent. |
| Stroke color | Yes | Exact value. |
| Stroke width | Yes | Exact value. |
| Sloppiness/roughness | Yes when introduced | Stored node value, not a global default. |
| Opacity | Yes when introduced | Exact value. |
| Font family | Yes | Preserve the selected supported font, including Google Sans when legitimately available and the defined fallback otherwise. |
| Font size | Yes | Replaces the current default reset to 19 px. |
| Text color | Yes | Exact value. |
| Text alignment | Yes | Exact value. |
| Whole-node bold | Yes | Applied as the active typing style for the empty node. |
| Whole-node underline | Yes | Applied as the active typing style. |
| Whole-node highlight | Yes | Includes highlight color. |
| Mixed inline formatting | No direct range copy | Empty text has no meaningful ranges; only uniform source formatting becomes the new typing style. |
| Notes and replies | No | Content metadata is not visual style. |
| Collapsed state | No | New nodes begin expanded. |
| Group membership | No | A new structural node is not silently added to a visual group. |
| Parent and sibling order | Computed | Determined by `Tab`/`Enter` semantics. |
| Position | Computed | Determined by layout and collision avoidance. |
| Selection state | No | Only the new node becomes selected. |
| Existing connectors | No | Never clone the source node's old edges. |
| Image data | Not applicable | Image nodes cannot be extended with `Tab`/`Enter`. |
| ID | No | Always unique. |

### Important mind-map decision

The user's explicit requirement is that a new node match its source node. Therefore, the first version of this plan contains **no automatic visual exception for root-to-child creation**. If a purple pill root creates a child, that child inherits the purple pill styling.

This intentionally supersedes the current default where mind-map children become white rectangles. If preserving automatic root/child visual distinction is still desired, it must be approved as an explicit exception rather than happening silently.

### Connector inheritance boundary

The new node inherits node properties only. The newly created connector uses the relevant connector default:

- Flowchart structural connector: current/new board connector default, with arrow.
- Mind-map tree connector: curved tree style with an arrow at the child/destination end.

The source node's attached connectors are never copied.

### Collision and visibility behavior

- Flowchart extension searches for the nearest open placement in the requested direction.
- Search should preserve the user's requested direction before moving to fallback rows or columns.
- Mind-map creation continues using tree layout.
- The viewport pans only as much as needed to keep the new node and editing caret visible.
- The right inspector's occupied area is considered when determining visibility.

### Acceptance criteria

- Every property in the matrix behaves as specified in both modes.
- Sloppiness, font size, text alignment, transparent fill, and highlighting no longer reset to defaults.
- A customized decision node creates customized decision nodes.
- No existing connector is duplicated.
- Mind-map parentage remains valid with at most one tree parent.
- Repeated keypresses are debounced; key repeat never creates a flood of nodes.
- Undo and redo preserve structure, style, and text.
- Save/reopen and editable copy/paste preserve inherited style.

---

## 7.7 Alignment, snapping, and Shift-drag guidance

### Existing behavior to preserve

Excalidravv already performs center/edge snapping for non-mind-map nodes and draws guides. The refinement should improve intent communication and modifier consistency rather than discard this foundation.

### Default drag behavior

- Nearby edge and center alignment remains available during ordinary drag.
- Guides appear only while a valid snap candidate is within threshold.
- Snap thresholds are measured in screen pixels, so they feel consistent at different zoom levels.
- The system chooses at most one horizontal and one vertical guide at a time.
- Guides disappear immediately on pointer release or cancellation.

### Shift-drag behavior

`Shift` is a precision modifier:

- Once movement exceeds a small threshold, determine the dominant drag axis.
- Lock movement to that axis.
- Continue showing alignment candidates on the perpendicular axis.
- If the pointer clearly changes intent before the lock settles, recalculate once.
- Do not repeatedly flip axes during one drag.

Interaction conflict with Shift-selection:

- Shift+click without movement continues to toggle selection.
- Shift+drag on an already selected node moves the current selection with axis lock.
- Shift+drag beginning on an unselected node first adds it to selection, then moves the resulting selection only after the movement threshold is crossed.
- This behavior must be tested carefully to avoid accidental duplication of nodes in the selection.

### Snap override

`Command` while dragging temporarily disables object alignment snapping, preserving the existing implementation contract.

`Option` cannot be used as the snap override because Excalidravv already uses Option+drag to duplicate. This is an intentional difference from other diagram editors.

### Equal-spacing indicators

When dragging one or more nodes near a repeated spacing pattern:

- detect equal horizontal or vertical gaps;
- show small distance markers between the relevant nodes;
- snap only when the difference is within the screen-space threshold;
- avoid displaying more than the immediately relevant neighboring gaps;
- do not show equal-spacing indicators for automatic mind-map branch placement.

### Mind-map behavior

- Branch drag continues prioritizing reparent and sibling reorder semantics.
- Alignment guides apply to independent mind-map roots and manually positioned objects.
- Automatic child branches do not receive arbitrary free-position snapping that would conflict with tree layout.
- Shift may constrain root movement, but must not disable reparent/reorder feedback for a branch drag.

### Guide styling

- Use a high-contrast accent that remains visible against the pale canvas without resembling selection fill.
- Lines should be one screen pixel at normal scale.
- Center and edge guides may share color; equal-spacing markers use a distinct compact annotation.
- Guides are UI-only and never exported.

### Acceptance criteria

- Guide visibility and snap feel are consistent from 25% to 200% zoom.
- Shift locks movement predictably.
- Command temporarily disables snapping.
- Option+drag continues duplicating.
- Multi-selection moves as one unit.
- Pointer-up persists the final positions; no element snaps back afterward.
- Undo restores the complete pre-drag state.
- Branch reorder, reparent, and descendant alignment continue to pass existing tests.

---

## 7.8 Connector quality system

### Goal

Connectors should explain relationships without becoming the loudest visual element on the canvas. They should look intentionally spaced while remaining editable.

### Connector types

1. **Straight**
   - direct segment from source anchor to target anchor;
   - best for nearby nodes with a clear line of sight.
2. **Curved**
   - restrained cubic curve;
   - remains the default for mind-map tree edges;
   - mind-map tree edges use the same destination-arrow renderer as flowchart connectors;
   - control points remain within the available column or row gap.
3. **Elbow**
   - orthogonal route with horizontal and vertical segments;
   - preferred for process diagrams where clarity requires separation.
4. **Auto** — proposed for new flowchart connectors
   - chooses straight when the path is clear and readable;
   - chooses an elbow route when direct travel would cross an obstacle or create an awkward approach;
   - does not replace the stored style of legacy connectors.

### Arrow behavior

- Every newly created Flowchart structural connector has an arrow at the destination end by default.
- Every newly created Mind Map parent-to-child tree connector has an arrow at the child end by default.
- The same arrowhead geometry and rendering path are used in both modes; Mind Map does not maintain a separate arrow implementation.
- Curved, straight, elbow, and Auto connectors all derive the arrow direction from the final route segment.
- The connector inspector exposes the Arrowhead toggle for eligible mind-map tree connectors instead of hiding it.
- Turning off an arrow changes only presentation; it does not change mind-map parentage or source/destination semantics.
- Reparenting a mind-map node recalculates the structural connector so the arrow continues pointing to the child.
- Reversing a manual connector, if later implemented, swaps source/destination and therefore moves the arrow to the new destination.

### Attachment points

- Candidate anchors exist at the center of each side.
- Existing corner-adjacent ports may remain available for manual precision.
- Automatic routing should prefer side-center anchors because they produce calmer diagrams.
- The source side should generally face the target.
- The target side should generally face the source.
- Explicit user-selected sides remain authoritative until reset.

### Clearance rules

Recommended initial geometry values in world pixels at 100% zoom:

- endpoint stub: 24–32 px;
- obstacle inflation: 16 px around unrelated nodes;
- minimum useful intermediate segment: 20 px;
- preferred node-to-node gap for keyboard creation: approximately 80–96 px depending on orientation;
- rounded elbow visual radius: approximately 8–12 px when rendering supports it.

These values require visual tuning against Excalifont, the supported proportional sans-serif stack, and the existing node sizes. They are planning targets, not immutable constants.

### Automatic elbow routing

For an automatic elbow connector:

1. Inflate unrelated node bounds by the connector clearance.
2. Determine source and target anchor candidates.
3. Generate a small deterministic set of Manhattan-route candidates.
4. Reject candidates that cross inflated obstacles or pass through endpoint interiors.
5. Score the remaining candidates.
6. Select the lowest-cost stable candidate.

Suggested scoring priorities, highest penalty first:

- intersection with a node;
- departure or arrival through the wrong side;
- backtracking behind source or target;
- excessive bends;
- unnecessary total length;
- near-zero intermediate segments;
- route change relative to the last valid route.

The exact numeric weights should be tuned through fixtures, but node intersections must dominate all aesthetic preferences.

### Route stability

Prevent connector jitter:

- retain the current route while it remains valid;
- switch routes only when the current route becomes invalid or a new route is meaningfully better;
- use deterministic candidate ordering;
- do not re-route unaffected connectors when an unrelated node moves far away;
- preserve explicitly selected endpoint sides.

### Manual waypoints

- Selecting an elbow connector reveals bend handles.
- Dragging a bend handle changes the route to manual mode.
- Double-clicking a connector segment inserts a waypoint.
- Selecting a waypoint and pressing Delete removes that waypoint, not the connector.
- “Reset route” removes manual waypoints and returns to automatic routing.
- Manual waypoints move predictably when endpoints move: endpoint-adjacent stubs track their node; independent waypoints retain world position unless that would create an invalid zero-length segment.

### Straight and curved manual editing

- Straight connectors expose endpoint handles only.
- Curved connectors may later expose control handles; this is optional for the first connector-quality release.
- Mind-map tree connectors are structurally controlled and do not expose arbitrary manual waypoints unless converted to a manual connector.

### Connector selection and hit targets

- Visible line weight remains restrained.
- Hit targets are wider than the painted line and remain consistent in screen pixels.
- The selected connector receives a neutral underlay without changing its stored color.
- Handles remain usable at small zoom levels without overlapping neighboring nodes excessively.

### Connector layering

- All connectors render behind nodes.
- Connectors retain their internal order for hit testing when overlapping.
- Node layer controls do not lift a connector above a node.
- A selected connector's interaction overlay may appear above nodes only where necessary for handles, but exported output remains connectors-behind-nodes.

### Rerouting triggers

Re-evaluate an automatic route when:

- either endpoint node moves;
- either endpoint node resizes;
- the connector's attachment side changes;
- its style changes to Auto or Elbow;
- a nearby obstacle moves into the route corridor;
- the user invokes Reset route.

Do not re-evaluate every connector on every pointer-move. During drag, use a lightweight preview; commit the full route on pointer-up.

### Existing-document compatibility

- Existing straight connectors remain straight.
- Existing curved connectors remain curved.
- Existing elbow connectors keep their current behavior until explicitly reset or edited.
- Existing structural mind-map tree connectors receive a destination arrow through a targeted connector-version migration.
- That migration changes only the tree connector's arrow presentation; it does not reroute the curve or modify hierarchy.
- Existing manual mind-map cross-links preserve their stored arrow setting.
- New optional fields such as routing mode and waypoints default safely when absent.
- No other document-open migration should visually rewrite old diagrams.

### Connector export

- Canvas and PNG use the same resolved route.
- Selection underlays, handles, ports, and guides are excluded from export.
- Rounded elbow appearance must remain deterministic across screen and export.

### Connector acceptance criteria

- New automatic connectors choose sensible facing sides.
- New and migrated mind-map tree connectors point from parent to child.
- Disabling a tree connector's arrow does not detach or reparent the child.
- Orthogonal routes avoid endpoint interiors and unrelated node bounds in standard fixtures.
- Moving one endpoint produces a stable route without visual jitter.
- Manual waypoints persist through save/reopen, copy/paste, duplicate, undo, and redo.
- Reset route returns to deterministic automatic routing.
- Many-to-one manual links do not affect mind-map parentage.
- Canvas and exported PNG show the same connector geometry.
- A 500-node document remains responsive enough for ordinary selection and movement.

---

## 7.9 Line element

### Product role

Line is a dedicated independent canvas primitive for visual structure: axes, dividers, separators, timelines, table-like scaffolding, and lightweight frames. It is deliberately distinct from a connector.

The semantic boundary is strict:

- a **connector** represents a relationship between two elements, can bind to ports, and may route or reroute as its endpoints move;
- a **Line** is standalone geometry, does not imply a relationship, never binds itself to a node, and never participates in automatic connector routing.

Implementing Line as an edge with missing node IDs is explicitly rejected. That shortcut would blur data validation, hit testing, attachment rules, export behavior, and future template authoring.

### Creation

- The top toolbar exposes Line with shortcut `L` when canvas focus is active and the user is not editing text.
- Pointer-down sets the first endpoint; dragging previews the segment; pointer-up commits it.
- A click without meaningful drag cancels creation rather than leaving a zero-length element.
- Holding Shift constrains the line to 0°, 45°, or 90° increments relative to its starting point.
- Escape cancels the in-progress line without creating an undo entry.
- After creation, the tool returns to Select unless the existing sticky-tool behavior is deliberately enabled.

### Geometry and editing

- The authoritative geometry is two world-space endpoints, not a rectangle plus rotation.
- Bounds are computed from the endpoints with the stroke and hit-target margin included where appropriate.
- Selecting a Line reveals two endpoint handles.
- Dragging an endpoint changes only that endpoint; Shift maintains angular constraint.
- Dragging the segment between endpoints moves the whole Line without changing its length or angle.
- Line participates in canvas alignment guides and optional grid snapping, but never snaps into connector ports or establishes an attachment.
- Endpoint handles and the selection hit target stay approximately constant in screen space across zoom levels.

### Appearance

- stroke color;
- thin, medium, and thick width options consistent with connectors and shape borders;
- solid, dashed, and dotted stroke styles;
- sloppiness/roughness when supported by the shared renderer;
- opacity when supported;
- independently selectable start and end arrowheads, both `none` by default.

When an arrowhead is enabled, Line reuses the same deterministic arrowhead renderer as connectors. Sharing rendering geometry does not give the Line connector semantics.

Line has no fill, shape type, or text properties. Axis labels in a template are separate text elements so they can be edited and positioned independently.

### Object behavior

- Line supports selection, marquee selection, multi-selection, arrange controls, grouping, duplicate, copy, paste, delete, undo, redo, save, reopen, and PNG export.
- Line follows ordinary z-order. Unlike connectors, it may be moved in front of or behind shapes.
- Grouping a Line with shapes moves and duplicates them together but does not create endpoint binding.
- A pasted or duplicated Line translates both endpoints by the same delta.
- Line uses a generous screen-space hit target while retaining its visually restrained stroke.
- Selection is a neutral overlay and never changes the stored stroke color or opacity.

### Accessibility and keyboard behavior

- The control is announced as “Line tool,” with its `L` shortcut where shortcut help is exposed.
- A selected Line is announced with its approximate orientation and arrowhead state.
- Delete removes it; Escape clears selection; arrange and duplicate commands match other elements.
- Endpoint-only keyboard nudging is deferred. Arrow-key nudging moves the entire selected Line using the same increments as other elements.

### Data contract

Recommended conceptual shape:

```text
{
  kind: "line",
  x1, y1, x2, y2,
  strokeColor,
  strokeWidth,
  strokeStyle,
  sloppiness,
  opacity,
  startArrowhead,
  endArrowhead
}
```

The final field names should follow the existing model conventions. Validation rejects non-finite endpoints and safely defaults missing optional appearance fields. Opening an existing document requires no Line migration.

### Acceptance criteria

- Drawing, selecting, moving, resizing, duplicating, copying, pasting, grouping, layering, deleting, undoing, and redoing a Line all behave predictably.
- Shift constrains creation and endpoint editing to the supported angles.
- A Line placed against a node remains exactly where the user put it when the node moves.
- A Line never acquires source/target node IDs and never triggers connector rerouting.
- Start and end arrowheads render consistently on screen and in PNG export.
- A thin Line remains easy to select from 25% through 200% zoom without increasing its exported thickness.
- Save/reopen preserves endpoints and appearance without geometry drift.

---

## 7.10 Built-in templates and Eisenhower Matrix

### Product role

Templates give users a useful starting structure without introducing cloud accounts, a marketplace, or a second class of locked canvas content. A template is a versioned built-in recipe that creates ordinary `mapyourmind` elements.

Once inserted, there is no persistent “template object.” Every resulting shape, Line, and text element behaves exactly like an element the user drew manually. This preserves the editor's flexibility and keeps templates compatible with existing selection, property, grouping, save, and export systems.

### Entry and picker behavior

- A discoverable Templates control opens a compact modal or popover.
- `Command K` includes `Insert template…` and searchable entries such as `Insert Eisenhower Matrix`.
- The first release may show one template, but the layout must support additional built-in templates without redesign.
- Each card includes a preview, title, and one-sentence purpose; it does not require categories, search, favorites, or recently used sections until the catalog justifies them.
- Arrow keys move between cards; Enter inserts; Escape closes and restores canvas focus.
- Opening and closing the picker never mutates the document or add an undo entry.

### Template data and validation

- Built-in descriptors ship inside the application and require no network access.
- Each descriptor has a stable template ID, display name, internal version, preview asset or preview recipe, intrinsic bounds, and a list of validated element prototypes.
- Prototypes may reference each other only through IDs local to the template descriptor.
- Insertion generates fresh document IDs, remaps all internal references, normalizes z-order, and validates the complete bundle before touching the active document.
- A failed validation inserts nothing, creates no undo step, and shows a short actionable message.
- Template descriptors are not saved into the document after insertion. Only their resulting normal elements are persisted.
- Preview rendering should use the same visual tokens and element renderer as the actual insertion, or a generated bundled image derived from it, so the preview does not promise a different layout.

### Insertion transaction

Template insertion reuses the trusted multi-element insertion and translation pipeline established for paste.

1. Validate and clone the entire descriptor off-document.
2. Generate fresh element IDs and remap internal group or relationship references.
3. Compute the cloned bundle bounds.
4. Translate the bundle so its visual center lands near the center of the usable canvas viewport, excluding the document sidebar and visible inspector.
5. On a non-empty document, apply collision-aware cascade offset when necessary instead of placing the new bundle directly on an identical prior insertion.
6. Commit all elements in one model transaction and one undo step.
7. Select every inserted element as one transient multi-selection and return focus to the canvas.
8. If the document was empty, fit the complete template with comfortable margins. If it was not empty, preserve the user's zoom and camera unless the template cannot be found or interacted with otherwise.

The transient multi-selection lets the user immediately reposition the set. It is not a permanent group by default: clicking away clears it, and each element can then be edited independently. A user may explicitly group the result afterward.

Repeated insertion follows the same cascade principle as repeated paste. Undo removes the entire inserted bundle; redo restores it with the same generated IDs and z-order recorded in the undo snapshot.

### First template: Eisenhower Matrix

The first built-in template is an original, neutral interpretation of the Eisenhower Matrix reference supplied during planning. It uses the reference only for the information structure: four quadrants organized by importance and urgency. It must not reproduce the source's logo, QR code, footer, explanatory paragraph, distinctive lettering, or decorative central emblem.

Recommended canvas composition:

- approximately 900 × 700 world pixels before viewport fitting;
- title: `Eisenhower Matrix`;
- optional one-line instruction: `Prioritize work by urgency and importance.`;
- two independent Line elements forming the horizontal and vertical axes, visually behind the cards and labels;
- axis labels: `URGENT`, `NOT URGENT`, `IMPORTANT`, and `NOT IMPORTANT` as separate text elements;
- four equal-size rounded cards in a 2 × 2 layout with consistent gutters;
- calm, low-saturation quadrant fills that retain readable contrast in the existing canvas theme;
- quadrant headings, action labels, and prefilled editable guidance:
  - `Important & Urgent` — `DO` — `Handle these first; they are both important and time-sensitive.`;
  - `Important & Not Urgent` — `DECIDE` — `Schedule focused time before these priorities become urgent.`;
  - `Not Important & Urgent` — `DELEGATE` — `Assign these to someone suitable, with a clear expected outcome.`;
  - `Not Important & Not Urgent` — `DELETE` — `Remove, reduce, or defer work that does not support your priorities.`;
- guidance text is normal editable text, not placeholder chrome: it is saved, exported, selectable, and may be replaced or deleted;
- all built-in template titles, labels, instructions, and guidance ship in English to match the current product interface;
- no logo, watermark, QR code, source attribution block, or decorative center icon.

Recommended z-order from back to front:

1. axis Lines;
2. quadrant cards;
3. quadrant heading, action label, and guidance text;
4. axis labels and title.

The axis Lines may use arrowheads to communicate direction, but arrowheads remain normal Line appearance rather than connector semantics. Labels remain separate because text-on-path and Line-owned labels are out of scope.

### Eisenhower editing contract

- All colors, text, strokes, sizes, and positions are editable after insertion.
- Quadrant cards are not locked.
- Axis Lines do not bind to the cards and do not move when a single card moves.
- The initial transient selection contains every inserted element so the whole matrix can be placed at once.
- After selection is cleared, clicking a quadrant selects the ordinary card or text element under the pointer according to normal hit-testing rules.
- The template may define logical groups for a card and its internal labels only if existing grouping semantics allow direct text editing without friction. Otherwise it inserts ungrouped elements and relies on the initial multi-selection.
- The template remains useful at the app's standard zoom range and exports without clipped arrowheads or cropped labels.

### First-release template boundary

Included:

- built-in offline descriptor loading;
- picker preview and keyboard navigation;
- insert into empty or existing documents;
- Eisenhower Matrix;
- undo/redo, copy/paste, save/reopen, and export of the inserted result.

Excluded:

- cloud or community template marketplace;
- user accounts, ratings, favorites, and remote thumbnails;
- importing or exporting template packages;
- saving the current selection as a reusable template;
- automatic population from external task systems;
- responsive template relayout after the user changes individual elements.

### Acceptance criteria

- The picker opens without mutating the document and is fully operable with keyboard and pointer.
- Inserting the Eisenhower Matrix produces one visible, selected, fully editable bundle in the current document.
- Empty-document insertion frames the complete matrix; existing-document insertion preserves orientation and uses a sensible cascade.
- Every inserted element receives a new ID, including on repeated insertion.
- One Undo removes the complete insertion; one Redo restores it.
- Lines remain standalone Lines, shapes remain ordinary shapes, and text remains ordinary text after insertion.
- All labels fit at 100% zoom and remain readable at the supported zoom range.
- The matrix survives save/reopen, editable copy/paste, and PNG export without missing elements or changed z-order.
- A malformed template descriptor inserts nothing and does not corrupt the current document.
- The shipped template contains no copied branding, QR code, footer, or distinctive decorative artwork from the planning reference.

---

## 8. State and behavior matrix

| State | Pointer behavior | Keyboard behavior | Inspector | Connector behavior |
| --- | --- | --- | --- | --- |
| Nothing selected | Click selects; drag empty area starts marquee | Tool shortcuts; Cmd K | Hidden | Hover ports available near eligible nodes |
| One node selected | Drag moves; handles resize; port drag connects | Tab/Enter extend; Delete removes; Escape clears | Node sections | Attached connectors preview during movement |
| Multiple nodes selected | Drag moves selection as a unit | Align/group/arrange commands | Mixed/common properties | Internal and external connectors remain attached |
| Connector selected | Wide hit target; waypoint handles when eligible | Delete removes; Escape clears | Connector sections | Route edit and reset available |
| Line selected | Segment drag moves; endpoint handles reshape | Arrow keys nudge; Delete removes; Escape clears | Line sections | No binding or rerouting behavior |
| Text editing | Pointer sets caret/selection | Enter/Tab creates after commit; Shift Enter newline | Text properties remain usable | No connector drag from text editor |
| Context menu open | Outside click closes; no background drag | Arrow navigation; Enter; Escape | Unchanged | No route mutation until command runs |
| Command menu open | Background canvas inert | Search/navigation/execute/Escape | Unchanged | Context commands reflect selection |
| Template picker open | Background canvas inert; card click chooses | Arrow navigation; Enter inserts; Escape closes | Unchanged | No connector mutation until insertion commits |
| Line creation active | Drag previews; release commits valid line | Shift constrains angle; Escape cancels | Hidden or inert | Ports do not activate and no node binding occurs |
| Node drag active | Guides and preview update | Shift locks axis; Command disables snap | Remains visible but inert | Lightweight route preview |
| Connector drag active | Target and port highlight | Escape cancels | Connector options optional | No connector created until valid release |

---

## 9. Undo, persistence, and data rules

### 9.1 Undo boundaries

Each of these should create one undo step:

- paste of any number of elements;
- one completed drag;
- one completed resize;
- one layer command;
- one align or distribute command;
- one connector route reset;
- one manual waypoint insertion, move, or removal;
- one completed Line creation or endpoint edit;
- one template insertion, regardless of element count;
- one `Tab` or `Enter` node creation after its initial text is committed;
- one property change applied to the current selection.

Continuous slider-like changes, if introduced later, should coalesce into a single step per interaction.

### 9.2 Optional schema additions

Maintain schema 1 compatibility by treating new fields as optional.

Possible node additions:

- `roughness` or `sloppiness`;
- `opacity`;
- `fontFamily`;
- a normalized whole-node typing style if needed for empty-node inheritance.

Possible edge additions:

- `routing: "auto" | "manual"`;
- `waypoints: [{x, y}, ...]`;
- explicit attachment-side values when absent today;
- future corner-radius or routing-version metadata.

Possible Line additions:

- `kind: "line"` or the equivalent discriminator used by the existing element model;
- authoritative world-space endpoints;
- stroke appearance and optional start/end arrowhead fields.

Template descriptors are application resources, not document-schema additions. After insertion, only normal document elements are saved.

Defaults must be applied during validation/rendering without rewriting an unchanged document merely because it was opened.

### 9.3 Copy and paste

- Copy includes all supported visual properties.
- Internal connectors are copied only when both endpoints are in the copied selection.
- Manual waypoints are translated with the pasted group.
- Line endpoints are translated together with the pasted group.
- External connectors are not copied.
- Notes continue following the existing editable subtree-copy contract.

### 9.4 Save and recovery

- Existing atomic saves and recovery snapshots remain unchanged.
- No test may write to production document storage.
- Future-version documents remain rejected without overwrite.

---

## 10. Accessibility requirements

### 10.1 Keyboard access

- Every inspector action is reachable by keyboard.
- Swatches use roving focus or an equivalent manageable focus model.
- Context and command menus support standard arrow navigation.
- Escape behavior follows a predictable priority: active drag → popup/menu → editing → selection.
- Focus returns to the canvas or originating control after transient UI closes.

### 10.2 Labels and state

- Icon-only controls require accessible names and tooltips.
- Selected swatches expose selected state programmatically.
- Mixed property values are announced as mixed rather than falsely reporting one value.
- Disabled actions explain their requirement through tooltip or omission.

### 10.3 Perceivability

- Selection, focus, and alignment guides must not rely on color alone.
- Transparent fill must have a visual symbol.
- Text and connector colors require manual contrast review against common fills.
- Small controls should target at least approximately 28×28 screen pixels in this dense desktop context, with larger invisible hit regions where possible.

### 10.4 Canvas limitation

Canvas-based diagrams remain difficult for screen readers. This plan does not claim full WCAG conformance. A future accessibility track should expose a semantic outline of nodes and relationships, but that is outside the current scope.

---

## 11. Performance requirements

- Pointer-move work should remain bounded to nearby candidates when possible.
- Full obstacle routing should happen on pointer-up, not on every drag frame.
- Route previews may use simplified geometry.
- Connector geometry caches must invalidate only when relevant inputs change.
- Alignment candidate search should use screen/world bounds filtering before comparing every object.
- A 500-node document remains the minimum regression scale.
- Rendering and export must continue sharing deterministic geometry.

Recommended performance budgets for manual verification:

- drag feedback should visually remain near 60 fps on the target Apple-silicon Mac for ordinary documents;
- command menu should appear within approximately 100 ms;
- a normal paste should display a selection within one animation frame after model insertion;
- full rerouting after pointer-up should feel immediate for ordinary diagrams and must never block document recovery or saving.

These are experience targets, not telemetry-backed service-level objectives; the application remains offline and does not add analytics.

---

## 12. Delivery plan

## Release A — Canvas trust and inspector hygiene

### Objectives

Remove blockers that make users doubt whether the editor has correctly processed an action.

### Included

- rename user-facing application and package surfaces to `mapyourmind` while preserving the legacy bundle identifier and document-storage directory;
- viewport-aware paste placement;
- repeated-paste cascade;
- selected result after paste;
- right-click event correction;
- neutral selection treatment;
- reliable Escape clearing;
- crisp screen-space text editor with correct caret placement for Excalifont, Google Sans when available, and the defined fallback;
- transparent fill swatch;
- horizontally scrollable color rows with hidden scrollbar;
- four layer controls;
- inspector section cleanup.

### Dependencies

- existing model selection and copy/paste functions;
- current Canvas paint order;
- current rich-text adapter.

### Exit criteria

- all Release A acceptance criteria pass;
- existing clipboard image and rich-text tests remain green;
- manual tests at several zoom levels show no blur, caret/glyph collision, or invisible paste;
- existing user documents appear automatically in the renamed `mapyourmind` app;
- Google Sans is not bundled or redistributed unless a separate rights check has approved that exact font asset;
- no document schema migration is required solely for layering.

## Release B — Keyboard speed and command discoverability

### Objectives

Let a user create a consistently styled diagram without leaving the keyboard.

### Included

- complete node style-inheritance helper;
- `Tab`/`Enter` integration in both modes;
- uniform rich-text typing-style inheritance;
- viewport-safe quick creation;
- Command K menu;
- contextual command ranking;
- command entries for Arrange, Align, Distribute, Group, Duplicate, Delete, Fit, and tools.

### Dependencies

- Release A selection behavior;
- settled property-inheritance matrix;
- clear inspector property model.

### Exit criteria

- matrix-driven tests cover every inherited and excluded property;
- no key-repeat node floods;
- current text-editing shortcuts continue working;
- mind-map tree parentage and flowchart connector creation remain valid.

## Release C — Composition primitives and templates

### Objectives

Add the smallest reusable composition system needed to create structured canvases quickly without conflating visual lines with semantic connectors.

### Included

- dedicated Line tool and element model;
- Shift-constrained creation and endpoint editing;
- Line appearance, optional arrowheads, arrange, group, duplicate, copy/paste, persistence, and export;
- built-in offline template descriptor and validation pipeline;
- accessible template picker and command-menu entries;
- viewport-aware, one-transaction template insertion;
- original editable Eisenhower Matrix template;
- full undo/redo, save/reopen, and export coverage for inserted bundles.

### Dependencies

- Release A viewport-aware insertion, selection, layering, and inspector behavior;
- Release B command-menu surface;
- settled Line-versus-connector semantic boundary;
- deterministic rendering shared between canvas and PNG export.

### Exit criteria

- Line never binds or reroutes as a connector;
- template insertion is visible, selected, collision-aware, and one undo step;
- every inserted element is ordinary and independently editable after selection clears;
- the Eisenhower fixture passes empty-document, existing-document, repeated insertion, save/reopen, copy/paste, undo/redo, and PNG tests;
- malformed template data cannot partially mutate or corrupt a document;
- the shipped design contains no branding or decorative artwork copied from the planning reference.

## Release D — Spatial intelligence

### Objectives

Make object movement visibly precise without making free placement difficult.

### Included

- screen-space snap thresholds;
- refined edge/center guides;
- Shift axis lock;
- Command snap override;
- equal-spacing indicators;
- refined multi-object alignment and distribution feedback;
- rules for independent roots versus automatic mind-map branches.

### Dependencies

- stable movement and selection from Release A;
- command menu entries from Release B;
- regression coverage for pointer-up persistence.

### Exit criteria

- Shift, Command, Option, and Shift-selection conflicts are resolved and tested;
- no post-release snap-back;
- automatic mind-map layout remains deterministic;
- guides never appear in export.

## Release E — Connector quality

### Objectives

Deliver visually calm connectors with enough flexibility for real process diagrams.

### Included

- Auto connector style for new flowchart edges;
- curved parent-to-child mind-map connectors with destination arrows enabled by default;
- targeted migration that adds arrows to existing structural tree connectors without rerouting them;
- improved facing-side selection;
- obstacle-aware orthogonal candidate routing;
- stable route scoring;
- lightweight drag preview and committed pointer-up route;
- manual waypoints;
- reset route;
- connector-specific inspector and command actions;
- persistence, copy/paste, undo/redo, and export support.

### Dependencies

- stable node movement from Release D;
- selection and layering rules from Release A;
- optional edge data fields and validation defaults.

### Exit criteria

- standard connector fixtures route without node intersections;
- manual intent persists;
- legacy connectors remain visually stable except for the approved tree-arrow migration;
- existing tree connectors retain their prior curve geometry when the child-direction arrow is added;
- large-board performance remains acceptable;
- screen and PNG paths match.

---

## 13. Quality and test plan

### 13.1 Model tests

Add focused tests for:

- source-style cloning with the full property matrix;
- excluded metadata such as ID, notes, collapsed state, and group;
- flowchart child/sibling structure;
- mind-map parent/sibling structure;
- default and migrated parent-to-child tree arrows;
- arrow toggling without parentage mutation;
- layer-order operations and relative-order preservation;
- paste translation and bounds placement helpers;
- Line endpoint validation, bounds, translation, cloning, and appearance defaults;
- template descriptor validation, fresh-ID remapping, z-order normalization, and all-or-nothing insertion;
- Eisenhower Matrix descriptor bounds and internal-reference integrity;
- route candidates and deterministic scoring;
- obstacle intersection rejection;
- manual waypoint translation during paste;
- validation of optional new node and edge fields;
- undo/redo snapshots around each new mutation.

### 13.2 WKWebView integration tests

Add interaction-level checks for:

- the `mapyourmind` display name while legacy local documents remain available;
- copy from one viewport state and paste into another;
- paste into an empty new document;
- repeated paste cascade;
- right-click without unintended move or marquee;
- context-menu keyboard navigation;
- Escape clearing priority;
- text edit at fractional zoom;
- caret placement after the final `s` in `Risk assess` using Excalifont, Google Sans when available, and the defined fallback;
- matching line wrapping and caret boundaries between canvas paint and active editing;
- transparent fill rendering and export;
- swatch keyboard navigation and horizontal overflow;
- all four layer controls;
- style inheritance after both canvas-level and editor-level `Tab`/`Enter`;
- Command K opening, filtering, running, and closing;
- Line creation, Shift constraint, endpoint editing, whole-line movement, and non-binding behavior;
- Line arrange, group, duplicate, copy/paste, save/reopen, undo/redo, and PNG export;
- template picker pointer and keyboard operation;
- Eisenhower insertion into empty and populated documents, including repeated insertion cascade;
- one-step Undo and Redo for the complete Eisenhower bundle;
- malformed template rejection without partial document mutation;
- Shift-drag axis lock;
- Command-drag snap override;
- Option-drag duplication unchanged;
- equal-spacing guide appearance and cleanup;
- automatic route after node movement;
- mind-map tree arrows after create, reparent, save/reopen, and targeted legacy migration;
- manual waypoint creation, move, delete, and reset;
- persistence after save/reopen;
- PNG equality for resolved connector geometry.

### 13.3 Regression fixtures

Maintain representative fixtures:

1. empty document;
2. small three-node flowchart;
3. dense process flow with crossing opportunities;
4. several independent mind-map trees;
5. deep collapsed mind-map branch;
6. many-to-one manual connectors;
7. mixed image, free text, flow nodes, and mind nodes;
8. rich-text nodes with mixed marks;
9. grouped and layered overlaps;
10. Eisenhower Matrix containing Lines, shapes, and text;
11. repeated template insertions with distinct element IDs;
12. 500-node stress document.

### 13.4 Manual visual QA

Verify at minimum:

- zoom: 25%, 50%, 57%, 75%, 100%, 125%, 150%, 200%;
- inspector open and closed;
- Flowchart and Mind Map modes;
- Excalifont, Google Sans when available, and the defined sans-serif fallback;
- the exact `Risk assess` caret regression at the end and between repeated `s` glyphs;
- white, transparent, and colored fills;
- thin, medium, and thick strokes;
- all supported shapes;
- single selection, multi-selection, connector selection, and Line selection;
- Line creation and endpoint editing at horizontal, vertical, diagonal, and Shift-constrained angles;
- Eisenhower insertion with both side panels open and closed;
- light canvas with overlapping nodes and connectors;
- exported PNG at 1×, 2×, and 3× with white and transparent backgrounds.

### 13.5 Data-safety QA

- Native tests use isolated temporary document storage.
- Production documents are never used for automated tests.
- Existing bundle identifier and application-support path remain unchanged.
- The clipboard is restored after native tests.
- A failed new-field validation cannot overwrite the last-known-good snapshot.

---

## 14. Risks and mitigations

### Risk 1: Style inheritance conflicts with mind-map defaults

**Issue:** Existing behavior intentionally differentiates purple roots from white children. Full inheritance removes that automatic distinction when a child is created from a root.

**Mitigation:** Treat full source inheritance as the current approved product rule because it is the explicit requirement. Document any future exception rather than hiding it in implementation defaults.

### Risk 2: Shift has two meanings

**Issue:** Shift toggles selection and is also proposed for axis locking.

**Mitigation:** Resolve meaning by movement threshold and whether the pointer starts on an already selected object. Cover every combination with integration tests.

### Risk 3: Option is already occupied

**Issue:** Many editors use Option to disable snapping, but `mapyourmind` preserves Excalidravv's existing Option+drag duplication behavior.

**Mitigation:** Preserve Option duplication and keep Command as the temporary snap override.

### Risk 4: Automatic routing creates jitter

**Issue:** Recomputing the mathematically shortest route on every frame can cause constant connector flipping.

**Mitigation:** Use route hysteresis, deterministic ordering, simplified previews, and full recomputation only on pointer-up.

### Risk 5: Obstacle routing becomes expensive

**Issue:** Comparing every connector against every node is costly on large boards.

**Mitigation:** Filter to a local route corridor, cache geometry, and reroute only affected connectors.

### Risk 6: Text sharpness fix breaks editing selection

**Issue:** Changing coordinate strategy for the contenteditable overlay can affect caret placement and rich text, while a global forced font can make the editor and Canvas renderer resolve different font metrics.

**Mitigation:** Keep the rich-text model unchanged, isolate geometry changes, apply the node's resolved font directly to both surfaces, and add zoom, selection, IME, and font-metric integration fixtures.

### Risk 7: Layer controls alter hit testing unexpectedly

**Issue:** Reordering paint order changes which overlapping object receives clicks.

**Mitigation:** Define hit testing to match visible front-to-back order and test overlapping grouped and ungrouped nodes.

### Risk 8: Automatic paste zoom surprises users

**Issue:** Zooming on every paste would disrupt spatial orientation.

**Mitigation:** Do not change zoom when the pasted bounds fit; use only minimal accommodation for exceptionally large pasted content.

### Risk 9: Google Sans availability and distribution

**Issue:** A machine may not have Google Sans available, and this PRD does not establish permission to redistribute its font files.

**Mitigation:** Treat Google Sans as a compatibility case when legitimately present, define a deterministic local fallback, expose the actual resolved font choice, and do not package a Google Sans asset without a separate verified rights decision.

### Risk 10: Product rename hides existing documents

**Issue:** Renaming the bundle identifier or application-support directory could make the existing library appear empty and split future saves across locations.

**Mitigation:** Change user-facing labels and package names while preserving `app.localflowchart.mac` and `~/Library/Application Support/Local Flowchart/`. Add a native migration test before packaging.

### Risk 11: Line and connector semantics become indistinguishable

**Issue:** Reusing the connector model for standalone Lines could create phantom attachments, invalid edges, unexpected rerouting, or confusing inspector controls.

**Mitigation:** Give Line its own element discriminator and endpoint geometry. Reuse only visual helpers such as stroke and arrowhead rendering; explicitly exclude node IDs, ports, relationship semantics, and routing state.

### Risk 12: Template insertion partially mutates a document

**Issue:** A malformed descriptor, failed ID remap, or interruption during a large insertion could leave missing labels, broken grouping, or an incomplete undo snapshot.

**Mitigation:** Validate and clone the full bundle off-document, then commit it atomically as one model transaction. On any failure, insert nothing and preserve the last-known-good document state.

### Risk 13: A large template disrupts the user's spatial context

**Issue:** Aggressive zooming or insertion directly over existing work can make a template appear destructive even when no content is lost.

**Mitigation:** Fit on empty documents only, preserve the existing camera on populated documents, center within the usable viewport, apply collision-aware cascade, and select the complete inserted bundle for immediate repositioning.

---

## 15. Technical work map

This section maps likely implementation ownership without authorizing implementation.

### `web/model.js`

- reusable visual-style extraction and application;
- `extend` behavior using the style donor;
- layer-order mutations if kept in the model;
- paste translation helpers;
- Line element validation, endpoint geometry, bounds, cloning, and z-order mutations;
- built-in template descriptor validation, fresh-ID remapping, and atomic bundle construction;
- connector route candidate and validation helpers;
- optional waypoint data handling;
- validation defaults;
- model-level unit-test surface.

### `web/app.js`

- viewport-aware paste placement;
- screen-space text editor geometry;
- shared resolved-font metrics between Canvas paint and the active editor;
- caret and line-wrap regression handling across supported fonts;
- selection and painting adjustments;
- inspector synchronization;
- layer commands;
- command menu integration;
- Line tool creation, hit testing, endpoint handles, movement, selection, and rendering;
- template picker integration and viewport-aware bundle insertion;
- Eisenhower template preview and insertion dispatch;
- drag modifiers and guide generation;
- connector preview and committed routing;
- route rendering and export consistency;
- application command dispatch.

### `web/features.js`

- right-click sequencing and menu contents;
- context-menu selection preservation;
- image-paste placement integration;
- built-in template catalog/picker behavior if kept as a feature module;
- potentially command-menu implementation if kept as a feature module;
- connector waypoint interactions if separated from core pointer handling.

### `web/index.html`

- inspector sections;
- transparent and scrolling color controls;
- Arrange controls;
- command-menu shell;
- Line-specific inspector controls;
- template picker shell and accessible template-card semantics;
- connector route controls;
- accessible labels and roles.

### `web/style.css`

- inspector section layout;
- hidden horizontal scrollbar behavior;
- transparent swatch treatment;
- layer-control grid;
- context and command menus;
- template picker, card, preview, focus, and overflow treatment;
- screen-space text editor treatment;
- removal or narrowing of global font overrides that can replace a node's chosen font inside the editor;
- guide, waypoint, and connector-handle visuals where DOM-based.

### `web/icons.js`

- layer action icons;
- command/search icon if needed;
- original Line and Templates icons;
- reset-route and waypoint-related icons;
- all icons remain consistent original outlines.

### `tests/model.test.cjs`

- style matrix;
- layer ordering;
- paste translation;
- Line geometry, validation, cloning, and optional arrowheads;
- template descriptor validation, ID remapping, and atomic insertion;
- Eisenhower fixture integrity;
- route geometry and determinism;
- waypoint persistence and cloning.

### `tests/integration.js`

- actual pointer, keyboard, context-menu, zoom, paste, Line editing, template insertion, Eisenhower fixture, font/caret editing, tree-arrow migration, save/reopen, and export behavior.

### `src/main.swift`

- update user-facing application/package naming to `mapyourmind` while preserving the existing bundle identifier and data path;
- native menu registration for Command K may be added if required;
- clipboard bridge contract should remain backward compatible.

---

## 16. Decision log

The following decisions are considered settled for this plan:

1. A minimal built-in offline template system is included; cloud/community discovery, user-authored template packages, and a marketplace remain excluded.
2. The first built-in template is an original editable Eisenhower Matrix composed from ordinary shapes, Lines, and text, with a concise prefilled guidance sentence in every quadrant.
3. Built-in template titles, labels, instructions, and guidance ship in English to match the current product interface.
4. Line is a dedicated standalone canvas element, not a connector with missing endpoints.
5. Inserted templates become normal elements, arrive as a transient multi-selection, and are not permanently grouped by default.
6. The user-facing product name becomes lowercase `mapyourmind`.
7. The existing bundle identifier and legacy document-storage path remain unchanged so the rename cannot hide existing documents.
8. `mapyourmind` keeps the current hand-drawn visual identity and offline architecture.
9. The current top toolbar remains; no full Whimsical-style rail redesign.
10. The right inspector remains the detailed property surface.
11. Color rows scroll horizontally without visible scrollbar chrome.
12. Transparent/no-color options appear first.
13. Layer controls live in the right inspector and command menu.
14. `Tab`/`Enter` nodes inherit every eligible visual property from their source.
15. Connectors are excluded from node-style inheritance.
16. Mind-map parent-to-child connectors are curved and arrowed by default, using the same destination-arrow renderer as Flowchart connectors.
17. Existing structural mind-map tree connectors receive only the approved child-direction arrow migration; their paths and hierarchy do not change.
18. Alignment guidance remains available during ordinary drag; Shift adds precision axis locking.
19. Command temporarily disables snapping because Option is reserved for drag-duplicate.
20. Connectors remain behind nodes, while Lines use ordinary z-order and may be arranged relative to shapes.
21. Manual connector routes override automatic routing until reset.
22. Google Sans is a supported compatibility case when legitimately available, but its font file is not bundled by this PRD.
23. All meaningful changes remain undoable, persist locally, and export consistently.

---

## 17. Questions intentionally deferred until implementation planning

These do not block approval of the product plan, but they require a concrete decision before their respective release begins:

1. Should Auto become the default only for new Flowchart connectors, or should new connectors remain Straight until the user chooses Auto?
2. Should root-to-child mind-map inheritance remain literally identical, or should root identity be the one approved exception to full inheritance?
3. Should the contextual action strip ship in Release B or wait until after the command menu is validated?
4. Should manual connector waypoints use only bend handles, or also allow dragging any segment?
5. Should connector reverse-direction ship with Release E or remain a later enhancement?
6. What accent color should guides and active ports use while remaining distinct from selection and highlight colors?

No implementation should assume answers to these questions without recording the decision here first.

---

### Implementation planning resolutions — 2026-09-28

Recorded before the relevant releases; these resolve optional choices without reducing the approved scope:

1. Auto will be the default for new Flowchart connectors in Release E only. Legacy styles and geometry remain unchanged unless explicitly reset/edited.
2. Root-to-child inheritance is literally identical for eligible visual properties, as already mandated by Sections 7.6 and 16.
3. The optional contextual action strip is deferred; Release B delivers the full required command menu.
4. Release E supports bend handles and double-click segment waypoint insertion. Whole-segment dragging is deferred; it is not required by the waypoint contract.
5. Reverse direction is deferred (optional in this PRD); required route editing and reset remain included.
6. Guides use dark teal `#0f766e` with dashed lines; neutral selection remains separate. Equal-spacing annotations also include distance labels.

---

## 18. Definition of done for the complete program

The interaction-quality program is complete only when:

- all user-facing product surfaces use the lowercase `mapyourmind` name while existing documents remain available through the preserved legacy identity and storage path;
- pasted content always appears visibly and selected;
- right-click, selection, and Escape behavior are understandable and consistent;
- active text remains crisp across supported zoom levels and the caret stays at valid grapheme boundaries in every supported font;
- the supplied `Risk assess` Google Sans regression no longer shows a caret cutting through the final glyph;
- transparent fill and horizontally scrollable swatches work without squeezing the inspector;
- four layer controls behave correctly for single and multiple selections;
- keyboard-created nodes inherit the agreed full visual property set;
- command search exposes advanced actions without adding permanent clutter;
- Line behaves as an editable, arrangeable, persistent visual primitive without ever binding or rerouting like a connector;
- the built-in template picker inserts validated bundles atomically and accessibly;
- the Eisenhower Matrix inserts visibly as ordinary editable shapes, Lines, and text, with one-step undo and faithful save/reopen/export behavior;
- Shift-drag, snapping, equal-spacing, and override modifiers work without conflicts;
- automatic connectors use readable attachment sides and clearances;
- mind-map tree connectors point from parent to child with an arrow by default, including existing structural tree connectors after the targeted migration;
- route changes remain stable rather than jittering;
- manual waypoints remain editable and persistent;
- all features work with undo, redo, copy, paste, save, reopen, and PNG export;
- existing documents retain their appearance except for the explicitly approved product-name and structural tree-arrow presentation migrations;
- existing mind-map parentage, branch reordering, comments, collapse, images, rich text, and offline guarantees remain intact;
- automated model and WKWebView tests pass;
- final manual visual QA is performed on representative diagrams and zoom levels.

---

## 19. Recommended review order

Review this document in the following order before implementation:

1. Confirm the decisions in Section 16.
2. Resolve the two highest-impact deferred questions: Auto connector default and mind-map root-to-child inheritance.
3. Approve Release A scope independently from later connector work.
4. Approve the inheritance matrix in Section 7.6.
5. Approve modifier-key behavior in Section 7.7.
6. Approve the Line semantic boundary and editing contract in Section 7.9.
7. Approve template insertion and the Eisenhower Matrix content in Section 7.10.
8. Review connector routing and manual-waypoint behavior in Section 7.8.
9. Convert each release into implementation tasks only after its product behavior is approved.
