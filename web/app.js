"use strict";
const M = FlowModel,
  $ = (id) => document.getElementById(id),
  canvas = $("canvas"),
  ctx = canvas.getContext("2d");
let state = { schema: 2, documents: [] },
  current = null,
  trash = false,
  selected = new Set(),
  tool = "select",
  shape = "process",
  view = { x: 140, y: 150, z: 1 },
  history = new M.History(),
  editing = null,
  drag = null,
  space = false,
  quick = null,
  connectorStart = null,
  hoveredNode = null,
  hoveredPort = null,
  guides = [],
  hover = null,
  saveTimer = null,
  saveChain = Promise.resolve(),
  savedRevision = 0,
  revision = 0,
  // A pan, zoom, note scroll or document switch is saved with the next save,
  // or by flushSave when nothing else is waiting.
  positionMoved = false,
  loaded = false,
  saveFailed = false;
const pending = new Map();
// Images are stored once each, by the native store, and a save sends only
// their refs. This remembers which image strings already have one.
const imageRefs = new Map();
async function storeImages(snapshot) {
  snapshot.schema = 3;
  for (const doc of snapshot.documents)
    for (const n of doc.canvas.nodes) {
      if (n.kind !== "image") continue;
      if (!imageRefs.has(n.imageData))
        imageRefs.set(n.imageData, await native("putImage", { data: n.imageData }));
      n.imageRef = imageRefs.get(n.imageData);
      delete n.imageData;
    }
}
function native(action, data = {}) {
  return new Promise((resolve, reject) => {
    const id = M.uid();
    pending.set(id, { resolve, reject });
    window.webkit.messageHandlers.native.postMessage({ id, action, ...data });
  });
}
window.nativeReply = ({ id, result, error }) => {
  const p = pending.get(id);
  if (!p) return;
  pending.delete(id);
  error ? p.reject(Error(error)) : p.resolve(result);
};
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("toast").hidden = true), 3500);
}
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const d = () => current?.canvas;
function updateSave() {
  if (current)
    $("saveStatus").textContent = saveFailed
      ? "Could not save — try again"
      : savedRevision === revision
        ? "Saved on this Mac"
        : "Saving…";
}
function persist() {
  if (!loaded) return Promise.resolve();
  clearTimeout(saveTimer);
  const snapshot = M.clone(state),
    r = revision;
  positionMoved = false;
  saveChain = saveChain
    .catch(() => {})
    .then(() => storeImages(snapshot))
    .then(() => native("save", { state: snapshot }))
    .then(() => {
      savedRevision = r;
      saveFailed = false;
      updateSave();
    })
    .catch((e) => {
      saveFailed = true;
      updateSave();
      toast(e.message);
      throw e;
    });
  return saveChain;
}
function changed() {
  if (typeof refreshFind === "function") refreshFind();
  revision++;
  if (current) current.updated = Date.now();
  updateSave();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persist().catch(() => {}), 200);
}
// Called whenever the window loses focus and on quit, so it writes only when
// something is waiting rather than rewriting the whole store each time.
window.flushSave = async () => {
  const scroll = current?.note?.scroll;
  if (isNotebook()) syncNotebook();
  if (editing) commitEdit();
  if (current) {
    if (!M.same(current.view, view) || current.note?.scroll !== scroll)
      positionMoved = true;
    current.view = { ...view };
  }
  if (loaded && (positionMoved || revision !== savedRevision)) await persist();
};
function mutate(fn, relayout = true) {
  const before = M.clone(d());
  fn();
  if(relayout)M.layoutChanged(d(),before);
  history.commit(before, d());
  changed();
  render();
  inspect();
}
function finish(before, relayout = true) {
  if(relayout)M.layoutChanged(d(),before);
  history.commit(before, d());
  changed();
  render();
  inspect();
}
function uniqueName(name, exclude) {
  const names = new Set(
    state.documents
      .filter((x) => x.id !== exclude && !x.trashedAt)
      .map((x) => x.title),
  );
  if (!names.has(name)) return name;
  let i = 2;
  while (names.has(name + " " + i)) i++;
  return name + " " + i;
}
function closeModal() {
  $("modal").close();
}
function showModal(html) {
  $("modalBody").innerHTML = html;
  $("modal").showModal();
  $("modal")
    .querySelector("[data-close]")
    ?.addEventListener("click", closeModal);
}
function askName(title, value, callback, chooseMode = false) {
  showModal(
    `<h2>${esc(title)}</h2><p>Document name</p>${chooseMode ? `<div class="mode-choices"><button class="mode-card" data-new-mode="board" aria-pressed="true">${icon("board")}<strong>Board</strong><small>Flowcharts and mind maps on one canvas.</small></button><button class="mode-card" data-new-mode="notes" aria-pressed="false">${icon("note")}<strong>Notes</strong><small>Write, plan, and keep a checklist.</small></button></div>` : ""}<input type="text" id="nameInput" maxlength="160" value="${esc(value)}"><div class="actions"><button data-close>Cancel</button><button id="nameSubmit" class="primary">Save</button></div>`,
  );
  let newMode = "board";
  for (const b of $("modalBody").querySelectorAll("[data-new-mode]"))
    b.onclick = () => {
      newMode = b.dataset.newMode;
      for (const item of $("modalBody").querySelectorAll("[data-new-mode]"))
        item.setAttribute("aria-pressed", String(item === b));
    };
  const input = $("nameInput");
  input.focus();
  input.select();
  const done = () => {
    const name = input.value.trim();
    if (!name) return;
    closeModal();
    callback(name, newMode);
  };
  $("nameSubmit").onclick = done;
  input.onkeydown = (e) => {
    if (e.key === "Enter") done();
  };
}
function confirmAction(title, description, callback) {
  showModal(
    `<h2>${esc(title)}</h2><p>${esc(description)}</p><div class="actions"><button data-close>Cancel</button><button class="primary" id="confirmAction">Continue</button></div>`,
  );
  $("confirmAction").onclick = () => {
    closeModal();
    callback();
  };
}
function newDoc() {
  if (editing) commitEdit();
  askName(
    "New document",
    "Untitled",
    (title, mode) => {
      const doc = {
        id: M.uid(),
        title: uniqueName(title),
        mode,
        fontVersion: "excalifont-v1",
        connectorVersion: 3,
        created: Date.now(),
        updated: Date.now(),
        trashedAt: null,
        trashElapsed: 0,
        canvas: M.blank(),
        ...(mode === "notes" ? { note: blankNote() } : {}),
      };
      state.documents.unshift(doc);
      placeDocumentFirst(doc);
      changed();
      openDoc(doc.id);
    },
    true,
  );
}
// A document only needs an explicit order once the list has been arranged by
// hand; until then creation date already puts the newest first.
function placeDocumentFirst(doc) {
  const orders = state.documents
    .filter((a) => a.id !== doc.id && Number.isFinite(a.order))
    .map((a) => a.order);
  if (orders.length) doc.order = Math.min(...orders) - 1;
}
// Trashing or erasing the open document has to leave it, not keep editing it.
async function leaveDocument(id) {
  if (current?.id !== id) return;
  const next = state.documents
    .filter((a) => !a.trashedAt && a.id !== id)
    .sort((a, b) => b.updated - a.updated)[0];
  if (next) openDoc(next.id);
  else await goHome();
}
function renderHome() {
  renderDocumentSidebar();
  const docs = state.documents
    .filter((x) => (trash ? x.trashedAt : !x.trashedAt))
    .sort((a, b) => b.updated - a.updated);
  $("trashCount").textContent =
    state.documents.filter((x) => x.trashedAt).length || "";
  $("documentsTab").classList.toggle("active", !trash);
  $("trashTab").classList.toggle("active", trash);
  $("newDoc").hidden = trash;
  $("docList").innerHTML = docs.length
    ? docs
        .map(
          (doc) =>
            `<div class="doc-row"><div class="doc-symbol">${icon(trash ? "trash" : doc.mode === "notes" ? "note" : "document")}</div><button class="doc-open" data-open="${doc.id}" ${trash ? "disabled" : ""}><div class="doc-name">${esc(doc.title)}</div><div class="doc-meta">${doc.mode === "notes" ? "Notes" : doc.canvas.nodes.length + " elements"} · ${trash ? "Deleted" : "Edited"} ${new Date(trash ? doc.trashedAt : doc.updated).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</div></button><div class="doc-actions">${trash ? `<button data-action="restore" data-id="${doc.id}">Restore</button><button data-action="erase" data-id="${doc.id}" class="danger">Delete permanently</button>` : `<button data-action="rename" data-id="${doc.id}">Rename</button><button data-action="duplicate" data-id="${doc.id}">Duplicate</button><button data-action="trash" data-id="${doc.id}" title="Move to Trash" aria-label="Move to Trash">${icon("trash")}</button>`}</div></div>`,
        )
        .join("")
    : `<div class="empty-library"><strong>${trash ? "Nothing in Trash." : "A blank page. An open mind."}</strong>${trash ? "Documents in Trash can be restored for 30 days." : "Create your first document to start connecting ideas."}</div>`;
  for (const b of $("docList").querySelectorAll("[data-open]"))
    b.onclick = () => openDoc(b.dataset.open);
  for (const b of $("docList").querySelectorAll("[data-action]"))
    b.onclick = () =>
      docAction(b.dataset.action, b.dataset.id).catch((e) => toast(e.message));
}
async function docAction(action, id) {
  const doc = state.documents.find((a) => a.id === id);
  if (action === "rename")
    askName("Rename", doc.title, (title) => {
      doc.title = uniqueName(title, id);
      changed();
      renderHome();
    });
  if (action === "duplicate") {
    const copy = M.clone(doc);
    copy.id = M.uid();
    copy.title = uniqueName(doc.title + " copy");
    copy.updated = Date.now();
    copy.created = Date.now();
    state.documents.unshift(copy);
    placeDocumentFirst(copy);
    changed();
    renderHome();
  }
  if (action === "trash") {
    doc.trashClock = await native("clock");
    doc.trashedAt = Date.now();
    doc.trashElapsed = 0;
    changed();
    await leaveDocument(id);
    renderHome();
    toast("Document moved to Trash.");
  }
  if (action === "restore") {
    doc.trashedAt = null;
    doc.trashElapsed = 0;
    doc.title = uniqueName(doc.title, id);
    doc.updated = Date.now();
    changed();
    renderHome();
  }
  if (action === "erase")
    confirmAction(
      "Delete permanently?",
      `“${doc.title}” cannot be recovered after deletion.`,
      async () => {
        state.documents = state.documents.filter((a) => a.id !== id);
        changed();
        await leaveDocument(id);
        renderHome();
      },
    );
}
function openDoc(id) {
  if (typeof closeFind === "function") closeFind(false);
  if (isNotebook()) syncNotebook();
  if (current && current.id !== id) {
    if (editing) commitEdit();
    cancelDrag();
    current.view = { ...view };
    positionMoved = true;
  }
  current = state.documents.find((a) => a.id === id);
  resetPasteCascade();
  shape = "process";
  notesNodeId = null;
  $("notesPanel").hidden = true;
  // Stored geometry is authoritative. Only the targeted tree-arrow migration may change presentation.
  current.mode ||= "board";
  history = new M.History();
  selected.clear();
  editing = null;
  view = current.view ? { ...current.view } : { x: 140, y: 155, z: 1 };
  $("home").hidden = true;
  $("workspace").hidden = false;
  $("docTitle").textContent = current.title;
  syncMode();
  setTool("select");
  openNotebook();
  resize();
  inspect();
  updateSave();
  renderDocumentSidebar();
  if (isNotebook()) $("noteBody").focus(); else canvas.focus();
}
async function goHome() {
  try {
    await window.flushSave();
  } catch {
    return;
  }
  if (typeof closeFind === "function") closeFind(false);
  current = null;
  selected.clear();
  $("workspace").hidden = true;
  $("home").hidden = false;
  renderHome();
}
$("newDoc").onclick = newDoc;
$("documentsTab").onclick = () => {
  trash = false;
  renderHome();
};
$("trashTab").onclick = () => {
  trash = true;
  renderHome();
};
function renameCurrent(title) {
  current.title = uniqueName(title, current.id);
  $("docTitle").textContent = current.title;
  if (isNotebook()) $("noteHeading").textContent = current.title;
  changed();
  renderDocumentSidebar();
}
// A single click waits briefly so that a double-click can rename without the
// menu flashing open first.
let titleClickTimer = null;
$("docTitle").onclick = () => {
  clearTimeout(titleClickTimer);
  titleClickTimer = setTimeout(() => toggleDocMenu(), 220);
};
$("docTitle").ondblclick = () => {
  clearTimeout(titleClickTimer);
  closeDocMenu();
  renameTitleInPlace();
};
function renameTitleInPlace() {
  if (!current) return;
  const title = $("docTitle"),
    input = document.createElement("input");
  input.className = "title-input";
  input.value = current.title;
  input.maxLength = 160;
  input.setAttribute("aria-label", "Document name");
  title.hidden = true;
  title.after(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    const name = input.value.trim();
    input.remove();
    title.hidden = false;
    if (save && name && name !== current.title) renameCurrent(name);
    if (isNotebook()) $("noteBody").focus(); else canvas.focus();
  };
  input.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  };
  input.onblur = () => finish(true);
}
function closeDocMenu() {
  $("docMenu").hidden = true;
  $("docTitle").setAttribute("aria-expanded", "false");
}
function toggleDocMenu() {
  if (!current) return;
  if (!$("docMenu").hidden) return closeDocMenu();
  const notebook = isNotebook(),
    count = notebook ? "Notes" : d().nodes.length + (d().nodes.length === 1 ? " element" : " elements"),
    edited = new Date(current.updated || Date.now()).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }),
    item = (action, iconName, label, extra = "") =>
      `<button role="menuitem" data-doc-action="${action}"${extra}>${icon(iconName)}<span>${label}</span></button>`;
  const menu = $("docMenu");
  menu.innerHTML =
    item("rename", "pencil", "Rename") +
    item("duplicate", "copy", "Duplicate") +
    '<div class="menu-separator"></div>' +
    (notebook ? "" : item("import", "import", "Import mind map…")) +
    item("export", "export", notebook ? "Export PDF…" : "Export PNG…") +
    (notebook ? "" : item("export-pdf", "export", "Export PDF…")) +
    '<div class="menu-separator"></div>' +
    item("trash", "trash", "Move to Trash", ' class="danger"') +
    '<div class="menu-separator"></div>' +
    `<div class="menu-info">${esc(count)}<br>Edited ${esc(edited)}</div>`;
  const box = $("docTitle").getBoundingClientRect();
  menu.style.left = box.left + "px";
  menu.style.top = box.bottom + 6 + "px";
  menu.hidden = false;
  $("docTitle").setAttribute("aria-expanded", "true");
  for (const button of menu.querySelectorAll("[data-doc-action]"))
    button.onclick = async () => {
      closeDocMenu();
      const action = button.dataset.docAction;
      try {
        if (action === "rename") renameTitleInPlace();
        else if (action === "import") await chooseMindmapImport();
        else if (action === "export") exportDialog();
        else if (action === "export-pdf") exportBoardPDFDialog();
        else await docAction(action, current.id);
      } catch (error) {
        toast(error.message);
      }
    };
  menu.querySelector("button").focus();
}
document.addEventListener("pointerdown", (e) => {
  if (!$("docMenu").hidden && !$("docMenu").contains(e.target) && e.target !== $("docTitle")) closeDocMenu();
}, true);
$("docMenu").addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.stopPropagation();
    closeDocMenu();
    $("docTitle").focus();
  }
});
$("openSettings").onclick = () => window.appCommand("settings");
// Both node tools are always on the rail, so a Board has no creation mode to show.
function syncMode() {
  $("modeHint").textContent = "Pick a tool on the left, then click the canvas.";
}
function arrangeMindMaps() {
  mutate(() => M.tidy(d()));
  fit();
  toast("Mind maps arranged. Manual positions reset.");
}
// Direction is a property of a tree's source node, set from its context menu.
function setTreeDirection(id, direction) {
  if (editing) commitEdit();
  mutate(() => M.setDirection(d(), direction, id));
  const b = treeViewBounds(id);
  // Only reframe when the tree has outgrown the view; otherwise the canvas
  // stays exactly where the user left it.
  if (b && !boundsOnScreen(b)) fitBounds(b);
}
function boundsOnScreen(b) {
  const margin = 24;
  return (
    b.x * view.z + view.x >= margin &&
    b.y * view.z + view.y >= margin &&
    (b.x + b.w) * view.z + view.x <= canvas.clientWidth - 260 &&
    (b.y + b.h) * view.z + view.y <= canvas.clientHeight - margin
  );
}
function cancelDrag() {
  if (drag?.before) current.canvas = drag.before;
  drag = null;
  hover = null;
  hoveredNode = null;
  hoveredPort = null;
  guides = [];
  render();
}
function setTool(t) {
  if (editing) commitEdit();
  hoveredNode = null;
  hoveredPort = null;
  tool = t;
  quick = null;
  connectorStart = null;
  $("shapePicker").hidden = true;
  for (const b of $("toolbar").querySelectorAll("button"))
    b.classList.toggle("active", b.dataset.tool === t);
  $("addSticker").classList.toggle("active", !$("stickerDropdown").hidden);
  canvas.style.cursor =
    t === "hand" ? "grab" : t === "select" ? "default" : "crosshair";
  $("contextHint").textContent = {
    select: "Select and move · Shift to multi-select · Space to pan",
    hand: "Drag to pan · Pinch the trackpad to zoom",
    shape: "Click or drag to create a shape",
    mind: "Click to create a root · Tab for a child · Enter for a sibling",
    text: "Click anywhere to write",
    connector: "Drag from a connection point to another shape",
  }[t];
  render();
}
// Listed in the order of their ⌘1 to ⌘6 shortcuts.
const shapeLabels = [
  ["process", "shape", "Rectangle"],
  ["decision", "diamond", "Decision"],
  ["pill", "pill", "Start / end"],
  ["note", "note", "Note"],
  ["circle", "circle", "Circle"],
  ["io", "io", "Input / output"],
];
function shapeForKey(e) {
  const digit = /^Digit([1-6])$/.exec(e.code)?.[1];
  return digit ? shapeLabels[digit - 1][0] : null;
}
function showPicker(x, y, source = null) {
  quick = source;
  const picker = $("shapePicker");
  picker.innerHTML = shapeLabels
    .map(
      ([key, iconName, label], i) =>
        `<button data-shape="${key}" title="${label} (⌘${i + 1})">${icon(iconName)}<span>${label}</span></button>`,
    )
    .join("");
  picker.style.left = Math.min(x, canvas.clientWidth - 190) + "px";
  picker.style.top = Math.min(y, canvas.clientHeight - 310) + "px";
  picker.hidden = false;
  for (const b of picker.querySelectorAll("button"))
    b.onclick = () => {
      shape = b.dataset.shape;
      picker.hidden = true;
      if (quick) {
        const before = M.clone(d());
        const n = M.node(
          "flow",
          quick.x,
          quick.y,
          shape,
        );
        d().nodes.push(n);
        M.connect(d(), quick.id, n.id, { fromSide: quick.side });
        quick = null;
        selected = new Set([n.id]);
        beginEdit(n, { before, quick: true });
      } else {
        setTool("shape");
      }
      render();
    };
}
for (const b of $("toolbar").querySelectorAll("button[data-tool]"))
  b.onclick = () => {
    const t = b.dataset.tool;
    // Picking another tool closes the sticker dropdown so rail popovers never stack.
    if (!$("stickerDropdown").hidden) {
      $("stickerDropdown").hidden = true;
      $("addSticker").setAttribute("aria-expanded", "false");
      $("addSticker").classList.remove("active");
    }
    if (t === "shape") {
      setTool(t);
      // The picker opens beside the rail, level with the Shape button.
      const button = b.getBoundingClientRect(),
        stage = canvas.getBoundingClientRect();
      showPicker(button.right - stage.left + 10, button.top - stage.top - 6);
    } else setTool(t);
  };
function resize() {
  const r = canvas.getBoundingClientRect(),
    ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * ratio);
  canvas.height = Math.round(r.height * ratio);
  render();
  positionEditor();
  positionStickerDropdown();
}
window.addEventListener("resize", resize);
function point(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left - view.x) / view.z,
    y: (e.clientY - r.top - view.y) / view.z,
  };
}
function screenPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function zoom(
  value,
  sx = canvas.clientWidth / 2,
  sy = canvas.clientHeight / 2,
) {
  const z = Math.max(0.1, Math.min(4, value));
  view.x = sx - ((sx - view.x) * z) / view.z;
  view.y = sy - ((sy - view.y) * z) / view.z;
  view.z = z;
  $("zoomValue").textContent = Math.round(z * 100) + "%";
  render();
  positionEditor();
  if (current) {
    current.view = { ...view };
    changedView();
  }
}
// Panning and zooming are not edits: the view rides along with the next save,
// a document switch or the save on leaving the app, rather than rewriting the
// whole store and moving the document up the "last edited" order.
function changedView() {
  clearTimeout(changedView.timer);
  changedView.timer = setTimeout(() => {
    if (!current) return;
    current.view = { ...view };
    positionMoved = true;
  }, 400);
}
function fitBounds(b) {
  if (!b || !b.w || !b.h) return;
  const w = canvas.clientWidth - 373,
    h = canvas.clientHeight - 210;
  view.z = Math.max(0.1, Math.min(1.4, w / b.w, h / b.h));
  view.x = 70 - b.x * view.z + (w - b.w * view.z) / 2;
  view.y = 120 - b.y * view.z + (h - b.h * view.z) / 2;
  $("zoomValue").textContent = Math.round(view.z * 100) + "%";
  render();
  changedView();
}
function fit() {
  if (!d()?.nodes.length) return;
  fitBounds(M.bounds(visibleCanvas().nodes));
}
// One tree's own bounds, so changing its layout frames that tree rather than
// zooming out to take in everything else on the canvas.
function treeViewBounds(id) {
  const ids = M.subtree(d(), id),
    ns = visibleCanvas().nodes.filter((n) => ids.has(n.id));
  return ns.length ? M.bounds(ns) : null;
}
$("zoomIn").onclick = () => zoom(view.z * 1.2);
$("zoomOut").onclick = () => zoom(view.z / 1.2);
$("zoomValue").onclick = () => zoom(1);
$("fit").onclick = fit;
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const p = screenPoint(e);
      zoom(view.z * Math.exp(-e.deltaY * 0.012), p.x, p.y);
    } else {
      view.x -= e.deltaX;
      view.y -= e.deltaY;
      render();
      positionEditor();
      changedView();
    }
  },
  { passive: false },
);
let lastGesture = 1;
canvas.addEventListener("gesturestart", (e) => {
  e.preventDefault();
  lastGesture = 1;
});
canvas.addEventListener("gesturechange", (e) => {
  e.preventDefault();
  const p = screenPoint(e);
  zoom((view.z * e.scale) / lastGesture, p.x, p.y);
  lastGesture = e.scale;
});
// A padded square inside the circle keeps every text alignment within its outline.
function circleTextInset(n) {
  return (n.w - n.w * Math.SQRT1_2) / 2 + 14;
}
function textWrapWidth(n) {
  if (n.kind === "label") return Math.max(1, n.wrapWidth);
  if (n.shape === "note") return Math.max(1, n.w - 40);
  return Math.max(1, n.w - (n.attachmentTo ? 16 : n.shape === "circle" ? 2 * circleTextInset(n) : n.shape === "decision" ? n.w * 0.4 : 28));
}
function fitCircle(n) {
  let low = Math.max(80, n.w, n.h);
  n.w = n.h = low;
  const fits = () => textLines(ctx, n).length * n.fontSize * 1.15 + 24 <= n.h * Math.SQRT1_2;
  if (fits()) return;
  let high = Math.max(low, (textLines(ctx, n).length * n.fontSize * 1.15 + 24) / Math.SQRT1_2);
  // Wrapping decreases as the diameter grows. Find the smallest fitting diameter.
  for (let i = 0; i < 24 && high - low > 0.25; i++) {
    n.w = n.h = (low + high) / 2;
    if (fits()) high = n.w;
    else low = n.w;
  }
  n.w = n.h = Math.ceil(high);
}
function textLines(c, n) {
  c.font = `${n.fontSize}px ${elementFont(n)}`;
  const max = textWrapWidth(n),
    lines = [];
  for (const para of n.text.split("\n")) {
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      if (c.measureText(line + word).width <= max) {
        line += word;
        continue;
      }
      if (line.trim()) {
        lines.push(line.trimEnd());
        line = "";
      }
      if (c.measureText(word).width <= max) {
        line = word.trimStart();
        continue;
      }
      for (const ch of [...word]) {
        if (c.measureText(line + ch).width > max && line) {
          lines.push(line);
          line = ch;
        } else line += ch;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

// Flowchart shapes grow about their centre when their text or shape changes,
// so a node lined up with its neighbours stays lined up. Resizing by handle
// still calls autoSize directly and keeps its dragged edge.
function reflow(n, minimumHeight = 0) {
  if (n.kind !== "flow" || n.attachmentTo) { autoSize(n); n.h = Math.max(n.h, minimumHeight); return; }
  const cx = n.x + n.w / 2,
    cy = n.y + n.h / 2;
  autoSize(n);
  n.h = Math.max(n.h, minimumHeight);
  n.x = cx - n.w / 2;
  n.y = cy - n.h / 2;
}
// ⌘1 to ⌘6 reshape the selection, including the node just created with Tab or
// Enter while its text is still open; with nothing selected they pick the
// shape tool.
function shapeShortcut(value) {
  const targets = d().nodes.filter(
    (n) =>
      selected.has(n.id) &&
      !n.attachmentTo &&
      !["text", "image", "sticker"].includes(n.kind),
  );
  if (editing) {
    const n = targets.find((a) => a.id === editing.id);
    if (!n) return;
    // The open edit already holds its undo snapshot, so this joins that step.
    n.shape = value;
    reflow(n);
    M.layout(d());
    positionEditor();
    inspect();
    render();
    return;
  }
  if (!targets.length) {
    shape = value;
    setTool("shape");
    return;
  }
  mutate(() => {
    for (const n of targets) {
      n.shape = value;
      reflow(n);
    }
  });
}
function autoSize(n) {
  if (["image", "sticker", "label"].includes(n.kind)) return;
  if (n.shape === "circle" && n.kind !== "text") return fitCircle(n);
  const lines = textLines(ctx, n);
  n.h = Math.max(
    n.attachmentTo ? 26 : n.kind === "text" ? 40 : 66,
    lines.length * n.fontSize * 1.15 + (n.attachmentTo ? 8 : 24),
  );
  if (n.shape === "decision") n.h = Math.max(110, n.h * 1.35);
}
const roughGenerator = rough.generator();
const roughCanvases = new WeakMap();
const shapeCache = new Map();
function roughCanvas(c) {
  if (!roughCanvases.has(c.canvas))
    roughCanvases.set(c.canvas, rough.canvas(c.canvas));
  return roughCanvases.get(c.canvas);
}
function sketchSeed(id) {
  let hash = 2166136261;
  for (const ch of id) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return ((hash >>> 0) % 2147483646) + 1;
}
function sketchShape(n) {
  const key = JSON.stringify([n.shape, n.edges, n.w, n.h, n.fill, n.fillStyle, n.stroke, n.sw, n.strokeStyle, n.sloppiness]);
  const cached = shapeCache.get(n.id);
  if (cached?.key === key) return cached.drawable;
  const options = {
    seed: sketchSeed(n.id),
    ...strokeOptions(n, false),
    stroke: n.stroke,
    strokeWidth: n.sw,
    fill: n.fill,
    // Hachure and cross-hatch follow the stroke weight so a thick outline does
    // not end up with a hairline fill, or the other way round.
    fillStyle: n.fillStyle || "solid",
    fillWeight: Math.max(0.5, n.sw / 2),
    hachureGap: Math.max(4, n.sw * 4),
  };
  let drawable;
  if (n.shape === "circle")
    drawable = roughGenerator.ellipse(n.w / 2, n.h / 2, n.w, n.h, options);
  else if (n.shape === "decision")
    drawable = roughGenerator.polygon(
      [
        [n.w / 2, 0],
        [n.w, n.h / 2],
        [n.w / 2, n.h],
        [0, n.h / 2],
      ],
      options,
    );
  else if (n.shape === "io")
    drawable = roughGenerator.polygon(
      [
        [22, 0],
        [n.w, 0],
        [n.w - 22, n.h],
        [0, n.h],
      ],
      options,
    );
  else if (n.shape === "pill") {
    const r = Math.min(24, n.h / 2);
    drawable = roughGenerator.path(
      `M${r} 0H${n.w - r}Q${n.w} 0 ${n.w} ${r}V${n.h - r}Q${n.w} ${n.h} ${n.w - r} ${n.h}H${r}Q0 ${n.h} 0 ${n.h - r}V${r}Q0 0 ${r} 0Z`,
      options,
    );
  } else if (n.shape === "note") {
    // A note is a rectangle with its bottom-right corner turned back, matching
    // the shape picker's icon. The fold is drawn as its own unfilled path.
    const fold = Math.max(10, Math.min(24, n.w / 4, n.h / 3)),
      { fill, ...outline } = options;
    drawable = [
      roughGenerator.path(
        `M0 0H${n.w}V${n.h - fold}L${n.w - fold} ${n.h}H0Z`,
        options,
      ),
      roughGenerator.path(
        `M${n.w - fold} ${n.h}V${n.h - fold}H${n.w}`,
        outline,
      ),
    ];
  } else if (n.edges === "round") {
    // A moderate radius, unlike the Start / end stadium.
    const r = Math.min(20, n.w / 6, n.h / 4);
    drawable = roughGenerator.path(
      `M${r} 0H${n.w - r}Q${n.w} 0 ${n.w} ${r}V${n.h - r}Q${n.w} ${n.h} ${n.w - r} ${n.h}H${r}Q0 ${n.h} 0 ${n.h - r}V${r}Q0 0 ${r} 0Z`,
      options,
    );
  } else drawable = roughGenerator.rectangle(0, 0, n.w, n.h, options);
  if (shapeCache.size > 3000) shapeCache.clear();
  shapeCache.set(n.id, { key, drawable });
  return drawable;
}
function drawNode(c, n, helpers = true) {
  if (n.kind === "sticker") { drawSticker(c, n); return; }
  if (n.kind === "image") {
    drawImageNode(c, n);
    return;
  }
  c.save();
  if (n.kind !== "text") {
    const shape = sketchShape(n);
    c.save();
    c.translate(n.x, n.y);
    for (const part of Array.isArray(shape) ? shape : [shape])
      roughCanvas(c).draw(part);
    c.restore();
  }
  if (editing?.id !== n.id) drawRichText(c, n);
  if (helpers) drawCollapsedBadge(c, n);
  c.restore();
}
function anchor(n, side) {
  if (side.includes("-")) {
    const right = side.endsWith("right"),
      bottom = side.startsWith("bottom");
    if (n.shape === "circle")
      return {
        x: n.x + n.w / 2 + (right ? 1 : -1) * n.w / 2 * Math.SQRT1_2,
        y: n.y + n.h / 2 + (bottom ? 1 : -1) * n.h / 2 * Math.SQRT1_2,
      };
    if (n.shape === "decision")
      return {
        x: n.x + n.w * (right ? 0.75 : 0.25),
        y: n.y + n.h * (bottom ? 0.75 : 0.25),
      };
    if (n.shape === "pill") {
      const r = Math.min(24, n.h / 2),
        inset = r * (1 - Math.SQRT1_2);
      return {
        x: n.x + (right ? n.w - inset : inset),
        y: n.y + (bottom ? n.h - inset : inset),
      };
    }
    if (n.shape === "io")
      return {
        x: n.x + (right ? (bottom ? n.w - 22 : n.w) : bottom ? 0 : 22),
        y: n.y + (bottom ? n.h : 0),
      };
  }
  if (n.shape === "io" && ["left", "right"].includes(side))
    return { x: n.x + (side === "left" ? 11 : n.w - 11), y: n.y + n.h / 2 };
  switch (side) {
    case "top-left":
      return { x: n.x, y: n.y };
    case "top-right":
      return { x: n.x + n.w, y: n.y };
    case "bottom-left":
      return { x: n.x, y: n.y + n.h };
    case "bottom-right":
      return { x: n.x + n.w, y: n.y + n.h };
    case "left":
      return { x: n.x, y: n.y + n.h / 2 };
    case "right":
      return { x: n.x + n.w, y: n.y + n.h / 2 };
    case "top":
      return { x: n.x + n.w / 2, y: n.y };
    case "bottom":
      return { x: n.x + n.w / 2, y: n.y + n.h };
  }
}
function sideVector(s) {
  return {
    left: [-1, 0],
    right: [1, 0],
    top: [0, -1],
    bottom: [0, 1],
    "top-left": [-1, 0],
    "bottom-left": [-1, 0],
    "top-right": [1, 0],
    "bottom-right": [1, 0],
  }[s];
}
function edgeGeometry(e, doc = d()) {
  const a = M.byId(doc).get(e.from),
    b = M.byId(doc).get(e.to);
  if (!a || !b) return null;
  const dx = b.x + b.w / 2 - a.x - a.w / 2,
    dy = b.y + b.h / 2 - a.y - a.h / 2;
  let sa = e.fromSide,
    sb = e.toSide;
  if (e.tree) {
    const vertical = M.treeDirection(doc, a) === "vertical";
    sa = vertical ? "bottom" : "right";
    sb = vertical ? "top" : "left";
  }
  if (!sa)
    sa =
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "right"
          : "left"
        : dy > 0
          ? "bottom"
          : "top";
  if (!sb)
    sb =
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "left"
          : "right"
        : dy > 0
          ? "top"
          : "bottom";
  const p = anchor(a, sa),
    q = anchor(b, sb),
    va = sideVector(sa),
    vb = sideVector(sb),
    stub = 32;
  const p1 = { x: p.x + va[0] * stub, y: p.y + va[1] * stub },
    q1 = { x: q.x + vb[0] * stub, y: q.y + vb[1] * stub };
  if (e.style === "straight")
    return trimEnds({ p, q, p1, q1, pts: [p, q], sa, sb }, true);
  // A dragged bend takes over the middle of the route. Straight connectors have
  // nothing to bend, so they ignore it.
  if (e.bend) {
    const bend = e.bend;
    if (e.style === "curved") {
      // The two halves share a tangent at the bend, parallel to the line
      // between the ends, so the curve reads as one stroke instead of kinking.
      const span = Math.hypot(q.x - p.x, q.y - p.y) || 1,
        tx = (q.x - p.x) / span,
        ty = (q.y - p.y) / span,
        lead = Math.hypot(bend.x - p.x, bend.y - p.y) * 0.36,
        trail = Math.hypot(q.x - bend.x, q.y - bend.y) * 0.36,
        reach = (d) => Math.max(18, Math.min(110, d));
      const curve = [
        { x: p.x + va[0] * reach(lead), y: p.y + va[1] * reach(lead) },
        { x: bend.x - tx * lead, y: bend.y - ty * lead },
        { x: bend.x + tx * trail, y: bend.y + ty * trail },
        { x: q.x + vb[0] * reach(trail), y: q.y + vb[1] * reach(trail) },
      ];
      return trimEnds({ p, q, p1, q1, pts: [p, bend, q], bend, curve, sa, sb });
    }
    const pts =
      e.style === "curved"
        ? [p, p1, bend, q1, q]
        : [
            p,
            p1,
            ...orthogonalTo(p1, bend, !!va[0]),
            bend,
            ...orthogonalTo(bend, q1, !!vb[0]).reverse(),
            q1,
            q,
          ];
    return trimEnds({ p, q, p1, q1, pts, bend, sa, sb });
  }
  let pts = [p, p1];
  if (va[0] && vb[0]) {
    const x = (p1.x + q1.x) / 2;
    if ((sa === "right" && q1.x < p1.x) || (sa === "left" && q1.x > p1.x)) {
      const yy = Math.min(a.y, b.y) - 35;
      pts.push({ x: p1.x, y: yy }, { x: q1.x, y: yy });
    } else pts.push({ x, y: p1.y }, { x, y: q1.y });
  } else if (va[1] && vb[1]) {
    const y = (p1.y + q1.y) / 2;
    if ((sa === "bottom" && q1.y < p1.y) || (sa === "top" && q1.y > p1.y)) {
      const xx = Math.max(a.x + a.w, b.x + b.w) + 35;
      pts.push({ x: xx, y: p1.y }, { x: xx, y: q1.y });
    } else pts.push({ x: p1.x, y }, { x: q1.x, y });
  } else pts.push(va[0] ? { x: q1.x, y: p1.y } : { x: p1.x, y: q1.y });
  pts.push(q1, q);
  if (
    e.style === "elbow" &&
    pts
      .slice(2, -1)
      .some((point, i) => M.segmentBlocked(pts[i + 1], point, [a, b]))
  )
    pts = [p, ...M.routeElbow(p1, q1, [a, b]), q];
  return trimEnds({ p, q, p1, q1, pts, sa, sb });
}
// Every connector stops short of both shapes, measured along its first and
// last segment, so it never touches an outline. The route is planned from the
// outline anchors and only the ends move, so every consumer of the geometry
// (drawing, hit testing, labels, handles, export) sees the same trimmed line.
const connectorGap = 8;
function trimEnds(g, straight = false) {
  const a = g.p,
    b = g.q;
  let ua = sideVector(g.sa),
    ub = sideVector(g.sb),
    gap = connectorGap;
  if (straight) {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!length) return g;
    ua = [(b.x - a.x) / length, (b.y - a.y) / length];
    ub = [-ua[0], -ua[1]];
    gap = Math.min(connectorGap, length / 4);
  }
  const p = { x: a.x + ua[0] * gap, y: a.y + ua[1] * gap },
    q = { x: b.x + ub[0] * gap, y: b.y + ub[1] * gap };
  return {
    ...g,
    p,
    q,
    pts: g.pts.map((point) => (point === a ? p : point === b ? q : point)),
  };
}
// Connector labels belong to the connector itself: they ride the midpoint of the
// drawn path, so every move, reroute and restyle carries them, and the stroke is
// clipped around the text instead of running through it.
const labelPadX = 7,
  labelPadY = 3,
  labelSlack = 4;
function cubicPoints(a, c1, c2, b, steps) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps,
      s = 1 - t;
    return {
      x: s ** 3 * a.x + 3 * s * s * t * c1.x + 3 * s * t * t * c2.x + t ** 3 * b.x,
      y: s ** 3 * a.y + 3 * s * s * t * c1.y + 3 * s * t * t * c2.y + t ** 3 * b.y,
    };
  });
}
function edgePolyline(e, g) {
  if (e.style === "straight") return [g.p, g.q];
  if (g.curve)
    return [
      ...cubicPoints(g.p, g.curve[0], g.curve[1], g.bend, 20),
      ...cubicPoints(g.bend, g.curve[2], g.curve[3], g.q, 20).slice(1),
    ];
  if (g.bend) return g.pts;
  if (e.style === "curved") {
    const va = sideVector(g.sa),
      vb = sideVector(g.sb),
      dist = curveDistance(e, g),
      a = { x: g.p.x + va[0] * dist, y: g.p.y + va[1] * dist },
      b = { x: g.q.x + vb[0] * dist, y: g.q.y + vb[1] * dist };
    return Array.from({ length: 41 }, (_, i) => {
      const t = i / 40,
        s = 1 - t;
      return {
        x:
          s ** 3 * g.p.x +
          3 * s * s * t * a.x +
          3 * s * t * t * b.x +
          t ** 3 * g.q.x,
        y:
          s ** 3 * g.p.y +
          3 * s * s * t * a.y +
          3 * s * t * t * b.y +
          t ** 3 * g.q.y,
      };
    });
  }
  return g.pts;
}
function polylinePointAt(pts, t) {
  const lengths = pts
    .slice(1)
    .map((q, i) => Math.hypot(q.x - pts[i].x, q.y - pts[i].y));
  const length = lengths.reduce((sum, l) => sum + l, 0);
  let remaining = Math.max(0, Math.min(1, t)) * length;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const t = lengths[i] ? Math.min(1, remaining / lengths[i]) : 0;
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * t,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * t,
        length,
      };
    }
    remaining -= lengths[i];
  }
  return { x: pts[0].x, y: pts[0].y, length };
}
function polylineMidpoint(pts) {
  return polylinePointAt(pts, 0.5);
}
// Dragging a label keeps it on the connector: the pointer is projected onto the
// drawn path and stored as a fraction of it, so rerouting carries it along.
function edgeLabelPosition(e, p) {
  const g = edgeGeometry(e);
  if (!g) return 0.5;
  const pts = edgePolyline(e, g),
    lengths = pts
      .slice(1)
      .map((q, i) => Math.hypot(q.x - pts[i].x, q.y - pts[i].y)),
    total = lengths.reduce((sum, l) => sum + l, 0) || 1;
  let best = 0.5,
    nearest = Infinity,
    run = 0;
  for (let i = 0; i < lengths.length; i++) {
    const a = pts[i],
      dx = pts[i + 1].x - a.x,
      dy = pts[i + 1].y - a.y,
      f = Math.max(
        0,
        Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
      ),
      distance = Math.hypot(p.x - a.x - f * dx, p.y - a.y - f * dy);
    if (distance < nearest) {
      nearest = distance;
      best = (run + f * lengths[i]) / total;
    }
    run += lengths[i];
  }
  return best;
}
// The label never slides over the shapes it connects.
function clampLabelPosition(e, t) {
  const label = edgeLabel(e);
  if (!label) return 0.5;
  const margin = Math.min(0.5, (label.w / 2 + 10) / (label.pathLength || 1));
  return Math.max(margin, Math.min(1 - margin, t));
}
function edgeLabelID(e) {
  return "label:" + e.id;
}
// A label grows with its text and stays on one line up to the width of a default
// rectangle; beyond that it wraps rather than stretching across the diagram.
// Larger type keeps a usable measure instead of breaking on every word.
function edgeLabelWrapWidth(fontSize) {
  return Math.max(180, fontSize * 8) - labelPadX * 2;
}
// The label is a live view over its edge. Text and marks read and write through
// to the edge, so a label survives undo, copy, import and export as one element.
function edgeLabel(e, doc = d()) {
  const g = edgeGeometry(e, doc);
  if (!g) return null;
  const mid = polylinePointAt(edgePolyline(e, g), e.labelT ?? 0.5),
    label = {
      pathLength: mid.length,
      id: edgeLabelID(e),
      kind: "label",
      edgeId: e.id,
      shape: "process",
      textAlign: "center",
      fontFamily: e.fontFamily,
      fontSize: e.fontSize || 14,
      textColor: e.textColor || "#1b1b1f",
      wrapWidth: edgeLabelWrapWidth(e.fontSize || 14),
      x: 0,
      y: 0,
      w: 0,
      h: 0,
    };
  Object.defineProperty(label, "text", {
    enumerable: true,
    get: () => e.label || "",
    set(value) {
      e.label = value;
    },
  });
  Object.defineProperty(label, "marks", {
    enumerable: true,
    get: () => e.labelMarks || [],
    set(value) {
      if (value && value.length) e.labelMarks = value;
      else delete e.labelMarks;
    },
  });
  const lines = richLines(ctx, label);
  label.w = Math.max(14, Math.max(...lines.map((l) => l.width)) + labelPadX * 2);
  label.h = lines.length * label.fontSize * 1.15 + labelPadY * 2;
  label.x = mid.x - label.w / 2;
  label.y = mid.y - label.h / 2;
  return label;
}
function labeledEdge(e, doc = d()) {
  return e.label ? edgeLabel(e, doc) : null;
}
// Clipping, rather than filling, keeps the gap free of a painted rectangle, so
// the grid and any shape underneath stay visible around the label.
function clipAroundLabel(c, label, dx = 0, dy = 0) {
  const region = new Path2D();
  region.rect(-1e6, -1e6, 2e6, 2e6);
  region.rect(label.x + dx - 1, label.y + dy - 1, label.w + 2, label.h + 2);
  c.clip(region, "evenodd");
}
function elementByID(id) {
  const n = d()?.nodes.find((a) => a.id === id);
  if (n) return n;
  const e = d()?.edges.find((a) => edgeLabelID(a) === id);
  return e ? edgeLabel(e) : null;
}
function editEdgeLabel(e) {
  if (!e) return;
  selected = new Set([e.id]);
  const before = M.clone(d()),
    fresh = !e.label;
  if (fresh) e.label = "";
  const label = edgeLabel(e);
  if (!label) return;
  beginEdit(label, { before, newElement: fresh });
}
// Two axis-aligned steps between a stub and the bend, entering on the axis the
// stub leaves by, so an elbow route stays square.
function orthogonalTo(from, to, horizontal) {
  if (Math.abs(from.x - to.x) < 0.5 || Math.abs(from.y - to.y) < 0.5) return [];
  return horizontal ? [{ x: to.x, y: from.y }] : [{ x: from.x, y: to.y }];
}
const edgeCache = new Map();
// The arrowhead is a filled, slightly rounded triangle about four stroke widths
// long, with its tip on the trimmed end. It is drawn crisply at every
// sloppiness; only the line is sketched. It never takes more than half of the
// last segment, so a short stub or a tight tree curve cannot fold back on it.
function arrowHead(e, g) {
  if (!e.arrow) return null;
  let dir, room;
  if (e.style === "straight") {
    const length = Math.hypot(g.q.x - g.p.x, g.q.y - g.p.y) || 1;
    dir = [(g.q.x - g.p.x) / length, (g.q.y - g.p.y) / length];
    room = length;
  } else {
    const vb = sideVector(g.sb);
    dir = [-vb[0], -vb[1]];
    const before = g.curve
      ? g.curve[3]
      : e.style === "curved" && !g.bend
        ? null
        : g.pts[g.pts.length - 2];
    room = before
      ? Math.hypot(g.q.x - before.x, g.q.y - before.y)
      : curveDistance(e, g);
  }
  const length = Math.min(Math.max(8, (e.sw || 1.8) * 4), room / 2);
  return {
    tip: g.q,
    base: { x: g.q.x - dir[0] * length, y: g.q.y - dir[1] * length },
    dir,
    length,
    half: length * 0.6,
  };
}
function drawArrowHead(c, head, color) {
  const { tip, base, dir, length, half } = head,
    radius = Math.min(1.6, length * 0.16),
    // Rounding pulls the drawn tip back from the corner; start the corner
    // further out by that much so the visible tip lands on the trimmed end.
    reach = radius * (Math.hypot(length, half) / half - 1),
    t = { x: tip.x + dir[0] * reach, y: tip.y + dir[1] * reach },
    corners = [
      t,
      { x: base.x - dir[1] * half, y: base.y + dir[0] * half },
      { x: base.x + dir[1] * half, y: base.y - dir[0] * half },
    ];
  // A fill ignores the line dash, so a dashed connector still gets a solid head.
  c.fillStyle = color;
  c.beginPath();
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }),
    start = mid(corners[2], corners[0]);
  c.moveTo(start.x, start.y);
  for (let i = 0; i < 3; i++) {
    const corner = corners[i],
      next = corners[(i + 1) % 3];
    c.arcTo(corner.x, corner.y, next.x, next.y, radius);
  }
  c.closePath();
  c.fill();
}
function drawEdge(c, e, doc = d()) {
  const g = edgeGeometry(e, doc);
  if (!g) return;
  const head = arrowHead(e, g),
    // With a head the line stops at its base, so it never shows past the tip.
    end = head ? head.base : g.q,
    x = g.p.x,
    y = g.p.y;
  let path = "M0 0";
  if (e.style === "straight") path += `L${end.x - x} ${end.y - y}`;
  else if (e.style === "curved") {
    if (g.curve)
      path += `C${g.curve[0].x - x} ${g.curve[0].y - y} ${g.curve[1].x - x} ${g.curve[1].y - y} ${g.bend.x - x} ${g.bend.y - y}C${g.curve[2].x - x} ${g.curve[2].y - y} ${g.curve[3].x - x} ${g.curve[3].y - y} ${end.x - x} ${end.y - y}`;
    else {
      const va = sideVector(g.sa),
        vb = sideVector(g.sb),
        dist = curveDistance(e, g);
      path += `C${va[0] * dist} ${va[1] * dist} ${g.q.x - x + vb[0] * dist} ${g.q.y - y + vb[1] * dist} ${end.x - x} ${end.y - y}`;
    }
  } else
    for (const p of [...g.pts.slice(1, -1), end]) path += `L${p.x - x} ${p.y - y}`;
  const key = JSON.stringify([path, e.stroke, e.sw, e.strokeStyle, e.sloppiness]);
  let cached = edgeCache.get(e.id);
  if (cached?.key !== key) {
    cached = {
      key,
      drawable: roughGenerator.path(path, {
        seed: sketchSeed(e.id),
        stroke: e.stroke,
        strokeWidth: e.sw,
        ...strokeOptions(e, true),
      }),
    };
    if (edgeCache.size > 3000) edgeCache.clear();
    edgeCache.set(e.id, cached);
  }
  const label = labeledEdge(e, doc);
  c.save();
  c.translate(x, y);
  if (label) clipAroundLabel(c, label, -x, -y);
  c.lineCap = "round";
  c.lineJoin = "round";
  roughCanvas(c).draw(cached.drawable);
  c.restore();
  if (head) drawArrowHead(c, head, e.stroke);
  if (label && editing?.id !== label.id) drawRichText(c, label);
}
let renderPending = false;
function render() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    paint();
  });
}
function paint() {
  if (!current || isNotebook() || $("workspace").hidden) return;
  const ratio = devicePixelRatio || 1,
    w = canvas.clientWidth,
    h = canvas.clientHeight;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  const grid = 24 * view.z;
  if (grid > 7) {
    // One path for every dot: a fill per dot cost thousands of calls a frame.
    ctx.fillStyle = "#ededf0";
    ctx.beginPath();
    for (let x = ((view.x % grid) + grid) % grid; x < w; x += grid)
      for (let y = ((view.y % grid) + grid) % grid; y < h; y += grid) {
        ctx.moveTo(x + 0.65, y);
        ctx.arc(x, y, 0.65, 0, Math.PI * 2);
      }
    ctx.fill();
  }
  ctx.translate(view.x, view.y);
  ctx.scale(view.z, view.z);
  const left = -view.x / view.z,
    top = -view.y / view.z,
    right = (w - view.x) / view.z,
    bottom = (h - view.y) / view.z,
    inView = (x0, y0, x1, y1, margin) =>
      x1 > left - margin &&
      x0 < right + margin &&
      y1 > top - margin &&
      y0 < bottom + margin,
    visible = (n) => inView(n.x, n.y, n.x + n.w, n.y + n.h, 100),
    shown = visibleCanvas(),
    byId = M.byId(d());
  // A connector stays within its two shapes and its bend, give or take the
  // bulge of a curve, an elbow detour or its label, which the margin covers.
  const edgeVisible = (e) => {
    const a = byId.get(e.from),
      b = byId.get(e.to);
    if (!a || !b) return false;
    const x0 = Math.min(a.x, b.x, e.bend?.x ?? a.x),
      y0 = Math.min(a.y, b.y, e.bend?.y ?? a.y),
      x1 = Math.max(a.x + a.w, b.x + b.w, e.bend?.x ?? a.x),
      y1 = Math.max(a.y + a.h, b.y + b.h, e.bend?.y ?? a.y);
    return inView(x0, y0, x1, y1, 250);
  };
  for (const item of paintOrder(shown.nodes, shown.edges)) {
    if (item.edge) {
      if (drag?.type === "endpoint" && drag.id === item.edge.id && !drag.target)
        continue;
      if (edgeVisible(item.edge)) drawEdge(ctx, item.edge);
    } else if (visible(item.node)) drawNode(ctx, item.node);
  }
  if (typeof paintFind === "function") paintFind(ctx);
  for (const e of shown.edges)
    if (selected.has(e.id)) drawEdgeHandles(e);
  drawNoteBadges();
  ctx.lineWidth = 1.1 / view.z;
  // Selection uses the one UI accent, blue (Phase 1 shell).
  ctx.strokeStyle = "#2474d0";
  for (const n of d().nodes.filter((n) => selected.has(n.id))) {
    // The node being edited shows nothing but its own shape and a caret.
    if (editing?.id === n.id) continue;
    ctx.setLineDash([4 / view.z, 3 / view.z]);
    ctx.strokeRect(
      n.x - 5 / view.z,
      n.y - 5 / view.z,
      n.w + 10 / view.z,
      n.h + 10 / view.z,
    );
    ctx.setLineDash([]);
    if (selected.size === 1 && !editing) drawHandles(resizeHandles(n));
  }
  const groupBox = editing ? null : selectionBounds();
  if (groupBox) {
    ctx.setLineDash([6 / view.z, 4 / view.z]);
    ctx.strokeRect(
      groupBox.x - 9 / view.z,
      groupBox.y - 9 / view.z,
      groupBox.w + 18 / view.z,
      groupBox.h + 18 / view.z,
    );
    ctx.setLineDash([]);
    drawHandles(boxHandles(groupBox));
  }

  if (drag?.type === "marquee") {
    ctx.fillStyle = "#2474d014";
    ctx.strokeStyle = "#2474d0";
    const b = rect(drag.start, drag.now);
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  if (drag?.type === "create") {
    const b = rect(drag.start, drag.now);
    ctx.strokeStyle = "#80808a";
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.setLineDash([]);
  }
  if (!editing && ["select", "connector"].includes(tool)) {
    const node = hoverPortsNode();
    if (node) drawPorts(node, hoveredPort);
  }
  if (drag?.type === "connect" || drag?.type === "endpoint") {
    const anchored =
      drag.type === "endpoint"
        ? d().nodes.find(
            (n) => n.id === (drag.end === "from" ? drag.origin.to : drag.origin.from),
          )
        : d().nodes.find((n) => n.id === drag.id),
      target = d().nodes.find((n) => n.id === drag.target?.id);
    ctx.save();
    // An endpoint drag already moved the real connector onto its target, so a
    // second preview line would put two arrows on screen.
    if (anchored && (drag.type === "connect" || !target)) {
      const start = anchor(
          anchored,
          drag.type === "endpoint" ? closestPort(anchored, drag.now).side : drag.side,
        ),
        end = target ? anchor(target, drag.target.side) : drag.now;
      ctx.strokeStyle = "#1b1b1f";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      ctx.beginPath();
      ctx.moveTo(
        end.x - 11 * Math.cos(angle - 0.45),
        end.y - 11 * Math.sin(angle - 0.45),
      );
      ctx.lineTo(end.x, end.y);
      ctx.lineTo(
        end.x - 11 * Math.cos(angle + 0.45),
        end.y - 11 * Math.sin(angle + 0.45),
      );
      ctx.stroke();
    }
    if (target) {
      ctx.strokeStyle = "#2183dd";
      ctx.lineWidth = 1.2 / view.z;
      ctx.setLineDash([4 / view.z, 3 / view.z]);
      ctx.strokeRect(
        target.x - 6 / view.z,
        target.y - 6 / view.z,
        target.w + 12 / view.z,
        target.h + 12 / view.z,
      );
      ctx.setLineDash([]);
      drawPorts(target, drag.target.side);
    }
    ctx.restore();
  }
  if (hover) {
    const n = d().nodes.find((n) => n.id === hover.id);
    if (n) {
      ctx.lineWidth = 3 / view.z;
      ctx.strokeStyle = hover.mode === "invalid" ? "#ba7269" : "#555560";
      ctx.strokeRect(n.x - 7, n.y - 7, n.w + 14, n.h + 14);
      if (hover.mode === "before" || hover.mode === "after") {
        const y = hover.mode === "before" ? n.y - 15 : n.y + n.h + 15;
        ctx.beginPath();
        ctx.moveTo(n.x - 12, y);
        ctx.lineTo(n.x + n.w + 12, y);
        ctx.stroke();
      }
    }
  }
  drawReparentPreview();
  ctx.strokeStyle = "#9999a3";
  ctx.lineWidth = 1 / view.z;
  ctx.setLineDash([4 / view.z, 4 / view.z]);
  for (const guide of guides) {
    ctx.beginPath();
    if (guide.axis === "x") {
      ctx.moveTo(guide.value, -view.y / view.z);
      ctx.lineTo(guide.value, (h - view.y) / view.z);
    } else {
      ctx.moveTo(-view.x / view.z, guide.value);
      ctx.lineTo((w - view.x) / view.z, guide.value);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  $("emptyHint").hidden = d().nodes.length > 0;
  $("zoomValue").textContent = Math.round(view.z * 100) + "%";
  $("undo").disabled = !history.past.length;
  $("redo").disabled = !history.future.length;
  if (typeof syncContextBar === "function") syncContextBar();
}
function rect(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}
function hitNode(p) {
  for (const n of [...visibleCanvas().nodes].reverse())
    if (p.x >= n.x && p.x <= n.x + n.w && p.y >= n.y && p.y <= n.y + n.h) {
      if (
        n.shape === "decision" &&
        Math.abs((p.x - n.x - n.w / 2) / (n.w / 2)) +
          Math.abs((p.y - n.y - n.h / 2) / (n.h / 2)) >
          1.08
      )
        continue;
      if (n.shape === "circle" &&
          ((p.x - n.x - n.w / 2) / (n.w / 2)) ** 2 +
          ((p.y - n.y - n.h / 2) / (n.h / 2)) ** 2 > 1) continue;
      return n;
    }
  return null;
}
function hitLabel(p, e) {
  const label = labeledEdge(e);
  return (
    !!label &&
    p.x >= label.x - 2 &&
    p.x <= label.x + label.w + 2 &&
    p.y >= label.y - 2 &&
    p.y <= label.y + label.h + 2
  );
}
// A label is a deliberate target, so it outranks the connector ports that
// surround nearby shapes; at low zoom those ports otherwise cover it.
function hitEdgeLabel(p) {
  return [...visibleCanvas().edges].reverse().find((e) => hitLabel(p, e));
}
function segmentDistance(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function hitEdge(p) {
  return [...visibleCanvas().edges].reverse().find((e) => {
    const g = edgeGeometry(e);
    if (!g) return false;
    if (hitLabel(p, e)) return true;
    let pts = g.pts;
    if (e.style === "straight") pts = [g.p, g.q];
    if (g.bend) pts = edgePolyline(e, g);
    if (e.style === "curved" && !g.bend) {
      const va = sideVector(g.sa),
        vb = sideVector(g.sb),
        dist = curveDistance(e, g);
      const a = { x: g.p.x + va[0] * dist, y: g.p.y + va[1] * dist },
        b = { x: g.q.x + vb[0] * dist, y: g.q.y + vb[1] * dist };
      pts = Array.from({ length: 31 }, (_, i) => {
        const t = i / 30,
          s = 1 - t;
        return {
          x:
            s ** 3 * g.p.x +
            3 * s * s * t * a.x +
            3 * s * t * t * b.x +
            t ** 3 * g.q.x,
          y:
            s ** 3 * g.p.y +
            3 * s * s * t * a.y +
            3 * s * t * t * b.y +
            t ** 3 * g.q.y,
        };
      });
    }
    return pts
      .slice(1)
      .some((q, i) => segmentDistance(p, pts[i], q) < 7 / view.z);
  });
}
function selectNode(n, toggle = false) {
  let ids = n.group
    ? d()
        .nodes.filter((a) => a.group === n.group)
        .map((a) => a.id)
    : [n.id];
  if (n.group)
    ids.push(
      ...d()
        .edges.filter((e) => e.group === n.group)
        .map((e) => e.id),
    );
  if (toggle) {
    const remove = selected.has(n.id);
    for (const id of ids) remove ? selected.delete(id) : selected.add(id);
  } else selected = new Set(ids);
  inspect();
  render();
}
function moveIDs() {
  const set = new Set(selected);
  for (const n of d().nodes) if (set.has(n.id) && n.attachmentTo) set.add(n.attachmentTo);
  for (const n of d().nodes.filter(
    (n) => set.has(n.id) && n.kind === "mind",
  ))
    M.subtree(d(), n.id).forEach((id) => set.add(id));
  return M.attached(d(), set);
}
// The whole selection scales by one pair of factors. A factor is clamped by the
// most constrained element, so the elements keep their relative geometry instead
// of drifting apart when one of them hits its own minimum.
function groupMinimum(n) {
  return {
    w: n.kind === "sticker" ? 24 : n.kind === "image" ? 40 : 80,
    h: n.kind === "image" ? 24 : 38,
  };
}
function resizeSelection(p) {
  const box = drag.box,
    dx = p.x - drag.start.x,
    dy = p.y - drag.start.y,
    left = drag.corner.includes("l"),
    right = drag.corner.includes("r"),
    top = drag.corner.includes("t"),
    bottom = drag.corner.includes("b");
  let sx = left || right ? (box.w + (left ? -dx : dx)) / (box.w || 1) : 1,
    sy = top || bottom ? (box.h + (top ? -dy : dy)) / (box.h || 1) : 1;
  for (const n of resizeGroupNodes()) {
    const o = drag.originals.get(n.id),
      min = groupMinimum(n);
    if (!o) continue;
    sx = Math.max(sx, min.w / o.w);
    sy = Math.max(sy, min.h / o.h);
  }
  const anchorX = left ? box.x + box.w : box.x,
    anchorY = top ? box.y + box.h : box.y;
  for (const n of resizeGroupNodes()) {
    const o = drag.originals.get(n.id);
    if (!o) continue;
    n.w = o.w * sx;
    n.h = o.h * sy;
    n.x = anchorX + (o.x - anchorX) * sx;
    n.y = anchorY + (o.y - anchorY) * sy;
    // Each element still normalises itself: pictures keep their proportions,
    // circles stay circles, and text reflows to its new width.
    if (["image", "sticker"].includes(n.kind)) {
      const scale = Math.min(sx, sy);
      n.w = o.w * scale;
      n.h = o.h * scale;
    } else if (n.shape === "circle") {
      n.w = n.h = Math.max(80, o.w * Math.min(sx, sy));
      fitCircle(n);
    } else {
      const requested = n.h;
      autoSize(n);
      n.h = Math.max(requested, n.h);
    }
    for (const label of d().nodes.filter((a) => a.attachmentTo === n.id)) {
      label.w = n.w;
      autoSize(label);
    }
  }
  M.syncAttachments(d());
}
function drawHandles(handles) {
  ctx.fillStyle = "#ffffff";
  for (const { x, y } of handles) {
    ctx.fillRect(x - 3 / view.z, y - 3 / view.z, 6 / view.z, 6 / view.z);
    ctx.strokeRect(x - 3 / view.z, y - 3 / view.z, 6 / view.z, 6 / view.z);
  }
}
function boxHandles(b) {
  return [
    ["tl", b.x, b.y, "nwse-resize"],
    ["t", b.x + b.w / 2, b.y, "ns-resize"],
    ["tr", b.x + b.w, b.y, "nesw-resize"],
    ["r", b.x + b.w, b.y + b.h / 2, "ew-resize"],
    ["br", b.x + b.w, b.y + b.h, "nwse-resize"],
    ["b", b.x + b.w / 2, b.y + b.h, "ns-resize"],
    ["bl", b.x, b.y + b.h, "nesw-resize"],
    ["l", b.x, b.y + b.h / 2, "ew-resize"],
  ].map(([side, x, y, cursor]) => ({ side, x, y, cursor }));
}
function resizeHandles(n) {
  if (n.attachmentTo) return [];
  return boxHandles(n);
}
// Several elements resize together from one box around the whole selection.
// Placeholders follow their owner's width, so they are never resized directly.
function resizeGroupNodes() {
  return d().nodes.filter((n) => selected.has(n.id) && !n.attachmentTo);
}
function selectionBounds() {
  const ns = resizeGroupNodes();
  return ns.length > 1 ? M.bounds(ns) : null;
}
function hitResizeHandle(p) {
  if (tool !== "select" || editing) return null;
  const box = selectionBounds();
  const n = box ? null : visibleCanvas().nodes.find((n) => selected.has(n.id));
  if (!box && (!n || selected.size !== 1)) return null;
  let best = null,
    distance = 7 / view.z;
  for (const h of box ? boxHandles(box) : resizeHandles(n)) {
    const delta = Math.hypot(p.x - h.x, p.y - h.y);
    if (delta < distance) {
      distance = delta;
      best = { ...h, id: n?.id, group: !!box };
    }
  }
  return best;
}
function ports(n) {
  return ["top", "right", "bottom", "left"].map((side) => {
    const point = anchor(n, side),
      v = sideVector(side);
    let offset = 13 / view.z;
    if (
      n.collapsed &&
      side === (M.treeDirection(d(), n) === "vertical" ? "bottom" : "right")
    ) {
      const badge = collapsedBadge(n);
      if (badge)
        offset = Math.max(
          offset,
          (side === "right"
            ? badge.x + badge.w - point.x
            : badge.y + badge.h - point.y) +
            18 / view.z,
        );
    }
    return { side, x: point.x + v[0] * offset, y: point.y + v[1] * offset };
  });
}
function closestPort(n, p) {
  return ports(n).reduce((a, b) =>
    Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y) ? b : a,
  );
}
function hitPort(p, exclude) {
  let best = null,
    distance = 11 / view.z;
  for (const n of [...visibleCanvas().nodes].reverse()) {
    if (n.id === exclude || n.attachmentTo || ["text", "sticker"].includes(n.kind)) continue;
    for (const port of ports(n)) {
      const delta = Math.hypot(port.x - p.x, port.y - p.y);
      if (delta < distance) {
        distance = delta;
        best = { id: n.id, ...port };
      }
    }
  }
  return best;
}
function nearShape(p, exclude) {
  const port = hitPort(p, exclude);
  if (port) return d().nodes.find((n) => n.id === port.id);
  let best = null,
    distance = 26 / view.z;
  for (const n of [...visibleCanvas().nodes].reverse()) {
    if (n.id === exclude || n.attachmentTo || ["text", "sticker"].includes(n.kind)) continue;
    const dx = Math.max(n.x - p.x, 0, p.x - n.x - n.w),
      dy = Math.max(n.y - p.y, 0, p.y - n.y - n.h),
      delta = Math.hypot(dx, dy);
    if (delta < distance) {
      best = n;
      distance = delta;
    }
  }
  return best;
}
// Connection points read as arrows pointing away from the shape, the way
// draw.io shows them: the direction is the affordance, and the one being used
// fills in so the destination side is obvious while a connector is dragged.
// Each end of a selected connector gets a handle that can be dragged onto
// another shape to move that end. Tree connectors follow their parentage and
// are not reattached by hand.
function edgeHandles(e) {
  if (e.tree) return [];
  const g = edgeGeometry(e);
  if (!g) return [];
  return [
    { end: "from", x: g.p.x, y: g.p.y },
    { end: "to", x: g.q.x, y: g.q.y },
  ];
}
function bendHandle(e) {
  if (e.tree || e.style === "straight") return null;
  const g = edgeGeometry(e);
  if (!g) return null;
  if (e.bend) return { x: e.bend.x, y: e.bend.y, set: true };
  // A label already sits at the middle of the path, so an unset handle walks
  // along it until it is clear of the text rather than crowding it.
  const path = edgePolyline(e, g),
    box = labeledEdge(e),
    clear = 12;
  let point = polylinePointAt(path, 0.5);
  if (box)
    for (let step = 0; step <= 8; step++) {
      const at = Math.min(0.9, 0.5 + step * 0.05);
      point = polylinePointAt(path, at);
      if (
        point.x < box.x - clear ||
        point.x > box.x + box.w + clear ||
        point.y < box.y - clear ||
        point.y > box.y + box.h + clear
      )
        break;
    }
  return { x: point.x, y: point.y, set: false };
}
// Shapes and connectors share one stacking order. A connector sits just above
// the later of the two shapes it joins, so sending a shape to the back puts it
// behind the connectors that cross it, which layer order alone could not do.
function paintOrder(nodes, edges) {
  const depth = new Map(nodes.map((n, i) => [n.id, i]));
  return [
    ...nodes.map((node, at) => ({ node, at })),
    ...edges.map((edge) => ({
      edge,
      at: Math.max(depth.get(edge.from) ?? 0, depth.get(edge.to) ?? 0) + 0.5,
    })),
  ].sort((a, b) => a.at - b.at);
}
function drawEdgeHandles(e) {
  const bend = bendHandle(e);
  if (bend) {
    ctx.save();
    ctx.lineWidth = 1.6 / view.z;
    ctx.strokeStyle = "#2183dd";
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(bend.x, bend.y, 4.5 / view.z, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.lineWidth = 1.4 / view.z;
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#2183dd";
  for (const handle of edgeHandles(e)) {
    ctx.beginPath();
    ctx.arc(handle.x, handle.y, 4.5 / view.z, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
function hitEdgeHandle(p) {
  if (tool !== "select" || editing) return null;
  for (const e of visibleCanvas().edges) {
    if (!selected.has(e.id)) continue;
    for (const handle of edgeHandles(e))
      if (Math.hypot(p.x - handle.x, p.y - handle.y) < 8 / view.z)
        return { id: e.id, end: handle.end };
    const bend = bendHandle(e);
    if (bend && Math.hypot(p.x - bend.x, p.y - bend.y) < 8 / view.z)
      return { id: e.id, bend: true };
  }
  return null;
}
function hoverPortsNode() {
  if (drag?.type === "connect" || drag?.type === "endpoint") return null;
  if (d()?.edges.some((e) => selected.has(e.id))) return null;
  return d()?.nodes.find((n) => n.id === hoveredNode) || null;
}
function drawPorts(n, active) {
  ctx.save();
  const s = 7 / view.z;
  for (const port of ports(n)) {
    const [vx, vy] = sideVector(port.side),
      tipX = port.x + vx * s,
      tipY = port.y + vy * s,
      baseX = port.x - vx * s * 0.45,
      baseY = port.y - vy * s * 0.45;
    ctx.fillStyle = port.side === active ? "#2183dd" : "#a9d3f5";
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(baseX - vy * s * 0.72, baseY + vx * s * 0.72);
    ctx.lineTo(baseX - vy * s * 0.26, baseY + vx * s * 0.26);
    ctx.lineTo(baseX - vx * s * 0.95 - vy * s * 0.26, baseY - vy * s * 0.95 + vx * s * 0.26);
    ctx.lineTo(baseX - vx * s * 0.95 + vy * s * 0.26, baseY - vy * s * 0.95 - vx * s * 0.26);
    ctx.lineTo(baseX + vy * s * 0.26, baseY - vx * s * 0.26);
    ctx.lineTo(baseX + vy * s * 0.72, baseY - vx * s * 0.72);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
canvas.addEventListener("pointerleave", () => {
  if (!drag) {
    hoveredNode = null;
    hoveredPort = null;
    render();
  }
});
canvas.addEventListener("pointerdown", (e) => {
  resetPasteCascade();
  if (e.button !== 0 && e.button !== 1) return;
  if (editing) commitEdit();
  $("shapePicker").hidden = true;
  canvas.focus();
  const p = point(e),
    s = screenPoint(e);
  const noteNode = hitNoteBadge(p);
  if (noteNode) {
    if (notesNodeId === noteNode.id) closeNotes();
    else openNotes(noteNode.id);
    return;
  }
  if (space || tool === "hand" || e.button === 1) {
    drag = { type: "pan", screen: s, view: { ...view } };
    if (e.isTrusted) canvas.setPointerCapture(e.pointerId);
    return;
  }
  const resizeHit = hitResizeHandle(p);
  if (resizeHit?.group) {
    drag = {
      type: "resizeGroup",
      corner: resizeHit.side,
      cursor: resizeHit.cursor,
      start: p,
      box: selectionBounds(),
      originals: new Map(
        resizeGroupNodes().map((a) => [a.id, { x: a.x, y: a.y, w: a.w, h: a.h }]),
      ),
      before: M.clone(d()),
    };
    canvas.style.cursor = resizeHit.cursor;
    if (e.isTrusted) canvas.setPointerCapture(e.pointerId);
    return;
  }
  if (resizeHit) {
    const n = d().nodes.find((n) => n.id === resizeHit.id);
    drag = {
      type: "resize",
      id: n.id,
      corner: resizeHit.side,
      cursor: resizeHit.cursor,
      start: p,
      original: M.clone(n),
      before: M.clone(d()),
    };
    canvas.style.cursor = resizeHit.cursor;
    if (e.isTrusted) canvas.setPointerCapture(e.pointerId);
    return;
  }
  const endpointHit = hitEdgeHandle(p);
  if (endpointHit?.bend) {
    drag = {
      type: "bend",
      id: endpointHit.id,
      before: M.clone(d()),
      origin: d().edges.find((a) => a.id === endpointHit.id).bend,
      moved: false,
    };
    if (e.isTrusted) canvas.setPointerCapture(e.pointerId);
    return;
  }
  if (endpointHit) {
    const link = d().edges.find((a) => a.id === endpointHit.id);
    drag = {
      type: "endpoint",
      id: endpointHit.id,
      end: endpointHit.end,
      now: p,
      target: null,
      origin: {
        from: link.from,
        to: link.to,
        fromSide: link.fromSide,
        toSide: link.toSide,
      },
      before: M.clone(d()),
    };
    if (e.isTrusted) canvas.setPointerCapture(e.pointerId);
    render();
    return;
  }
  const bodyHit = hitNode(p);
  const labelHit = !bodyHit && tool === "select" ? hitEdgeLabel(p) : null;
  if (labelHit) {
    if (e.shiftKey)
      selected.has(labelHit.id)
        ? selected.delete(labelHit.id)
        : selected.add(labelHit.id);
    else {
      selected = new Set([labelHit.id]);
      drag = {
        type: "label",
        id: labelHit.id,
        before: M.clone(d()),
        moved: false,
      };
      if (e.isTrusted) canvas.setPointerCapture(e.pointerId);
    }
    inspect();
    render();
    return;
  }
  const portHit =
    tool === "connector" || (tool === "select" && !bodyHit) ? hitPort(p) : null;
  if (portHit) {
    drag = {
      type: "connect",
      id: portHit.id,
      side: portHit.side,
      now: p,
      target: null,
    };
    selected = new Set([portHit.id]);
    if (e.isTrusted) canvas.setPointerCapture(e.pointerId);
    inspect();
    render();
    return;
  }
  let n = bodyHit;
  if (tool === "connector") {
    if (n && !["text", "sticker"].includes(n.kind) && !n.attachmentTo) {
      if (connectorStart) {
        if (n.id !== connectorStart)
          mutate(() => M.connect(d(), connectorStart, n.id));
        setTool("select");
      } else {
        connectorStart = n.id;
        selectNode(n);
        $("contextHint").textContent = "Choose a destination shape";
      }
    }
    return;
  }
  if (!n && ["shape", "mind", "text"].includes(tool)) {
    drag = { type: "create", start: p, now: p, kind: tool };
    if (e.isTrusted) canvas.setPointerCapture(e.pointerId);
    return;
  }
  if (n) {
    if (notesNodeId) {
      notesNodeId = null;
      $("notesPanel").hidden = true;
      inspect();
    }
    if (e.shiftKey && !selected.has(n.id)) selectNode(n, true);
    if (!selected.has(n.id)) selectNode(n);
    const before = M.clone(d());
    if (e.altKey) {
      selected = new Set(
        M.paste(d(), M.selection(d(), [...selected], true), 0, 0),
      );
      n = d().nodes.find((a) => selected.has(a.id)) || n;
    }
    const ids = moveIDs();
    if (n.attachmentTo) n = d().nodes.find(a => a.id === n.attachmentTo);
    drag = {
      type: "move",
      start: p,
      now: p,
      id: n.id,
      ids,
      positions: new Map(
        d()
          .nodes.filter((a) => ids.has(a.id))
          .map((a) => [a.id, { x: a.x, y: a.y }]),
      ),
      before,
      alt: e.altKey,
      moved: false,
    };
    if (e.isTrusted) canvas.setPointerCapture(e.pointerId);
  } else {
    const edge = hitEdge(p);
    if (edge) {
      if (e.shiftKey)
        selected.has(edge.id)
          ? selected.delete(edge.id)
          : selected.add(edge.id);
      else selected = new Set([edge.id]);
      inspect();
      render();
      return;
    }
    drag = {
      type: "marquee",
      start: p,
      now: p,
      base: e.shiftKey ? new Set(selected) : new Set(),
    };
    if (!e.shiftKey) selected.clear();
    if (e.isTrusted) canvas.setPointerCapture(e.pointerId);
    inspect();
    render();
  }
});
canvas.addEventListener("pointermove", (e) => {
  const p = point(e);
  if (drag?.type === "bend") {
    const link = d().edges.find((a) => a.id === drag.id);
    if (link) {
      link.bend = { x: p.x, y: p.y };
      drag.moved = true;
      render();
    }
    return;
  }
  if (drag?.type === "label") {
    const edge = d().edges.find((a) => a.id === drag.id);
    if (edge) {
      edge.labelT = clampLabelPosition(edge, edgeLabelPosition(edge, p));
      drag.moved = true;
      render();
    }
    return;
  }
  if (!drag) {
    const n =
        ["select", "connector"].includes(tool) && !editing ? nearShape(p) : null,
      before = hoveredNode + " " + hoveredPort;
    hoveredNode = n && n.kind !== "text" ? n.id : null;
    hoveredPort =
      tool === "select" && hitNode(p) ? null : hitPort(p)?.side || null;
    const resizeHit = hitResizeHandle(p),
      noteHit = hitNoteBadge(p);
    canvas.style.cursor = noteHit
      ? "pointer"
      : resizeHit
        ? resizeHit.cursor
        : hoveredPort
          ? "crosshair"
          : tool === "hand"
            ? "grab"
            : tool === "select"
              ? "default"
              : "crosshair";
    // Helper arrows are all a hover draws, so only a change needs a frame.
    if (hoveredNode + " " + hoveredPort !== before) render();
    return;
  }
  drag.now = p;
  if (drag.type === "connect" || drag.type === "endpoint") {
    // The other end stays put, so a connector can never join a shape to itself.
    const exclude =
        drag.type === "endpoint"
          ? drag.end === "from"
            ? drag.origin.to
            : drag.origin.from
          : drag.id,
      target = nearShape(p, exclude);
    drag.target = target
      ? { id: target.id, side: closestPort(target, p).side }
      : null;
    if (drag.type === "endpoint") {
      const link = d().edges.find((a) => a.id === drag.id);
      if (link) {
        if (!drag.target) Object.assign(link, drag.origin);
        else if (drag.end === "from") {
          link.from = drag.target.id;
          link.fromSide = drag.target.side;
        } else {
          link.to = drag.target.id;
          link.toSide = drag.target.side;
        }
      }
    }
    render();
    return;
  }
  if (drag.type === "pan") {
    const s = screenPoint(e);
    view.x = drag.view.x + s.x - drag.screen.x;
    view.y = drag.view.y + s.y - drag.screen.y;
    render();
    return;
  }
  if (drag.type === "move") {
    let dx = p.x - drag.start.x,
      dy = p.y - drag.start.y;
    drag.moved ||= Math.hypot(dx, dy) > 2 / view.z;
    guides = [];
    const n = d().nodes.find((n) => n.id === drag.id),
      original = drag.positions.get(n.id);
    if (n.kind !== "mind" && !e.metaKey) {
      const threshold = 6 / view.z,
        others = d().nodes.filter(
          (a) => !drag.ids.has(a.id) && a.kind !== "mind",
        );
      let bestX = threshold,
        bestY = threshold,
        snapX = 0,
        snapY = 0;
      for (const other of others) {
        for (const [axis, positions, targets] of [
          [
            "x",
            [original.x + dx, original.x + dx + n.w / 2, original.x + dx + n.w],
            [other.x, other.x + other.w / 2, other.x + other.w],
          ],
          [
            "y",
            [original.y + dy, original.y + dy + n.h / 2, original.y + dy + n.h],
            [other.y, other.y + other.h / 2, other.y + other.h],
          ],
        ])
          for (const value of positions)
            for (const target of targets) {
              const delta = target - value;
              if (axis === "x" && Math.abs(delta) < bestX) {
                bestX = Math.abs(delta);
                snapX = delta;
                guides = guides.filter((g) => g.axis !== "x");
                guides.push({ axis: "x", value: target });
              }
              if (axis === "y" && Math.abs(delta) < bestY) {
                bestY = Math.abs(delta);
                snapY = delta;
                guides = guides.filter((g) => g.axis !== "y");
                guides.push({ axis: "y", value: target });
              }
            }
      }
      dx += snapX;
      dy += snapY;
    }
    for (const a of d().nodes.filter((a) => drag.ids.has(a.id))) {
      const o = drag.positions.get(a.id);
      a.x = o.x + dx;
      a.y = o.y + dy;
    }
    hover = null;
    if (n.kind === "mind" && [...selected].every(id => M.attached(d(), M.subtree(d(), n.id)).has(id))) {
      const target = [...visibleCanvas().nodes]
        .reverse()
        .find(
          (a) =>
            a.kind === "mind" &&
            !drag.ids.has(a.id) &&
            p.x >= a.x - 24 &&
            p.x <= a.x + a.w + 48 &&
            p.y >= a.y - 24 &&
            p.y <= a.y + a.h + 24,
        );
      if (target) {
        const sameParent = target.parent && target.parent === n.parent;
        const dropVertical = M.treeDirection(d(), target) === "vertical";
        const mode = sameParent && (
                dropVertical
                  ? p.x < target.x + target.w * 0.2
                  : p.y < target.y + target.h * 0.2
              )
            ? "before"
            : sameParent && (
                  dropVertical
                    ? p.x > target.x + target.w * 0.8
                    : p.y > target.y + target.h * 0.8
                )
              ? "after"
              : "parent";
        hover = { id: target.id, mode };
      }
    }
    render();
  } else if (drag.type === "resizeGroup") {
    resizeSelection(p);
    canvas.style.cursor = drag.cursor;
    render();
  } else if (drag.type === "resize") {
    const n = d().nodes.find((a) => a.id === drag.id),
      o = drag.original,
      dx = p.x - drag.start.x,
      dy = p.y - drag.start.y,
      left = drag.corner.includes("l"),
      right = drag.corner.includes("r"),
      top = drag.corner.includes("t"),
      bottom = drag.corner.includes("b");
    const minWidth = n.kind === "sticker" ? 24 : n.kind === "image" ? 40 : 80;
    n.w = Math.max(minWidth, o.w + (left ? -dx : right ? dx : 0));
    n.h = Math.max(
      n.kind === "image" ? 24 : 38,
      o.h + (top ? -dy : bottom ? dy : 0),
    );
    if (["image", "sticker"].includes(n.kind)) {
      if (left || right) n.h = (n.w * o.h) / o.w;
      else n.w = (n.h * o.w) / o.h;
      if (n.w < minWidth) {
        n.w = minWidth;
        n.h = (n.w * o.h) / o.w;
      }
      if (n.h < 24) {
        n.h = 24;
        n.w = (n.h * o.w) / o.h;
      }
    } else if (n.shape === "circle") {
      const deltaX = left ? -dx : right ? dx : 0;
      const deltaY = top ? -dy : bottom ? dy : 0;
      const delta = (left || right) && (top || bottom)
        ? (Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY)
        : left || right ? deltaX : deltaY;
      n.w = n.h = Math.max(80, o.w + delta);
      fitCircle(n);
    } else {
      const requestedHeight = n.h;
      autoSize(n);
      n.h = Math.max(requestedHeight, n.h);
    }
    n.x = left ? o.x + o.w - n.w : o.x;
    n.y = top ? o.y + o.h - n.h : o.y;
    if (n.shape === "circle" && !["image", "sticker"].includes(n.kind)) {
      if (!left && !right) n.x = o.x + (o.w - n.w) / 2;
      if (!top && !bottom) n.y = o.y + (o.h - n.h) / 2;
    }
    for (const label of d().nodes.filter(a => a.attachmentTo === n.id)) {
      label.w = n.w;
      autoSize(label);
    }
    M.syncAttachments(d());
    canvas.style.cursor = drag.cursor;
    render();
  } else render();
});
canvas.addEventListener("pointerup", (e) => {
  if (!drag) return;
  const g = drag,
    p = point(e);
  drag = null;
  guides = [];
  if (canvas.hasPointerCapture(e.pointerId))
    canvas.releasePointerCapture(e.pointerId);
  if (g.type === "pan") {
    changedView();
    return;
  }
  if (g.type === "label" || g.type === "bend") {
    if (g.moved) finish(g.before);
    return;
  }
  if (g.type === "create") {
    const before = M.clone(d()),
      r = rect(g.start, p),
      kind = g.kind === "shape" ? "flow" : g.kind;
    const n = M.node(
      kind,
      g.start.x,
      g.start.y,
      kind === "mind" ? "process" : shape,
    );
    if (r.w > 12 || r.h > 12) {
      n.x = r.x;
      n.y = r.y;
      n.w = Math.max(80, r.w);
      n.h = Math.max(50, r.h);
    }
    if (n.shape === "circle") fitCircle(n);
    if (shape === "decision" && kind === "flow") n.h = Math.max(n.h, 110);
    d().nodes.push(n);
    selected = new Set([n.id]);
    setTool("select");
    beginEdit(n, { before, newElement: true });
  }
  if (g.type === "marquee") {
    const r = rect(g.start, p);
    selected = g.base;
    for (const n of visibleCanvas().nodes) {
      const intersect =
        Math.max(0, Math.min(r.x + r.w, n.x + n.w) - Math.max(r.x, n.x)) *
        Math.max(0, Math.min(r.y + r.h, n.y + n.h) - Math.max(r.y, n.y));
      if (intersect / (n.w * n.h) >= 0.65) {
        selected.add(n.id);
        if (n.group)
          d()
            .nodes.filter((a) => a.group === n.group)
            .forEach((a) => selected.add(a.id));
      }
    }
    inspect();
  }
  if (g.type === "move") {
    if (hover && hover.mode !== "invalid") {
      const n = d().nodes.find((a) => a.id === g.id),
        target = d().nodes.find((a) => a.id === hover.id);
      if (hover.mode === "parent") M.reparent(d(), n.id, target.id);
      else if (target.parent)
        M.reparent(
          d(),
          n.id,
          target.parent,
          target.order + (hover.mode === "before" ? -0.5 : 0.5),
        );
      else {
        M.retainMove(d(), g.ids, g.positions);
      }
    } else if (hover?.mode === "invalid") {
      current.canvas = g.before;
      toast("A branch cannot be moved into its own descendants.");
    } else M.retainMove(d(), g.ids, g.positions);
    hover = null;
    if (g.moved || g.alt) finish(g.before);
    $("contextHint").textContent = "Hover a shape to connect · Space to pan";
  }
  if (g.type === "resize" || g.type === "resizeGroup") finish(g.before);
  if (g.type === "endpoint") {
    const link = d().edges.find((a) => a.id === g.id);
    if (link && !g.target) Object.assign(link, g.origin);
    if (link && g.target) finish(g.before);
    else render();
    return;
  }
  if (g.type === "connect") {
    const target = g.target
      ? d().nodes.find((n) => n.id === g.target.id)
      : nearShape(p, g.id);
    if (target) {
      const toSide = g.target?.side || closestPort(target, p).side;
      mutate(() =>
        M.connect(d(), g.id, target.id, {
          fromSide: g.side,
          toSide,
          arrow: true,
        }),
      );
    } else if (!nearShape(p)) {
      const screen = screenPoint(e);
      showPicker(screen.x, screen.y, {
        id: g.id,
        side: g.side,
        x: p.x,
        y: p.y,
      });
    }
    hoveredNode = null;
    hoveredPort = null;
  }
  render();
});
canvas.addEventListener("pointercancel", () => {
  if (drag?.before) current.canvas = drag.before;
  drag = null;
  hover = null;
  guides = [];
  render();
});
canvas.addEventListener("dblclick", (e) => {
  if (editing) return;
  const p = point(e),
    n = hitNode(p);
  if (n) {
    selectNode(n);
    beginEdit(n);
  } else if (hitEdge(p)) {
    editEdgeLabel(hitEdge(p));
  } else {
    const before = M.clone(d()),
      n = M.node("text", p.x, p.y, "process");
    d().nodes.push(n);
    selected = new Set([n.id]);
    beginEdit(n, { before, newElement: true });
  }
});
function beginEdit(n, options = {}) {
  if (["image", "sticker"].includes(n.kind)) return;
  if (n.shape === "circle" && n.kind !== "text") fitCircle(n);
  editing = {
    id: n.id,
    before: options.before || M.clone(d()),
    quick: options.quick || false,
    initialHeight: n.h,
    newElement: options.newElement || false,
  };
  richEditorLoad(n);
  $("textEditor").hidden = false;
  positionEditor();
  $("textEditor").focus();
  $("textEditor").select();
  inspect();
  render();
}
function positionEditor() {
  if (!editing) return;
  const n = elementByID(editing.id);
  if (!n) return;
  const editor = $("textEditor"),
    scale = view.z;
  editor.classList.toggle("label-editor", n.kind === "label");
  if (n.kind === "label") {
    // Padding and border sit inside the box, so the field is the label box plus
    // its border, plus slack for WebKit line boxes that round up. Without it the
    // editor could wrap earlier than the canvas measured, or clip its last line
    // behind its own overflow. The slack trails the text rather than shifting
    // it, so what is being typed stays where it will be drawn.
    const width = Math.max(n.w, n.fontSize * 3 + labelPadX * 2) + 2 + labelSlack;
    editor.style.left = (n.x + n.w / 2 - width / 2) * view.z + view.x + "px";
    editor.style.top = (n.y - 1) * view.z + view.y + "px";
    editor.style.width = width * scale + "px";
    editor.style.height = (n.h + 2 + labelSlack) * scale + "px";
  } else {
    editor.style.left = n.x * view.z + view.x + "px";
    editor.style.top = n.y * view.z + view.y + "px";
    editor.style.width = n.w * scale + "px";
    editor.style.height = n.h * scale + "px";
  }
  editor.style.fontSize = n.fontSize * scale + "px";
  editor.style.borderWidth = n.kind === "label" ? scale + "px" : "0";
  editor.style.borderRadius = n.kind === "label" ? 3 * scale + "px" : "0";
  editor.style.setProperty("--element-font", elementFont(n));
  editor.style.color = n.textColor;
  editor.style.textAlign =
    n.textAlign || (n.kind === "text" ? "left" : "center");
  editor.style.paddingTop =
    (n.kind === "label"
      ? labelPadY
      : Math.max(n.attachmentTo ? 4 : 12, (n.h - textLines(ctx, n).length * n.fontSize * 1.15) / 2)) * scale +
    "px";
  editor.style.paddingLeft = editor.style.paddingRight =
    (n.kind === "label" ? labelPadX : Math.max(0, (n.w - textWrapWidth(n)) / 2)) * scale + "px";
  editor.style.paddingBottom = (n.kind === "label" ? labelPadY : n.attachmentTo ? 4 : 8) * scale + "px";
  editor.style.transform = "none";
  for(const key of ["left","top","width","height"])editor.style[key]=Math.round(parseFloat(editor.style[key])*devicePixelRatio)/devicePixelRatio+"px";
}
function commitEdit() {
  if (!editing) return null;
  const edit = editing,
    n = elementByID(edit.id);
  editing = null;
  $("textEditor").hidden = true;
  if (!n) return null;
  readRichEditor(n);
  // An emptied connector label removes itself; the connector always remains.
  if (n.kind === "label") {
    const e = d().edges.find((a) => a.id === n.edgeId);
    if (e && !n.text.trim()) {
      delete e.label;
      delete e.labelMarks;
    }
    finish(edit.before);
    return null;
  }
  if (
    !n.text.trim() &&
    (edit.quick || (edit.newElement && n.kind === "text"))
  ) {
    M.remove(d(), [n.id]);
    selected.delete(n.id);
    finish(edit.before);
    return null;
  }
  reflow(n, edit.quick ? edit.initialHeight : 0);
  finish(edit.before);
  return n;
}
$("textEditor").addEventListener("input", () => {
  if (!editing) return;
  const n = elementByID(editing.id);
  if (!n) return;
  readRichEditor(n);
  reflow(n, editing.quick ? editing.initialHeight : 0);
  if(n.kind==="mind")M.layout(d(),new Set([M.treeRoot(d(),n).id]));else M.syncAttachments(d());
  rewrapEditor(n);
  positionEditor();
  render();
});
$("textEditor").addEventListener("keydown", (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if(["ArrowLeft","ArrowRight"].includes(e.key)&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault();e.stopPropagation();moveEditorCaret(e.key==="ArrowRight"?"forward":"backward",e.shiftKey);return;}
  const cmd = e.metaKey || e.ctrlKey;
  if (cmd && !e.shiftKey && !e.altKey && shapeForKey(e)) {
    e.preventDefault();
    shapeShortcut(shapeForKey(e));
    return;
  }
  if (cmd && e.shiftKey && ["7", "8", "&", "*"].includes(e.key)) {
    e.preventDefault();
    toggleList(["7", "&"].includes(e.key));
    return;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    commitEdit();
    canvas.focus();
    return;
  }
  if (e.key === "Enter" && e.shiftKey) {
    e.preventDefault();
    const t = e.currentTarget,
      pos = t.selectionStart,
      before = t.value.slice(0, pos),
      line = before.split("\n").at(-1),
      match = line.match(/^(\d+)\. /),
      bullet = line.startsWith("• "),
      marker = match ? `${Number(match[1]) + 1}. ` : bullet ? "• " : "";
    t.setRangeText("\n" + marker, t.selectionStart, t.selectionEnd, "end");
    t.dispatchEvent(new Event("input"));
    return;
  }
  if ((e.key === "Enter" || e.key === "Tab") && e.repeat) {
    e.preventDefault();
    return;
  }
  if ((e.key === "Enter" || e.key === "Tab") && !e.repeat) {
    e.preventDefault();
    e.stopPropagation();
    const key = e.key,
      n = commitEdit();
    if (n && !n.attachmentTo && !["text", "image", "sticker"].includes(n.kind)) extendNode(n, key === "Tab");
    else canvas.focus();
  }
});
function toggleList(numbered) {
  const t = $("textEditor"),
    start = t.selectionStart,
    end = t.selectionEnd,
    startLine = t.value.lastIndexOf("\n", start - 1) + 1,
    next = t.value.indexOf("\n", end),
    finish = next < 0 ? t.value.length : next,
    segment = t.value.slice(startLine, finish),
    lines = segment.split("\n"),
    regex = numbered ? /^\d+\. / : /^• /,
    remove = lines.every((l) => regex.test(l));
  let cursorShift = 0;
  const replaced = lines
    .map((l, i) => {
      const clean = l.replace(/^(?:\d+\. |• )/, ""),
        s = remove ? clean : (numbered ? `${i + 1}. ` : "• ") + clean;
      if (i === 0) cursorShift = s.length - l.length;
      return s;
    })
    .join("\n");
  t.setRangeText(replaced, startLine, finish, "preserve");
  t.setSelectionRange(
    Math.max(startLine, start + cursorShift),
    Math.min(t.value.length, end + replaced.length - segment.length),
  );
  t.dispatchEvent(new Event("input"));
}
function extendNode(n, child) {
  const before = M.clone(d()),
    m = M.extend(d(), n.id, child);
  if (!m) return;
  selected = new Set([m.id]);
  ensureVisible(m);
  beginEdit(m, { before, quick: true });
}
function ensureVisible(n) {
  const frame = usableViewport(true);
  if (n.x < frame.x) view.x += (frame.x - n.x) * view.z;
  else if (n.x + n.w > frame.x + frame.w) view.x -= Math.min(n.x - frame.x, n.x + n.w - frame.x - frame.w) * view.z;
  if (n.y < frame.y) view.y += (frame.y - n.y) * view.z;
  else if (n.y + n.h > frame.y + frame.h) view.y -= Math.min(n.y - frame.y, n.y + n.h - frame.y - frame.h) * view.z;
  changedView(); render();
}
function inspect() {
  if (isNotebook()) { $("inspector").hidden = true; return; }
  renderNotes();
  const ns = d()?.nodes.filter((n) => selected.has(n.id)) || [],
    es = d()?.edges.filter((e) => selected.has(e.id)) || [],
    n = ns[0],
    e = es[0];
  $("inspector").hidden = (!ns.length && !es.length) || !!notesNodeId;
  $("nodeNotesBtn").hidden = ns.length !== 1;
  $("nodeNotesBtn").textContent = n?.notes?.length
    ? `Comments (${noteCount(n)})`
    : "Comment ⌘⌥C";
  if (!ns.length && !es.length) return;
  $("selectionLabel").textContent =
    selected.size > 1
      ? selected.size + " SELECTED ELEMENTS"
      : e
        ? "CONNECTOR STYLE"
        : "ELEMENT STYLE";
  $("shapeStyle").parentElement.hidden =
    !n || n.attachmentTo || ["text", "image", "sticker"].includes(n.kind);
  // Connectors expose the same text controls, which style their label.
  const textual = n
    ? !["image", "sticker"].includes(n.kind)
    : !!e;
  $("richFormat").hidden = !textual;
  $("textAlignment").hidden = !n || ["image", "sticker"].includes(n.kind);
  for (const button of $("textAlignment").querySelectorAll("button"))
    button.setAttribute(
      "aria-pressed",
      String(
        button.dataset.align ===
          (n?.textAlign || (n?.kind === "text" ? "left" : "center")),
      ),
    );
  $("shapeStyle").value = n?.shape || "process";
  const fillable = !!n && !["text", "image", "sticker"].includes(n.kind);
  $("fillSection").hidden = !fillable;
  // Fill style only means something once a fill colour is chosen.
  $("fillStyle").parentElement.hidden = !fillable || n.fill === "transparent";
  // Only the plain rectangle chooses its corners; every other shape defines its own.
  $("edges").parentElement.hidden = n?.shape !== "process" || n.kind === "text";
  $("highlightSection").hidden = !textual;
  // An image with no border should not show controls for one it does not have.
  const borderless = n?.kind === "image" && n.stroke === "transparent";
  $("strokeColor").parentElement.hidden = n?.kind === "sticker" || borderless;
  $("strokeWidth").parentElement.hidden = n?.kind === "sticker" || borderless;
  for (const [key, value] of [
    ["strokeColor", n?.stroke || e?.stroke],
    ["strokeWidth", n?.sw || e?.sw],
    ["strokeStyle", n?.strokeStyle || e?.strokeStyle || "solid"],
    ["sloppiness", n?.sloppiness ?? e?.sloppiness ?? "legacy"],
    ["fontFamily", n?.fontFamily || e?.fontFamily || "Excalifont"],
    ["fontSize", n?.fontSize || e?.fontSize || (n ? 19 : 14)],
    ["textColor", n?.textColor || e?.textColor || "#1b1b1f"],
    ["fillStyle", n?.fillStyle || "solid"],
    ["edges", n?.edges || "sharp"],
    ["edgeStyle", e?.style || "curved"],
  ])
    $(key).value = key === "strokeColor" && value === "transparent" ? "#1b1b1f" : value;
  $("edgeArrow").checked = e?.arrow ?? true;
  $("fontFamily").parentElement.hidden = !textual;
  $("fontFallback").hidden = !textual || googleSansAvailable || ![...ns, ...es].some(item => item.fontFamily === "Google Sans");
  for (const id of ["strokeStyle", "sloppiness"]) $(id).parentElement.hidden = n?.kind === "sticker" || n?.kind === "text" || borderless;
  for (const [id, key] of [["fontFamily","fontFamily"],["strokeStyle","strokeStyle"],["sloppiness","sloppiness"],["strokeWidth","sw"],["fillStyle","fillStyle"],["edges","edges"]]) {
    const items = [...ns, ...es].filter(item => id !== "fontFamily" || !["image","sticker"].includes(item.kind) && item.kind);
    const values = new Set(items.map(item => item[key] ?? ({fontFamily:"Excalifont",strokeStyle:"solid",sloppiness:"legacy",sw:1.8,fillStyle:"solid",edges:"sharp"}[key])));
    $(id).querySelector('[value="mixed"]')?.remove();
    if (values.size > 1) { const o = new Option("Mixed", "mixed"); o.disabled = true; $(id).add(o); $(id).value = "mixed"; }
  }
  $("fontSize").parentElement.hidden = !textual;
  $("textColor").parentElement.hidden = !textual;
  $("transparentStroke").hidden = !n || n.kind !== "image";
  $("transparentStroke").textContent =
    n?.stroke === "transparent" ? "Add border" : "Remove border";
  $("transparentStroke").setAttribute("aria-pressed", String(n?.stroke !== "transparent"));
  $("edgeStyle").parentElement.hidden = !e;
  $("edgeArrow").parentElement.hidden = !e || e.tree;
  $("alignSection").hidden = !ns.length;
  for (const button of $("alignTools").children)
    button.disabled = ns.filter((a) => a.kind !== "mind").length < 2;
  $("layerTools").hidden = !ns.length;
  $("groupBtn").hidden = ns.length < 2 && !n?.group;
  $("groupBtn").textContent = n?.group ? "Ungroup ⌘⇧G" : "Group ⌘G";
  const fillValues=new Set(ns.map(n=>n.fill));
  for (const b of $("fillColors").querySelectorAll("[data-color]")) {
    const active=fillValues.size===1&&b.dataset.color===n?.fill;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));
  }
  syncCustomSwatch($("fillCustom"), n?.fill);
  syncStrokeControls();
  window.syncDefaultButton?.();
}
for (const button of $("textAlignment").querySelectorAll("button"))
  button.onclick = () => styleSelection("textAlign", button.dataset.align);
for (const color of M.colors) {
  const b = document.createElement("button");
  b.className = "swatch";
  if (color === "transparent") b.classList.add("transparent");
  else b.style.background = color;
  b.dataset.color = color;
  b.title = color === "transparent" ? "No fill" : color;
  b.ariaLabel = color === "transparent" ? "No fill" : "Fill " + color;
  b.onclick = () => styleSelection("fill", color);
  $("fillColors").append(b);
}
// Anything outside the palette is still reachable, through the same colour
// picker the stroke and text controls open.
function customSwatch(label, apply, id) {
  const holder = document.createElement("label");
  holder.className = "swatch swatch-custom";
  holder.id = id;
  holder.title = label;
  const input = document.createElement("input");
  input.type = "color";
  input.setAttribute("aria-label", label);
  input.onchange = () => apply(input.value);
  holder.append(input);
  return holder;
}
$("fillColors").parentElement.append(
  customSwatch(
    "Custom fill colour",
    (value) => styleSelection("fill", value),
    "fillCustom",
  ),
);
// The custom swatch shows the colour in use when it is not one of the presets,
// and otherwise stays a plain colour wheel.
function syncCustomSwatch(holder, value) {
  if (!holder) return;
  const custom = !!value && !M.colors.includes(value);
  holder.classList.toggle("active", custom);
  holder.style.background = custom ? value : "";
  if (/^#[0-9a-f]{6}$/i.test(value || ""))
    holder.querySelector("input").value = value;
}
function styleSelection(key, value) {
  mutate(() => {
    for (const n of d().nodes.filter((n) => selected.has(n.id))) {
      if (["fontFamily", "fontSize"].includes(key) && ["image", "sticker"].includes(n.kind)) continue;
      n[key] = value;
      // Choosing a colour for a shape that had none should show that colour.
      if (key === "fill" && value !== "transparent" && !n.fillStyle) n.fillStyle = "solid";
      if (key === "fontSize" || key === "shape" || key === "fontFamily") reflow(n);
    }
    for (const e of d().edges.filter((e) => selected.has(e.id))) {
      if (
        [
          "stroke",
          "sw",
          "style",
          "arrow",
          "strokeStyle",
          "sloppiness",
          "fontFamily",
          "fontSize",
          "textColor",
        ].includes(key) &&
        !(key === "arrow" && e.tree)
      )
        e[key] = value;
    }
  });
  if (editing) positionEditor();
}
for (const [id, key, numeric] of [
  ["shapeStyle", "shape"],
  ["fillStyle", "fillStyle"],
  ["edges", "edges"],
  ["strokeColor", "stroke"],
  ["strokeWidth", "sw", true],
  ["strokeStyle", "strokeStyle"],
  ["sloppiness", "sloppiness", true],
  ["fontFamily", "fontFamily"],
  ["fontSize", "fontSize", true],
  ["textColor", "textColor"],
  ["edgeStyle", "style"],
])
  $(id).onchange = (e) =>
    styleSelection(key, numeric ? Number(e.target.value) : e.target.value);
$("edgeArrow").onchange = (e) => styleSelection("arrow", e.target.checked);
// Adding a border starts from a known, quiet state rather than whatever the
// controls happened to be left on, and does it as a single change.
$("transparentStroke").onclick = () => {
  const images = () =>
    d()?.nodes.filter((a) => selected.has(a.id) && a.kind === "image") || [];
  const adding = images().some((a) => a.stroke === "transparent");
  mutate(() => {
    for (const n of images())
      Object.assign(
        n,
        adding
          ? { stroke: "#1b1b1f", sw: 1, strokeStyle: "solid", sloppiness: 1 }
          : { stroke: "transparent" },
      );
  });
};
function align(action) {
  const ns = d().nodes.filter((n) => selected.has(n.id) && n.kind !== "mind");
  if (ns.length < 2) {
    toast("Select at least two elements outside a mind map.");
    return;
  }
  mutate(() => {
    const b = M.bounds(ns);
    if (action === "horizontal" || action === "vertical") {
      if (ns.length < 3) return;
      const horizontal = action === "horizontal",
        axis = horizontal ? "x" : "y",
        size = horizontal ? "w" : "h",
        sorted = [...ns].sort((a, b) => a[axis] - b[axis]);
      const total = sorted.reduce((s, n) => s + n[size], 0),
        gap = (b[size] - total) / (ns.length - 1);
      let p = b[axis];
      for (const n of sorted) {
        n[axis] = p;
        p += n[size] + gap;
      }
    } else
      for (const n of ns) {
        if (action === "left") n.x = b.x;
        if (action === "center") n.x = b.x + (b.w - n.w) / 2;
        if (action === "right") n.x = b.x + b.w - n.w;
        if (action === "top") n.y = b.y;
        if (action === "middle") n.y = b.y + (b.h - n.h) / 2;
        if (action === "bottom") n.y = b.y + b.h - n.h;
      }
  });
}
for (const [action, title, iconName] of [
  ["left", "Align left", "alignLeft"],
  ["center", "Align horizontal centers", "alignCenter"],
  ["right", "Align right", "alignRight"],
  ["horizontal", "Distribute horizontally", "horizontal"],
  ["top", "Align top", "top"],
  ["middle", "Align vertical centers", "middle"],
  ["bottom", "Align bottom", "bottom"],
  ["vertical", "Distribute vertically", "vertical"],
]) {
  const b = document.createElement("button");
  b.title = title;
  b.ariaLabel = title;
  b.innerHTML = icon(iconName);
  b.onclick = () => align(action);
  $("alignTools").append(b);
}
function layerSelection(action) {
  if (!d()?.nodes.some((n) => selected.has(n.id))) return;
  mutate(() => M.layer(d(), selected, action));
}
for (const button of $("layerTools").querySelectorAll("[data-layer]"))
  button.onclick = () => layerSelection(button.dataset.layer);
function grouping(ungroup = false) {
  if (!selected.size) return;
  mutate(() => {
    const groups = new Set(
        d()
          .nodes.filter((n) => selected.has(n.id))
          .map((n) => n.group)
          .filter(Boolean),
      ),
      group = M.uid();
    for (const n of d().nodes)
      if (selected.has(n.id) || (ungroup && groups.has(n.group)))
        n.group = ungroup ? null : group;
    for (const e of d().edges)
      if (selected.has(e.id)) e.group = ungroup ? null : group;
  });
}
$("groupBtn").onclick = () =>
  grouping(d().nodes.some((n) => selected.has(n.id) && n.group));
function removeSelection() {
  if (!selected.size) return;
  mutate(() => {
    M.remove(d(), selected);
    selected.clear();
  });
}
function duplicate() {
  if (!selected.size) return;
  mutate(() => {
    selected = new Set(M.paste(d(), M.selection(d(), [...selected], true)));
  });
}
function undo() {
  if (isNotebook()) { notebookUndo(); return; }
  if (editing) commitEdit();
  current.canvas = history.undo(d());
  syncMode();
  selected.clear();
  changed();
  render();
  inspect();
}
function redo() {
  if (isNotebook()) { notebookUndo(true); return; }
  if (editing) commitEdit();
  current.canvas = history.redo(d());
  syncMode();
  selected.clear();
  changed();
  render();
  inspect();
}
$("undo").onclick = undo;
$("redo").onclick = redo;
$("duplicateBtn").onclick = duplicate;
$("deleteBtn").onclick = removeSelection;
async function copyEditable(cut = false) {
  if (!selected.size) return;
  const part = M.selection(d(), [...selected], true);
  const ok = await native("clipboardWrite", {
    editable: JSON.stringify({ format: "local-flowchart-v1", ...part }),
    text: part.nodes.map((n) => n.text).join("\n"),
  });
  if (!ok) throw Error("Could not copy the elements.");
  if (cut) removeSelection();
  else toast("Elements copied.");
}
let pasteCascade = { key: null, count: 0 };
function resetPasteCascade() { pasteCascade = { key: null, count: 0 }; }
function usableViewport(reserveInspector = false) {
  const box = canvas.getBoundingClientRect();
  let left = 24, right = box.width - 24;
  for (const id of ["inspector", "notesPanel"]) {
    const panel = $(id);
    if (!panel.hidden) right = Math.min(right, panel.getBoundingClientRect().left - box.left - 24);
  }
  if (reserveInspector && $("inspector").hidden && $("notesPanel").hidden) {
    const style = getComputedStyle($("inspector"));
    right = Math.min(right, box.width - (parseFloat(style.right) || 0) - parseFloat(style.width) - 24);
  }
  return { x: (left - view.x) / view.z, y: (100 - view.y) / view.z,
    w: Math.max(100, right - left) / view.z, h: Math.max(100, box.height - 180) / view.z };
}
function insertVisible(part, key, options = {}) {
  if (!M.validate(part) || !part.nodes.length) throw Error("Cannot insert invalid elements.");
  const b = exportBounds(part, part);
  let viewport = usableViewport(true);
  if (!options.preserveView && b.w > viewport.w && b.h > viewport.h) {
    zoom(Math.max(.1, view.z * Math.max(viewport.w / b.w, viewport.h / b.h)));
    viewport = usableViewport(true);
  }
  pasteCascade = { key, count: pasteCascade.key === key ? pasteCascade.count + 1 : 0 };
  let offset = M.placeBounds(b, viewport, view.z, pasteCascade.count);
  if(options.collisionAware) {
    const center=M.placeBounds(b,viewport,view.z,0);
    const duplicateAt=at=>part.nodes.some(n=>d().nodes.some(a=>a.kind===n.kind&&Math.abs(a.x-n.x-at.dx)<1&&Math.abs(a.y-n.y-at.dy)<1&&Math.abs(a.w-n.w)<1&&Math.abs(a.h-n.h)<1));
    if(duplicateAt(offset)) for(const [x,y] of [[24,24],[48,48],[-24,-24],[-48,-48],[24,-24],[-24,24],[72,24],[-72,-24]]) {
      const candidate={dx:center.dx+x/view.z,dy:center.dy+y/view.z};if(!duplicateAt(candidate)){offset=candidate;break;}
    }
  }
  // A sparse selection can have an empty center even after bounds placement.
  // Keep an actual pasted object in the usable viewport, not just the bundle bounds.
  if(!part.nodes.some(n=>n.kind === "line" ? M.routeBlocked([{x:n.x1+offset.dx,y:n.y1+offset.dy},{x:n.x2+offset.dx,y:n.y2+offset.dy}],[viewport]) : M.overlap({...n,x:n.x+offset.dx,y:n.y+offset.dy},viewport))) {
    const nearest=[...part.nodes].sort((a,c)=>Math.hypot(a.x+a.w/2-b.x-b.w/2,a.y+a.h/2-b.y-b.h/2)-Math.hypot(c.x+c.w/2-b.x-b.w/2,c.y+c.h/2-b.y-b.h/2))[0];
    offset=M.placeBounds(nearest,viewport,view.z,0);
  }
  mutate(() => { selected = new Set(M.paste(d(), part, offset.dx, offset.dy)); }, false);
  setTool("select");
  canvas.focus();
}
async function pasteEditable() {
  const clip = await native("clipboardRead");
  let part;
  try {
    part = JSON.parse(clip.editable);
    if (part.format !== "local-flowchart-v1" || !M.validate(part)) part = null;
  } catch { part = null; }
  if (part?.nodes.length) insertVisible(part, clip.editable);
  else if (clip.image) await insertClipboardImage(clip);
  else if (clip.text) {
    const n = M.node("text", 0, 0, "process", clip.text);
    autoSize(n);
    insertVisible({ nodes: [n], edges: [] }, "text:" + clip.text);
  } else toast("Nothing supported to paste. Copy diagram elements, text, or an image.");
}
function exportElements(scope) {
  if (scope === "all") return M.clone(visibleCanvas());
  const ids = M.attached(d(), selected);
  return {
    nodes: M.clone(visibleCanvas().nodes.filter((n) => ids.has(n.id))),
    edges: M.clone(
      visibleCanvas().edges.filter(
        (e) => (ids.has(e.from) && ids.has(e.to)) || ids.has(e.id),
      ),
    ),
  };
}
function exportBounds(part, doc = d(), helpers = true) {
  const boxes = [...part.nodes];
  for (const n of part.nodes) {
    const badge = helpers && collapsedBadge(n, doc);
    if (badge) boxes.push(badge);
  }
  for (const e of part.edges) {
    const label = labeledEdge(e, doc);
    if (label) boxes.push(label);
    const g = edgeGeometry(e, doc);
    if (g) {
      let points = [...g.pts, g.p, g.q];
      if (e.style === "curved") {
        const va = sideVector(g.sa),
          vb = sideVector(g.sb),
          dist = curveDistance(e, g);
        points.push(
          { x: g.p.x + va[0] * dist, y: g.p.y + va[1] * dist },
          { x: g.q.x + vb[0] * dist, y: g.q.y + vb[1] * dist },
        );
      }
      for (const p of points)
        boxes.push({ x: p.x - 4, y: p.y - 4, w: 8, h: 8 });
    }
  }
  return M.bounds(boxes);
}
async function exportPNG(
  clipboard = false,
  scope = selected.size ? "selection" : "all",
  // The board reads as white, so an exported or copied image is white too
  // unless the export dialog is told otherwise.
  background = "white",
  scale = 2,
  approved = false,
) {
  if (!d().nodes.length) {
    toast("The canvas is empty. Add an element first.");
    return;
  }
  const part = exportElements(scope);
  if (!part.nodes.length && !part.edges.length) {
    toast("Select the elements you want to export.");
    return;
  }
  const b = exportBounds(part),
    padding = 30,
    width = Math.ceil((b.w + padding * 2) * scale),
    height = Math.ceil((b.h + padding * 2) * scale),
    pixels = width * height;
  if (width > 16000 || height > 16000 || pixels > 64_000_000) {
    showModal(
      '<h2>Image is too large</h2><p>Select part of the diagram or choose a lower scale. Your document is safe.</p><div class="actions"><button data-close class="primary">Got it</button></div>',
    );
    return;
  }
  if (pixels > 24_000_000 && !approved) {
    confirmAction(
      "Export a large image?",
      `This ${width} × ${height} image needs more memory. Continue?`,
      () => exportPNG(clipboard, scope, background, scale, true),
    );
    return;
  }
  showModal(
    '<h2>Preparing image…</h2><p>Rendering your diagram at the selected resolution.</p><div class="actions"><button id="cancelExport">Cancel</button></div>',
  );
  let canceled = false;
  $("cancelExport").onclick = () => {
    canceled = true;
    closeModal();
  };
  await new Promise((r) => setTimeout(r, 50));
  if (canceled) return;
  try {
    await document.fonts.ready;
    await Promise.all(
      part.nodes.filter((n) => n.kind === "image").map(loadImageNode),
    );
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    const c = out.getContext("2d");
    if (!c) throw Error("Not enough memory to create the image.");
    if (background === "white") {
      c.fillStyle = "#fff";
      c.fillRect(0, 0, width, height);
    }
    c.scale(scale, scale);
    c.translate(padding - b.x, padding - b.y);
    for (const item of paintOrder(part.nodes, part.edges))
      if (item.edge) drawEdge(c, item.edge, part);
      else drawNode(c, item.node);
    const data = out.toDataURL("image/png").split(",")[1];
    out.width = 1;
    out.height = 1;
    if (canceled) return;
    closeModal();
    const ok = await native("png", {
      data,
      clipboard,
      filename: current.title.replace(/[\/:]/g, "-"),
    });
    if (ok)
      toast(clipboard ? "Image copied to the clipboard." : "PNG exported.");
  } catch (e) {
    closeModal();
    if (clipboard) {
      showModal(
        `<h2>Could not copy image</h2><p>${esc(e.message)}</p><div class="actions"><button data-close>Close</button><button id="fallbackExport" class="primary">Export PNG</button></div>`,
      );
      $("fallbackExport").onclick = () => {
        closeModal();
        exportDialog();
      };
    } else toast(e.message || "Export failed. Your document is safe.");
  }
}
function exportDialog() {
  if (isNotebook()) { exportNotePDF().catch(e => toast(e.message)); return; }
  if (editing) commitEdit();
  if (!d().nodes.length) {
    toast("The canvas is empty. Add an element first.");
    return;
  }
  showModal(
    `<h2>Export your diagram</h2><p>Save a PNG, ready to use anywhere.</p><label>Scope<select id="exportScope"><option value="all">Entire diagram</option><option value="selection" ${!selected.size ? "disabled" : ""}>Current selection</option></select></label><label>Background<select id="exportBg"><option value="white">White</option><option value="transparent">Transparent</option></select></label><label>Scale<select id="exportScale"><option value="1">1×</option><option value="2" selected>2× · Recommended</option><option value="3">3×</option></select></label><div class="tip">Export includes your diagram, without toolbars or selection handles.</div><div class="actions"><button data-close>Cancel</button><button id="exportConfirm" class="primary">Export PNG ↗</button></div>`,
  );
  $("exportScope").value = selected.size ? "selection" : "all";
  $("exportConfirm").onclick = () => {
    const s = $("exportScope").value,
      b = $("exportBg").value,
      z = Number($("exportScale").value);
    closeModal();
    exportPNG(false, s, b, z);
  };
}
$("exportOpen").onclick = exportDialog;
function help() {
  showModal(
    `<h2>Make room for shortcuts.</h2><p>Select a node to grow your diagram.</p>${[
      ["Tab", "Mind-map child / flowchart node to the right"],
      ["Enter", "Mind-map sibling / flowchart node below"],
      ["Shift Enter", "New line in text"],
      ["Escape", "Finish editing / cancel tool"],
      ["⌘ Z · ⌘ ⇧ Z", "Undo · redo"],
      ["⌘ C · ⌘ V · ⌘ D", "Copy · paste · duplicate"],
      ["⌘ ⇧ C", "Copy as image"],
      ["⌘ ⌥ C", "Comment on selected node"],
      ["Enter / Shift Enter", "Send comment / new line in comments"],
      ["Square handles", "Resize a selected node from its sides or corners"],
      ["⌘ B · ⌘ U · ⌘ H", "Bold · underline · highlight"],
      ["Right-click a parent", "Collapse / expand branch"],
      ["⌘ V", "Paste an image or text from clipboard"],
      ["⌘ G · ⌘ ⇧ G", "Group · ungroup"],
      ["⌘ ⇧ 7 / 8", "Numbered / bulleted list while editing"],
      ["Space + drag", "Pan canvas"],
      ["⌘ 1 – ⌘ 6", "Rectangle · decision · start / end · note · circle · input / output"],
      ["⌘ 0 · ⌘ ⇧ 0", "Fit diagram · 100% zoom"],
      ["⌘ ,", "Defaults for new shapes and connectors"],
      ["⌘ K", "Search commands"],
      ["Option + drag", "Duplicate while dragging"],
    ]
      .map(
        ([a, b]) =>
          `<div class="shortcut-row"><kbd>${a}</kbd><span>${b}</span></div>`,
      )
      .join(
        "",
      )}<div class="tip">Drag a branch onto another node to reparent it. Drop near a sibling’s top or bottom edge to reorder.</div><div class="actions"><button data-close class="primary">Got it</button></div>`,
  );
}
$("help").onclick = help;
$("homeHelp").onclick = help;
async function textCommand(command) {
  const t = document.activeElement;
  if (
    !(
      t === $("textEditor") ||
      t instanceof HTMLInputElement ||
      t instanceof HTMLTextAreaElement
    )
  )
    return false;
  const start = t.selectionStart || 0,
    end = t.selectionEnd || 0;
  if (command === "all") t.select();
  else if (command === "copy" || command === "cut") {
    if (start !== end) {
      await native("clipboardWrite", { text: t.value.slice(start, end) });
      if (command === "cut") {
        t.setRangeText("", start, end, "end");
        t.dispatchEvent(new Event("input"));
      }
    }
  } else if (command === "paste") {
    const clip = await native("clipboardRead");
    t.setRangeText(clip.text, start, end, "end");
    t.dispatchEvent(new Event("input"));
  } else if (command === "undo") {
    if (t === richEditor) richUndo();
    else document.execCommand("undo");
  } else if (command === "redo") {
    if (t === richEditor) richUndo(true);
    else document.execCommand("redo");
  }
  return true;
}
// File › Open in Browser. Saves first; if that fails the app stays put and says why.
window.openInBrowser = async () => {
  try {
    await window.flushSave();
  } catch (e) {
    await native("browserSaveFailed", { message: e.message });
    return;
  }
  await native("openInBrowser");
};
window.appCommand = async (command) => {
  try {
    if (command === "find") { openFind(); return; }
    if (command === "export-pdf") {
      if (isNotebook()) await exportNotePDF(); else exportBoardPDFDialog();
      return;
    }
    if (typeof findBar !== "undefined" && findBar.contains(document.activeElement) && ["all", "copy", "cut", "paste", "undo", "redo"].includes(command)) {
      await textCommand(command); return;
    }
    if (command === "commands") { openCommandMenu(); return; }
    if (command === "browser") { if (!window.mapyourmindBrowser) await window.openInBrowser(); return; }
    if (command === "settings") {
      if (!$("modal").open) defaultsPanel();
      return;
    }
    if (isNotebook() && await notebookCommand(command)) return;
    if (command === "import") { await chooseMindmapImport(); return; }
    if (await featureCommand(command)) return;
    if (await textCommand(command)) return;
    if ($("modal").open || $("commandMenu").open) return;
    if (command === "new") {
      newDoc();
      return;
    }
    if (!current) return;
    switch (command) {
      case "undo":
        undo();
        break;
      case "redo":
        redo();
        break;
      case "cut":
        await copyEditable(true);
        break;
      case "copy":
        await copyEditable();
        break;
      case "paste":
        await pasteEditable();
        break;
      case "image":
        await exportPNG(true);
        break;
      case "all":
        selected = new Set(
          [...visibleCanvas().nodes, ...visibleCanvas().edges].map((n) => n.id),
        );
        render();
        inspect();
        break;
      case "duplicate":
        duplicate();
        break;
      case "fit":
        fit();
        break;
      case "actual":
        zoom(1);
        break;
      case "in":
        zoom(view.z * 1.2);
        break;
      case "out":
        zoom(view.z / 1.2);
        break;
      case "export":
        exportDialog();
        break;
    }
  } catch (e) {
    toast(e.message);
  }
};
window.addEventListener("keydown", (e) => {
  if (
    isNotebook() ||
    editing ||
    e.isComposing ||
    e.keyCode === 229 ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) ||
    $("modal").open || $("commandMenu").open ||
    !current
  )
    return;
  const cmd = e.metaKey || e.ctrlKey;
  if (e.key === " ") {
    e.preventDefault();
    space = true;
    canvas.style.cursor = "grab";
    return;
  }
  if (cmd) {
    if (!e.shiftKey && !e.altKey && shapeForKey(e)) {
      e.preventDefault();
      shapeShortcut(shapeForKey(e));
      return;
    }
    // ⌘1 belongs to Rectangle, so 100% zoom moved to ⌘⇧0.
    if (e.shiftKey && e.code === "Digit0") {
      e.preventDefault();
      window.appCommand("actual");
      return;
    }
    const key = e.key.toLowerCase(),
      map = {
        z: e.shiftKey ? "redo" : "undo",
        c: e.shiftKey ? "image" : "copy",
        v: "paste",
        x: "cut",
        d: "duplicate",
        a: "all",
        0: "fit",
        "+": "in",
        "=": "in",
        "-": "out",
        e: "export",
        ",": "settings",
      };
    if (map[key]) {
      e.preventDefault();
      window.appCommand(map[key]);
      return;
    }
    if (key === "g") {
      e.preventDefault();
      grouping(e.shiftKey);
    }
    return;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    if (drag) {
      cancelDrag();
      return;
    }
    if (!$("shapePicker").hidden) {
      $("shapePicker").hidden = true;
      quick = null;
      return;
    }
    if (tool !== "select") {
      setTool("select");
      return;
    }
    selected.clear();
    inspect();
    render();
    return;
  }
  if (e.key === "Backspace" || e.key === "Delete") {
    e.preventDefault();
    removeSelection();
    return;
  }
  if (["Tab", "Enter"].includes(e.key)) {
    e.preventDefault();
    if (e.repeat) return;
    const n = d().nodes.find((n) => selected.has(n.id));
    if (n && selected.size === 1 && n.kind !== "image")
      extendNode(n, e.key === "Tab");
    else if (!n && selected.size === 1 && e.key === "Enter")
      editEdgeLabel(d().edges.find((a) => selected.has(a.id)));
    return;
  }
  const key = e.key.toLowerCase();
  if (
    {
      v: "select",
      h: "hand",
      r: "shape",
      m: "mind",
      t: "text",
      c: "connector",
    }[key]
  )
    setTool(
      {
        v: "select",
        h: "hand",
        r: "shape",
        m: "mind",
        t: "text",
        c: "connector",
      }[key],
    );
});
window.addEventListener("keyup", (e) => {
  if (e.key === " ") {
    space = false;
    canvas.style.cursor = tool === "hand" ? "grab" : "default";
  }
});
window.addEventListener("blur", () => {
  // Abandoning a drag when the window loses focus is right for real use. A UI
  // test drives drags across awaits, so a passing window focus change would
  // silently roll one back; the harness opts out.
  if (window.uiTest) return;
  space = false;
  if (drag?.before) current.canvas = drag.before;
  drag = null;
  hover = null;
  guides = [];
});
// Only monotonic time from the same boot can expire Trash. Across a reboot,
// count the current boot conservatively; wall-clock changes never age documents.
function updateRetention(clock) {
  let any = false;
  for (const doc of state.documents.filter((a) => a.trashedAt)) {
    const previous = doc.trashClock;
    if (previous) {
      let elapsed =
        previous.boot === clock.boot
          ? Math.max(0, clock.uptime - previous.uptime)
          : Math.min(clock.uptime, Math.max(0, clock.wall - previous.wall));
      doc.trashElapsed = (doc.trashElapsed || 0) + elapsed;
    }
    doc.trashClock = clock;
    any = true;
  }
  const retained = state.documents.filter(
    (a) => !a.trashedAt || (a.trashElapsed || 0) < 30 * 86400000,
  );
  if (retained.length !== state.documents.length) {
    state.documents = retained;
    if (!current) renderHome();
  }
  return any;
}
setInterval(async () => {
  if (!loaded || !state.documents.some((a) => a.trashedAt)) return;
  try {
    if (updateRetention(await native("clock"))) changed();
  } catch (e) {
    toast(e.message);
  }
}, 60_000);
(async () => {
  $("newDoc").disabled=true;
  try {
    // Resolve local compatibility fonts before measuring; never distribute them.
    const localFaces = await native("localFonts");
    const fontResults = await Promise.allSettled(localFaces.map(async face => {
      const font = new FontFace("Google Sans", `url(${face.data})`, {style: face.style, weight: face.weight});
      await font.load(); document.fonts.add(font);
    }));
    googleSansAvailable = fontResults.some(result => result.status === "fulfilled");
    if (!googleSansAvailable) {
      try {
        const font = await new FontFace("Google Sans", 'local("Google Sans"), local("GoogleSans-Regular")').load();
        document.fonts.add(font); googleSansAvailable = true;
      } catch { /* Arial is the explicit shared canvas/editor fallback. */ }
    }
    // Read the store while the fonts load; nothing is measured before both.
    const [result, preferences] = await Promise.all([native("load"),native("loadPreferences"),document.fonts.load("19px Excalifont"),document.fonts.load('19px "Comic Shanns"'),document.fonts.load('13px "Google Sans"'),document.fonts.load('bold 19px "Google Sans"'),document.fonts.load('500 11px "Google Sans"')]);
    M.setDefaults(preferences);
    state = result.state;
    for (const doc of state.documents || [])
      for (const n of doc.canvas?.nodes || [])
        if (n.imageRef) {
          imageRefs.set(n.imageData, n.imageRef);
          delete n.imageRef;
        }
    if (
      ![1, 2, 3].includes(state.schema) ||
      !state.documents.every(validDocument)
    )
      throw Error("Invalid document. Your original data has been preserved.");
    loaded = true;
    $("newDoc").disabled=false;
    if (updateRetention(result.clock)) changed();
    initDocumentSidebar();
    const startup = state.documents
      .filter((a) => !a.trashedAt)
      .sort((a, b) => b.updated - a.updated)[0];
    if (startup) openDoc(startup.id);
    else renderHome();
    if (result.recovered)
      toast("Documents recovered from the last valid backup.");
    await document.fonts.ready;
    resize();
  } catch (e) {
    showModal(
      `<h2>Storage needs attention</h2><p>${esc(e.message)}</p><p>Close the app and back up your local data before attempting recovery.</p>`,
    );
    $("newDoc").disabled = true;
  }
})();
