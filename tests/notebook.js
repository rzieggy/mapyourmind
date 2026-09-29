const results=[],errors=[];
window.addEventListener("error",e=>errors.push(e.message));
const assert=(v,label)=>{if(!v)throw Error(label);results.push(label);};
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
const wait=ms=>new Promise(r=>setTimeout(r,ms));
for(let i=0;i<100&&!loaded;i++)await wait(50);
assert(loaded,"Document store loads");await document.fonts.ready;
assert(document.fonts.check('19px "Comic Shanns"'),"Comic Shanns bundled font loads offline");
function create(title,mode="notes"){newDoc();document.querySelector('[data-new-mode="'+mode+'"]').click();$("nameInput").value=title;$("nameSubmit").click();return current;}
const note=create("Weekly notes");
assert(isNotebook()&&!notebook.hidden&&getComputedStyle(canvas).display==="none","Notes opens a dedicated scrolling editor without canvas");
assert($("exportOpen").textContent.includes("PDF"),"Notes export button shows PDF");
assert(current.note.fontFamily==="Excalifont","Notes default to handwritten font");
assert(getComputedStyle($("noteToolbar")).display!=="none","Notes has writing toolbar");
noteExec("insertText","Hello world");
assert(current.note.html.includes("Hello world")&&!$("undo").disabled,"Typing updates note and enables undo");
await notebookCommand("all");await notebookCommand("bold");
assert(/font-weight|<b>|<strong>/.test(current.note.html),"Bold applies to selected text");
await notebookCommand("undo");
assert(!/font-weight|<b>|<strong>/.test(current.note.html),"Notes undo reverses formatting");
await notebookCommand("redo");
assert(/font-weight|<b>|<strong>/.test(current.note.html),"Notes redo restores formatting");
restoreNoteSelection(null);preserveNoteRange();
noteBody.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true,cancelable:true}));
noteExec("insertText","Second paragraph");
assert(noteBody.children.length>=2,"Enter creates a new paragraph");
const paragraphs=noteBody.children.length;
noteBody.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",shiftKey:true,bubbles:true,cancelable:true}));
noteExec("insertText","Same paragraph");
assert(noteBody.children.length===paragraphs&&(noteBody.querySelector("br")||noteBody.textContent.includes("Second paragraph\nSame paragraph")),"Shift Enter adds an inline newline");
await notebookCommand("bullet");
assert(!!noteBody.querySelector("ul li"),"Bullet list command creates list items");
await notebookCommand("checklist");
assert(!!noteBody.querySelector("li[data-checked]"),"Checklist command marks list item");
noteBody.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true,cancelable:true}));
noteExec("insertText","Next task");
assert(noteBody.querySelectorAll('li[data-checked="false"]').length>=2,"Checklist Enter continues with unchecked task");
const preTab=d().nodes.length;
noteBody.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",bubbles:true,cancelable:true}));
assert(d().nodes.length===preTab,"Notes Tab never creates diagram nodes");
$("noteFont").value="Google Sans";$("noteFont").dispatchEvent(new Event("change"));
assert(current.note.fontFamily==="Google Sans"&&getComputedStyle($("notePage")).fontFamily.includes("Google Sans"),"Font picker updates whole note");
$("noteFont").value="Comic Shanns";$("noteFont").dispatchEvent(new Event("change"));
assert(current.note.fontFamily==="Comic Shanns","Code-style font is selectable");
const safe=sanitizeNote('<p onclick="evil()">Safe<script>evil()</script><img src="https://example.com/track"><a href="javascript:evil()">link</a><span style="position:fixed;background-image:url(https://example.com)">text</span></p>');
assert(!/onclick|script|img|javascript|position|url\(/.test(safe)&&safe.includes("Safe"),"Paste sanitization removes executable and external resource content");
await native("clipboardWrite",{text:"Keep this clipboard"});
await window.appCommand("image");
assert((await native("clipboardRead")).text==="Keep this clipboard","Command Shift C leaves clipboard unchanged in Notes");
await window.flushSave();
const disk=(await native("load")).state;
assert(disk.schema===3&&disk.documents.find(x=>x.id===note.id).note.html.includes("Hello world"),"Notes persist in versioned local store");
const flow=create("Diagram styles","board");
assert(!isNotebook()&&notebook.hidden&&$("exportOpen").textContent.includes("PNG"),"Diagram UI and PNG return after switching");
const n=M.node("flow",100,100,"process","A longer title that wraps across multiple lines in different fonts");
d().nodes.push(n);selected=new Set([n.id]);autoSize(n);inspect();
for(const font of documentFonts){styleSelection("fontFamily",font);assert(n.fontFamily===font&&n.h>0,"Diagram font layout: "+font);beginEdit(n);assert(getComputedStyle(richEditor).fontFamily.includes(font),"Active text editor uses "+font);commitEdit();}
document.querySelector('[data-select="sloppiness"] button[data-value="0"]').click();
assert(n.sloppiness===0&&document.querySelector('[data-select="sloppiness"] button').getAttribute("aria-pressed")==="true","Leftmost sloppiness button selects clean geometry");
styleSelection("strokeStyle","dashed");
assert(sketchShape(n).options.roughness===0&&sketchShape(n).options.disableMultiStroke,"Clean shape has no wobble or double stroke");
assert(sketchShape(n).options.strokeLineDash.length===2,"Dashed stroke reaches the drawing engine");
const clean=sketchShape(n);styleSelection("sloppiness",2);
assert(sketchShape(n)!==clean&&sketchShape(n).options.roughness>1,"Sloppiness refreshes cached shape geometry");
const second=M.node("flow",400,100);d().nodes.push(second);
const edge=M.connect(d(),n.id,second.id);selected=new Set([edge.id]);
styleSelection("strokeStyle","dotted");styleSelection("sloppiness",0);
assert(edge.strokeStyle==="dotted"&&edge.sloppiness===0,"Connector accepts stroke style and sloppiness");
assert(validDocument(current),"Styled diagram validates");
await switchSidebarDocument(note.id);
assert(current.note.fontFamily==="Comic Shanns"&&noteBody.textContent.includes("Hello world"),"Switching back restores notes and font");
assert(noteUndo.length===1,"Undo history does not cross document boundaries");
const before=current.note.html;await notebookCommand("undo");assert(current.note.html===before,"Fresh note undo cannot revert another document");
current.note.fontFamily="Excalifont";applyNoteStyle();
noteBody.innerHTML="<h2>Meeting outcomes</h2><p>Keep the writing simple, local, and easy to revisit.</p><ul><li data-checked='true'>Review the customer journey</li><li data-checked='false'>Prepare next steps</li></ul>";syncNotebook();
await wait(100);await native("snapshot",{name:"rich"});
const emptyHTML=current.note.html;
noteBody.innerHTML="<p><br></p>";syncNotebook();
const emptyPDF=await exportNotePDF(true);assert(emptyPDF.pages>=1&&emptyPDF.text.includes("Weekly notes"),"Empty note exports a PDF with its title");
noteBody.innerHTML=emptyHTML+Array.from({length:100},(_,i)=>"<p>Paragraph "+i+": Offline notes preserve readable text, lists, and consistent page margins.</p>").join("");
syncNotebook();
const pdf=await exportNotePDF(true);
assert(pdf.pages>1&&pdf.text.includes("Paragraph 99"),"Long PDF has multiple pages and includes final paragraph");
assert(!pdf.text.includes("NOTE STYLE")&&!pdf.text.includes("Export PDF"),"PDF excludes toolbar and sidebar");
assert(pdf.text.includes("Meeting outcomes"),"PDF retains selectable text");
noteBody.innerHTML=emptyHTML;syncNotebook();await window.flushSave();
await goHome();
await docAction("duplicate",note.id);
const copy=state.documents.find(x=>x.id!==note.id&&x.mode==="notes");
assert(copy.note.html===note.note.html,"Duplicating Notes preserves formatted content");
await docAction("trash",copy.id);assert(!!copy.trashedAt,"Notes can move to Trash");
await docAction("restore",copy.id);assert(!copy.trashedAt,"Notes can be restored");
openDoc(copy.id);
noteBody.innerHTML="<ul><li><br></li></ul>";syncNotebook();restoreNoteSelection({a:[0,0],ao:0,b:[0,0],bo:0});preserveNoteRange();
noteBody.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true,cancelable:true}));
assert(!noteBody.querySelector("li"),"Enter on an empty list item exits the list");
noteBody.innerHTML="<p>One</p>";syncNotebook();restoreNoteSelection(null);preserveNoteRange();
noteBody.dispatchEvent(new KeyboardEvent("keydown",{key:"&",code:"Digit7",metaKey:true,shiftKey:true,bubbles:true,cancelable:true}));
assert(!!noteBody.querySelector("ol"),"Command Shift 7 creates a numbered list");
noteBody.dispatchEvent(new KeyboardEvent("keydown",{key:"*",code:"Digit8",metaKey:true,shiftKey:true,bubbles:true,cancelable:true}));
assert(!!noteBody.querySelector("ul"),"Command Shift 8 creates a bullet list");
await goHome();
assert($("importMindmap").classList.contains("secondary")&&$("importMindmap").querySelector("svg"),"Home import is a secondary icon button");
const a=$("importMindmap").getBoundingClientRect(),b=$("newDoc").getBoundingClientRect();
assert(Math.abs(a.top-b.top)<2&&b.left>a.right,"Import sits beside New document");
await native("snapshot",{name:"home"});
assert(!errors.length,"No uncaught browser errors");
return results;
