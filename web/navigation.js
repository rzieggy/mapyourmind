"use strict";
let documentSidebarOpen = true;
let documentSwitchPending = false;
let sidebarReorder = null;
const sidebarMinWidth = 190,
  sidebarMaxWidth = 360,
  sidebarDefaultWidth = 236;
// The sidebar never takes more than a third of the window, so a narrow display
// still leaves the canvas usable at the maximum width.
function clampSidebarWidth(width) {
  return Math.round(
    Math.max(
      sidebarMinWidth,
      Math.min(sidebarMaxWidth, Math.min(width, innerWidth / 3)),
    ),
  );
}
function sidebarWidth() {
  return clampSidebarWidth(state?.sidebarWidth || sidebarDefaultWidth);
}
function applySidebarWidth() {
  document.documentElement.style.setProperty(
    "--sidebar-width",
    sidebarWidth() + "px",
  );
}
// Documents sort by creation date, newest first, until they are arranged by
// hand. A manual order is stored per document and then takes precedence.
function sortedDocuments(trashed = false) {
  const documents = state.documents.filter((doc) =>
    trashed ? doc.trashedAt : !doc.trashedAt,
  );
  if (trashed) return documents.sort((a, b) => b.trashedAt - a.trashedAt);
  const ordered = documents.every((doc) => Number.isFinite(doc.order));
  return documents.sort((a, b) =>
    ordered ? a.order - b.order : (b.created || 0) - (a.created || 0),
  );
}
// Writing the order for every document at once keeps the list stable; a partly
// ordered list has no single correct reading.
function normalizeDocumentOrder(ids) {
  ids.forEach((id, index) => {
    const doc = state.documents.find((a) => a.id === id);
    if (doc) doc.order = index;
  });
}
function documentRow(doc, trashed) {
  const button = document.createElement("button");
  button.className = "sidebar-document" + (trashed ? " trashed" : "");
  button.dataset.documentId = doc.id;
  button.title = doc.title;
  button.innerHTML = icon(
    trashed ? "trash" : doc.mode === "notes" ? "note" : "document",
  );
  const name = document.createElement("span");
  name.textContent = doc.title;
  button.append(name);
  if (!trashed && current?.id === doc.id)
    button.setAttribute("aria-current", "page");
  button.disabled = documentSwitchPending;
  button.oncontextmenu = (e) => {
    e.preventDefault();
    showDocumentMenu(e, doc, trashed);
  };
  if (trashed) return button;
  button.onpointerdown = (e) => beginSidebarReorder(e, doc.id);
  return button;
}
function renderDocumentSidebar() {
  applySidebarWidth();
  const list = $("sidebarDocumentList");
  list.replaceChildren();
  const documents = sortedDocuments();
  for (const doc of documents) list.append(documentRow(doc, false));
  if (!documents.length) {
    const empty = document.createElement("p");
    empty.className = "sidebar-empty";
    empty.textContent = "No documents yet. Create one to start.";
    list.append(empty);
  }
  const trashed = sortedDocuments(true);
  $("sidebarTrashCount").textContent = trashed.length || "";
  const trashList = $("sidebarTrashList");
  trashList.replaceChildren();
  for (const doc of trashed) trashList.append(documentRow(doc, true));
  if (!trashed.length) {
    const empty = document.createElement("p");
    empty.className = "sidebar-empty";
    empty.textContent = "Nothing in Trash.";
    trashList.append(empty);
  }
}
// A press that stays still opens the document; a press that moves rearranges it.
// No handle or grip is shown, so the row itself is the target.
function beginSidebarReorder(e, id) {
  if (e.button !== 0 || documentSwitchPending) return;
  const list = $("sidebarDocumentList"),
    row = list.querySelector(`[data-document-id="${id}"]`);
  if (!row) return;
  sidebarReorder = { id, row, start: e.clientY, active: false };
  if (e.isTrusted) row.setPointerCapture(e.pointerId);
  row.onpointermove = (move) => {
    if (!sidebarReorder) return;
    if (!sidebarReorder.active) {
      if (Math.abs(move.clientY - sidebarReorder.start) < 5) return;
      sidebarReorder.active = true;
      row.classList.add("dragging");
      list.classList.add("reordering");
    }
    const rows = [...list.querySelectorAll(".sidebar-document")];
    for (const other of rows) {
      if (other === row) continue;
      const box = other.getBoundingClientRect();
      if (move.clientY < box.top + box.height / 2) {
        if (other.previousElementSibling !== row) list.insertBefore(row, other);
        return;
      }
    }
    if (list.lastElementChild !== row) list.append(row);
  };
  row.onpointerup = () => {
    const moved = sidebarReorder?.active;
    row.classList.remove("dragging");
    list.classList.remove("reordering");
    row.onpointermove = row.onpointerup = row.onpointercancel = null;
    sidebarReorder = null;
    if (!moved) {
      switchSidebarDocument(id);
      return;
    }
    normalizeDocumentOrder(
      [...list.querySelectorAll(".sidebar-document")].map(
        (a) => a.dataset.documentId,
      ),
    );
    changed();
    renderDocumentSidebar();
  };
  row.onpointercancel = () => {
    row.classList.remove("dragging");
    list.classList.remove("reordering");
    row.onpointermove = row.onpointerup = row.onpointercancel = null;
    sidebarReorder = null;
    renderDocumentSidebar();
  };
}
function showDocumentMenu(e, doc, trashed) {
  const menu = $("nodeContextMenu");
  menu.innerHTML = trashed
    ? '<button role="menuitem" data-document-action="restore">Restore</button><button role="menuitem" data-document-action="erase">Delete permanently</button>'
    : '<button role="menuitem" data-document-action="rename">Rename</button><button role="menuitem" data-document-action="duplicate">Duplicate</button><button role="menuitem" data-document-action="trash">Move to Trash</button><button role="menuitem" data-document-action="new">New document</button>';
  placeContextMenu(e);
  for (const button of menu.querySelectorAll("[data-document-action]"))
    button.onclick = async () => {
      closeContextMenu();
      const action = button.dataset.documentAction;
      try {
        if (action === "new") {
          await window.flushSave();
          newDoc();
        } else await docAction(action, doc.id);
      } catch (error) {
        toast(error.message);
      }
    };
  menu.querySelector("button").focus();
}
function syncDocumentSidebar() {
  $("documentSidebar").hidden = !documentSidebarOpen;
  $("workspace").classList.toggle("documents-open", documentSidebarOpen);
  $("toggleDocuments").setAttribute("aria-expanded", String(documentSidebarOpen));
  const label = documentSidebarOpen ? "Hide documents" : "Show documents";
  $("toggleDocuments").title = label;
  $("toggleDocuments").setAttribute("aria-label", label);
  applySidebarWidth();
}
// The sidebar is open from the first frame: it is the way between documents now
// that the application no longer lands on a separate home screen.
function initDocumentSidebar() {
  syncDocumentSidebar();
  renderDocumentSidebar();
}
function toggleDocumentSidebar() {
  documentSidebarOpen = !documentSidebarOpen;
  syncDocumentSidebar();
  renderDocumentSidebar();
  resize();
}
async function switchSidebarDocument(id) {
  if (documentSwitchPending || current?.id === id) return;
  const next = state.documents.find((doc) => doc.id === id && !doc.trashedAt);
  if (!next) return;
  documentSwitchPending = true;
  $("stage").inert = true;
  $("sidebarNewDocument").disabled = true;
  renderDocumentSidebar();
  try {
    cancelDrag();
    await window.flushSave();
    openDoc(id);
  } catch (error) {
    toast(error.message || "Could not save. The current document is still open.");
  } finally {
    documentSwitchPending = false;
    $("stage").inert = false;
    $("sidebarNewDocument").disabled = false;
    renderDocumentSidebar();
    if (isNotebook()) $("noteBody").focus(); else canvas.focus();
  }
}
$("toggleDocuments").onclick = toggleDocumentSidebar;
$("sidebarTrashToggle").onclick = () => {
  const open = $("sidebarTrashList").hidden;
  $("sidebarTrashList").hidden = !open;
  $("sidebarTrashToggle").setAttribute("aria-expanded", String(open));
};
$("sidebarNewDocument").onclick = async () => {
  if (documentSwitchPending) return;
  try { await window.flushSave(); newDoc(); }
  catch (error) { toast(error.message); }
};
$("sidebarResizer").onpointerdown = (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  const resizer = $("sidebarResizer"),
    left = $("documentSidebar").getBoundingClientRect().left;
  resizer.classList.add("dragging");
  if (e.isTrusted) resizer.setPointerCapture(e.pointerId);
  resizer.onpointermove = (move) => {
    state.sidebarWidth = clampSidebarWidth(move.clientX - left);
    applySidebarWidth();
    resize();
  };
  const stop = () => {
    resizer.classList.remove("dragging");
    resizer.onpointermove = resizer.onpointerup = resizer.onpointercancel = null;
    changed();
  };
  resizer.onpointerup = stop;
  resizer.onpointercancel = stop;
};
$("sidebarResizer").onkeydown = (e) => {
  const step = e.shiftKey ? 32 : 8;
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  e.preventDefault();
  state.sidebarWidth = clampSidebarWidth(
    sidebarWidth() + (e.key === "ArrowRight" ? step : -step),
  );
  applySidebarWidth();
  resize();
  changed();
};
addEventListener("resize", applySidebarWidth);
