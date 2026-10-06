"use strict";
function visibleCanvas() {
  return M.visible(d());
}
function measureDistances(box, others, limit = Infinity) {
  const nearest = new Map();
  const add = (side, axis, from, to, cross) => {
    const gap = Math.abs(to - from);
    if (gap > limit || nearest.has(side) && nearest.get(side).gap <= gap) return;
    nearest.set(side, {side, axis, from, to, cross, gap});
  };
  for (const other of others) {
    const top = Math.max(box.y, other.y), bottom = Math.min(box.y + box.h, other.y + other.h);
    const left = Math.max(box.x, other.x), right = Math.min(box.x + box.w, other.x + other.w);
    if (top < bottom) {
      if (other.x >= box.x + box.w) add("right", "x", box.x + box.w, other.x, (top + bottom) / 2);
      if (other.x + other.w <= box.x) add("left", "x", other.x + other.w, box.x, (top + bottom) / 2);
    }
    if (left < right) {
      if (other.y >= box.y + box.h) add("bottom", "y", box.y + box.h, other.y, (left + right) / 2);
      if (other.y + other.h <= box.y) add("top", "y", other.y + other.h, box.y, (left + right) / 2);
    }
  }
  for (const [a, b] of [["left", "right"], ["top", "bottom"]]) {
    if (nearest.has(a) && nearest.has(b) && Math.abs(nearest.get(a).gap - nearest.get(b).gap) < 0.5)
      nearest.get(a).equal = nearest.get(b).equal = true;
  }
  return [...nearest.values()];
}
function moveAlignmentGuides(box, others, threshold) {
  const guides = new Map();
  for (const axis of ["x", "y"]) {
    const size = axis === "x" ? "w" : "h";
    let best = threshold;
    for (const other of others) for (const a of [0, 0.5, 1]) for (const b of [0, 0.5, 1]) {
      const value = other[axis] + other[size] * b, delta = Math.abs(box[axis] + box[size] * a - value);
      if (delta < best) { best = delta; guides.set(axis, {axis, value}); }
    }
  }
  return [...guides.values()];
}
function drawDistanceGuides() {
  if (!distanceGuides.length) return;
  ctx.save(); ctx.setLineDash([]); ctx.lineWidth = 1 / view.z;
  ctx.strokeStyle = "#2474d0"; ctx.font = `${11 / view.z}px "Google Sans"`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const g of distanceGuides) {
    const x = g.axis === "x" ? (g.from + g.to) / 2 : g.cross;
    const y = g.axis === "y" ? (g.from + g.to) / 2 : g.cross;
    const text = `${Math.round(g.gap * 10) / 10} px${g.equal ? " =" : ""}`;
    ctx.beginPath();
    for (const at of [g.from, g.to]) {
      if (g.axis === "x") { ctx.moveTo(at, g.cross - 4 / view.z); ctx.lineTo(at, g.cross + 4 / view.z); }
      else { ctx.moveTo(g.cross - 4 / view.z, at); ctx.lineTo(g.cross + 4 / view.z, at); }
    }
    if (g.axis === "x") { ctx.moveTo(g.from, g.cross); ctx.lineTo(g.to, g.cross); }
    else { ctx.moveTo(g.cross, g.from); ctx.lineTo(g.cross, g.to); }
    ctx.stroke();
    const width = ctx.measureText(text).width + 8 / view.z;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(x - width / 2, y - 9 / view.z, width, 18 / view.z);
    ctx.fillStyle = "#2474d0"; ctx.fillText(text, x, y);
  }
  ctx.restore();
}
function curveDistance(e, g) {
  // Keep controls inside the gap between depth columns; never double back.
  if (e.tree)
    return Math.max(
      1,
      (g.sa === "bottom" ? Math.abs(g.q.y - g.p.y) : Math.abs(g.q.x - g.p.x)) *
        0.48,
    );
  return Math.max(
    32,
    Math.min(90, Math.hypot(g.q.x - g.p.x, g.q.y - g.p.y) * 0.35),
  );
}
function collapsedBadge(n, doc = d()) {
  if (!n.collapsed || n.kind !== "mind") return null;
  const count = M.subtree(doc, n.id).size - 1;
  if (!count) return null;
  const vertical = M.treeDirection(doc, n) === "vertical",
    width = Math.max(32, String(count).length * 11 + 16);
  return {
    x: vertical ? n.x + n.w / 2 - width / 2 : n.x + n.w + 18,
    y: vertical ? n.y + n.h + 18 : n.y + n.h / 2 - 14,
    w: width,
    h: 28,
    count,
    vertical,
  };
}
function drawCollapsedBadge(c, n) {
  const b = collapsedBadge(n);
  if (!b) return;
  c.save();
  c.strokeStyle = "#78618f";
  c.lineWidth = 2;
  c.beginPath();
  if (b.vertical) {
    c.moveTo(n.x + n.w / 2, n.y + n.h);
    c.lineTo(n.x + n.w / 2, b.y);
  } else {
    c.moveTo(n.x + n.w, n.y + n.h / 2);
    c.lineTo(b.x, b.y + 14);
  }
  c.stroke();
  c.fillStyle = "#e6def7";
  c.beginPath();
  c.roundRect(b.x, b.y, b.w, b.h, 14);
  c.fill();
  c.fillStyle = "#453453";
  c.font = "17px Excalifont";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(String(b.count), b.x + b.w / 2, b.y + 14);
  c.restore();
}
function toggleCollapse(n) {
  if (!M.children(d(), n.id).length) return;
  if (editing) commitEdit();
  navigateBranches(() => {
    n.collapsed = !n.collapsed;
    selected = new Set([n.id]);
    hoveredNode = null;
  });
}
// Space on a selection: if any selected branch is open they all close,
// otherwise they all open. Selected nodes that end up hidden are deselected.
function toggleSelectedBranches() {
  const ns = d().nodes.filter((n) => selected.has(n.id) && M.children(d(), n.id).length);
  if (!ns.length) return false;
  const collapse = ns.some((n) => !n.collapsed);
  navigateBranches(() => {
    for (const n of ns) n.collapsed = collapse;
    const shown = M.visible(d()),
      ids = new Set([...shown.nodes, ...shown.edges].map((a) => a.id));
    selected = new Set([...selected].filter((id) => ids.has(id)));
    hoveredNode = null;
  });
  return true;
}
const contextMenu = document.getElementById("nodeContextMenu");
function clearCanvasNativeSelection() {
  const selection = getSelection();
  if (!selection?.rangeCount) return;
  for (let i = 0; i < selection.rangeCount; i++) {
    try {
      if (selection.getRangeAt(i).intersectsNode(canvas)) {
        selection.removeAllRanges();
        return;
      }
    } catch {}
  }
}
function placeContextMenu(e) {
  contextMenu.hidden = false;
  contextMenu.style.left = Math.max(8, Math.min(e.clientX, innerWidth - contextMenu.offsetWidth - 8)) + "px";
  contextMenu.style.top = Math.max(8, Math.min(e.clientY, innerHeight - contextMenu.offsetHeight - 8)) + "px";
}
function appendContextActions(ids) {
  for (const action of commandCatalog().filter(a => ids.includes(a.id))) {
    const button = document.createElement("button");
    button.role = "menuitem";
    button.dataset.context = action.id;
    button.textContent = action.label;
    button.onclick = async () => {
      closeContextMenu();
      try { await action.run(); } catch (error) { toast(error.message); }
    };
    contextMenu.append(button);
  }
}
function arrangeSelectedTree(n) {
  mutate(() => M.tidy(d(), [M.treeRoot(d(), n).id]));
  toast("Tree arranged. Manual positions reset.");
}
function closeContextMenu() {
  contextMenu.hidden = true;
  clearCanvasNativeSelection();
}
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  clearCanvasNativeSelection();
  requestAnimationFrame(clearCanvasNativeSelection);
  if (editing) commitEdit();
  const p = point(e),
    n = hitNode(p);
  if (viewOnly) {
    const hit = n || hitEdge(p);
    if (hit && !selected.has(hit.id)) selected = new Set([hit.id]);
    contextMenu.replaceChildren();
    appendContextActions(hit ? ["copy", "fit"] : ["fit"]);
    if (n && M.children(d(), n.id).length) {
      const button = document.createElement("button");
      button.role = "menuitem"; button.dataset.context = "collapse";
      button.textContent = n.collapsed ? "Expand branch" : "Collapse branch";
      button.onclick = () => { closeContextMenu(); toggleCollapse(n); };
      contextMenu.prepend(button);
    }
    inspect(); render(); placeContextMenu(e); contextMenu.querySelector("button")?.focus(); return;
  }
  if (!n) {
    const edge = hitEdge(p);
    if (!edge) {
      contextMenu.replaceChildren();
      appendContextActions(["paste", "fit"]);
      const all = document.createElement("button");
      all.role = "menuitem"; all.textContent = "Select all";
      all.onclick = () => { closeContextMenu(); window.appCommand("all"); };
      contextMenu.append(all);
      placeContextMenu(e); contextMenu.querySelector("button").focus();
      return;
    }
    if(!selected.has(edge.id))selected = new Set([edge.id]);
    inspect();
    render();
    contextMenu.innerHTML =
      `<button role="menuitem" data-context="label">${edge.label ? "Edit" : "Add"} label</button>` +
      (edge.bend
        ? '<button role="menuitem" data-context="straighten">Reset connector shape</button>'
        : "") +
      (edge.label
        ? '<button role="menuitem" data-context="centreLabel">Centre label</button><button role="menuitem" data-context="clearLabel">Remove label</button>'
        : "");
    appendContextActions(["copy", "cut", "duplicate", "delete", "edge-straight", "edge-curved", "edge-elbow", "edge-arrow"]);
    placeContextMenu(e);
    contextMenu.querySelector('[data-context="label"]').onclick = () => {
      closeContextMenu();
      editEdgeLabel(edge);
    };
    const straighten = contextMenu.querySelector('[data-context="straighten"]');
    if (straighten)
      straighten.onclick = () => {
        closeContextMenu();
        mutate(() => delete edge.bend);
      };
    const centre = contextMenu.querySelector('[data-context="centreLabel"]');
    if (centre)
      centre.onclick = () => {
        closeContextMenu();
        mutate(() => delete edge.labelT);
      };
    const clear = contextMenu.querySelector('[data-context="clearLabel"]');
    if (clear)
      clear.onclick = () => {
        closeContextMenu();
        mutate(() => {
          delete edge.label;
          delete edge.labelMarks;
          delete edge.labelT;
        });
      };
    contextMenu.querySelector("button").focus();
    return;
  }
  if(!selected.has(n.id))selected = new Set([n.id]);
  inspect();
  render();
  // Only a tree's source node carries its layout direction.
  const source = n.kind === "mind" && !n.parent && M.subtree(d(), n.id).size > 1;
  const direction = source ? M.treeDirection(d(), n) : null;
  contextMenu.innerHTML =
    (source
      ? `<button role="menuitem" data-direction="horizontal"${direction === "horizontal" ? ' aria-current="true"' : ""}>Lay out horizontally →</button><button role="menuitem" data-direction="vertical"${direction === "vertical" ? ' aria-current="true"' : ""}>Lay out vertically ↓</button>`
      : "") +
    '<button role="menuitem" data-context="comment">Comment</button>' +
    (!n.attachmentTo ? '<button role="menuitem" data-context="placeholder">Add placeholder</button>' : '') +
    (M.children(d(), n.id).length
      ? `<button role="menuitem" data-context="collapse">${n.collapsed ? "Expand" : "Collapse"} branch</button>`
      : "") +
    (n.kind === "mind" ? '<button role="menuitem" data-context="arrange">Arrange tree</button>' : "");
  appendContextActions(["copy", "cut", "duplicate", "delete", "child", "sibling", "group", "ungroup", "layer-front", "layer-forward", "layer-backward", "layer-back", "align-left", "align-center", "align-right", "align-top", "align-middle", "align-bottom", "align-horizontal", "align-vertical"]);
  placeContextMenu(e);
  for (const button of contextMenu.querySelectorAll("[data-direction]"))
    button.onclick = () => {
      closeContextMenu();
      setTreeDirection(n.id, button.dataset.direction);
    };
  const placeholder = contextMenu.querySelector('[data-context="placeholder"]');
  if (placeholder) placeholder.onclick = () => { closeContextMenu(); addPlaceholder(n.id); };
  contextMenu.querySelector('[data-context="comment"]').onclick = () => {
    closeContextMenu();
    openNotes(n.id);
  };
  const arrange = contextMenu.querySelector('[data-context="arrange"]');
  if (arrange) arrange.onclick = () => { closeContextMenu(); arrangeSelectedTree(n); };
  const collapse = contextMenu.querySelector('[data-context="collapse"]');
  if (collapse)
    collapse.onclick = () => {
      closeContextMenu();
      toggleCollapse(n);
    };
  contextMenu.querySelector("button").focus();
});
canvas.addEventListener("selectstart", (e) => e.preventDefault());
document.addEventListener(
  "pointerdown",
  (e) => {
    if (!contextMenu.hidden && !contextMenu.contains(e.target)) {closeContextMenu();e.preventDefault();e.stopImmediatePropagation();}
  },
  true,
);
canvas.addEventListener(
  "pointerdown",
  (e) => {
    if (space || (viewOnly && laserActive)) return;
    if (e.button !== 0 || e.ctrlKey) {
      e.stopImmediatePropagation();
      return;
    }
    const p = point(e),
      n = visibleCanvas().nodes.find((n) => {
        const b = collapsedBadge(n);
        return (
          b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h
        );
      });
    if (n) {
      e.preventDefault();
      e.stopImmediatePropagation();
      toggleCollapse(n);
    }
  },
  true,
);
contextMenu.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();e.stopPropagation();
    closeContextMenu();
    canvas.focus();
  }
  if (["ArrowDown", "ArrowUp"].includes(e.key)) {
    e.preventDefault();
    const buttons = [...contextMenu.querySelectorAll("button")],
      index = buttons.indexOf(document.activeElement);
    buttons[
      (index + (e.key === "ArrowDown" ? 1 : buttons.length - 1)) %
        buttons.length
    ].focus();
  }
});
let highlightColor = "#fff0a6";
function applyTextAlignment(alignment) {
  if (viewOnly || !current || !["left", "center", "right"].includes(alignment)) return;
  if (editing) {
    const n = elementByID(editing.id), offsets = editorOffsets();
    if (!n || n.kind === "label") return;
    readRichEditor(n);
    n.textAlign = alignment;
    richEditorLoad(n, false);
    positionEditor(); richEditor.focus(); setEditorSelection(...offsets);
    changed(); inspect(); render();
  } else styleSelection("textAlign", alignment);
}
function applyTextFormat(property, value) {
  if (!current || viewOnly) return;
  if (editing) {
    const n = elementByID(editing.id);
    if (!n) return;
    const [a, b] = editorOffsets();
    readRichEditor(n);
    formatRange(
      n,
      a === b ? 0 : a,
      a === b ? n.text.length : b,
      property,
      value,
    );
    richRecord(n);
    richEditorLoad(n, false);
    richEditor.focus();
    setEditorSelection(a, b);
    autoSize(n);
    M.layout(d());
    positionEditor();
    changed();
    render();
  } else
    mutate(() => {
      for (const n of d().nodes.filter(
        (n) => selected.has(n.id) && n.kind !== "image",
      )) {
        formatRange(n, 0, n.text.length, property, value);
        autoSize(n);
      }
      for (const e of d().edges.filter((e) => selected.has(e.id) && e.label)) {
        const label = edgeLabel(e);
        if (label) formatRange(label, 0, label.text.length, property, value);
      }
    });
}
async function featureCommand(command) {
  if (!["comment", "bold", "underline", "highlight"].includes(command))
    return false;
  if (!current || $("modal").open) return true;
  const active = document.activeElement;
  if (
    active !== richEditor &&
    (active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement)
  )
    return false;
  if (command === "comment") {
    const n =
      d().nodes.find((n) => n.id === editing?.id) ||
      d().nodes.find((n) => selected.has(n.id));
    if (n) openNotes(n.id);
    else toast("Select a node to add a comment.");
  } else if (command === "highlight") {
    const n =
      d().nodes.find((n) => n.id === editing?.id) ||
      d().nodes.find((n) => selected.has(n.id));
    if (n) {
      const [a, b] = editing ? editorOffsets() : [0, n.text.length];
      const start = a === b ? 0 : a,
        end = a === b ? n.text.length : b;
      const all = Array.from(
        { length: end - start },
        (_, i) => markAt(n, start + i).highlight === highlightColor,
      ).every(Boolean);
      applyTextFormat("highlight", all ? false : highlightColor);
    }
  } else applyTextFormat(command);
  return true;
}
document.addEventListener(
  "keydown",
  (e) => {
    if (isNotebook() || e.isComposing || !(e.metaKey || e.ctrlKey)) return;
    if (e.shiftKey && !e.altKey && ["l", "e", "r"].includes(e.key.toLowerCase()) && !$("modal").open &&
        (document.activeElement === richEditor || !document.activeElement?.closest("input,textarea,select,[contenteditable]"))) {
      e.preventDefault(); e.stopImmediatePropagation();
      applyTextAlignment({l: "left", e: "center", r: "right"}[e.key.toLowerCase()]);
      return;
    }
    const key = e.key.toLowerCase(),
      command =
        e.altKey && key === "c"
          ? "comment"
          : { b: "bold", u: "underline", h: "highlight" }[key];
    if (command && current) {
      e.preventDefault();
      e.stopImmediatePropagation();
      window.appCommand(command);
    }
  },
  true,
);
for (const button of document.querySelectorAll("[data-format]")) {
  button.onpointerdown = (e) => e.preventDefault();
  button.onclick = () => window.appCommand(button.dataset.format);
}
for (const color of [
  "#fff0a6",
  "#e6def7",
  "#dbe4ff",
  "#d3f9d8",
  "#ffe3e3",
  "#e9ecef",
]) {
  const button = document.createElement("button");
  button.className = "swatch";
  button.style.background = color;
  button.title = "Highlight " + color;
  button.setAttribute("aria-label", button.title);
  button.onpointerdown = (e) => e.preventDefault();
  button.onclick = () => {
    highlightColor = color;
    applyTextFormat("highlight", color);
  };
  $("highlightColors").append(button);
}
// No highlight comes first and takes the highlight off; it is never stored as a colour.
{
  const button = document.createElement("button");
  button.className = "swatch transparent";
  button.dataset.color = "transparent";
  button.title = "No highlight";
  button.setAttribute("aria-label", button.title);
  button.onpointerdown = (e) => e.preventDefault();
  button.onclick = () => applyTextFormat("highlight", false);
  $("highlightColors").prepend(button);
}
$("highlightColors").parentElement.append(
  customSwatch(
    "Custom highlight colour",
    (value) => {
      highlightColor = value;
      applyTextFormat("highlight", value);
    },
    "highlightCustom",
  ),
);
const imageCache = new Map();
function loadImageNode(n) {
  if (imageCache.has(n.imageData)) return imageCache.get(n.imageData).promise;
  const img = new Image(),
    item = { img, promise: null };
  item.promise = new Promise((resolve, reject) => {
    img.onload = () => {
      resolve(img);
      render();
    };
    img.onerror = () => reject(Error("This image could not be loaded."));
  });
  imageCache.set(n.imageData, item);
  img.src = n.imageData;
  return item.promise;
}
function drawImageNode(c, n) {
  const item = imageCache.get(n.imageData);
  if (item?.img.complete && item.img.naturalWidth)
    c.drawImage(item.img, n.x, n.y, n.w, n.h);
  else {
    loadImageNode(n).catch((e) => toast(e.message));
    c.save();
    c.fillStyle = "#f1f1f1";
    c.fillRect(n.x, n.y, n.w, n.h);
    c.restore();
  }
  if (n.stroke && n.stroke !== "transparent") {
    c.save();
    c.translate(n.x, n.y);
    roughCanvas(c).draw(sketchShape({ ...n, shape: "process", fill: "transparent" }));
    c.restore();
  }
}
function addPlaceholder(id) {
  if (editing) commitEdit();
  const before = M.clone(d()), n = M.placeholder(d(), id);
  if (!n) return;
  selected = new Set([n.id]);
  notesNodeId = null;
  autoSize(n);
  M.layout(d());
  beginEdit(n, { before, newElement: true });
}
function drawSticker(c, n) {
  c.save();
  c.font = `${Math.min(n.w, n.h) * 0.8}px "Apple Color Emoji"`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(n.text || "⭐", n.x + n.w / 2, n.y + n.h / 2, n.w);
  c.restore();
}
function insertSticker(text, position = null) {
  if (viewOnly) return;
  const n = M.node("sticker", position ? position.x - 16 : (canvas.clientWidth / 2 - view.x) / view.z - 16, position ? position.y - 16 : (canvas.clientHeight / 2 - view.y) / view.z - 16, "process", text);
  n.w = n.h = 32;
  // Repeated picks stay visible instead of stacking on the same center point.
  let slot = 0;
  const origin = {x: n.x, y: n.y};
  while (!position && d().nodes.some(a => a.kind === "sticker" && M.overlap(n, a)) && slot < 200) {
    slot++;
    n.x = origin.x + (slot % 5) * 40;
    n.y = origin.y + Math.floor(slot / 5) * 40;
  }
  mutate(() => { d().nodes.push(n); selected = new Set([n.id]); });
  setTool("select");
  return n;
}
let pendingSticker = null;
function cancelStickerPlacement() {
  pendingSticker = null;
}
function startStickerPlacement(text) {
  if (viewOnly) return;
  if (!current || isNotebook()) return;
  if (editing) commitEdit();
  setTool("select");
  toggleStickerDropdown(false);
  pendingSticker = {text, visible: false};
  selected.clear(); inspect(); canvas.focus();
  canvas.style.cursor = "crosshair";
  $("contextHint").textContent = "Click to place sticker · Escape to cancel · Space to pan";
  render();
}
function drawStickerPreview() {
  if (!pendingSticker?.visible) return;
  const p = point(pendingSticker);
  ctx.save(); ctx.globalAlpha = 0.65;
  drawSticker(ctx, {text: pendingSticker.text, x: p.x - 16, y: p.y - 16, w: 32, h: 32});
  ctx.restore();
}
canvas.addEventListener("pointermove", e => {
  if (!pendingSticker) return;
  Object.assign(pendingSticker, {clientX:e.clientX, clientY:e.clientY, visible:true});
  if (!drag) { e.stopImmediatePropagation(); canvas.style.cursor = space ? "grab" : "crosshair"; }
  render();
}, true);
canvas.addEventListener("pointerleave", () => {
  if (pendingSticker) { pendingSticker.visible = false; render(); }
});
canvas.addEventListener("pointerdown", e => {
  if (!pendingSticker || e.button !== 0 || e.ctrlKey || space) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const text = pendingSticker.text, p = point(e);
  cancelStickerPlacement(); insertSticker(text, p); canvas.focus();
}, true);
document.addEventListener("keydown", e => {
  if (e.key !== "Escape" || e.isComposing || $("modal").open) return;
  if (pendingSticker || !$("stickerDropdown").hidden) {
    e.preventDefault(); e.stopImmediatePropagation();
    cancelStickerPlacement(); toggleStickerDropdown(false); setTool("select"); canvas.focus();
  }
}, true);
function positionStickerDropdown() {
  if ($("stickerDropdown").hidden || $("workspace").hidden) return;
  const stage = $("stage").getBoundingClientRect(), button = $("addSticker").getBoundingClientRect();
  // The rail sits on the left, so the dropdown opens to its right, level with the button.
  $("stickerDropdown").style.left = Math.min(button.right - stage.left + 10, stage.width - 240) + "px";
  $("stickerDropdown").style.top = Math.max(8, Math.min(button.top - stage.top - 10, stage.height - 300)) + "px";
}
function toggleStickerDropdown(show = $("stickerDropdown").hidden) {
  if (editing) commitEdit();
  $("stickerDropdown").hidden = !show;
  $("addSticker").setAttribute("aria-expanded", String(show));
  $("addSticker").classList.toggle("active", show);
  positionStickerDropdown();
  if (!show) $("addSticker").focus();
}
$("stickerOptions").innerHTML = ["⭐", "✅", "❌", "💡", "🔥", "🎯", "🚀", "⚠️", "❤️", "👍", "📌", "❓"].map(text => `<button data-sticker="${text}" aria-label="Sticker ${text}">${text}</button>`).join('');
for (const button of $("stickerOptions").querySelectorAll('[data-sticker]')) button.onclick = () => {
  startStickerPlacement(button.dataset.sticker);
};
$("addSticker").onclick = () => toggleStickerDropdown();
$("closeStickerDropdown").onclick = () => toggleStickerDropdown(false);
$("stickerDropdown").addEventListener("keydown", e => {
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); toggleStickerDropdown(false); }
});
function drawReparentPreview() {
  if (drag?.type !== "move" || !hover || hover.mode === "invalid") return;
  const moving = d().nodes.find(n => n.id === drag.id), target = d().nodes.find(n => n.id === hover.id);
  const parent = hover.mode === "parent" ? target : d().nodes.find(n => n.id === target?.parent);
  if (!moving || !parent) return;
  const vertical = M.treeDirection(d(), parent) === "vertical";
  const start = anchor(parent, vertical ? "bottom" : "right");
  const ghost = { ...moving, x: vertical ? moving.x : parent.x + parent.w + 92, y: vertical ? parent.y + parent.h + 80 : moving.y };
  const end = anchor(ghost, vertical ? "top" : "left");
  ctx.save();
  ctx.strokeStyle = "#78618f";
  ctx.fillStyle = "#e6def733";
  ctx.lineWidth = 2 / view.z;
  ctx.setLineDash([6 / view.z, 4 / view.z]);
  ctx.beginPath(); ctx.moveTo(start.x, start.y);
  if (vertical) ctx.bezierCurveTo(start.x, (start.y + end.y)/2, end.x, (start.y + end.y)/2, end.x, end.y);
  else ctx.bezierCurveTo((start.x + end.x)/2, start.y, (start.x + end.x)/2, end.y, end.x, end.y);
  ctx.stroke();
  ctx.fillRect(ghost.x, ghost.y, ghost.w, ghost.h);
  ctx.strokeRect(ghost.x, ghost.y, ghost.w, ghost.h);
  ctx.restore();
  $("contextHint").textContent = `Release to ${hover.mode === "parent" ? "make child of" : "reorder under"} “${parent.text.trim().slice(0, 50) || "Untitled"}”`;
}
async function insertClipboardImage(clip) {
  const n = M.node("image", 0, 0);
  n.imageData = "data:image/png;base64," + clip.image;
  const img = await loadImageNode(n), viewport = usableViewport(true),
    scale = Math.min(1, (viewport.w - 48 / view.z) / img.naturalWidth, (viewport.h - 48 / view.z) / img.naturalHeight);
  n.w = img.naturalWidth * scale;
  n.h = img.naturalHeight * scale;
  insertVisible({ nodes: [n], edges: [] }, "image:" + clip.image);
}

for (const row of document.querySelectorAll(".swatches")) {
  row.setAttribute("role", "group");
  [...row.querySelectorAll("button")].forEach((b, i) => { b.tabIndex = i ? -1 : 0; b.setAttribute("aria-pressed", "false"); });
  row.addEventListener("keydown", e => {
    const buttons = [...row.querySelectorAll("button")], at = buttons.indexOf(document.activeElement);
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    const i = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : (at + (e.key === "ArrowRight" ? 1 : buttons.length - 1)) % buttons.length;
    buttons.forEach((b, j) => b.tabIndex = i === j ? 0 : -1);
    buttons[i].focus(); buttons[i].scrollIntoView({ block: "nearest", inline: "nearest" });
  });
  row.addEventListener("wheel", e => {
    if (e.shiftKey && e.deltaY && !e.deltaX) { e.preventDefault(); row.scrollLeft += e.deltaY; }
  }, { passive: false });
}
