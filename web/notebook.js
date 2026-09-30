"use strict";
const notebook = document.createElement("section");
notebook.id = "notebook"; notebook.hidden = true;
notebook.innerHTML = `<nav id="noteToolbar" aria-label="Notes formatting">
<select id="noteBlock" aria-label="Paragraph style"><option value="p">Body</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option></select>
<span class="divider"></span>
<button data-note-command="bold" title="Bold (⌘B)"><b>B</b></button>
<button data-note-command="italic" title="Italic (⌘I)"><i>I</i></button>
<button data-note-command="underline" title="Underline (⌘U)"><u>U</u></button>
<button data-note-command="highlight" title="Highlight">Highlight</button>
<span class="divider"></span>
<button data-note-command="ordered" title="Numbered list (⌘⇧7)">1.</button>
<button data-note-command="bullet" title="Bullet list (⌘⇧8)">• List</button>
<button data-note-command="checklist" title="Checklist">☑</button>
<button data-note-command="link" title="Insert link (⌘K)">Link</button>
</nav>
<div id="noteScroll"><article id="notePage"><h1 id="noteHeading"></h1><div id="noteBody" contenteditable="true" role="textbox" aria-label="Note content" aria-multiline="true" spellcheck="true" data-placeholder="Start writing…"></div></article></div>
<aside id="noteInspector" aria-label="Note style"><div class="eyebrow">NOTE STYLE</div>
<label>Font family<select id="noteFont"><option value="Excalifont">✎ Handwritten</option><option value="Google Sans">A · Google Sans</option><option value="Comic Shanns">&lt;/&gt; Comic Shanns</option><option value="Arial">Arial</option></select></label>
<label>Font size<select id="noteFontSize"><option value="14">Extra small · 14</option><option value="19">Small · 19</option><option value="25">Medium · 25</option><option value="34">Large · 34</option><option value="44">Heading · 44</option></select></label>
<label>Text color<input id="noteColor" type="color"></label><p class="note-style-hint">Applies to this whole note.<br>Saved only on this Mac.</p></aside>`;
$("stage").append(notebook);
const noteBody = $("noteBody");
let noteUndo = [], noteRedo = [], noteRange = null, noteExporting = false;
let lastNoteSelection = null;
function noteSelection() {
  const s = getSelection();
  if (!s.rangeCount || !noteBody.contains(s.anchorNode) || !noteBody.contains(s.focusNode)) return null;
  function path(node) { const p=[]; while(node !== noteBody) { p.unshift([...node.parentNode.childNodes].indexOf(node)); node=node.parentNode; } return p; }
  const r = s.getRangeAt(0);
  return {a:path(r.startContainer), ao:r.startOffset, b:path(r.endContainer), bo:r.endOffset};
}
function restoreNoteSelection(saved) {
  noteBody.focus();
  const r=document.createRange();
  try {
    const find = path => path.reduce((n,i)=>n.childNodes[i],noteBody);
    if (!saved) throw Error();
    r.setStart(find(saved.a),saved.ao);r.setEnd(find(saved.b),saved.bo);
  } catch { r.selectNodeContents(noteBody);r.collapse(false); }
  const s=getSelection();s.removeAllRanges();s.addRange(r);noteRange=r.cloneRange();
}
function noteState() { return {note:M.clone(current.note), selection:noteSelection() || lastNoteSelection}; }
function recordNote() {
  if (!isNotebook()) return;
  const value=noteState();
  if (JSON.stringify(noteUndo.at(-1)?.note) !== JSON.stringify(value.note)) {
    noteUndo.push(value);if(noteUndo.length>150)noteUndo.shift();noteRedo=[];
  }
  $("undo").disabled=noteUndo.length<2; $("redo").disabled=!noteRedo.length;
}
function syncNotebook() {
  if (!isNotebook()) return;
  const html=sanitizeNote(noteBody.innerHTML);
  if(html.length>2000000) { noteBody.innerHTML=current.note.html;toast("This note exceeds the 2 MB text limit.");return; }
  if(current.note.html!==html) {current.note.html=html;changed();}
  current.note.scroll=$("noteScroll").scrollTop;
  recordNote();
}
function applyNoteStyle() {
  const n=current.note;
  $("notePage").style.setProperty("--document-font",elementFont(n));
  $("notePage").style.fontSize=n.fontSize+"px";
  $("notePage").style.color=n.textColor;
  $("noteFont").value=n.fontFamily;$("noteFontSize").value=n.fontSize;$("noteColor").value=n.textColor;
  $("noteHeading").textContent=current.title;
}
function openNotebook() {
  const enabled=isNotebook();
  $("workspace").classList.toggle("is-notebook",enabled);
  notebook.hidden=!enabled;
  $("exportOpen").innerHTML=icon("export")+(enabled ? "Export PDF" : "Export PNG");
  native("documentMode",{mode:enabled ? "notes":"diagram"}).catch(e=>toast(e.message));
  noteRange=null;lastNoteSelection=null;
  if(enabled) {
    noteBody.innerHTML=sanitizeNote(current.note.html);
    applyNoteStyle();noteUndo=[noteState()];noteRedo=[];
    $("noteScroll").scrollTop=current.note.scroll||0;
    $("undo").disabled=true;$("redo").disabled=true;
  }
}
function notebookUndo(redo=false) {
  if(!isNotebook())return;
  if(redo) { if(!noteRedo.length)return;noteUndo.push(noteRedo.pop()); }
  else { if(noteUndo.length<2)return;noteRedo.push(noteUndo.pop()); }
  const entry=noteUndo.at(-1);current.note=M.clone(entry.note);
  noteBody.innerHTML=current.note.html;applyNoteStyle();restoreNoteSelection(entry.selection);
  $("undo").disabled=noteUndo.length<2;$("redo").disabled=!noteRedo.length;
  changed();
}
function preserveNoteRange() {
  const s=getSelection();
  if(s.rangeCount && noteBody.contains(s.anchorNode) && noteBody.contains(s.focusNode)) {
    noteRange=s.getRangeAt(0).cloneRange();lastNoteSelection=noteSelection();
    if(noteUndo.length)noteUndo.at(-1).selection=lastNoteSelection;
  }
}
function focusNoteRange() {
  noteBody.focus();
  if(noteRange && noteBody.contains(noteRange.startContainer) && noteBody.contains(noteRange.endContainer)) {
    const s=getSelection();s.removeAllRanges();s.addRange(noteRange);
  } else restoreNoteSelection(lastNoteSelection);
}
function noteExec(command,value=null) {
  focusNoteRange();
  document.execCommand(command,false,value);syncNotebook();preserveNoteRange();
}
function noteListItem() {
  const anchor=getSelection().anchorNode;
  return (anchor?.nodeType===1?anchor:anchor?.parentElement)?.closest("li");
}
async function notebookCommand(command) {
  if(!isNotebook())return false;
  // Modal text controls keep their standard editing shortcuts.
  if($("modal").open) {
    if(["image","export","fit","actual","in","out","comment"].includes(command))return true;
    return false;
  }
  if(command==="new"||command==="import")return false;
  if(command==="export") { await exportNotePDF();return true; }
  if(command==="image")return true;
  if(command==="undo"||command==="redo"){notebookUndo(command==="redo");return true;}
  if(command==="all"){noteBody.focus();const r=document.createRange();r.selectNodeContents(noteBody);getSelection().removeAllRanges();getSelection().addRange(r);preserveNoteRange();return true;}
  if(command==="copy"||command==="cut"){
    focusNoteRange();const s=getSelection();if(!s.isCollapsed){await native("clipboardWrite",{text:s.toString()});if(command==="cut")noteExec("delete");}return true;
  }
  if(command==="paste"){
    const clip=await native("clipboardRead");
    if(clip.text)noteExec("insertHTML",esc(clip.text).replaceAll("\n","<br>"));
    else if(clip.image)toast("Images and attachments in Notes are not supported yet.");
    return true;
  }
  if(["bold","italic","underline"].includes(command)){noteExec(command);return true;}
  if(command==="highlight"){noteExec("hiliteColor","#fff0a6");return true;}
  if(command==="bullet"||command==="ordered"){noteExec(command==="bullet"?"insertUnorderedList":"insertOrderedList");return true;}
  if(command==="checklist"){
    focusNoteRange();let li=noteListItem();if(!li){document.execCommand("insertUnorderedList");li=noteListItem();}
    if(li){if(li.dataset.checked!==undefined)delete li.dataset.checked;else li.dataset.checked="false";}
    syncNotebook();preserveNoteRange();return true;
  }
  if(command==="link"){
    preserveNoteRange();
    showModal('<h2>Insert link</h2><label>URL<input id="noteLinkUrl" type="url" placeholder="https://…"></label><div class="actions"><button data-close>Cancel</button><button id="noteLinkAdd" class="primary">Add link</button></div>');
    $("noteLinkAdd").onclick=()=>{
      const url=$("noteLinkUrl").value.trim();
      if(!/^(https?:\/\/|mailto:)/i.test(url)){toast("Use an https://, http:// or mailto: link.");return;}
      closeModal();focusNoteRange();
      if(getSelection().isCollapsed)noteExec("insertHTML",'<a href="'+esc(url)+'">'+esc(url)+'</a>');
      else noteExec("createLink",url);
    };
    $("noteLinkUrl").focus();return true;
  }
  // Diagram-only commands are intentionally consumed.
  return true;
}
noteBody.addEventListener("input",()=>{syncNotebook();preserveNoteRange();});
noteBody.addEventListener("compositionend",()=>{syncNotebook();preserveNoteRange();});
document.addEventListener("selectionchange",()=>{if(isNotebook())preserveNoteRange();});
noteBody.addEventListener("paste",e=>{
  e.preventDefault();
  if(e.clipboardData.files.length){toast("Images and attachments in Notes are not supported yet.");return;}
  const html=e.clipboardData.getData("text/html"),text=e.clipboardData.getData("text/plain");
  if(Math.max(html.length,text.length)>2000000){toast("Pasted text exceeds the 2 MB limit.");return;}
  noteExec("insertHTML",html?sanitizeNote(html):esc(text).replaceAll("\n","<br>"));
});
noteBody.addEventListener("drop",e=>{e.preventDefault();toast("Use paste to add text. Attachments are not supported yet.");});
noteBody.addEventListener("click",e=>{
  const li=e.target.closest("li[data-checked]");
  if(li && e.clientX<li.getBoundingClientRect().left+4){li.dataset.checked=String(li.dataset.checked!=="true");syncNotebook();}
  const a=e.target.closest("a");if(a){e.preventDefault();if(e.metaKey)native("openLink",{url:a.getAttribute("href")}).catch(err=>toast(err.message));}
});
noteBody.addEventListener("keydown",e=>{
  if(e.isComposing)return;
  if(e.key==="Tab"){
    e.preventDefault();
    if(noteListItem())noteExec(e.shiftKey?"outdent":"indent");
    else $("noteBlock").focus();
  }
  if(e.key==="Enter"){
    e.preventDefault();
    const li=noteListItem(), checked=li?.dataset.checked!==undefined;
    if(e.shiftKey)noteExec("insertLineBreak");
    else if(li && !li.textContent.trim() && !li.querySelector("ul,ol")) {
      delete li.dataset.checked;noteExec(li.parentElement.tagName==="OL"?"insertOrderedList":"insertUnorderedList");
    } else {
      noteExec("insertParagraph");
      const next=noteListItem();if(checked&&next){next.dataset.checked="false";syncNotebook();}
    }
  }
});
document.addEventListener("keydown",e=>{
  if(!isNotebook() || e.isComposing || $("modal").open || !(e.metaKey||e.ctrlKey))return;
  const key=e.key.toLowerCase();
  const command=e.shiftKey && e.code==="Digit7"?"ordered":e.shiftKey && e.code==="Digit8"?"bullet":
    ({b:"bold",i:"italic",u:"underline",k:"link",e:"export",z:e.shiftKey?"redo":"undo",c:e.shiftKey?"image":null})[key];
  if(command){e.preventDefault();e.stopImmediatePropagation();notebookCommand(command).catch(err=>toast(err.message));}
},true);
for(const b of notebook.querySelectorAll("[data-note-command]")){
  b.onpointerdown=e=>e.preventDefault();
  b.onclick=()=>notebookCommand(b.dataset.noteCommand).catch(e=>toast(e.message));
}
$("noteBlock").onchange=e=>noteExec("formatBlock",e.target.value);
for(const [id,key,numeric] of [["noteFont","fontFamily"],["noteFontSize","fontSize",true],["noteColor","textColor"]]){
  $(id).onchange=e=>{current.note[key]=numeric?Number(e.target.value):e.target.value;applyNoteStyle();recordNote();changed();};
}
async function exportNotePDF(test=false) {
  if(!isNotebook() || noteExporting)return;
  syncNotebook();
  const snapshot=M.clone(current);
  noteExporting=true;$("exportOpen").disabled=true;
  try {
    await window.flushSave();await document.fonts.ready;
    const font=elementFont(snapshot.note);
    const html='<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'self\' \'unsafe-inline\'; font-src \'self\' file:; img-src \'none\'"><link rel="stylesheet" href="style.css"><style>html,body{width:595.28px;height:auto!important;overflow:visible!important;margin:0!important;background:white!important}#notePage{box-sizing:border-box;width:595.28px;max-width:none;min-height:0;margin:0;padding:0 51px;--document-font:'+font+';font-size:'+snapshot.note.fontSize+'px;color:'+snapshot.note.textColor+'}#noteBody{min-height:0}</style></head><body><article id="notePage"><h1 id="noteHeading">'+esc(snapshot.title)+'</h1><div id="noteBody">'+sanitizeNote(snapshot.note.html)+'</div></article></body></html>';
    const result=await native("notePDF",{filename:snapshot.title,html,test});
    if(result)toast("PDF exported.");
    return result;
  } finally {noteExporting=false;$("exportOpen").disabled=false;}
}

noteBody.addEventListener("beforeinput",e=>{
  if(e.inputType==="historyUndo"||e.inputType==="historyRedo"){e.preventDefault();notebookUndo(e.inputType==="historyRedo");}
});
function syncNoteToolbar() {
  if(!isNotebook() || !noteBody.contains(getSelection().anchorNode))return;
  for(const command of ["bold","italic","underline"]){
    notebook.querySelector('[data-note-command="'+command+'"]').setAttribute("aria-pressed",String(document.queryCommandState(command)));
  }
  const anchor=getSelection().anchorNode;
  const block=(anchor.nodeType===1?anchor:anchor.parentElement)?.closest("h1,h2,h3,p,li");
  $("noteBlock").value=["H1","H2","H3"].includes(block?.tagName)?block.tagName.toLowerCase():"p";
}
document.addEventListener("selectionchange",syncNoteToolbar);
const strokeChoices = [
  ["strokeWidth", [["1","Thin","M5 12h22",1],["1.8","Medium","M5 12h22",2],["3","Thick","M5 12h22",3]]],
  ["strokeStyle", [["solid","Solid","M4 12h24",2],["dashed","Dashed","M4 12h24",2,"5 4"],["dotted","Dotted","M4 12h24",2,"1 4"]]],
  ["sloppiness", [["0","Clean","M4 15 12 10 20 14 28 8",1.5],["1","Hand-drawn","M4 15Q10 9 13 10T21 13L28 8",1.5],["2","Sketchy","M4 15 13 9 11 15 22 10 20 16 28 8M5 16 14 10 22 14",1.5]]],
  ["edgeStyle", [["elbow","Elbow","M5 18h9V6h13",1.8],["straight","Straight","M5 18 27 6",1.8],["curved","Curved","M5 18Q17 18 17 12T27 6",1.8]]],
  ["edges", [["sharp","Sharp","M10 19V8h11",1.8],["round","Round","M10 19v-6a5 5 0 0 1 5-5h6",1.8]]],
  ["fillStyle", [["hachure","Hachure","M6 18 15 6M12 18 21 6M18 18 27 6",1.6],["cross-hatch","Cross-hatch","M6 18 15 6M12 18 21 6M18 18 27 6M6 6 15 18M12 6 21 18M18 6 27 18",1.6],["solid","Solid","M7 5h18v14H7z",0,null,true]]],
];
// Font size reads faster as sized letters than as a dropdown of numbers.
const labelChoices=[
  ["fontSize", [["14","Extra small","XS",10],["19","Small","S",12],["25","Medium","M",14],["34","Large","L",16],["44","Heading","XL",16]]],
];
for(const [id,choices] of labelChoices){
  const select=$(id),group=document.createElement("div");
  group.className="stroke-choice-group";group.dataset.select=id;group.setAttribute("role","group");group.setAttribute("aria-label",select.parentElement.firstChild.textContent.trim());
  for(const [value,label,glyph,size] of choices){
    const b=document.createElement("button");b.type="button";b.dataset.value=value;b.title=label;b.setAttribute("aria-label",label);
    b.innerHTML='<span class="choice-glyph" style="font-size:'+size+'px">'+glyph+'</span>';
    b.onpointerdown=e=>e.preventDefault();
    b.onclick=()=>{select.value=value;select.dispatchEvent(new Event("change"));};
    group.append(b);
  }
  // Five sized letters need the full width, so that row stacks under its label.
  if(choices.length>3) select.parentElement.classList.add("stacked-choice");
  select.hidden=true;select.before(group);
}
// Three font tiles, each written in its own font so the choice is visible before it is made.
// Arial is no longer offered, but stays a valid value: a node that already uses it keeps it,
// and then no tile is pressed.
const fontChoices=[["Excalifont","Handwritten","Excalifont, cursive"],["Google Sans","Google Sans","'Google Sans', sans-serif"],["Comic Shanns","Comic","'Comic Shanns', monospace"]];
{
  const select=$("fontFamily"),group=document.createElement("div");
  group.className="stroke-choice-group font-tiles";group.dataset.select="fontFamily";group.setAttribute("role","group");group.setAttribute("aria-label","Font family");
  for(const [value,label,family] of fontChoices){
    const b=document.createElement("button");b.type="button";b.dataset.value=value;b.title=value;b.setAttribute("aria-label",value);
    // The page sets Google Sans on every element with !important, so each tile
    // sets its own font the same way.
    b.innerHTML='<span class="font-sample">Aa</span><span class="font-name">'+label+'</span>';
    for(const el of [b,...b.children])el.style.setProperty("font-family",family,"important");
    b.onpointerdown=e=>e.preventDefault();
    b.onclick=()=>{select.value=value;select.dispatchEvent(new Event("change"));};
    group.append(b);
  }
  select.parentElement.classList.add("stacked-choice");
  select.hidden=true;select.before(group);
}
// The six shapes, as icons, instead of a dropdown.
const shapeChoices=[["process","Rectangle","shape"],["decision","Decision","diamond"],["pill","Start / end","pill"],["note","Note","note"],["circle","Circle","circle"],["io","Input / output","io"]];
{
  const select=$("shapeStyle"),group=document.createElement("div");
  group.className="stroke-choice-group shape-choices";group.dataset.select="shapeStyle";group.setAttribute("role","group");group.setAttribute("aria-label","Shape");
  for(const [value,label,iconName] of shapeChoices){
    const b=document.createElement("button");b.type="button";b.dataset.value=value;b.title=label;b.setAttribute("aria-label",label);
    b.innerHTML=icon(iconName);
    b.onpointerdown=e=>e.preventDefault();
    b.onclick=()=>{select.value=value;select.dispatchEvent(new Event("change"));};
    group.append(b);
  }
  select.parentElement.classList.add("stacked-choice");
  select.hidden=true;select.before(group);
}
for(const [id,choices] of strokeChoices){
  const select=$(id),group=document.createElement("div");
  group.className="stroke-choice-group";group.dataset.select=id;group.setAttribute("role","group");group.setAttribute("aria-label",select.parentElement.firstChild.textContent.trim());
  for(const [value,label,path,width,dash,filled] of choices){
    const b=document.createElement("button");b.type="button";b.dataset.value=value;b.title=label;b.setAttribute("aria-label",label);
    b.innerHTML='<svg viewBox="0 0 32 24" aria-hidden="true"><path d="'+path+'" fill="'+(filled?"currentColor":"none")+'" stroke="'+(filled?"none":"currentColor")+'" stroke-width="'+width+'" stroke-linecap="round" '+(dash?'stroke-dasharray="'+dash+'"':'')+'/></svg>';
    b.onpointerdown=e=>e.preventDefault();
    b.onclick=()=>{select.value=value;select.dispatchEvent(new Event("change"));};
    group.append(b);
  }
  select.hidden=true;select.before(group);
}
function syncStrokeControls(){
  for(const id of [...strokeChoices,...labelChoices].map(([id])=>id).concat("fontFamily","shapeStyle"))for(const b of document.querySelectorAll('[data-select="'+id+'"] button')){
    b.setAttribute("aria-pressed",String(b.dataset.value===$(id).value));
  }
}
