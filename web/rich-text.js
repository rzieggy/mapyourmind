"use strict";
const graphemeSegmenter = new Intl.Segmenter(undefined,{granularity:"grapheme"});
// UTF-16 offsets match DOM ranges and the existing plain-text document field.
function markAt(n, index) {
  const result = {};
  for (const m of n.marks || [])
    if (index >= m.start && index < m.end) Object.assign(result, m);
  delete result.start;
  delete result.end;
  return result;
}
function packMarks(chars) {
  const marks = [];
  chars.forEach((style, i) => {
    if (!Object.keys(style).length) return;
    const prev = marks.at(-1);
    if (
      prev &&
      prev.end === i &&
      JSON.stringify({ ...prev, start: 0, end: 0 }) ===
        JSON.stringify({ ...style, start: 0, end: 0 })
    )
      prev.end++;
    else marks.push({ ...style, start: i, end: i + 1 });
  });
  return marks;
}
function formatRange(n, start, end, property, value) {
  if (!n.text.length) {
    n.typingStyle ||= {};
    value = value === undefined ? !n.typingStyle[property] : value;
    if (value) n.typingStyle[property] = value; else delete n.typingStyle[property];
    return;
  }

  const chars = Array.from({ length: n.text.length }, (_, i) => markAt(n, i));
  if (value === undefined)
    value = !chars.slice(start, end).every((s) => s[property]);
  for (let i = start; i < end; i++) {
    if (value) chars[i][property] = value;
    else delete chars[i][property];
  }
  n.marks = packMarks(chars);
}
// Measuring is done a character at a time, so the result is kept per element
// until its text, marks, font or wrap width change. Every canvas measures a
// font the same way, so the canvas and PNG export can share it.
const lineCache = new Map();
document.fonts.addEventListener("loadingdone", () => lineCache.clear());
function richLines(c, n) {
  const key = [n.text, n.fontSize, elementFont(n), textWrapWidth(n), JSON.stringify(n.marks || [])].join("\u0000"),
    cached = lineCache.get(n.id);
  if (cached?.key === key) return cached.lines;
  const lines = measureLines(c, n);
  if (lineCache.size > 5000) lineCache.clear();
  lineCache.set(n.id, { key, lines });
  return lines;
}
function measureLines(c, n) {
  const max = textWrapWidth(n),
    lines = [];
  let line = [],
    width = 0,
    index = 0;
  const measure = (text, style) => {
    c.font = `${style.bold ? "bold " : ""}${n.fontSize}px ${elementFont(n)}`;
    c.fontKerning = "none";
    return c.measureText(text).width;
  };
  const push = () => {
    let paintedWidth = width;
    for (let i = line.length - 1; i >= 0 && /^\s+$/.test(line[i].ch); i--) paintedWidth -= line[i].w;
    lines.push({ chars: line, width: Math.max(0, paintedWidth) });
    line = [];
    width = 0;
  };
  for (const token of n.text.split(/(\n|[^\S\n]+|[^\s]+)/).filter(Boolean)) {
    if (token === "\n") {
      push();
      index++;
      continue;
    }
    let chars = [],
      tokenWidth = 0;
    for (const { segment: ch } of graphemeSegmenter.segment(token)) {
      const style = markAt(n, index),
        w = measure(ch, style);
      chars.push({ ch, style, w, index });
      tokenWidth += w;
      index += ch.length;
    }
    if (width + tokenWidth > max && line.length && token.trim()) push();
    for (const char of chars) {
      if (width + char.w > max && line.length && token.trim()) push();
      line.push(char);
      width += char.w;
    }
  }
  push();
  return lines;
}
// Use the same measurements for sizing, rendering and PNG export.
textLines = (c, n) =>
  richLines(c, n).map((l) => l.chars.map((a) => a.ch).join(""));
function drawRichText(c, n) {
  const lines = richLines(c, n),
    lineHeight = n.fontSize * 1.15,
    inset = n.kind === "label" ? labelPadX : n.shape === "decision" && !M.isText(n) ? n.w * 0.22 : (n.w - textWrapWidth(n)) / 2;
  let y = n.y + n.h / 2 - ((lines.length - 1) * lineHeight) / 2,
    lastFont = null;
  c.textAlign = "left";
  c.textBaseline = "middle";
  c.fontKerning = "none";
  for (const line of lines) {
    let x =
      n.textAlign === "left"
        ? n.x + inset
        : n.textAlign === "right"
          ? n.x + n.w - inset - line.width
          : n.x + (n.w - line.width) / 2;
    for (const { ch, style, w } of line.chars) {
      if (style.highlight) {
        c.fillStyle = style.highlight;
        c.fillRect(x, y - lineHeight * 0.49, w + 0.5, lineHeight);
      }
      const font = `${style.bold ? "bold " : ""}${n.fontSize}px ${elementFont(n)}`;
      // Assigning a font makes the canvas parse it, so skip unchanged ones.
      if (font !== lastFont) c.font = lastFont = font;
      c.fillStyle = n.textColor;
      c.fillText(ch, x, y);
      if (style.underline) {
        c.strokeStyle = n.textColor;
        c.lineWidth = Math.max(1, n.fontSize / 18);
        c.beginPath();
        c.moveTo(x, y + n.fontSize * 0.43);
        c.lineTo(x + w, y + n.fontSize * 0.43);
        c.stroke();
      }
      x += w;
    }
    y += lineHeight;
  }
}
const richEditor = document.getElementById("textEditor");
let composingText = false;
richEditor.addEventListener("compositionstart", () => composingText = true);
richEditor.addEventListener("compositionend", () => {
  composingText = false;
  if (editing) richEditor.dispatchEvent(new Event("input"));
});
function moveEditorCaret(direction, extend = false) {
  const selection = getSelection();
  const focusOffset = () => {
    if (!selection.focusNode || !richEditor.contains(selection.focusNode)) return -1;
    const range = document.createRange(); range.selectNodeContents(richEditor);
    range.setEnd(selection.focusNode, selection.focusOffset); return plainEditorText(range.cloneContents()).length;
  };
  const before = focusOffset();
  // A canonical soft break occupies no position in document text. Skip the
  // extra DOM caret stop while retaining native grapheme/glyph navigation.
  for (let i = 0; i < 3; i++) {
    selection.modify(extend ? "extend" : "move", direction, "character");
    if (focusOffset() !== before) break;
  }
}
function rewrapEditor(n) {
  if (composingText) return;
  const [start, end] = editorOffsets();
  richEditorLoad(n, false);
  setEditorSelection(start, end);
}
let richUndoStack = [],
  richRedoStack = [];
function editorSnapshot(n) {
  return JSON.stringify({ text: n.text, marks: n.marks || [], typingStyle: n.typingStyle || {} });
}
function editorText() {
  return plainEditorText(richEditor);
}
function plainEditorText(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.data.replace(/\u200B/g, "");
  if (node.nodeType === Node.ELEMENT_NODE && (node.dataset.caretEnd || node.dataset.softBreak)) return "";
  if (node.nodeName === "BR") return "\n";
  return [...node.childNodes].map(plainEditorText).join("");
}
function editorOffsets() {
  const selection = getSelection();
  if (
    !selection.rangeCount ||
    !richEditor.contains(selection.anchorNode) ||
    !richEditor.contains(selection.focusNode)
  )
    return [0, 0];
  const range = selection.getRangeAt(0),
    before = range.cloneRange();
  before.selectNodeContents(richEditor);
  before.setEnd(range.startContainer, range.startOffset);
  const start = plainEditorText(before.cloneContents()).length;
  return [start, start + plainEditorText(range.cloneContents()).length];
}
function setEditorSelection(start, end = start) {
  function boundary(offset) {
    let pos = 0, found = null;
    function visit(node) {
      if (found) return;
      if (node.nodeType === Node.TEXT_NODE) {
        if (offset <= pos + node.length) found = [node, Math.max(0, offset-pos)];
        pos += node.length;
      } else if (node.nodeName === "BR") {
        const index = [...node.parentNode.childNodes].indexOf(node);
        if (offset === pos) found = [node.parentNode, index];
        if (!node.dataset.caretEnd && !node.dataset.softBreak) pos++;
      } else for (const child of node.childNodes) visit(child);
    }
    visit(richEditor);
    return found || [richEditor, richEditor.childNodes.length];
  }
  const a = boundary(start), b = boundary(end);
  const range = document.createRange();
  if (a && b) {
    range.setStart(...a);
    range.setEnd(...b);
  } else {
    range.selectNodeContents(richEditor);
    range.collapse(false);
  }
  const selection = getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}
Object.defineProperties(richEditor, {
  value: {
    get: editorText,
    set(value) {
      richEditorLoad({text: value, marks: []}, false);
    },
  },
  selectionStart: {
    get() {
      return editorOffsets()[0];
    },
  },
  selectionEnd: {
    get() {
      return editorOffsets()[1];
    },
  },
});
richEditor.select = () => setEditorSelection(0, editorText().length);
richEditor.setSelectionRange = setEditorSelection;
richEditor.setRangeText = (value, start, end, mode) => {
  const n = elementByID(editing?.id);
  if (!n) return;
  readRichEditor(n);
  const styles = Array.from({ length: n.text.length }, (_, i) => markAt(n, i)),
    inherited = styles[Math.max(0, start - 1)] || n.typingStyle || {};
  styles.splice(
    start,
    end - start,
    ...Array.from({ length: value.length }, () => ({ ...inherited })),
  );
  n.text = n.text.slice(0, start) + value + n.text.slice(end);
  n.marks = packMarks(styles);
  richEditorLoad(n, false);
  setEditorSelection(start + value.length);
  richRecord(n);
};
function richEditorLoad(n, reset = true) {
  n={...elementByID(editing?.id),...n};
  richEditor.replaceChildren();
  const typing = n.text.length ? {} : n.typingStyle || {};
  richEditor.style.fontWeight = typing.bold ? "bold" : "normal";
  richEditor.style.textDecoration = typing.underline ? "underline" : "none";
  richEditor.style.backgroundColor = "transparent";
  // Browser fallback fonts (especially color emoji) do not scale their metrics
  // perfectly at fractional sizes. Canonical soft breaks keep screen and PNG
  // wrapping identical; the browser still owns every glyph and caret.
  const breaks = new Set(richLines(ctx, n).slice(1).map(l => l.chars[0]?.index)
    .filter(i => i !== undefined && n.text[i - 1] !== "\n"));
  let i = 0;
  while (i < n.text.length) {
    if (breaks.has(i)) {
      const br = document.createElement("br"); br.dataset.softBreak = "true"; richEditor.append(br);
    }
    const style = markAt(n, i),
      key = JSON.stringify(style);
    let end = i + 1;
    while (end < n.text.length && !breaks.has(end) && JSON.stringify(markAt(n, end)) === key) end++;
    const span = document.createElement("span");
    span.textContent = n.text.slice(i, end);
    if (style.bold) span.style.fontWeight = "bold";
    if (style.underline) span.style.textDecoration = "underline";
    if (style.highlight) span.style.backgroundColor = style.highlight;
    richEditor.append(span);
    i = end;
  }
  if(!n.text)richEditor.append(document.createTextNode("\u200B"));
  else if(n.text.endsWith("\n")){const end=document.createElement("br");end.dataset.caretEnd="true";richEditor.append(end);}
  if (reset) {
    richUndoStack = [editorSnapshot(n)];
    richRedoStack = [];
  }
}
function richRecord(n) {
  const value = editorSnapshot(n);
  if (richUndoStack.at(-1) !== value) {
    richUndoStack.push(value);
    richRedoStack = [];
  }
}
function readRichEditor(n) {
  let text = "",
    chars = [];
  function visit(node, style = {}) {
    if (node.nodeType === Node.TEXT_NODE) {
      const data = node.data.replace(/\u200B/g, "");
      text += data;
      chars.push(...Array.from({ length: data.length }, () => ({ ...style })));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.dataset.caretEnd || node.dataset.softBreak) return;
    style = { ...style };
    if (
      ["B", "STRONG"].includes(node.tagName) ||
      ["bold", "700"].includes(node.style.fontWeight)
    )
      style.bold = true;
    if (node.tagName === "U" || node.style.textDecoration.includes("underline"))
      style.underline = true;
    if (node.style.backgroundColor) {
      const rgb = node.style.backgroundColor.match(/\d+/g);
      if (rgb?.length >= 3)
        style.highlight =
          "#" +
          rgb
            .slice(0, 3)
            .map((v) => Number(v).toString(16).padStart(2, "0"))
            .join("");
    }
    if (node.tagName === "BR") {
      text += "\n";
      chars.push({ ...style });
      return;
    }
    for (const child of node.childNodes) visit(child, style);
  }
  for (const child of richEditor.childNodes) visit(child, n.text.length ? {} : n.typingStyle || {});
  n.text = text;
  n.marks = packMarks(chars);
  richRecord(n);
}
function richUndo(redo = false) {
  const n = elementByID(editing?.id);
  if (!n) return;
  if (redo) {
    if (!richRedoStack.length) return;
    richUndoStack.push(richRedoStack.pop());
  } else {
    if (richUndoStack.length < 2) return;
    richRedoStack.push(richUndoStack.pop());
  }
  Object.assign(n, JSON.parse(richUndoStack.at(-1)));
  richEditorLoad(n, false);
  setEditorSelection(n.text.length);
  reflow(n, editing.quick ? editing.initialHeight : 0);
  if(n.kind==="mind")M.layout(d(),new Set([M.treeRoot(d(),n).id]));else M.syncAttachments(d());
  positionEditor();
  render();
}
richEditor.addEventListener("paste", (e) => {
  e.preventDefault();
  textCommand("paste");
});
richEditor.addEventListener("drop", (e) => e.preventDefault());
