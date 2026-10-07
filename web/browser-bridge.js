// Browser mode. The app page talks to its native shell through
// window.webkit.messageHandlers.native; in a browser there is no such handler, so
// this stands one up. Storage actions go to the local server, which runs the same
// LocalStore as the app; the rest have browser equivalents. Loaded only by the
// page the server rewrites (src/serve.swift), never by the native app.
//
// The tab says hello with its own session id and then sends a heartbeat every two
// seconds. The newest tab is the only one that may save; the heartbeat also says
// when the app wants the tab to finish ("back" or "quit").
(() => {
  if (window.webkit?.messageHandlers?.native) return;
  const token = document.querySelector('meta[name="mym-token"]')?.content || "";
  const session = crypto.randomUUID();
  const server = new Set(["load", "save", "putImage", "loadPreferences", "savePreferences", "clock"]);
  // Copied elements keep their editable form here, keyed by the plain text that
  // went to the system clipboard, because a page cannot write a custom type.
  let copied = { text: null, editable: "" };
  // app.js asks for the library while later scripts are still loading. The app
  // replies after they have all run; over HTTP a reply can arrive sooner, so each
  // one waits for the document to finish parsing.
  const parsed = new Promise((resolve) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", resolve, { once: true })
      : resolve(),
  );
  const reply = (id, result, error) =>
    parsed.then(() => window.nativeReply({ id, result: result ?? null, error: error ?? null }));
  const base64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  const pngBlob = (data) =>
    new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], { type: "image/png" });
  function download(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function pickFile(accept) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.onchange = () => resolve(input.files[0] || null);
      input.oncancel = () => resolve(null);
      input.click();
    });
  }
  const local = {
    documentMode: () => true,
    openLink: ({ url }) => {
      if (!/^(https?|mailto):/i.test(url)) throw Error("Unsupported link.");
      window.open(url, "_blank", "noopener");
      return true;
    },
    clipboardWrite: async ({ text = "", editable }) => {
      await navigator.clipboard.writeText(text);
      copied = { text, editable: editable || "" };
      return true;
    },
    clipboardRead: async () => {
      const clip = { text: "", editable: "" };
      for (const item of await navigator.clipboard.read()) {
        if (item.types.includes("image/png") && !clip.image)
          clip.image = await base64(await item.getType("image/png"));
        if (item.types.includes("text/plain") && !clip.text)
          clip.text = await (await item.getType("text/plain")).text();
      }
      if (clip.text === copied.text) clip.editable = copied.editable;
      return clip;
    },
    png: async ({ data, clipboard, filename }) => {
      const blob = pngBlob(data);
      if (clipboard) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        copied = { text: null, editable: "" };
      } else download(blob, (filename || "Diagram") + ".png");
      return true;
    },
    importMindmap: async () => {
      const file = await pickFile(".json,application/json");
      if (!file) return null;
      if (file.size > 2_000_000) throw Error("File exceeds the 2 MB import limit.");
      return file.text();
    },
    notePDF: () => {
      throw Error("Exporting as PDF only works in the mapyourmind app. Use Back to app, then export.");
    },
    boardPDF: () => local.notePDF(),
  };
  // A request to the local server. Throws with `gone` set when this page's server
  // is no longer the one running (the app went back or quit and started again).
  async function post(message) {
    const response = await fetch("/native", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Mym-Token": token },
      body: JSON.stringify({ ...message, session }),
    });
    if (response.status === 403) throw Object.assign(Error("gone"), { gone: true });
    return response.json();
  }
  const stopped = "This tab has stopped. Open mapyourmind to keep working.";
  async function call(message) {
    const { id, action } = message;
    try {
      if (ended) return reply(id, null, stopped);
      if (local[action]) return reply(id, await local[action](message));
      if (!server.has(action)) return reply(id, null, "Unavailable in the browser.");
      const body = await post(message);
      if (body.error === "inactive") {
        showTakenOver();
        return reply(id, null, "This tab can't save because mapyourmind is open in a newer tab.");
      }
      if (action === "save" && !body.error) noteSaved();
      reply(id, body.result, body.error);
    } catch (e) {
      if (e.name === "NotAllowedError" && (action.startsWith("clipboard") || action === "png"))
        return reply(id, null, "The browser blocked the clipboard. Click the clipboard icon in the address bar, choose Allow, then try again.");
      if (e.gone) {
        finish("gone");
        return reply(id, null, stopped);
      }
      reply(id, null, e.message === "Failed to fetch" ? "Can't reach mapyourmind right now. Keep working; this tab saves when it's back." : e.message);
    }
  }
  window.webkit = { messageHandlers: { native: { postMessage: call } } };
  window.mapyourmindBrowser = true;

  // ---- Screens and notices drawn over the app (the Browser Mode design canvas).
  const style = document.createElement("style");
  style.textContent = `
    .mym-cover{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;font:14px "Inter",-apple-system,sans-serif;color:#1c2533}
    .mym-cover.dim{background:rgba(21,35,59,.55)}
    .mym-cover.soft{background:rgba(246,248,251,.96)}
    .mym-card{width:400px;padding:26px;background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(10,20,40,.35);display:flex;flex-direction:column;gap:12px}
    .mym-plain{width:420px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center}
    .mym-cover h2{margin:0;font-size:20px;font-weight:700}
    .mym-cover p{margin:0;line-height:1.5;color:#3d4a5c}
    .mym-cover .fine{font-size:12px;color:#7a8595}
    .mym-cover button{align-self:flex-end;font:inherit;font-weight:500;color:#fff;background:#2474d0;border:0;border-radius:8px;padding:10px 18px;cursor:pointer}
    .mym-badge{width:52px;height:52px;border-radius:26px;display:flex;align-items:center;justify-content:center;background:#eaf2fc;color:#2474d0}
    .mym-badge.off{background:#e6e9ee;color:#4a5566}
    .mym-banner{position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:9999;display:flex;gap:12px;align-items:center;padding:10px 16px;background:#fff6df;border:1px solid #f1e0b0;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.08);font:13px "Inter",-apple-system,sans-serif;color:#5c4400}
    .mym-banner b{font-weight:600;white-space:nowrap}
    .mym-footer{display:flex;flex-direction:column;gap:3px;padding:10px 12px 4px}
    .mym-footer span{font-size:11px;color:#8fa3c0}
    .mym-footer button{all:unset;cursor:pointer;font-size:12px;font-weight:600;color:#9cc3f5}
    .mym-footer button:hover{color:#fff}
    .mym-footer button:focus-visible{outline:2px solid #9cc3f5;outline-offset:2px;border-radius:3px}
    .mym-home-back{margin-left:auto;margin-right:16px}
    .mym-tip{position:fixed;left:20px;bottom:20px;z-index:9998;width:300px;padding:14px 16px;background:#15233b;color:#d8e2f0;border-radius:10px;box-shadow:0 10px 26px rgba(10,20,40,.25);display:flex;flex-direction:column;gap:8px;font:13px/1.45 "Inter",-apple-system,sans-serif}
    .mym-tip b{color:#fff;font-weight:600}
    .mym-tip button{align-self:flex-end;font:inherit;font-weight:600;font-size:12.5px;color:#fff;background:#2474d0;border:0;border-radius:6px;padding:6px 12px;cursor:pointer}`;
  const check = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const power = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v9"/><path d="M6.3 7.3a8 8 0 1 0 11.4 0"/></svg>';
  let cover = null, banner = null, ended = false, takenOver = false, lastSaved = "";
  const noteSaved = () =>
    (lastSaved = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
  function showCover(kind, html) {
    cover?.remove();
    cover = document.createElement("div");
    cover.className = "mym-cover " + kind;
    cover.innerHTML = html;
    document.body.append(cover);
    cover.querySelector("button")?.focus();
    return cover;
  }
  function showTakenOver() {
    if (takenOver || ended) return;
    takenOver = true;
    showCover("dim", `<div class="mym-card" role="alertdialog" aria-labelledby="mymTitle"><h2 id="mymTitle">Open in another tab</h2>
      <p>mapyourmind is now active in a newer tab. Only one tab can edit at a time, so changes you make here won't be saved.</p>
      <button type="button">Use this tab instead</button></div>`).querySelector("button").onclick = () => location.reload();
  }
  // kind: "back" shows the return screen; "quit" and "gone" the closed screen.
  function finish(kind) {
    if (ended) return;
    ended = true;
    clearTimeout(beatTimer);
    banner?.remove();
    if (kind === "back")
      showCover("soft", `<div class="mym-plain" role="status"><div class="mym-badge">${check}</div><h2>You're back in the app</h2>
        <p>Everything is saved. You can close this tab.</p><p class="fine">Stop sharing first if the meeting is still showing it.</p></div>`);
    else
      showCover("soft", `<div class="mym-plain" role="status"><div class="mym-badge off">${power}</div><h2>mapyourmind was closed</h2>
        <p>${lastSaved ? "Everything up to " + lastSaved + " is saved." : "Your saved work is safe."} Open the app to keep working. This tab can't edit anymore.</p></div>`);
  }

  // ---- Heartbeat: connection state, the newest-tab rule and endings.
  let beatTimer = 0, failingSince = 0;
  async function beat() {
    if (ended || takenOver) return;
    let state;
    try {
      state = (await post({ action: "heartbeat" })).result;
    } catch (e) {
      if (e.gone) return finish("gone");
      failingSince ||= Date.now();
      // Two minutes without an answer: the app is gone (crashed or force-quit).
      if (Date.now() - failingSince > 120_000) return finish("gone");
      if (!banner) {
        banner = document.createElement("div");
        banner.className = "mym-banner";
        banner.setAttribute("role", "status");
        banner.innerHTML = "<span>Can't reach the mapyourmind app. Keep working — changes stay in this tab and save when it's back.</span><b>Reconnecting…</b>";
        document.body.append(banner);
      }
      beatTimer = setTimeout(beat, 3000);
      return;
    }
    if (failingSince) {
      failingSince = 0;
      banner?.remove();
      banner = null;
      window.flushSave?.().catch(() => {});
    }
    // A tab that lost to a newer one stops here; reloading it claims it again.
    if (!state.active) return showTakenOver();
    if (state.ending) {
      await window.flushSave?.().catch(() => {});
      await post({ action: "ended" }).catch(() => {});
      return finish(state.ending);
    }
    beatTimer = setTimeout(beat, 2000);
  }
  // Sidebar footer and ⌘K: save, hand back to the app, show the return screen.
  window.backToApp = async () => {
    if (ended || takenOver) return;
    try {
      await window.flushSave?.();
      await post({ action: "backToApp" });
      finish("back");
    } catch (e) {
      if (e.gone) return finish("gone");
      alert("Couldn't go back to the app: " + (e.message === "Failed to fetch" ? "it isn't reachable right now." : e.message));
    }
  };

  // ---- Start: claim this tab, then add the sidebar footer and one-time tip.
  const hello = post({ action: "hello" }).catch(() => null);
  parsed.then(async () => {
    document.head.append(style);
    const answer = (await hello)?.result;
    beatTimer = setTimeout(beat, 2000);
    // Only a tab the app opened can hand back to it; `--serve` from Terminal has no app.
    if (answer?.app) {
      const footer = document.createElement("div");
      footer.className = "mym-footer";
      footer.innerHTML = '<span>Browser mode</span><button type="button">← Back to app</button>';
      footer.querySelector("button").onclick = () => window.backToApp();
      document.getElementById("sidebarTrash")?.after(footer);
      // The library screen has no sidebar, so it gets the same link in its header.
      const home = document.createElement("button");
      home.type = "button";
      home.className = "secondary mym-home-back";
      home.textContent = "← Back to app";
      home.onclick = () => window.backToApp();
      document.querySelector(".home-header .local-badge")?.before(home);
    } else window.backToApp = undefined;
    let seen = false;
    try { seen = localStorage.getItem("mym-browser-tip") === "1"; } catch {}
    if (!seen) {
      const tip = document.createElement("div");
      tip.className = "mym-tip";
      tip.innerHTML = '<b>Shortcuts in the browser</b><span>⌘1 to ⌘6 and ⌘N belong to the browser here. Pick shapes from the tool bar on the left and use + for a new document.</span><button type="button">Got it</button>';
      tip.querySelector("button").onclick = () => {
        tip.remove();
        try { localStorage.setItem("mym-browser-tip", "1"); } catch {}
      };
      document.body.append(tip);
    }
  });

  // The Mac app saves when its window loses focus and on quit; a tab gets the
  // same through visibility changes, and asks before closing with an edit waiting.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && !ended && !takenOver) window.flushSave?.().catch(() => {});
  });
  window.addEventListener("beforeunload", (e) => {
    if (ended || takenOver) return;
    window.flushSave?.().catch(() => {});
    // revision and savedRevision are app.js script globals.
    if (typeof revision !== "undefined" && revision !== savedRevision) e.preventDefault();
  });
})();
