"use strict";
const findBar = document.createElement("section");
findBar.id = "findBar";
findBar.hidden = true;
findBar.setAttribute("role", "search");
findBar.setAttribute("aria-label", "Find in document");
findBar.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input id="findInput" aria-label="Find text" placeholder="Find in board…" autocomplete="off"><span id="findCount" role="status" aria-live="polite"></span><button id="findCase" aria-label="Match case" aria-pressed="false" title="Match case">Aa</button><button id="findPrev" aria-label="Previous match" title="Previous (⇧Enter)">↑</button><button id="findNext" aria-label="Next match" title="Next (Enter)">↓</button><button id="findClose" aria-label="Close find" title="Close (Esc)">×</button>';
$('stage').append(findBar);
const findHighlights = document.createElement("div");
findHighlights.id = "findHighlights";
findHighlights.setAttribute("aria-hidden", "true");
$('stage').append(findHighlights);
let findMatches = [], findIndex = -1, findDocument = null;
function openFind() {
  if (!current || $('modal').open || $('commandMenu').open) return;
  if (editing) commitEdit();
  if (drag) cancelDrag();
  closeContextMenu(); closeDocMenu();
  findDocument = current.id;
  findBar.hidden = false;
  const n = d().nodes.find(n => selected.has(n.id));
  $('findInput').value = isNotebook() ? getSelection().toString() : n?.text || "";
  $('findInput').placeholder = isNotebook() ? "Find in note…" : "Find in board…";
  updateFind(true);
  positionFind();
  $('findInput').focus(); $('findInput').select();
}
function closeFind(focus = true) {
  if (findBar.hidden) return;
  const match = findMatches[findIndex];
  findBar.hidden = true;
  findHighlights.replaceChildren();
  findMatches = []; findIndex = -1; findDocument = null;
  if (focus && current) {
    if (isNotebook()) {
      noteBody.focus();
      if (match?.range && noteBody.contains(match.range.startContainer)) {
        const s = getSelection(); s.removeAllRanges(); s.addRange(match.range);
        preserveNoteRange();
      }
    } else canvas.focus();
  }
  if (current && !isNotebook()) paint();
}
function noteFindMatches(query, matchCase) {
  const walker = document.createTreeWalker(noteBody, NodeFilter.SHOW_TEXT), pieces = [];
  let text = "", node;
  while ((node = walker.nextNode())) {
    // Separate paragraphs and line breaks, but allow a match across inline marks.
    if (pieces.length) {
      const previous = pieces[pieces.length - 1].node;
      const block = n => n.parentElement.closest('p,div,h1,h2,h3,li');
      const gap = document.createRange(); gap.setStartAfter(previous); gap.setEndBefore(node);
      if (block(previous) !== block(node) || gap.cloneContents().querySelector('br')) text += "\n";
    }
    pieces.push({node, start:text.length}); text += node.textContent;
  }
  // A regex keeps offsets in the original UTF-16 text even when case folding changes length.
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), matchCase ? "gu" : "giu");
  const matches = []; let found;
  while ((found = pattern.exec(text))) {
    const start = found.index, end = start + found[0].length;
    const a = pieces.find(p => start >= p.start && start < p.start + p.node.length);
    const b = pieces.find(p => end > p.start && end <= p.start + p.node.length);
    if (!a || !b) continue;
    const range = document.createRange();
    range.setStart(a.node, start - a.start); range.setEnd(b.node, end - b.start);
    matches.push({id:String(start), range});
  }
  return matches;
}
function updateFind(activate = false, reset = true) {
  if (findBar.hidden || findDocument !== current?.id) return;
  const previous = findMatches[findIndex]?.id, query = $('findInput').value;
  const matchCase = $('findCase').getAttribute('aria-pressed') === 'true';
  if (!query) findMatches = [];
  else if (isNotebook()) findMatches = noteFindMatches(query, matchCase);
  else {
    const includes = text => matchCase ? text.includes(query) : text.toLowerCase().includes(query.toLowerCase());
    findMatches = d().nodes.filter(n => includes(n.text || '')).map(n => ({id:n.id, node:n}));
    findMatches.push(...d().edges.filter(e => includes(e.label || '')).map(e => ({id:e.id, edge:e})));
  }
  findIndex = findMatches.length ? (reset ? 0 : Math.max(0, findMatches.findIndex(m => m.id === previous))) : -1;
  findStatus();
  if (activate) activateFindMatch();
  if (!isNotebook()) paint();
  paintNoteFind();
}
function refreshFind() { updateFind(false, false); }
function findStatus() {
  const empty = !!$('findInput').value && !findMatches.length;
  $('findCount').textContent = findMatches.length ? `${findIndex + 1} of ${findMatches.length}` : empty ? 'No results' : '';
  $('findInput').setAttribute('aria-invalid', String(empty));
  findBar.classList.toggle('no-results', empty);
  $('findPrev').disabled = $('findNext').disabled = !findMatches.length;
}
function moveFind(delta) {
  if (!findMatches.length) return;
  findIndex = (findIndex + delta + findMatches.length) % findMatches.length;
  findStatus(); activateFindMatch();
  if (!isNotebook()) paint();
  paintNoteFind();
}
function findBox(match) { return match.node || (match.edge && edgeLabel(match.edge)); }
function activateFindMatch() {
  const match = findMatches[findIndex]; if (!match) return;
  if (isNotebook()) {
    const r = match.range.getBoundingClientRect(), frame = $('noteScroll').getBoundingClientRect();
    if (r.top < frame.top + 64 || r.bottom > frame.bottom - 24)
      $('noteScroll').scrollTop += r.top - frame.top - 80;
    return;
  }
  const byId = M.byId(d()), collapsed = new Set();
  for (const id of match.node ? [match.id] : [match.edge.from, match.edge.to]) {
    let n = byId.get(id);
    while (n?.parent) { n = byId.get(n.parent); if (n?.collapsed) collapsed.add(n); }
  }
  if (collapsed.size) mutate(() => { for (const n of collapsed) n.collapsed = false; }, false);
  selected = new Set([match.id]);
  setTool('select'); inspect(); positionFind();
  const box = findBox(match); if (!box) return;
  const frame = usableViewport(true), factor = Math.min(1, frame.w / (box.w + 24 / view.z), frame.h / (box.h + 24 / view.z));
  if (factor < 1) view.z = Math.max(.1, view.z * factor);
  ensureVisible({x:box.x - 8 / view.z, y:box.y - 8 / view.z, w:box.w + 16 / view.z, h:box.h + 16 / view.z});
}
function paintFind(c) {
  if (findBar.hidden) return;
  const shown = visibleCanvas(), ids = new Set([...shown.nodes, ...shown.edges].map(n => n.id));
  for (const [i, match] of findMatches.entries()) {
    if (!ids.has(match.id)) continue;
    const b = findBox(match); if (!b) continue;
    c.save(); c.lineWidth = 2 / view.z;
    c.strokeStyle = i === findIndex ? '#2474D0' : '#F5B400';
    if (i === findIndex) { c.shadowColor = '#2474D066'; c.shadowBlur = 10; }
    c.beginPath(); c.roundRect(b.x - 4 / view.z, b.y - 4 / view.z, b.w + 8 / view.z, b.h + 8 / view.z, 6 / view.z); c.stroke(); c.restore();
  }
}
function paintNoteFind() {
  findHighlights.replaceChildren();
  if (findBar.hidden || !isNotebook()) return;
  const stage = $('stage').getBoundingClientRect(), frame = $('noteScroll').getBoundingClientRect();
  for (const [i, match] of findMatches.entries()) for (const r of match.range.getClientRects()) {
    const top = Math.max(r.top, frame.top), bottom = Math.min(r.bottom, frame.bottom);
    if (bottom <= top) continue;
    const ring = document.createElement('div'); ring.className = 'find-note-ring' + (i === findIndex ? ' current' : '');
    Object.assign(ring.style, {left:r.left-stage.left+'px', top:top-stage.top+'px', width:r.width+'px', height:bottom-top+'px'});
    findHighlights.append(ring);
  }
}
function positionFind() {
  if (findBar.hidden) return;
  const panel = isNotebook() ? $('noteInspector') : !$('inspector').hidden ? $('inspector') : !$('notesPanel').hidden ? $('notesPanel') : null;
  const stage = $('stage').getBoundingClientRect();
  const inset = panel ? Math.max(0, stage.right - panel.getBoundingClientRect().left) : 0;
  findBar.style.right = inset + 16 + 'px';
  findBar.style.top = isNotebook() ? '76px' : '16px';
  findBar.style.maxWidth = Math.max(180, stage.width - inset - 32) + 'px';
  paintNoteFind();
}
$('findInput').oninput = () => updateFind(true);
$('findCase').onclick = () => { $('findCase').setAttribute('aria-pressed', String($('findCase').getAttribute('aria-pressed') !== 'true')); updateFind(true); $('findInput').focus(); };
$('findPrev').onclick = () => moveFind(-1);
$('findNext').onclick = () => moveFind(1);
$('findClose').onclick = () => closeFind();
document.addEventListener('keydown', e => {
  if (e.isComposing || e.keyCode === 229) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault(); e.stopImmediatePropagation(); openFind();
  } else if (!findBar.hidden && e.key === 'Escape' && !$('modal').open && !$('commandMenu').open) {
    e.preventDefault(); e.stopImmediatePropagation(); closeFind();
  } else if (!findBar.hidden && e.target === $('findInput') && e.key === 'Enter') {
    e.preventDefault(); e.stopImmediatePropagation(); moveFind(e.shiftKey ? -1 : 1);
  }
}, true);
findBar.addEventListener('keydown', e => e.stopPropagation());
$('noteScroll').addEventListener('scroll', paintNoteFind);
new ResizeObserver(positionFind).observe($('stage'));
for (const id of ['inspector', 'notesPanel']) new MutationObserver(positionFind).observe($(id), {attributes:true, attributeFilter:['hidden']});
