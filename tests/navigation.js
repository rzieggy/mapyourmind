const results=[],errors=[];
window.addEventListener('error',e=>errors.push(e.message));
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
assert(loaded,'Native document store loads');await document.fonts.ready;
function createDoc(title){newDoc();$('nameInput').value=title;$('nameSubmit').click();return current;}
const first=createDoc('Customer support flow');
const n=M.node('flow',0,100,'process','Start a conversation');d().nodes.push(n);changed();
const second=createDoc('Launch checklist');
assert(!$('documentSidebar').hidden&&$('toggleDocuments').getAttribute('aria-expanded')==='true','Document sidebar starts open');
assert(!$('back'),'The back arrow is gone from the navigation bar');
const openWidth=canvas.clientWidth;
$('toggleDocuments').click();
assert($('documentSidebar').hidden&&$('toggleDocuments').getAttribute('aria-expanded')==='false','Navbar button collapses the sidebar');
assert(canvas.clientWidth===openWidth+sidebarWidth(),'Sidebar takes layout space instead of covering the canvas');
$('toggleDocuments').click();
assert(canvas.clientWidth===openWidth,'Reopening the sidebar restores the canvas width');
assert($('sidebarDocumentList').children.length===2,'Sidebar lists all active documents');
assert($('sidebarDocumentList').querySelector('[aria-current="page"]').dataset.documentId===second.id,'Current file has an active row');
const originalTitles=[first.title,second.title];
first.title='CPN Related';second.title='Discussion with Mas Arief and the customer support team';renderDocumentSidebar();
const rows=[...$('sidebarDocumentList').children];
const iconLefts=rows.map(row=>row.querySelector('svg').getBoundingClientRect().left);
const labelLefts=rows.map(row=>row.querySelector('span').getBoundingClientRect().left);
assert(Math.abs(iconLefts[0]-iconLefts[1])<.5&&Math.abs(labelLefts[0]-labelLefts[1])<.5,'Short and long file names share identical icon and label columns');
assert($('sidebarNewDocument').closest('.sidebar-top')&&$('sidebarNewDocument').getBoundingClientRect().right<=$('documentSidebar').getBoundingClientRect().right,'New document sits beside the logo at the top of the sidebar');
const longLabel=rows.find(row=>row.dataset.documentId===second.id).querySelector('span');
assert(longLabel.scrollWidth>longLabel.clientWidth&&longLabel.getBoundingClientRect().right<=longLabel.parentElement.getBoundingClientRect().right-7,'Long file names truncate inside their row without shifting indentation');
[first.title,second.title]=originalTitles;renderDocumentSidebar();
await switchSidebarDocument(first.id);
assert(current.id===first.id&&documentSidebarOpen,'Switch documents without closing sidebar');
beginEdit(n);richEditor.value='Edited before switching';richEditor.dispatchEvent(new Event('input'));
view.x=215;view.y=180;view.z=.8;
await switchSidebarDocument(second.id);
const disk=await native('load');
assert(disk.state.documents.find(doc=>doc.id===first.id).canvas.nodes[0].text==='Edited before switching','Switch flushes unfinished text editing to disk');
await switchSidebarDocument(first.id);
assert(!editing&&richEditor.hidden,'Previous text editor is not left on the new canvas');
assert(view.x===215&&view.y===180&&view.z===.8,'Each document restores its own viewport');
await switchSidebarDocument(second.id);
const realFlush=window.flushSave;window.flushSave=async()=>{throw Error('Simulated save failure');};
await switchSidebarDocument(first.id);
assert(current.id===second.id&&!$('stage').inert&&!documentSwitchPending,'Failed save leaves current document open and controls usable');
window.flushSave=realFlush;
first.title='Renamed document';renderDocumentSidebar();
assert($('sidebarDocumentList').textContent.includes('Renamed document'),'Sidebar shows updated names');
first.trashedAt=Date.now();renderDocumentSidebar();
assert($('sidebarDocumentList').children.length===1,'Trashed documents stay out of sidebar');
first.trashedAt=null;renderDocumentSidebar();
$('toggleDocuments').click();
assert($('documentSidebar').hidden&&canvas.clientWidth===openWidth+sidebarWidth(),'Collapsing sidebar restores full canvas width');
$('toggleDocuments').click();
$('addSticker').click();
assert(!$('stickerDropdown').hidden&&!$('modal').open,'Sticker button opens a non-modal dropdown');
const option=$('stickerOptions').querySelector('[data-sticker]');option.click();
assert(pendingSticker&&$('stickerDropdown').hidden&&!d().nodes.some(n=>n.kind==='sticker'),'Picking a sticker closes the panel and previews without inserting');
const box=canvas.getBoundingClientRect();
function stickerPointer(type,x,y){canvas.dispatchEvent(new PointerEvent(type,{clientX:box.left+x,clientY:box.top+y,button:0,pointerId:1,bubbles:true,cancelable:true}));}
stickerPointer('pointermove',140,230);stickerPointer('pointerdown',140,230);stickerPointer('pointerup',140,230);
const one=d().nodes.find(n=>n.kind==='sticker');
assert(one.w===32&&one.h===32,'Placed stickers use small 32px dimensions');
assert(!pendingSticker&&tool==='select','One placement returns to Select');
$('addSticker').click();option.click();stickerPointer('pointerdown',240,230);stickerPointer('pointerup',240,230);
const stickers=d().nodes.filter(n=>n.kind==='sticker');assert(stickers.length===2&&!M.overlap(stickers[0],stickers[1]),'Each picked sticker is placed at its chosen cursor position');
$('addSticker').click();option.click();setTool('text');assert(!pendingSticker,'Switching tools cancels pending sticker placement');
$('addSticker').click();canvas.focus();canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert($('stickerDropdown').hidden,'Escape from the canvas closes the sticker panel');
$('addSticker').click();$('closeStickerDropdown').click();assert($('stickerDropdown').hidden,'Dropdown close button works');
$('addSticker').click();option.focus();option.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert($('stickerDropdown').hidden,'Escape inside the picker closes it');
$('addSticker').click();option.click();canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert(!pendingSticker&&d().nodes.filter(n=>n.kind==='sticker').length===2,'Escape cancels a ghost without adding content');
$('addSticker').click();option.click();await switchSidebarDocument(first.id);assert(!pendingSticker,'Switching documents cancels pending placement');
if($('stickerDropdown').hidden)$('addSticker').click();positionStickerDropdown();const popup=$('stickerDropdown').getBoundingClientRect(),stage=$('stage').getBoundingClientRect();
assert(popup.left>=$('toolbar').getBoundingClientRect().right&&popup.right<=stage.right&&popup.top>=stage.top&&popup.bottom<=stage.bottom,'Dropdown opens beside the rail and stays in the canvas');
toggleStickerDropdown(false);
await window.flushSave();assert((await native('load')).state.documents.every(doc=>M.validate(doc.canvas)),'Navigation and placed stickers preserve valid saved documents');
selected.clear();inspect();setTool('select');paint();$('toast').hidden=true;await wait(100);await native('snapshot',{name:'features'});
assert(!errors.length,'No uncaught browser errors');
// Sorting, manual order, Trash and resizing in the document sidebar.
// Earlier steps leave the sidebar collapsed; these need it laid out.
if (!documentSidebarOpen) $('toggleDocuments').click();
assert(!$('documentSidebar').hidden, 'Sidebar is open for the rearrange checks');
const ordering = state.documents.filter(doc => !doc.trashedAt);
for (const doc of ordering) delete doc.order;
ordering.forEach((doc, i) => { doc.created = 1000 + i; doc.updated = 9000 - i; });
renderDocumentSidebar();
const byCreation = [...$('sidebarDocumentList').children].map(row => row.dataset.documentId);
assert(byCreation[0] === ordering.at(-1).id && byCreation.at(-1) === ordering[0].id,
  'Documents sort by creation date with the newest first, not by last activity');
assert(ordering.every(doc => doc.order === undefined),
  'No manual order is written until the list is rearranged by hand');

function rowFor(id) { return $('sidebarDocumentList').querySelector(`[data-document-id="${id}"]`); }
function pointerOn(target, type, y, extra = {}) {
  target.dispatchEvent(new PointerEvent(type, { clientX: 20, clientY: y, pointerId: 7, bubbles: true, button: 0, ...extra }));
}
const top = byCreation[0], bottom = byCreation.at(-1);
const other = byCreation.find(id => id !== current.id);
const otherRow = rowFor(other);
pointerOn(otherRow, 'pointerdown', otherRow.getBoundingClientRect().top + 10);
pointerOn(otherRow, 'pointerup', otherRow.getBoundingClientRect().top + 10);
await wait(200);
assert(current.id === other, 'A press without movement opens the document instead of rearranging it');
const bottomBox = rowFor(bottom).getBoundingClientRect();

const listEl = $('sidebarDocumentList');
const order = () => [...listEl.querySelectorAll('.sidebar-document')].map(r => r.dataset.documentId);
const moveRow = rowFor(bottom);
const startY = moveRow.getBoundingClientRect().top + 10;
pointerOn(moveRow, 'pointerdown', startY);
assert(sidebarReorder && sidebarReorder.id === bottom && !sidebarReorder.active,
  'Pressing a row arms a rearrange without starting one');
pointerOn(moveRow, 'pointermove', startY - 2);
assert(!sidebarReorder.active, 'A tiny movement is not a rearrange');
const targetY = rowFor(top).getBoundingClientRect().top + 2;
pointerOn(moveRow, 'pointermove', targetY);
assert(sidebarReorder.active && moveRow.classList.contains('dragging'),
  'Moving a pressed row starts a rearrange with no handle to grab');
assert(order()[0] === bottom, 'The dragged row follows the pointer while it is held');
pointerOn(moveRow, 'pointerup', targetY);
const rearranged = order();
assert(rearranged[0] === bottom, 'A dragged document keeps its new place');
assert(state.documents.filter(doc => !doc.trashedAt).every(doc => Number.isFinite(doc.order)),
  'Rearranging writes an order for every document, not just the moved one');
renderDocumentSidebar();
assert([...$('sidebarDocumentList').children].map(row => row.dataset.documentId).join() === rearranged.join(),
  'The manual order survives a re-render and overrides creation date');

const sidebarDoc = createDoc('Newest of all');
assert($('sidebarDocumentList').firstElementChild.dataset.documentId === sidebarDoc.id,
  'A new document goes to the top even when a manual order exists');

assert(!$('sidebarTrashList').hidden === false, 'Trash starts collapsed at the bottom of the sidebar');
assert($('sidebarTrash').compareDocumentPosition($('sidebarDocumentList')) & Node.DOCUMENT_POSITION_PRECEDING,
  'Trash sits below the document list');
await docAction('trash', sidebarDoc.id);
$('sidebarTrashToggle').click();
assert(!$('sidebarTrashList').hidden && $('sidebarTrashCount').textContent === '1' &&
  $('sidebarTrashList').querySelector(`[data-document-id="${sidebarDoc.id}"]`),
  'Trash lists deleted documents with a count');
assert(current.id !== sidebarDoc.id, 'Trashing the open document leaves it');
await docAction('restore', sidebarDoc.id);
assert(!state.documents.find(doc => doc.id === sidebarDoc.id).trashedAt && $('sidebarTrashCount').textContent === '',
  'Restore brings a document back out of Trash');

rowFor(sidebarDoc.id).dispatchEvent(new MouseEvent('contextmenu', { clientX: 40, clientY: 200, bubbles: true, cancelable: true }));
const menuActions = [...$('nodeContextMenu').querySelectorAll('[data-document-action]')].map(b => b.dataset.documentAction);
assert(!$('nodeContextMenu').hidden && menuActions.join() === 'rename,duplicate,trash,new',
  'Right-clicking a document offers rename, duplicate, trash and new document');
closeContextMenu();

const before = canvas.clientWidth, startWidth = sidebarWidth();
$('sidebarResizer').dispatchEvent(new PointerEvent('pointerdown', { clientX: startWidth, clientY: 300, pointerId: 9, bubbles: true, button: 0 }));
$('sidebarResizer').dispatchEvent(new PointerEvent('pointermove', { clientX: startWidth + 60, clientY: 300, pointerId: 9, bubbles: true }));
assert(sidebarWidth() === startWidth + 60 && canvas.clientWidth === before - 60,
  'Dragging the sidebar edge resizes it and gives the space back to the canvas');
$('sidebarResizer').dispatchEvent(new PointerEvent('pointermove', { clientX: 4000, clientY: 300, pointerId: 9, bubbles: true }));
assert(sidebarWidth() <= 360 && sidebarWidth() <= innerWidth / 3,
  'The sidebar stops before it eats the canvas');
$('sidebarResizer').dispatchEvent(new PointerEvent('pointermove', { clientX: -4000, clientY: 300, pointerId: 9, bubbles: true }));
assert(sidebarWidth() === 190, 'The sidebar has a minimum width too');
$('sidebarResizer').dispatchEvent(new PointerEvent('pointerup', { clientX: 0, clientY: 300, pointerId: 9, bubbles: true }));
state.sidebarWidth = 236; applySidebarWidth(); resize();

$('sidebarTrashToggle').click();
$('toast').hidden = true;
await wait(150);
await native('snapshot', { name: 'sidebar' });

// Phase 1 shell: the title opens the document menu; a double-click renames in place.
$('sidebarTrashToggle').click();
$('docTitle').click();
await wait(300);
const docMenuLabels=[...$('docMenu').querySelectorAll('[data-doc-action]')].map(b=>b.dataset.docAction).join();
assert(!$('docMenu').hidden&&$('docTitle').getAttribute('aria-expanded')==='true'&&docMenuLabels==='rename,duplicate,import,export,export-pdf,trash','A click on the title opens the document menu with every document action');
assert($('docMenu').querySelector('.menu-info').textContent.includes(d().nodes.length+' element'),'The document menu shows the element count');
await native('snapshot', { name: 'docmenu' });
$('docMenu').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
assert($('docMenu').hidden,'Escape closes the document menu');
const titleBefore=current.title;
$('docTitle').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
let titleField=document.querySelector('.title-input');
assert(titleField&&$('docTitle').hidden&&titleField.value===titleBefore,'A double-click on the title renames in place');
titleField.value='Escape keeps the name';titleField.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
assert(current.title===titleBefore&&!document.querySelector('.title-input')&&!$('docTitle').hidden,'Escape cancels an in-place rename');
$('docTitle').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
titleField=document.querySelector('.title-input');titleField.value='Renamed in place';titleField.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
await wait(300);
assert(current.title==='Renamed in place'&&$('docTitle').textContent==='Renamed in place'&&$('docMenu').hidden,'Enter saves the in-place rename without opening the menu');
assert(rowFor(current.id).textContent.includes('Renamed in place'),'The sidebar shows the new name');
current.title=titleBefore;$('docTitle').textContent=titleBefore;renderDocumentSidebar();
$('openSettings').click();await wait(50);
assert($('modal').open&&$('modalBody').querySelector('.settings-list'),'The sidebar Settings opens the settings');
closeModal();

assert($('openSettings').closest('#sidebarTrash')&&$('openSettings').getBoundingClientRect().bottom<=$('sidebarTrashToggle').getBoundingClientRect().top,'Settings sits above Trash in the sidebar');
assert(getComputedStyle($('sidebarDocumentList').querySelector('.sidebar-document')).fontSize==='14px','Document rows use readable 14px text');
const swatch=$('fillColors').querySelector('button'), custom=$('fillCustom');
assert(getComputedStyle(swatch).width==='28px'&&getComputedStyle(swatch).height==='24px'&&getComputedStyle(swatch).borderRadius==='6px','Fill swatches are compact rounded rectangles');
assert(custom.parentElement===$('fillColors').parentElement&&custom.parentElement!==$('fillColors')&&getComputedStyle(custom).height==='24px','Custom colour has a matching size and stays outside the scroller');
// Phase 2: the mind-map context bar, font tiles and shape icons.
current.canvas=M.blank();history=new M.History();
const treeRoot=M.node("mind",300,200,"process","Launch ideas");d().nodes.push(treeRoot);
const treeChild=M.extend(d(),treeRoot.id,true);treeChild.text="Templates";
const loneRoot=M.node("mind",300,700,"process","Another tree");d().nodes.push(loneRoot);
const flowBox=M.node("flow",900,200,"process","Flow step");d().nodes.push(flowBox);
setTool("select");selected=new Set([treeChild.id]);inspect();paint();
function contextAt(node) {const r=canvas.getBoundingClientRect();canvas.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+(node.x+node.w/2)*view.z+view.x,clientY:r.top+(node.y+node.h/2)*view.z+view.y}));}
assert(!$('contextBar'),'Node selection has no floating toolbar');
contextAt(treeChild);
assert($('nodeContextMenu').querySelector('[data-context="child"]')&&$('nodeContextMenu').querySelector('[data-context="comment"]'),'Right-click offers Add child and Comment');
closeContextMenu();selected=new Set([treeRoot.id,treeChild.id]);paint();
assert(!$('contextBar'),'Multi-selection has no floating toolbar');
contextAt(treeChild);assert($('nodeContextMenu').querySelector('[data-context="group"]'),'Right-click retains multi-selection actions');closeContextMenu();
selected=new Set([flowBox.id]);paint();assert(!$('contextBar'),'Flowchart selection has no floating toolbar');
selected=new Set([treeChild.id]);paint();Object.assign(treeChild,{offsetX:60,offsetY:40});loneRoot.offsetX=0;
const loneBefore={x:loneRoot.x,y:loneRoot.y};contextAt(treeChild);$('nodeContextMenu').querySelector('[data-context="arrange"]').click();
assert(treeChild.offsetX===0&&treeChild.offsetY===0&&loneRoot.x===loneBefore.x&&loneRoot.y===loneBefore.y,'Right-click Arrange tree tidies only the selected tree');
undo();assert(d().nodes.find(n=>n.id===treeChild.id).offsetX===60,'One Undo reverts Arrange tree');
selected=new Set([treeChild.id]);contextAt(d().nodes.find(n=>n.id===treeChild.id));$('nodeContextMenu').querySelector('[data-context="child"]').click();
assert(d().nodes.some(n=>n.parent===treeChild.id),'Right-click Add child creates a child');
commitEdit();const flowNow=()=>d().nodes.find(n=>n.id===flowBox.id);selected=new Set([flowBox.id]);inspect();
const fontTiles=[...document.querySelectorAll('[data-select="fontFamily"] button')];
assert(fontTiles.length===3&&['Excalifont','Google Sans','Comic Shanns'].every((f,i)=>getComputedStyle(fontTiles[i].querySelector('.font-sample')).fontFamily.includes(f)&&getComputedStyle(fontTiles[i].querySelector('.font-name')).fontFamily.includes(f)),'Font family is three tiles, each sample and name drawn in its own font');
fontTiles[2].click();
assert(flowNow().fontFamily==="Comic Shanns"&&fontTiles[2].getAttribute('aria-pressed')==='true','A font tile applies its font and shows as chosen');
flowNow().fontFamily="Arial";inspect();
assert(fontTiles.every(t=>t.getAttribute('aria-pressed')==='false'),'An element still in Arial keeps it, with no tile pressed');
const shapeTiles=[...document.querySelectorAll('[data-select="shapeStyle"] button')];
assert(shapeTiles.length===6&&$('shapeStyle').hidden,'Shape is six icons instead of a dropdown');
shapeTiles[1].click();
assert(flowNow().shape==="decision"&&shapeTiles[1].getAttribute('aria-pressed')==='true','A shape icon changes the shape');
paint();await wait(80);await native('snapshot',{name:'phase2-panel'});
selected=new Set([treeChild.id]);inspect();paint();await wait(80);await native('snapshot',{name:'phase2-bar'});
const stageBox=canvas.getBoundingClientRect(),nodeNow=d().nodes.find(n=>n.id===treeChild.id);
canvas.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:stageBox.left+(nodeNow.x+20)*view.z+view.x,clientY:stageBox.top+(nodeNow.y+20)*view.z+view.y}));
await wait(60);
assert(!$('nodeContextMenu').hidden&&getComputedStyle($('nodeContextMenu')).backgroundColor==='rgb(37, 50, 69)'&&!$('nodeContextMenu').querySelector('kbd'),'The right-click menu is dark slate with no shortcut chips');
await native('snapshot',{name:'phase2-context'});
$('nodeContextMenu').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
if($('stickerDropdown').hidden)$('addSticker').click();
$('toolbar').querySelector('[data-tool="shape"]').click();await wait(60);
assert($('stickerDropdown').hidden,'Choosing another tool closes the sticker dropdown');
assert(!$('shapePicker').hidden&&getComputedStyle($('shapePicker')).backgroundColor==='rgb(37, 50, 69)'&&!$('shapePicker').querySelector('kbd')&&$('shapePicker').getBoundingClientRect().left>=$('toolbar').getBoundingClientRect().right,'The shape picker is dark, has no shortcut chips and opens beside the rail');
await native('snapshot',{name:'phase2-picker'});
setTool('select');

// Phase 4a: Find searches the full graph, including hidden descendants, but not comments.
const findDoc=createDoc('Find acceptance');
const findRoot=M.node('mind',0,100,'pill','Mango root');
const findChild=M.node('mind',3500,1500,'process','Mango hidden');findChild.parent=findRoot.id;
const findPeer=M.node('flow',400,100,'process','mango peer');
const commentOnly=M.node('flow',400,300,'process','Unrelated');
commentOnly.notes=[{id:M.uid(),text:'Mango comment',created:Date.now(),replies:[]}];
d().nodes.push(findRoot,findChild,findPeer,commentOnly);
M.connect(d(),findRoot.id,findChild.id,{tree:true});findRoot.collapsed=true;
const findEdge=M.connect(d(),findPeer.id,commentOnly.id);findEdge.label='Mango link';
selected=new Set([findRoot.id]);inspect();paint();
const findKey=(key,extra={})=>$('findInput').dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...extra}));
canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'f',metaKey:true,bubbles:true,cancelable:true}));
assert(!findBar.hidden&&document.activeElement===$('findInput')&&$('findInput').value==='Mango root'&&$('findInput').selectionEnd===$('findInput').value.length,'Command F focuses Find with the selected node text fully selected');
$('findInput').value='Mango';$('findInput').dispatchEvent(new Event('input'));
assert(findMatches.length===4&&$('findCount').textContent==='1 of 4'&&findRoot.collapsed,'Find counts node text and connector labels including collapsed descendants, excluding comments');
const findBoxUI=findBar.getBoundingClientRect(),findPanelUI=$('inspector').getBoundingClientRect();
assert(findBoxUI.right<=findPanelUI.left-15&&Math.abs(findBoxUI.top-$('stage').getBoundingClientRect().top-16)<1&&Math.abs(findBoxUI.width-340)<2,'Find floats 16px from the top and stays clear of the open style panel');
findKey('Enter');
assert(selected.has(findChild.id)&&!findRoot.collapsed&&$('findCount').textContent==='2 of 4','Enter advances and expands a collapsed ancestor when its match becomes current');
const foundFrame=usableViewport(true);
assert(findChild.x>=foundFrame.x-1&&findChild.x+findChild.w<=foundFrame.x+foundFrame.w+1&&findChild.y>=foundFrame.y-1&&findChild.y+findChild.h<=foundFrame.y+foundFrame.h+1,'Find pans an offscreen match into the usable viewport');
findKey('Enter',{shiftKey:true});assert(selected.has(findRoot.id),'Shift Enter returns to the previous match');
$('findCase').click();assert(findMatches.length===3&&$('findCount').textContent==='1 of 3'&&$('findCase').getAttribute('aria-pressed')==='true','Aa enables case-sensitive search');
$('findPrev').click();assert(selected.has(findEdge.id)&&$('findCount').textContent==='3 of 3','Previous wraps to and selects a connector label');
$('findNext').click();assert(selected.has(findRoot.id),'Next wraps to the first match');
$('findCase').click();findChild.x=800;findChild.y=250;fit();paint();$('toast').hidden=true;await wait(80);await native('snapshot',{name:'phase4a-find-board'});
const ringColors=[];const strokeRectFind=ctx.stroke;ctx.stroke=function(...args){ringColors.push(this.strokeStyle);return strokeRectFind.apply(this,args);};paint();ctx.stroke=strokeRectFind;
assert(ringColors.includes('#2474d0')&&ringColors.includes('#f5b400'),'Current Find match has a blue ring and other visible matches have amber rings');
findKey('Escape');assert(findBar.hidden&&selected.has(findRoot.id)&&document.activeElement===canvas,'Escape removes Find rings and keeps the current node selected for editing');
openFind();$('findInput').value='no such text';$('findInput').dispatchEvent(new Event('input'));
assert($('findCount').textContent==='No results'&&$('findInput').getAttribute('aria-invalid')==='true'&&findBar.classList.contains('no-results')&&$('findNext').disabled,'No results shows the error field and disables navigation');
await wait(60);await native('snapshot',{name:'phase4a-find-empty'});
$('findClose').click();
assert(commandCatalog().some(c=>c.id==='find'&&c.label==='Find in board…'),'Command menu exposes Find in board');
openFind();await switchSidebarDocument(first.id);assert(findBar.hidden&&findMatches.length===0,'Changing documents clears Find and its highlights');

await switchSidebarDocument(findDoc.id);
selected=new Set([findPeer.id]);inspect();
toggleDocMenu();
const pdfMenuItem=$('docMenu').querySelector('[data-doc-action="export-pdf"]');
assert(pdfMenuItem&&pdfMenuItem.previousElementSibling.dataset.docAction==='export','Export PDF is its own document menu item directly after Export PNG');
$('toast').hidden=true;await native('snapshot',{name:'phase4a-pdf-menu'});
pdfMenuItem.click();
assert($('modal').open&&[...$('pdfScope').options].map(x=>x.value).join()==='all,selection'&&[...$('pdfBackground').options].map(x=>x.value).join()==='white,transparent','Board PDF dialog offers whole board or selection and white or transparent');
assert($('pdfScope').value==='selection'&&$('modal').textContent.includes('3×'),'PDF dialog defaults to the current selection and explains its raster resolution');
await native('snapshot',{name:'phase4a-pdf-dialog'});closeModal();
assert(commandCatalog().some(c=>c.id==='export-pdf'&&c.label==='Export PDF…'),'Command menu exposes Board Export PDF');
findRoot.collapsed=true;selected=new Set([findPeer.id]);inspect();
openFind();$('findInput').value='mango peer';$('findInput').dispatchEvent(new Event('input'));
hoveredNode=findPeer.id;paint();
const pdfNative=native,pdfDrawNode=drawNode,pdfBadges=drawCollapsedBadge;
let pdfMessages=[],pdfNodes=[],pdfBadgeCalls=0;
native=function(action,body){if(action==='boardPDF')pdfMessages.push(body);return pdfNative(action,body);};
drawNode=function(c,n,helpers){if(c!==ctx)pdfNodes.push(n.id);return pdfDrawNode(c,n,helpers);};
drawCollapsedBadge=function(...args){if(args[0]!==ctx)pdfBadgeCalls++;return pdfBadges(...args);};
const boardWhitePDF=await exportBoardPDF('all','white',true);
drawNode=pdfDrawNode;drawCollapsedBadge=pdfBadges;
assert(boardWhitePDF.pages===1&&boardWhitePDF.path.includes('board-white-all-test.pdf'),'Board PDF is written to the native test temporary directory and reopens as one page');
const expectedPDFBounds=exportBounds(exportElements('all'),d(),false);
assert(Math.abs(boardWhitePDF.width-(expectedPDFBounds.w+60))<.34&&Math.abs(boardWhitePDF.height-(expectedPDFBounds.h+60))<.34&&boardWhitePDF.pixelWidth===Math.round(boardWhitePDF.width*3)&&boardWhitePDF.pixelHeight===Math.round(boardWhitePDF.height*3),'Board PDF page follows content bounds with padding and embeds a 3x raster');
assert(boardWhitePDF.cornerAlpha===1&&!pdfNodes.includes(findChild.id)&&pdfBadgeCalls===0,'White PDF has an opaque background and excludes collapsed descendants and collapse helpers');
closeFind();hoveredNode=null;await exportBoardPDF('all','white',true);
assert(pdfMessages[0].data===pdfMessages[1].data,'Find rings, selection handles and hover helpers never enter the PDF raster');
const boardTransparentPDF=await exportBoardPDF('all','transparent',true);
assert(boardTransparentPDF.pages===1&&boardTransparentPDF.cornerAlpha===0,'Transparent PDF preserves the raster alpha channel');
selected=new Set([findPeer.id]);const selectionPDF=await exportBoardPDF('selection','white',true);
assert(selectionPDF.width<boardWhitePDF.width&&Math.abs(selectionPDF.width-findPeer.w-60)<.34,'Selection PDF contains only the selected content with its own page size');
selected=new Set([findEdge.id]);const connectorPDF=await exportBoardPDF('selection','transparent',true);
assert(connectorPDF.pages===1&&connectorPDF.width>60&&connectorPDF.height>60,'A connector-only selection exports using the full board endpoint geometry');
const beforeCancelMessages=pdfMessages.length,canceledPDF=exportBoardPDF('all','white',true);$('cancelPDF').click();await canceledPDF;
assert(!boardPDFExporting&&!$('modal').open&&pdfMessages.length===beforeCancelMessages,'Cancel during PDF preparation writes no file and releases the export state');
const escapePDF=exportBoardPDF('all','white',true);$('modal').dispatchEvent(new Event('cancel',{cancelable:true}));await escapePDF;
assert(!boardPDFExporting&&!$('modal').open&&pdfMessages.length===beforeCancelMessages,'Escape during PDF preparation cancels before the native save panel or file write');
const hugePDFNode=M.node('flow',0,0);hugePDFNode.w=6000;d().nodes.push(hugePDFNode);
await exportBoardPDF('all','white',true);
assert($('modal').textContent.includes('PDF is too large')&&!boardPDFExporting&&pdfMessages.length===beforeCancelMessages,'Oversized PDF is refused before allocating a raster or asking native to write');
closeModal();d().nodes=d().nodes.filter(n=>n.id!==hugePDFNode.id);
native=async(action,body)=>{if(action==='boardPDF')throw Error('Simulated PDF failure');return pdfNative(action,body);};
let pdfFailure=false;try{await exportBoardPDF('all','white',true);}catch(e){pdfFailure=e.message==='Simulated PDF failure';}
assert(pdfFailure&&!boardPDFExporting&&!$('modal').open,'A native PDF failure cleans up the progress dialog and allows retry');native=pdfNative;
let rejectedPDF=false;try{await native('boardPDF',{data:'bad image',width:100,height:100,test:true});}catch(e){rejectedPDF=true;}
assert(rejectedPDF,'Native PDF bridge rejects invalid raster data');
await native('log',{message:'Phase 4a PDF fixtures: '+boardWhitePDF.path+' | '+boardTransparentPDF.path+' | '+selectionPDF.path+' | '+connectorPDF.path});
assert(!errors.length,'Phase 4a has no uncaught browser errors');

return results;
