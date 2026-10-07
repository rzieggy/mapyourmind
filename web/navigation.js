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
    trashed ? "trash" : doc.mode === "notes" ? "note" : "board",
  );
  const name = document.createElement("span");
  name.className = "sidebar-name";
  name.textContent = doc.title;
  button.append(name);
  if (!trashed && folderOf(doc)) {
    button.dataset.folderId = folderOf(doc);
    button.classList.add("in-folder");
  }
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
// Folders are one level deep. The library keeps them in `state.folders`, and a
// document points at one with `folderId`; a folderId whose folder is gone reads
// as loose, so a damaged or older file never hides a document.
function sortedFolders() {
  return [...(state.folders || [])].sort((a, b) => a.order - b.order);
}
function folderOf(doc) {
  return doc.folderId && (state.folders || []).some((f) => f.id === doc.folderId) ? doc.folderId : null;
}
function folderRow(folder, count) {
  const row = document.createElement("button");
  row.className = "sidebar-folder";
  row.dataset.folderId = folder.id;
  row.title = folder.name;
  row.setAttribute("aria-expanded", String(!folder.collapsed));
  row.innerHTML = icon("chevron") + icon("folder");
  const name = document.createElement("span");
  name.className = "sidebar-name";
  name.textContent = folder.name;
  const total = document.createElement("span");
  total.className = "sidebar-count";
  total.textContent = count || "";
  row.append(name, total);
  row.disabled = documentSwitchPending;
  row.onclick = () => {
    if (sidebarTapTwice("folder", folder.id)) {
      // The first press of a double-click folded it; undo that, then rename.
      folder.collapsed = !folder.collapsed;
      changed();
      renderDocumentSidebar();
      return startSidebarRename("folder", folder.id);
    }
    folder.collapsed = !folder.collapsed;
    changed();
    renderDocumentSidebar();
  };
  row.oncontextmenu = (e) => {
    e.preventDefault();
    showFolderMenu(e, folder);
  };
  return row;
}
function renderDocumentSidebar() {
  if (sidebarRename) return;
  applySidebarWidth();
  const list = $("sidebarDocumentList");
  list.replaceChildren();
  const documents = sortedDocuments();
  for (const folder of sortedFolders()) {
    const inside = documents.filter((doc) => folderOf(doc) === folder.id);
    list.append(folderRow(folder, inside.length));
    if (!folder.collapsed) for (const doc of inside) list.append(documentRow(doc, false));
  }
  for (const doc of documents.filter((doc) => !folderOf(doc))) list.append(documentRow(doc, false));
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
  if (viewOnly) { switchSidebarDocument(id); return; }
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
    // Over the middle of a folder row the document goes into that folder.
    let target = null;
    for (const folder of list.querySelectorAll(".sidebar-folder")) {
      const box = folder.getBoundingClientRect();
      const over = move.clientY > box.top + box.height * 0.2 && move.clientY < box.bottom - box.height * 0.2;
      folder.classList.toggle("drop-target", over);
      if (over) target = folder.dataset.folderId;
    }
    sidebarReorder.folder = target;
    if (target) return;
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
    const moved = sidebarReorder?.active,
      into = sidebarReorder?.folder;
    row.classList.remove("dragging");
    list.classList.remove("reordering");
    for (const folder of list.querySelectorAll(".drop-target")) folder.classList.remove("drop-target");
    row.onpointermove = row.onpointerup = row.onpointercancel = null;
    sidebarReorder = null;
    if (!moved) {
      if (sidebarTapTwice("document", id)) startSidebarRename("document", id);
      else switchSidebarDocument(id);
      return;
    }
    const doc = state.documents.find((a) => a.id === id);
    if (into) moveToFolder(doc, into);
    else {
      // A dropped row joins whatever it now sits under: a folder row or a
      // document in a folder. Dropped among loose documents, or last, it is loose.
      const above = row.previousElementSibling;
      const folder = row.nextElementSibling
        ? above?.dataset.folderId || null
        : null;
      if (folder) doc.folderId = folder;
      else delete doc.folderId;
      normalizeDocumentOrder(
        [...list.querySelectorAll(".sidebar-document")].map(
          (a) => a.dataset.documentId,
        ),
      );
    }
    changed();
    renderDocumentSidebar();
  };
  row.onpointercancel = () => {
    for (const folder of list.querySelectorAll(".drop-target")) folder.classList.remove("drop-target");
    row.classList.remove("dragging");
    list.classList.remove("reordering");
    row.onpointermove = row.onpointerup = row.onpointercancel = null;
    sidebarReorder = null;
    renderDocumentSidebar();
  };
}
function showDocumentMenu(e, doc, trashed) {
  if (viewOnly) return;
  const menu = $("nodeContextMenu");
  menu.innerHTML = trashed
    ? '<button role="menuitem" data-document-action="restore">Restore</button><button role="menuitem" data-document-action="erase">Delete permanently</button>'
    : '<button role="menuitem" data-document-action="rename">Rename</button><button role="menuitem" data-document-action="duplicate">Duplicate</button><button role="menuitem" data-document-action="trash">Move to Trash</button><button role="menuitem" data-document-action="new">New document</button>' +
      folderChoices(doc);
  placeContextMenu(e);
  for (const button of menu.querySelectorAll("[data-move-folder]"))
    button.onclick = () => {
      closeContextMenu();
      moveToFolder(doc, button.dataset.moveFolder || null);
      changed();
      renderDocumentSidebar();
    };
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
// "Move to folder" lists every folder the document is not in, plus No folder.
function folderChoices(doc) {
  const here = folderOf(doc),
    choices = sortedFolders().filter((f) => f.id !== here).map((f) => `<button role="menuitem" data-move-folder="${f.id}">${esc(f.name)}</button>`);
  if (here) choices.push('<button role="menuitem" data-move-folder="">No folder</button>');
  return choices.length ? '<div class="menu-label">Move to folder</div>' + choices.join("") : "";
}
function moveToFolder(doc, folderId) {
  if (!doc) return;
  if (folderId) doc.folderId = folderId;
  else delete doc.folderId;
  // It lands last in its new place.
  const orders = state.documents.filter((a) => a !== doc && Number.isFinite(a.order)).map((a) => a.order);
  if (orders.length) doc.order = Math.max(...orders) + 1;
}
function newFolder() {
  if (viewOnly || documentSwitchPending) return;
  state.folders ||= [];
  const folder = {
    id: M.uid(),
    name: "Untitled folder",
    order: state.folders.length ? Math.min(...state.folders.map((f) => f.order)) - 1 : 0,
    collapsed: false,
  };
  state.folders.push(folder);
  changed();
  renderDocumentSidebar();
  startSidebarRename("folder", folder.id);
}
// Deleting a folder never deletes documents: they become loose again.
function deleteFolder(folder) {
  const inside = state.documents.filter((doc) => doc.folderId === folder.id);
  const remove = () => {
    for (const doc of inside) delete doc.folderId;
    state.folders = (state.folders || []).filter((f) => f.id !== folder.id);
    changed();
    renderDocumentSidebar();
  };
  const live = inside.filter((doc) => !doc.trashedAt).length;
  if (live) confirmAction("Delete folder?", `“${folder.name}” will be removed. Its ${live} document${live === 1 ? "" : "s"} will stay, outside any folder.`, remove);
  else remove();
}
function showFolderMenu(e, folder) {
  if (viewOnly) return;
  const menu = $("nodeContextMenu");
  menu.innerHTML = '<button role="menuitem" data-folder-action="rename">Rename</button><button role="menuitem" data-folder-action="delete">Delete folder</button>';
  placeContextMenu(e);
  menu.querySelector('[data-folder-action="rename"]').onclick = () => { closeContextMenu(); startSidebarRename("folder", folder.id); };
  menu.querySelector('[data-folder-action="delete"]').onclick = () => { closeContextMenu(); deleteFolder(folder); };
  menu.querySelector("button").focus();
}
// Two presses on the same row within a short time rename it in place.
let sidebarTap = null;
function sidebarTapTwice(kind, id) {
  const now = performance.now(),
    twice = sidebarTap?.kind === kind && sidebarTap.id === id && now - sidebarTap.time < 450;
  sidebarTap = twice ? null : { kind, id, time: now };
  return twice;
}
let sidebarRename = null;
function startSidebarRename(kind, id) {
  if (viewOnly) return;
  const item = kind === "folder" ? (state.folders || []).find((f) => f.id === id) : state.documents.find((d) => d.id === id && !d.trashedAt);
  const row = $("sidebarDocumentList").querySelector(kind === "folder" ? `.sidebar-folder[data-folder-id="${id}"]` : `.sidebar-document[data-document-id="${id}"]`);
  if (!item || !row) return;
  // A text field cannot live inside a button, so the row is swapped for a
  // look-alike holding the field until Enter, Escape or a click elsewhere.
  const editor = document.createElement("div");
  editor.className = row.className + " renaming";
  editor.innerHTML = kind === "folder" ? icon("chevron") + icon("folder") : row.querySelector("svg").outerHTML;
  const input = document.createElement("input");
  input.className = "sidebar-rename";
  input.value = kind === "folder" ? item.name : item.title;
  input.setAttribute("aria-label", kind === "folder" ? "Folder name" : "Document name");
  editor.append(input);
  row.replaceWith(editor);
  sidebarRename = { kind, id };
  input.focus();
  input.select();
  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    sidebarRename = null;
    const value = input.value.trim().slice(0, 200);
    if (save && value && value !== (kind === "folder" ? item.name : item.title)) {
      if (kind === "folder") {
        item.name = value;
        changed();
      } else if (current?.id === id) {
        renameCurrent(value);
        return;
      } else {
        item.title = uniqueName(value, id);
        changed();
      }
    }
    renderDocumentSidebar();
  };
  input.onkeydown = (e) => {
    e.stopPropagation();
    if (e.isComposing) return;
    if (e.key === "Enter") { e.preventDefault(); finish(true); }
    if (e.key === "Escape") { e.preventDefault(); finish(false); }
  };
  input.onblur = () => finish(true);
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
    $("sidebarNewDocument").disabled = viewOnly;
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
$("sidebarNewFolder").onclick = () => newFolder();
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

// The installed version sits under Trash, so it is clear which build is open.
{
  const version = window.appVersion || document.querySelector('meta[name="mym-version"]')?.content || "";
  if (/^[0-9.]+$/.test(version)) { $("appVersion").textContent = "mapyourmind " + version; $("appVersion").hidden = false; }
}
