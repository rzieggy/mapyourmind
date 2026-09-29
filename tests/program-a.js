const results=[],errors=[];window.uiTest=true;for(const type of ["pointerdown","pointermove","pointerup","click","dblclick","contextmenu","wheel"])window.addEventListener(type,e=>{if(e.isTrusted){e.preventDefault();e.stopImmediatePropagation();}},true);window.addEventListener("error",e=>errors.push(e.message));
const assert=(v,label)=>{if(!v)throw Error(label);results.push(label);};const wait=ms=>new Promise(r=>setTimeout(r,ms));
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==="object"&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
for(let i=0;i<200&&!loaded;i++)await wait(50);assert(loaded,"Current schema-3 baseline starts");await document.fonts.ready;
const testDoc={id:M.uid(),title:"mapyourmind compatibility",canvas:M.blank(),mode:"flowchart",created:1,updated:1};state.documents.push(testDoc);openDoc(testDoc.id);
function pointer(type,x,y,extra={}){const box=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent(type,{clientX:x*view.z+view.x+box.left,clientY:y*view.z+view.y+box.top,pointerId:1,bubbles:true,button:0,...extra}));}
function key(target,value,extra={}){target.dispatchEvent(new KeyboardEvent("keydown",{key:value,bubbles:true,cancelable:true,...extra}));}
assert(document.title==="mapyourmind","Product surfaces use lowercase mapyourmind");
const legacyRoot=M.node("mind",0,0,"pill","Legacy"),legacyChild=M.node("mind",411,193,"decision","Unchanged");legacyChild.parent=legacyRoot.id;d().nodes.push(legacyRoot,legacyChild);M.connect(d(),legacyRoot.id,legacyChild.id,{tree:true,style:"curved",arrow:false});const legacy=M.clone(d());
openDoc(testDoc.id);assert(M.same(d(),legacy),"Opening unversioned legacy geometry does not restyle or reflow nodes");
const part={nodes:[M.node("flow",25000,-19000,"process","Risk assess"),M.node("flow",25300,-19000,"process","Next")],edges:[]};
for(const z of [.25,.5,.57,.75,1,1.25,1.5,2]) {view={x:-9000,y:12000,z};selected.clear();inspect();resetPasteCascade();const before=M.clone(d());insertVisible(part,"fixture");const pasted=d().nodes.filter(n=>selected.has(n.id)),viewport=usableViewport();assert(pasted.length===2&&pasted.some(n=>M.overlap(n,viewport)),"Paste shows actual selected content at "+z);const after=M.clone(d());undo();assert(M.same(d(),before),"Paste is atomic at "+z);redo();assert(M.same(d(),after),"Paste redo preserves geometry at "+z);}
assert(M.same(d().nodes.slice(0,2),legacy.nodes),"Pasting unrelated objects preserves legacy tree geometry");
view={x:80,y:180,z:1};const a=d().nodes[0],b=d().nodes[1];selected=new Set([a.id,b.id]);inspect();const styleBefore=canonical(d());pointer("contextmenu",a.x+20,a.y+20,{button:2});assert(selected.size===2&&!contextMenu.hidden,"Right-click retains multi-selection");key(contextMenu.querySelector("button"),"Escape");assert(contextMenu.hidden&&selected.size===2&&canonical(d())===styleBefore,"Context Escape leaves content and selection intact");
const swatches=[...$("fillColors").querySelectorAll("button")];assert(swatches[0].dataset.color==="transparent","Transparent is the first fill swatch");swatches[0].focus();key(swatches[0],"End");assert(document.activeElement===swatches.at(-1),"Swatches support horizontal keyboard navigation");
Object.assign(a,{fill:"#fff0a6"});Object.assign(b,{fill:"#dbe4ff"});inspect();assert(!swatches.some(el=>el.getAttribute("aria-pressed")==="true"),"Mixed fills do not imply a single chosen color");
const originalOrder=d().nodes.map(n=>n.id);selected=new Set([a.id]);for(const action of ["front","backward","forward","back"]){const previous=M.clone(d()),steps=history.past.length;layerSelection(action);assert(M.validate(d()),"Layer action remains valid: "+action);if(history.past.length>steps)undo();assert(M.same(d(),previous),"Layer undo preserves attachments and hierarchy: "+action);selected=new Set([a.id]);}
const text=M.node("flow",80,80,"process","Risk assess");Object.assign(text,{w:320,h:90,fontSize:25});d().nodes.push(text);
for(const family of ["Excalifont","Google Sans","Comic Shanns","Arial"])for(const size of [14,19,25,34,44])for(const z of [.25,.5,.57,.75,1,1.25,1.5,1.75,2]){
 text.fontSize=size;text.w=500;
 text.fontFamily=family;view={x:30,y:80,z};selected=new Set([text.id]);beginEdit(text);
 assert(getComputedStyle(richEditor).transform==="none","Native editor stays unscaled: "+family+" "+z);
 for(const offset of [text.text.length-1,text.text.length]){richEditor.setSelectionRange(offset);const caret=getSelection().getRangeAt(0).getBoundingClientRect();const node=richEditor.querySelector("span").firstChild;const glyph=document.createRange();glyph.setStart(node,offset-1);glyph.setEnd(node,offset);const bounds=glyph.getBoundingClientRect();assert(Math.abs(caret.x-bounds.right)<1.1,"Caret follows Risk assess glyph boundary: "+family+" "+z+" "+offset);}
 commitEdit();
}
const availableGoogle=googleSansAvailable;googleSansAvailable=false;selected=new Set([text.id]);text.fontFamily="Google Sans";inspect();assert(elementFont(text)==="Arial, sans-serif"&&!$("fontFallback").hidden,"Unavailable Google Sans uses a disclosed shared Arial fallback");googleSansAvailable=availableGoogle;
text.fontSize=25;text.fontFamily="Google Sans";text.text="Risk assess priorities é 👩‍💻 repeated ssss";text.w=180;view={x:80,y:130,z:.57};beginEdit(text);const wrapped=text.text;readRichEditor(text);assert(text.text===wrapped,"Canonical soft wrapping never changes saved Unicode text");
richEditor.dispatchEvent(new CompositionEvent("compositionstart"));key(richEditor,"Enter",{isComposing:true});assert(editing?.id===text.id,"IME Enter does not create a node");richEditor.dispatchEvent(new CompositionEvent("compositionend"));paint();await wait(30);await native("snapshot",{name:"program-a-google"});commitEdit();
await window.flushSave();const saved=await native("load");assert(saved.state.schema===3&&canonical(saved.state.documents.find(doc=>doc.id===testDoc.id).canvas)===canonical(d()),"Release A saves and reloads through schema 3");
selected=new Set([text.id]);await copyEditable();await pasteEditable();assert(d().nodes.at(-1).fontFamily==="Google Sans","Editable copy preserves local font choice");await exportPNG(true,"selection","transparent",2);assert((await native("clipboardProbe")).png,"Shared text renderer exports PNG");
assert(!errors.length,"No uncaught browser errors in current-baseline Release A");

return results;
