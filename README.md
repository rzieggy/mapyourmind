# mapyourmind

An offline flowchart and mind-map app for Macs with Apple Silicon (M1 or newer), macOS 13 or later.
No account, no internet, no tracking. Your diagrams stay on your Mac.

## Install

1. Download `mapyourmind-1.30.0-AppleSilicon.zip` and double-click it to unzip.
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

## Open mapyourmind in your browser (for screen sharing)

Some meeting apps only let you share a browser tab, not an app window. Browser mode opens mapyourmind in a Chrome tab so you can share just that tab. It shows the same documents, and changes save to your Mac as usual.

**To start**

1. Quit the mapyourmind app (⌘Q).
2. Open **Terminal**, paste this line and press Return:

   ```
   /Applications/mapyourmind.app/Contents/MacOS/mapyourmind --serve
   ```

3. mapyourmind opens in your browser. In your meeting, share that tab.

Keep the Terminal window open while you work. Closing it stops browser mode.

**To stop**

1. Close the mapyourmind tab.
2. In Terminal, press **Control-C**.
3. Open the mapyourmind app again as usual.

**Good to know**

- Nothing goes online. The page only runs on your own Mac.
- You can't use the app and the browser tab at the same time. If you try, mapyourmind tells you to close the other one first, so your work never gets overwritten.
- If the tab opened in the wrong browser, copy the address (`http://127.0.0.1:4870`) into the browser you use for meetings.
- The first time you paste, the browser asks for clipboard permission. Click **Allow**.
- In the browser, ⌘1–6 and ⌘N switch tabs and open windows instead. Use the shape buttons on the left and the **+** button instead.
- Exporting Notes as PDF only works in the app. Diagrams export as PNG in both.

## Where your data lives

`~/Library/Application Support/mapyourmind/`. Back up this folder if you want a copy of your diagrams.
Deleting the app does not delete your diagrams.

## Build from source

Requires Xcode Command Line Tools on an Apple Silicon Mac. Run `./build.sh`. The app is written to `dist/mapyourmind.app`.
Development notes are in `COMPATIBILITY-CHECKLIST.md` and `CLAUDE.md`.
