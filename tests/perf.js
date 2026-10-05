// Timing suite for large documents. It asserts nothing about speed; it prints
// numbers so a change can be compared against the run before it.
const results = [];
window.uiTest = true;
for (const type of ["pointerdown", "pointermove", "pointerup", "mousemove", "click", "wheel"])
  window.addEventListener(type, (e) => { if (e.isTrusted) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
for (let i = 0; i < 100 && !loaded; i++) await wait(50);
await document.fonts.ready;
function time(label, runs, fn) {
  fn();
  const start = performance.now();
  for (let i = 0; i < runs; i++) fn();
  const ms = (performance.now() - start) / runs;
  results.push(`${label}: ${ms.toFixed(2)} ms`);
  return ms;
}
async function timeAsync(label, runs, fn) {
  await fn();
  const start = performance.now();
  for (let i = 0; i < runs; i++) await fn();
  const ms = (performance.now() - start) / runs;
  results.push(`${label}: ${ms.toFixed(1)} ms`);
}

// A photo-sized image in another document, as in a real library, so saving
// the open document shows what the rest of the store costs.
const photo = document.createElement("canvas");
photo.width = photo.height = 1400;
const pc = photo.getContext("2d"), noise = pc.createImageData(1400, 1400);
for (let i = 0; i < noise.data.length; i += 65536)
  crypto.getRandomValues(noise.data.subarray(i, i + 65536));
for (let i = 3; i < noise.data.length; i += 4) noise.data[i] = 255;
pc.putImageData(noise, 0, 0);
$("sidebarNewDocument").click();for(let i=0;i<200&&!$("nameInput");i++)await new Promise(r=>setTimeout(r,10)); $("nameInput").value = "Image library"; $("nameSubmit").click();
const image = M.node("image", 0, 0);
image.w = image.h = 400;
image.imageData = photo.toDataURL("image/png");
d().nodes.push(image);
results.push(`image store: ${(image.imageData.length / 1048576).toFixed(1)} MB`);

$("sidebarNewDocument").click();for(let i=0;i<200&&!$("nameInput");i++)await new Promise(r=>setTimeout(r,10)); $("nameInput").value = "Large diagram"; $("nameSubmit").click();
const words = "plan review launch budget hiring design research metrics roadmap risk".split(" ");
const label = (i) => `${words[i % 10]} ${words[(i * 7) % 10]} ${i}`;
// 16 mind maps of 100 nodes, four levels deep, and a 400-node flowchart.
for (let r = 0; r < 16; r++) {
  const root = M.node("mind", (r % 4) * 3000, Math.floor(r / 4) * 4000, "process", label(r));
  d().nodes.push(root);
  let level = [root];
  for (let depth = 0; depth < 3 && d().nodes.length; depth++) {
    const next = [];
    for (const parent of level)
      for (let k = 0; k < (depth === 0 ? 5 : depth === 1 ? 4 : 4); k++) {
        const n = M.node("mind", 0, 0, "process", label(d().nodes.length));
        Object.assign(n, { parent: parent.id, order: k, shape: "process", fill: "#ffffff" });
        d().nodes.push(n);
        M.connect(d(), parent.id, n.id, { tree: true, style: "curved", arrow: false });
        next.push(n);
      }
    level = next;
  }
  // Some collapsed branches, whose badges count hidden descendants.
  if (r % 4 === 0) M.children(d(), root.id)[0].collapsed = true;
}
for (let i = 0; i < 400; i++) {
  const n = M.node("flow", 13000 + (i % 20) * 260, (i / 20 | 0) * 180, i % 7 ? "process" : "decision", label(i));
  d().nodes.push(n);
  if (i % 20) {
    const e = M.connect(d(), d().nodes.at(-2).id, n.id, { style: i % 3 ? "curved" : "elbow" });
    if (i % 5 === 0) e.label = "yes";
  }
}
for (const n of d().nodes) if (n.kind === "flow") autoSize(n);
M.layout(d());
const nodes = d().nodes.length, edges = d().edges.length;
results.push(`document: ${nodes} nodes, ${edges} connectors`);

fit();
time("paint, whole diagram in view", 20, paint);
view = { x: 100, y: 100, z: 1 };
time("paint, 100% zoom (part in view)", 20, paint);
selected = new Set([d().nodes[5].id]);
time("paint, one node selected", 20, paint);
selected.clear();

const b = canvas.getBoundingClientRect();
let step = 0;
time("hover, pointer move with no drag", 200, () => {
  step++;
  canvas.dispatchEvent(new PointerEvent("pointermove", { clientX: b.left + 200 + (step % 300), clientY: b.top + 200 + (step % 97), pointerId: 1, bubbles: true }));
});

const target = d().nodes[3];
time("edit, one style change (mutate)", 10, () => {
  selected = new Set([target.id]);
  styleSelection("textColor", target.textColor === "#1b1b1f" ? "#333333" : "#1b1b1f");
});
time("save, JS snapshot of the store", 5, () => M.clone(state));
await timeAsync("save, whole store round trip", 5, () => persist());
await timeAsync("load, whole store round trip", 3, () => native("load"));
const sent = M.clone(state);
await storeImages(sent);
results.push(`store sent per save: ${(JSON.stringify(sent).length / 1048576).toFixed(2)} MB`);
return results;
