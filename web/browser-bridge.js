// Browser mode (`mapyourmind --serve`). The app page talks to its native shell
// through window.webkit.messageHandlers.native; in a browser there is no such
// handler, so this stands one up. Storage actions go to the local server, which
// runs the same LocalStore as the app; the rest have browser equivalents.
// Loaded only by the page the server rewrites, never by the native app.
(() => {
  if (window.webkit?.messageHandlers?.native) return;
  const token = document.querySelector('meta[name="mym-token"]')?.content || "";
  const server = new Set(["load", "save", "putImage", "loadPreferences", "savePreferences", "clock", "localFonts"]);
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
      throw Error("Exporting as PDF only works in the mapyourmind app.");
    },
  };
  async function call(message) {
    const { id, action } = message;
    try {
      if (local[action]) return reply(id, await local[action](message));
      if (!server.has(action)) return reply(id, null, "Unavailable in the browser.");
      const response = await fetch("/native", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Mym-Token": token },
        body: JSON.stringify(message),
      });
      const body = await response.json();
      reply(id, body.result, body.error);
    } catch (e) {
      if (e.name === "NotAllowedError" && (action.startsWith("clipboard") || action === "png"))
        return reply(id, null, "The browser blocked the clipboard. Click the clipboard icon in the address bar, choose Allow, then try again.");
      reply(id, null, e.message === "Failed to fetch" ? "Can't save: browser mode has stopped. Start it again from Terminal, then make any change to save." : e.message);
    }
  }
  window.webkit = { messageHandlers: { native: { postMessage: call } } };
  window.mapyourmindBrowser = true;
  // The Mac app saves when its window loses focus and on quit; a tab gets the
  // same through visibility changes, and asks before closing with an edit waiting.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") window.flushSave?.().catch(() => {});
  });
  window.addEventListener("beforeunload", (e) => {
    window.flushSave?.().catch(() => {});
    // revision and savedRevision are app.js script globals.
    if (typeof revision !== "undefined" && revision !== savedRevision) e.preventDefault();
  });
})();
