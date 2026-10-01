const results=[], errors=[];
window.uiTest=true;
window.addEventListener("error",e=>errors.push(e.message));
for(const type of ["pointerdown","pointermove","pointerup","pointercancel","click","dblclick","contextmenu","wheel"])
  window.addEventListener(type,e=>{if(e.isTrusted){e.preventDefault();e.stopImmediatePropagation();}},true);
const assert=(ok,label)=>{if(!ok)throw Error(label);results.push(label);};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
for(let i=0;i<200&&!loaded;i++)await wait(50);
assert(loaded,"Refinements start with a temporary native store");await document.fonts.ready;
newDoc();$("nameInput").value="Presenting ideas";$("nameSubmit").click();
function pointer(type,x,y,extra={}){const r=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent(type,{clientX:r.left+x*view.z+view.x,clientY:r.top+y*view.z+view.y,pointerId:1,button:0,bubbles:true,cancelable:true,...extra}));}
function key(value,extra={}){canvas.dispatchEvent(new KeyboardEvent("keydown",{key:value,bubbles:true,cancelable:true,...extra}));}
function tapSpace(){key(" ");canvas.dispatchEvent(new KeyboardEvent("keyup",{key:" ",bubbles:true}));}
function text(value){richEditor.value=value;richEditor.dispatchEvent(new Event("input"));}
const root=M.node("mind",100,150,"process","Release ideas");d().nodes.push(root);
const child=M.extend(d(),root.id,true);child.text="Share the idea";autoSize(child);
const grand=M.extend(d(),child.id,true);grand.text="Discuss";autoSize(grand);M.layout(d());
assert(root.shape==="pill"&&root.fill==="#e6def7"&&[child,grand].every(M.isText),"Roots keep their look; descendants use text with connectors");
assert(child.h===Math.ceil(child.fontSize*1.15+6),"Mind-map text has compact single-line height");
const raster=document.createElement("canvas");raster.width=raster.height=300;const rc=raster.getContext("2d");
drawNode(rc,{...child,x:20,y:20,text:""},false);
assert(!rc.getImageData(0,0,300,300).data.some((v,i)=>i%4===3&&v),"Text child paints no container, fill or border");
const free=M.node("text",100,380,"process","One line");d().nodes.push(free);autoSize(free);
assert(free.w===230&&free.h===28,"Free text has adjustable 230px width and content height");
selected=new Set([free.id]);beginEdit(free);text("One line\nTwo lines\nThree lines");
assert(free.h===Math.ceil(3*free.fontSize*1.15+6),"Explicit line breaks grow text height");
text("Short");assert(free.h===28,"Deleting content shrinks text height");commitEdit();
selected=new Set([free.id]);const handle=resizeHandles(free).find(h=>h.side==="r");free.text="A longer text which wraps when narrowed";
pointer("pointerdown",handle.x,handle.y);pointer("pointermove",handle.x-120,handle.y);pointer("pointerup",handle.x-120,handle.y);
assert(free.w===110&&free.h===Math.ceil(textLines(ctx,free).length*free.fontSize*1.15+6),"Width resize wraps text and keeps height automatic");
const afterWidth=M.clone(free);undo();redo();const restored=d().nodes.find(n=>n.id===free.id);
assert(restored.w===afterWidth.w&&restored.h===afterWidth.h,"Text resize undo/redo preserves computed geometry");
const rectangle=M.node("flow",100,540,"process","Compact");d().nodes.push(rectangle);autoSize(rectangle);
assert(rectangle.h===34&&textWrapWidth(rectangle)===rectangle.w-20,"Rectangle auto-sizing uses compact padding");
const left={x:0,y:0,w:100,h:80}, moving={x:140,y:0,w:100,h:80}, right={x:280,y:0,w:100,h:80};
let gaps=measureDistances(moving,[left,right]);
assert(gaps.length===2&&gaps.every(g=>g.gap===40&&g.equal),"Distance ruler measures equal edge gaps, not centre distances");
assert(measureDistances(moving,[{x:150,y:10,w:20,h:20}]).length===0,"Overlapping elements do not show a misleading gap");
assert(measureDistances(moving,[right],20).length===0,"Distant rulers are limited to nearby objects");
const measureBefore=M.clone(d());current.canvas=M.blank();history=new M.History();
const a=M.node("flow",100,100,"process","A"),b=M.node("flow",500,100,"process","B");d().nodes.push(a,b);selected=new Set([a.id]);view={x:0,y:0,z:1};inspect();
for(const z of [.5,1,2]) {
  view.z=z;pointer("pointerdown",a.x+a.w/2,a.y+a.h/2);pointer("pointermove",a.x+a.w/2+20,a.y+a.h/2,{metaKey:true});
  assert(distanceGuides.some(g=>g.axis==="x"&&Math.abs(g.gap-(b.x-a.x-a.w))<.01),"Live gap uses world pixels at zoom "+z);
  if(z===1){paint();await native("snapshot",{name:"refinements-rulers"});}
  pointer("pointerup",a.x+a.w/2,a.y+a.h/2,{metaKey:true});
  assert(distanceGuides.length===0,"Dropping clears transient rulers at zoom "+z);
}
undo();assert(d().nodes.find(n=>n.id===a.id).x===140,"Movement with rulers retains undo boundaries");redo();
current.canvas=measureBefore;history=new M.History();selected.clear();setTool("select");view={x:40,y:40,z:1};
const beforeSticker=M.clone(d()), depth=history.past.length;
startStickerPlacement("🎯");pointer("pointermove",400,460);paint();$("toast").hidden=true;await native("snapshot",{name:"refinements-sticker-preview"});
assert(pendingSticker.visible&&M.same(beforeSticker,d())&&history.past.length===depth,"Sticker ghost follows cursor without content or history changes");
key("Escape");assert(!pendingSticker&&M.same(beforeSticker,d()),"Escape cancels cursor placement without inserting");
startStickerPlacement("🎯");pointer("pointermove",400,460);pointer("pointerdown",400,460);pointer("pointerup",400,460);
const placed=d().nodes.at(-1);
assert(placed.kind==="sticker"&&placed.x===384&&placed.y===444&&!pendingSticker&&history.past.length===depth+1,"Sticker is placed exactly once at the cursor as one undo step");
undo();assert(M.same(beforeSticker,d()),"One Undo removes sticker placement");redo();
await window.flushSave();const saved=(await native("load")).state.documents.find(doc=>doc.id===current.id);
assert(M.validate(saved.canvas)&&saved.canvas.nodes.some(M.isText)&&saved.canvas.nodes.some(n=>n.kind==="sticker"),"Text mind maps and stickers survive schema-3 native saving");
selected=new Set([restored.id]);inspect();fit();paint();$("toast").hidden=true;await wait(80);await native("snapshot",{name:"refinements-text"});
// Presentations must never mutate the graph that native/browser saves serialize.
const storedRoot=d().nodes.find(n=>n.id===root.id);storedRoot.collapsed=true;M.layout(d());changed();await window.flushSave();
const original=M.clone(current.canvas), originalRevision=revision, originalHistory=history.past.length;
startStickerPlacement("⭐");setViewOnly(true);
assert(viewOnly&&!pendingSticker&&d()!==current.canvas&&$("viewOnlyToggle").textContent==="Back to editing","Entering View only cancels pending placement and uses a disposable graph");
assert(getComputedStyle($("toolbar")).display==="none"&&getComputedStyle($("inspector")).display==="none"&&getComputedStyle(document.querySelector(".history-control")).display==="none"&&$("sidebarNewDocument").disabled,"View only hides editing controls and offers a visible exit");
const projectedRoot=d().nodes.find(n=>n.id===root.id);
selected=new Set([root.id]);tapSpace();
assert(!projectedRoot.collapsed&&M.same(current.canvas,original)&&revision===originalRevision&&history.past.length===originalHistory,"Space expands a branch temporarily without content revision or undo");
tapSpace();assert(projectedRoot.collapsed,"Space still collapses in presentation mode");
openFind();$("findInput").value="Discuss";$("findInput").dispatchEvent(new Event("input"));await wait(160);
assert(!projectedRoot.collapsed&&selected.has(grand.id)&&M.same(original,current.canvas),"Find reveals collapsed ancestors only in the presentation graph");closeFind();
const presentationBefore=M.clone(d());selected=new Set([root.id]);
pointer("pointerdown",projectedRoot.x+40,projectedRoot.y+projectedRoot.h/2);pointer("pointermove",projectedRoot.x+180,projectedRoot.y+90);pointer("pointerup",projectedRoot.x+180,projectedRoot.y+90);
canvas.dispatchEvent(new MouseEvent("dblclick",{bubbles:true,clientX:canvas.getBoundingClientRect().left+100,clientY:canvas.getBoundingClientRect().top+100}));
assert(!drag&&!editing&&M.same(presentationBefore,d()),"Dragging and double-clicking cannot move, resize or edit presentation content");
for(const command of ["undo","redo","duplicate","cut","paste","comment","bold","text-align-left","new","import","settings"])await window.appCommand(command);
for(const value of ["Delete","Tab","Enter","r","t"])key(value);
key("g",{metaKey:true});key("1",{metaKey:true,code:"Digit1"});key("e",{metaKey:true,shiftKey:true});
assert(M.same(presentationBefore,d())&&M.same(original,current.canvas)&&!editing&&!$("modal").open&&!notesNodeId&&history.past.length===originalHistory,"Native commands and editing shortcuts cannot bypass View only");
const cr=canvas.getBoundingClientRect();canvas.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:cr.left+projectedRoot.x*view.z+view.x+30*view.z,clientY:cr.top+projectedRoot.y*view.z+view.y+20*view.z}));
assert(!contextMenu.hidden&&!!contextMenu.querySelector('[data-context="collapse"]')&&!contextMenu.querySelector('[data-context="delete"],[data-context="comment"],[data-context="cut"]'),"Presentation right-click offers navigation without editing actions");closeContextMenu();canvas.focus();
const panBefore={...view};key(" ");pointer("pointerdown",20,20);pointer("pointermove",100,60);pointer("pointerup",100,60);canvas.dispatchEvent(new KeyboardEvent("keyup",{key:" ",bubbles:true}));
assert(view.x!==panBefore.x&&!projectedRoot.collapsed&&M.same(original,current.canvas),"Space-drag pans without toggling the presented branch");
const zoomBefore=view.z;await window.appCommand("in");assert(view.z>zoomBefore,"Zoom remains available in View only");fit();
await window.flushSave();const during=(await native("load")).state.documents.find(doc=>doc.id===current.id);
assert(M.same(during.canvas,original),"Native save during temporary expansion persists original collapse flags and geometry");
assert(M.same(M.clone(state).documents.find(doc=>doc.id===current.id).canvas,original),"Shared browser persistence snapshot excludes the presentation graph");
selected.clear();paint();await native("snapshot",{name:"refinements-view-only"});
toggleLaser();assert(laserActive&&!$("laserCanvas").hidden,"Pointer is available only in View only");
const pointerGraph=M.clone(d()), pointerHistory=history.past.length;
for(let i=0;i<=36;i++){const angle=i*Math.PI/18,x=350+80*Math.cos(angle),y=330+80*Math.sin(angle);pointer(i===0?"pointerdown":"pointermove",x,y);}
pointer("pointerup",430,330);
assert(laserPoints.length>=36&&!laserDrawing&&M.same(pointerGraph,d())&&pointerHistory===history.past.length,"Dragging can trace a circle without making a drawing or undo step");
assert(laserContext.getImageData(0,0,laserCanvas.width,laserCanvas.height).data.some((v,i)=>i%4===3&&v),"Laser dot and trail actually paint on their transient layer");
await native("snapshot",{name:"refinements-pointer"});
await wait(850);assert(laserPoints.length===0,"Pointer trail fades completely within 800ms");
const priorView={...view};key(" ");pointer("pointerdown",50,50);pointer("pointermove",150,100);pointer("pointerup",150,100);canvas.dispatchEvent(new KeyboardEvent("keyup",{key:" ",bubbles:true}));
assert(view.x!==priorView.x&&laserPoints.length===0,"Space-drag pans while the laser is enabled without a trail");
setTool("select");pointer("pointerdown",350,330);pointer("pointermove",380,360);pointer("pointerup",380,360);
canvas.dispatchEvent(new PointerEvent("pointercancel",{bubbles:true}));assert(laserPoints.length===0&&!laserCursor,"Pointer cancel clears the presentation overlay");
// Content-only PNG export must be identical with or without a laser overlay.
const withoutPointer=exportElements("all"), exportBefore=M.clone(d());
const pointerNative=native;let pngData=[];native=async(action,data)=>{if(action==="png"){pngData.push(data.data);return null;}return pointerNative(action,data);};
try{await exportPNG(false,"all");pointer("pointerdown",350,330);pointer("pointermove",400,360);pointer("pointerup",400,360);await exportPNG(false,"all");}finally{native=pointerNative;}
assert(pngData.length===2&&pngData[0]===pngData[1]&&M.same(exportBefore,d())&&exportElements("all").nodes.length===withoutPointer.nodes.length,"PNG export excludes the laser layer and leaves the presented graph intact");
let pdfData=[];native=async(action,data)=>{if(action==="boardPDF"){pdfData.push(data.data);return null;}return pointerNative(action,data);};
try{await exportBoardPDF("all","white",true);toggleLaser();await exportBoardPDF("all","white",true);}finally{native=pointerNative;}
assert(pdfData.length===2&&pdfData[0]===pdfData[1]&&M.same(exportBefore,d()),"Board PDF raster excludes pointer trails and preserves the graph");
toggleLaser();
key("Escape");assert(!laserActive&&laserPoints.length===0&&viewOnly,"Escape clears and disables Pointer without leaving View only");
setViewOnly(false);assert(!viewOnly&&M.same(original,d())&&history.past.length===originalHistory&&!$("sidebarNewDocument").disabled,"Back to editing restores the original graph, history and editing controls");
assert(getComputedStyle($("toolbar")).display!=="none"&&$("laserPointer").hidden,"Editing rail returns and presentation pointer disappears on exit");
setViewOnly(true);toggleCollapse(d().nodes.find(n=>n.id===root.id));toggleLaser();pointer("pointerdown",350,330);pointer("pointermove",400,360);
const boardId=current.id;newDoc();assert(current.id===boardId&&!$("modal").open,"Document creation is disabled during a presentation");
showDocumentMenu(new MouseEvent("contextmenu"),current,false);assert(contextMenu.hidden,"View only blocks the document editing context menu");
beginSidebarReorder(new PointerEvent("pointerdown",{button:0}),boardId);assert(!sidebarReorder,"The document sidebar cannot begin a reorder while presenting");
const note={id:M.uid(),title:"Notes for presenting",mode:"notes",canvas:M.blank(),note:blankNote(),created:Date.now(),updated:Date.now()};state.documents.push(note);
renderDocumentSidebar();
const noteRow=$("sidebarDocumentList").querySelector(`[data-document-id="${note.id}"]`);noteRow.dispatchEvent(new PointerEvent("pointerdown",{button:0,bubbles:true}));
for(let i=0;i<200&&current.id!==note.id;i++)await wait(10);
assert(!viewOnly&&!laserActive&&!laserPoints.length&&M.same(state.documents.find(doc=>doc.id===boardId).canvas,original),"Switching document ends presentation and preserves the source board");
setViewOnly(true);assert(!viewOnly&&$("viewOnlyToggle").hidden,"Notes never offers Board presentation mode");
openDoc(boardId);assert(d().nodes.find(n=>n.id===root.id).collapsed,"Reopening the board keeps its original collapse flags");
assert(!errors.length,"No uncaught errors through editor and presentation interactions");
return results;
