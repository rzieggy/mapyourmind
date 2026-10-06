(function (root) {
  "use strict";
  const uid = () =>
    globalThis.crypto?.randomUUID?.() ||
    "id-" + Math.random().toString(36).slice(2);
  // Base64 image data is by far the heaviest thing a document holds and strings
  // are immutable, so a snapshot shares them instead of copying them. Undefined
  // values are dropped, matching what a JSON round trip used to do.
  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (value && typeof value === "object") {
      const out = {};
      for (const key in value) {
        const item = value[key];
        if (item === undefined) continue;
        out[key] = key === "imageData" ? item : clone(item);
      }
      return out;
    }
    return value;
  }
  // Comparing two snapshots by serialising them costs as much as the images
  // they carry; walking them stops at the first difference instead.
  function same(a, b) {
    if (a === b) return true;
    if (Array.isArray(a) || Array.isArray(b))
      return (
        Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((item, i) => same(item, b[i]))
      );
    if (a && b && typeof a === "object" && typeof b === "object") {
      const ka = Object.keys(a).filter((k) => a[k] !== undefined),
        kb = Object.keys(b).filter((k) => b[k] !== undefined);
      return ka.length === kb.length && ka.every((k) => same(a[k], b[k]));
    }
    return false;
  }
  // Transparent, white, then a pastel rainbow (red, orange, yellow, green, blue,
  // indigo, violet), then the note yellow and a grey. Every colour the older
  // palette offered is still here, so existing fills keep a matching swatch.
  const colors = [
    "transparent",
    "#ffffff",
    "#ffe3e3",
    "#ffe8cc",
    "#fff0a6",
    "#d3f9d8",
    "#d0ebff",
    "#dbe4ff",
    "#e5dbff",
    "#ffd43b",
    "#e9ecef",
  ];
  // Shapes are born filled so a diagram reads against the grid; transparent is
  // the first swatch in the palette for anyone who wants it. Notes carry a
  // saturated yellow so they read as notes.
  const noteFill = "#ffd43b";
  const fillStyles = ["hachure", "cross-hatch", "solid"];
  // Rectangles choose their corners. Start / end stays a separate shape: it is a
  // full stadium, not the moderate radius this option gives.
  const edgeStyles = ["sharp", "round"];
  const nodeStyleKeys = [
    "shape",
    "fill",
    "fillStyle",
    "edges",
    "stroke",
    "sw",
    "strokeStyle",
    "sloppiness",
    "fontFamily",
    "fontSize",
    "textColor",
    "textAlign",
  ];
  // Settings for new elements live in preferences.json as one `global` layer:
  // font, sloppiness, stroke width and font size. They apply only to elements
  // made fresh; Tab and Enter still inherit from their source, which keeps a
  // chain consistent, and existing elements never change. Every value is
  // checked here and again natively (`sanitizePreferences` in main.swift), so a
  // damaged file can never put into a document something its validation would
  // refuse. Older files carried per-shape entries, `mindRoot`, `connector` and
  // `afterTerminator`; those are dropped on load and never fail it.
  const shapeNames = ["process", "decision", "pill", "note", "circle", "io"];
  const globalDefaultRules = {
    fontFamily: (v) => ["Excalifont", "Google Sans", "Comic Shanns"].includes(v),
    sloppiness: (v) => [0, 1, 2].includes(v),
    sw: (v) => [1, 1.8, 3].includes(v),
    fontSize: (v) => [14, 19, 25, 34, 44].includes(v),
  };
  function sanitizeDefaults(raw) {
    const out = {},
      global = raw && typeof raw === "object" ? raw.global : null;
    if (!global || typeof global !== "object" || Array.isArray(global)) return out;
    const kept = {};
    for (const [key, rule] of Object.entries(globalDefaultRules))
      if (global[key] !== undefined && rule(global[key])) kept[key] = global[key];
    if (Object.keys(kept).length) out.global = kept;
    return out;
  }
  let defaults = {};
  function setDefaults(raw) {
    defaults = sanitizeDefaults(raw);
    return defaults;
  }
  function getDefaults() {
    return clone(defaults);
  }
  // What the global layer gives a fresh shape, text or manual connector.
  // Connector labels take the font but not the size: a label sized like a
  // heading would swamp its line. Images and stickers take nothing.
  function globalStyle(kind) {
    const g = defaults.global || {},
      keys =
        kind === "connector"
          ? ["fontFamily", "sloppiness", "sw"]
          : ["flow", "mind", "text"].includes(kind)
            ? ["fontFamily", "sloppiness", "sw", "fontSize"]
            : [],
      style = {};
    for (const key of keys) if (g[key] !== undefined) style[key] = g[key];
    return style;
  }
  function blank() {
    return { nodes: [], edges: [], direction: "horizontal" };
  }
  function node(kind, x, y, shape = "process", text = "") {
    return {
      id: uid(),
      kind,
      shape: kind === "mind" && shape === "process" ? "pill" : shape,
      textAlign: kind === "text" ? "left" : "center",
      x,
      y,
      w: kind === "text" ? 230 : 180,
      h: kind === "text" ? 28 : shape === "circle" ? 180 : kind === "flow" && shape === "process" ? 34 : 76,
      text,
      fill:
        shape === "note"
          ? noteFill
          : kind === "mind"
            ? "#e6def7"
            : kind === "text"
              ? "transparent"
              : "#ffffff",
      stroke: kind === "image" || kind === "sticker" ? "transparent" : "#1b1b1f",
      sw: 1.8,
      sloppiness: 1,
      fontSize: 19,
      notes: [],
      textColor: "#1b1b1f",
      parent: null,
      order: 0,
      group: null,
      ...(kind === "mind" || kind === "text" ? { fitWidth: true } : null),
      ...globalStyle(kind),
    };
  }
  function children(d, id) {
    return d.nodes
      .filter((n) => n.parent === id)
      .sort((a, b) => a.order - b.order);
  }
  // Text children retain mind-map identity and use only existing schema-3 styles.
  function isText(n) {
    return n.kind === "text" || n.kind === "mind" && n.shape === "process" && n.fill === "transparent" && n.stroke === "transparent";
  }
  function attached(d, ids) {
    const result = new Set(ids);
    for (const n of d.nodes) if (n.attachmentTo && result.has(n.attachmentTo)) result.add(n.id);
    return result;
  }
  function syncAttachments(d) {
    const byId = new Map(d.nodes.map(n => [n.id, n]));
    for (const n of d.nodes) {
      if (!n.attachmentTo) continue;
      const owner = byId.get(n.attachmentTo);
      if (owner) { n.x = owner.x; n.y = owner.y - n.h - 4; n.w = owner.w; }
    }
  }
  function placeholder(d, id) {
    const owner = d.nodes.find(n => n.id === id);
    if (!owner || owner.attachmentTo) return null;
    const existing = d.nodes.find(n => n.attachmentTo === id);
    if (existing) return existing;
    const n = node("flow", owner.x, owner.y - 32, "process");
    // A new placeholder dresses like its owner, apart from its yellow fill;
    // its height fits one line of the owner's font size until text reflows it.
    for (const key of ["sloppiness", "sw", "stroke", "strokeStyle", "fontFamily", "fontSize"])
      if (owner[key] === undefined) delete n[key]; else n[key] = clone(owner[key]);
    const size = n.fontSize ?? 14;
    Object.assign(n, { attachmentTo: id, fontSize: size, h: Math.max(26, Math.ceil(size * 1.15 + 8)), w: owner.w, fill: "#fff0a6" });
    d.nodes.push(n);
    syncAttachments(d);
    return n;
  }
  function subtree(d, id) {
    const kids = new Map();
    for (const n of d.nodes) {
      if (!kids.has(n.parent)) kids.set(n.parent, []);
      kids.get(n.parent).push(n.id);
    }
    let out = new Set(),
      stack = [id];
    while (stack.length) {
      const k = stack.pop();
      if (out.has(k)) continue;
      out.add(k);
      stack.push(...(kids.get(k) || []));
    }
    return out;
  }
  // Looking nodes up by id happens for every connector on every frame. Node
  // arrays are only ever appended to or replaced, never spliced, so an index
  // stays valid while the array and its length are unchanged.
  const indexes = new WeakMap();
  function byId(d) {
    let index = indexes.get(d.nodes);
    if (!index || index.length !== d.nodes.length) {
      index = { length: d.nodes.length, map: new Map(d.nodes.map((n) => [n.id, n])) };
      indexes.set(d.nodes, index);
    }
    return index.map;
  }
  function visible(d) {
    const byId = new Map(d.nodes.map((n) => [n.id, n])),
      hidden = new Map();
    function isHidden(n) {
      if (hidden.has(n.id)) return hidden.get(n.id);
      if (n.attachmentTo) return isHidden(byId.get(n.attachmentTo));
      const p = byId.get(n.parent);
      const value = !!p && (!!p.collapsed || isHidden(p));
      hidden.set(n.id, value);
      return value;
    }
    const nodes = d.nodes.filter((n) => !isHidden(n));
    const ids = new Set(nodes.map((n) => n.id));
    return {
      ...d,
      nodes,
      edges: d.edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
    };
  }
  // Direction belongs to the source node of a tree, so one canvas can hold
  // trees running different ways. A document-wide `direction` is still read as
  // the fallback, which is what keeps older diagrams looking the same.
  function treeRoot(d, node) {
    let n = node,
      seen = new Set();
    while (n?.parent && !seen.has(n.id)) {
      seen.add(n.id);
      n = byId(d).get(n.parent);
    }
    return n || node;
  }
  function treeDirection(d, node) {
    const root = node && treeRoot(d, node);
    return root?.direction || d.direction || "horizontal";
  }
  // The tree connector's length: from a parent's edge to its children's edge.
  const mainGap = { horizontal: 92, vertical: 80 };
  function layout(d, rootIDs = null) {
    const childMap = new Map();
    const topSpace = new Map(d.nodes.filter(n => n.attachmentTo).map(n => [n.attachmentTo, n.h + 4]));
    for (const n of d.nodes) {
      if (!childMap.has(n.parent)) childMap.set(n.parent, []);
      childMap.get(n.parent).push(n);
    }
    for (const cs of childMap.values()) cs.sort((a, b) => a.order - b.order);
    // Each subtree reaches `up` before and `down` after its node's centre line
    // on the cross axis. A placeholder only adds to `up`, so it never moves its
    // owner: siblings make room for it, and children centre on their parent
    // without counting the first child's own placeholder, so a single chain
    // stays straight. Without placeholders this is the old symmetric layout.
    const up = new Map(), down = new Map(), bare = new Map(), offsets = new Map();
    let vertical = false,
      crossSize = "h";
    function measure(n) {
      const cs = n.collapsed ? [] : childMap.get(n.id) || [];
      for (const c of cs) measure(c);
      const half = n[crossSize] / 2,
        above = vertical ? 0 : topSpace.get(n.id) || 0;
      let reachUp = 0, reachDown = 0;
      if (cs.length) {
        const centres = [];
        let at = up.get(cs[0].id);
        cs.forEach((c, i) => {
          if (i) at += down.get(cs[i - 1].id) + 32 + up.get(c.id);
          centres.push(at);
        });
        const top = centres[0] - bare.get(cs[0].id),
          bottom = centres[centres.length - 1] + down.get(cs[cs.length - 1].id),
          // An only child sits on its parent's line whatever its subtree holds.
          shift = cs.length === 1 ? -centres[0] : -(top + bottom) / 2;
        offsets.set(n.id, centres.map((value) => value + shift));
        reachUp = -(centres[0] + shift - up.get(cs[0].id));
        reachDown = bottom + shift;
      }
      up.set(n.id, Math.max(half + above, reachUp));
      bare.set(n.id, Math.max(half, reachUp));
      down.set(n.id, Math.max(half, reachDown));
    }
    // No columns: each child starts a fixed gap after its own parent (below it
    // in a vertical tree), so every tree connector has the same length and a
    // short branch stays as compact as its text. In a vertical tree siblings
    // share one row, below room for the tallest of their placeholders.
    function place(n) {
      const cs = n.collapsed ? [] : childMap.get(n.id) || [];
      const centre = vertical ? n.x + n.w / 2 : n.y + n.h / 2,
        row = vertical ? n.y + n.h + mainGap.vertical + Math.max(0, ...cs.map((c) => topSpace.get(c.id) || 0)) : 0;
      cs.forEach((c, i) => {
        const at = centre + offsets.get(n.id)[i];
        if (vertical) {
          c.x = at - c.w / 2;
          c.y = row;
        } else {
          c.x = n.x + n.w + mainGap.horizontal;
          c.y = at - c.h / 2;
        }
        place(c);
      });
    }
    for (const n of d.nodes.filter((n) => n.kind === "mind" && !n.parent && (!rootIDs || rootIDs.has(n.id)))) {
      vertical = treeDirection(d, n) === "vertical";
      crossSize = vertical ? "w" : "h";
      measure(n);
      place(n);
    }
    syncAttachments(d);
    return d;
  }
  // A branch drop changes sibling order, then the tree reflows as a unit.
  function layoutChanged(d,before) {
    const old=new Map(before.nodes.map(n=>[n.id,n])),roots=new Set();let geometryChanged=false;
    for(const n of d.nodes) {
      const previous=old.get(n.id),changed=!previous||["x","y","w","h","parent","order","collapsed","direction"].some(k=>n[k]!==previous[k]);
      if(!changed)continue;geometryChanged=true;
      if(n.kind==="mind"){roots.add(treeRoot(d,n).id);if(previous)roots.add(treeRoot(before,previous).id);}
    }
    if(roots.size)layout(d,roots);else if(geometryChanged)syncAttachments(d);
  }
  function retainMove(d, ids, positions) {
    ids = new Set(ids);
    const parents = new Set(
      d.nodes
        .filter((n) => ids.has(n.id) && n.parent && !ids.has(n.parent))
        .map((n) => n.parent),
    );
    const axis = treeDirection(d, d.nodes.find((n) => parents.has(n.id))) === "vertical" ? "x" : "y";
    for (const parent of parents)
      children(d, parent)
        .sort((a, b) => a[axis] - b[axis] || a.order - b.order)
        .forEach((n, i) => (n.order = i));
    for (const n of d.nodes) {
      n.offsetX = 0;
      n.offsetY = 0;
    }
    return layout(d);
  }
  // With no source node named, every tree is set at once, which is how older
  // documents and the Arrange action still behave.
  function setDirection(d, direction, rootId) {
    if (!["horizontal", "vertical"].includes(direction)) return;
    const roots = d.nodes.filter(
      (n) => n.kind === "mind" && !n.parent && (!rootId || n.id === rootId),
    );
    if (!roots.length) return;
    for (const root of roots) {
      root.direction = direction;
      for (const id of subtree(d, root.id)) {
        const n = d.nodes.find((a) => a.id === id);
        if (n) {
          n.offsetX = 0;
          n.offsetY = 0;
        }
      }
    }
    if (!rootId) d.direction = direction;
    layout(d);
  }
  // With rootIDs, only those trees lose their manual offsets and are laid out.
  function tidy(d, rootIDs = null) {
    const scope = rootIDs ? new Set(rootIDs) : null;
    for (const n of d.nodes.filter((n) => n.kind === "mind")) {
      if (scope && !scope.has(treeRoot(d, n).id)) continue;
      n.offsetX = 0;
      n.offsetY = 0;
    }
    layout(d, scope);
  }
  function addNote(d, nodeId, text, parentId = null) {
    const n = d.nodes.find((n) => n.id === nodeId);
    if (!n || !text.trim()) return null;
    n.notes ||= [];
    const entry = { id: uid(), text: text.trim(), created: Date.now() };
    if (parentId) {
      const thread = n.notes.find((note) => note.id === parentId);
      if (!thread) return null;
      thread.replies ||= [];
      thread.replies.push(entry);
    } else n.notes.push({ ...entry, replies: [] });
    return entry;
  }
  function removeNote(d, nodeId, noteId, replyId = null) {
    const n = d.nodes.find((n) => n.id === nodeId);
    if (!n?.notes) return;
    if (replyId) {
      const note = n.notes.find((note) => note.id === noteId);
      if (note)
        note.replies = (note.replies || []).filter((r) => r.id !== replyId);
    } else n.notes = n.notes.filter((note) => note.id !== noteId);
  }
  function connect(d, a, b, opts = {}) {
    if (
      a === b ||
      !d.nodes.some((n) => n.id === a) ||
      !d.nodes.some((n) => n.id === b)
    )
      return null;
    const e = {
      id: uid(),
      from: a,
      to: b,
      style: "curved",
      arrow: true,
      stroke: "#1b1b1f",
      sw: 1.8,
      ...(opts.tree ? null : globalStyle("connector")),
      ...opts,
    };
    d.edges.push(e);
    return e;
  }
  const visualProperties = ["kind", "w", "h", ...nodeStyleKeys, "roughness", "opacity"];
  function visualStyle(n) {
    const style = Object.fromEntries(visualProperties.filter(k => n[k] !== undefined).map(k => [k, clone(n[k])]));
    const typing = {};
    for (const key of ["bold", "underline", "highlight"]) {
      if (!n.text.length) { if (n.typingStyle?.[key]) typing[key] = n.typingStyle[key]; continue; }
      let value, uniform = true;
      for (let i = 0; i < n.text.length; i++) {
        let current;
        for (const mark of n.marks || []) if (i >= mark.start && i < mark.end && mark[key] !== undefined) current = mark[key];
        if (i === 0) value = current;
        else if (current !== value) { uniform = false; break; }
      }
      if (uniform && value) typing[key] = value;
    }
    if (Object.keys(typing).length) style.typingStyle = typing;
    return style;
  }
  function extend(d, id, child) {
    const n = d.nodes.find((n) => n.id === id);
    if (!n || n.attachmentTo || ["text", "image", "sticker"].includes(n.kind)) return null;
    const m = node(
      n.kind,
      n.x + (child ? n.w + 92 : 0),
      n.y + (child ? 0 : n.h + 70),
      "process",
    );
    const parent = n.kind === "mind" ? (child ? n.id : n.parent) : null;
    // An absent optional field means the legacy renderer default, not the new-element preference.
    for (const key of visualProperties) if (n[key] === undefined) delete m[key];
    Object.assign(m, visualStyle(n));
    // Flow Start / end is always followed by a white rectangle's shape, fill and
    // size. Mind-map descendants use compact text below; other styles remain
    // inherited.
    const terminator = n.kind === "flow" && n.shape === "pill";
    if (terminator) {
      const step = node("flow", 0, 0, "process");
      Object.assign(m, { shape: step.shape, fill: step.fill, w: step.w, h: step.h });
      if (step.fillStyle) m.fillStyle = step.fillStyle; else delete m.fillStyle;
    }
    if (n.kind === "flow") {
      // Keep the new node on the source's centre line, so the connector
      // between them runs straight whatever their sizes.
      if (child) m.y = n.y + n.h / 2 - m.h / 2;
      else m.x = n.x + n.w / 2 - m.w / 2;
    }
    if (n.kind === "mind") {
      m.parent = parent;
      if (parent) {
        Object.assign(m, {shape: "process", fill: "transparent", stroke: "transparent", fillStyle: "solid", h: Math.ceil(m.fontSize * 1.15 + 6)});
        if (!n.parent) m.textAlign = "left";
      }
      if (child) n.collapsed = false;
      m.order = child ? children(d, n.id).length : n.order + 0.5;
      if (!m.parent) {
        m.x = n.x;
        m.y = n.y + Math.max(n.h, treeBounds(d, n.id).h) + 65;
      }
    } else {
      while (
        d.nodes.some((a) =>
          overlap(
            { ...m, x: m.x - 18, y: m.y - 18, w: m.w + 36, h: m.h + 36 },
            a,
          ),
        )
      ) {
        m.y += m.h + 35;
      }
    }
    d.nodes.push(m);
    if (n.kind === "mind") {
      if (m.parent)
        connect(d, m.parent, m.id, {
          tree: true,
          style: "curved",
          arrow: false,
        });
      normalizeOrder(d);
      layout(d, new Set([treeRoot(d, m).id]));
    } else
      connect(d, n.id, m.id, {
        fromSide: child ? "right" : "bottom",
        toSide: child ? "left" : "top",
      });
    return m;
  }
  // Pure graph operations keep relationships independent from visual grouping.
  function normalizeOrder(d) {
    for (const p of new Set(d.nodes.map((n) => n.parent)))
      children(d, p).forEach((n, i) => (n.order = i));
  }
  function bounds(ns) {
    if (!ns.length) return { x: 0, y: 0, w: 0, h: 0 };
    const x = Math.min(...ns.map((n) => n.x)),
      y = Math.min(...ns.map((n) => n.y));
    return {
      x,
      y,
      w: Math.max(...ns.map((n) => n.x + n.w)) - x,
      h: Math.max(...ns.map((n) => n.y + n.h)) - y,
    };
  }
  function centerOffset(ns, frame) {
    const b = bounds(ns);
    return {
      dx: frame.x + (frame.w - b.w) / 2 - b.x,
      dy: frame.y + (frame.h - b.h) / 2 - b.y,
    };
  }
  function treeBounds(d, id) {
    const ids = subtree(d, id);
    return bounds(d.nodes.filter((n) => ids.has(n.id)));
  }
  function overlap(a, b) {
    return (
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    );
  }
  function remove(d, ids) {
    ids = attached(d, ids);
    for (const e of d.edges.filter((e) => e.tree && ids.has(e.id))) {
      const n = d.nodes.find((n) => n.id === e.to);
      if (n) {
        n.parent = null;
        n.offsetX = 0;
        n.offsetY = 0;
      }
    }
    d.nodes = d.nodes.filter((n) => !ids.has(n.id));
    for (const n of d.nodes)
      if (ids.has(n.parent)) {
        n.parent = null;
        n.offsetX = 0;
        n.offsetY = 0;
      }
    d.edges = d.edges.filter(
      (e) => !ids.has(e.id) && !ids.has(e.from) && !ids.has(e.to),
    );
    normalizeOrder(d);
    layout(d);
  }
  function reparent(d, id, target, order) {
    const n = d.nodes.find((n) => n.id === id),
      p = d.nodes.find((n) => n.id === target);
    if (
      !n ||
      !p ||
      n.kind !== "mind" ||
      p.kind !== "mind" ||
      subtree(d, id).has(target)
    )
      return false;
    const previous = d.edges.find(e => e.tree && e.to === id);
    d.edges = d.edges.filter((e) => !(e.tree && e.to === id));
    n.parent = target;
    p.collapsed = false;
    n.offsetX = 0;
    n.offsetY = 0;
    n.order = order ?? children(d, target).length;
    connect(d, target, id, {
      tree: true,
      style: "curved",
      arrow: false,
      stroke: previous?.stroke || "#1b1b1f",
    });
    normalizeOrder(d);
    layout(d);
    return true;
  }
  function selection(d, ids, deep = false) {
    const set = new Set(ids);
    if (deep)
      for (const id of ids) {
        const n = d.nodes.find((n) => n.id === id);
        if (n?.kind === "mind") subtree(d, id).forEach((x) => set.add(x));
      }
    const all = attached(d, set);
    const nodes = clone(d.nodes.filter((n) => all.has(n.id)));
    for (const n of nodes) if (n.parent && !all.has(n.parent)) n.parent = null;
    for (const n of nodes) if (n.attachmentTo && !all.has(n.attachmentTo)) delete n.attachmentTo;
    return {
      nodes,
      edges: clone(d.edges.filter((e) => all.has(e.from) && all.has(e.to))),
    };
  }
  function paste(d, part, dx = 36, dy = 36) {
    if(!validate(part)||![dx,dy].every(Number.isFinite))throw Error("Invalid element bundle.");
    const map = new Map(),
      groups = new Map();
    for (const n of part.nodes) map.set(n.id, uid());
    const ns = part.nodes.map((a) => {
      let n = clone(a);
      n.id = map.get(a.id);
      n.parent = map.get(a.parent) || null;
      if (n.attachmentTo) {
        if (map.has(n.attachmentTo)) n.attachmentTo = map.get(n.attachmentTo);
        else delete n.attachmentTo;
      }
      if (!n.parent) {
        n.offsetX = 0;
        n.offsetY = 0;
      }
      n.x += dx;
      n.y += dy;
      if (n.group) {
        if (!groups.has(n.group)) groups.set(n.group, uid());
        n.group = groups.get(n.group);
      }
      return n;
    });
    d.nodes.push(...ns);
    d.edges.push(
      ...part.edges
        .filter((e) => map.has(e.from) && map.has(e.to))
        .map((e) => ({
          ...clone(e),
          id: uid(),
          from: map.get(e.from),
          to: map.get(e.to),
          group: groups.get(e.group) || null,
        })),
    );
    return ns.map((n) => n.id);
  }
  function placeBounds(bounds, viewport, zoom = 1, cascade = 0) {
    const margin = 24 / zoom;
    let offset = cascade * 24 / zoom;
    if (offset + Math.min(bounds.w, viewport.w - 2 * margin) / 2 > viewport.w / 2 - margin ||
        offset + Math.min(bounds.h, viewport.h - 2 * margin) / 2 > viewport.h / 2 - margin) offset = 0;
    return { dx: viewport.x + viewport.w / 2 - bounds.x - bounds.w / 2 + offset,
      dy: viewport.y + viewport.h / 2 - bounds.y - bounds.h / 2 + offset };
  }
  function layer(d, ids, action) {
    const chosen = attached(d, ids),
      nodes = [...d.nodes],
      before = nodes.map((n) => n.id),
      isChosen = (n) => chosen.has(n.id);
    if (!["front", "forward", "backward", "back"].includes(action))
      return false;
    if (action === "front")
      d.nodes = [
        ...nodes.filter((n) => !isChosen(n)),
        ...nodes.filter(isChosen),
      ];
    else if (action === "back")
      d.nodes = [
        ...nodes.filter(isChosen),
        ...nodes.filter((n) => !isChosen(n)),
      ];
    else if (action === "forward") {
      for (let i = nodes.length - 2; i >= 0; i--)
        if (isChosen(nodes[i]) && !isChosen(nodes[i + 1]))
          [nodes[i], nodes[i + 1]] = [nodes[i + 1], nodes[i]];
      d.nodes = nodes;
    } else {
      for (let i = 1; i < nodes.length; i++)
        if (isChosen(nodes[i]) && !isChosen(nodes[i - 1]))
          [nodes[i], nodes[i - 1]] = [nodes[i - 1], nodes[i]];
      d.nodes = nodes;
    }
    return d.nodes.some((n, i) => n.id !== before[i]);
  }
  function segmentBlocked(a, b, boxes) {
    return boxes.some((r) => {
      if (a.x === b.x)
        return (
          a.x > r.x + 0.1 &&
          a.x < r.x + r.w - 0.1 &&
          Math.max(a.y, b.y) > r.y + 0.1 &&
          Math.min(a.y, b.y) < r.y + r.h - 0.1
        );
      if (a.y === b.y)
        return (
          a.y > r.y + 0.1 &&
          a.y < r.y + r.h - 0.1 &&
          Math.max(a.x, b.x) > r.x + 0.1 &&
          Math.min(a.x, b.x) < r.x + r.w - 0.1
        );
      return false;
    });
  }
  function routeElbow(start, end, boxes) {
    const xs = [
        ...new Set([
          start.x,
          end.x,
          ...boxes.flatMap((r) => [r.x - 24, r.x + r.w + 24]),
        ]),
      ],
      ys = [
        ...new Set([
          start.y,
          end.y,
          ...boxes.flatMap((r) => [r.y - 24, r.y + r.h + 24]),
        ]),
      ],
      points = xs
        .flatMap((x) => ys.map((y) => ({ x, y })))
        .filter(
          (p) =>
            !boxes.some(
              (r) =>
                p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h,
            ),
        );
    const si = points.findIndex((p) => p.x === start.x && p.y === start.y),
      ei = points.findIndex((p) => p.x === end.x && p.y === end.y);
    if (si < 0 || ei < 0) return [start, end];
    const dist = points.map(() => Infinity),
      prev = new Map(),
      todo = new Set(points.map((_, i) => i));
    dist[si] = 0;
    while (todo.size) {
      let at = -1;
      for (const i of todo) if (at < 0 || dist[i] < dist[at]) at = i;
      if (!Number.isFinite(dist[at])) break;
      todo.delete(at);
      if (at === ei) break;
      for (const i of todo) {
        const a = points[at],
          b = points[i];
        if ((a.x !== b.x && a.y !== b.y) || segmentBlocked(a, b, boxes))
          continue;
        const cost = dist[at] + Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        if (cost < dist[i]) {
          dist[i] = cost;
          prev.set(i, at);
        }
      }
    }
    if (!Number.isFinite(dist[ei])) return [start, end];
    let path = [],
      cur = ei;
    while (cur !== undefined) {
      path.unshift(points[cur]);
      cur = prev.get(cur);
    }
    return path;
  }
  function validate(d) {
    if (!d || !Array.isArray(d.nodes) || !Array.isArray(d.edges)) return false;
    const ids = new Set();
    for (const element of [...d.nodes, ...d.edges]) {
      if (!element ||
          (element.fontFamily !== undefined && !["Excalifont","Google Sans","Comic Shanns","Arial"].includes(element.fontFamily)) ||
          (element.strokeStyle !== undefined && !["solid","dashed","dotted"].includes(element.strokeStyle)) ||
          (element.sloppiness !== undefined && ![0,1,2].includes(element.sloppiness))) return false;
    }
    for (const n of d.nodes) {
      if (
        !n ||
        typeof n.id !== "string" ||
        ids.has(n.id) ||
        !["flow", "mind", "text", "image", "sticker"].includes(n.kind) ||
        typeof n.text !== "string" ||
        ![n.x, n.y, n.w, n.h].every(Number.isFinite) ||
        n.w <= 0 ||
        n.h <= 0
      )
        return false;
      if (
        [n.offsetX, n.offsetY].some(
          (v) => v !== undefined && !Number.isFinite(v),
        )
      )
        return false;
      if (n.collapsed !== undefined && typeof n.collapsed !== "boolean")
        return false;
      if (n.fitWidth !== undefined && typeof n.fitWidth !== "boolean")
        return false;
      if (n.fillStyle !== undefined && !fillStyles.includes(n.fillStyle))
        return false;
      if (n.edges !== undefined && !edgeStyles.includes(n.edges)) return false;
      if (
        n.direction !== undefined &&
        !["horizontal", "vertical"].includes(n.direction)
      )
        return false;
      if (
        n.kind === "image" &&
        (typeof n.imageData !== "string" ||
          !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(n.imageData) ||
          n.imageData.length > 40000000)
      )
        return false;
      if (
        n.marks !== undefined &&
        (!Array.isArray(n.marks) ||
          n.marks.some(
            (m) =>
              !m ||
              !Number.isInteger(m.start) ||
              !Number.isInteger(m.end) ||
              m.start < 0 ||
              m.end > n.text.length ||
              m.start >= m.end ||
              (m.bold !== undefined && typeof m.bold !== "boolean") ||
              (m.underline !== undefined && typeof m.underline !== "boolean") ||
              (m.highlight !== undefined &&
                !/^#[0-9a-f]{6}$/i.test(m.highlight)),
          ))
      )
        return false;
      if (n.typingStyle !== undefined && (!n.typingStyle || typeof n.typingStyle !== "object" || Array.isArray(n.typingStyle) || Object.entries(n.typingStyle).some(([k,v]) => !["bold","underline","highlight"].includes(k) || (k === "highlight" ? !/^#[0-9a-f]{6}$/i.test(v) : typeof v !== "boolean")))) return false;
      if (n.notes !== undefined) {
        if (!Array.isArray(n.notes)) return false;
        const noteIDs = new Set();
        for (const note of n.notes) {
          if (
            !note ||
            typeof note.id !== "string" ||
            noteIDs.has(note.id) ||
            typeof note.text !== "string" ||
            !Number.isFinite(note.created) ||
            !Array.isArray(note.replies)
          )
            return false;
          noteIDs.add(note.id);
          const replyIDs = new Set();
          for (const reply of note.replies) {
            if (
              !reply ||
              typeof reply.id !== "string" ||
              replyIDs.has(reply.id) ||
              typeof reply.text !== "string" ||
              !Number.isFinite(reply.created)
            )
              return false;
            replyIDs.add(reply.id);
          }
        }
      }
      ids.add(n.id);
    }
    for (const n of d.nodes) {
      if (n.attachmentTo) {
        const owner = d.nodes.find(a => a.id === n.attachmentTo);
        if (!owner || owner === n || owner.attachmentTo || n.kind !== "flow" || n.parent) return false;
      }
      if (n.parent && !ids.has(n.parent)) return false;
      let cur = n,
        visited = new Set();
      while (cur?.parent) {
        if (visited.has(cur.id)) return false;
        visited.add(cur.id);
        cur = d.nodes.find((a) => a.id === cur.parent);
        if (cur?.kind !== "mind" || n.kind !== "mind") return false;
      }
    }
    const es = new Set();
    for (const e of d.edges) {
      if (es.has(e.id) || !ids.has(e.from) || !ids.has(e.to) || e.from === e.to)
        return false;
      // A connector label is stored on the connector, so it is validated here
      // with the same bounds the node text and marks use.
      if (e.label !== undefined) {
        if (typeof e.label !== "string" || e.label.length > 2000) return false;
        if (
          e.labelMarks !== undefined &&
          (!Array.isArray(e.labelMarks) ||
            e.labelMarks.some(
              (m) =>
                !m ||
                !Number.isInteger(m.start) ||
                !Number.isInteger(m.end) ||
                m.start < 0 ||
                m.end > e.label.length ||
                m.start >= m.end ||
                (m.bold !== undefined && typeof m.bold !== "boolean") ||
                (m.underline !== undefined &&
                  typeof m.underline !== "boolean") ||
                (m.highlight !== undefined &&
                  !/^#[0-9a-f]{6}$/i.test(m.highlight)),
            ))
        )
          return false;
      } else if (e.labelMarks !== undefined) return false;
      if (
        e.fontSize !== undefined &&
        (!Number.isFinite(e.fontSize) || e.fontSize <= 0 || e.fontSize > 200)
      )
        return false;
      if (e.textColor !== undefined && !/^#[0-9a-f]{6}$/i.test(e.textColor))
        return false;
      // A label slides along its connector; the position is a fraction of the
      // drawn path, so it survives rerouting and resizing.
      if (
        e.labelT !== undefined &&
        (!Number.isFinite(e.labelT) || e.labelT < 0 || e.labelT > 1)
      )
        return false;
      // A dragged bend is a point in document space.
      if (
        e.bend !== undefined &&
        (!e.bend || !Number.isFinite(e.bend.x) || !Number.isFinite(e.bend.y))
      )
        return false;
      es.add(e.id);
    }
    for (const n of d.nodes.filter((n) => n.parent)) {
      if (
        d.edges.filter((e) => e.tree && e.from === n.parent && e.to === n.id)
          .length !== 1
      )
        return false;
    }
    for (const e of d.edges.filter((e) => e.tree)) {
      if (d.nodes.find((n) => n.id === e.to).parent !== e.from) return false;
    }
    return true;
  }
  class History {
    constructor() {
      this.past = [];
      this.future = [];
    }
    commit(before, after) {
      if (same(before, after)) return;
      this.past.push(clone(before));
      if (this.past.length > 100) this.past.shift();
      this.future = [];
    }
    undo(d) {
      if (!this.past.length) return d;
      this.future.push(clone(d));
      return this.past.pop();
    }
    redo(d) {
      if (!this.future.length) return d;
      this.past.push(clone(d));
      return this.future.pop();
    }
  }
  const api = {
    placeBounds, layoutChanged, visualProperties, visualStyle,
    attached,
    syncAttachments,
    placeholder,
    visible,
    byId,
    shapeNames,
    setDefaults,
    getDefaults,
    retainMove,
    setDirection,
    tidy,
    treeRoot,
    treeDirection,
    addNote,
    removeNote,
    segmentBlocked,
    routeElbow,
    uid,
    clone,
    same,
    colors,
    noteFill,
    fillStyles,
    edgeStyles,
    blank,
    node,
    children,
    isText,
    subtree,
    layout,
    mainGap,
    connect,
    extend,
    normalizeOrder,
    bounds,
    centerOffset,
    treeBounds,
    overlap,
    remove,
    reparent,
    selection,
    paste,
    layer,
    validate,
    History,
  };
  if (typeof module !== "undefined") module.exports = api;
  root.FlowModel = api;
})(globalThis);
