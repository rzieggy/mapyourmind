const results=[];const assert=(value,label)=>{if(!value)throw Error(label);results.push(label);};
window.uiTest=true;for(let i=0;i<200&&!loaded;i++)await new Promise(r=>setTimeout(r,50));assert(loaded,"Schema-3 bridge starts with a temporary empty store");
const png=document.createElement("canvas");png.width=png.height=4;png.getContext("2d").fillRect(0,0,4,4);const bytes=png.toDataURL();const reference=await native("putImage",{data:bytes});
assert(/^[a-f0-9]{64}$/.test(reference),"Image store creates a bounded content reference");assert(reference===await native("putImage",{data:bytes}),"Identical PNG images are stored under one reference");
const image={...M.node("image",0,0),imageRef:reference};delete image.imageData;const sticker=M.node("sticker",120,0,"process","🌱"),root=M.node("mind",0,200,"pill","Synthetic root"),canvasDoc={id:"schema-three",title:"Synthetic schema 3",mode:"mindmap",connectorVersion:3,fontVersion:"excalifont-v1",canvas:{nodes:[image,sticker,root],edges:[]},updated:1,created:1};
const noteDoc={id:"schema-note",title:"Synthetic Notes",mode:"notes",canvas:M.blank(),note:blankNote(),updated:1,created:1};
const input={schema:3,sidebarWidth:280,documents:[canvasDoc,noteDoc]};await native("save",{state:input});let result=await native("load");
assert(result.state.schema===3&&result.state.sidebarWidth===280&&result.state.documents.length===2,"Schema 3 retains document metadata and Notes");
assert(result.state.documents[0].canvas.nodes[0].imageData===bytes && result.state.documents[0].canvas.nodes[0].imageRef===reference,"Native load expands external images for the installed frontend");
const hydrated=result.state.documents[0];assert(validDocument(hydrated)&&validDocument(result.state.documents[1]),"Installed validation accepts image, sticker, root and Notes fixtures");
state=result.state;for(const doc of state.documents)for(const node of doc.canvas.nodes)if(node.imageRef){imageRefs.set(node.imageData,node.imageRef);delete node.imageRef;}
openDoc(canvasDoc.id);assert(d().nodes.length===3,"Schema-3 canvas opens with every element retained");await window.flushSave();result=await native("load");assert(result.state.schema===3&&result.state.documents[0].canvas.nodes[0].imageRef===reference,"Save/reopen retains schema 3 and the original image reference");
await native("savePreferences",{preferences:{global:{fontFamily:"Comic Shanns",sw:3},process:{fill:"#123456"},afterTerminator:"decision"}});const storedPreferences=await native("loadPreferences");assert(storedPreferences.global.fontFamily==="Comic Shanns"&&storedPreferences.global.sw===3&&!storedPreferences.process&&!storedPreferences.afterTerminator,"Native preferences persist global settings separately from documents and drop older entries");
const safe=M.clone((await native("load")).state);let rejected=false;try{const bad=M.clone(input);bad.documents[0].canvas.nodes[0].imageRef="../documents";await native("save",{state:bad});}catch{rejected=true;}
assert(rejected&&M.same((await native("load")).state,safe),"Invalid image references cannot replace the last valid library");
const local=await native("localFonts");assert(local.length===8&&document.fonts.check('19px "Google Sans"'),"Bundled Google Sans loads from the app itself");
return results;
