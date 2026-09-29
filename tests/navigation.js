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
assert(!$('stickerDropdown').hidden&&!$('modal').open,'Sticker button opens non-modal dropdown');
const option=$('stickerOptions').querySelector('[data-sticker]');option.click();
const one=d().nodes.find(n=>n.kind==='sticker');
assert(one.w===32&&one.h===32,'New stickers default to small 32px dimensions');
assert(!$('stickerDropdown').hidden&&$('addSticker').getAttribute('aria-expanded')==='true','Picker stays open after inserting sticker');
option.click();const stickers=d().nodes.filter(n=>n.kind==='sticker');
assert(stickers.length===2&&!M.overlap(stickers[0],stickers[1]),'Repeated picks insert distinct visible stickers');
setTool('text');
assert(!$('stickerDropdown').hidden&&$('addSticker').classList.contains('active'),'Changing canvas tool does not dismiss sticker picker');
const box=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent('pointerdown',{clientX:box.left+60,clientY:box.top+230,button:0,pointerId:1,bubbles:true}));canvas.dispatchEvent(new PointerEvent('pointerup',{clientX:box.left+60,clientY:box.top+230,button:0,pointerId:1,bubbles:true}));
assert(editing&&!$('stickerDropdown').hidden,'Canvas remains editable while sticker dropdown is open');
richEditor.value='Work continues here';richEditor.dispatchEvent(new Event('input'));commitEdit();
$('addSticker').click();assert($('stickerDropdown').hidden,'Clicking sticker toggle explicitly closes it');
$('addSticker').click();$('closeStickerDropdown').click();assert($('stickerDropdown').hidden,'Dropdown close button works');
$('addSticker').click();option.focus();$('stickerDropdown').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert($('stickerDropdown').hidden,'Escape inside picker closes it explicitly');
$('toggleDocuments').click();$('addSticker').click();
await switchSidebarDocument(first.id);
assert(!$('stickerDropdown').hidden,'Picker remains open across document switches');
positionStickerDropdown();const popup=$('stickerDropdown').getBoundingClientRect(),stage=$('stage').getBoundingClientRect();
assert(popup.left>=$('toolbar').getBoundingClientRect().right&&popup.right<=stage.right&&popup.top>=stage.top&&popup.bottom<=stage.bottom,'Dropdown opens beside the tool rail and stays inside the canvas');
await window.flushSave();assert((await native('load')).state.documents.every(doc=>M.validate(doc.canvas)),'Navigation and stickers preserve valid saved documents');
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
assert(!$('docMenu').hidden&&$('docTitle').getAttribute('aria-expanded')==='true'&&docMenuLabels==='rename,duplicate,import,export,trash','A click on the title opens the document menu with every document action');
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
assert($('modal').open&&$('modalBody').querySelector('.defaults-list'),'The header gear opens the defaults settings');
closeModal();

return results;
