"use strict";
// "Google Sans" was the sans-serif font before 1.38; files may still carry it, and
// it reads as Inter, the font that replaced it. New elements only ever get "Inter".
const documentFonts = ["Excalifont", "Inter", "Comic Shanns", "Arial", "Google Sans"];
function elementFont(element) {
  const font = documentFonts.includes(element?.fontFamily) ? element.fontFamily : "Excalifont";
  return '"' + (font === 'Google Sans' ? 'Inter' : font) + '", Arial, sans-serif';
}
function isNotebook() { return current?.mode === "notes"; }
function blankNote() { return { html: "<p><br></p>", fontFamily: "Excalifont", fontSize: 19, textColor: "#1b1b1f" }; }
// Folders are optional. A folderId that names no folder reads as loose, so it
// is only checked for its type here.
function validFolders(state) {
  if (state.folders === undefined) return true;
  if (!Array.isArray(state.folders)) return false;
  const ids = new Set();
  return state.folders.every((f) => f && typeof f.id === "string" && !ids.has(f.id) && ids.add(f.id) &&
    typeof f.name === "string" && f.name.length <= 200 && Number.isFinite(f.order) &&
    (f.collapsed === undefined || typeof f.collapsed === "boolean")) &&
    state.documents.every((doc) => doc.folderId === undefined || typeof doc.folderId === "string");
}
function validDocument(doc) {
  if (!FlowModel.validate(doc.canvas)) return false;
  if (doc.mode === "notes") {
    const n = doc.note;
    if (!n || typeof n.html !== "string" || n.html.length > 2000000 ||
        !documentFonts.includes(n.fontFamily) || ![14,19,25,34,44].includes(n.fontSize) ||
        !/^#[0-9a-f]{6}$/i.test(n.textColor) || doc.canvas.nodes.length || doc.canvas.edges.length) return false;
  }
  return [...doc.canvas.nodes, ...doc.canvas.edges].every(e =>
    (e.fontFamily === undefined || documentFonts.includes(e.fontFamily)) &&
    (e.strokeStyle === undefined || ["solid","dashed","dotted"].includes(e.strokeStyle)) &&
    (e.sloppiness === undefined || [0,1,2].includes(e.sloppiness)) &&
    (e.fillStyle === undefined || ["hachure","cross-hatch","solid"].includes(e.fillStyle)) &&
    (e.edges === undefined || ["sharp","round"].includes(e.edges)) &&
    (e.direction === undefined || ["horizontal","vertical"].includes(e.direction)) &&
    (e.bend === undefined || (!!e.bend && Number.isFinite(e.bend.x) && Number.isFinite(e.bend.y))));
}
function strokeOptions(e, connector) {
  const legacy = e.sloppiness === undefined;
  const level = e.sloppiness;
  return {
    roughness: legacy ? (connector ? .2 : 1.35) : [0, .75, 1.8][level],
    bowing: legacy ? (connector ? .15 : 1.6) : [0, .7, 1.9][level],
    disableMultiStroke: legacy ? connector : level === 0,
    preserveVertices: level === 0,
    strokeLineDash: e.strokeStyle === "dashed" ? [e.sw * 5, e.sw * 3] : e.strokeStyle === "dotted" ? [e.sw, e.sw * 2.5] : [],
  };
}
// Retain only editor-supported content. Never preserve resource-loading elements,
// arbitrary attributes, or styles that can escape the note's layout.
function sanitizeNote(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const out = document.createElement("div");
  const allowed = new Set(["P","DIV","BR","H1","H2","H3","B","STRONG","I","EM","U","S","UL","OL","LI","A","SPAN","MARK","BLOCKQUOTE"]);
  const blocked = new Set(["SCRIPT","STYLE","IFRAME","OBJECT","EMBED","IMG","VIDEO","AUDIO","SVG","MATH","LINK","META","INPUT","BUTTON","SELECT","TEXTAREA"]);
  function copy(node, parent, depth) {
    if (depth > 64) { parent.append(document.createTextNode(node.textContent || "")); return; }
    if (node.nodeType === Node.TEXT_NODE) { parent.append(document.createTextNode(node.data)); return; }
    if (node.nodeType !== Node.ELEMENT_NODE || blocked.has(node.tagName)) return;
    if (!allowed.has(node.tagName)) { for (const child of node.childNodes) copy(child, parent, depth + 1); return; }
    const el = document.createElement(node.tagName === "DIV" ? "p" : node.tagName.toLowerCase());
    if (node.tagName === "A" && /^(https?:\/\/|mailto:)/i.test(node.getAttribute("href") || "")) el.setAttribute("href", node.getAttribute("href"));
    if (node.tagName === "LI" && ["true","false"].includes(node.dataset.checked)) el.dataset.checked = node.dataset.checked;
    if (node.tagName === "OL" && /^\d{1,4}$/.test(node.getAttribute("start") || "")) el.setAttribute("start", node.getAttribute("start"));
    for (const key of ["fontWeight","fontStyle","textDecorationLine","backgroundColor"]) {
      const val = node.style[key];
      if (val && !/url|var\(/i.test(val)) el.style[key] = val;
    }
    for (const child of node.childNodes) copy(child, el, depth + 1);
    parent.append(el);
  }
  for (const child of template.content.childNodes) copy(child, out, 0);
  return out.innerHTML || "<p><br></p>";
}
