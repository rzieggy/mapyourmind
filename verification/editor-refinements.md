# Editor refinements verification — 2026-10-01

Scope: approved R1–R13 in `REQUIREMENTS-EDITOR-REFINEMENTS.md`. All development and evidence stayed in this repo.
No push, tag, release, installation, version change or production-library access. Native launches always used
`--ui-test` (or the build's `--storage-test`), with temporary stores; browser testing used `--ui-test --browser-test`.

## Baseline and final counts

Baseline was archived clean `ffee331`, before changing source. The initial working tree already contained Space
and shape-stroke work. Space was adopted into this feature; unrelated stroke changes remain unstaged and excluded.
The final functional source was separately archived and built so these counts exclude the five local stroke tests.

| Suite | Clean baseline | Final | Result |
| --- | ---: | ---: | --- |
| Node model/import/style | 35 cases | 36 cases | PASS |
| Integration | Failed at #139; last complete 479 | 479 assertions | PASS |
| Schema 3 | 11 | 11 | PASS |
| Navigation | 108 | 113 | PASS |
| Notebook | 62 | 62 | PASS |
| Feedback | Failed at editor rounding; last complete 75 | 86 | PASS |
| Program A | 588 | 588 | PASS |
| Program B | 604 | 604 | PASS |
| Refinements | 0 | 55 | PASS |
| Native storage | PASS, no numeric counter | PASS, no numeric counter | PASS |
| Browser hook smoke | 3 checks | 3 checks | PASS |
| Perf | 0 assertions / 11 measurements | 0 assertions / 11 measurements | Completed |

Do not treat the historical 479/75 as passing baseline runs on this display. Both known 1× failures repeated on
clean HEAD. The label overlay now allows 1px of WebKit rounding slack and the fractional-width assertion allows
half a device pixel; overflow and untransformed native-size checks are retained. The existing Shift Enter caret
assertion failed once in an intermediate clean-source sweep, passed on isolated rerun, and passed in the final
full sweep. No coverage was silently removed. Fixtures now drag within the new compact child bounds, and the
shape-growth fixture uses two lines because one line now correctly fits in its existing height.

The complete final sweep passed in one run. Working-tree sweeps report Feedback 91 because they also execute the
five pre-existing stroke assertions; committed source reports 86. Local source/evidence and logs are in
`.runlogs/refinements/`; final clean-source logs are in `verified/`. Browser smoke checks serving, token and normal Quit.

## Acceptance evidence

- Shell: no palette or floating node toolbar; node/edge/empty-canvas context actions, selected edge commands, scoped
  arrange, sidebar 14px rows, footer Settings, matching pinned rectangular swatches and retained comments panel.
- Alignment: Command Shift L/E/R reaches selected text and the active editor, preserves ranges and undo; Command E
  remains PNG. Notes link editing retains Command K. Space tap collapse versus pan, mixed branches, typing/IME guards.
- Canvas: transparent text descendants with preserved tree identity/reparent connector colour, compact default heights,
  line-break growth/shrink, width wrapping, resize undo/redo and schema-3 save/load. Manual shape resizing stays intact.
- Rulers: nearest edge-gap/equal-gap math, overlap/distance limits, live world-pixel values at 50%, 100% and 200%,
  clearing on drop, and retained move undo boundaries. Measurements use visible moving selection/subtree bounds.
- Stickers: cursor ghost without content/history changes, Escape dismissal with picker focus, click placement exactly
  once at the cursor as one undo step, cancellation on tool/document/presentation changes and native save compatibility.
- Presentation: editing UI hidden, native/menu/key/drag/double-click mutation paths blocked, selection/pan/zoom/Find/
  collapse retained; original graph, revision and history unchanged by temporary navigation. Native saves preserve
  original collapse flags and geometry; leaving/switching restores editing and clears transient state. Notes has no toggle.
- Pointer: actual painted dot/circle, 800ms fade, Space pan while enabled, Escape/cancel/exit/switch clearing, no history
  changes; byte-identical PNG and Board-PDF rasters with and without the pointer layer.

Browser UI was also driven against a temporary store: create Board, type a root and text child, collapse the root,
enter View only, expand with Space, enable/drag/disable Pointer, then reload. Reload restored the originally collapsed
root and editing controls. Normal Quit ended the tab with “mapyourmind was closed / Your saved work is safe”. This is
focused browser acceptance, not the separate broad browser regression planned for later phases.

## Visual QA

| Snapshots inspected | Finding |
| --- | --- |
| `phase2-panel`, `phase2-context`, `phase2-picker` | Sidebar/footer, rounded rectangular palettes, style panel and dark right-click/shape menus remain legible; floating node toolbar absent |
| `refinements-text` | Root keeps its container, descendants are text with visible connectors; free text wraps within compact height; rectangle padding reduced |
| `refinements-sticker-preview` | Ghost follows cursor; placement/cancel hint visible |
| `refinements-rulers` | Blue edge-gap line, ticks and pixel label are visible at the actual move position |
| `refinements-view-only` | Editing rail, inspector and history disappear; visible Back to editing and Pointer controls |
| `refinements-pointer` | Red circle/dot above content; pointer active state and hint clear |
| `phase4a-find-board` | Existing Find bar and blue/amber matches still clear the style panel |
| Browser presentation and post-reload views | Text child visible during temporary expansion; original collapsed badge returns after reload |

Retained native snapshot copies are in `.runlogs/refinements/evidence/`.

## Performance and limits

| 2,096-node / 2,060-connector fixture | Baseline | Final clean source |
| --- | ---: | ---: |
| Whole-board paint | 31.10ms | 28.45ms |
| 100% zoom paint | 3.35ms | 2.80ms |
| Pointer hover, no drag | 3.13ms | 2.94ms |
| Store round trip | 241.8ms | 169.2ms |

These are observational timings, not a statistical performance gate. Whole-board checkpoint paints were approximately
30–31ms; no meaningful rendering slowdown appeared. Laser samples are bounded to 512 and RAF stops once trails expire.

All approved requirements are complete. Direct macOS 13 runtime testing is still unavailable; the build retains its
arm64 macOS 13 target. Board PDF remains the existing 3× raster/app-only path, and old saved nodes are intentionally
not migrated. The isolated intermittent Shift Enter assertion is documented above; the final sweep passed it.
No later project phases or releases were started. Existing unrelated stroke edits remain for the user's next decision.
