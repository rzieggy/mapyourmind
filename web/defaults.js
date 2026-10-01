"use strict";
// Defaults for new elements. A style is made the default from the style panel
// with "Set as default", and reviewed or reset in the panel ⌘, opens. They
// live in preferences.json beside the document store, never in a document, and
// the model checks every value before using it.
const defaultEntries = [
  ["process", "Rectangle", "rectangles"],
  ["decision", "Decision", "decisions"],
  ["pill", "Start / end", "Start / end shapes"],
  ["note", "Note", "notes"],
  ["circle", "Circle", "circles"],
  ["io", "Input / output", "input / output shapes"],
  ["mindRoot", "Mind-map root", "mind-map roots"],
  ["connector", "Connector", "connectors"],
];
const defaultPlural = Object.fromEntries(defaultEntries.map(([key, , plural]) => [key, plural]));
async function saveDefaults(next) {
  M.setDefaults(next);
  try {
    await native("savePreferences", { preferences: M.getDefaults() });
  } catch (e) {
    toast(e.message);
  }
}
// A preview is drawn with the canvas's own renderer, so it shows exactly what
// a new element will look like.
function drawDefaultPreview(holder, entry) {
  const c = document.createElement("canvas"),
    ratio = devicePixelRatio || 1,
    w = 112,
    h = 52;
  c.width = w * ratio;
  c.height = h * ratio;
  c.style.width = w + "px";
  c.style.height = h + "px";
  // Drawn at 60% so text sits in its shape at its real size.
  const g = c.getContext("2d"),
    scale = 0.6,
    W = w / scale,
    H = h / scale;
  g.scale(ratio * scale, ratio * scale);
  if (entry === "connector") {
    const doc = M.blank();
    for (const x of [4, W - 5]) doc.nodes.push({ ...M.node("flow", x, H / 2, "process"), w: 1, h: 1 });
    const e = M.connect(doc, doc.nodes[0].id, doc.nodes[1].id, { fromSide: "right", toSide: "left" });
    drawEdge(g, e, doc);
  } else {
    const n = M.node(entry === "mindRoot" ? "mind" : "flow", 0, 0, entry === "mindRoot" ? "process" : entry, "Aa");
    const size = n.shape === "circle" ? H - 6 : 0;
    Object.assign(n, { id: "preview-" + entry + M.uid(), x: size ? (W - size) / 2 : 8, y: 3, w: size || W - 16, h: H - 6 });
    drawNode(g, n);
  }
  holder.replaceChildren(c);
}
function defaultsPanel() {
  // Reset redraws the open panel in place.
  if ($("modal").open) closeModal();
  const chosen = M.getDefaults(),
    after = chosen.afterTerminator || "process";
  showModal(
    `<h2>Defaults for new elements</h2><p>Review or reset saved creation styles here. Tab and Enter inherit flowchart styles; new mind-map children use text.</p>
    <label class="defaults-after">After Start / end<select id="afterTerminatorChoice">${shapeLabels
      .map(([key, , label]) => `<option value="${key}"${key === after ? " selected" : ""}>${label}</option>`)
      .join("")}</select></label>
    <div class="defaults-list">${defaultEntries
      .map(
        ([key, label]) =>
          `<div class="defaults-row"><span class="defaults-preview" data-preview="${key}"></span><span class="defaults-name">${label}<small>${chosen[key] ? "Custom" : "Built-in"}</small></span>${
            chosen[key] ? `<button data-reset="${key}">Reset</button>` : ""
          }</div>`,
      )
      .join("")}</div>
    <div class="actions"><button id="resetDefaults" class="secondary"${Object.keys(chosen).length ? "" : " disabled"}>Reset all</button><button data-close class="primary">Done</button></div>`,
  );
  for (const holder of $("modalBody").querySelectorAll("[data-preview]"))
    drawDefaultPreview(holder, holder.dataset.preview);
  $("afterTerminatorChoice").onchange = async (e) => {
    const next = { ...M.getDefaults(), afterTerminator: e.target.value };
    if (next.afterTerminator === "process") delete next.afterTerminator;
    await saveDefaults(next);
  };
  for (const b of $("modalBody").querySelectorAll("[data-reset]"))
    b.onclick = async () => {
      const next = M.getDefaults();
      delete next[b.dataset.reset];
      await saveDefaults(next);
      defaultsPanel();

    };
  $("resetDefaults").onclick = async () => {
    await saveDefaults({});
    defaultsPanel();

  };
}
