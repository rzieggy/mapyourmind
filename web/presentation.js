"use strict";
// Only this graph is navigated during a presentation. state never contains it.
function navigateBranches(fn, relayout = true) {
  if (!viewOnly) return mutate(fn, relayout);
  const before = M.clone(d());
  fn();
  if (relayout) M.layoutChanged(d(), before);
  refreshFind(); render(); inspect();
}
// The Pointer tool (P) is the only way into this mode: nothing can be selected
// or edited, the pointer leaves a fading trail, and Esc or P leaves it.
function syncPresentationUI() {
  document.body.classList.toggle("view-only", viewOnly);
  for (const b of $("toolbar").querySelectorAll("button[data-tool]"))
    b.classList.toggle("active", viewOnly ? b.dataset.tool === "pointer" : b.dataset.tool === tool);
  $("toolbar").querySelector('[data-tool="pointer"]').setAttribute("aria-pressed", String(viewOnly));
  $("laserCanvas").hidden = !viewOnly || !laserActive;
  $("sidebarNewDocument").disabled = $("sidebarNewFolder").disabled = viewOnly || documentSwitchPending;
  $("openSettings").disabled = viewOnly;
  $("contextHint").textContent = viewOnly
    ? "Pointer · Hold and drag to draw · Space-drag to pan · Esc or P to stop"
    : "Select and move · Shift to multi-select · Space to pan";
  canvas.style.cursor = tool === "hand" || space ? "grab" : laserActive ? "none" : "default";
}
function setViewOnly(enabled) {
  enabled = !!enabled;
  if (enabled === viewOnly || (enabled && (!current || isNotebook() || $("modal").open))) return;
  if (editing) commitEdit();
  cancelDrag(); cancelStickerPlacement(); closeContextMenu(); closeDocMenu();
  $("shapePicker").hidden = $("stickerDropdown").hidden = true;
  $("addSticker").setAttribute("aria-expanded", "false");
  notesNodeId = null; $("notesPanel").hidden = true;
  // Clone after finishing edits. Saves/quit keep reading the persistent original.
  presentationCanvas = enabled ? M.clone(current.canvas) : null;
  viewOnly = enabled;
  laserActive = false; clearLaser();
  space = spaceTap = false;
  setTool("select");
  const visible = M.visible(d()), ids = new Set([...visible.nodes, ...visible.edges].map(a => a.id));
  selected = new Set([...selected].filter(id => ids.has(id)));
  refreshFind(); syncPresentationUI(); inspect(); resize(); canvas.focus();
}
function setPointer(enabled) {
  setViewOnly(enabled);
  laserActive = viewOnly;
  clearLaser(); syncPresentationUI();
}

let laserActive = false, laserCursor = null, laserDrawing = false,
  laserPoints = [], laserFrame = 0, laserStroke = 0;
const laserCanvas = $("laserCanvas"), laserContext = laserCanvas.getContext("2d"), laserLifetime = 800;
function clearLaser() {
  cancelAnimationFrame(laserFrame); laserFrame = 0;
  laserCursor = null; laserDrawing = false; laserPoints = [];
  laserContext.clearRect(0, 0, laserCanvas.width, laserCanvas.height);
}
function toggleLaser() { setPointer(!viewOnly); }
function paintLaser(now = performance.now()) {
  laserFrame = 0;
  const ratio = devicePixelRatio || 1,
    width = Math.round(canvas.clientWidth * ratio), height = Math.round(canvas.clientHeight * ratio);
  if (laserCanvas.width !== width || laserCanvas.height !== height) {
    laserCanvas.width = width; laserCanvas.height = height;
  }
  laserPoints = laserPoints.filter(p => now - p.time < laserLifetime);
  const c = laserContext;
  c.setTransform(ratio, 0, 0, ratio, 0, 0);
  c.clearRect(0, 0, width / ratio, height / ratio);
  if (!viewOnly || !laserActive) return;
  c.lineWidth = 3; c.lineCap = c.lineJoin = "round";
  for (let i = 1; i < laserPoints.length; i++) {
    const a = laserPoints[i - 1], b = laserPoints[i];
    if (a.stroke !== b.stroke) continue;
    c.strokeStyle = `rgba(232,69,69,${Math.max(0, 1 - (now - a.time) / laserLifetime)})`;
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  }
  if (laserCursor) {
    c.fillStyle = "#e84545"; c.shadowColor = "#e8454588"; c.shadowBlur = 10;
    c.beginPath(); c.arc(laserCursor.x, laserCursor.y, 4, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0;
  }
  if (laserPoints.length) laserFrame = requestAnimationFrame(paintLaser);
}
function updateLaser(e, draw = false) {
  laserCursor = screenPoint(e);
  if (draw) {
    laserPoints.push({...laserCursor, time:performance.now(), stroke:laserStroke});
    if (laserPoints.length > 512) laserPoints.splice(0, laserPoints.length - 512);
  }
  cancelAnimationFrame(laserFrame); paintLaser();
}
canvas.addEventListener("pointerdown", e => {
  if (!viewOnly || !laserActive || space || tool === "hand" || e.button !== 0 || e.ctrlKey) return;
  e.preventDefault(); e.stopImmediatePropagation();
  canvas.focus(); laserDrawing = true; laserStroke++;
  updateLaser(e, true);
  if (e.isTrusted) canvas.setPointerCapture(e.pointerId);
}, true);
canvas.addEventListener("pointermove", e => {
  if (!viewOnly || !laserActive) return;
  if (space || drag?.type === "pan" || tool === "hand") {
    laserCursor = null; laserDrawing = false;
    cancelAnimationFrame(laserFrame); paintLaser(); return;
  }
  updateLaser(e, laserDrawing);
}, true);
canvas.addEventListener("pointerup", e => {
  if (!laserDrawing) return;
  e.preventDefault(); e.stopImmediatePropagation();
  updateLaser(e, true); laserDrawing = false;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
}, true);
canvas.addEventListener("pointerleave", () => {
  laserCursor = null;
  cancelAnimationFrame(laserFrame); paintLaser();
});
canvas.addEventListener("pointercancel", clearLaser);
window.addEventListener("blur", clearLaser);
document.addEventListener("visibilitychange", () => { if (document.hidden) clearLaser(); });
document.addEventListener("keydown", e => {
  if (!viewOnly || e.key !== "Escape" || e.isComposing || $("modal").open ||
      document.activeElement?.closest("input,textarea,select,[contenteditable]")) return;
  e.preventDefault(); e.stopImmediatePropagation(); setPointer(false);
}, true);
