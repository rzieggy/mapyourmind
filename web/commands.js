"use strict";
// Open in Browser in the app; Back to app in a tab that the app opened.
function addBrowserCommand(add) {
  if (!window.mapyourmindBrowser) add("browser", "Open in Browser", "Document", () => window.openInBrowser());
  else if (window.backToApp) add("back-to-app", "Back to app", "Document", () => window.backToApp());
}
function commandCatalog() {
  const nodes = d()?.nodes.filter(n => selected.has(n.id)) || [];
  const edges = d()?.edges.filter(e => selected.has(e.id)) || [];
  const commands = [];
  const add = (id, label, category, run, shortcut = "") => commands.push({id,label,category,run,shortcut});
  if (isNotebook()) {
    add("find", "Find in note…", "Edit", openFind, "⌘F");
    add("note-undo", "Undo text edit", "Edit", () => notebookUndo(), "⌘Z");
    add("note-redo", "Redo text edit", "Edit", () => notebookUndo(true), "⌘⇧Z");
    add("note-export", "Export PDF…", "Document", exportNotePDF, "⌘E");
    add("new", "New document…", "Document", newDoc, "⌘N");
    add("home", "Open document library", "Document", goHome);
    addBrowserCommand(add);
    add("help", "Show keyboard shortcuts", "Help", help);
    return commands;
  }
  if (viewOnly) {
    if (selected.size) add("copy", "Copy", "View", copyEditable, "⌘C");
    add("fit", "Fit diagram", "View", fit, "⌘0");
    add("find", "Find in board…", "View", openFind, "⌘F");
    return commands;
  }
  for (const [id,label,shortcut] of [["select","Select tool","V"],["hand","Pan tool","H"],["shape","Shape tool","R"],["mind","Mind-map root tool","M"],["text","Text tool","T"],["connector","Connector tool","C"]])
    add("tool-"+id,label,"Tools",()=>setTool(id),shortcut);
  add("find", "Find in board…", "Edit", openFind, "⌘F");
  if (typeof openTemplatePicker === "function") {
    add("templates","Insert template…","Insert",openTemplatePicker);
    add("eisenhower","Insert Eisenhower Matrix","Insert",()=>insertTemplate("eisenhower"));
    add("tool-line","Line tool","Tools",()=>setTool("line"),"L");
  }
  if (history.past.length) add("undo","Undo","Edit",undo,"⌘Z");
  if (history.future.length) add("redo","Redo","Edit",redo,"⌘⇧Z");
  add("paste","Paste","Edit",pasteEditable,"⌘V");
  if (selected.size) {
    add("copy","Copy","Edit",copyEditable,"⌘C");
    add("cut","Cut","Edit",()=>copyEditable(true),"⌘X");
    add("duplicate","Duplicate","Object",duplicate,"⌘D");
  }
  if (nodes.length) {
    for (const [action,label] of [["front","Bring to front"],["forward","Bring forward"],["backward","Send backward"],["back","Send to back"]])
      add("layer-"+action,label,"Arrange",()=>layerSelection(action));
    if (nodes.length === 1 && !nodes[0].attachmentTo && ["flow","mind"].includes(nodes[0].kind)) {
      add("child","Add child","Object",()=>extendNode(nodes[0],true),"Tab");
      add("sibling","Add sibling","Object",()=>extendNode(nodes[0],false),"Enter");
    }
    if (nodes.length === 1 && nodes[0].kind !== "line") add("comment","Add comment","Object",()=>openNotes(nodes[0].id),"⌘⌥C");
    if (nodes.length > 1) add("group","Group","Object",()=>grouping(),"⌘G");
    if (nodes.some(n=>n.group)) add("ungroup","Ungroup","Object",()=>grouping(true),"⌘⇧G");
    const eligible = nodes.filter(n=>n.kind!=="mind" && !n.attachmentTo);
    if (eligible.length > 1) for(const [action,label] of [["left","Align left"],["center","Align horizontal centers"],["right","Align right"],["top","Align top"],["middle","Align vertical centers"],["bottom","Align bottom"],["horizontal","Distribute horizontally"],["vertical","Distribute vertically"]]) {
      if (["horizontal","vertical"].includes(action) && eligible.length < 3) continue;
      add("align-"+action,label,"Arrange",()=>align(action));
    }
  }
  if (selected.size) add("delete","Delete selected elements",edges.length ? "Connector" : "Object",removeSelection,"⌫");
  if (edges.length) for(const style of ["straight","curved","elbow"])
    add("edge-"+style,"Use "+style+" connector","Connector",()=>styleSelection("style",style));
  if(typeof resetSelectedRoutes === "function" && edges.some(e=>!e.tree)) add("reset-route","Reset connector route","Connector",resetSelectedRoutes);
  if(edges.length && edges.every(e=>!e.tree)) add("edge-arrow","Toggle destination arrow","Connector",()=>styleSelection("arrow",!edges[0].arrow));
  if (d()?.nodes.some(n=>n.kind==="mind")) add("arrange","Arrange mind maps","Arrange",arrangeMindMaps);
  if (d()?.nodes.length) {
    add("fit","Fit diagram","View",fit,"⌘0");
    add("export","Export PNG…","Document",exportDialog,"⌘E");
    add("export-pdf","Export PDF…","Document",exportBoardPDFDialog);
  }
  add("actual","Actual size","View",()=>zoom(1),"⌘⇧0");
  add("new","New document…","Document",newDoc,"⌘N");
  addBrowserCommand(add);
  add("import","Import mind map…","Document",chooseMindmapImport);
  add("home","Open document library","Document",goHome);
  add("settings","Settings…","Document",defaultsPanel,"⌘,");
  add("help","Show keyboard shortcuts","Help",help);
  const priority = edges.length ? "Connector" : nodes.length ? "Object" : "Tools";
  return commands.sort((a,b)=>(a.category===priority?0:1)-(b.category===priority?0:1));
}
// The catalog also supplies contextual actions; the command palette is disabled.
function openCommandMenu() {}
