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
assert(free.fitWidth&&free.w>=60&&free.w<230&&textLines(ctx,free).length===1&&free.h===28,"New free text fits its width to the text, like a mind-map node, and its height to the content");
{const legacy=M.node("text",100,380,"process","One line");delete legacy.fitWidth;legacy.w=230;autoSize(legacy);assert(legacy.w===230&&legacy.h===28,"Existing free text keeps its adjustable 230px width");}
selected=new Set([free.id]);beginEdit(free);text("One line\nTwo lines\nThree lines");
assert(free.h===Math.ceil(3*free.fontSize*1.15+6),"Explicit line breaks grow text height");
text("A free text box that keeps going well past any sensible single line width, like a paragraph");
assert(free.w===440&&textLines(ctx,free).length>1&&free.h===Math.ceil(textLines(ctx,free).length*free.fontSize*1.15+6),"Free text wraps at the same 440px maximum as mind-map text");
text("Short");assert(free.h===28&&free.w<230,"Deleting content shrinks text height and width");commitEdit();
selected=new Set([free.id]);const handle=resizeHandles(free).find(h=>h.side==="r"),fitted=free.w;free.text="A longer text which wraps when narrowed";
pointer("pointerdown",handle.x,handle.y);pointer("pointermove",handle.x+50,handle.y);pointer("pointerup",handle.x+50,handle.y);
assert(!free.fitWidth&&free.w===fitted+50&&free.h===Math.ceil(textLines(ctx,free).length*free.fontSize*1.15+6),"Width resize wraps text and keeps height automatic");
const afterWidth=M.clone(free);undo();redo();const restored=d().nodes.find(n=>n.id===free.id);
assert(restored.w===afterWidth.w&&restored.h===afterWidth.h,"Text resize undo/redo preserves computed geometry");
selected=new Set([restored.id]);beginEdit(restored);text("Go");commitEdit();assert(!restored.fitWidth&&restored.w===afterWidth.w,"After a hand resize free text keeps its width while its text changes");
const rectangle=M.node("flow",100,540,"process","Compact");delete rectangle.minLines;d().nodes.push(rectangle);autoSize(rectangle);
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
startStickerPlacement("⭐");setPointer(true);
assert(viewOnly&&laserActive&&!pendingSticker&&d()!==current.canvas&&$("toolbar").querySelector('[data-tool="pointer"]').classList.contains("active"),"Turning on the Pointer cancels pending placement and uses a disposable graph");
assert(getComputedStyle($("toolbar")).display!=="none"&&getComputedStyle($("inspector")).display==="none"&&getComputedStyle(document.querySelector(".history-control")).display==="none"&&$("sidebarNewDocument").disabled&&!$("viewOnlyToggle")&&!$("laserPointer"),"The Pointer hides editing controls, keeps the rail, and there is no View only button");
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
for(const value of ["Delete","Backspace","Tab","Enter"])key(value);
key("g",{metaKey:true});key("1",{metaKey:true,code:"Digit1"});key("e",{metaKey:true,shiftKey:true});
assert(M.same(presentationBefore,d())&&M.same(original,current.canvas)&&!editing&&!$("modal").open&&!notesNodeId&&history.past.length===originalHistory,"Native commands and editing shortcuts cannot bypass the Pointer");
const cr=canvas.getBoundingClientRect();canvas.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:cr.left+projectedRoot.x*view.z+view.x+30*view.z,clientY:cr.top+projectedRoot.y*view.z+view.y+20*view.z}));
assert(!contextMenu.hidden&&!!contextMenu.querySelector('[data-context="collapse"]')&&!contextMenu.querySelector('[data-context="delete"],[data-context="comment"],[data-context="cut"]'),"Presentation right-click offers navigation without editing actions");closeContextMenu();canvas.focus();
const panBefore={...view};key(" ");pointer("pointerdown",20,20);pointer("pointermove",100,60);pointer("pointerup",100,60);canvas.dispatchEvent(new KeyboardEvent("keyup",{key:" ",bubbles:true}));
assert(view.x!==panBefore.x&&!projectedRoot.collapsed&&M.same(original,current.canvas),"Space-drag pans without toggling the presented branch");
const zoomBefore=view.z;await window.appCommand("in");assert(view.z>zoomBefore,"Zoom remains available in View only");fit();
await window.flushSave();const during=(await native("load")).state.documents.find(doc=>doc.id===current.id);
assert(M.same(during.canvas,original),"Native save during temporary expansion persists original collapse flags and geometry");
assert(M.same(M.clone(state).documents.find(doc=>doc.id===current.id).canvas,original),"Shared browser persistence snapshot excludes the presentation graph");
selected.clear();paint();await native("snapshot",{name:"refinements-view-only"});
assert(laserActive&&!$("laserCanvas").hidden,"The Pointer draws on its own layer");
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
try{await exportBoardPDF("all","white",true);clearLaser();await exportBoardPDF("all","white",true);}finally{native=pointerNative;}
assert(pdfData.length===2&&pdfData[0]===pdfData[1]&&M.same(exportBefore,d()),"Board PDF raster excludes pointer trails and preserves the graph");
pointer("pointerdown",350,330);pointer("pointermove",400,360);
key("Escape");assert(!viewOnly&&!laserActive&&laserPoints.length===0&&tool==="select","Escape leaves the Pointer, clears its trail and returns to Select");
assert(M.same(original,d())&&history.past.length===originalHistory&&!$("sidebarNewDocument").disabled,"Leaving the Pointer restores the original graph, history and editing controls");
assert(!$("toolbar").querySelector('[data-tool="pointer"]').classList.contains("active")&&$("toolbar").querySelector('[data-tool="select"]').classList.contains("active"),"The rail shows Select again after the Pointer");
setPointer(true);toggleCollapse(d().nodes.find(n=>n.id===root.id));pointer("pointerdown",350,330);pointer("pointermove",400,360);
const boardId=current.id;newDoc();assert(current.id===boardId&&!$("modal").open,"Document creation is disabled during a presentation");
showDocumentMenu(new MouseEvent("contextmenu"),current,false);assert(contextMenu.hidden,"View only blocks the document editing context menu");
beginSidebarReorder(new PointerEvent("pointerdown",{button:0}),boardId);assert(!sidebarReorder,"The document sidebar cannot begin a reorder while presenting");
const note={id:M.uid(),title:"Notes for presenting",mode:"notes",canvas:M.blank(),note:blankNote(),created:Date.now(),updated:Date.now()};state.documents.push(note);
renderDocumentSidebar();
const noteRow=$("sidebarDocumentList").querySelector(`[data-document-id="${note.id}"]`);noteRow.dispatchEvent(new PointerEvent("pointerdown",{button:0,bubbles:true}));
for(let i=0;i<200&&current.id!==note.id;i++)await wait(10);
assert(!viewOnly&&!laserActive&&!laserPoints.length&&M.same(state.documents.find(doc=>doc.id===boardId).canvas,original),"Switching document ends presentation and preserves the source board");
setPointer(true);key("p");assert(!viewOnly&&!laserActive,"Notes never offers the Pointer");
openDoc(boardId);assert(d().nodes.find(n=>n.id===root.id).collapsed,"Reopening the board keeps its original collapse flags");
{
  setViewOnly(false);openDoc(boardId);
  const fr=M.node("mind",3000,3000,"process","Fit");d().nodes.push(fr);autoSize(fr);
  const fc=M.extend(d(),fr.id,true);selected=new Set([fc.id]);beginEdit(fc,{newElement:true});text("User have AFIN and can login");
  assert(fc.fitWidth&&fc.w>180&&fc.w<440&&textLines(ctx,fc).length===1,"A new mind-map node grows to keep a short label on one line");
  text("A much longer mind-map label that keeps going well past any sensible single line width");
  assert(fc.w===440&&textLines(ctx,fc).length>1,"Past the maximum width a mind-map node wraps");
  text("Go");assert(fc.w===60,"Short mind-map text shrinks to the minimum width");commitEdit();
  const ph=M.placeholder(d(),fc.id);autoSize(ph);M.layout(d());
  assert(Math.abs(fc.y+fc.h/2-(fr.y+fr.h/2))<0.5,"A placeholder leaves an only child on its parent's line");
  selected=new Set([fc.id]);beginEdit(fc);text("Grows with its placeholder");commitEdit();
  assert(ph.w===fc.w&&ph.h===Math.max(26,Math.ceil(textLines(ctx,ph).length*ph.fontSize*1.15+8)),"A placeholder rewraps when its owner's width fits");
  selected=new Set([fc.id]);render();const rh=resizeHandles(fc).find(h=>h.side==="r");
  pointer("pointerdown",rh.x,rh.y);pointer("pointermove",rh.x+80,rh.y);pointer("pointerup",rh.x+80,rh.y);
  const kept=fc.w;selected=new Set([fc.id]);beginEdit(fc);text("Go");commitEdit();
  assert(!fc.fitWidth&&fc.w===kept,"Resizing a mind-map node by hand keeps its width from then on");
}
{
  setViewOnly(false);openDoc(boardId);current.canvas=M.blank();history=new M.History();
  const r=M.node("mind",6000,6000,"process","Root");d().nodes.push(r);autoSize(r);
  const long=M.extend(d(),r.id,true);long.text="A long sibling label that keeps going for a while";autoSize(long);
  const short=M.extend(d(),long.id,false);short.text="Hi";autoSize(short);
  const lc=M.extend(d(),long.id,true);lc.text="Leaf";autoSize(lc);
  const sc=M.extend(d(),short.id,true);sc.text="Leaf";autoSize(sc);M.layout(d());
  assert(sc.x<lc.x&&sc.x-(short.x+short.w)===92&&lc.x-(long.x+long.w)===92,"Mind-map children start one fixed gap after their own parent, so short branches stay compact");
  drag={type:"move",id:lc.id};hover={id:short.id,mode:"parent"};let ghost=null;const fillRect=ctx.fillRect;
  ctx.fillRect=function(x,y,w,h){ghost={x,y,w,h};};try{drawReparentPreview();}finally{ctx.fillRect=fillRect;drag=null;hover=null;}
  M.reparent(d(),lc.id,short.id);M.layout(d());
  assert(ghost&&Math.abs(ghost.x-lc.x)<0.5,"The reparent drop preview sits where the branch lands");
  short.collapsed=true;M.layout(d());const badge=collapsedBadge(short);
  assert(badge&&badge.x>short.x+short.w&&badge.x+badge.w<short.x+short.w+92,"A collapse badge sits in the connector gap of its own node");
  const fortyFive=M.extend(d(),r.id,true);fortyFive.text="This mind-map label is forty-five chars long.";autoSize(fortyFive);
  assert(fortyFive.text.length===45&&fortyFive.w<=440&&textLines(ctx,fortyFive).length===1,"A 45-character mind-map label still fits on one line");
  fortyFive.text+=" And then some more words";autoSize(fortyFive);
  assert(fortyFive.w===440&&textLines(ctx,fortyFive).length===2,"Longer mind-map labels wrap at the 440px maximum");
}
{
  setViewOnly(false);openDoc(boardId);current.canvas=M.blank();history=new M.History();zoom(1);
  const r=M.node("mind",200,200,"process","Outline root");d().nodes.push(r);autoSize(r);
  const kid=M.extend(d(),r.id,true);M.layout(d());selected=new Set([kid.id]);beginEdit(kid,{newElement:true});text("Typing here");
  const ed=$("textEditor"),cs=getComputedStyle(ed),box=ed.getBoundingClientRect();
  assert(!ed.hidden&&ed.classList.contains("mind-text-editor")&&cs.outlineStyle==="solid"&&cs.outlineWidth==="1px"&&cs.outlineColor==="rgb(36, 116, 208)"&&parseFloat(cs.outlineOffset)>=2,"Editing a mind-map text node shows a thin accent outline around the field");
  assert(Math.abs(box.width-kid.w*view.z)<1.5&&parseFloat(cs.paddingLeft)===(kid.w-textWrapWidth(kid))/2*view.z,"The outline adds no padding, so the field still wraps where the canvas does");
  const narrow=box.width;text("Typing here and then quite a bit more");
  assert(ed.getBoundingClientRect().width>narrow,"The outline grows with the text");
  view.x=Math.round(120-r.x);view.y=Math.round(160-r.y);positionEditor();render();paint();await wait(120);await native("snapshot",{name:"mind-outline"});
  const outlineNative=native;let png=null;native=async(action,data)=>{if(action==="png"){png=data.data;return null;}return outlineNative(action,data);};
  try{await exportPNG(false,"all");}finally{native=outlineNative;}
  const img=new Image();img.src="data:image/png;base64,"+png;await img.decode();const pc=document.createElement("canvas");pc.width=img.width;pc.height=img.height;
  const px=pc.getContext("2d");px.drawImage(img,0,0);const data=px.getImageData(0,0,pc.width,pc.height).data;let blue=0;
  for(let i=0;i<data.length;i+=4)if(data[i+3]&&Math.abs(data[i]-36)<20&&Math.abs(data[i+1]-116)<20&&Math.abs(data[i+2]-208)<20)blue++;
  assert(png&&blue===0,"The editing outline never reaches a PNG export");
  commitEdit();
  assert(ed.hidden&&!ed.classList.contains("mind-text-editor"),"The outline disappears when editing ends");
  const shape=M.node("flow",200,500,"process","Box");d().nodes.push(shape);autoSize(shape);selected=new Set([shape.id]);beginEdit(shape);
  assert(getComputedStyle(ed).outlineStyle==="none","Shapes keep the borderless editor");commitEdit();
  const free=M.node("text",200,700,"process","Free");d().nodes.push(free);autoSize(free);selected=new Set([free.id]);beginEdit(free);
  assert(getComputedStyle(ed).outlineStyle==="none","Free text keeps the borderless editor");commitEdit();
}
{
  setViewOnly(false);openDoc(boardId);current.canvas=M.blank();history=new M.History();zoom(1);
  const three=fs=>Math.ceil(3*fs*1.15+12);
  const box=M.node("flow",300,300,"process");d().nodes.push(box);const fs=box.fontSize;
  assert(box.minLines===3&&box.w===180&&box.h===three(fs),"A new rectangle is three lines tall at its own font size");
  const startH=box.h,cy=box.y+box.h/2;selected=new Set([box.id]);beginEdit(box,{newElement:true});
  text("First line\nSecond line");
  assert(box.h===startH&&box.w===180&&box.y+box.h/2===cy,"Typing two lines keeps the rectangle's size");
  const ed=$("textEditor"),pad=parseFloat(getComputedStyle(ed).paddingTop)/view.z;
  assert(Math.abs(pad-(box.h-2*fs*1.15)/2)<0.6&&getComputedStyle(ed).textAlign==="center","Rectangle text is centred horizontally and vertically");
  text("One\nTwo\nThree");assert(box.h===startH,"Three lines still fit without resizing");
  text("One\nTwo\nThree\nFour");
  assert(box.h===Math.ceil(4*fs*1.15+12)&&Math.abs(box.y+box.h/2-cy)<0.01,"From the fourth line the rectangle grows, keeping its centre so chains stay straight");
  text("A long sentence that wraps inside the fixed rectangle width");
  assert(box.w===180&&textLines(ctx,box).length>1,"A rectangle keeps its fixed width and wraps there");
  commitEdit();
  const before=M.getDefaults();M.setDefaults({global:{fontSize:44}});
  let xl;try{xl=M.node("flow",600,300,"process");}finally{M.setDefaults(before);}
  assert(xl.fontSize===44&&xl.h===three(44)&&xl.h>startH,"An XL font gives a taller three-line rectangle");
  const old=M.node("flow",300,700,"process","Old");delete old.minLines;old.h=34;d().nodes.push(old);
  selected=new Set([old.id]);beginEdit(old);text("Old box");commitEdit();
  assert(old.h===34&&old.minLines===undefined,"An older rectangle without the marker is not stretched when edited");
  const next=M.extend(d(),box.id,true);assert(next.minLines===3,"Tab from a new rectangle carries the marker");
  const legacyNext=M.extend(d(),old.id,true);assert(legacyNext.minLines===undefined&&legacyNext.h===34,"Tab from an older rectangle keeps the older behaviour");
  const terminal=M.node("flow",300,1000,"pill","Start");d().nodes.push(terminal);const after=M.extend(d(),terminal.id,true);
  assert(after.shape==="process"&&after.minLines===3&&after.h===three(after.fontSize),"After Start / end comes a three-line rectangle");
  const ph=M.placeholder(d(),box.id);assert(ph.minLines===undefined,"Placeholders never carry the marker");
  const copy=JSON.parse(JSON.stringify(d()));assert(M.validate(copy)&&copy.nodes.find(n=>n.id===box.id).minLines===3,"minLines survives a save/load round trip");
  for(const bad of [0,11,2.5,"3",true,null]){const t=JSON.parse(JSON.stringify(d()));t.nodes.find(n=>n.id===box.id).minLines=bad;assert(!M.validate(t),"Invalid minLines is refused: "+JSON.stringify(bad));}
  box.text="Short";box.marks=[];reflow(box);
  selected=new Set([box.id]);render();const bh=resizeHandles(box).find(h=>h.side==="b");
  pointer("pointerdown",bh.x,bh.y);pointer("pointermove",bh.x,bh.y+60);pointer("pointerup",bh.x,bh.y+60);
  const tall=box.h;assert(tall>=startH+59,"Resizing a rectangle by hand still makes it taller");
  selected=new Set([box.id]);render();const bh2=resizeHandles(box).find(h=>h.side==="b");
  pointer("pointerdown",bh2.x,bh2.y);pointer("pointermove",bh2.x,bh2.y-tall);pointer("pointerup",bh2.x,bh2.y-tall);
  assert(box.h===startH,"A rectangle cannot be resized below three lines");
}
{
  setViewOnly(false);openDoc(boardId);current.canvas=M.blank();history=new M.History();zoom(1);
  const a=M.node("flow",4000,4000,"process","Left");const b=M.node("flow",4300,4025,"process","Right");const far=M.node("flow",4000,4600,"process","Below");
  d().nodes.push(a,b,far);M.connect(d(),a.id,b.id);M.connect(d(),b.id,far.id);
  const cy=n=>n.y+n.h/2,cx=n=>n.x+n.w/2,before=M.clone(d());
  selected=new Set([b.id]);render();
  pointer("pointerdown",cx(b),cy(b));pointer("pointermove",cx(b)+60,cy(b)+4,{shiftKey:true});
  assert(cy(b)===cy(a)&&b.x===4360&&guides.some(g=>g.axis==="y"&&g.value===cy(a)),"Shift-dragging sideways lines a shape up with its connected neighbour, so the connector is straight");
  pointer("pointermove",cx(b)+60,cy(b)+30,{shiftKey:false});
  assert(cy(b)!==cy(a),"Releasing Shift frees the move again");
  window.dispatchEvent(new KeyboardEvent("keydown",{key:"Shift",bubbles:true}));
  assert(cy(b)===cy(a),"Pressing Shift mid-drag straightens at once");
  window.dispatchEvent(new KeyboardEvent("keyup",{key:"Shift",bubbles:true}));
  pointer("pointerup",cx(b),cy(b));undo();
  assert(M.same(d(),before),"One Undo reverses a straightened move");
  const live=id=>d().nodes.find(n=>n.id===id);let b2=live(b.id),far2=live(far.id);
  b2.y=4200;selected=new Set([b2.id]);render();const y0=b2.y;
  pointer("pointerdown",cx(b2),cy(b2));pointer("pointermove",cx(b2)+80,cy(b2)+12,{shiftKey:true});
  assert(b2.y===y0&&b2.x===4380,"Out of reach, Shift is a plain horizontal lock");
  pointer("pointerup",cx(b2),cy(b2));
  far2.x=b2.x+20;selected=new Set([far2.id]);render();const fy=far2.y;
  pointer("pointerdown",cx(far2),cy(far2));pointer("pointermove",cx(far2)+6,cy(far2)-90,{shiftKey:true});
  assert(cx(far2)===cx(b2)&&far2.y===fy-90,"Shift-dragging vertically lines up the other axis");
  pointer("pointerup",cx(far2),cy(far2));
}
{
  setPointer(false);openDoc(boardId);selected.clear();const rail=t=>$("toolbar").querySelector(`[data-tool="${t}"]`);
  key("p");assert(viewOnly&&laserActive&&rail("pointer").classList.contains("active"),"P turns on the Pointer when nothing is selected");
  key("p");assert(!viewOnly&&!laserActive&&tool==="select","P again goes back to Select");
  const someNode=d().nodes.find(n=>n.kind!=="image");selected=new Set([someNode.id]);key("p");
  assert(!viewOnly,"P does nothing while a shape is selected");selected.clear();
  rail("pointer").click();assert(viewOnly&&laserActive,"The Pointer button in the rail turns it on");
  rail("pointer").click();assert(!viewOnly,"Clicking it again turns it off");
  rail("pointer").click();rail("shape").click();assert(!viewOnly&&tool==="shape","Picking another rail tool leaves the Pointer");setTool("select");
  key("p");key("t");assert(!viewOnly&&tool==="text","Another tool key leaves the Pointer and picks that tool");setTool("select");
  await window.appCommand("pointer");assert(viewOnly&&laserActive,"The Pointer menu command turns it on");await window.appCommand("pointer");assert(!viewOnly,"and off");
}
{
  // Typing then deleting everything must leave an empty one-line field, not a phantom line break.
  setPointer(false);openDoc(boardId);current.canvas=M.blank();history=new M.History();
  const typeAndClear=n=>{selected=new Set([n.id]);beginEdit(n,{newElement:true});richEditor.focus();
    document.execCommand("insertText",false,"ab");document.execCommand("delete");document.execCommand("delete");
    return {html:richEditor.innerHTML,text:n.text};};
  const r=M.node("mind",5000,5000,"process","Root");d().nodes.push(r);autoSize(r);
  const kid=M.extend(d(),r.id,true);const one=Math.ceil(kid.fontSize*1.15+6);
  const k=typeAndClear(kid);
  assert(kid.text===""&&kid.h===one,"Clearing a new mind-map child keeps it one line high");commitEdit();
  const box=M.node("flow",5000,5400,"process","");box.text="";d().nodes.push(box);const boxH=(autoSize(box),box.h);
  const b=typeAndClear(box);
  assert(box.text===""&&box.h===boxH,"Clearing a rectangle's text keeps its starting height");commitEdit();
  const free=M.node("text",5000,5800);d().nodes.push(free);autoSize(free);const freeH=free.h;
  typeAndClear(free);assert(free.text===""&&free.h===freeH,"Clearing free text keeps it one line high");commitEdit();
}
assert(!errors.length,"No uncaught errors through editor and presentation interactions");
return results;
