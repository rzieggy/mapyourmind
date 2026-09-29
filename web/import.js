"use strict";
function buildImportedDocument(input) {
  const file = MindmapImport.parse(input), graph = M.blank();
  graph.direction = file.layout;
  function add(source, parent = null, order = 0) {
    const n = M.node("mind", 0, 0, "process", source.text);
    n.parent = parent?.id || null;
    n.order = order;
    if (parent) { n.shape = "process"; n.fill = "#ffffff"; }
    graph.nodes.push(n);
    for (const text of source.notes) M.addNote(graph, n.id, text);
    if (parent) M.connect(graph, parent.id, n.id, { tree: true, style: "curved", arrow: false });
    autoSize(n);
    source.children.forEach((child, index) => add(child, n, index));
  }
  add(file.root);
  M.layout(graph);
  if (!M.validate(graph)) throw Error("The imported mind map could not be built. No document was created.");
  return { id: M.uid(), title: uniqueName(file.title), mode: "mindmap", fontVersion: "excalifont-v1", connectorVersion: 3, created: Date.now(), updated: Date.now(), trashedAt: null, trashElapsed: 0, canvas: graph };
}
async function importMindmapText(text) {
  if (!loaded) throw Error("Wait for local documents to finish loading.");
  const doc = buildImportedDocument(text);
  await window.flushSave();
  state.documents.unshift(doc);
  changed();
  openDoc(doc.id);
  fit();
  await window.flushSave();
  toast(`Imported ${doc.canvas.nodes.length} nodes.`);
  return doc;
}
async function chooseMindmapImport() {
  if (!loaded) return;
  if (editing) commitEdit();
  try {
    const file = await native("importMindmap");
    if (file === null) return;
    await importMindmapText(file);
  } catch (e) {
    showModal(`<h2>Could not import mind map</h2><p>${esc(e.message)}</p><div class="actions"><button data-close>Close</button></div>`);
  }
}
$("importMindmap").onclick = chooseMindmapImport;
$("importMindmapCanvas").onclick = chooseMindmapImport;
