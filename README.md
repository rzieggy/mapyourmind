# mapyourmind

An offline flowchart and mind-map app for Macs with Apple Silicon (M1 or newer), macOS 13 or later.
No account, no internet, no tracking. Your diagrams stay on your Mac.

## Install

1. Download `mapyourmind-1.29.0-AppleSilicon.zip` and double-click it to unzip.
2. Drag `mapyourmind.app` into your **Applications** folder.
3. Open it. The first time, macOS blocks it because this is a personal build that isn't notarized by Apple:
   - **macOS 15 or newer:** open the app once and close the warning. Then go to **System Settings → Privacy & Security**,
     scroll down to the line about mapyourmind, click **Open Anyway** and confirm.
   - **macOS 13–14:** right-click the app in Applications, choose **Open**, then **Open** again.

   You only need to do this once.

## Getting started

| Do this | How |
|---|---|
| New document | ⌘N |
| Add a child / sibling node | Select a node, press **Tab** (child) or **Enter** (sibling), then type |
| Edit a node's text | Double-click it |
| Shapes | ⌘1–6: rectangle, decision, start/end, note, circle, input/output |
| Find any action | **⌘K**, type what you want, press Enter |
| Connect two shapes | Hover a shape and drag from one of its dots to another shape |
| Comment on a node | ⌘⌥C |
| Style defaults | ⌘, |
| Export as PNG | ⌘E |
| Pan / fit to screen | Space + drag / ⌘0 |
| Undo / redo | ⌘Z / ⌘⇧Z |
| All shortcuts | ⌘K, then "Show keyboard shortcuts" |

Everything saves automatically.

## Browser mode (for sharing a tab)

When a meeting only lets you share a browser tab, run mapyourmind as a local page instead of the app:

1. Quit the mapyourmind app.
2. In Terminal: `/Applications/mapyourmind.app/Contents/MacOS/mapyourmind --serve`
3. It opens `http://127.0.0.1:4870` in your browser, on the same library as the app. Share that tab.
4. When you are done, close the tab, then press Control-C in Terminal.

The server listens on this Mac only (127.0.0.1). The app and browser mode refuse to run at the same time, so two copies never write to one library. `--port N` picks another port, and `--no-open` skips opening the browser.

In the browser, PDF export for Notes is unavailable, and the browser keeps some shortcuts for itself: ⌘1 to ⌘6 switch tabs and ⌘N opens a window. Use the tool rail and the + button instead. Copy and paste ask for clipboard permission once.

## Where your data lives

`~/Library/Application Support/mapyourmind/`. Back up this folder if you want a copy of your diagrams.
Deleting the app does not delete your diagrams.

## Build from source

Requires Xcode Command Line Tools on an Apple Silicon Mac. Run `./build.sh`. The app is written to `dist/mapyourmind.app`.
Development notes are in `COMPATIBILITY-CHECKLIST.md` and `CLAUDE.md`.
