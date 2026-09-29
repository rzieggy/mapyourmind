"use strict";
let recentCommands = [], commandMatches = [], commandIndex = 0;
function commandCatalog() {
  const nodes = d()?.nodes.filter(n => selected.has(n.id)) || [];
  const edges = d()?.edges.filter(e => selected.has(e.id)) || [];
  const commands = [];
  const add = (id, label, category, run, shortcut = "") => commands.push({id,label,category,run,shortcut});
  if (isNotebook()) {
    add("note-undo", "Undo text edit", "Edit", () => notebookUndo(), "⌘Z");
    add("note-redo", "Redo text edit", "Edit", () => notebookUndo(true), "⌘⇧Z");
    add("note-export", "Export PDF…", "Document", exportNotePDF, "⌘E");
    add("new", "New document…", "Document", newDoc, "⌘N");
    add("home", "Open document library", "Document", goHome);
    add("help", "Show keyboard shortcuts", "Help", help);
    return commands;
  }
  for (const [id,label,shortcut] of [["select","Select tool","V"],["hand","Pan tool","H"],["shape","Shape tool","R"],["mind","Mind-map root tool","M"],["text","Text tool","T"],["connector","Connector tool","C"]])
    add("tool-"+id,label,"Tools",()=>setTool(id),shortcut);
  if (typeof openTemplatePicker === "function") {
    add("templates","Insert template…","Insert",openTemplatePicker);
    add("eisenhower","Insert Eisenhower Matrix","Insert",()=>insertTemplate("eisenhower"));
    add("tool-line","Line tool","Tools",()=>setTool("line"),"L");
  }
  if (history.past.length) add("undo","Undo","Edit",undo,"⌘Z");
  if (history.future.length) add("redo","Redo","Edit",redo,"⌘⇧Z");
  add("paste","Paste","Edit",pasteEditable,"⌘V");
  if (nodes.length) {
    add("duplicate","Duplicate","Object",duplicate,"⌘D");
    add("copy","Copy","Edit",copyEditable,"⌘C");
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
  }
  add("actual","Actual size","View",()=>zoom(1),"⌘⇧0");
  add("new","New document…","Document",newDoc,"⌘N");
  add("import","Import mind map…","Document",chooseMindmapImport);
  add("home","Open document library","Document",goHome);
  add("settings","Edit creation defaults…","Document",defaultsPanel,"⌘,");
  add("help","Show keyboard shortcuts","Help",help);
  const priority = edges.length ? "Connector" : nodes.length ? "Object" : "Tools";
  return commands.sort((a,b)=>(a.category===priority?0:1)-(b.category===priority?0:1));
}
function openCommandMenu() {
  if (!current || $("modal").open || $("templatePicker")?.open) return;
  if ($("commandMenu").open) { closeCommandMenu(); return; }
  if (drag) cancelDrag();
  closeContextMenu();
  if (editing) commitEdit();
  if (isNotebook()) syncNotebook();
  $("commandSearch").value="";
  $("commandMenu").showModal();
  updateCommandResults(); $("commandSearch").focus();
}
function closeCommandMenu() { $("commandMenu").close(); (isNotebook() ? $("noteBody") : canvas).focus(); }
function updateCommandResults() {
  const query=$("commandSearch").value.trim().toLowerCase(), all=commandCatalog();
  commandMatches=all.filter(c=>(c.label+" "+c.category).toLowerCase().includes(query));
  if (!query) commandMatches.sort((a,b)=>{
    const rank=c=>recentCommands.includes(c.id)?recentCommands.indexOf(c.id):-1;
    const x=rank(a),y=rank(b);return (x<0?100:x)-(y<0?100:y);
  });
  commandIndex=0;
  const results=$("commandResults");results.replaceChildren();let category="";
  for (const [i,c] of commandMatches.entries()) {
    const group=!query && recentCommands.includes(c.id)?"Recently used":c.category;
    if(group!==category){const h=document.createElement("h3");h.textContent=group;results.append(h);category=group;}
    const b=document.createElement("button");b.id="command-result-"+i;b.role="option";b.tabIndex=-1;
    const label=document.createElement("span"),key=document.createElement("kbd");label.textContent=c.label;key.textContent=c.shortcut;b.append(label,key);
    b.onclick=()=>runCommandAt(i);results.append(b);
  }
  if(!commandMatches.length) results.textContent="No matching commands.";
  highlightCommand();
}
function highlightCommand() {
  [...$("commandResults").querySelectorAll("button")].forEach((b,i)=>b.setAttribute("aria-selected",String(i===commandIndex)));
  $("commandSearch").setAttribute("aria-activedescendant",commandMatches.length?"command-result-"+commandIndex:"");
  $("command-result-"+commandIndex)?.scrollIntoView({block:"nearest"});
}
async function runCommandAt(index) {
  const command=commandMatches[index];if(!command)return;
  closeCommandMenu();
  try { await command.run(); recentCommands=[command.id,...recentCommands.filter(id=>id!==command.id)].slice(0,6); }
  catch(error){toast(error.message||"Could not run this command.");}
}
$("closeCommands").onclick=closeCommandMenu;
$("commandSearch").oninput=updateCommandResults;
$("commandMenu").addEventListener("cancel",e=>{e.preventDefault();closeCommandMenu();});
$("commandMenu").addEventListener("keydown",e=>{
  e.stopPropagation();
  if(e.key==="Escape"){e.preventDefault();closeCommandMenu();}
  if(["ArrowDown","ArrowUp"].includes(e.key)) {e.preventDefault();if(commandMatches.length)commandIndex=(commandIndex+(e.key==="ArrowDown"?1:commandMatches.length-1))%commandMatches.length;highlightCommand();}
  if(e.key==="Enter" && e.target!==$("closeCommands")){e.preventDefault();runCommandAt(commandIndex);}
  if(e.key==="Tab"){e.preventDefault();(document.activeElement===$("commandSearch")?$("closeCommands"):$("commandSearch")).focus();}
});
document.addEventListener("keydown",e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"&&!e.isComposing){e.preventDefault();e.stopImmediatePropagation();openCommandMenu();}
},true);
