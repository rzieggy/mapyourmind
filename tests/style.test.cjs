const {test}=require("node:test");
const assert=require("node:assert/strict");
const M=require("../web/model.js");
test("style choices survive clone and editable copy",()=>{
 const d=M.blank(),n=M.node("flow",0,0);
 Object.assign(n,{fontFamily:"Comic Shanns",strokeStyle:"dotted",sloppiness:0});d.nodes.push(n);
 assert.ok(M.validate(d));
 const copy=M.selection(d,[n.id],true);
 assert.equal(copy.nodes[0].fontFamily,"Comic Shanns");
 assert.equal(copy.nodes[0].sloppiness,0);
});
test("unknown fonts and invalid stroke parameters are rejected",()=>{
 for(const [key,value] of [["fontFamily","missing"],["sloppiness",NaN],["sloppiness",3],["strokeStyle","other"]]){
  const d=M.blank(),n=M.node("flow",0,0);n[key]=value;d.nodes.push(n);assert.equal(M.validate(d),false);
 }
});
test("legacy diagrams need no style-field migration",()=>{
 const d=M.blank();d.nodes.push(M.node("flow",0,0));assert.ok(M.validate(d));
});
