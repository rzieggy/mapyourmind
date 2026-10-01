"use strict";
// Notes belong to nodes. Drafts belong to documents, so switching panels is safe.
let notesNodeId = null;
function noteDraftKey(nodeId, threadId = "new") {
  return `${nodeId}/${threadId}`;
}
function noteDraft(nodeId, threadId) {
  return current?.noteDrafts?.[noteDraftKey(nodeId, threadId)] || "";
}
function saveNoteDraft(nodeId, threadId, text) {
  current.noteDrafts ||= {};
  current.noteDrafts[noteDraftKey(nodeId, threadId)] = text;
  changed();
}
function submitNote(nodeId, text, parentId = null) {
  if (!text.trim()) return;
  mutate(() => {
    M.addNote(d(), nodeId, text, parentId);
    if (current.noteDrafts)
      delete current.noteDrafts[noteDraftKey(nodeId, parentId || "new")];
  });
  const input = parentId
    ? [...$("notesThreads").querySelectorAll("form")]
        .find((f) => f.dataset.thread === parentId)
        ?.querySelector("textarea")
    : $("newNoteText");
  input?.focus();
}
function commentKeydown(e) {
  if (e.key !== "Enter" || e.shiftKey || e.isComposing || e.keyCode === 229)
    return;
  e.preventDefault();
  e.stopPropagation();
  if (!e.repeat) e.currentTarget.form?.requestSubmit();
}
function openNotes(nodeId) {
  if (viewOnly) return;
  if (editing) commitEdit();
  notesNodeId = nodeId;
  selected.clear();
  hoveredNode = null;
  hoveredPort = null;
  inspect();
  render();
  $("newNoteText").focus();
}
function closeNotes() {
  notesNodeId = null;
  $("notesPanel").hidden = true;
  inspect();
  canvas.focus();
  render();
}
function noteTime(created) {
  return new Date(created).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function renderNotes() {
  const n = current?.canvas.nodes.find((n) => n.id === notesNodeId);
  if (!n) {
    notesNodeId = null;
    $("notesPanel").hidden = true;
    return;
  }
  $("notesPanel").hidden = false;
  $("notesNodeTitle").textContent = n.text.trim() || "Untitled node";
  $("notesThreads").innerHTML = (n.notes || []).length
    ? n.notes
        .map(
          (note) =>
            `<article class="note-thread"><div class="note-meta"><time>${esc(noteTime(note.created))}</time><button data-delete-note="${note.id}" title="Delete this note and its replies" aria-label="Delete note">${icon("trash")}</button></div><p>${esc(note.text)}</p><div class="note-replies">${(note.replies || []).map((reply) => `<div class="note-reply"><div class="note-meta"><time>${esc(noteTime(reply.created))}</time><button data-delete-reply="${reply.id}" data-thread="${note.id}" title="Delete reply" aria-label="Delete reply">${icon("trash")}</button></div><p>${esc(reply.text)}</p></div>`).join("")}</div></article>`,
        )
        .join("")
    : '';
  $("newNoteText").value = noteDraft(n.id);
  for (const form of $("notesThreads").querySelectorAll("form")) {
    form.querySelector("textarea").onkeydown = commentKeydown;
    form.querySelector("textarea").oninput = (e) =>
      saveNoteDraft(n.id, form.dataset.thread, e.target.value);
    form.onsubmit = (e) => {
      e.preventDefault();
      submitNote(
        n.id,
        form.querySelector("textarea").value,
        form.dataset.thread,
      );
    };
  }
  for (const button of $("notesThreads").querySelectorAll("[data-delete-note]"))
    button.onclick = () =>
      mutate(() => M.removeNote(d(), n.id, button.dataset.deleteNote));
  for (const button of $("notesThreads").querySelectorAll(
    "[data-delete-reply]",
  ))
    button.onclick = () =>
      mutate(() =>
        M.removeNote(
          d(),
          n.id,
          button.dataset.thread,
          button.dataset.deleteReply,
        ),
      );
}
$("closeNotes").onclick = closeNotes;
$("newNoteText").onkeydown = commentKeydown;
$("newNoteText").oninput = (e) => {
  if (notesNodeId) saveNoteDraft(notesNodeId, "new", e.target.value);
};
$("newNoteForm").onsubmit = (e) => {
  e.preventDefault();
  if (notesNodeId) submitNote(notesNodeId, $("newNoteText").value);
};
function noteCount(n) {
  return (n.notes || []).reduce(
    (count, note) => count + 1 + (note.replies || []).length,
    0,
  );
}
function noteBadge(n) {
  const count = noteCount(n),
    width = Math.max(44, 28 + String(count).length * 7);
  return {
    x: n.x + n.w + 12,
    y: n.y - 28,
    w: width,
    h: 24,
    count,
  };
}
function drawNoteBadges() {
  for (const n of visibleCanvas().nodes.filter((n) => noteCount(n) > 0)) {
    const b = noteBadge(n);
    ctx.save();
    ctx.translate(b.x, b.y);
    const active = notesNodeId === n.id;
    ctx.fillStyle = active ? "#e6def7" : "#fff";
    ctx.strokeStyle = active ? "#78618f" : "#95959e";
    ctx.lineWidth = active ? 2 : 1;
    ctx.shadowColor = active ? "#78618f66" : "#00000024";
    ctx.shadowBlur = (active ? 8 : 5) * view.z;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.roundRect(0, 0, b.w, 24, 7);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.stroke();
    // Speech bubble and count are one clickable target.
    ctx.strokeStyle = "#42424a";
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.moveTo(8, 6);
    ctx.lineTo(18, 6);
    ctx.quadraticCurveTo(20, 6, 20, 8);
    ctx.lineTo(20, 14);
    ctx.quadraticCurveTo(20, 16, 18, 16);
    ctx.lineTo(12, 16);
    ctx.lineTo(8, 19);
    ctx.lineTo(8, 16);
    ctx.quadraticCurveTo(6, 16, 6, 14);
    ctx.lineTo(6, 8);
    ctx.quadraticCurveTo(6, 6, 8, 6);
    ctx.stroke();
    ctx.fillStyle = "#42424a";
    ctx.font = '500 11px "Google Sans"';
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(String(b.count), 26, 12);
    ctx.restore();
  }
}
function hitNoteBadge(p) {
  return [...visibleCanvas().nodes].reverse().find((n) => {
    if (!noteCount(n)) return false;
    const b = noteBadge(n),
      pad = 2 / view.z;
    return (
      p.x >= b.x - pad &&
      p.x <= b.x + b.w + pad &&
      p.y >= b.y - pad &&
      p.y <= b.y + b.h + pad
    );
  });
}
