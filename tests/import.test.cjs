const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('../web/import-format.js');
const M=require('../web/model.js');
const base=()=>({format:'excalidravv-mindmap',version:1,title:'Ideas',root:{text:'Root'}});
test('import preserves Unicode, multiline notes, and sibling order',()=>{
  const input=base();input.root.children=[{text:'日本語 🌱',notes:['first\nsecond']},{text:'Cipete'}];
  const parsed=parse(JSON.stringify(input));
  assert.equal(parsed.root.children[0].notes[0],'first\nsecond');
  assert.equal(parsed.root.children[1].text,'Cipete');
  assert.equal(parsed.layout,'horizontal');
});
test('malformed, future-version and invalid tree imports fail explicitly',()=>{
  assert.throws(()=>parse('{'),/Invalid JSON/);
  assert.throws(()=>parse({...base(),version:2}),/version/);
  assert.throws(()=>parse({...base(),layout:'radial'}),/layout/);
  assert.throws(()=>parse({...base(),root:{text:'root',children:{}}}),/children/);
  assert.throws(()=>parse({...base(),root:{text:'root',notes:[{text:'x'}]}}),/notes/);
  assert.throws(()=>parse({...base(),root:{text:' '}}),/text/);
});
test('large and deep inputs rejected before document construction',()=>{
  const input=base();input.root.children=Array.from({length:2000},()=>({text:'Child'}));
  assert.throws(()=>parse(input),/2,000/);
  const deep=base();let n=deep.root;for(let i=0;i<64;i++){n.children=[{text:'Child'}];n=n.children[0];}
  assert.throws(()=>parse(deep),/64 levels/);
  assert.throws(()=>parse(' '.repeat(2000001)),/2 MB/);
});
test('placeholder follows layout, collapses with owner, copies and deletes safely',()=>{
  const d=M.blank(),root=M.node('mind',0,0);d.nodes.push(root);
  const a=M.extend(d,root.id,true),b=M.extend(d,a.id,false),label=M.placeholder(d,b.id);
  const c=M.extend(d,b.id,true),nested=M.placeholder(d,c.id);M.layout(d);
  assert.equal(label.x,b.x);assert.equal(label.y+label.h+4,b.y);
  assert.ok(a.y+a.h<=label.y);
  b.collapsed=true;assert.ok(!M.visible(d).nodes.includes(nested));
  const copy=M.selection(d,[b.id],true);const ids=M.paste(d,copy);M.layout(d);
  assert.ok(ids.length===4&&M.validate(d));
  M.remove(d,[b.id]);assert.ok(!d.nodes.includes(label)&&d.nodes.includes(c)&&d.nodes.includes(nested));
  assert.ok(M.validate(d));
});
test('invalid placeholder links cannot enter local documents',()=>{
  const d=M.blank(),a=M.node('flow',0,0);d.nodes.push(a);const label=M.placeholder(d,a.id);
  label.attachmentTo='missing';assert.equal(M.validate(d),false);
  label.attachmentTo=label.id;assert.equal(M.validate(d),false);
});
test('a placeholder never bends the connector into its owner',()=>{
  const d=M.blank(),root=M.node('mind',0,0);d.nodes.push(root);
  const only=M.extend(d,root.id,true);M.placeholder(d,only.id);
  const deeper=M.extend(d,only.id,true);M.extend(d,deeper.id,false);M.placeholder(d,deeper.id);M.layout(d);
  const centre=n=>n.y+n.h/2;
  assert.equal(centre(only),centre(root));
  const above=M.extend(d,root.id,false);M.layout(d);
  const label=d.nodes.find(n=>n.attachmentTo===only.id);
  assert.ok(Math.max(above.y,only.y)>=Math.min(above.y+above.h,only.y+only.h)&&(label.y>=above.y+above.h||label.y+label.h<=above.y),'siblings make room for a placeholder');
});
test('without placeholders the layout keeps its old symmetric places',()=>{
  const d=M.blank(),root=M.node('mind',0,0);d.nodes.push(root);
  const a=M.extend(d,root.id,true),b=M.extend(d,root.id,true);M.extend(d,a.id,true);M.extend(d,a.id,true);M.extend(d,a.id,true);M.layout(d);
  const centre=n=>n.y+n.h/2,kids=d.nodes.filter(n=>n.parent===a.id);
  assert.equal(centre(a),(centre(kids[0])+centre(kids[2]))/2);
  assert.ok(b.y>=Math.max(...kids.map(n=>n.y+n.h)));
});
test('a new placeholder dresses like its owner, keeps its yellow fill and fits its font',()=>{
  const d=M.blank(),owner=M.node('flow',0,0);d.nodes.push(owner);
  Object.assign(owner,{sloppiness:2,sw:3.5,stroke:'#c92a2a',strokeStyle:'dashed',fontFamily:'Google Sans',fontSize:44});
  const label=M.placeholder(d,owner.id);
  for(const key of ['sloppiness','sw','stroke','strokeStyle','fontFamily','fontSize'])assert.equal(label[key],owner[key]);
  assert.equal(label.fill,'#fff0a6');assert.ok(label.h>=Math.ceil(44*1.15));assert.ok(M.validate(d));
});
test('new mind-map nodes fit their width; fitWidth must be a boolean',()=>{
  const d=M.blank(),root=M.node('mind',0,0);d.nodes.push(root);const child=M.extend(d,root.id,true);
  assert.equal(root.fitWidth,true);assert.equal(child.fitWidth,true);assert.equal(M.node('flow',0,0).fitWidth,undefined);assert.equal(M.node('text',0,0).fitWidth,true);
  child.fitWidth='yes';assert.equal(M.validate(d),false);
});
