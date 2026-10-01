# Editor refinements and presentation mode

Approved by Zieggy in this chat, 2026-10-01. These decisions supersede the older sidebar, round-swatch, command-palette and mind-map child defaults. Scope: local Board editor. No release, installation, schema migration or production-library access.

## Requirements and acceptance

| ID | Requirement | Acceptance |
| --- | --- | --- |
| R1 | Disable the Command K command palette. | Neither the hotkey nor native menu opens it. Notes' link editing remains available. Existing actions stay reachable through the rail, document menu, right-click menu, sidebar, native menus or keyboard shortcuts. |
| R2 | Remove the floating node action toolbar. Use right-click for node actions. | Selecting a node shows no contextual toolbar. Node, connector, multi-selection and empty-canvas menus offer relevant actions; Copy, Cut, Duplicate, Delete, Comment, child/sibling creation, scoped Arrange tree, grouping and layer order remain accessible where applicable. Preserve selection and one-step undo. |
| R3 | Keep the right style panel focused on style. | Remove Set as default, All defaults, Comment, Duplicate and Delete elements buttons. Comments remain a separate right panel, opened by right-click, their badge or shortcut. Settings is still available via Command-comma. |
| R4 | Increase left-sidebar text and move Settings above Trash. | Document rows use 14px text, 32px rows and 16px icons. Names truncate without shifting columns. Settings sits immediately above Trash. |
| R5 | Use tidy rounded rectangular fill/highlight swatches. | Presets and pinned custom picker are 28×24px, 6px radius, 6px gap. Selection outlines stay visible; the transparent option and keyboard navigation remain usable. |
| R6 | Add text alignment shortcuts. | Command-Shift-L/E/R aligns selected or actively edited Board text left/centre/right, preserving the caret and undo boundary. Plain Command-E still exports. Notes retains its own text editing behavior. |
| R7 | New mind-map children are text, with no visible shape, border or background. | Root appearance stays unchanged. Tab children and Enter siblings below a root use compact text, keep tree identity/connectors, and remain editable and extensible. Existing nodes are not migrated. Flowchart Start/end still uses its configured successor shape. Use existing schema-3 fields for compatibility. |
| R8 | Fit text height to content and reduce rectangle padding. | Free text starts at 230px width, resizable; height follows wrapping/font/line breaks and shrinks when content is removed. Text has 3px vertical/4px horizontal inset. Rectangles use 6px vertical/10px horizontal inset when auto-sized. Canvas, editor and exports share measurements. Manual shape resize retains its requested minimum height; text height remains automatic. |
| R9 | Show distance and alignment guides during moves. | Show nearest edge-to-edge gaps in world pixels, independent of zoom; support the moving selection/subtree bounds, skip hidden and moving nodes, identify equal gaps, and clear on drop/cancel. Guides are UI-only, never saved/exported. Keep current snapping and Option-drag duplication. Mind-map measurements reflect the actual move, including the final retained position. |
| R10 | Keep Space collapse/expand and Space-drag pan. | Space tap toggles selected branches; leaves do nothing; mixed branches collapse together. A pan never toggles a branch. Typing, IME and dialogs do not trigger it. |
| R11 | Add Board View only for presenting. | Visible header toggle and Back to editing. Disable content/style edits, dragging, resize, creation, import, delete, undo/redo and comments editing; retain selection, pan, zoom, Find and collapse. Hide editing rail/style/history controls. View-only collapse and Find's ancestor expansion are temporary; original collapse flags return on exit/document switch and never leak into native/browser saves. Notes does not offer this mode. |
| R12 | Add a temporary laser pointer in View only. | A red dot follows the pointer. Holding the primary button draws a trail, including circles, fading within 800ms. Space-drag still pans. Clear on exit/cancel/document switch; no content, undo, storage or export changes. |
| R13 | Stickers use cursor placement and reliable Escape dismissal. | Escape closes the picker regardless of focus. Choosing a sticker closes the picker and starts a 32px ghost following the cursor without holding the mouse. Click on canvas places once, returns to Select, and creates one undo step. Escape, switching tool/document or entering View only cancels without adding anything. |

## Delivery and verification

1. Clean-HEAD baseline, then this requirement commit.
2. Shell, right-click actions, palettes and shortcuts. Full sweep, WIP commit.
3. Mind-map/text sizing, sticker placement and distance guides. Full sweep, WIP commit.
4. View only and pointer. Full sweep, snapshots, persistence/export/perf checks, WIP commit.
5. Update verification/checklist/README, squash these WIPs into one clean local commit. Stop for Zieggy's review.

Baseline source: `ffee331`, archived under `.runlogs/refinements/baseline-checkout` inside this repo because the working tree already contained local Space/stroke work. Node 35; schema 11; navigation 108; notebook 62; Program A 588; Program B 604; storage PASS; browser smoke 3; perf 11 metrics, whole-board paint 31.10ms. Integration consistently stops at assertion #139 and Feedback at fractional-width rounding on this 1× display. The last complete clean-HEAD results were 479 and 75 respectively. Preserve those failures in the record; fix the display-aware checks as part of verification, without deleting coverage.

Existing local Space changes are relevant to R10 and will be retained. Existing local shape-stroke changes will stay outside the final commit. No production documents or installed apps are touched.

R1–R13 are implemented and verified. Final clean-source counts, baseline failures, snapshots, browser presentation
checks and remaining limits are recorded in `verification/editor-refinements.md`. README, CLAUDE and the checklist
now describe these approved decisions. All delivery WIPs are squashed into one local commit.
