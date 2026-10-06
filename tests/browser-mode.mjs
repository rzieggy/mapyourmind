// Browser mode suite: `node tests/browser-mode.mjs` after `zsh build.sh`.
// It launches the built app with `--ui-test --browser-test` (a temporary library,
// port 4871, no browser opened) and plays the browser tab over HTTP itself, then
// runs `--fail-entry-save` once. It never touches the real library: every launch
// passes --ui-test. Output follows the native suites: passing checks print as
// quoted lines, the first failure prints "UI FAIL: ..." and exits 1.
import { spawn } from "node:child_process";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = process.env.MYM_APP || join(root, "dist/mapyourmind.app/Contents/MacOS/mapyourmind");
const passed = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let child = null, storeDir = null;
function fail(message) {
  console.log("UI TESTS: (\n" + passed.map((p) => "    " + JSON.stringify(p) + ",").join("\n") + "\n)");
  console.log("UI FAIL: " + message);
  if (child && child.exitCode === null) child.kill("SIGKILL");
  if (storeDir) rmSync(storeDir, { recursive: true, force: true });
  process.exit(1);
}
function check(ok, name, detail = "") {
  if (!ok) fail(name + (detail ? " — " + detail : ""));
  passed.push(name);
}

// Starts the app and collects its stdout lines; `line(prefix)` waits for one.
function launch(args) {
  const proc = spawn(app, ["--ui-test", ...args], { stdio: ["ignore", "pipe", "pipe"] });
  const lines = [];
  let waiters = [];
  let buffer = "";
  proc.stdout.on("data", (chunk) => {
    buffer += chunk;
    let i;
    while ((i = buffer.indexOf("\n")) >= 0) {
      lines.push(buffer.slice(0, i));
      buffer = buffer.slice(i + 1);
      waiters = waiters.filter((w) => !w());
    }
  });
  proc.stderr.on("data", () => {});
  const exited = new Promise((resolve) => proc.on("exit", (code) => resolve(code)));
  // Waits for the next line starting with prefix that has not been taken yet.
  const taken = new Set();
  function line(prefix, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const look = () => {
        const index = lines.findIndex((l, n) => !taken.has(n) && l.startsWith(prefix));
        if (index < 0) return false;
        taken.add(index);
        resolve(lines[index].slice(prefix.length).trim());
        return true;
      };
      if (look()) return;
      waiters.push(look);
      setTimeout(() => reject(Error("timed out waiting for " + prefix)), timeout);
    });
  }
  return { proc, line, exited, lines };
}

// One HTTP request with full control over Host and Origin (fetch cannot set Host).
async function request(port, { method = "GET", path = "/", host, origin, token, body } = {}) {
  const http = await import("node:http");
  return new Promise((resolve, reject) => {
    const headers = { Host: host ?? `127.0.0.1:${port}` };
    if (origin !== null) headers.Origin = origin ?? `http://127.0.0.1:${port}`;
    if (token) headers["X-Mym-Token"] = token;
    let data = null;
    if (body !== undefined) {
      data = Buffer.from(JSON.stringify(body));
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = data.length;
    }
    const req = http.request({ host: "127.0.0.1", port, method, path, headers }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (text += c));
      res.on("end", () => resolve({ status: res.statusCode, text }));
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}
async function listening(port) {
  try { await request(port); return true; } catch { return false; }
}
async function waitFor(fn, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await fn()) return true; await sleep(100); }
  return false;
}

// A pretend browser tab: reads the token from the served page and posts as the bridge does.
async function openTab(port) {
  const page = await request(port);
  const token = /<meta name="mym-token" content="([^"]+)"/.exec(page.text)?.[1];
  const session = crypto.randomUUID();
  const post = async (message, extra = {}) => {
    const r = await request(port, { method: "POST", path: "/native", token: extra.token ?? token, body: { ...message, session } });
    return { status: r.status, body: r.status === 200 ? JSON.parse(r.text) : null };
  };
  return { page, token, session, post };
}
// Each document built later counts as edited later.
let clock = Date.now();
const doc = (id, title, text) => ({
  id, title, mode: "board", created: 1, updated: ++clock, view: { x: 0, y: 0, z: 1 },
  canvas: { nodes: [{ id: id + "-n", kind: "flow", shape: "process", text, x: 0, y: 0, w: 160, h: 60 }], edges: [] },
});
const storeTitles = () => JSON.parse(readFileSync(join(storeDir, "documents.json"), "utf8")).documents.map((d) => d.title);

if (!existsSync(app)) fail("App not built: run zsh build.sh first (" + app + ")");

// ---- Main run: enter, tabs, Back to app, enter again, Quit.
const run = launch(["--browser-test"]);
child = run.proc;
try {
  storeDir = await run.line("BROWSER TEST STORE:");
  check(storeDir.includes("flowchart-ui-"), "The browser test uses a temporary library, never the real one", storeDir);
  let url = await run.line("BROWSER TEST URL:");
  let port = Number(new URL(url).port);
  check(port >= 4871 && port <= 4879, "Entering browser mode starts the server on 127.0.0.1 from port 4871", url);

  const a = await openTab(port);
  check(a.page.status === 200 && !!a.token, "The served page carries a per-launch token");
  check(a.page.text.includes('<script src="browser-bridge.js"></script>') && a.page.text.includes("connect-src 'self'"),
    "The served page loads the bridge and may reach only its own server");

  // Refused requests.
  const bad = { action: "hello", session: "x" };
  check((await request(port, { method: "POST", path: "/native", token: "wrong", body: bad })).status === 403, "A request with a wrong token is refused");
  check((await request(port, { method: "POST", path: "/native", body: bad })).status === 403, "A request without a token is refused");
  check((await request(port, { method: "POST", path: "/native", token: a.token, host: "evil.example:" + port, body: bad })).status === 403, "A request with a foreign Host is refused");
  check((await request(port, { host: "evil.example" })).status === 403, "A page request with a foreign Host is refused");
  check((await request(port, { method: "POST", path: "/native", token: a.token, origin: "http://evil.example", body: bad })).status === 403, "A request from a foreign Origin is refused");
  check((await request(port, { method: "POST", path: "/native", token: a.token, origin: null, body: bad })).status === 403, "A request without an Origin is refused");
  check((await request(port, { path: "/../../main.swift" })).status === 404, "Files outside the web folder are not served");

  // Tab A edits; its save lands in the temporary store.
  check((await a.post({ action: "hello" })).body?.result?.app === true, "The first tab says hello and learns it can go back to the app");
  const loaded = (await a.post({ action: "load" })).body?.result;
  check(Array.isArray(loaded?.state?.documents), "The tab loads the library from the store");
  const saveA = await a.post({ action: "save", state: { schema: 3, documents: [doc("da", "Edited in tab A", "first")] } });
  check(saveA.body?.result === true && !saveA.body.error, "A tab edit is saved", JSON.stringify(saveA.body));
  check(storeTitles().includes("Edited in tab A"), "The tab's edit is in the store file");

  // Tab B opens later and wins; A's write is refused and A learns it lost.
  const b = await openTab(port);
  check(b.token === a.token, "A second tab on the same server gets the same token");
  await b.post({ action: "hello" });
  const lateA = await a.post({ action: "save", state: { schema: 3, documents: [doc("da", "Old tab overwrite", "stale")] } });
  check(lateA.body?.error === "inactive", "An older tab's write is refused once a newer tab opened", JSON.stringify(lateA.body));
  check(!storeTitles().includes("Old tab overwrite"), "The refused write leaves the store unchanged");
  check((await a.post({ action: "heartbeat" })).body?.result?.active === false, "The older tab's heartbeat says it is no longer active");
  check((await b.post({ action: "heartbeat" })).body?.result?.active === true, "The newest tab's heartbeat says it is active");
  const saveB = await b.post({ action: "save", state: { schema: 3, documents: [doc("da", "Edited in tab A", "first"), doc("db", "Edited in tab B", "from B")] } });
  check(saveB.body?.result === true, "The newest tab can save");
  const invalid = await b.post({ action: "save", state: { schema: 3, documents: [{ id: "x" }] } });
  check(!!invalid.body?.error && storeTitles().includes("Edited in tab B"), "An invalid save from the tab is refused and the store is kept");

  // Back to app from the tab: the server stops and the app reloads from the store.
  check((await b.post({ action: "backToApp" })).body?.result === true, "Back to app from the tab is accepted");
  const editor = JSON.parse(await run.line("BROWSER TEST EDITOR:"));
  check(editor.loaded && editor.titles.includes("Edited in tab B"), "Back to app reloads the editor from the store, with the tab's edits", JSON.stringify(editor));
  check(editor.current === "Edited in tab B" && editor.nodes.includes("from B"), "The app opens the document the tab edited last", JSON.stringify(editor));
  check(await waitFor(async () => !(await listening(port))), "The server stops after Back to app");

  // Enter again (File › Open in Browser): a new server with a new token.
  child.kill("SIGUSR2");
  url = await run.line("BROWSER TEST URL:");
  port = Number(new URL(url).port);
  const c = await openTab(port);
  check(!!c.token && c.token !== a.token, "Entering again starts a new server with a new token");
  check((await b.post({ action: "heartbeat" }, { token: a.token })).status === 403, "A tab from the earlier server is refused (it ends at once)");
  await c.post({ action: "hello" });
  check((await c.post({ action: "heartbeat" })).body?.result?.ending === null, "A live tab is not asked to finish");

  // Quit: the app asks the tab to finish; the tab saves its last change, says ended, the app exits.
  child.kill("SIGUSR1");
  const ending = await waitFor(async () => (await c.post({ action: "heartbeat" })).body?.result?.ending === "quit", 5000);
  check(ending, "Quit asks the live tab to finish through its heartbeat");
  const last = await c.post({ action: "save", state: { schema: 3, documents: [doc("da", "Edited in tab A", "first"), doc("db", "Edited in tab B", "from B"), doc("dc", "Last change before quit", "flushed")] } });
  check(last.body?.result === true, "The tab's last change is still accepted while the app is finishing");
  await c.post({ action: "ended" });
  const started = Date.now();
  const code = await Promise.race([run.exited, sleep(10000).then(() => "timeout")]);
  check(code === 0, "The app quits once the tab says it has ended", String(code));
  check(Date.now() - started < 3000, "Quit does not wait the full four seconds when the tab answers", Date.now() - started + "ms");
  check(storeTitles().includes("Last change before quit"), "Quit keeps the tab's last change in the store");
} catch (e) {
  fail(e.message);
}
rmSync(storeDir, { recursive: true, force: true });
storeDir = null;

// ---- Save fails on entry: the window stays an editable editor and no server starts.
const failing = launch(["--browser-test", "--fail-entry-save"]);
child = failing.proc;
try {
  const alert = await failing.line("BROWSER TEST ALERT:");
  check(alert.startsWith("Couldn't open in the browser") && alert.includes("Test: the save was made to fail."), "A failed save on entry shows the error", alert);
  const shown = JSON.parse(await failing.line("BROWSER TEST FAIL-ENTRY:"));
  check(shown.waiting, "The failed-entry test had a change waiting to save", JSON.stringify(shown));
  check(shown.page === "index.html" && !shown.modal && !shown.viewOnly, "After a failed save on entry the window stays on the editor", JSON.stringify(shown));
  check(shown.saveStatus === "Could not save — try again" && shown.toast.includes("made to fail"), "The editor says the change has not saved", JSON.stringify(shown));
  check(shown.edited, "The editor stays editable after a failed entry", JSON.stringify(shown));
  check((await failing.line("BROWSER TEST SERVER:")) === "none", "No server starts when the save on entry fails");
  check(!(await listening(4871)), "Nothing listens on the browser test port after a failed entry");
  check((await Promise.race([failing.exited, sleep(5000).then(() => "timeout")])) === 0, "The failed-entry test exits cleanly");
} catch (e) {
  fail(e.message);
}
console.log("UI TESTS: (\n" + passed.map((p) => "    " + JSON.stringify(p) + ",").join("\n") + "\n)");
