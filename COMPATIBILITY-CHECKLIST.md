# mapyourmind project notes

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
