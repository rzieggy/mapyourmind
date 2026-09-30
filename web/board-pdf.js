"use strict";
let boardPDFExporting = false;
function exportBoardPDFDialog() {
  if (!current || isNotebook() || boardPDFExporting || $('modal').open || $('commandMenu').open) return;
  if (window.mapyourmindBrowser) { toast("Exporting as PDF only works in the mapyourmind app. Use Back to app, then export."); return; }
  if (editing) commitEdit();
  if (!d().nodes.length) { toast("The canvas is empty. Add an element first."); return; }
  showModal(`<h2>Export PDF</h2><p>Save your board as a PDF.</p><label>Scope<select id="pdfScope"><option value="all">Whole board</option><option value="selection" ${!selected.size ? "disabled" : ""}>Current selection</option></select></label><label>Background<select id="pdfBackground"><option value="white">White</option><option value="transparent">Transparent</option></select></label><div class="tip">High-resolution image (3×) on a page sized to your content. Text is embedded as an image.</div><div class="actions"><button data-close>Cancel</button><button id="pdfConfirm" class="primary">Export PDF…</button></div>`);
  $('pdfScope').value = selected.size ? 'selection' : 'all';
  $('pdfConfirm').onclick = () => {
    const scope = $('pdfScope').value, background = $('pdfBackground').value;
    closeModal(); exportBoardPDF(scope, background).catch(e => toast(e.message));
  };
}
async function exportBoardPDF(scope = 'all', background = 'white', test = false) {
  if (!current || isNotebook() || boardPDFExporting) return;
  if (editing) commitEdit();
  const source = M.clone(d()), part = exportElements(scope), filename = current.title;
  if (!part.nodes.length && !part.edges.length) { toast("Select the elements you want to export."); return; }
  const b = exportBounds(part, source, false), scale = 3, padding = 30;
  const width = Math.ceil((b.w + padding * 2) * scale), height = Math.ceil((b.h + padding * 2) * scale);
  if (width > 16000 || height > 16000 || width * height > 64_000_000) {
    showModal('<h2>PDF is too large</h2><p>Select a smaller part of the board. Your document is safe.</p><div class="actions"><button data-close class="primary">Got it</button></div>');
    return;
  }
  boardPDFExporting = true;
  showModal('<h2>Preparing PDF…</h2><p>Rendering your board at high resolution.</p><div class="actions"><button id="cancelPDF">Cancel</button></div>');
  let canceled = false, out;
  const cancel = e => { e.preventDefault(); canceled = true; closeModal(); };
  $('cancelPDF').onclick = cancel;
  $('modal').addEventListener('cancel', cancel);
  try {
    await new Promise(r => setTimeout(r, 50));
    if (canceled) return;
    await document.fonts.ready;
    await Promise.all(part.nodes.filter(n => n.kind === 'image').map(loadImageNode));
    if (canceled) return;
    out = document.createElement('canvas'); out.width = width; out.height = height;
    const c = out.getContext('2d');
    if (!c) throw Error("Not enough memory to create the PDF.");
    if (background === 'white') { c.fillStyle = '#fff'; c.fillRect(0, 0, width, height); }
    c.scale(scale, scale); c.translate(padding - b.x, padding - b.y);
    // Only the content renderer runs here: selection, Find and hover overlays never do.
    for (const item of paintOrder(part.nodes, part.edges))
      if (item.edge) drawEdge(c, item.edge, source);
      else drawNode(c, item.node, false);
    const data = out.toDataURL('image/png').split(',')[1];
    out.width = out.height = 1;
    $('modal').removeEventListener('cancel', cancel);
    closeModal();
    const result = await native('boardPDF', {data, filename, width:width / scale, height:height / scale, background, scope, test});
    if (result) toast("PDF exported.");
    return result;
  } finally {
    $('modal').removeEventListener('cancel', cancel);
    if (out) out.width = out.height = 1;
    boardPDFExporting = false;
    if ($('cancelPDF')) closeModal();
  }
}
