const results = [], errors = [];
window.addEventListener("error", e => errors.push(e.message));
function assert(ok, label) { if (!ok) throw Error(label); results.push(label); }
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
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
for (let i=0; i<100 && !loaded; i++) await wait(50);
assert(loaded, "Local store loaded");
await document.fonts.ready;
$("newDoc").click(); $("nameInput").value = "Feedback verification"; $("nameSubmit").click();
const primary = current.id;
function pointer(type, x, y, extra={}) {
  const b = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent(type, {clientX:x*view.z+view.x+b.left,clientY:y*view.z+view.y+b.top,pointerId:1,button:0,bubbles:true,cancelable:true,...extra}));
}
function key(key, extra={}) { richEditor.dispatchEvent(new KeyboardEvent("keydown", {key,bubbles:true,cancelable:true,...extra})); }
function type(text) { richEditor.value=text; richEditor.dispatchEvent(new Event("input")); }
const root=M.node("mind",0,80,"process","Release plan"); d().nodes.push(root);
const a=M.extend(d(),root.id,true); a.text="Old parent";
const b=M.extend(d(),a.id,false); b.text="New parent";
const child=M.extend(d(),a.id,true); child.text="Move this branch";
const leaf=M.extend(d(),child.id,true); leaf.text="Keep this child";
M.layout(d()); selected=new Set([child.id]); setTool("select"); fit();
const target={x:b.x+b.w+18,y:b.y+b.h/2};
pointer("pointerdown",child.x+30,child.y+child.h/2);
pointer("pointermove",target.x,target.y);
assert(hover?.id===b.id&&hover.mode==="parent","Drag recognizes new parent beside its right edge");
paint();
assert($("contextHint").textContent.includes("New parent"),"Drop helper identifies destination parent");
pointer("pointerup",target.x,target.y);
assert(child.parent===b.id&&leaf.parent===child.id&&M.validate(d()),"Reparent retains complete subtree and valid connectors");
undo(); assert(d().nodes.find(n=>n.id===child.id).parent===a.id,"Undo restores old parent");
redo(); assert(d().nodes.find(n=>n.id===child.id).parent===b.id,"Redo restores new parent");
assert(!M.reparent(d(),b.id,leaf.id)&&M.validate(d()),"Cycle reparent is rejected");

const edited=d().nodes.find(n=>n.id===child.id);
zoom(.57);
selected=new Set([edited.id]); beginEdit(edited); type("First"); richEditor.setSelectionRange(5);
assert(getComputedStyle(richEditor).transform==="none"&&Math.abs(parseFloat(getComputedStyle(richEditor).fontSize)-edited.fontSize*view.z)<.01&&Math.abs(richEditor.getBoundingClientRect().width-edited.w*view.z)<=.51/devicePixelRatio,"Active text editor renders at native zoom dimensions without a blurry CSS transform");
const caretBefore=getSelection().getRangeAt(0).getBoundingClientRect();
key("Enter",{shiftKey:true});
assert(edited.text==="First\n"&&richEditor.selectionStart===6,"Shift Enter immediately inserts newline and moves caret");
assert(richEditor.querySelector('[data-caret-end]'),"Trailing newline has a visible WebKit caret line");
await wait(50);
const caretLineRange=getSelection().getRangeAt(0).cloneRange();
// WebKit returns an empty rectangle for a collapsed element-boundary range;
// measure the BR line box at that boundary, which is where it paints the caret.
caretLineRange.selectNode(richEditor.querySelector('[data-caret-end]'));
const caretAfter=caretLineRange.getBoundingClientRect();
await native("snapshot",{name:"rich"});
assert(caretAfter.height>0&&caretAfter.top>caretBefore.top,"Visible caret moves down immediately, before typing another character");
richEditor.setRangeText("Second",6,6,"end");richEditor.dispatchEvent(new Event("input"));
assert(edited.text==="First\nSecond","Typing after Shift Enter stays on the new line");
key("Escape");beginEdit(edited);assert(editorText()==="First\nSecond","Newline survives commit and reopen");key("Escape");

selected=new Set([edited.id]);inspect();beginEdit(edited);
const panel=$("inspector"), rect=panel.getBoundingClientRect();
edited.x=(rect.left+20-canvas.getBoundingClientRect().left-view.x)/view.z;
edited.y=(rect.top+40-canvas.getBoundingClientRect().top-view.y)/view.z;
positionEditor();await wait(50);
assert(panel.contains(document.elementFromPoint(rect.left+35,rect.top+60)),"Sidebar stays above overlapping node text editor");
key("Escape");

openNotes(edited.id);assert(selected.size===0&&notesNodeId===edited.id,"Comment state does not select the node");
assert(!$("notesPanel").textContent.includes("Keep context close"),"Notes panel has no filler text");
$("newNoteText").value="First note";$("newNoteForm").requestSubmit();
$("newNoteText").value="Second note";$("newNoteForm").requestSubmit();
assert(edited.notes.length===2&&document.activeElement===$("newNoteText"),"Single note composer supports repeated entry");
assert(!$("notesThreads").querySelector("textarea,form"),"Saved notes have no nested reply field");
const dimensions=[];
for(const z of [.2,1,2]) {
  zoom(z);const badge=noteBadge(edited);dimensions.push(badge.w);
  assert(hitNoteBadge({x:badge.x+badge.w/2,y:badge.y+12})?.id===edited.id,"Comment hit target follows zoom "+z);
}
assert(new Set(dimensions).size===1,"Badge uses constant world dimensions, scaling with canvas");
closeNotes();zoom(1);

current.canvas=M.blank();const flow=M.node("flow",0,0,"process","A long sentence which should wrap into multiple lines inside a narrow node");flow.w=150;autoSize(flow);d().nodes.push(flow);selected=new Set([flow.id]);inspect();
const fillColors=$("fillColors"),transparentFill=fillColors.querySelector('[data-color="transparent"]');transparentFill.click();assert(flow.fill==="transparent"&&transparentFill.classList.contains("active"),"Shapes support a transparent fill from the inspector");
assert(fillColors.firstElementChild===transparentFill,"Transparent fill stays first in the palette");
assert([...fillColors.querySelectorAll("button")].every(swatch=>swatch.getBoundingClientRect().width===28),"Fill swatches keep their full size inside the inspector");
fillColors.scrollLeft=fillColors.scrollWidth;assert(fillColors.scrollWidth>fillColors.clientWidth&&fillColors.scrollLeft>0,"Overflowing fill colors scroll horizontally instead of squeezing");fillColors.scrollLeft=0;
assert(getComputedStyle(fillColors).scrollbarWidth==="none","Scrollable color palettes hide their scrollbar");
assert([...$("highlightColors").children].every(swatch=>swatch.getBoundingClientRect().width===28),"Highlight swatches keep their full size");
const layerMiddle=M.node("flow",0,0,"process","Middle"),layerTop=M.node("flow",0,0,"process","Top");d().nodes.push(layerMiddle,layerTop);selected=new Set([flow.id]);inspect();
$("layerTools").querySelector('[data-layer="front"]').click();assert(d().nodes.at(-1)===flow&&hitNode({x:20,y:20})===flow,"To front moves the selected object above overlapping objects");
$("layerTools").querySelector('[data-layer="backward"]').click();assert(d().nodes.at(-2)===flow,"Backward moves the selected object down one layer");
$("layerTools").querySelector('[data-layer="back"]').click();assert(d().nodes[0]===flow,"To back moves the selected object behind every object");
$("layerTools").querySelector('[data-layer="forward"]').click();assert(d().nodes[1]===flow,"Forward moves the selected object up one layer");
M.remove(d(),[layerMiddle.id,layerTop.id]);selected=new Set([flow.id]);inspect();
const initialHeight=flow.h, initialLines=textLines(ctx,flow).length, y=flow.y+flow.h/2;
pointer("pointerdown",flow.x+flow.w,y);pointer("pointermove",flow.x+550,y);pointer("pointerup",flow.x+550,y);
// Reversed on 24 September 2026: widening still reflows the text onto fewer
// lines, but the height the user set is kept. Only typing resizes a shape now.
assert(flow.w===550&&flow.h===initialHeight&&textLines(ctx,flow).length<initialLines,"Horizontal widening reflows text without shrinking the node");
const wideHeight=flow.h, y2=flow.y+flow.h/2;
pointer("pointerdown",flow.x+flow.w,y2);pointer("pointermove",flow.x+120,y2);pointer("pointerup",flow.x+120,y2);
assert(flow.w===120&&flow.h>wideHeight,"Horizontal narrowing grows node height to fit text");

const p=point({clientX:0,clientY:0});
const cb=canvas.getBoundingClientRect();
const canvasStyle=getComputedStyle(canvas);assert(canvasStyle.webkitUserSelect==="none"||canvasStyle.getPropertyValue("-webkit-user-select")==="none","Canvas cannot enter native WebKit selection");
const canvasRange=document.createRange(),nativeSelection=getSelection();canvasRange.selectNode(canvas);nativeSelection.removeAllRanges();nativeSelection.addRange(canvasRange);
canvas.dispatchEvent(new MouseEvent("contextmenu",{clientX:flow.x*view.z+view.x+cb.left+20,clientY:flow.y*view.z+view.y+cb.top+20,bubbles:true,cancelable:true}));
assert(nativeSelection.rangeCount===0,"Right-click clears a stuck native canvas selection");
assert(!contextMenu.hidden&&contextMenu.querySelector('[data-context="placeholder"]'),"Right-click menu offers Add placeholder");
contextMenu.querySelector('[data-context="placeholder"]').click();type("100%");key("Escape");
const label=d().nodes.find(n=>n.attachmentTo===flow.id);
assert(label&&label.fill==="#fff0a6"&&label.fontSize===14&&label.h<40&&label.y+label.h<flow.y,"Placeholder is compact, yellow, extra small and above owner");
beginEdit(label);type("Line one\nLine two");key("Escape");
assert(label.h<50&&label.text==="Line one\nLine two","Placeholder supports compact multiline free text");
selected=new Set([flow.id]);const oy=flow.y;
pointer("pointerdown",flow.x+30,flow.y+30);pointer("pointermove",flow.x+130,flow.y+80);pointer("pointerup",flow.x+130,flow.y+80);
assert(label.x===flow.x&&label.y===flow.y-label.h-4&&flow.y!==oy,"Placeholder follows owner drag");
selected=new Set([flow.id]);const exported=exportElements("selection");assert(exported.nodes.some(n=>n.id===label.id),"Selection PNG includes attached placeholder");
duplicate();const copy=d().nodes.find(n=>selected.has(n.id)&&!n.attachmentTo),copyLabel=d().nodes.find(n=>n.attachmentTo===copy.id);
assert(copyLabel&&copyLabel.id!==label.id&&M.validate(d()),"Duplicate remaps placeholder ownership");
M.remove(d(),[copy.id]);assert(!d().nodes.some(n=>n.id===copyLabel.id)&&d().nodes.includes(label),"Delete owner removes only its own placeholder");
selected=new Set([label.id]);M.remove(d(),[label.id]);assert(d().nodes.includes(flow),"Deleting just a placeholder preserves its owner");

const sticker=insertSticker("⭐");assert(M.validate(d())&&sticker.kind==="sticker","Sticker is a valid independent canvas element");
const off=document.createElement("canvas");off.width=160;off.height=160;const oc=off.getContext("2d");
drawSticker(oc,{...sticker,x:20,y:20});assert(oc.getImageData(0,0,160,160).data.some((v,i)=>i%4===3&&v>0),"Sticker renders into PNG canvas");
const img=M.node("image",30,30);img.w=img.h=80;img.imageData=off.toDataURL("image/png");await loadImageNode(img);
assert(img.stroke==="transparent","Pasted images default to transparent stroke");
const pixelCanvas=document.createElement("canvas");pixelCanvas.width=pixelCanvas.height=150;const pc=pixelCanvas.getContext("2d");
drawImageNode(pc,img);const plain=pc.getImageData(0,0,150,150).data.slice();pc.clearRect(0,0,150,150);
img.stroke="#ff0000";img.sw=3;drawImageNode(pc,img);const bordered=pc.getImageData(0,0,150,150).data;
assert(bordered.some((v,i)=>v!==plain[i]),"Image stroke changes actual rendered pixels");
d().nodes.push(img);selected=new Set([img.id]);inspect();$("transparentStroke").click();assert(img.stroke==="transparent","Image stroke can return to transparent");

{
  const tap=()=>{window.dispatchEvent(new KeyboardEvent("keydown",{key:" ",bubbles:true,cancelable:true}));window.dispatchEvent(new KeyboardEvent("keyup",{key:" ",bubbles:true}));};
  const root=M.node("mind",3000,3000,"process","Root");d().nodes.push(root);
  const kid=M.extend(d(),root.id,true),grand=M.extend(d(),kid.id,true),leaf=M.extend(d(),root.id,true);
  M.layout(d());selected=new Set([root.id]);const depth=history.past.length;tap();
  assert(root.collapsed===true&&!kid.collapsed&&history.past.length===depth+1,"Space collapses the selected branch as one undo step");
  tap();assert(root.collapsed===false,"Space again expands it");
  selected=new Set([leaf.id]);tap();assert(!leaf.collapsed&&history.past.length===depth+2,"Space on a node with no children does nothing");
  kid.collapsed=true;selected=new Set([root.id,kid.id,grand.id]);tap();
  assert(root.collapsed&&kid.collapsed&&selected.size===1&&selected.has(root.id),"A mixed selection collapses together and drops the nodes it hid");
  selected=new Set([root.id,kid.id]);tap();assert(!root.collapsed&&!kid.collapsed,"A fully collapsed selection expands together");
  selected=new Set([root.id]);window.dispatchEvent(new KeyboardEvent("keydown",{key:" ",bubbles:true,cancelable:true}));
  const before=root.collapsed,kept={...view};pointer("pointerdown",3400,3400);pointer("pointermove",3420,3420);pointer("pointerup",3420,3420);
  window.dispatchEvent(new KeyboardEvent("keyup",{key:" ",bubbles:true}));
  assert(root.collapsed===before&&!space&&(view.x!==kept.x||view.y!==kept.y),"Space and drag still pans without toggling the branch");Object.assign(view,kept);
}
{
  const order=[...(showPicker(0,0),$("shapePicker").querySelectorAll("button"))].map(b=>b.dataset.shape);$("shapePicker").hidden=true;
  assert(order.join()==="process,decision,pill,note,circle,io","Shape picker follows the ⌘1 to ⌘6 order");
  const step=M.node("flow",2000,2000,"decision","Tall decision");step.h=150;d().nodes.push(step);selected=new Set([step.id]);
  const count=d().nodes.length,undoDepth=history.past.length;
  canvas.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",bubbles:true,cancelable:true}));
  const made=d().nodes.at(-1);
  assert(editing?.id===made.id&&made.shape==="decision","Tab opens the inherited next node for typing");
  key("3",{metaKey:true,code:"Digit3"});
  assert(made.shape==="pill"&&editing?.id===made.id,"⌘3 reshapes the new node while its text stays open");
  type("Done");key("Escape");
  assert(d().nodes.length===count+1&&made.text==="Done","The reshaped node keeps its text");
  assert(Math.abs(made.y+made.h/2-(step.y+step.h/2))<0.01,"The new node sits on its source's centre line");
  assert(history.past.length===undoDepth+1,"Tab, reshape and typing are one undo step");
  selected=new Set([made.id]);window.dispatchEvent(new KeyboardEvent("keydown",{key:"1",metaKey:true,code:"Digit1",bubbles:true,cancelable:true}));
  assert(made.shape==="process"&&Math.abs(made.y+made.h/2-(step.y+step.h/2))<0.01,"⌘1 reshapes a selected node about its centre");
  selected.clear();window.dispatchEvent(new KeyboardEvent("keydown",{key:"5",metaKey:true,code:"Digit5",bubbles:true,cancelable:true}));
  assert(tool==="shape"&&shape==="circle","⌘5 with nothing selected picks the circle tool");
  setTool("select");M.remove(d(),[step.id,made.id]);
}
{
  await window.flushSave();
  const edits=revision,updated=current.updated;
  zoom(view.z*1.3);await wait(450);
  assert(revision===edits&&current.updated===updated,"Zooming is not an edit and does not move the document up the list");
  assert(positionMoved,"The new view waits for the next save");
  await window.flushSave();
  const stored=(await native("load")).state.documents.find(a=>a.id===current.id);
  assert(!positionMoved&&Math.abs(stored.view.z-view.z)<1e-9,"Leaving the window saves the view");
}
{
  const box=M.node("flow",3000,3000,"process","Styled");d().nodes.push(box);selected=new Set([box.id]);inspect();
  assert(!$("defaultSection")&&!$("setDefault")&&!$("openDefaults")&&!$("nodeNotesBtn")&&!$("duplicateBtn")&&!$("deleteBtn"),"Style panel excludes defaults and content action buttons");
  styleSelection("fill","#dbe4ff");styleSelection("fontFamily","Google Sans");
  await saveDefaults({...M.getDefaults(),process:M.styleOf(box)});await wait(100);
  assert(M.node("flow",0,0).fill==="#dbe4ff"&&M.node("flow",0,0).fontFamily==="Google Sans","Set as default shapes new rectangles");
  assert(M.getDefaults().process.fill==="#dbe4ff","Existing per-shape preferences remain supported without an inspector action");
  const prefs=await native("loadPreferences");
  assert(prefs.process.fill==="#dbe4ff"&&!JSON.stringify((await native("load")).state).includes("afterTerminator"),"Defaults are saved apart from the documents");
  window.appCommand("settings");await wait(50);
  assert($("modal").open&&$("modalBody").querySelectorAll(".defaults-preview canvas").length===8,"⌘, lists every default with a drawn preview");
  $("afterTerminatorChoice").value="decision";$("afterTerminatorChoice").dispatchEvent(new Event("change"));await wait(50);
  $("modalBody").querySelector(".defaults-list").scrollTop=999;await native("snapshot",{name:"defaults"});
  const start=M.node("flow",3000,3300,"pill","Start");d().nodes.push(start);
  assert(M.extend(d(),start.id,true).shape==="decision","The chosen shape follows Start / end");
  $("resetDefaults").click();await wait(100);
  assert(!Object.keys(M.getDefaults()).length&&!Object.keys(await native("loadPreferences")).length&&M.node("flow",0,0).fill==="#ffffff","Reset all restores the built-in look");
  closeModal();selected.clear();M.remove(d(),d().nodes.filter(n=>n.x>=2900).map(n=>n.id));
}
{
  const n=M.node("text",80,80,"process","Align me");d().nodes.push(n);selected=new Set([n.id]);canvas.focus();
  for(const [k,a] of [["l","left"],["e","center"],["r","right"]]) {
    canvas.dispatchEvent(new KeyboardEvent("keydown",{key:k,metaKey:true,shiftKey:true,bubbles:true,cancelable:true}));
    assert(n.textAlign===a&&!$("modal").open,"Alignment hotkey applies "+a+" without exporting");
  }
  beginEdit(n);richEditor.setSelectionRange(3);key("l",{metaKey:true,shiftKey:true});
  assert(n.textAlign==="left"&&richEditor.selectionStart===3&&editing?.id===n.id,"Alignment while typing retains the caret and edit session");
  commitEdit();canvas.focus();
  canvas.dispatchEvent(new KeyboardEvent("keydown",{key:"e",metaKey:true,bubbles:true,cancelable:true}));
  await wait(50);assert($("modal").open&&$("exportScope"),"Plain Command E still opens PNG export");closeModal();
}
const input={format:"excalidravv-mindmap",version:1,title:"Imported ideas",root:{text:"Coffee shop",notes:["Draft idea"],children:[{text:"Locations",children:[{text:"Kemang"},{text:"Cipete"}]},{text:"Menu",children:[{text:"Americano"}]}]}};
const count=state.documents.length;
const imported=await importMindmapText(JSON.stringify(input));
assert(state.documents.length===count+1&&imported.canvas.nodes.length===6&&imported.canvas.edges.length===5,"JSON import creates a separate complete mind map");
assert(imported.canvas.nodes[0].notes[0].text==="Draft idea"&&M.validate(imported.canvas),"Import preserves node notes and tree integrity");
const originalID=imported.id;
let failure=false;try { await importMindmapText(JSON.stringify({...input,version:9})); } catch { failure=true; }
assert(failure&&current.id===originalID&&state.documents.length===count+1,"Invalid import leaves existing documents untouched");
const node=imported.canvas.nodes[1];selected=new Set([node.id]);canvas.focus();canvas.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",bubbles:true,cancelable:true}));type("Added after import");key("Escape");
assert(d().nodes.some(n=>n.text==="Added after import"&&n.parent===node.id),"Tab works on imported mind-map nodes");
await window.flushSave();const saved=await native("load");
assert(saved.state.documents.every(doc=>M.validate(doc.canvas)),"All new features survive native storage validation");
openDoc(primary);assert(d().nodes.some(n=>n.kind==="sticker"),"Switching back preserves original document and sticker");
assert(errors.length===0,"No uncaught browser errors");
current.canvas=imported.canvas;current.title="Text → mind map";$("docTitle").textContent=current.title;
addPlaceholder(d().nodes[0].id);type("Draft · 100%");key("Escape");fit();selected=new Set([d().nodes[0].id]);inspect();$("layerTools").scrollIntoView({block:"center"});paint();await wait(150);
assert(!$("layerTools").hidden&&$("layerTools").getBoundingClientRect().height>0,"Layer order controls remain reachable in the inspector");
$("inspector").scrollTop=0;
await native("snapshot",{name:"features"});
return results;
