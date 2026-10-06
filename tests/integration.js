const results = [];
const browserErrors=[];window.addEventListener("error",e=>browserErrors.push(e.message));
// A bare message tells us nothing about an intermittent failure, so every
// failure carries the state that was live when it happened.
const failureContext = () => {
  let fonts = "?";
  try {
    fonts = ["Excalifont", "Google Sans", "Comic Shanns"]
      .map((f) => f.split(" ")[0] + (document.fonts.check(`19px "${f}"`) ? "+" : "-"))
      .join("");
  } catch {}
  return [
    "#" + results.length,
    "prev=" + JSON.stringify(results.at(-1) || "none"),
    "fontstatus=" + document.fonts.status,
    "fonts=" + fonts,
    "drag=" + (typeof drag !== "undefined" && drag ? drag.type : "-"),
    "editing=" + (typeof editing !== "undefined" && editing ? "yes" : "-"),
    "sel=" + (typeof selected !== "undefined" ? selected.size : "?"),
    "modal=" + ($("modal").open ? "open" : "-"),
    "tool=" + (typeof tool !== "undefined" ? tool : "?"),
    "doc=" + JSON.stringify(current?.title || "none"),
    "nodes=" + (d()?.nodes.length ?? "-"),
    "zoom=" + (typeof view !== "undefined" ? view.z.toFixed(2) : "?"),
    "strayBlocked=" + strayPointers,
  ].join(" ");
};
const assert = (condition, message) => {
  if (!condition) throw Error(message + " {{ " + failureContext() + " }}");
  results.push(message);
};
// A UI test drives a real window on a real desktop. Two things from outside the
// test can reach it: hardware pointer events, swallowed here, and the window
// losing key focus, which the application opts out of while `uiTest` is set.
// Focus loss was the one that mattered: it commits the open edit through
// flushSave and rolls back the drag in progress.
window.uiTest = true;
let strayPointers = 0;
for (const type of [
  "pointerdown", "pointermove", "pointerup", "pointercancel",
  "mousedown", "mousemove", "mouseup", "click", "dblclick",
  "contextmenu", "wheel",
])
  window.addEventListener(
    type,
    (e) => {
      if (!e.isTrusted) return;
      strayPointers++;
      e.stopImmediatePropagation();
      e.preventDefault();
    },
    true,
  );
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
for (let i = 0; i < 100 && !loaded; i++) await wait(50);
assert(loaded, "Native bridge loads local document store");
await document.fonts.ready;
assert(
  document.fonts.check("25px Excalifont"),
  "Bundled handwritten font loads offline",
);
$("sidebarNewDocument").click();for(let i=0;i<200&&!$("nameInput");i++)await new Promise(r=>setTimeout(r,10));
$("nameInput").value = "Launch plan";
$("nameSubmit").click();
await wait(100);
assert(current.title === "Launch plan", "Create document from the sidebar");
function pointer(type, x, y, extra = {}) {
  const box = canvas.getBoundingClientRect();
  canvas.dispatchEvent(
    new PointerEvent(type, {
      clientX: x * view.z + view.x + box.left,
      clientY: y * view.z + view.y + box.top,
      pointerId: 1,
      bubbles: true,
      button: 0,
      ...extra,
    }),
  );
}
function key(target, key, extra = {}) {
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...extra,
    }),
  );
}
function type(text) {
  $("textEditor").value = text;
  $("textEditor").dispatchEvent(new Event("input"));
}
function create(kind, x, y, text) {
  setTool(kind);
  pointer("pointerdown", x, y);
  pointer("pointerup", x, y);
  type(text);
  key($("textEditor"), "Escape");
}
create("shape", 0, 40, "Start with an idea");
assert(
  d().nodes.length === 1 && d().nodes[0].text === "Start with an idea",
  "Create and edit flowchart node",
);
const root = d().nodes[0];
Object.assign(root,{shape:"io",fill:"transparent",stroke:"#6b4f8a",sw:3,strokeStyle:"dashed",sloppiness:0,fontFamily:"Google Sans",fontSize:27,textColor:"#5b3344",textAlign:"right"});
key(canvas, "Tab");
type("Research users");
key($("textEditor"), "Enter");
type("Ready to launch?");
key($("textEditor"), "Escape");
assert(
  d().nodes.length === 3 && d().edges.length === 2,
  "Tab and Enter extend flowchart",
);
const inheritedStyle=({shape,fill,stroke,sw,strokeStyle,sloppiness,fontFamily,fontSize,textColor,textAlign})=>({shape,fill,stroke,sw,strokeStyle,sloppiness,fontFamily,fontSize,textColor,textAlign});
assert(d().nodes.slice(1,3).every(n=>JSON.stringify(inheritedStyle(n))===JSON.stringify(inheritedStyle(root))),"Flowchart Tab and Enter inherit every node style");
assert(d().edges.every(e=>e.stroke==="#1b1b1f"&&e.sw===1.8&&!e.strokeStyle&&e.sloppiness===undefined),"Flowchart connectors keep independent default styles");
const decision = d().nodes.at(-1);
selected = new Set([decision.id]);
styleSelection("shape", "decision");
styleSelection("fill", "#f9e7b2");
assert(decision.shape === "decision", "Shape and fill styles are editable");
const oldEdge = edgeGeometry(d().edges[0]);
selected = new Set([root.id]);
pointer("pointerdown", root.x + 50, root.y + 25);
pointer("pointermove", root.x + 70, root.y + 45);
pointer("pointerup", root.x + 50, root.y + 25);
await wait(30);
assert(
  edgeGeometry(d().edges[0]).p.x !== oldEdge.p.x,
  "Connectors follow moved endpoints",
);
const prior = M.clone(d());
selected = new Set([decision.id]);
removeSelection();
assert(
  d().nodes.length === 2 && d().edges.length === 1,
  "Delete removes attached connectors",
);
undo();
assert(
  JSON.stringify(d()) === JSON.stringify(prior),
  "Undo restores complete graph",
);
create("mind", 0, 510, "Launch");
const mind = d().nodes.at(-1);
key(canvas, "Tab");
type("Product");
key($("textEditor"), "Tab");
type("Test the main flow");
key($("textEditor"), "Escape");
const leaf = d().nodes.at(-1),
  parent = d().nodes.find((n) => n.id === leaf.parent);
selected = new Set([parent.id]);
key(canvas, "Enter");
type("Messaging");
key($("textEditor"), "Escape");
assert(
  d().nodes.filter((n) => n.kind === "mind").length === 4,
  "Mind map supports three levels and sibling creation",
);
assert(M.validate(d()), "Mixed graph remains acyclic and valid");
selected = new Set([parent.id]);
removeSelection();
assert(
  d().nodes.find((n) => n.id === leaf.id).parent === null,
  "Deleting parent preserves child subtree",
);
undo();
selected = new Set([mind.id]);
await copyEditable();
await pasteEditable();
assert(
  d().nodes.filter((n) => n.kind === "mind").length === 8,
  "Native editable clipboard preserves subtree",
);
undo();
const crossDocumentCanvas = current.canvas,
  crossDocumentView = { ...view },
  crossDocumentPart = M.selection(d(), [mind.id], true);
for (const n of crossDocumentPart.nodes) {
  n.x += 8000;
  n.y -= 6000;
}
await native("clipboardWrite", {
  editable: JSON.stringify({
    format: "local-flowchart-v1",
    ...crossDocumentPart,
  }),
  text: crossDocumentPart.nodes.map((n) => n.text).join("\n"),
});
current.canvas = M.blank();
view = { x: 140, y: 155, z: 1 };
history = new M.History();
selected.clear();
await pasteEditable();
const pastedBounds = M.bounds(d().nodes),
  pastedFrame = usableViewport(true);
assert(
  Math.abs(
    pastedBounds.x + pastedBounds.w / 2 -
      (pastedFrame.x + pastedFrame.w / 2),
  ) < 0.01 &&
    Math.abs(
      pastedBounds.y + pastedBounds.h / 2 -
        (pastedFrame.y + pastedFrame.h / 2),
    ) < 0.01,
  "Cross-document paste centers far-away elements in the visible canvas",
);
current.canvas = crossDocumentCanvas;
view = crossDocumentView;
history = new M.History();
selected = new Set([mind.id]);
render();
create("text", 450, -15, "A simple plan.");
const textNode = d().nodes.at(-1);
beginEdit(textNode);
type("Satu\nDua");
$("textEditor").setSelectionRange(0, 7);
toggleList(false);
assert(
  $("textEditor").value === "• Satu\n• Dua",
  "List formatting applies to selected lines",
);
key($("textEditor"), "Escape");
selected = new Set([textNode.id, root.id]);
grouping();
assert(
  d().nodes.find((n) => n.id === root.id).group ===
    d().nodes.find((n) => n.id === textNode.id).group,
  "Grouping preserves selected elements",
);
grouping(true);
const before = M.clone(d());
selected = new Set([root.id]);
await exportPNG(true, "selection", "transparent", 2);
const image = await native("clipboardProbe");
assert(
  image.png === true && image.alpha === true && image.width > 300,
  "Native PNG clipboard has transparent alpha and expected size",
);
assert(
  JSON.stringify(before) === JSON.stringify(d()),
  "PNG export does not mutate document",
);
await window.flushSave();
const reload = await native("load");
assert(
  reload.state.documents[0].canvas.nodes.length === d().nodes.length,
  "Autosave roundtrip retains canvas",
);
// Exercise additional pointer, selection, export, and document-safety paths.
const snapshot = M.clone(d());
for (const value of ["process", "decision", "pill", "io", "note"]) {
  shape = value;
  create("shape", 1200, 100 + d().nodes.length * 90, "Shape " + value);
  assert(
    d().nodes.at(-1).shape === value,
    "Canvas creates " + value + " shape",
  );
}
const resizeNode = d().nodes.at(-1),
  widthBefore = resizeNode.w;
selected = new Set([resizeNode.id]);
setTool("select");
pointer(
  "pointerdown",
  resizeNode.x + resizeNode.w,
  resizeNode.y + resizeNode.h,
);
pointer(
  "pointermove",
  resizeNode.x + widthBefore + 50,
  resizeNode.y + resizeNode.h + 25,
);
pointer("pointerup", resizeNode.x + resizeNode.w, resizeNode.y + resizeNode.h);
assert(resizeNode.w > widthBefore, "Corner handle resizes a node");
selected = new Set([resizeNode.id]);
const handle = ports(resizeNode).find((p) => p.side === "right"),
  count = d().nodes.length;
pointer("pointerdown", handle.x, handle.y);
pointer("pointermove", handle.x + 250, handle.y);
pointer("pointerup", handle.x + 250, handle.y);
assert(
  !$("shapePicker").hidden,
  "Quick connector opens shape picker on empty drop",
);
$("shapePicker").querySelector("button").click();
key($("textEditor"), "Escape");
assert(d().nodes.length === count, "Empty quick-created node is discarded");
create("text", -400, -300, "你好 👋\nNotes with emoji");
const unicode = d().nodes.at(-1);
assert(
  unicode.text === "你好 👋\nNotes with emoji",
  "Unicode and multiline text are preserved",
);
selected = new Set([unicode.id]);
beginEdit(unicode);
const countBefore = d().nodes.length;
key($("textEditor"), "Backspace");
assert(
  d().nodes.length === countBefore,
  "Backspace while typing never deletes a node",
);
key($("textEditor"), "Escape");
const flowNodes = d()
  .nodes.filter((n) => n.kind === "flow")
  .slice(-3);
selected = new Set(flowNodes.map((n) => n.id));
align("left");
assert(
  flowNodes.every((n) => n.x === flowNodes[0].x),
  "Multi-selection alignment works",
);
align("vertical");
grouping();
setTool("select");
selectNode(flowNodes[0]);
assert(selected.size === 3, "Clicking group selects every grouped shape");
grouping(true);
current.canvas = M.clone(snapshot);
selected.clear();
for (const [scale, background] of [
  [1, "transparent"],
  [2, "white"],
  [3, "transparent"],
]) {
  await exportPNG(true, "all", background, scale);
  const probe = await native("clipboardProbe");
  assert(
    probe.png &&
      ((background === "white" && probe.cornerAlpha === 1) ||
        (background === "transparent" && probe.cornerAlpha === 0)),
    `PNG ${scale}× ${background} has correct background pixels`,
  );
}
// Copying and exporting with no background chosen gives a white image.
await exportPNG(true, "all");
const defaultProbe = await native("clipboardProbe");
assert(
  defaultProbe.png && defaultProbe.cornerAlpha === 1,
  "Copying an image without choosing a background gives a white one",
);
exportDialog();
assert(
  $("exportBg").value === "white" &&
    [...$("exportBg").options].map((o) => o.value).includes("transparent"),
  "The export dialog opens on White and still offers Transparent",
);
closeModal();
// Several elements resize together from one box around the whole selection.
const groupBase = M.bounds(d().nodes);
const wideBox = M.node("flow", groupBase.x, groupBase.y + groupBase.h + 700, "process", "Wide"),
  tallBox = M.node("flow", groupBase.x + 300, groupBase.y + groupBase.h + 700, "process", "Tall"),
  roundOne = M.node("flow", groupBase.x + 600, groupBase.y + groupBase.h + 700, "circle", "Round");
wideBox.w = 240;
tallBox.w = 120;
d().nodes.push(wideBox, tallBox, roundOne);
selected = new Set([wideBox.id, tallBox.id, roundOne.id]);
inspect();
paint();
assert(
  selectionBounds() && Math.abs(selectionBounds().w - M.bounds([wideBox, tallBox, roundOne]).w) < 0.01,
  "A multiple selection gets one box around the whole of it",
);
const groupHandle = boxHandles(selectionBounds()).find((h) => h.side === "r");
assert(
  hitResizeHandle({ x: groupHandle.x, y: groupHandle.y })?.group === true,
  "The selection box offers resize handles, which a multiple selection never had",
);
const startBox = M.clone(selectionBounds()),
  startWidths = [wideBox.w, tallBox.w],
  startGap = tallBox.x - wideBox.x;
pointer("pointerdown", groupHandle.x, groupHandle.y);
assert(drag?.type === "resizeGroup", "Dragging the selection box resizes the whole selection");
pointer("pointermove", groupHandle.x + startBox.w * 0.5, groupHandle.y);
view.z = 1;
view.x = Math.round(canvas.clientWidth / 2 - (startBox.x + startBox.w * 0.75));
view.y = Math.round(canvas.clientHeight / 2 - (startBox.y + startBox.h / 2));
paint();
$("toast").hidden = true;
await wait(150);
await native("snapshot", { name: "group" });
const factor = wideBox.w / startWidths[0];
assert(
  Math.abs(factor - 1.5) < 0.06 &&
    Math.abs(tallBox.w / startWidths[1] - factor) < 0.06,
  `Every selected element takes the same width factor, whatever its own width [factor=${factor.toFixed(3)} tallFactor=${(tallBox.w / startWidths[1]).toFixed(3)} start=${startWidths.join("/")} now=${wideBox.w.toFixed(1)}/${tallBox.w.toFixed(1)} boxW=${startBox.w.toFixed(1)} dragBoxW=${drag ? drag.box.w.toFixed(1) : "-"}]`,
);
assert(
  Math.abs((tallBox.x - wideBox.x) / startGap - factor) < 0.06,
  "The elements keep their spacing relative to the box instead of overlapping",
);
assert(
  Math.abs(roundOne.w - roundOne.h) < 0.01,
  "A circle in the selection stays a circle",
);
pointer("pointerup", groupHandle.x + startBox.w * 0.5, groupHandle.y);
assert(
  wideBox.w > startWidths[0] && M.validate(d()),
  "The group resize is committed as one change",
);
undo();
const restored = d().nodes.find((n) => n.id === wideBox.id);
assert(
  Math.abs(restored.w - startWidths[0]) < 0.01,
  "One undo restores every element in the group",
);
// A single element still resizes on its own handles, not the group box.
selected = new Set([d().nodes.find((n) => n.id === wideBox.id).id]);
assert(
  !selectionBounds() && hitResizeHandle({ x: restored.x + restored.w, y: restored.y + restored.h / 2 })?.group !== true,
  "One selected element still uses its own handles",
);
M.remove(d(), [wideBox.id, tallBox.id, roundOne.id]);
selected.clear();
inspect();
// A shape sent to the back must sit behind the connectors that cross it, and a
// width resize must not collapse a height the user set by hand.
const backdropBase = M.bounds(d().nodes);
const boxA = M.node("flow", backdropBase.x, backdropBase.y + backdropBase.h + 900, "process", "A"),
  boxB = M.node("flow", backdropBase.x + 420, backdropBase.y + backdropBase.h + 900, "process", "B");
d().nodes.push(boxA, boxB);
const crossing = M.connect(d(), boxA.id, boxB.id, { fromSide: "right", toSide: "left" });
crossing.style = "straight";
const backdrop = M.node("flow", boxA.x - 40, boxA.y - 60, "process", "");
backdrop.w = 620;
backdrop.h = 240;
backdrop.fill = "#ffd43b";
d().nodes.push(backdrop);
selected = new Set([backdrop.id]);
mutate(() => M.layer(d(), selected, "back"));
const order = paintOrder(visibleCanvas().nodes, visibleCanvas().edges);
assert(
  order.findIndex((i) => i.node === backdrop) <
    order.findIndex((i) => i.edge === crossing),
  "A shape sent to the back is painted before the connectors crossing it",
);
assert(
  order.findIndex((i) => i.edge === crossing) >
    Math.max(
      order.findIndex((i) => i.node?.id === boxA.id),
      order.findIndex((i) => i.node?.id === boxB.id),
    ),
  "A connector still sits above both of the shapes it joins",
);
selected.clear();
const midOfLine = { x: (boxA.x + boxA.w + boxB.x) / 2, y: boxA.y + boxA.h / 2 };
focusOn(midOfLine);
assert(
  strokeVisible(midOfLine.x, midOfLine.y, 6),
  "The connector is visible where it crosses the shape behind it",
);
view.z = 1;
view.x = Math.round(canvas.clientWidth / 2 - (backdrop.x + backdrop.w / 2));
view.y = Math.round(canvas.clientHeight / 2 - (backdrop.y + backdrop.h / 2));
paint();
$("toast").hidden = true;
await wait(150);
await native("snapshot", { name: "group" });

const tallBoxId = backdrop.id;
selected = new Set([tallBoxId]);
const grip = resizeHandles(backdrop).find((h) => h.side === "b");
pointer("pointerdown", grip.x, grip.y);
pointer("pointermove", grip.x, grip.y + 160);
pointer("pointerup", grip.x, grip.y + 160);
const tallHeight = d().nodes.find((n) => n.id === tallBoxId).h;
assert(tallHeight > 380, "An empty shape can be made tall");
const backdropWidthBefore = d().nodes.find((n) => n.id === tallBoxId).w;
const sideGrip = resizeHandles(d().nodes.find((n) => n.id === tallBoxId)).find((h) => h.side === "r");
pointer("pointerdown", sideGrip.x, sideGrip.y);
pointer("pointermove", sideGrip.x + 120, sideGrip.y);
pointer("pointerup", sideGrip.x + 120, sideGrip.y);
const afterWidth = d().nodes.find((n) => n.id === tallBoxId);
assert(
  Math.abs(afterWidth.h - tallHeight) < 0.01 && afterWidth.w > backdropWidthBefore + 50,
  "Dragging the width leaves the height alone instead of collapsing it",
);
// Typing still grows a shape that is too small for its text.
afterWidth.h = 40;
afterWidth.text = "A much longer label than this little box can hold at once\nA second line needs more height";
autoSize(afterWidth);
assert(afterWidth.h > 40, "Text still grows a shape that cannot hold it");
M.remove(d(), [boxA.id, boxB.id, tallBoxId]);
selected.clear();
// Editing a node must change nothing on screen but the caret: the shape stays,
// the text stays where it was, and there is only ever one copy of it.
const editDemo = M.node("flow", M.bounds(d().nodes).x, M.bounds(d().nodes).y + M.bounds(d().nodes).h + 1100, "pill", "Start of the flow");
editDemo.fill = "#e6def7";
d().nodes.push(editDemo);
autoSize(editDemo);
focusOn({ x: editDemo.x + editDemo.w / 2, y: editDemo.y + editDemo.h / 2 });
const shapeBefore = JSON.stringify(sketchShape(editDemo));
const linesBefore = textLines(ctx, editDemo).map((l) => l);
selected = new Set([editDemo.id]);
beginEdit(editDemo);
const field = getComputedStyle(richEditor);
assert(
  field.backgroundColor === "rgba(0, 0, 0, 0)" &&
    parseFloat(field.borderTopWidth) === 0 &&
    parseFloat(field.borderTopLeftRadius) === 0,
  "The editor has no background, border or corner of its own",
);
assert(
  JSON.stringify(sketchShape(editDemo)) === shapeBefore,
  "The shape is still drawn while its text is edited",
);
// Nothing else is added: no selection frame, no resize handles.
focusOn({ x: editDemo.x + editDemo.w / 2, y: editDemo.y + editDemo.h / 2 });
paint();
assert(
  !strokeVisible(editDemo.x - 5, editDemo.y - 5, 3) &&
    !strokeVisible(editDemo.x + editDemo.w + 5, editDemo.y + editDemo.h + 5, 3),
  "No selection frame is drawn around the node being edited",
);
// One copy of the text: the canvas leaves it to the field.
paint();
assert(
  editing?.id === editDemo.id && !$("textEditor").hidden,
  "The field holds the text while editing",
);
// The field must wrap exactly where the canvas does, for every shape.
for (const shape of ["process", "pill", "decision", "circle", "note", "io"]) {
  editDemo.shape = shape;
  if (shape === "circle") fitCircle(editDemo);
  autoSize(editDemo);
  positionEditor();
  const style = getComputedStyle(richEditor),
    content =
      parseFloat(style.width) -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight) -
      parseFloat(style.borderLeftWidth) -
      parseFloat(style.borderRightWidth);
  assert(
    Math.abs(content / view.z - textWrapWidth(editDemo)) < 0.5,
    `A ${shape} wraps its text at the same width in the field as on the canvas`,
  );
}
editDemo.shape = "pill";
autoSize(editDemo);
positionEditor();
// A brand new node is empty, so the caret is the only thing that says it can be
// typed into. Whether WebKit paints that caret is not something a snapshot can
// settle, so what is asserted here is everything that has to be true for it:
// the field is on screen, it has the keyboard, and the empty line has a box.
const fresh = M.node("flow", editDemo.x, editDemo.y + 400, "pill", "");
d().nodes.push(fresh);
selected = new Set([fresh.id]);
beginEdit(fresh, { before: M.clone(d()), newElement: true });
view.z = 1;
view.x = Math.round(canvas.clientWidth / 2 - (fresh.x + fresh.w / 2));
view.y = Math.round(canvas.clientHeight / 2 - (fresh.y + fresh.h / 2));
positionEditor();
paint();
const caretBox = richEditor.getBoundingClientRect();
assert(
  caretBox.top >= 0 && caretBox.bottom <= innerHeight && caretBox.width > 0,
  "The field for a new node is on screen",
);
assert(
  document.activeElement === richEditor && !richEditor.hidden,
  "A new node takes the keyboard straight away",
);
// The caret needs a text node to sit in, and that filler must never become
// part of the document. Both halves are checked, because only the second one
// can be seen from here.
const anchorNode = getSelection().rangeCount
  ? getSelection().getRangeAt(0).startContainer
  : null;
assert(
  anchorNode && anchorNode.nodeType === Node.TEXT_NODE,
  "The caret in an empty node sits inside a text node, not on an element boundary",
);
assert(
  richEditor.textContent.length === 1 && richEditor.value === "",
  "The filler character is invisible to the document text",
);
type("Typed into an empty node");
assert(
  fresh.text === "Typed into an empty node",
  "Typing into an empty node keeps every character and drops the filler",
);
type("");
commitEdit();
M.remove(d(), [fresh.id]);
selected = new Set([editDemo.id]);
beginEdit(editDemo);
richEditor.select();
paint();
const linesWhileEditing = textLines(ctx, editDemo).map((l) => l);
assert(
  JSON.stringify(linesWhileEditing) === JSON.stringify(linesBefore),
  "The line breaks do not move when editing starts",
);
key($("textEditor"), "Escape");
assert(
  !editing &&
    JSON.stringify(textLines(ctx, d().nodes.find((n) => n.id === editDemo.id))) ===
      JSON.stringify(linesBefore),
  "And they do not move when editing ends",
);
M.remove(d(), [editDemo.id]);
selected.clear();
const temporary = {
  id: "retention-fixture",
  title: "Retention fixture",
  updated: 0,
  trashedAt: 100,
  trashElapsed: 0,
  trashClock: { boot: "test-boot", uptime: 1000, wall: 1000 },
  canvas: M.blank(),
};
state.documents.push(temporary);
updateRetention({ boot: "test-boot", uptime: 2000, wall: 999999999999 });
assert(
  temporary.trashElapsed === 1000,
  "Forward wall-clock jump does not expire recent Trash",
);
state.documents = state.documents.filter(
  (doc) => doc.id !== "retention-fixture",
);
const large = M.blank();
for (let i = 0; i < 500; i++) {
  const n = M.node(
    "flow",
    (i % 25) * 270,
    Math.floor(i / 25) * 145,
    "process",
    "Step " + i,
  );
  large.nodes.push(n);
  if (i % 25) M.connect(large, large.nodes[i - 1].id, n.id);
}
current.canvas = large;
selected.clear();
const renderStart = performance.now();
for (let i = 0; i < 5; i++) {
  view.x -= 10;
  paint();
}
const frameMs = (performance.now() - renderStart) / 5;
assert(frameMs < 300, "500-node canvas pans without prolonged blocking");
const saveStart = performance.now();
await window.flushSave();
const saveMs = performance.now() - saveStart;
assert(saveMs < 2500, "500-node document autosaves promptly");
results.push(
  `Performance: 500 nodes, mean pan render ${Math.round(frameMs)} ms; native autosave ${Math.round(saveMs)} ms`,
);
current.canvas = M.clone(snapshot);
selected.clear();
await window.flushSave();
const v12Snapshot = M.clone(d());
create("mind", -1200, -1000, "Move me");
const movingRoot = d().nodes.at(-1);
key(canvas, "Tab");
type("Move this branch");
key($("textEditor"), "Escape");
const movingChild = d().nodes.at(-1);
key(canvas, "Tab");
type("Descendant");
key($("textEditor"), "Escape");
const movingLeaf = d().nodes.at(-1);
setTool("select");
selected = new Set([movingChild.id]);
const childBefore = { x: movingChild.x, y: movingChild.y },
  leafBefore = { x: movingLeaf.x, y: movingLeaf.y };
pointer("pointerdown", movingChild.x + 30, movingChild.y + 25);
pointer("pointermove", childBefore.x + 100, childBefore.y + 75);
pointer("pointerup", childBefore.x + 100, childBefore.y + 75);
assert(
  movingChild.x === childBefore.x && movingChild.y === childBefore.y,
  "Single mind-map branch snaps to its aligned tree position",
);
assert(
  movingLeaf.x === leafBefore.x && movingLeaf.y === leafBefore.y,
  "Branch drop keeps descendants aligned",
);
M.layout(d());
assert(
  movingChild.x === childBefore.x,
  "Automatic layout stays stable after aligned branch drop",
);
selected = new Set([movingRoot.id, movingLeaf.id]);
const rootBefore = { x: movingRoot.x, y: movingRoot.y },
  leafBeforeMulti = { x: movingLeaf.x, y: movingLeaf.y };
pointer("pointerdown", movingRoot.x + 30, movingRoot.y + 25);
pointer("pointermove", rootBefore.x + 90, rootBefore.y + 100);
pointer("pointerup", rootBefore.x + 90, rootBefore.y + 100);
assert(
  movingRoot.x === rootBefore.x + 60 && movingLeaf.x === leafBeforeMulti.x + 60,
  "Multi-selection drag moves each node once and persists",
);
setTreeDirection(movingRoot.id, "vertical");
assert(
  M.treeDirection(d(), movingRoot) === "vertical" &&
    movingChild.y > movingRoot.y + movingRoot.h,
  "Vertical layout control arranges descendants downward",
);
undo();
assert(
  M.treeDirection(d(), d().nodes.find((n) => n.id === movingRoot.id)) === "horizontal",
  "Layout direction change supports undo",
);
assert(!$("layoutDirection"), "The page-wide layout control is gone");
// The direction lives on the tree's source node, reached by right-clicking it.
function openMenuOn(node) {
  const box = canvas.getBoundingClientRect();
  canvas.dispatchEvent(
    new MouseEvent("contextmenu", {
      clientX: (node.x + node.w / 2) * view.z + view.x + box.left,
      clientY: (node.y + node.h / 2) * view.z + view.y + box.top,
      bubbles: true,
      cancelable: true,
    }),
  );
  return [...$("nodeContextMenu").querySelectorAll("[data-direction]")].map(
    (b) => b.dataset.direction,
  );
}
// Changing a tree's layout must not zoom out to take in the whole canvas.
const farAway = M.node("flow", 9000, 9000, "process", "Far away");
d().nodes.push(farAway);
fit();
const wideZoom = view.z;
M.remove(d(), [farAway.id]);
const liveRoot = d().nodes.find((n) => n.id === movingRoot.id),
  liveChild = d().nodes.find((n) => n.id === movingChild.id);
assert(
  openMenuOn(liveRoot).join() === "horizontal,vertical",
  "Right-clicking a tree's source node offers both layout directions",
);
assert(
  $("nodeContextMenu").querySelector('[data-direction="horizontal"]').getAttribute("aria-current") === "true",
  "The direction the tree is already using is marked",
);
closeContextMenu();
assert(
  openMenuOn(liveChild).length === 0,
  "A child node is not a source node, so it offers no layout direction",
);
closeContextMenu();
$("nodeContextMenu").querySelector, openMenuOn(liveRoot);
$("nodeContextMenu").querySelector('[data-direction="vertical"]').click();
assert(
  M.treeDirection(d(), d().nodes.find((n) => n.id === movingRoot.id)) === "vertical",
  "Choosing a direction from the menu lays that tree out that way",
);
const framedBox = treeViewBounds(movingRoot.id);
assert(
  view.z > wideZoom && boundsOnScreen(framedBox),
  "Changing a layout frames that tree rather than zooming out to the whole canvas",
);
// A tree with room to spare in either orientation is left exactly where it is.
const room = treeViewBounds(movingRoot.id);
fitBounds({
  x: room.x - room.w,
  y: room.y - room.h,
  w: room.w * 3,
  h: room.h * 3,
});
const heldView = { ...view };
setTreeDirection(movingRoot.id, "horizontal");
assert(
  view.z === heldView.z && view.x === heldView.x && view.y === heldView.y,
  "A tree that already fits on screen does not move the canvas at all",
);
setTreeDirection(movingRoot.id, "vertical");
undo();
undo();
setTool("connector");
assert(
  ["shape", "mind", "connector"].every((tool) => !$("toolbar").querySelector(`[data-tool="${tool}"]`).hidden),
  "A Board keeps the shape, mind-map and connector tools on the rail together",
);
const sink = M.node("mind", -200, -1500, "Shared outcome");
d().nodes.push(sink);
const linkedRoot = d().nodes.find((n) => n.id === movingRoot.id),
  linkedChild = d().nodes.find((n) => n.id === movingChild.id);
for (const source of [linkedRoot, linkedChild]) {
  const p = ports(source).find((p) => p.side === "right"),
    q = ports(sink).find((p) => p.side === "left");
  pointer("pointerdown", p.x, p.y);
  pointer("pointermove", q.x, q.y);
  pointer("pointerup", q.x, q.y);
}
assert(
  d().edges.filter((e) => e.to === sink.id && !e.tree).length === 2 &&
    sink.parent === null,
  "Manual mind-map links support multiple sources into one independent node",
);
selected = new Set([sink.id]);
setTool("select");
inspect();
openNotes(sink.id);
$("newNoteText").value = "Check the assumptions.";
$("newNoteText").dispatchEvent(new Event("input"));
$("newNoteForm").dispatchEvent(new Event("submit", { cancelable: true }));
assert(
  sink.notes.length === 1 && sink.notes[0].text === "Check the assumptions.",
  "Node note can be added through the notes panel",
);
M.addNote(d(), sink.id, "Updated after review.", sink.notes[0].id);
renderNotes();
assert(
  sink.notes[0].replies[0].text === "Updated after review.",
  "Previously saved replies remain readable without a reply composer",
);
$("newNoteText").value = "Unfinished draft";
$("newNoteText").dispatchEvent(new Event("input"));
closeNotes();
openNotes(sink.id);
assert(
  $("newNoteText").value === "Unfinished draft",
  "Note draft survives closing and reopening the panel",
);
await window.flushSave();
const storedNotes = await native("load");
assert(
  storedNotes.state.documents
    .find((doc) => doc.id === current.id)
    .canvas.nodes.find((n) => n.id === sink.id).notes[0].replies.length === 1,
  "Native autosave retains notes and replies",
);
closeNotes();
assert(sink.fontSize === 19, "New nodes default to the Small text size");
current.canvas = v12Snapshot;
selected.clear();
await window.flushSave();
const primaryId = current.id;
newDoc();
assert(
  [...$("modalBody").querySelectorAll("[data-new-mode]")].map((b) => b.dataset.newMode).join() === "board,notes",
  "New document offers Board and Notes only",
);
$("modalBody").querySelector('[data-new-mode="board"]').click();
$("nameInput").value = "Mode test";
$("nameSubmit").click();
assert(
  current.mode === "board" &&
    !$("toolbar").querySelector('[data-tool="shape"]').hidden &&
    !$("toolbar").querySelector('[data-tool="mind"]').hidden,
  "A new Board opens with both node tools",
);
const fixtureId = current.id;
openDoc(primaryId);
state.documents = state.documents.filter((doc) => doc.id !== fixtureId);
// Reopening legacy data migrates connectors, not labels or relationships.
const migrationBefore = M.clone(d());
const migrationEdge = d().edges[0];
if (migrationEdge) migrationEdge.style = "curved";
current.connectorVersion = 1;
openDoc(current.id);
assert(
  d().edges.filter(edge => edge.tree).every((edge) => edge.style === "curved") &&
    d()
      .nodes.map((n) => n.text)
      .join("|") === migrationBefore.nodes.map((n) => n.text).join("|"),
  "Existing tree connectors migrate to tidy curves without changing node text",
);
const revisionSnapshot = M.clone(d());
assert(
  document.title === "mapyourmind" && document.documentElement.lang === "en",
  "mapyourmind branding and English interface",
);
assert(
  ["board", "flowchart", "mindmap"].includes(current.mode),
  "Legacy flowchart and mind-map documents open as Boards with their stored mode intact",
);
const unchanged = JSON.stringify(d()),
  storedMode = current.mode;
setTool("mind");
setTool("shape");
setTool("select");
assert(
  JSON.stringify(d()) === unchanged && current.mode === storedMode,
  "Switching node tools preserves existing elements and never rewrites the document mode",
);
create("mind", -200, 500, "New thought");
const newRoot = d().nodes.at(-1);
Object.assign(newRoot,{shape:"decision",fill:"transparent",stroke:"#6b4f8a",sw:3,strokeStyle:"dotted",sloppiness:0,fontFamily:"Comic Shanns",fontSize:27,textColor:"#5b3344",textAlign:"left"});
key(canvas, "Tab");
type("Child");
key($("textEditor"), "Enter");
type("Sibling");
key($("textEditor"), "Escape");
assert(
  d().nodes.slice(-2).every(n=>M.isText(n)&&n.fontFamily===newRoot.fontFamily&&n.textColor===newRoot.textColor&&n.stroke==="transparent"&&n.fill==="transparent"),
  "Mind-map Tab and Enter create text children with inherited typography",
);
assert(d().edges.slice(-2).every(e=>e.stroke==="#1b1b1f"&&e.sw===1.8&&!e.strokeStyle&&e.sloppiness===undefined),"Mind-map connectors keep independent default styles");
const n = d().nodes.at(-1);
selected = new Set([n.id]);
for (const alignment of ["left", "center", "right"]) {
  styleSelection("textAlign", alignment);
  beginEdit(n);
  assert(
    $("textEditor").style.textAlign === alignment,
    `Text alignment ${alignment} applies while editing`,
  );
  key($("textEditor"), "Escape");
}
const drawable = JSON.stringify(sketchShape(n));
n.x += 60;
n.y += 30;
assert(
  JSON.stringify(sketchShape(n)) === drawable,
  "Seeded sketch remains identical when moved",
);
assert(
  sketchShape(n).sets.some((s) => s.type === "fillPath") &&
    sketchShape(n).sets.some((s) => s.type === "path"),
  "Solid fill and rough outline use independent paths",
);
create("shape", -350, -400, "Source");
const a = d().nodes.at(-1);
create("shape", 50, -400, "Target");
const b = d().nodes.at(-1);
selected.clear();
setTool("select");
pointer("pointermove", a.x + 30, a.y + 20);
assert(
  hoveredNode === a.id,
  "Connection ports appear on unselected hovered shapes",
);
const start = ports(a).find((p) => p.side === "right"),
  end = ports(b).find((p) => p.side === "left"),
  edgeCount = d().edges.length;
pointer("pointerdown", start.x, start.y);
assert(
  drag?.type === "connect",
  "Dragging a hover port starts a connector without selecting a tool",
);
pointer("pointermove", end.x, end.y);
assert(
  drag.target?.id === b.id,
  "Connector snaps to and highlights a destination shape",
);
pointer("pointerup", end.x, end.y);
const edge = d().edges.at(-1);
assert(
  d().edges.length === edgeCount + 1 &&
    edge.arrow &&
    edge.fromSide === "right" &&
    edge.toSide === "left",
  "Drop persists cardinal source and destination ports",
);
pointer("pointerdown", start.x, start.y);
pointer("pointermove", start.x + 80, start.y - 80);
key(canvas, "Escape");
pointer("pointerup", start.x + 80, start.y - 80);
assert(
  d().edges.length === edgeCount + 1 && !drag,
  "Escape cancels connector dragging without creating content",
);
// Connector labels: bound to the connector, drawn inside a gap in its stroke.
selected.clear();
function labelGeometry(e) {
  const g = edgeGeometry(e);
  return { g, mid: polylineMidpoint(edgePolyline(e, g)) };
}
function lineY(e, worldX) {
  const { g } = labelGeometry(e);
  return g.p.y + ((g.q.y - g.p.y) * (worldX - g.p.x)) / (g.q.x - g.p.x || 1);
}
// Pixel checks run at a fixed zoom over a known point, so a stroke is never
// too faint to read and the result does not depend on the test window size.
function focusOn(p) {
  view.z = 1;
  view.x = Math.round(canvas.clientWidth / 2 - p.x);
  view.y = Math.round(canvas.clientHeight / 2 - p.y);
  paint();
}
function strokeVisible(worldX, worldY, span = 7) {
  const ratio = devicePixelRatio || 1,
    x = Math.round((worldX * view.z + view.x) * ratio),
    top = Math.round(((worldY - span) * view.z + view.y) * ratio),
    height = Math.max(1, Math.round(2 * span * view.z * ratio)),
    data = ctx.getImageData(x, top, 1, height).data;
  for (let i = 0; i < data.length; i += 4)
    if (data[i + 3] > 40 && data[i] < 150 && data[i + 1] < 150 && data[i + 2] < 150)
      return true;
  return false;
}
// Whimsical-style connectors: both ends stop 8px short of the shape along the
// first and last segment, the head is a filled triangle drawn crisply at every
// sloppiness, and the sketched line stops at the head's base. The line that is
// drawn is read from the path handed to Rough.js, so the check covers what
// reaches the canvas at each sloppiness rather than the geometry alone.
{
  const gapBase = M.bounds(d().nodes),
    gapA = M.node("flow", gapBase.x, gapBase.y + gapBase.h + 600, "process", "Gap A"),
    gapB = M.node("flow", gapBase.x + 420, gapBase.y + gapBase.h + 760, "process", "Gap B");
  d().nodes.push(gapA, gapB);
  const gapEdge = M.connect(d(), gapA.id, gapB.id, { fromSide: "right", toSide: "left" }),
    realPath = roughGenerator.path,
    realHead = drawArrowHead;
  // Clearing the cache redraws every connector, so keep only this one's path
  // (by its seed) and the head whose tip is on its end.
  let drawnPath = null,
    drawnHeads = [];
  roughGenerator.path = function (path, options) {
    if (options.seed === sketchSeed(gapEdge.id)) drawnPath = path;
    return realPath.call(this, path, options);
  };
  drawArrowHead = (c, head, color) => {
    drawnHeads.push({ head, color });
    realHead(c, head, color);
  };
  const lastPoint = (path) => {
    const numbers = path.match(/-?\d+(\.\d+)?(e-?\d+)?/g).map(Number);
    return { x: numbers.at(-2), y: numbers.at(-1) };
  };
  const along = (from, to, vector, distance) =>
    Math.abs(to.x - from.x - vector[0] * distance) < 0.01 &&
    Math.abs(to.y - from.y - vector[1] * distance) < 0.01;
  const inkAt = (worldX, worldY) => {
    const ratio = devicePixelRatio || 1,
      data = ctx.getImageData(
        Math.round((worldX * view.z + view.x) * ratio),
        Math.round((worldY * view.z + view.y) * ratio),
        1,
        1,
      ).data;
    return data[3] > 200 && data[0] < 90 && data[1] < 90 && data[2] < 90;
  };
  const cases = [];
  for (const style of ["straight", "elbow", "curved"])
    for (const sloppiness of [0, 1, 2])
      for (const bend of style === "straight" ? [false] : [false, true]) {
        gapEdge.style = style;
        gapEdge.sloppiness = sloppiness;
        if (bend) gapEdge.bend = { x: gapA.x + 260, y: gapA.y - 90 };
        else delete gapEdge.bend;
        edgeCache.clear();
        selected.clear();
        drawnPath = null;
        drawnHeads = [];
        const g = edgeGeometry(gapEdge),
          from = anchor(gapA, g.sa),
          to = anchor(gapB, g.sb);
        focusOn(g.q);
        const straightDir = [(to.x - from.x) / Math.hypot(to.x - from.x, to.y - from.y), (to.y - from.y) / Math.hypot(to.x - from.x, to.y - from.y)],
          out = style === "straight" ? straightDir : sideVector(g.sa),
          back = style === "straight" ? [-straightDir[0], -straightDir[1]] : sideVector(g.sb),
          drawnHead = drawnHeads.find((h) => Math.hypot(h.head.tip.x - g.q.x, h.head.tip.y - g.q.y) < 0.01),
          head = drawnHead?.head,
          inward = head ? head.dir : [-back[0], -back[1]],
          end = drawnPath && lastPoint(drawnPath),
          drawnEnd = end && { x: end.x + g.p.x, y: end.y + g.p.y };
        cases.push({
          name: `${style}${bend ? " bent" : ""} s${sloppiness}`,
          gap: along(from, g.p, out, 8) && along(to, g.q, back, 8),
          // Rough.js draws from the path's origin, which drawEdge puts on g.p.
          starts: /^M0 0/.test(drawnPath || ""),
          headFilled: !!head && drawnHead.color === gapEdge.stroke &&
            Math.hypot(head.tip.x - g.q.x, head.tip.y - g.q.y) < 0.01 &&
            head.length >= Math.min(4 * gapEdge.sw, 8) - 0.01 &&
            [0.25, 0.45].every((t) =>
              [-0.5, 0.5].every((side) => {
                const x = head.base.x + head.dir[0] * head.length * t,
                  y = head.base.y + head.dir[1] * head.length * t,
                  width = head.half * (1 - t) * side;
                return inkAt(x - head.dir[1] * width, y + head.dir[0] * width);
              }),
            ),
          stopsAtBase: !!head && !!drawnEnd &&
            Math.hypot(drawnEnd.x - head.base.x, drawnEnd.y - head.base.y) < 0.01,
          hitNearEnds: hitEdge({ x: g.p.x + out[0] * 3, y: g.p.y + out[1] * 3 })?.id === gapEdge.id &&
            hitEdge({ x: g.q.x - inward[0] * 3, y: g.q.y - inward[1] * 3 })?.id === gapEdge.id,
          handles: edgeHandles(gapEdge).every((h) =>
            Math.hypot(h.x - (h.end === "from" ? g.p.x : g.q.x), h.y - (h.end === "from" ? g.p.y : g.q.y)) < 0.01),
        });
      }
  const failed = (key) => cases.filter((c) => !c[key]).map((c) => c.name).join(", ");
  assert(!failed("gap"), "Connectors stop 8px short of both shapes along their end segments (straight, elbow, curved, bent; every sloppiness) " + failed("gap"));
  assert(!failed("starts"), "The drawn line starts on the trimmed end " + failed("starts"));
  assert(!failed("headFilled"), "The arrowhead is a filled triangle in the stroke colour with its tip on the trimmed end " + failed("headFilled"));
  assert(!failed("stopsAtBase"), "The sketched line stops at the arrowhead's base at every sloppiness " + failed("stopsAtBase"));
  assert(!failed("hitNearEnds"), "Hit testing still finds a connector a few pixels from either end " + failed("hitNearEnds"));
  assert(!failed("handles"), "Endpoint handles sit on the trimmed ends " + failed("handles"));
  // A real click near the end selects the connector. Connection ports sit on
  // the same spot as a connector's end and outrank it, as they did before the
  // gap, so the click lands 3px past the port's reach.
  gapEdge.style = "straight";
  delete gapEdge.bend;
  selected.clear();
  setTool("select");
  const clickGeometry = edgeGeometry(gapEdge);
  focusOn(clickGeometry.p);
  const clickDir = [clickGeometry.q.x - clickGeometry.p.x, clickGeometry.q.y - clickGeometry.p.y].map((v) => v / Math.hypot(clickGeometry.q.x - clickGeometry.p.x, clickGeometry.q.y - clickGeometry.p.y));
  let clickReach = 0;
  while (clickReach < 60 && hitPort({ x: clickGeometry.p.x + clickDir[0] * clickReach, y: clickGeometry.p.y + clickDir[1] * clickReach })) clickReach++;
  const clickAt = { x: clickGeometry.p.x + clickDir[0] * (clickReach + 3), y: clickGeometry.p.y + clickDir[1] * (clickReach + 3) };
  assert(clickReach + 3 <= 24, "The clickable line begins within 24px of the trimmed end");
  pointer("pointerdown", clickAt.x, clickAt.y);
  pointer("pointerup", clickAt.x, clickAt.y);
  assert(selected.has(gapEdge.id) && selected.size === 1, "Clicking a connector just past its gap selects the connector");
  // No arrow: no head, and the line runs to the trimmed end.
  gapEdge.arrow = false;
  edgeCache.clear();
  drawnPath = null;
  drawnHeads = [];
  paint();
  const plain = edgeGeometry(gapEdge),
    plainEnd = lastPoint(drawnPath || "M0 0");
  assert(!drawnHeads.some((h) => Math.hypot(h.head.tip.x - plain.q.x, h.head.tip.y - plain.q.y) < 0.01) && Math.hypot(plainEnd.x + plain.p.x - plain.q.x, plainEnd.y + plain.p.y - plain.q.y) < 0.01, "A connector without an arrow draws no head and runs to its trimmed end");
  gapEdge.arrow = true;
  // Tree connectors keep the gap too.
  const treeEdge = d().edges.find((e) => e.tree),
    treeGeometry = treeEdge && edgeGeometry(treeEdge),
    treeFrom = treeEdge && anchor(M.byId(d()).get(treeEdge.from), treeGeometry.sa),
    treeTo = treeEdge && anchor(M.byId(d()).get(treeEdge.to), treeGeometry.sb);
  assert(treeEdge && along(treeFrom, treeGeometry.p, sideVector(treeGeometry.sa), 8) && along(treeTo, treeGeometry.q, sideVector(treeGeometry.sb), 8), "Tree connectors stop 8px short of parent and child");
  // Lines round their caps and joins.
  let caps = null;
  const realDraw = roughCanvas(ctx).draw;
  roughCanvas(ctx).draw = function (drawable) {
    if (drawable === edgeCache.get(gapEdge.id)?.drawable) caps = [ctx.lineCap, ctx.lineJoin];
    return realDraw.call(this, drawable);
  };
  paint();
  delete roughCanvas(ctx).draw;
  assert(caps?.[0] === "round" && caps?.[1] === "round", "Connector lines use round caps and joins");
  delete roughGenerator.path;
  drawArrowHead = realHead;
  selected.clear();
  d().edges = d().edges.filter((e) => e.id !== gapEdge.id);
  d().nodes = d().nodes.filter((n) => n.id !== gapA.id && n.id !== gapB.id);
  edgeCache.clear();
}
const labelEdge = d().edges.at(-1);
assert(
  labelEdge.style === "curved",
  "A dragged connector is curved by default",
);
// Pin a style so the pixel checks below do not depend on that default.
labelEdge.style = "straight";
const bareMid = labelGeometry(labelEdge).mid;
focusOn(bareMid);
assert(
  strokeVisible(bareMid.x, lineY(labelEdge, bareMid.x)),
  "Unlabelled connector draws an unbroken stroke at its midpoint",
);
// Connection points are arrows close to the shape, not distant dots.
const arrowNode = d().nodes.find((n) => n.kind === "flow");
const arrowPorts = ports(arrowNode);
assert(
  arrowPorts.every((port) => {
    const [vx, vy] = sideVector(port.side),
      anchorPoint = anchor(arrowNode, port.side);
    return Math.hypot(port.x - anchorPoint.x, port.y - anchorPoint.y) <= 14 / view.z &&
      (vx ? Math.sign(port.x - anchorPoint.x) === vx : Math.sign(port.y - anchorPoint.y) === vy);
  }),
  "Connection arrows sit close to the shape and point away from it",
);
pointer("dblclick", bareMid.x, bareMid.y);
assert(
  editing && editing.id === "label:" + labelEdge.id,
  "Double clicking a connector edits its label, not a new text element",
);
type("needs review");
key($("textEditor"), "Escape");
assert(
  labelEdge.label === "needs review" &&
    !d().nodes.some((n) => n.text === "needs review"),
  "Connector label is stored on the connector itself",
);
selected.clear();
focusOn(labelGeometry(labelEdge).mid);
const labelBox = edgeLabel(labelEdge);
assert(
  Math.abs(labelBox.x + labelBox.w / 2 - labelGeometry(labelEdge).mid.x) < 0.5 &&
    Math.abs(labelBox.y + labelBox.h / 2 - labelGeometry(labelEdge).mid.y) < 0.5,
  "Connector label is centred on the midpoint of the drawn path",
);
assert(
  !strokeVisible(labelBox.x + 2, lineY(labelEdge, labelBox.x + 2), 4),
  "Connector stroke breaks around its label instead of running through it",
);
assert(
  strokeVisible(labelBox.x - 12, lineY(labelEdge, labelBox.x - 12)),
  "Connector stroke continues on both sides of its label",
);
pointer("pointerdown", labelBox.x + 4, labelBox.y + labelBox.h / 2);
pointer("pointerup", labelBox.x + 4, labelBox.y + labelBox.h / 2);
assert(
  selected.size === 1 && selected.has(labelEdge.id),
  "Clicking a connector label selects its connector",
);
const labelSource = d().nodes.find((n) => n.id === labelEdge.from),
  movedFrom = labelGeometry(labelEdge).mid.y;
labelSource.y -= 120;
assert(
  Math.abs(labelGeometry(labelEdge).mid.y - movedFrom) > 10,
  "Connector label follows its connector when a connected shape moves",
);
labelSource.y += 120;
styleSelection("fontSize", 25);
styleSelection("textColor", "#3355aa");
assert(
  labelEdge.fontSize === 25 &&
    labelEdge.textColor === "#3355aa" &&
    edgeLabel(labelEdge).fontSize === 25,
  "Text controls style the selected connector's label",
);
styleSelection("fontSize", 14);
const beforeClear = M.clone(d());
pointer("dblclick", labelGeometry(labelEdge).mid.x, labelGeometry(labelEdge).mid.y);
type("");
key($("textEditor"), "Escape");
assert(
  labelEdge.label === undefined &&
    d().edges.length === edgeCount + 1 &&
    !editing,
  "Emptying a connector label removes the label and keeps the connector",
);
current.canvas = M.clone(beforeClear);
M.layout(d());
selected.clear();
assert(
  d().edges.at(-1).label === "needs review",
  "Undo restores a removed connector label with its connector",
);
// The typing field follows its text: usable while empty, one line up to a
// default rectangle's width, then wrapped with every line still visible.
const fieldEdge = d().edges.at(-1);
delete fieldEdge.label;
delete fieldEdge.labelMarks;
focusOn(labelGeometry(fieldEdge).mid);
editEdgeLabel(fieldEdge);
const fieldFont = edgeLabel(fieldEdge).fontSize;
const fits = () =>
  richEditor.scrollHeight <= richEditor.clientHeight + 1 &&
  richEditor.scrollWidth <= richEditor.clientWidth + 1;
assert(
  richEditor.getBoundingClientRect().width >= fieldFont * 3 * view.z &&
    richEditor.getBoundingClientRect().width <= fieldFont * 5 * view.z &&
    fits(),
  "An empty connector label opens a compact field that is still usable",
);
assert(
  getComputedStyle(richEditor).backgroundColor === "rgba(0, 0, 0, 0)" &&
    richEditor.classList.contains("label-editor"),
  "The label field is transparent, so an empty label leaves its connector unbroken",
);
$("toast").hidden = true;
await wait(120);
await native("snapshot", { name: "labelempty" });
type("Approved");
assert(
  textLines(ctx, edgeLabel(fieldEdge)).length === 1 &&
    edgeLabel(fieldEdge).w <= 180 &&
    richEditor.getBoundingClientRect().width >=
      edgeLabel(fieldEdge).w * view.z &&
    fits(),
  "A short label stays on one line and its field grows with the text",
);
type("Escalate to the risk committee before release");
const wrapped = edgeLabel(fieldEdge);
assert(
  textLines(ctx, wrapped).length >= 2 &&
    wrapped.w <= 180 &&
    fits(),
  "A long label wraps within a default rectangle's width with no hidden text",
);
const fieldHeight = richEditor.getBoundingClientRect().height;
assert(
  fieldHeight >= (wrapped.h + 2) * view.z &&
    fieldHeight <= (wrapped.h + 12) * view.z,
  "The field is as tall as the wrapped label it holds, with no spare line",
);
$("toast").hidden = true;
await wait(120);
await native("snapshot", { name: "labelfield" });
key($("textEditor"), "Escape");
assert(
  fieldEdge.label === "Escalate to the risk committee before release" &&
    edgeLabel(fieldEdge).w <= 180,
  "The committed label keeps every line inside the wrapped width",
);
fieldEdge.label = "needs review";
delete fieldEdge.labelMarks;
// A label slides along its connector and never leaves the line.
focusOn(labelGeometry(fieldEdge).mid);
const centred = edgeLabel(fieldEdge),
  target = polylinePointAt(
    edgePolyline(fieldEdge, edgeGeometry(fieldEdge)),
    0.65,
  );
pointer("pointerdown", centred.x + 4, centred.y + centred.h / 2);
assert(drag?.type === "label", "Pressing a connector label starts a label drag");
pointer("pointermove", target.x, target.y - 60);
pointer("pointerup", target.x, target.y - 60);
const moved = edgeLabel(fieldEdge);
assert(
  Math.abs(fieldEdge.labelT - 0.65) < 0.02 &&
    Math.abs(moved.y + moved.h / 2 - target.y) < 1.5 &&
    Math.abs(moved.x + moved.w / 2 - target.x) < 1.5,
  "A dragged label follows the connector instead of the pointer's own offset",
);
const firstT = fieldEdge.labelT,
  far = polylinePointAt(edgePolyline(fieldEdge, edgeGeometry(fieldEdge)), 1);
pointer("pointerdown", moved.x + 4, moved.y + moved.h / 2);
pointer("pointermove", far.x + 400, far.y);
pointer("pointerup", far.x + 400, far.y);
const clamped = edgeLabel(fieldEdge);
assert(
  fieldEdge.labelT < 1 &&
    clamped.x + clamped.w < far.x + 1 &&
    !strokeVisible(clamped.x + 2, lineY(fieldEdge, clamped.x + 2), 3),
  "A label dragged past the end stops short of the shape and keeps its gap",
);
const dragged = fieldEdge.labelT;
undo();
assert(
  d().edges.at(-1).labelT === firstT,
  "Undo steps back exactly one label drag",
);
undo();
assert(
  d().edges.at(-1).labelT === undefined,
  "A second undo returns the label to the middle of its connector",
);
redo();
redo();
assert(
  d().edges.at(-1).labelT === dragged,
  "Redo restores the dragged label position",
);
// Undo replaces the canvas, so later steps work from the live edge.
delete d().edges.at(-1).labelT;
// A note must read as a note, and fills must offer more than solid.
const noteDemo = M.node("flow", 0, 0, "note", "Follow up with lending ops"),
  hatched = M.node("flow", 0, 0, "process", "Hachure"),
  crossed = M.node("flow", 0, 0, "process", "Cross-hatch"),
  plain = M.node("flow", 0, 0, "process", "Transparent");
assert(
  noteDemo.fill === M.noteFill &&
    hatched.fill === "#ffffff" &&
    plain.fill === "#ffffff",
  "New shapes start white while a note starts yellow",
);
Object.assign(hatched, { fill: "#ffe3e3", fillStyle: "hachure" });
Object.assign(crossed, { fill: "#ffe3e3", fillStyle: "cross-hatch" });
const noteParts = sketchShape(noteDemo),
  rectParts = sketchShape(M.node("flow", 0, 0, "process", "Rectangle"));
assert(
  Array.isArray(noteParts) &&
    noteParts.length === 2 &&
    !Array.isArray(rectParts),
  "A note is drawn as a body plus its folded corner, not a plain rectangle",
);
assert(
  JSON.stringify(sketchShape(hatched)) !== JSON.stringify(sketchShape(crossed)) &&
    sketchShape(hatched).sets.some((s) => s.type === "fillSketch"),
  "Hachure and cross-hatch fills produce different sketched fills",
);
const inspectorDemo = [noteDemo, hatched, crossed, plain];
inspectorDemo.forEach((n, i) => {
  n.x = -3200 + i * 220;
  n.y = 2600;
  autoSize(n);
  d().nodes.push(n);
});
hatched.edges = "round";
selected = new Set([hatched.id]);
hoveredNode = hatched.id;
inspect();
view.z = 1;
view.x = Math.round(canvas.clientWidth / 2 - (-3200 + 330));
view.y = Math.round(canvas.clientHeight / 2 - 2640);
paint();
$("toast").hidden = true;
await wait(150);
// The reordered controls run past the panel, so check the lower half too.
$("inspector").scrollTop = $("inspector").scrollHeight;
await wait(120);
await native("snapshot", { name: "inspector" });
$("inspector").scrollTop = 0;
hoveredNode = null;
const sizeButtons = [
  ...document.querySelectorAll('[data-select="fontSize"] button'),
];
assert(
  sizeButtons.length === 5 &&
    sizeButtons.map((b) => b.textContent).join("") === "XSSMLXL" &&
    $("fontSize").hidden &&
    sizeButtons.filter((b) => b.getAttribute("aria-pressed") === "true")
      .length === 1,
  "Font size is a row of sized letters rather than a dropdown",
);
assert(
  !$("fillSection").hidden &&
    !$("fillStyle").parentElement.hidden &&
    !$("edges").parentElement.hidden &&
    !$("alignSection").hidden &&
    [...$("alignTools").children].every((b) => b.disabled),
  "A coloured rectangle shows fill style and edges, and alignment stays visible but inert alone",
);
// Edges belong to the plain rectangle; other shapes define their own corners.
assert(
  JSON.stringify(sketchShape({ ...hatched, edges: "round" })) !==
    JSON.stringify(sketchShape({ ...hatched, id: hatched.id, edges: "sharp" })),
  "Round edges draw a different rectangle from sharp edges",
);
selected = new Set([noteDemo.id]);
inspect();
assert(
  $("edges").parentElement.hidden,
  "A note has no edges option; only the rectangle chooses its corners",
);
hatched.edges = "sharp";
// A selected swatch must show its whole ring, and every palette ends with a
// custom colour.
selected = new Set([hatched.id]);
styleSelection("fill", "#ffe3e3");
inspect();
const fillPalette = $("fillColors"),
  activeSwatch = fillPalette.querySelector("[data-color].active"),
  swatchStyle = getComputedStyle(activeSwatch),
  ring = parseFloat(swatchStyle.outlineWidth) + parseFloat(swatchStyle.outlineOffset);
for (const palette of [fillPalette, $("highlightColors")])
  assert(
    parseFloat(getComputedStyle(palette).paddingLeft) >= ring &&
      parseFloat(getComputedStyle(palette).paddingTop) >= ring,
    "Every colour palette leaves room for a selection ring",
  );
const paletteBox = fillPalette.getBoundingClientRect(),
  activeBox = activeSwatch.getBoundingClientRect();
assert(
  activeBox.left - ring >= paletteBox.left - 0.5 &&
    activeBox.top - ring >= paletteBox.top - 0.5 &&
    activeBox.bottom + ring <= paletteBox.bottom + 0.5,
  "The selected swatch ring is not clipped by the palette",
);
const customFill = $("fillCustom");
fillPalette.scrollLeft = fillPalette.scrollWidth;
assert(
  customFill.getBoundingClientRect().left >=
    fillPalette.getBoundingClientRect().right - 0.5 &&
    customFill.getBoundingClientRect().right <=
      $("fillSection").getBoundingClientRect().right + 0.5,
  "The custom swatch sits beside the presets, still in view when they scroll",
);
fillPalette.scrollLeft = 0;
assert(
  customFill === fillPalette.parentElement.lastElementChild &&
    customFill.querySelector('input[type="color"]') &&
    $("highlightCustom") === $("highlightColors").parentElement.lastElementChild,
  "Fill and highlight palettes both end with a custom colour picker",
);
styleSelection("fill", "#7b2d8e");
inspect();
assert(
  customFill.classList.contains("active") &&
    customFill.querySelector("input").value === "#7b2d8e" &&
    customFill.style.background === "rgb(123, 45, 142)" &&
    ![...fillPalette.querySelectorAll("[data-color]")].some((b) =>
      b.classList.contains("active"),
    ),
  "A colour outside the palette shows on the custom swatch instead of nowhere",
);
styleSelection("fill", "#ffe3e3");
inspect();
assert(
  !customFill.classList.contains("active") &&
    fillPalette.querySelector('[data-color="#ffe3e3"]').classList.contains("active"),
  "Choosing a preset moves the ring back off the custom swatch",
);
const dockedPanel = $("inspector").getBoundingClientRect(),
  stageBox = $("stage").getBoundingClientRect();
assert(
  Math.abs(dockedPanel.right - stageBox.right) < 1 &&
    Math.abs(dockedPanel.top - stageBox.top) < 1 &&
    Math.abs(dockedPanel.bottom - stageBox.bottom) < 1 &&
    getComputedStyle($("inspector")).borderTopLeftRadius === "0px",
  "The style panel is docked flush to the stage, full height and square",
);
assert(
  $("help").getBoundingClientRect().right < dockedPanel.left,
  "The help button steps aside for the docked panel",
);
const familyButtons = [
  ...document.querySelectorAll('[data-select="fontFamily"] button'),
];
assert(
  familyButtons.length === 3 &&
    documentFonts.includes("Arial") &&
    $("fontFamily").hidden &&
    familyButtons.map((b) => b.dataset.value).join() ===
      "Excalifont,Google Sans,Comic Shanns",
  "Font family is a row of buttons rather than a dropdown",
);
selected.clear();
inspect();
assert($("inspector").hidden, "The panel still stays away until something is selected");
plain.fill = "transparent";
selected = new Set([plain.id]);
inspect();
assert(
  $("fillStyle").parentElement.hidden,
  "Fill style is hidden while a shape has no fill colour",
);
M.remove(d(), inspectorDemo.map((n) => n.id));
selected.clear();
const curvedLabel = d().edges.at(-1);
curvedLabel.style = "curved";
curvedLabel.label = "needs review";
selected.clear();
focusOn(labelGeometry(curvedLabel).mid);
assert(
  !strokeVisible(
    edgeLabel(curvedLabel).x + 2,
    labelGeometry(curvedLabel).mid.y,
    3,
  ),
  "Curved connectors break around their label as well",
);
// Show the label beside the connection arrows of a hovered shape.
focusOn(labelGeometry(curvedLabel).mid);
hoveredNode = curvedLabel.from;
selected = new Set([curvedLabel.id]);
paint();
$("toast").hidden = true;
await wait(120);
await native("snapshot", { name: "labels" });
hoveredNode = null;
selected.clear();
const endEdge = d().edges.at(-1);
// A selected connector shows handles at its ends, and either end can be moved
// onto another shape.
selected = new Set([endEdge.id]);
paint();
const ends = edgeHandles(endEdge),
  endGeometry = edgeGeometry(endEdge);
assert(
  ends.length === 2 &&
    Math.hypot(ends[0].x - endGeometry.p.x, ends[0].y - endGeometry.p.y) < 0.01 &&
    Math.hypot(ends[1].x - endGeometry.q.x, ends[1].y - endGeometry.q.y) < 0.01,
  "A selected connector carries a handle at each drawn end",
);
// Well clear of every other element, so nearShape can only pick this one.
const clearOf = M.bounds(d().nodes),
  thirdShape = M.node("flow", clearOf.x, clearOf.y + clearOf.h + 500, "process", "Third");
d().nodes.push(thirdShape);
M.layout(d());
assert(
  !d().nodes.some((n) => n.id !== thirdShape.id && M.overlap({ ...thirdShape, x: thirdShape.x - 120, y: thirdShape.y - 120, w: thirdShape.w + 240, h: thirdShape.h + 240 }, n)),
  "The reattach target stands alone, so the drag cannot land on anything else",
);
const originalTo = endEdge.to,
  originalFrom = endEdge.from,
  destination = edgeHandles(endEdge)[1];
pointer("pointerdown", destination.x, destination.y);
assert(
  drag?.type === "endpoint" && drag.end === "to",
  "Pressing an end handle starts moving that end, not the shape underneath",
);
const away = { x: thirdShape.x - 400, y: thirdShape.y + 400 };
pointer("pointermove", away.x, away.y);
assert(
  endEdge.to === originalTo && !drag.target,
  "An end dragged over empty canvas stays attached where it was",
);
pointer("pointermove", thirdShape.x + thirdShape.w / 2, thirdShape.y + thirdShape.h / 2);
assert(
  endEdge.to === thirdShape.id && drag.target?.id === thirdShape.id,
  "The connector itself follows the handle, so only one arrow is ever on screen",
);
view.z = 1;
view.x = Math.round(canvas.clientWidth / 2 - (thirdShape.x - 120));
view.y = Math.round(canvas.clientHeight / 2 - (thirdShape.y - 60));
paint();
$("toast").hidden = true;
await wait(150);
await native("snapshot", { name: "endpoint" });
// With a connector selected, hovering a shape must not offer its arrows.
hoveredNode = thirdShape.id;
assert(!hoverPortsNode(), "No helper arrows appear while a connector is dragged");
pointer("pointerup", thirdShape.x + thirdShape.w / 2, thirdShape.y + thirdShape.h / 2);
assert(
  !hoverPortsNode() && selected.has(endEdge.id),
  "No helper arrows appear while a connector is selected",
);
hoveredNode = null;
assert(
  endEdge.to === thirdShape.id && endEdge.from === originalFrom && M.validate(d()),
  "Dragging the destination handle reattaches that end and leaves the source alone",
);
undo();
assert(
  d().edges.find((a) => a.id === endEdge.id).to === originalTo,
  "Reattaching a connector end is a single undo step",
);
selected.clear();
hoveredNode = thirdShape.id;
assert(
  hoverPortsNode()?.id === thirdShape.id,
  "Helper arrows come back once no connector is selected",
);
hoveredNode = null;
M.remove(d(), [thirdShape.id]);
selected.clear();
paint();
// Curved and elbow connectors can be bent by dragging a handle in the middle.
const bendEdgeId = d().edges.at(-1).id;
for (const style of ["curved", "elbow"]) {
  // Undo replaces the canvas, so each pass works from the live connector.
  const link = d().edges.find((a) => a.id === bendEdgeId);
  link.style = style;
  delete link.bend;
  selected = new Set([link.id]);
  focusOn(polylineMidpoint(edgePolyline(link, edgeGeometry(link))));
  paint();
  const handle = bendHandle(link);
  const labelBoxNow = link.label ? edgeLabel(link) : null;
  assert(
    handle &&
      !handle.set &&
      (!labelBoxNow ||
        handle.x < labelBoxNow.x - 12 ||
        handle.x > labelBoxNow.x + labelBoxNow.w + 12 ||
        handle.y < labelBoxNow.y - 12 ||
        handle.y > labelBoxNow.y + labelBoxNow.h + 12),
    `A ${style} connector offers a bend handle clear of its label`,
  );
  const before = edgePolyline(link, edgeGeometry(link)).length;
  pointer("pointerdown", handle.x, handle.y);
  assert(drag?.type === "bend", `Pressing the handle starts bending a ${style} connector`);
  pointer("pointermove", handle.x, handle.y - 130);
  pointer("pointerup", handle.x, handle.y - 130);
  const bent = d().edges.find((a) => a.id === bendEdgeId);
  assert(
    bent.bend && Math.abs(bent.bend.y - (handle.y - 130)) < 1 && M.validate(d()),
    `A dragged ${style} connector keeps its bend`,
  );
  const bentPath = edgePolyline(bent, edgeGeometry(bent));
  if (style === "curved") {
    // No kink at the bend: the sharpest turn along the curve stays gentle.
    let sharpest = 0;
    for (let i = 1; i < bentPath.length - 1; i++) {
      const a = bentPath[i - 1], b = bentPath[i], c = bentPath[i + 1];
      const turn = Math.abs(
        Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x),
      );
      sharpest = Math.max(sharpest, Math.min(turn, Math.PI * 2 - turn));
    }
    assert(
      sharpest < 0.5,
      `A bent curve stays smooth through the bend [sharpest turn ${((sharpest * 180) / Math.PI).toFixed(1)} degrees]`,
    );
  }
  assert(
    bentPath.some((pt) => Math.abs(pt.y - bent.bend.y) < 1) &&
      (style === "elbow" ? bentPath.length > before : true),
    `The ${style} route actually passes through the bend`,
  );
  assert(
    bendHandle(bent).set && Math.abs(bendHandle(bent).x - bent.bend.x) < 0.01,
    `The ${style} handle sits on the bend once one is set`,
  );
  assert(
    hitEdge({ x: bent.bend.x, y: bent.bend.y })?.id === bendEdgeId,
    `A bent ${style} connector can still be clicked along its new route`,
  );
  if (style === "curved") {
    paint();
    $("toast").hidden = true;
    await wait(150);
    await native("snapshot", { name: "bend" });
  }
  undo();
  assert(
    d().edges.find((a) => a.id === bendEdgeId).bend === undefined,
    `Bending a ${style} connector is one undo step`,
  );
}
const straightened = d().edges.find((a) => a.id === bendEdgeId);
straightened.style = "straight";
delete straightened.bend;
assert(!bendHandle(straightened), "A straight connector has nothing to bend");
selected.clear();
current.canvas = revisionSnapshot;
selected.clear();
await window.flushSave();
// v1.3 interactions: tree alignment, collapse, comments, rich text, image paste.
const v13Before=M.clone(d());closeNotes();
create("mind",-4000,-2000,"Plan");
const planRoot=d().nodes.at(-1), branches=[];
for(let i=0;i<4;i++) {const child=M.extend(d(),planRoot.id,true);child.text="Branch "+(i+1);autoSize(child);branches.push(child);}
const deep=M.extend(d(),branches[1].id,true);deep.text="Details";autoSize(deep);M.layout(d());
assert(planRoot.fill==="#e6def7"&&planRoot.shape==="pill","Mind-map roots default to pastel purple rounded rectangles");
const lastBranch=branches[3];selected=new Set([lastBranch.id]);setTool("select");
pointer("pointerdown",lastBranch.x+40,lastBranch.y+lastBranch.h/2);
pointer("pointermove",lastBranch.x+40,branches[0].y-80);
pointer("pointerup",lastBranch.x+40,branches[0].y-80);
assert(M.children(d(),planRoot.id)[0].id===lastBranch.id&&branches.every(n=>n.x===branches[0].x),"Dragging a branch upward reorders and aligns all siblings");
assert(deep.y+deep.h/2===branches[1].y+branches[1].h/2,"Descendants remain centered on their parent after reordering");
const cb=canvas.getBoundingClientRect();
canvas.dispatchEvent(new MouseEvent("contextmenu",{clientX:planRoot.x*view.z+view.x+cb.left+20*view.z,clientY:planRoot.y*view.z+view.y+cb.top+20*view.z,bubbles:true,cancelable:true}));
assert(!$("nodeContextMenu").hidden&&$("nodeContextMenu").textContent.includes("Comment"),"Right-click node opens Comment and Collapse actions");
$("nodeContextMenu").querySelector('[data-context="collapse"]').click();
assert(planRoot.collapsed&&collapsedBadge(planRoot).count===5,"Collapsed parent shows the total hidden descendant count");
assert(!visibleCanvas().nodes.some(n=>n.id===deep.id)&&!exportElements("all").nodes.some(n=>n.id===deep.id),"Collapsed descendants are hidden from both canvas and PNG export");
assert(hitNode({x:deep.x+20,y:deep.y+20})?.id!==deep.id,"Hidden descendants cannot be selected");
const badge=collapsedBadge(planRoot);pointer("pointerdown",badge.x+10,badge.y+10);pointer("pointerup",badge.x+10,badge.y+10);
assert(!planRoot.collapsed&&visibleCanvas().nodes.some(n=>n.id===deep.id),"Clicking the branch count expands its descendants");
selected=new Set([planRoot.id]);key(canvas,"c",{metaKey:true,altKey:true});await wait(30);
assert(notesNodeId===planRoot.id&&!$("notesPanel").hidden,"Command Option C opens the selected node comment panel");
closeNotes();
create("shape",-3500,-1200,"Bold under highlight");const formatted=d().nodes.at(-1);beginEdit(formatted);
richEditor.setSelectionRange(0,4);key(richEditor,"b",{metaKey:true});await wait(20);
assert(markAt(formatted,0).bold&&!markAt(formatted,5).bold,"Command B formats only the selected word");
richEditor.setSelectionRange(5,10);key(richEditor,"u",{metaKey:true});await wait(20);
assert(markAt(formatted,5).underline&&!markAt(formatted,0).underline,"Command U underlines only the selected range");
richEditor.setSelectionRange(11,20);key(richEditor,"h",{metaKey:true});await wait(20);
assert(markAt(formatted,11).highlight==="#fff0a6"&&!markAt(formatted,0).highlight,"Command H highlights selected text in yellow");
assert(!$("inspector").hidden,"Highlight palette remains available while editing text");
$("highlightColors").children[2].click();
assert(markAt(formatted,11).highlight==="#e6def7"&&!markAt(formatted,0).highlight,"Pastel highlight palette preserves the selected text range");
richEditor.setRangeText("!",2,2,"end");richEditor.dispatchEvent(new Event("input"));
assert(formatted.text==="Bo!ld under highlight"&&markAt(formatted,2).bold&&markAt(formatted,12).highlight==="#e6def7","Text insertion preserves and shifts rich formatting");
await window.appCommand("undo");
assert(formatted.text==="Bold under highlight","Rich text editing supports undo");
await window.appCommand("redo");assert(formatted.text==="Bo!ld under highlight","Rich text editing supports redo");
commitEdit();canvas.focus();selected=new Set([formatted.id]);await window.appCommand("bold");
assert(Array.from({length:formatted.text.length},(_,i)=>markAt(formatted,i).bold).every(Boolean),"Command B on a selected node formats the whole node");
beginEdit(formatted);assert(richEditor.querySelector('[style*="font-weight: bold"]')&&richEditor.querySelector('[style*="background-color"]'),"Reopening a node displays saved bold and highlight formatting");commitEdit();canvas.focus();
selected=new Set([formatted.id]);await exportPNG(true,"selection","transparent",1);await pasteEditable();
const pastedImage=d().nodes.at(-1);
assert(pastedImage.kind==="image"&&pastedImage.w>0&&pastedImage.imageData.startsWith("data:image/png;base64,"),"Native clipboard PNG pastes as a movable image element");
const imageX=pastedImage.x,imageY=pastedImage.y;setTool("select");zoom(1);pointer("pointerdown",imageX+pastedImage.w/2,imageY+pastedImage.h/2);pointer("pointermove",imageX+pastedImage.w/2+50,imageY+pastedImage.h/2+40);pointer("pointerup",imageX+pastedImage.w/2+50,imageY+pastedImage.h/2+40);
assert(Math.abs(pastedImage.x-imageX-50)<10,"Pasted images can be repositioned");
// A pasted image arrives with no border, and the control has to work both ways.
selected = new Set([pastedImage.id]);
inspect();
const noStroke = () => $("strokeColors").querySelector('[data-color="transparent"]');
const borderControls = () =>
  ["strokeWidth", "strokeStyle", "sloppiness"].map((id) => $(id).parentElement.hidden);
assert(
  pastedImage.stroke === "transparent" &&
    !$("strokeColorSection").hidden && !noStroke().hidden && noStroke().classList.contains("active") &&
    borderControls().every(Boolean),
  "A borderless image shows its stroke row on No stroke, without controls for a border it has not got",
);
$("strokeColors").querySelector('[data-color="#1b1b1f"]').click();
inspect();
assert(
  pastedImage.stroke === "#1b1b1f" &&
    pastedImage.sw === 1 &&
    pastedImage.strokeStyle === "solid" &&
    pastedImage.sloppiness === 1,
  "Picking a colour for a borderless image starts at the thinnest solid stroke with medium sloppiness",
);
assert(
  borderControls().every((hidden) => !hidden) && !noStroke().classList.contains("active"),
  "The border controls appear only once the image has a border",
);
assert(
  sketchShape({ ...pastedImage, shape: "process", fill: "transparent" }).sets.some(
    (set) => set.type === "path",
  ),
  "That stroke is drawn as an outline around the image",
);
noStroke().click();
inspect();
assert(
  pastedImage.stroke === "transparent" && noStroke().classList.contains("active"),
  "The No stroke swatch takes the border off again",
);
$("strokeColors").querySelector('[data-color="#1b1b1f"]').click();
selected=new Set([pastedImage.id]);await copyEditable();await pasteEditable();
assert(d().nodes.at(-1).imageData===pastedImage.imageData,"Editable image copies preserve embedded pixels");
await exportPNG(true,"selection","transparent",1);
assert((await native("clipboardProbe")).png,"Pasted images are included in PNG export");
planRoot.collapsed=true;M.layout(d());await window.flushSave();const savedV13=await native("load");
const savedCanvasV13=savedV13.state.documents.find(doc=>doc.id===current.id).canvas;
assert(M.validate(savedCanvasV13)&&savedCanvasV13.nodes.find(n=>n.id===formatted.id).marks.length&&savedCanvasV13.nodes.find(n=>n.id===planRoot.id).collapsed&&savedCanvasV13.nodes.find(n=>n.id===pastedImage.id).imageData===pastedImage.imageData,"Native storage roundtrip preserves rich text, collapsed state, and images");
const demoIDs=M.subtree(d(),planRoot.id);demoIDs.add(formatted.id);demoIDs.add(pastedImage.id);
current.canvas={nodes:M.clone(d().nodes.filter(n=>demoIDs.has(n.id))),edges:M.clone(d().edges.filter(e=>demoIDs.has(e.from)&&demoIDs.has(e.to))),direction:"horizontal"};
const demoRoot=d().nodes.find(n=>n.id===planRoot.id);demoRoot.collapsed=false;demoRoot.x=0;demoRoot.y=160;
d().nodes.find(n=>n.id===branches[1].id).collapsed=true;
const demoText=d().nodes.find(n=>n.id===formatted.id);demoText.x=0;demoText.y=-20;demoText.w=280;autoSize(demoText);
const demoImage=d().nodes.find(n=>n.id===pastedImage.id);demoImage.x=0;demoImage.y=370;
M.layout(d());selected=new Set([demoText.id]);inspect();fit();paint();$("toast").hidden=true;await wait(120);await native("snapshot",{name:"features"});
beginEdit(demoText);richEditor.setSelectionRange(0,5);paint();await wait(80);await native("snapshot",{name:"rich"});commitEdit();
current.canvas=v13Before;selected.clear();closeNotes();await window.flushSave();

// v1.4: local UI typography, comments, and unambiguous resize/connector handles.
const v14Before=M.clone(d());if(editing)commitEdit();closeNotes();setTool("select");
await document.fonts.load('400 12px "Google Sans"');await document.fonts.load('500 12px "Google Sans"');
assert([...document.fonts].some(f=>f.family.replaceAll('"','')==="Google Sans"&&f.status==="loaded"),"Bundled Google Sans loads offline");
assert(getComputedStyle($("documentSidebar")).fontFamily.includes("Google Sans")&&getComputedStyle($("inspector")).fontFamily.includes("Google Sans"),"Sidebar and style panel use Google Sans");
current.canvas=M.blank();const commentNode=M.node("flow",140,180,"process","A node with comments");d().nodes.push(commentNode);selected=new Set([commentNode.id]);inspect();zoom(1);
beginEdit(commentNode);assert(getComputedStyle(richEditor).fontFamily.includes("Excalifont"),"Whiteboard text editor keeps Excalifont");commitEdit();canvas.focus();
openNotes(commentNode.id);
assert(parseFloat(getComputedStyle($("newNoteText")).fontSize)===12&&getComputedStyle($("newNoteText")).fontFamily.includes("Google Sans"),"Comments use compact 12px Google Sans");
assert(getComputedStyle($("notesPanel")).boxShadow!=="none"&&getComputedStyle($("inspector")).boxShadow!=="none","Both right sidebars have visible separation shadows");
$("newNoteText").value="First comment";$("newNoteText").dispatchEvent(new Event("input"));
key($("newNoteText"),"Enter");assert(commentNode.notes.length===1&&$("newNoteText").value==="","Enter submits and clears the comment composer");
assert(!$("notesThreads").querySelector("textarea")&&!$("notesThreads").querySelector("form"),"Saved notes have no reply composer");
assert(document.activeElement===$("newNoteText"),"Single Add a note composer retains focus after sending");
const shiftReturn=new KeyboardEvent("keydown",{key:"Enter",shiftKey:true,bubbles:true,cancelable:true});
$("newNoteText").value="Two lines";assert($("newNoteText").dispatchEvent(shiftReturn),"Shift Enter allows a line break without submitting");
$("newNoteText").setRangeText("\nSecond line",9,9,"end");$("newNoteText").dispatchEvent(new Event("input"));key($("newNoteText"),"Enter");
assert(commentNode.notes.at(-1).text==="Two lines\nSecond line","Multiline comments preserve their line breaks");
$("newNoteText").value="Composing";const compositionReturn=new KeyboardEvent("keydown",{key:"Enter",isComposing:true,bubbles:true,cancelable:true});
assert($("newNoteText").dispatchEvent(compositionReturn)&&commentNode.notes.length===2,"Enter during text composition never sends a comment");
$("newNoteText").value="";closeNotes();
for(const z of [.2,1,2]) {
  zoom(z);const badge=noteBadge(commentNode);pointer("pointermove",badge.x+8,badge.y+10);
  assert(canvas.style.cursor==="pointer","Comment badge shows a clickable cursor at zoom "+z);
  pointer("pointerdown",badge.x+badge.w-5,badge.y+12);pointer("pointerup",badge.x+badge.w-5,badge.y+12);
  assert(notesNodeId===commentNode.id,"Clicking the comment count opens its thread at zoom "+z);
  closeNotes();pointer("pointerdown",commentNode.x+commentNode.w/2,commentNode.y+commentNode.h/2);pointer("pointerup",commentNode.x+commentNode.w/2,commentNode.y+commentNode.h/2);
  assert(notesNodeId===null&&$("notesPanel").hidden,"Clicking a node selects without opening comments at zoom "+z);
}
for(const z of [.2,.5,1,2]) {
  zoom(z);current.canvas=M.blank();const box=M.node("flow",140,180,"process","Text reflows when the node width changes");box.w=260;box.h=120;d().nodes.push(box);selected=new Set([box.id]);
  assert(ports(box).map(p=>p.side).join(",")==="top,right,bottom,left","Exactly four cardinal connector points at zoom "+z);
  for(const side of ["l","r","t","b","tl","tr","bl","br"]) {
    Object.assign(box,{x:140,y:180,w:260,h:120});const old={...box},h=resizeHandles(box).find(h=>h.side===side);
    pointer("pointermove",h.x,h.y);assert(canvas.style.cursor===h.cursor,"Resize cursor appears on "+side+" at zoom "+z);
    pointer("pointerdown",h.x,h.y);assert(drag?.type==="resize"&&drag.corner===side,"Resize takes precedence over connector on "+side+" at zoom "+z);
    const dx=side.includes("l")?-40:side.includes("r")?40:0,dy=side.includes("t")?-30:side.includes("b")?30:0;
    pointer("pointermove",h.x+dx,h.y+dy);pointer("pointerup",h.x+dx,h.y+dy);
    assert(d().edges.length===0&&!drag,"Resizing never creates a connector at zoom "+z);
    if(dx)assert(box.w===old.w+40,"Side and corner resize changes width at zoom "+z);
    if(dy)assert(box.h>=old.h+30,"Top and bottom resize changes height at zoom "+z);
    if(side.includes("l"))assert(box.x+box.w===old.x+old.w,"Left resize anchors the opposite edge");
    if(side.includes("t"))assert(box.y+box.h===old.y+old.h,"Top resize anchors the opposite edge");
  }
  Object.assign(box,{x:140,y:180,w:260,h:120});const rightHandle=resizeHandles(box).find(h=>h.side==="r");pointer("pointerdown",rightHandle.x,rightHandle.y);pointer("pointermove",box.x-200,rightHandle.y);
  assert(box.w===80&&box.h>=textLines(ctx,box).length*box.fontSize*1.15+12,"Minimum width clamps and text reflows without clipping");
  assert(canvas.style.cursor==="ew-resize","Resize cursor remains visible at the minimum size");pointer("pointerup",box.x-200,rightHandle.y);
  const minHandle=resizeHandles(box).find(h=>h.side==="r");pointer("pointermove",minHandle.x,minHandle.y);assert(canvas.style.cursor==="ew-resize","Minimum-size node retains its resize affordance");
  for(const port of ports(box)) {pointer("pointerdown",port.x,port.y);assert(drag?.type==="connect","Cardinal port still starts a connector at zoom "+z);cancelDrag();}
}
zoom(1);current.canvas=M.blank();const resizeRoot=M.node("mind",100,100,"process","Root"),resizeChild=M.node("flow",500,100,"process","Unrelated");d().nodes.push(resizeRoot,resizeChild);const descendant=M.extend(d(),resizeRoot.id,true);descendant.text="Aligned child";M.layout(d());selected=new Set([resizeRoot.id]);const rr=resizeHandles(resizeRoot).find(h=>h.side==="r");const initialRootWidth=resizeRoot.w;pointer("pointerdown",rr.x,rr.y);pointer("pointermove",rr.x+100,rr.y);pointer("pointerup",rr.x+100,rr.y);
assert(resizeRoot.w===initialRootWidth+100&&descendant.x===resizeRoot.x+resizeRoot.w+92&&resizeChild.x===500,"Mind-map resize persists and realigns descendants without moving unrelated shapes");
undo();assert(d().nodes.find(n=>n.id===resizeRoot.id).w===initialRootWidth,"Node resize supports undo");redo();assert(d().nodes.find(n=>n.id===resizeRoot.id).w===initialRootWidth+100,"Node resize supports redo");
const resizedSaved=M.clone(d());await window.flushSave();const reloadedResize=(await native("load")).state.documents.find(doc=>doc.id===current.id).canvas;assert(M.validate(reloadedResize)&&reloadedResize.nodes.length===resizedSaved.nodes.length&&reloadedResize.nodes.every((n,i)=>["id","x","y","w","h","parent"].every(field=>n[field]===resizedSaved.nodes[i][field])),"Resized dimensions survive native save and reload");
// Preserve previously saved corner attachments even though new handles are cardinal only.
const legacyLink=M.connect(d(),resizeRoot.id,resizeChild.id,{fromSide:"top-right",toSide:"bottom-left"});assert(edgeGeometry(legacyLink).sa==="top-right","Existing corner-attached connectors remain compatible");
current.canvas=v14Before;selected.clear();closeNotes();await window.flushSave();

// Circle shapes share text editing, connectors, resizing, clipboard and storage.
const circleBefore=M.clone(d());closeNotes();current.canvas=M.blank();setTool("select");zoom(1);
let circleRoot=M.node("mind",100,100,"process","Central idea");d().nodes.push(circleRoot);selected=new Set([circleRoot.id]);inspect();
$("shapeStyle").value="circle";$("shapeStyle").dispatchEvent(new Event("change"));
assert(circleRoot.shape==="circle"&&circleRoot.w===circleRoot.h,"Inspector converts mind-map roots to true circles");
let circleChild=M.extend(d(),circleRoot.id,true);circleChild.text="A circular child";selected=new Set([circleChild.id]);styleSelection("shape","circle");
assert(circleChild.shape==="circle"&&circleChild.w===circleChild.h,"Circle is available on mind-map children");
beginEdit(circleChild);type("A circle with several words that wrap inside its outline");commitEdit();
assert(circleChild.w===circleChild.h&&textLines(ctx,circleChild).length*circleChild.fontSize*1.15+24<=circleChild.h*Math.SQRT1_2,"Editing circle text grows its diameter and keeps text inside the outline");
for(const align of ["left","center","right"]) {
  styleSelection("textAlign",align);
  assert(richLines(ctx,circleChild).every(line=>line.width<=textWrapWidth(circleChild)+.1),"Circle text fits its padded interior with "+align+" alignment");
}
styleSelection("textAlign","center");
assert(hitNode({x:circleRoot.x+1,y:circleRoot.y+1})!==circleRoot&&hitNode({x:circleRoot.x+circleRoot.w/2,y:circleRoot.y+circleRoot.h/2})===circleRoot,"Circle hit testing excludes empty bounding-box corners");
for(const side of ["top","right","bottom","left","top-right","bottom-left"]) {
 const a=anchor(circleRoot,side);assert(Math.abs(Math.hypot(a.x-circleRoot.x-circleRoot.w/2,a.y-circleRoot.y-circleRoot.h/2)-circleRoot.w/2)<.01,"Circle connector attaches to outline at "+side);
}
selected=new Set([circleRoot.id]);
for(const side of ["l","r","t","b","tl","tr","bl","br"]) {
 const h=resizeHandles(circleRoot).find(h=>h.side===side),oldW=circleRoot.w;
 const dx=side.includes("l")?-20:side.includes("r")?20:0,dy=side.includes("t")?-20:side.includes("b")?20:0;
 pointer("pointerdown",h.x,h.y);pointer("pointermove",h.x+dx,h.y+dy);pointer("pointerup",h.x+dx,h.y+dy);
 assert(circleRoot.w===oldW+20&&circleRoot.w===circleRoot.h,"Circle keeps equal dimensions after "+side+" resize and tree layout");
}
const circleResizedWidth=circleRoot.w;undo();assert(d().nodes.find(n=>n.id===circleRoot.id).w===circleResizedWidth-20,"Circle resize can be undone");redo();circleRoot=d().nodes.find(n=>n.id===circleRoot.id);circleChild=d().nodes.find(n=>n.id===circleChild.id);
assert(circleRoot.w===circleResizedWidth&&circleRoot.w===circleRoot.h,"Circle resize can be redone");
selected=new Set([circleChild.id]);const circleHandle=resizeHandles(circleChild).find(h=>h.side==="r");pointer("pointerdown",circleHandle.x,circleHandle.y);pointer("pointermove",circleChild.x-100,circleHandle.y);pointer("pointerup",circleChild.x-100,circleHandle.y);
assert(circleChild.w===circleChild.h&&textLines(ctx,circleChild).length*circleChild.fontSize*1.15+24<=circleChild.h*Math.SQRT1_2,"Shrinking a circle stops before its text clips");
await copyEditable();await pasteEditable();const circleCopy=d().nodes.at(-1);assert(circleCopy.shape==="circle"&&circleCopy.text===circleChild.text&&circleCopy.w===circleCopy.h,"Editable clipboard preserves circle geometry and text");
await exportPNG(true,"selection","transparent",1);assert((await native("clipboardProbe")).png,"Circle exports as PNG through the shared renderer");
await window.flushSave();const savedCircle=(await native("load")).state.documents.find(doc=>doc.id===current.id).canvas.nodes.find(n=>n.id===circleRoot.id);assert(savedCircle.shape==="circle"&&savedCircle.w===circleRoot.w&&savedCircle.h===circleRoot.h,"Circle survives native save and reload");
M.remove(d(),[circleCopy.id]);circleRoot.w=circleRoot.h=180;circleChild.text="A circular child";circleChild.w=circleChild.h=180;autoSize(circleChild);M.layout(d());selected=new Set([circleChild.id]);inspect();fit();paint();await wait(100);await native("snapshot",{name:"circle"});
current.canvas=circleBefore;selected.clear();inspect();await window.flushSave();

// Batch C: a marquee selects every connector whose drawn line or label touches
// it, even with a shape outside, and a selected connector shows a soft halo
// along its drawn path that never reaches an export or View only.
{
  const before=M.clone(d());closeNotes();current.canvas=M.blank();setTool("select");zoom(1);
  const ma=M.node("flow",100,100,"process","Marquee A"),mb=M.node("flow",600,100,"process","Marquee B"),
    mc=M.node("flow",100,400,"process","Marquee C"),md=M.node("flow",600,400,"process","Marquee D");
  for(const n of [ma,mb,mc,md]){n.w=160;n.h=80;}
  d().nodes.push(ma,mb,mc,md);
  const top=M.connect(d(),ma.id,mb.id,{fromSide:"right",toSide:"left"}),
    bottom=M.connect(d(),mc.id,md.id,{fromSide:"right",toSide:"left"}),
    side=M.connect(d(),ma.id,mc.id,{fromSide:"bottom",toSide:"top"});
  top.style=bottom.style=side.style="straight";bottom.label="Yes";top.label="Go";top.labelT=.75;
  selected.clear();inspect();paint();
  const drag=(x0,y0,x1,y1,extra={})=>{pointer("pointerdown",x0,y0,extra);pointer("pointermove",x1,y1,extra);pointer("pointerup",x1,y1,extra);};
  drag(80,80,300,185);
  assert(selected.has(ma.id)&&selected.has(top.id)&&!selected.has(mb.id)&&!selected.has(side.id)&&!selected.has(bottom.id),"Marquee selects a connector whose line it touches even with the far shape outside");
  assert($("selectionLabel").textContent==="2 SELECTED ELEMENTS"&&!$("fontFamily").parentElement.hidden&&!$("edgeStyle").parentElement.hidden,"Style panel shows shape and connector controls for a mixed selection");
  const bl=edgeLabel(bottom);
  drag(bl.x+2,bl.y-12,bl.x+bl.w-2,bl.y+2);
  assert(selected.size===1&&selected.has(bottom.id),"Marquee touching only a connector label selects that connector");
  drag(300,250,500,330);
  assert(!selected.size,"A marquee that touches no line or label leaves connectors unselected");
  drag(80,80,300,185);
  const fontBefore=M.clone(d());
  $("fontFamily").value="Google Sans";$("fontFamily").dispatchEvent(new Event("change"));
  assert(ma.fontFamily==="Google Sans"&&top.fontFamily==="Google Sans"&&bottom.fontFamily!=="Google Sans","A font change after a marquee reaches the selected connector's label");
  undo();
  assert(M.same(d(),fontBefore),"The font change on shapes and labels undoes as one step");
  const [ua,ub,uc,ud]=[ma,mb,mc,md].map(n=>d().nodes.find(a=>a.id===n.id)),
    [utop,ubottom]=[top,bottom].map(e=>d().edges.find(a=>a.id===e.id));
  const halo=(x,y)=>{const r=devicePixelRatio||1;for(const dy of [-5,-4,4,5]){const p=ctx.getImageData(Math.round((x*view.z+view.x)*r),Math.round(((y+dy)*view.z+view.y)*r),1,1).data;if(p[2]-p[0]>20&&p[0]>150)return true;}return false;};
  const lineY=edgeGeometry(utop).p.y,lineX=(ua.x+ua.w+ub.x)/2-40;
  selected.clear();focusOn({x:lineX,y:lineY});
  assert(!halo(lineX,lineY),"An unselected connector has no halo");
  selected=new Set([utop.id]);paint();
  assert(halo(lineX,lineY),"A selected connector draws a soft blue halo along its line");
  const tl=edgeLabel(utop);
  assert((()=>{const r=devicePixelRatio||1,p=ctx.getImageData(Math.round((tl.x-2)*view.z+view.x)*r,Math.round((tl.y+1)*view.z+view.y)*r,1,1).data;return p[2]-p[0]>20;})(),"The halo also surrounds the connector label");
  await native("snapshot",{name:"connector-halo"});
  utop.style="curved";utop.bend={x:lineX,y:lineY+60};paint();
  const curve=edgePolyline(utop,edgeGeometry(utop)),mid=curve[Math.floor(curve.length/3)];
  assert(halo(mid.x,mid.y),"The halo follows a curved, bent connector's drawn path");
  delete utop.bend;utop.style="straight";
  selected=new Set([utop.id,ubottom.id]);focusOn({x:lineX,y:edgeGeometry(ubottom).p.y});
  assert(halo(lineX,edgeGeometry(ubottom).p.y),"Every multi-selected connector gets the halo");
  const pngNative=native,pngs=[];native=async(action,data)=>{if(action==="png"){pngs.push(data.data);return null;}return pngNative(action,data);};
  try{await exportPNG(false,"all");selected.clear();await exportPNG(false,"all");}finally{native=pngNative;}
  assert(pngs.length===2&&pngs[0]===pngs[1],"PNG export is identical with or without a selected connector's halo");
  selected=new Set([utop.id]);setViewOnly(true);selected=new Set([utop.id]);focusOn({x:lineX,y:lineY});
  assert(!halo(lineX,lineY),"View only hides the connector halo");
  setViewOnly(false);
  current.canvas=before;selected.clear();inspect();await window.flushSave();
}

const title = current.title,
  id = current.id;
// Duplicate, Trash and Restore run from the sidebar while the document is open.
docAction("duplicate", id);
assert(state.documents.length === 2, "Document duplicate is independent");
await docAction("trash", id);
assert(
  state.documents.find((n) => n.id === id).trashedAt > 0,
  "Trash preserves document",
);
docAction("restore", id);
assert(
  state.documents.find((n) => n.id === id).trashedAt === null,
  "Trash document can be restored",
);
$("toast").hidden=true;
openDoc(id);
const text = d().nodes.find((n) => n.kind === "text");
text.text = "From idea to plan";
autoSize(text);
text.w = 360;
autoSize(text);
selected.clear();
fit();
await window.flushSave();
clearTimeout(changedView.timer);
$("toast").hidden = true;
await wait(500);
const previewNode = d().nodes.find((n) => n.kind === "mind");
if (previewNode) {
  M.addNote(
    d(),
    previewNode.id,
    "Confirm the assumptions before the next review.",
  );
  M.addNote(
    d(),
    previewNode.id,
    "Updated with the latest feedback.",
    previewNode.notes[0].id,
  );
  openNotes(previewNode.id);
  await window.flushSave();
  paint();await wait(200);await native("snapshot",{name:"comments"});
}
await native("log", { message: `STRAY blocked=${strayPointers}` });
assert(!browserErrors.length,"No uncaught browser errors");
return results;
