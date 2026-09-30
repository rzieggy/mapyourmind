"use strict";
// The app window's page while mapyourmind is open in a browser tab. The native
// shell calls setBrowserStatus about once a second; buttons go back to it.
(() => {
  const $ = (id) => document.getElementById(id);
  const send = (action) =>
    window.webkit.messageHandlers.native.postMessage({ id: "browser-mode", action });
  let copiedTimer = 0;
  $("copy").onclick = () => {
    send("browserCopyLink");
    $("copy").textContent = "Copied";
    $("copy").classList.add("done");
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      $("copy").textContent = "Copy link";
      $("copy").classList.remove("done");
    }, 2000);
  };
  $("openTab").onclick = () => send("browserOpenTab");
  $("back").onclick = () => send("browserBack");
  window.nativeReply = () => {};
  // phase: "starting" | "live" | "ending"; tabs: connected tab count.
  window.setBrowserStatus = ({ phase, url, tabs, lastSaved }) => {
    $("url").textContent = url || "";
    const saved = lastSaved ? " · last saved " + lastSaved : "";
    const none = phase === "live" && !tabs;
    $("title").textContent =
      phase === "starting" ? "Opening in your browser…"
      : phase === "ending" ? "Saving the tab's last change…"
      : none ? "No browser tab is open"
      : "mapyourmind is open in your browser";
    $("body").textContent = none
      ? "The tab was closed, or it opened in a browser you're not using for the meeting. Open it again, or copy the link into the right browser."
      : "Edit and share it from the tab. This window stays open so you can reopen the tab or come back here.";
    $("dot").className = "dot" + (phase === "ending" || phase === "starting" ? " busy" : tabs ? " live" : "");
    $("status").textContent =
      phase === "ending" ? "Finishing up"
      : phase === "starting" ? "Starting"
      : (tabs ? (tabs === 1 ? "1 tab connected" : tabs + " tabs open, the newest one can edit") : "No tab connected") + saved;
    $("linkRow").classList.toggle("highlight", none);
    $("openTab").className = none ? "primary" : "secondary";
    $("back").className = none ? "secondary" : "primary";
    for (const id of ["openTab", "back", "copy"]) $(id).disabled = phase !== "live";
  };
})();
