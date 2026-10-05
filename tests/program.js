const results=[],errors=[];window.uiTest=true;for(const type of ["pointerdown","pointermove","pointerup","click","dblclick","contextmenu","wheel"])window.addEventListener(type,e=>{if(e.isTrusted){e.preventDefault();e.stopImmediatePropagation();}},true);window.addEventListener("error",e=>errors.push(e.message));
const assert=(v,label)=>{if(!v)throw Error(label);results.push(label);};const wait=ms=>new Promise(r=>setTimeout(r,ms));
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==="object"&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
for(let i=0;i<200&&!loaded;i++)await wait(50);assert(loaded,"Current schema-3 baseline starts");await document.fonts.ready;
const testDoc={id:M.uid(),title:"mapyourmind compatibility",canvas:M.blank(),mode:"flowchart",created:1,updated:1};state.documents.push(testDoc);openDoc(testDoc.id);
function pointer(type,x,y,extra={}){const box=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent(type,{clientX:x*view.z+view.x+box.left,clientY:y*view.z+view.y+box.top,pointerId:1,bubbles:true,button:0,...extra}));}
function key(target,value,extra={}){target.dispatchEvent(new KeyboardEvent("keydown",{key:value,bubbles:true,cancelable:true,...extra}));}
// Release B: source-style authority, atomic quick editing, and command discovery.
for(const kind of ["flow","mind"])for(const child of [true,false])for(const shape of ["process","decision","pill","note","circle","io"]){
 current.canvas=M.blank();history=new M.History();
 const donor=M.node(kind,-8000,9000,shape,"Donor");Object.assign(donor,{shape,w:300,h:shape==="circle"?300:170,fill:"transparent",fillStyle:"cross-hatch",edges:"round",stroke:"#123456",sw:3,strokeStyle:"dashed",sloppiness:2,fontFamily:"Google Sans",fontSize:25,textColor:"#445566",textAlign:"right",group:"old-group",notes:[{id:"note",text:"Private",created:1,replies:[]}],marks:[{start:0,end:5,bold:true,underline:true,highlight:"#fff0a6"}]});d().nodes.push(donor);selected=new Set([donor.id]);view={x:0,y:0,z:.57};inspect();const before=M.clone(d());
 key(canvas,child?"Tab":"Enter");const created=d().nodes.at(-1);assert(editing?.id===created.id&&selected.size===1&&selected.has(created.id),"Keyboard creation immediately selects and edits: "+kind+" "+shape+" "+child);
 // After a flowchart Start / end the new node is always a white rectangle: shape, fill, fill style and size come from it (the After Start / end setting was removed).
 const terminator=shape==="pill"&&kind==="flow",step=["shape","fill","fillStyle","w","h"];
 const textChild=kind==="mind"&&child, textStyle={shape:"process",fill:"transparent",stroke:"transparent",fillStyle:"solid",h:Math.ceil(donor.fontSize*1.15+6),textAlign:"left"};
 // New mind-map nodes fit their width to their text instead of inheriting it.
 if(kind==="mind")assert(created.fitWidth===true&&created.w>=60&&created.w<=360,"New mind-map node fits its width: "+shape+" "+child);
 for(const property of M.visualProperties.filter(p=>(!terminator||!step.includes(p))&&!(kind==="mind"&&p==="w")))assert(canonical(created[property])===canonical(textChild&&property in textStyle?textStyle[property]:donor[property]),"Approved creation style "+property+": "+kind+" "+shape+" "+child);
 if(terminator)assert(created.shape==="process"&&created.fill==="#ffffff","After Start / end gives a white rectangle: "+kind+" "+child);
 assert(!created.group&&!created.notes.length&&!created.collapsed&&created.text===""&&!created.marks,"Structural/content metadata stays excluded");
 const viewport=usableViewport();assert(M.overlap(created,viewport),"Quick creation remains visible behind current inspector/sidebar geometry");
 key(richEditor,child?"Tab":"Enter",{repeat:true});assert(d().nodes.length===2,"Held creation key never floods nodes");
 richEditor.setRangeText("Ready",0,0,"end");richEditor.dispatchEvent(new Event("input"));assert(markAt(created,0).bold&&markAt(created,0).underline&&markAt(created,0).highlight==="#fff0a6","Uniform source formatting applies to first typed text");
 commitEdit();const size=terminator?M.node("flow",0,0,"process"):donor;assert((kind==="mind"||created.w===size.w)&&(textChild?created.h===Math.ceil(created.fontSize*1.15+6):created.h>=size.h),"Quick creation keeps width and uses content height for text children");const after=M.clone(d());undo();assert(M.same(d(),before),"One Undo removes creation plus initial text");redo();assert(M.same(d(),after),"Redo restores style, text and structure");
}
selected=new Set([d().nodes.at(-1).id]);await copyEditable();await pasteEditable();const styled=d().nodes.at(-1);assert(styled.fontFamily==="Google Sans"&&markAt(styled,0).bold&&styled.fillStyle==="cross-hatch","Copied keyboard style includes current appearance fields and rich marks");
await window.flushSave();const savedB=await native("load");assert(canonical(savedB.state.documents.find(doc=>doc.id===testDoc.id).canvas)===canonical(d()),"Inherited style and typing metadata survive native save/reopen");
const commandBefore=M.clone(d());await window.appCommand("commands");assert(!$("commandMenu"),"Native Command K has no command palette");
key(canvas,"k",{metaKey:true});assert(M.same(d(),commandBefore),"Command K does not mutate Board content");
const catalog=commandCatalog();assert(catalog.some(c=>c.id==="duplicate")&&catalog.some(c=>c.id==="layer-front"),"Object actions remain in the contextual catalog");
const box=canvas.getBoundingClientRect();const object=d().nodes.find(n=>selected.has(n.id));
canvas.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:box.left+(object.x+object.w/2)*view.z+view.x,clientY:box.top+(object.y+object.h/2)*view.z+view.y}));
assert(!$("nodeContextMenu").hidden&&$("nodeContextMenu").querySelector('[data-context="duplicate"]'),"Right-click exposes Duplicate");
$("nodeContextMenu").querySelector('[data-context="duplicate"]').click();assert(d().nodes.length===commandBefore.nodes.length+1,"Right-click Duplicate executes exactly once");
undo();assert(M.same(d(),commandBefore),"Right-click actions share existing undo boundaries");
const noteDoc={id:M.uid(),title:"Command safety",mode:"notes",canvas:M.blank(),note:blankNote(),created:1,updated:1};state.documents.push(noteDoc);openDoc(noteDoc.id);
assert(commandCatalog().some(c=>c.id==="note-export")&&!commandCatalog().some(c=>c.id.startsWith("tool-")||c.id==="paste"),"Notes context cannot insert canvas objects");openDoc(testDoc.id);
selected=new Set(d().nodes.map(n=>n.id));await exportPNG(true,"selection","transparent",2);assert((await native("clipboardProbe")).png,"Inherited nodes export through the shared renderer");
assert(!errors.length,"No uncaught browser errors through Release B");return results;
