(function(root) {
  "use strict";
  // Public interchange contract, deliberately independent of the storage schema.
  function parse(input) {
    if (typeof input === "string" && input.length > 2000000) throw Error("File exceeds the 2 MB import limit.");
    let value;
    try { value = typeof input === "string" ? JSON.parse(input.replace(/^\uFEFF/, "")) : input; }
    catch { throw Error("Invalid JSON. Ask your chat to regenerate the file as valid JSON."); }
    const object = v => v && typeof v === "object" && !Array.isArray(v);
    if (!object(value) || value.format !== "excalidravv-mindmap") throw Error("Expected format: excalidravv-mindmap.");
    if (value.version !== 1) throw Error("Unsupported mind-map version. This app supports version 1.");
    if (typeof value.title !== "string" || !value.title.trim() || value.title.length > 160) throw Error("title must contain 1–160 characters.");
    const layout = value.layout ?? "horizontal";
    if (!["horizontal", "vertical"].includes(layout)) throw Error("layout must be horizontal or vertical.");
    let count = 0;
    const seen = new Set();
    function visit(n, path, depth) {
      if (++count > 2000) throw Error("A mind map can contain at most 2,000 nodes per import.");
      if (depth > 64) throw Error("A mind map can have at most 64 levels.");
      if (!object(n) || seen.has(n)) throw Error(`${path} must be a unique node object.`);
      seen.add(n);
      if (typeof n.text !== "string" || !n.text.trim() || n.text.length > 10000) throw Error(`${path}.text must contain 1–10,000 characters.`);
      if (n.notes !== undefined && (!Array.isArray(n.notes) || n.notes.length > 100 || n.notes.some(t => typeof t !== "string" || !t.trim() || t.length > 20000))) throw Error(`${path}.notes must be an array of up to 100 non-empty text notes (20,000 characters each).`);
      if (n.children !== undefined && !Array.isArray(n.children)) throw Error(`${path}.children must be an array.`);
      return { text: n.text, notes: [...(n.notes || [])], children: (n.children || []).map((c,i) => visit(c, `${path}.children[${i}]`, depth+1)) };
    }
    const tree = visit(value.root, "root", 1);
    return { format: value.format, version: 1, title: value.title.trim(), layout, root: tree };
  }
  const api = { parse };
  if (typeof module !== "undefined") module.exports = api;
  root.MindmapImport = api;
})(globalThis);
