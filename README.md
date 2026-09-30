# mapyourmind

An offline flowchart and mind-map app for Macs with Apple Silicon (M1 or newer), macOS 13 or later.
No account, no internet, no tracking. Your diagrams stay on your Mac.

## Install

1. Download `mapyourmind-1.31.0-AppleSilicon.zip` and double-click it to unzip.
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
| Find text in a Board or Notes | **⌘F**, Enter / Shift Enter for next / previous, Esc to close |
| Connect two shapes | Hover a shape and drag from one of its dots to another shape |
| Comment on a node | ⌘⌥C |
| Style defaults | ⌘, |
| Export as PNG | ⌘E |
| Export a Board as PDF | Document title ▾ → **Export PDF…**, or ⌘K → "Export PDF" |
| Pan / fit to screen | Space + drag / ⌘0 |
| Undo / redo | ⌘Z / ⌘⇧Z |
| All shortcuts | ⌘K, then "Show keyboard shortcuts" |

Everything saves automatically.

Board PDFs use a high-resolution (3×) image on a page sized to your content. Choose the whole board or current
selection, with a white or transparent background. Text in Board PDFs is part of the image; Notes PDFs keep selectable
text. Find searches element text and connector labels, including collapsed branches, and opens a branch when you visit
its match. Comments are excluded.

## Open mapyourmind in your browser (for screen sharing)

Some meeting apps only let you share a browser tab, not an app window. Browser mode opens mapyourmind in a browser tab so you can share just that tab. It shows the same documents, and changes save to your Mac as usual.

**To start:** choose **File → Open in Browser** (or press ⌘K and type "browser"). mapyourmind saves your work and opens a tab. Share that tab in your meeting.

While the tab is open, the app window shows a short status screen instead of your documents. That way only one place edits at a time.

**To come back:** click **← Back to app** at the bottom of the sidebar in the tab, or **Back to app** in the app window. Your work is saved, and the app opens where you left off.

**Good to know**

- Nothing goes online. The page only runs on your own Mac.
- Keep the app open while you use the tab. If you quit the app, the tab saves its last change and then stops.
- If the tab opened in the wrong browser, click **Copy link** in the app window and paste the link into the browser you use for meetings. **Open tab again** reopens a tab you closed.
- If you open a second tab, the newest one is the one that edits. The older tab shows **Use this tab instead** if you want it back.
- If your Mac sleeps or gets busy, the tab shows "Reconnecting…". Keep working; it saves when the connection is back.
- The first time you paste, the browser asks for clipboard permission. Click **Allow**.
- In the browser, ⌘1–6 and ⌘N switch tabs and open windows instead. Use the shape buttons on the left and the **+** button instead.
- Exporting Boards or Notes as PDF only works in the app. Diagrams export as PNG in both.

## Where your data lives

`~/Library/Application Support/mapyourmind/`. Back up this folder if you want a copy of your diagrams.
Deleting the app does not delete your diagrams.

## Build from source

Requires Xcode Command Line Tools on an Apple Silicon Mac. Run `./build.sh`. The app is written to `dist/mapyourmind.app`.
Development notes are in `COMPATIBILITY-CHECKLIST.md` and `CLAUDE.md`.
