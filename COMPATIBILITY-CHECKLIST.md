# mapyourmind project notes

## Editor refinements, 2026-10-01 (override older decisions below)
- Approved requirements: `REQUIREMENTS-EDITOR-REFINEMENTS.md`. Command K palette and floating node toolbar are disabled;
  node/connector actions use right-click. Style panel no longer carries defaults, Comment, Duplicate or Delete buttons.
- New mind-map children/descendants are compact text without fill/stroke, using existing schema-3 fields and preserving
  tree identity. Existing saved nodes stay unchanged. Flowchart Start / end still uses its configured successor.
- Sidebar text is 14px (previously 12px), Settings sits above Trash. Fill/highlight swatches are rounded rectangles,
  28×24px, 6px radius/gap with a pinned matching custom picker. Command Shift L/E/R aligns text; Command E remains PNG.
- Text height follows content/wrapping and shrinks; width starts at 230px and remains adjustable. Text inset is 4px/3px,
  rectangle inset 10px/6px. Moves show transient nearest edge-gap/equal-gap rulers in canvas pixels at any zoom.
- Space tap toggles selected branches; Space-drag pans. View only hides/disables editing controls while retaining
  pan/zoom/selection/Find/collapse. Presentation navigation uses a disposable graph; all saves keep original collapse
  flags and geometry. Notes has no presentation toggle. The independent laser layer fades trails within 800ms and
  never enters storage, undo or PNG/PDF exports. Escape clears Pointer, exit/switch clears presentation state.
- Sticker selection closes its picker and starts a cursor preview; click places once as one undo step. Escape closes
  the picker or cancels placement, including with picker focus; tool/document/mode changes cancel too.
- Full sweep, baseline failures, snapshots, browser UI smoke and remaining limits: `verification/editor-refinements.md`.
  Local WIPs are squashed into one commit. No push/tag/release/install, version bump or production-data access.

## Decisions from Zieggy, 2026-09-29 (override the text below where they conflict)
- mapyourmind is a **separate app and project** from Excalidravv, so Excalidravv 1.28 stays a working fallback.
  Bundle ID `app.mapyourmind.mac`, data in `~/Library/Application Support/mapyourmind/`. On first launch the app takes a
  one-time copy of `~/Library/Application Support/Local Flowchart/` (Excalidravv's library); that folder is only read.
- **Keep the Excalidravv "After Start / end" rule** instead of PRD decision 17.2: after a Start / end or a mind-map root,
  Tab/Enter gives the After Start / end shape (white rectangle by default, configurable in Command-comma defaults).
  Everything else is inherited literally. Tests in model.test.cjs, program.js and feedback.js encode this.
- **Google Sans is bundled** in `web/assets/` (SIL OFL 1.1), not read from /Applications/Excalidravv.app.
- Every native test run must pass `--ui-test` (or use `--storage-test`); any other launch opens the real library.

State at import: gates C0, C1, A done; B implemented and its suite passes, but its gate is not signed off; C, D, E not started.

## Editor shell redesign (design canvas "mapyourmind shell redesign", Spec board)
Phases, in order: 1 shell layout · 2 style panel + context bar + right-click menu · 3 Whimsical-style connectors
(8px gap, filled head, every sloppiness) · 4 ⌘F find, full Settings, Export PDF, folders · 5 states polish, then PRD B gate and C/D/E.
- [x] Phase 1 (2026-09-29): dark navy sidebar (logo + New document, no section label), dark slate tool rail on the
  left with tooltips (Line and Template disabled), thin header (title ▾ document menu, double-click renames in place,
  Settings gear), history/zoom/help cluster bottom-right, blue #2474D0 accent incl. canvas selection. Flowchart and
  Mind Map merged into Board: new documents store mode "board"; stored "flowchart"/"mindmap" are read as Board and never
  rewritten. Arrange moved to ⌘K and the mind-node right-click menu; Import joined ⌘K. Notes keeps undo/redo in the
  cluster and its Export PDF button in the header. Double-click on empty canvas still creates free text (unchanged;
  the design Spec's "flowchart shape" line is wrong). Tests updated for the removed mode switch; new navigation
  assertions cover the document menu, in-place rename and the gear.
- [x] Phase 2 (2026-09-30): style panel in the app's ELEMENT STYLE layout with the blue accent; Shape is six icons
  instead of a dropdown; Font family is three tiles (Handwritten, Google Sans, Comic) each drawn in its own font; Arial
  is no longer offered but stays valid, so legacy Arial nodes keep it with no tile pressed; fill palette is transparent,
  white, a pastel rainbow, note yellow and grey (every earlier colour kept) in the existing sideways carousel with the
  picker pinned outside; stroke and text colours are round chips. Dark slate mind-map context bar above a selection
  from one tree (Arrange tree = M.tidy scoped to that tree, Add child, Comment); dark right-click menu and shape picker
  without shortcut chips; the sticker dropdown is dark and closes when another tool is picked. Tests: model tests for
  scoped tidy and the palette, navigation assertions for the bar, font tiles, shape icons, dark menus.
- [x] Phase 3 (2026-09-30): Whimsical-style connectors, render only (no stored data, no migration). `edgeGeometry` plans
  the route from the outline anchors as before, then `trimEnds` moves both ends 8px out along the first/last segment
  (straight, elbow, curved, bent, tree), so hit testing, labels (`labelT`, `clipAroundLabel`), endpoint handles, export
  bounds and PNG all use the trimmed line. The open chevron left the Rough.js path: `drawArrowHead` fills a slightly
  rounded triangle, max(8, 4 × stroke width) long, capped at half the last segment, in the stroke colour, crisp at
  Clean, Hand-drawn and Sketchy; the sketched line ends at the head's base. Round caps and joins on connector lines.
  Tree connectors keep their arrow rules (none by default). PNG export and the defaults preview share `drawEdge`.
  Perf (`--perf-test`, whole 2,096-node diagram): 28.6–34.9 ms before, 28.8–31.0 ms after, over three runs each.
  Tests: 11 integration assertions (gap at sloppiness 0/1/2 for straight, elbow, curved and bent; drawn path starts on
  the trimmed end and stops at the head base, read from the path given to Rough.js; filled head checked by pixels; hit
  testing 3px from each end; a real click selects the connector; handles on the trimmed ends; no head without an
  arrow; tree gap; round caps). Known: a connector end on a side midpoint sits inside that side's port hit area, so
  a click there grabs the port, as it did before the gap. Environment note: on a 1× display (external 1080p as main
  screen) two older assertions fail on clean HEAD too: integration "A long label wraps …" (field scrollWidth 159 vs
  clientWidth 157) and feedback "Active text editor renders at native zoom …" (width rounded to 103 vs 102.6).
- [x] Phase 4a (2026-10-01): Command F opens a floating, panel-aware Find bar for Boards and Notes; selected node
  text is prefilled and selected, Enter/Shift Enter and previous/next wrap, Aa toggles match case, and Escape keeps
  the current element/text selected. Board matches include connector labels and hidden descendants, exclude comments,
  and open collapsed ancestors only when visited; navigation pans/zooms into the usable viewport. Current matches
  have a blue ring/glow, other matches amber, and no-results marks the field red. Notes uses DOM Range overlays without
  changing stored HTML or undo history, stays below the formatting toolbar, and searches across inline formatting.
  Find is also in the native Edit menu and contextual command catalog.
  Board Export PDF is directly below Export PNG in the title menu and available in Command K and native File.
  Whole-board/selection and white/transparent options render a bounded 3× raster on a content-sized single PDF page,
  sharing the Notes native save panel and atomic write path. Connector-only selections work; content bounds include
  labels. Collapsed descendants, collapse badges, selection/hover helpers and Find rings are excluded. Native raster
  validation, oversized-board refusal, Cancel/Escape during preparation and failure cleanup are covered. Native
  save-panel cancellation keeps the Notes behavior. No schema/default/version changes. Vector/selectable Board PDF text remains a follow-up; Notes PDFs
  retain their selectable-text path. PDF export stays app-only, as for Notes; browser mode shows a Back to app message.
  Clean-HEAD → final assertions: integration 479→479, schema 11→11, navigation 77→108, notebook 52→62, feedback 75→75,
  Program A 588→588, Program B 604→604; Node cases 35→35. Storage passes; browser hook smoke 3→3 checks. Final sweep
  passes in one run. Two interim label/caret failures passed on rerun; neither baseline 1× assertion failed here.
  Inspected Find board/no-results/Notes, PDF menu/dialog, command menu and Phase 2 panel/context/picker snapshots, plus
  four rendered Board PDFs (whole white/transparent, selected node, selected connector); PDF alpha masks verified.
  Detailed evidence and remaining limits: `verification/phase4a.md`; local logs/snapshots: `.runlogs/phase4a/`.

---

# Recovery implementation: installed version 1.28 baseline

Do not ship until this checklist is verified. The earlier 1.4 archive is not compatible with the current schema-3 library.

## Provenance and boundaries
- Frontend and native integration fixtures copied from installed Excalidravv 1.28.0, build 40. See ../verification/compatibility-hold/installed-baseline.json for hashes.
- Native source candidate is version 1.7.0 from Documents/Codex. Missing bridges: external image storage and preferences. Implement against installed frontend behavior and synthetic fixtures.
- No production documents/images copied or used as tests. Existing application remains unchanged. This folder is an isolated build.
- Google Sans files explicitly excluded. Reuse locally available fonts at runtime without bundling/redistributing them. Preserve Comic Shanns and existing rendering features.

## Gates
- [x] C0 Native schema 1/2/3 read/write, image references, safe recovery, preferences; synthetic future-schema and invalid-save tests.
- [x] C1 Installed frontend baseline: notes/PDF, imports, sidebar, stickers, attachments, per-root direction, styling and existing test suites.
- [x] A Port canvas trust/inspector/editor fixes while preserving 1.28 behavior; verify available Google Sans rendering directly.
- [ ] B Full inheritance and command discovery on current architecture.
- [ ] C Dedicated Lines and editable atomic Eisenhower template.
- [ ] D Spatial guidance and scoped layout.
- [ ] E Connector migration/Auto/manual routes; keep installed bend fields visually stable until explicitly edited.
- [ ] Final current-baseline regression, rendered QA, packaging and updated compatibility report. Do not claim schema-3 compatibility based only on schema-1 tests.

## Baseline verification

Schema-3 native storage passes generated image-reference, deduplication, sticker, Notes, preferences, invalid-path/save, recovery and future-schema fixtures. The installed-version integration suite, sidebar/navigation suite and Notes/multi-page-PDF suite all pass. The available 28 model/import/style tests pass. Logs are in `verification/baseline/`. Runtime Google Sans is loaded from the existing local application only; no Google Sans resource is present in this distribution.

## Release A port audit and concrete plan

- `web/app.js`: preserve current labels, bend handles, placeholders, stickers, circular shapes, per-root direction, sidebar and performance caches. Disable obsolete open migrations; use scoped layout and validated viewport-aware insertion including sidebar/notes/inspector. Keep current native editor positioning but round to device pixels and preserve canonical wrapping.
- `web/model.js`: add placement/scoped-layout helpers; keep installed clone/index/default/attachment semantics. Validate complete bundles before paste.
- `web/rich-text.js`: keep label insets, text cache, empty-caret and hard-newline helpers; port grapheme measurement, editor-only soft wraps, IME guard and native caret movement. Use current local Google Sans and Comic Shanns plus explicit Arial fallback.
- `web/features.js`, `style.css`: preserve context actions and custom colors; retain multi-selection, consume dismissal/Escape, add accessible swatch navigation/mixed state. Existing four inspector layer actions already present; verify attachment-aware ordering.
- `src/main.swift`, `Info.plist`, `index.html`: lowercase product surfaces, existing bundle/storage, native Command K later in B. Runtime font access replaces bundled Google Sans.
- Tests: retain all installed suites, add focused program-A model/WK fixtures and rendered Google Sans Risk assess at fractional zoom; later port B–E only after A gate.

## Release B audit and execution plan

- `web/model.js`: replace 1.28's Start/end and root exceptions with the approved literal donor whitelist, including width/height, fill pattern, corner style, stroke pattern, font and uniform typing marks. Keep parent/order, attachments, group, notes and connector metadata excluded. Scope extension layout to the donor's tree.
- `web/app.js`, `rich-text.js`: preserve inherited dimensions during initial quick editing, maintain centered flow reflow, pan against usable viewport, and keep one creation/text undo step. Existing repeat/IME guards stay in place.
- `web/commands.js`, `index.html`, `style.css`, native Edit menu: add contextual search, recent commands, keyboard focus and canvas actions. Integrate existing Notes separately so canvas actions never mutate a Notes document. Preserve 1.28's shape shortcuts (actual size remains Command Shift 0).
- `web/defaults.js`: remove the now-contradictory After Start/end override from the settings surface; preserve its stored legacy preference without using it for keyboard extension. PRD 7.6 and decision 17.2 explicitly supersede that behavior. Other shape/connector preferences remain.
- Tests: extend the model property/exclusion matrix and current WK fixture; update only old assertions that contradict literal inheritance. Verify current baseline, defaults, quick text undo/redo, copied/saved style and PNG; inspect command menu capture before advancing to C.

## Release A verification — 2026-09-29

Implemented viewport-aware atomic paste using actual inspector geometry, isolated context selection, sharp shared grapheme wrapping and native caret movement, transparent-first accessible swatches, existing attachment-aware layer controls, explicit Arial fallback, and lowercase product surfaces. Removed the obsolete open-time style/layout migration. Current per-root directions, connector labels/bends, images/stickers, Notes/PDF and sidebar behavior remain.

Evidence in `verification/release-a/`: 30 model tests; full installed-version native regression; Notes/PDF and sidebar/navigation; native schema 1/2/3 storage; focused undo/redo, copy/paste, save/load and PNG lifecycle. Font boundary coverage spans 4 fonts × 5 sizes × 9 zooms, with two actual DOM caret/glyph boundaries per case. Google Sans is available from the user's existing local installation at runtime; no Google Sans asset is in this build. The rendered 57% screenshot was inspected. Paste regression now compares with the usable panel-aware viewport, replacing its obsolete fixed-width test helper.

Remaining QA limit: a real hardware IME session has not been performed; composition-event/key suppression and Unicode editing pass. A native screenshot may omit the blinking caret; measured native DOM selection boundaries provide caret evidence. This gate is not a whole-program compatibility/release claim. Resume with B.

### Verification cadence adjustment

Per the user's feedback, keep each release's focused native fixture separate. `--program-a-test` owns the font matrix; `--program-test` currently owns Release B. Do not rerun the font matrix for unrelated command/style changes. Run relevant focused checks, then the main existing regression at the release gate; repeat only on a failure or a material change. The B regression's font-button failure was an obsolete three-font expectation after adding explicit Arial, updated to the four supported controls.
