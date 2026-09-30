# Phase 4a verification — 2026-10-01

Scope: Find in Boards and Notes, and Board PDF export only. Baseline was clean `3a70f22` on `main`.
No installation, push, tag, release, schema migration or production-library access was performed.
Native app launches used `--ui-test`; builds used `zsh build.sh` and its `--storage-test`.
Sandbox UI launches aborted before assertions, so real window-server runs used full access as required by the handoff.

| Suite | Baseline | Final | Result |
| --- | ---: | ---: | --- |
| Node (`node --test tests/*.cjs`) | 35 cases | 35 cases | PASS |
| Integration | 479 | 479 | PASS |
| Schema 3 | 11 | 11 | PASS |
| Navigation | 77 | 108 | PASS |
| Notebook | 52 | 62 | PASS |
| Feedback | 75 | 75 | PASS |
| Program A | 588 | 588 | PASS |
| Program B | 604 | 604 | PASS |
| Native storage | No assertion counter | No assertion counter | PASS |
| Browser hook smoke | 3 checks | 3 checks | PASS |
| Perf | 0 assertions / 11 measurements | 0 assertions / 11 measurements | Completed |

The final full sweep passed in one run. During earlier checkpoints, feedback failed once at
“Typing after Shift Enter stays on the new line”, and integration failed once at
“A short label stays on one line and its field grows with the text”. Both passed on isolated rerun;
the final sweep also passed both. The two documented 1×-display assertions passed at baseline and final.
No assertion was removed. The document-menu action-list expectation was updated for the added PDF item.

Find acceptance covers focused/prefilled input, counts including collapsed descendants and connector labels,
comment exclusion, previous/next and wrapping, Aa, ancestor expansion, offscreen visibility, blue/amber rings,
no results, Escape retaining selection, document switching, and command discovery. Notes adds occurrence counts,
matches across inline marks, paragraph boundaries, toolbar clearance, retained editable text selection,
and unchanged HTML/undo history.

PDF acceptance covers menu order, both dialog choices, command discovery, actual native temporary-file writing and
PDF reopening, page bounds and 3× raster dimensions, white/transparent alpha, collapsed/helper exclusions,
identical raster bytes with and without Find/selection/hover overlays, node and connector-only selections,
Cancel/Escape before writing, oversized rejection, error cleanup/retry state, and invalid native input.
The native save panel itself is bypassed by the documented UI-test destination; its name and cancellation code
share the existing Notes path. Notes' multi-page selectable-text PDF regression still passes.

| Visual evidence inspected | Outcome |
| --- | --- |
| `phase4a-find-board`, `phase4a-find-empty` | Bar clears the style panel; blue/amber rings and red no-results state appear correctly; old rings disappear |
| `phase4a-find-notes` | Toolbar remains visible; Range overlays follow inline text without modifying it |
| `phase4a-pdf-menu`, `phase4a-pdf-dialog` | PDF follows PNG; scope/background controls and raster explanation are legible |
| `program-b-commands` | Existing command dialog/focus layout remains intact |
| `phase2-panel`, `phase2-context`, `phase2-picker` | Existing style controls and dark menus remain intact |
| Whole-board white and transparent PDFs, selected node and selected connector PDFs | Correct orientation, legible labels, content-sized page, no clipping or UI helpers |

Board fixtures were rendered with bundled `pdftoppm` and structurally inspected with `pypdf`.
Each has one embedded raster on one page; transparent files have `/SMask`, white files do not.
Whole board: 640 × 336 points, 1920 × 1008 raster pixels. Selected node: 240 × 136 points,
720 × 408 pixels. Selected connector: approximately 143.333 × 176 points, 430 × 528 pixels.
Board PDF text extraction is empty, as expected for raster output.

The initial 2,096-node perf fixture measured 29.40 ms for whole-board paint. Checkpoint and final runs varied from
29.55 to 41.15 ms, so the original source was rebuilt under `.runlogs/phase4a/baseline-checkout/` and compared
alternately against the final build with the same `--ui-test --perf-test` fixture:

| Alternating measurement | Original HEAD | Phase 4a |
| --- | ---: | ---: |
| Whole-board paint, run 1 | 30.05 ms | 29.25 ms |
| Whole-board paint, run 2 | 31.65 ms | 28.75 ms |
| Store round trip, run 1 | 178.0 ms | 171.0 ms |
| Store round trip, run 2 | 170.6 ms | 171.0 ms |

These matched runs do not show a paint regression. They are observational timings, not a performance gate.
Local logs, assertion counts and retained snapshots are under `.runlogs/phase4a/` (ignored by Git).

Remaining limits: Board PDFs are raster at 3×; vector/selectable Board text is a follow-up.
PDF export is app-only, as the Notes path already was; the browser displays guidance to return to the app.
The browser hook smoke checks serving/token/normal Quit, not the separate browser automation planned for Phase 5.
Phases 4b/4c and the later phases were not started.
