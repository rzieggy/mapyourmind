const assert = require("node:assert/strict");
const test = require("node:test");
const M = require("../web/model.js");
function tree() {
  const d = M.blank(),
    root = M.node("mind", 0, 0);
  d.nodes.push(root);
  const a = M.extend(d, root.id, true),
    b = M.extend(d, a.id, false),
    c = M.extend(d, a.id, true);
  return { d, root, a, b, c };
}
test("mixed mind maps reflow without touching independent flowchart", () => {
  const { d, root, a, b, c } = tree();
  const flow = M.node("flow", -400, -300),
    other = M.node("mind", -1000, 10);
  d.nodes.push(flow, other);
  const original = M.clone([flow, other]);
  a.h = 300;
  M.layout(d);
  assert.ok(!M.overlap(a, b));
  assert.deepEqual([flow, other], original);
  assert.equal(c.parent, a.id);
  assert.ok(M.validate(d));
});
test("delete parent preserves its descendant subtrees and undo restores exactly", () => {
  const { d, root, a, b, c } = tree(),
    before = M.clone(d),
    history = new M.History();
  M.remove(d, [a.id]);
  assert.equal(c.parent, null);
  assert.ok(d.nodes.includes(c));
  assert.ok(!d.edges.some((e) => e.from === a.id || e.to === a.id));
  history.commit(before, d);
  assert.deepEqual(history.undo(d), before);
  assert.ok(M.validate(d));
});
test("multi-delete removes connectors exactly once; redo restores deletion", () => {
  const { d, root, a, b, c } = tree(),
    h = new M.History(),
    before = M.clone(d);
  M.remove(d, [root.id, a.id]);
  h.commit(before, d);
  assert.equal(d.nodes.length, 2);
  assert.equal(d.edges.length, 0);
  const back = h.undo(d);
  assert.deepEqual(back, before);
  assert.deepEqual(h.redo(back), d);
});
test("reparent rejects self and descendant cycles and preserves full subtree", () => {
  const { d, root, a, b, c } = tree(),
    before = M.clone(d);
  assert.equal(M.reparent(d, root.id, c.id), false);
  assert.equal(M.reparent(d, a.id, a.id), false);
  assert.deepEqual(d, before);
  assert.ok(M.reparent(d, a.id, b.id));
  assert.equal(c.parent, a.id);
  assert.equal(a.parent, b.id);
  assert.ok(M.validate(d));
});
test("mind sibling order and reordering are stable", () => {
  const { d, root, a, b, c } = tree();
  const newSibling = M.extend(d, a.id, false);
  assert.deepEqual(
    M.children(d, root.id).map((n) => n.id),
    [a.id, newSibling.id, b.id],
  );
  M.reparent(d, b.id, root.id, -0.5);
  assert.deepEqual(
    M.children(d, root.id).map((n) => n.id),
    [b.id, a.id, newSibling.id],
  );
  assert.ok(M.validate(d));
});
test("copy one endpoint drops external edges; duplicate subtree preserves internal graph", () => {
  const { d, root, a, b, c } = tree();
  const one = M.selection(d, [a.id]);
  assert.equal(one.edges.length, 0);
  const partial = M.paste(d, one);
  assert.equal(d.nodes.find((n) => n.id === partial[0]).parent, null);
  const part = M.selection(d, [a.id], true),
    ids = M.paste(d, part),
    copied = d.nodes.filter((n) => ids.includes(n.id));
  assert.equal(copied.length, 2);
  assert.equal(copied.filter((n) => n.parent).length, 1);
  assert.ok(M.validate(d));
});
test("flow extension avoids occupied space, connector deletion keeps nodes", () => {
  const d = M.blank(),
    root = M.node("flow", 0, 0);
  d.nodes.push(root);
  for (let i = 0; i < 20; i++) M.extend(d, root.id, true);
  const created = d.nodes.slice(1);
  for (let i = 0; i < created.length; i++)
    for (let j = i + 1; j < created.length; j++)
      assert.ok(!M.overlap(created[i], created[j]));
  const count = d.nodes.length;
  M.remove(d, [d.edges[0].id]);
  assert.equal(d.nodes.length, count);
  assert.ok(M.validate(d));
});
test("500-node mixed document operations remain bounded", () => {
  const d = M.blank();
  for (let i = 0; i < 50; i++) {
    const root = M.node("mind", Math.floor(i / 10) * 2000, (i % 10) * 1500);
    d.nodes.push(root);
    for (let j = 0; j < 9; j++) M.extend(d, root.id, true);
  }
  const start = performance.now();
  M.layout(d);
  const str = JSON.stringify(d);
  assert.ok(M.validate(d));
  const ids = M.paste(d, M.selection(d, [d.nodes[0].id], true));
  assert.equal(ids.length, 10);
  assert.ok(str.length > 100000);
  assert.ok(performance.now() - start < 1500);
  console.log(
    "500 nodes: layout + serialize + validate + subtree duplicate",
    Math.round(performance.now() - start),
    "ms",
  );
});
test("invalid or cyclic imported graph is rejected", () => {
  const { d, root, a, b, c } = tree();
  root.parent = c.id;
  assert.equal(M.validate(d), false);
  root.parent = null;
  d.edges.push({ ...d.edges[0] });
  assert.equal(M.validate(d), false);
});
test("disconnecting a mind connector detaches the child as an independent root", () => {
  const { d, a, c } = tree(),
    edge = d.edges.find((e) => e.to === c.id);
  M.remove(d, [edge.id]);
  assert.equal(c.parent, null);
  assert.ok(d.nodes.includes(a));
  assert.ok(M.validate(d));
});
test("elbow router avoids both endpoint interiors when moved across each other", () => {
  const boxes = [
      { x: 0, y: 0, w: 180, h: 80 },
      { x: 230, y: 180, w: 180, h: 80 },
    ],
    p = { x: 212, y: 40 },
    q = { x: 198, y: 220 };
  const path = M.routeElbow(p, q, boxes);
  assert.deepEqual(path[0], p);
  assert.deepEqual(path.at(-1), q);
  for (let i = 1; i < path.length; i++)
    assert.ok(!M.segmentBlocked(path[i - 1], path[i], boxes));
});
test("branch drops reorder siblings and realign descendants", () => {
  const { d, root, a, b, c } = tree();
  const pos = new Map(d.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  a.x += 80;
  a.y = b.y + 200;
  M.retainMove(d, M.subtree(d, a.id), pos);
  assert.deepEqual(
    M.children(d, root.id).map((n) => n.id),
    [b.id, a.id],
  );
  assert.equal(a.x, b.x);
  assert.equal(c.x, a.x + a.w + 92);
  assert.equal(c.y + c.h / 2, a.y + a.h / 2);
  const expected = M.clone(d);
  M.layout(d);
  assert.deepEqual(d, expected);
});
test("multiple selected branches align without moving independent shapes", () => {
  const { d, a, b, c } = tree();
  const flow = M.node("flow", -500, -500);
  d.nodes.push(flow);
  const pos = new Map(d.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  a.x += 50;
  b.x += 50;
  c.x += 50;
  M.retainMove(d, new Set([a.id, b.id, c.id]), pos);
  assert.equal(a.x, b.x);
  assert.equal(c.x, a.x + a.w + 92);
  assert.equal(flow.x, -500);
});
test("vertical layout is legible and leaves flowchart elements in place", () => {
  const { d, root, a, b, c } = tree(),
    flow = M.node("flow", -500, -500);
  d.nodes.push(flow);
  const original = M.clone(flow);
  a.w = 380;
  M.setDirection(d, "vertical");
  assert.ok(a.y > root.y + root.h);
  assert.ok(c.y > a.y + a.h);
  assert.ok(!M.overlap(a, b));
  assert.deepEqual(flow, original);
  M.setDirection(d, "horizontal");
  assert.ok(a.x > root.x + root.w);
  assert.equal(d.direction, "horizontal");
});
test("manual many-to-one links do not change mind-map parentage", () => {
  const { d, a, b, c } = tree(),
    sink = M.node("mind", 1000, 500);
  d.nodes.push(sink);
  M.connect(d, a.id, sink.id);
  M.connect(d, b.id, sink.id);
  assert.equal(sink.parent, null);
  assert.equal(c.parent, a.id);
  assert.equal(d.edges.filter((e) => e.to === sink.id).length, 2);
  assert.ok(M.validate(d));
});
test("node notes support replies, copy, deletion and undo", () => {
  const { d, a } = tree(),
    h = new M.History(),
    before = M.clone(d),
    note = M.addNote(d, a.id, "Investigate this");
  M.addNote(d, a.id, "Updated evidence", note.id);
  h.commit(before, d);
  assert.equal(a.notes[0].replies[0].text, "Updated evidence");
  const ids = M.paste(d, M.selection(d, [a.id], true));
  assert.equal(
    d.nodes.find((n) => n.id === ids[0]).notes[0].text,
    "Investigate this",
  );
  const restored = h.undo(d);
  assert.equal(restored.nodes.find((n) => n.id === a.id).notes.length, 0);
  M.removeNote(d, a.id, note.id);
  assert.equal(a.notes.length, 0);
});
test("new nodes use small text with rounded tree links and straight manual links", () => {
  const { d, root, a } = tree();
  assert.equal(root.fontSize, 19);
  assert.equal(a.fontSize, 19);
  assert.ok(d.edges.every((e) => e.style === (e.tree ? "curved" : "straight")));
});

test("collapse hides descendants and cross-links without deleting content", () => {
  const { d, root, a, b, c } = tree();
  M.connect(d, c.id, b.id);
  a.collapsed = true;
  M.layout(d);
  const shown = M.visible(d);
  assert.ok(shown.nodes.includes(a));
  assert.ok(!shown.nodes.includes(c));
  assert.ok(shown.edges.every((e) => e.from !== c.id && e.to !== c.id));
  assert.equal(M.subtree(d, a.id).size, 2);
  const copied = M.selection(d, [a.id], true);
  assert.equal(copied.nodes.length, 2);
  const next = M.extend(d, a.id, true);
  assert.equal(a.collapsed, false);
  assert.ok(M.visible(d).nodes.includes(next));
  assert.ok(M.validate(d));
});
test("same depth columns align despite varying node sizes", () => {
  const { d, root, a, b, c } = tree();
  a.w = 300;
  const other = M.extend(d, b.id, true);
  M.layout(d);
  assert.equal(c.x, other.x);
  M.setDirection(d, "vertical");
  a.h = 150;
  M.layout(d);
  assert.equal(c.y, other.y);
});
test("pastel roots give text children and preserve validated formatting", () => {
  const { d, root, a } = tree();
  assert.equal(root.shape, "pill");
  assert.equal(root.fill, "#e6def7");
  assert.equal(a.fill, "transparent");
  assert.equal(a.stroke, "transparent");
  assert.equal(a.shape, "process");
  a.text = "Hello";
  a.marks = [{ start: 0, end: 2, bold: true, highlight: "#fff0a6" }];
  assert.ok(M.validate(d));
  a.marks[0].end = 10;
  assert.equal(M.validate(d), false);
});

test("program A scopes layout and validates viewport paste before mutation",()=>{
 const d=M.blank(),root=M.node("mind",0,0),child=M.extend((d.nodes.push(root),d),root.id,true);child.x+=35;child.y+=17;const before=M.clone(d);
 const shape=M.node("flow",2000,100);d.nodes.push(shape);M.layoutChanged(d,before);assert.deepEqual(d.nodes.slice(0,2),before.nodes);
 const intact=M.clone(d);assert.throws(()=>M.paste(d,{nodes:[{...shape,x:NaN}],edges:[]}));assert.deepEqual(d,intact);
 for(const z of [.25,.57,1,2]){const viewport={x:-9000,y:7000,w:900/z,h:500/z};const p=M.placeBounds(shape,viewport,z);assert.ok(M.overlap({...shape,x:shape.x+p.dx,y:shape.y+p.dy},viewport));}
});

 test("Explicit Arial fallback survives model validation and copy", () => {
  const doc=M.blank(), n=M.node("flow",0,0);n.fontFamily="Arial";doc.nodes.push(n);
  assert.ok(M.validate(doc)); const copy=M.blank();M.paste(copy,M.selection(doc,[n.id]));
  assert.equal(copy.nodes[0].fontFamily,"Arial");assert.ok(M.validate(copy));
});

test("keyboard extension inherits the complete visual matrix and excludes metadata", () => {
  for (const kind of ["flow", "mind"]) for (const child of [true,false]) {
    const d=M.blank(), n=M.node(kind,10,20,"decision","Donor");
    Object.assign(n,{shape:"decision",w:260,h:150,fill:"transparent",fillStyle:"cross-hatch",edges:"round",strokeStyle:"dashed",stroke:"#123456",sw:3,roughness:.4,sloppiness:2,opacity:.8,fontFamily:"Arial",fontSize:34,textColor:"#445566",textAlign:"right",collapsed:true,group:"original",notes:[{id:"note",text:"private",created:1,replies:[]}],marks:[{start:0,end:5,bold:true,underline:true,highlight:"#fff0a6"}]});
    d.nodes.push(n);const m=M.extend(d,n.id,child);
    const textStyle={shape:"process",fill:"transparent",stroke:"transparent",fillStyle:"solid",h:Math.ceil(n.fontSize*1.15+6),textAlign:"left"};
    for(const key of M.visualProperties) assert.deepEqual(m[key],kind==="mind"&&child&&key in textStyle?textStyle[key]:n[key],kind+" "+key);
    assert.deepEqual(m.typingStyle,{bold:true,underline:true,highlight:"#fff0a6"});
    assert.equal(m.text,"");assert.notEqual(m.id,n.id);assert.equal(m.group,null);assert.deepEqual(m.notes,[]);assert.ok(!m.collapsed);assert.equal(m.marks,undefined);
    assert.equal(m.parent,kind==="mind"&&child?n.id:null);assert.ok(M.validate(d));
    const h=new M.History(), before={...M.clone(d),nodes:[M.clone(n)],edges:[]};h.commit(before,d);assert.deepEqual(h.redo(h.undo(d)),d);
    const pasted=M.blank();M.paste(pasted,M.selection(d,[m.id],true));assert.deepEqual(M.visualStyle(pasted.nodes[0]),M.visualStyle(m));
  }
});
test("only uniform formatting becomes typing style", () => {
  const n=M.node("flow",0,0,"process","abcd");
  n.marks=[{start:0,end:2,bold:true,underline:true,highlight:"#fff0a6"},{start:2,end:4,underline:true,highlight:"#e6def7"}];
  assert.deepEqual(M.visualStyle(n).typingStyle,{underline:true});
  n.text="";n.marks=[];n.typingStyle={bold:true};assert.deepEqual(M.visualStyle(n).typingStyle,{bold:true});
});


test("Legacy donor appearance wins over new-element preferences",()=>{
 const doc=M.blank(),donor=M.node("mind",0,0);doc.nodes.push(donor);
 M.setDefaults({mindRoot:{fontFamily:"Google Sans",fillStyle:"cross-hatch",edges:"round",strokeStyle:"dashed",sloppiness:2}});
 // A root's child is a step (Zieggy's After Start / end rule): shape, fill, fill style and size come from that step.
 const step=["shape","fill","fillStyle","stroke","h","textAlign"];
 try {const created=M.extend(doc,donor.id,true);for(const key of M.visualProperties.filter(k=>!step.includes(k)))assert.deepEqual(created[key],donor[key],key);assert.ok(M.isText(created));assert.ok(M.validate(doc));}finally{M.setDefaults({});}
});

test("Arrange tree tidies only the chosen tree", () => {
  const d = M.blank(), a = M.node("mind", 0, 0, "process", "A"), b = M.node("mind", 0, 600, "process", "B");
  d.nodes.push(a, b);
  const a1 = M.extend(d, a.id, true), b1 = M.extend(d, b.id, true);
  Object.assign(a1, { offsetX: 40, offsetY: 30 });
  Object.assign(b1, { offsetX: 55, offsetY: 25 });
  M.tidy(d, [a.id]);
  assert.equal(a1.offsetX, 0);
  assert.equal(a1.offsetY, 0);
  assert.equal(b1.offsetX, 55, "the other tree keeps its manual offset");
  assert.equal(b1.offsetY, 25);
  M.tidy(d);
  assert.equal(b1.offsetX, 0, "without a scope every tree is tidied");
});

test("the fill palette keeps transparent first and every earlier colour", () => {
  assert.equal(M.colors[0], "transparent");
  for (const old of ["#ffffff", "#ffd43b", "#fff0a6", "#dbe4ff", "#d3f9d8", "#ffe3e3", "#e9ecef"]) assert.ok(M.colors.includes(old), old);
  for (const pastel of ["#ffe8cc", "#d0ebff", "#e5dbff"]) assert.ok(M.colors.includes(pastel), pastel);
});

test("mind-map text children keep visible tree connectors after reparenting",()=>{
 const doc=M.blank(),root=M.node("mind",0,0);doc.nodes.push(root);const a=M.extend(doc,root.id,true),b=M.extend(doc,root.id,true),c=M.extend(doc,a.id,true);
 assert.ok([a,b,c].every(M.isText));assert.equal(root.shape,"pill");assert.equal(root.fill,"#e6def7");
 assert.ok(M.reparent(doc,c.id,b.id));assert.equal(doc.edges.find(e=>e.to===c.id&&e.tree).stroke,"#1b1b1f");assert.ok(M.validate(doc));
});
