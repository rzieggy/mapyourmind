import Cocoa
import WebKit
import Darwin
import PDFKit
import CryptoKit

// Google Sans ships inside this app (SIL OFL 1.1, see web/assets/GOOGLE-SANS-NOTICE.md).
func localFontFaces() -> [[String:String]] {
    guard let root=Bundle.main.resourceURL?.appendingPathComponent("web/assets",isDirectory:true) else { return [] }
    var faces=[[String:String]]()
    for style in ["normal","italic"] { for weight in [400,500,600,700] {
        if let data=try? Data(contentsOf:root.appendingPathComponent("GoogleSans-\(style)-\(weight).woff2")),data.count<2_000_000 {
            faces.append(["style":style,"weight":String(weight),"data":"data:font/woff2;base64,"+data.base64EncodedString()])
        }
    }}
    return faces
}

func monotonicClock() -> [String: Any] {
    var size = 0
    sysctlbyname("kern.bootsessionuuid", nil, &size, nil, 0)
    var buffer = [CChar](repeating: 0, count: max(1, size))
    sysctlbyname("kern.bootsessionuuid", &buffer, &size, nil, 0)
    return ["boot": String(cString: buffer), "uptime": ProcessInfo.processInfo.systemUptime * 1000, "wall": Date().timeIntervalSince1970 * 1000]
}
struct StoreFailure: Error { let message: String }
final class LocalStore {
    let directory: URL
    let primary: URL
    let recovery: URL
    init(directory: URL? = nil) throws {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        self.directory = directory ?? support.appendingPathComponent("mapyourmind", isDirectory: true)
        primary = self.directory.appendingPathComponent("documents.json")
        recovery = self.directory.appendingPathComponent("recovery.json")
        // mapyourmind is a separate app from Excalidravv. On first launch it takes a one-time copy of the
        // Excalidravv library; the Excalidravv folder is only read, so Excalidravv stays a working fallback.
        let legacy = support.appendingPathComponent("Local Flowchart", isDirectory: true)
        if directory == nil, !FileManager.default.fileExists(atPath: self.directory.path), FileManager.default.fileExists(atPath: legacy.appendingPathComponent("documents.json").path) {
            try FileManager.default.copyItem(at: legacy, to: self.directory)
        }
        try FileManager.default.createDirectory(at: self.directory, withIntermediateDirectories: true)
    }
    // The app and browser mode (`--serve`) both hold this for their lifetime, so two
    // writers never share one library. The kernel drops it if the process dies.
    var lockDescriptor: Int32 = -1
    func lock() -> Bool {
        lockDescriptor = open(directory.appendingPathComponent(".lock").path, O_RDWR | O_CREAT, 0o600)
        return lockDescriptor >= 0 && flock(lockDescriptor, LOCK_EX | LOCK_NB) == 0
    }
    func valid(_ data: Data) -> Bool {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any], [1, 2, 3].contains(object["schema"] as? Int ?? 0), let docs = object["documents"] as? [[String: Any]] else { return false }
        var documentIDs = Set<String>()
        for doc in docs {
            guard let id = doc["id"] as? String, documentIDs.insert(id).inserted, doc["title"] is String, let canvas = doc["canvas"] as? [String: Any], let nodes = canvas["nodes"] as? [[String: Any]], let edges = canvas["edges"] as? [[String: Any]] else { return false }
            if doc["mode"] as? String == "notes" {
                guard let note = doc["note"] as? [String: Any], let html = note["html"] as? String, html.utf16.count <= 2_000_000,
                      let font = note["fontFamily"] as? String, ["Excalifont", "Google Sans", "Comic Shanns", "Arial"].contains(font),
                      let size = note["fontSize"] as? Int, [14,19,25,34,44].contains(size),
                      let color = note["textColor"] as? String, color.range(of: "^#[0-9a-fA-F]{6}$", options: .regularExpression) != nil,
                      nodes.isEmpty, edges.isEmpty else { return false }
            }
            for element in nodes + edges {
                if let font = element["fontFamily"] { guard let font = font as? String, ["Excalifont", "Google Sans", "Comic Shanns", "Arial"].contains(font) else { return false } }
                if let style = element["strokeStyle"] { guard let style = style as? String, ["solid","dashed","dotted"].contains(style) else { return false } }
                if let level = element["sloppiness"] { guard let level = level as? Int, [0,1,2].contains(level) else { return false } }
            }
            let ids = Set(nodes.compactMap { $0["id"] as? String })
            guard ids.count == nodes.count else { return false }
            var parents = [String: String]()
            for node in nodes {
                guard let nid = node["id"] as? String, node["text"] is String, let kind = node["kind"] as? String, ["flow", "mind", "text", "image", "sticker"].contains(kind) else { return false }
                if let attachment = node["attachmentTo"] {
                    guard let ownerID = attachment as? String, ownerID != nid, kind == "flow", let owner = nodes.first(where: { $0["id"] as? String == ownerID }), owner["attachmentTo"] == nil, !(node["parent"] is String) else { return false }
                }
                for field in ["x", "y", "w", "h"] { guard let value = node[field] as? Double, value.isFinite, (!["w", "h"].contains(field) || value > 0) else { return false } }
                for field in ["offsetX", "offsetY"] { if let value = node[field] { guard let number = value as? Double, number.isFinite else { return false } } }
                if let value = node["collapsed"], !(value is Bool) { return false }
                if let value = node["fitWidth"], !(value is Bool) { return false }
                if kind == "image" {
                    if let reference=node["imageRef"] as? String {
                        guard object["schema"] as? Int == 3, reference.range(of:"^[0-9a-f]{64}$",options:.regularExpression) != nil else { return false }
                    } else {
                    guard let image = node["imageData"] as? String, image.hasPrefix("data:image/png;base64,"), image.utf8.count <= 40_000_000, Data(base64Encoded: String(image.dropFirst("data:image/png;base64,".count))) != nil else { return false }
                    }
                }
                if let value = node["marks"] {
                    guard let marks = value as? [[String: Any]], let text = node["text"] as? String else { return false }
                    for mark in marks {
                        guard let start = mark["start"] as? Int, let end = mark["end"] as? Int, start >= 0, end > start, end <= text.utf16.count else { return false }
                        for key in ["bold", "underline"] { if let flag = mark[key], !(flag is Bool) { return false } }
                        if let color = mark["highlight"] { guard let color = color as? String, color.range(of: "^#[0-9a-fA-F]{6}$", options: .regularExpression) != nil else { return false } }
                    }
                }
                if let value = node["typingStyle"] { guard let style = value as? [String: Any] else { return false }; for (key, value) in style { guard ["bold", "underline", "highlight"].contains(key) else { return false }; if key == "highlight" { guard let color = value as? String, color.range(of: "^#[0-9a-fA-F]{6}$", options: .regularExpression) != nil else { return false } } else if !(value is Bool) { return false } } }
                if let value = node["notes"] {
                    guard let notes = value as? [[String: Any]] else { return false }
                    var noteIDs = Set<String>()
                    for note in notes {
                        guard let noteID = note["id"] as? String, noteIDs.insert(noteID).inserted, note["text"] is String, note["created"] is Double, let replies = note["replies"] as? [[String: Any]] else { return false }
                        var replyIDs = Set<String>()
                        for reply in replies { guard let replyID = reply["id"] as? String, replyIDs.insert(replyID).inserted, reply["text"] is String, reply["created"] is Double else { return false } }
                    }
                }
                if let parent = node["parent"] as? String { guard ids.contains(parent), parent != nid, kind == "mind" else { return false }; parents[nid] = parent }
            }
            for nid in ids { var seen = Set<String>(); var current: String? = nid; while let value = current { guard seen.insert(value).inserted else { return false }; current = parents[value] } }
            var edgeIDs = Set<String>()
            var treeParents = [String: String]()
            for edge in edges { guard let eid = edge["id"] as? String, edgeIDs.insert(eid).inserted, let a = edge["from"] as? String, let b = edge["to"] as? String, a != b, ids.contains(a), ids.contains(b) else { return false }
                if edge["tree"] as? Bool == true { guard treeParents[b] == nil, parents[b] == a else { return false }; treeParents[b] = a }
            }
            guard treeParents == parents else { return false }
        }
        return true
    }
    func imageURL(_ reference: String) throws -> URL {
        guard reference.range(of: "^[0-9a-f]{64}$", options: .regularExpression) != nil else { throw StoreFailure(message: "Invalid image reference. Original data has been preserved.") }
        return directory.appendingPathComponent("images", isDirectory: true).appendingPathComponent(reference + ".png")
    }
    func imageBytes(_ reference: String) throws -> Data {
        let url = try imageURL(reference)
        guard let data = try? Data(contentsOf: url), data.count <= 30_000_000,
              data.starts(with: [137,80,78,71,13,10,26,10]),
              SHA256.hash(data: data).map({ String(format: "%02x", $0) }).joined() == reference else {
            throw StoreFailure(message: "An image file is missing or damaged. Original documents and image files have been preserved.")
        }
        return data
    }
    func putImage(_ encoded: String) throws -> String {
        let prefix = "data:image/png;base64,"
        guard encoded.hasPrefix(prefix), let data = Data(base64Encoded: String(encoded.dropFirst(prefix.count))),
              data.count <= 30_000_000, data.starts(with: [137,80,78,71,13,10,26,10]),
              let bitmap=NSBitmapImageRep(data:data),bitmap.pixelsWide>0,bitmap.pixelsHigh>0,
              bitmap.pixelsWide <= 32_000_000 / bitmap.pixelsHigh else { throw StoreFailure(message: "Invalid PNG image or image exceeds supported dimensions.") }
        let reference=SHA256.hash(data:data).map { String(format:"%02x",$0) }.joined(),url=try imageURL(reference)
        try FileManager.default.createDirectory(at:url.deletingLastPathComponent(),withIntermediateDirectories:true)
        if !FileManager.default.fileExists(atPath:url.path) { try data.write(to:url,options:.atomic) }
        return reference
    }
    func expanded(_ data: Data) throws -> [String:Any] {
        var object=try JSONSerialization.jsonObject(with:data) as! [String:Any]
        var documents=object["documents"] as! [[String:Any]],images=[String:String]()
        for i in documents.indices {
            var canvas=documents[i]["canvas"] as! [String:Any],nodes=canvas["nodes"] as! [[String:Any]]
            for j in nodes.indices {
                if let reference=nodes[j]["imageRef"] as? String {
                    if images[reference]==nil { images[reference]="data:image/png;base64," + (try imageBytes(reference)).base64EncodedString() }
                    nodes[j]["imageData"]=images[reference]
                }
            }
            canvas["nodes"]=nodes;documents[i]["canvas"]=canvas
        }
        object["documents"]=documents;return object
    }
    func validateImages(_ data:Data) throws {
        let object=try JSONSerialization.jsonObject(with:data) as! [String:Any]
        var checked=Set<String>()
        for doc in object["documents"] as! [[String:Any]] {
            for node in (doc["canvas"] as! [String:Any])["nodes"] as! [[String:Any]] {
                if let reference=node["imageRef"] as? String,checked.insert(reference).inserted { _ = try imageBytes(reference) }
            }
        }
    }
    func loadPreferences() -> [String:Any] {
        guard let data=try? Data(contentsOf:directory.appendingPathComponent("preferences.json")),data.count<=100_000,
              let object=try? JSONSerialization.jsonObject(with:data) as? [String:Any] else { return [:] }
        return object
    }
    func savePreferences(_ preferences:[String:Any]) throws {
        let data=try JSONSerialization.data(withJSONObject:preferences,options:.sortedKeys)
        guard data.count<=100_000 else { throw StoreFailure(message:"Preferences exceed the supported size.") }
        try data.write(to:directory.appendingPathComponent("preferences.json"),options:.atomic)
    }

    func load() throws -> [String: Any] {
        if let data = try? Data(contentsOf: primary) {
            if let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let schema = object["schema"] as? Int, schema > 3 { throw StoreFailure(message: "This document was created by a newer app version. Your data is safe; use the matching version.") }
            if valid(data) { return ["state": try expanded(data), "recovered": false] }
        }
        if let data = try? Data(contentsOf: recovery), valid(data) {
            let state = try expanded(data)
            try data.write(to: primary, options: .atomic)
            return ["state": state, "recovered": true]
        }
        if FileManager.default.fileExists(atPath: primary.path) || FileManager.default.fileExists(atPath: recovery.path) { throw StoreFailure(message: "Storage could not be read. Original files have been preserved for recovery.") }
        return ["state": ["schema": 1, "documents": []], "recovered": false]
    }
    func save(_ state: Any) throws {
        let data = try JSONSerialization.data(withJSONObject: state, options: [.sortedKeys])
        guard valid(data) else { throw StoreFailure(message: "Changes were not saved because the data is invalid.") }
        try validateImages(data)
        if let previous = try? Data(contentsOf: primary), valid(previous) { try previous.write(to: recovery, options: .atomic) }
        try data.write(to: primary, options: .atomic)
        if !FileManager.default.fileExists(atPath: recovery.path) { try data.write(to: recovery, options: .atomic) }
    }
}

// An isolated, bounded WebKit render avoids printer-driver pagination and keeps
// the editor interactive. Repack vector PDF slices at measured safe line breaks.
final class NotePDFRenderer: NSObject, WKNavigationDelegate {
    let web: WKWebView
    let html: String
    let completion: (Result<Data, Error>) -> Void
    var finished = false
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("excalidravv-pdf-" + UUID().uuidString)
    init(html: String, completion: @escaping (Result<Data, Error>) -> Void) {
        self.html = html; self.completion = completion
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        web = WKWebView(frame: NSRect(x: 0, y: 0, width: 595.28, height: 841.89), configuration: config)
        super.init(); web.navigationDelegate = self
    }
    func start() {
        do {
            let source = Bundle.main.resourceURL!.appendingPathComponent("web/")
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try FileManager.default.copyItem(at: source.appendingPathComponent("style.css"), to: directory.appendingPathComponent("style.css"))
            try FileManager.default.copyItem(at: source.appendingPathComponent("assets"), to: directory.appendingPathComponent("assets"))
            let url = directory.appendingPathComponent("index.html")
            let fontCSS=localFontFaces().map { face in "@font-face{font-family:'Google Sans';font-style:"+face["style"]!+";font-weight:"+face["weight"]!+";src:url("+face["data"]!+") format('woff2');}" }.joined()
            let renderedHTML=html.replacingOccurrences(of:"</head>",with:"<style>"+fontCSS+"</style></head>")
            try renderedHTML.write(to: url, atomically: true, encoding: .utf8)
            web.loadFileURL(url, allowingReadAccessTo: directory)
        } catch { finish(.failure(error)); return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 45) { [weak self] in self?.fail("PDF rendering timed out. Try a shorter note.") }
    }
    func finish(_ result: Result<Data, Error>) { guard !finished else { return }; finished = true; web.stopLoading(); try? FileManager.default.removeItem(at: directory); completion(result) }
    func fail(_ message: String) { finish(.failure(NSError(domain: "mapyourmind PDF", code: 1, userInfo: [NSLocalizedDescriptionKey: message]))) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { finish(.failure(error)) }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let script = """
        await document.fonts.ready;
        if(document.fonts.size<2)throw Error('PDF fonts did not load.');
        const article=document.getElementById('notePage');
        const height=Math.ceil(article.getBoundingClientRect().bottom)+2;
        if(height>200000)throw Error('Note is too long for PDF export. Split it into smaller notes.');
        const boxes=[];
        const walker=document.createTreeWalker(article,NodeFilter.SHOW_TEXT);
        while(walker.nextNode()){
          const range=document.createRange();range.selectNodeContents(walker.currentNode);
          for(const r of range.getClientRects())if(r.height>0)boxes.push([r.top,r.bottom]);
        }
        for(const block of article.querySelectorAll('#noteBody p,#noteBody li')){
          const rect=block.getBoundingClientRect();
          if(rect.height<700)boxes.push([rect.top,rect.bottom]);
          else {
            const lines=boxes.filter(b=>b[0]>=rect.top&&b[1]<=rect.bottom).sort((a,b)=>a[0]-b[0]);
            if(lines.length>=6){boxes.push([lines[0][0],lines[2][1]]);boxes.push([lines[lines.length-3][0],lines[lines.length-1][1]]);}
          }
        }
        for(const heading of article.querySelectorAll('h1,h2,h3')){
          const r=heading.getBoundingClientRect();
          const next=boxes.find(b=>b[0]>=r.bottom);
          if(next && next[1]-r.top<700)boxes.push([r.top,next[1]]);
        }
        const cuts=[0]; let from=0;
        while(from<height){
          let end=Math.min(height,from+739.89);
          for(let i=0;i<100;i++){
            const crossing=boxes.filter(b=>b[0]<end && b[1]>end && b[0]>from+1);
            if(!crossing.length)break;
            end=Math.min(...crossing.map(b=>b[0]))-.5;
          }
          if(end<=from+1)throw Error('An oversized block cannot fit a PDF page.');
          cuts.push(end);from=end;
        }
        return {height,cuts};
        """
        web.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { result in
            guard !self.finished else { return }
            switch result {
            case .failure(let error): self.finish(.failure(error))
            case .success(let value):
                guard let info = value as? [String: Any], let height = info["height"] as? Double, let cuts = info["cuts"] as? [Double], cuts.count <= 300 else { self.fail("Could not lay out PDF pages."); return }
                let config = WKPDFConfiguration(); config.rect = CGRect(x: 0, y: 0, width: 595.28, height: height)
                self.web.createPDF(configuration: config) { result in
                    guard !self.finished else { return }
                    switch result {
                    case .failure(let error): self.finish(.failure(error))
                    case .success(let data): self.paginate(data, cuts: cuts)
                    }
                }
            }
        }
    }
    func paginate(_ data: Data, cuts: [Double]) {
        guard let provider = CGDataProvider(data: data as CFData), let source = CGPDFDocument(provider), let page = source.page(at: 1) else { fail("PDF rendering failed."); return }
        let output = NSMutableData()
        var box = CGRect(x: 0, y: 0, width: 595.28, height: 841.89)
        guard let consumer = CGDataConsumer(data: output as CFMutableData), let context = CGContext(consumer: consumer, mediaBox: &box, nil) else { fail("PDF creation failed."); return }
        let sourceHeight = page.getBoxRect(.mediaBox).height
        for index in 0..<(cuts.count-1) {
            context.beginPDFPage(nil)
            context.saveGState()
            let contentHeight = cuts[index+1]-cuts[index]
            context.clip(to: CGRect(x: 0, y: 841.89-51-contentHeight, width: 595.28, height: contentHeight))
            context.translateBy(x: 0, y: 841.89-51+cuts[index]-sourceHeight)
            context.drawPDFPage(page)
            context.restoreGState()
            context.endPDFPage()
        }
        context.closePDF()
        finish(.success(output as Data))
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate, BrowserServerDelegate {
    var window: NSWindow!
    var web: WKWebView!
    var store: LocalStore!
    var terminating = false
    var ready = false
    var noteMode = false
    var exportingPDF = false
    var pdfRenderer: NotePDFRenderer?
    var savedClipboard = [[NSPasteboard.PasteboardType: Data]]()
    let queue = DispatchQueue(label: "local.flowchart.storage", qos: .userInitiated)
    var testsStarted = false
    // Browser mode (File › Open in Browser). The server runs in this process and the
    // window shows web/browser-mode.html until the tab hands back; see src/serve.swift.
    var browser: BrowserServer?
    var browserPhase = "live"
    var browserTimer: Timer?
    var browserStarted = Date()
    var browserSawTab = false
    var browserFinish: (() -> Void)?
    // `--ui-test --browser-test` enters browser mode on a temporary library without
    // opening a browser, so a test can drive the tab itself.
    let browserTesting = CommandLine.arguments.contains("--browser-test")
    func applicationDidFinishLaunching(_ notification: Notification) {
        do { store = try LocalStore(directory: CommandLine.arguments.contains("--ui-test") ? FileManager.default.temporaryDirectory.appendingPathComponent("flowchart-ui-" + UUID().uuidString) : nil) } catch { let alert = NSAlert(); alert.messageText = "Local storage could not be opened"; alert.informativeText = error.localizedDescription; alert.runModal(); NSApp.terminate(nil); return }
        if !CommandLine.arguments.contains("--ui-test"), !store.lock() { let alert = NSAlert(); alert.messageText = "mapyourmind is open in the browser"; alert.informativeText = "mapyourmind was started from Terminal. Close the mapyourmind tab, press Control-C in that Terminal window, then open the app again."; alert.runModal(); terminating = true; NSApp.terminate(nil); return }
        if CommandLine.arguments.contains("--ui-test") {
            savedClipboard = (NSPasteboard.general.pasteboardItems ?? []).map { item in Dictionary(uniqueKeysWithValues: item.types.compactMap { type in item.data(forType: type).map { (type, $0) } }) }
        }
        let controller = WKUserContentController(); controller.add(self, name: "native")
        let configuration = WKWebViewConfiguration(); configuration.userContentController = controller; configuration.websiteDataStore = .nonPersistent()
        web = WKWebView(frame: .zero, configuration: configuration); web.navigationDelegate = self; web.uiDelegate = self
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 840), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "mapyourmind"; window.minSize = NSSize(width: 940, height: 650); window.contentView = web; window.delegate = self; window.center(); window.setFrameAutosaveName("LocalFlowchartWindow"); window.makeKeyAndOrderFront(nil)
        makeMenu()
        let url = Bundle.main.resourceURL!.appendingPathComponent("web/index.html")
        web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        NSApp.activate(ignoringOtherApps: true)
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard CommandLine.arguments.contains("--ui-test"), web.url?.lastPathComponent == "index.html", !testsStarted else { return }
        testsStarted = true
        if browserTesting { startBrowserTestSignals(); web.evaluateJavaScript("window.appCommand('browser')", completionHandler: nil); return }
        let testURL = Bundle.main.resourceURL!.appendingPathComponent(CommandLine.arguments.contains("--refinements-test") ? "refinements.js" : CommandLine.arguments.contains("--program-a-test") ? "program-a.js" : CommandLine.arguments.contains("--program-test") ? "program.js" : CommandLine.arguments.contains("--schema-test") ? "schema3.js" : CommandLine.arguments.contains("--perf-test") ? "perf.js" : CommandLine.arguments.contains("--notebook-test") ? "notebook.js" : CommandLine.arguments.contains("--navigation-test") ? "navigation.js" : CommandLine.arguments.contains("--feedback-test") ? "feedback.js" : "integration.js")
        guard let source = try? String(contentsOf: testURL, encoding: .utf8) else { print("FAIL missing integration test"); exit(1) }
        web.callAsyncJavaScript(source, arguments: [:], in: nil, in: .page) { result in
            switch result {
            case .success(let value):
                print("UI TESTS: \(value)")
                self.web.takeSnapshot(with: nil) { image, error in
                    if let image = image, let tiff = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff), let png = bitmap.representation(using: .png, properties: [:]) { try? png.write(to: FileManager.default.temporaryDirectory.appendingPathComponent("local-flowchart-preview.png")) }
                    try? FileManager.default.removeItem(at: self.store.directory)
                    self.restoreTestClipboard(); exit(0)
                }
            case .failure(let error): print("UI FAIL: \(error)"); self.restoreTestClipboard(); exit(1)
            }
        }
    }
    func restoreTestClipboard() {
        NSPasteboard.general.clearContents()
        let items = savedClipboard.map { values -> NSPasteboardItem in let item = NSPasteboardItem(); for (type, data) in values { item.setData(data, forType: type) }; return item }
        NSPasteboard.general.writeObjects(items)
    }
    func makeMenu() {
        let main = NSMenu(); let appItem = NSMenuItem(); main.addItem(appItem); let appMenu = NSMenu(); appItem.submenu = appMenu
        appMenu.addItem(withTitle: "About mapyourmind", action: #selector(about), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator()); appMenu.addItem(withTitle: "Hide mapyourmind", action: #selector(NSApplication.hide(_:)), keyEquivalent: ""); appMenu.addItem(withTitle: "Quit mapyourmind", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        for (title, commands) in [("File", [("New document", "n", "new"), ("Export PNG", "e", "export"), ("Export PDF…", "", "export-pdf"), ("Open in Browser", "", "browser")]), ("Edit", [("Undo", "z", "undo"), ("Redo", "Z", "redo"), ("Cut", "x", "cut"), ("Copy", "c", "copy"), ("Paste", "v", "paste"), ("Copy as PNG", "C", "image"), ("Select all", "a", "all"), ("Find in document…", "f", "find"), ("Duplicate", "d", "duplicate"), ("Comment", "c", "comment"), ("Bold", "b", "bold"), ("Italic", "i", "italic"), ("Underline", "u", "underline"), ("Highlight", "h", "highlight"), ("Align text left", "L", "text-align-left"), ("Center text", "E", "text-align-center"), ("Align text right", "R", "text-align-right")]), ("View", [("Fit diagram", "0", "fit"), ("Actual size", "0", "actual"), ("Zoom in", "+", "in"), ("Zoom out", "-", "out"), ("View only / Back to editing", "", "view-only"), ("Presentation pointer", "", "pointer")])] {
            let item = NSMenuItem(); main.addItem(item); let menu = NSMenu(title: title); item.title = title; item.submenu = menu
            for (label, key, command) in commands { let m = NSMenuItem(title: label, action: #selector(menuCommand(_:)), keyEquivalent: key.lowercased()); m.target = self; m.representedObject = command; if key != key.lowercased() { m.keyEquivalentModifierMask = [.command, .shift] }; if command == "actual" { m.keyEquivalentModifierMask = [.command, .shift] }; if command == "comment" { m.keyEquivalentModifierMask = [.command, .option] }; menu.addItem(m) }
        }
        NSApp.mainMenu = main
    }
    @objc func about() { NSApp.orderFrontStandardAboutPanel(options: [.applicationName: "mapyourmind", .applicationVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.5.0", .credits: NSAttributedString(string: "An offline canvas for flowcharts and mind maps.\nExcalifont © Excalidraw — SIL OFL 1.1.\nGoogle Sans © Google LLC — SIL OFL 1.1.\nSketch rendering by Rough.js — MIT License.")]) }
    @objc func menuCommand(_ sender: NSMenuItem) {
        // While the tab is live the editor page is not loaded; Open in Browser reopens the tab.
        if browser != nil { if sender.representedObject as? String == "browser" { openBrowserTab() }; return }
        if let command = sender.representedObject as? String { web.evaluateJavaScript("window.appCommand(\"\(command)\")", completionHandler: nil) }
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) { decisionHandler(action.request.url?.isFileURL == true ? .allow : .cancel) }
    func reply(_ id: String, result: Any? = nil, error: String? = nil) {
        let body: [String: Any] = ["id": id, "result": result ?? NSNull(), "error": error ?? NSNull()]
        guard let data = try? JSONSerialization.data(withJSONObject: body, options: [.fragmentsAllowed]), let json = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async { self.web.evaluateJavaScript("window.nativeReply(\(json))", completionHandler: nil) }
    }
    // Notes and Boards share the save panel, cancellation and temporary test destinations.
    func pdfDestination(_ body: [String: Any], id: String, testName: String, complete: @escaping (URL, Bool) -> Void) {
        let test = body["test"] as? Bool == true && CommandLine.arguments.contains("--ui-test")
        if test { complete(FileManager.default.temporaryDirectory.appendingPathComponent("excalidravv-" + testName + ".pdf"), true); return }
        let panel = NSSavePanel(); panel.allowedContentTypes = [.pdf]
        let filename = String((body["filename"] as? String ?? "Document").prefix(160)).replacingOccurrences(of: "/", with: "-").replacingOccurrences(of: ":", with: "-")
        panel.nameFieldStringValue = filename + ".pdf"
        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let url = panel.url else { self.exportingPDF = false; self.reply(id, result: false); return }
            complete(url, false)
        }
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.isFileURL == true, let b = message.body as? [String: Any], let id = b["id"] as? String, let action = b["action"] as? String else { return }
        switch action {
        case "openInBrowser": reply(id, result: true); enterBrowserMode()
        case "browserSaveFailed":
            reply(id, result: true)
            let alert = NSAlert(); alert.messageText = "Couldn't open in the browser"
            alert.informativeText = "Your latest change hasn't saved yet, so mapyourmind stays here and nothing is lost.\n\n" + (b["message"] as? String ?? "")
            alert.addButton(withTitle: "Try again"); alert.addButton(withTitle: "Stay here")
            alert.beginSheetModal(for: window) { response in if response == .alertFirstButtonReturn { self.web.evaluateJavaScript("window.openInBrowser()", completionHandler: nil) } }
        case "browserOpenTab": openBrowserTab()
        case "browserCopyLink": if let url = browser?.url { NSPasteboard.general.clearContents(); NSPasteboard.general.setString(url.absoluteString, forType: .string) }
        case "browserBack": endBrowserMode("back") { self.showEditor() }
        case "documentMode":
            noteMode = b["mode"] as? String == "notes"
            for menu in NSApp.mainMenu?.items ?? [] {
                for item in menu.submenu?.items ?? [] {
                    if item.representedObject as? String == "export" { item.title = noteMode ? "Export PDF" : "Export PNG" }
                    if item.representedObject as? String == "export-pdf" { item.isHidden = noteMode }
                    if item.representedObject as? String == "image" { item.title = noteMode ? "Copy as PNG (diagrams only)" : "Copy as PNG" }
                }
            }
            reply(id, result: true)
        case "openLink":
            guard let raw = b["url"] as? String, let url = URL(string: raw), ["https","http","mailto"].contains(url.scheme?.lowercased() ?? "") else { reply(id, error: "Unsupported link."); return }
            reply(id, result: NSWorkspace.shared.open(url))
        case "notePDF":
            guard noteMode, !exportingPDF else { reply(id, error: "Open a note before exporting PDF."); return }
            exportingPDF = true
            guard let html = b["html"] as? String, html.utf16.count <= 2_100_000 else { exportingPDF = false; reply(id, error: "Invalid note export."); return }
            let complete: (URL, Bool) -> Void = { url, test in
                self.pdfRenderer = NotePDFRenderer(html: html) { result in
                    self.exportingPDF = false
                    defer { self.pdfRenderer = nil }
                    switch result {
                    case .success(let data):
                        do {
                            try data.write(to: url, options: .atomic)
                            if test, let pdf = PDFDocument(data: data) { self.reply(id, result: ["pages": pdf.pageCount, "text": pdf.string ?? "", "path": url.path]) }
                            else { self.reply(id, result: true) }
                        } catch { self.reply(id, error: error.localizedDescription) }
                    case .failure(let error): self.reply(id, error: error.localizedDescription)
                    }
                }
                self.pdfRenderer?.start()
            }
            pdfDestination(b, id: id, testName: "notes-test", complete: complete)
        case "boardPDF":
            guard !noteMode, !exportingPDF else { reply(id, error: "Open a board before exporting PDF."); return }
            guard let width = b["width"] as? Double, let height = b["height"] as? Double,
                  width.isFinite, height.isFinite, width > 0, height > 0, width <= 16000.0 / 3, height <= 16000.0 / 3,
                  let base64 = b["data"] as? String, base64.utf8.count <= 200_000_000,
                  let data = Data(base64Encoded: base64), data.starts(with: [137, 80, 78, 71, 13, 10, 26, 10]),
                  let bitmap = NSBitmapImageRep(data: data), bitmap.pixelsWide > 0, bitmap.pixelsHigh > 0,
                  bitmap.pixelsWide <= 16000, bitmap.pixelsHigh <= 16000, bitmap.pixelsWide * bitmap.pixelsHigh <= 64_000_000,
                  abs(Double(bitmap.pixelsWide) - width * 3) < 1, abs(Double(bitmap.pixelsHigh) - height * 3) < 1,
                  let image = bitmap.cgImage else { reply(id, error: "The board image is invalid or too large."); return }
            let output = CFDataCreateMutable(nil, 0)!
            var box = CGRect(x: 0, y: 0, width: width, height: height)
            guard let consumer = CGDataConsumer(data: output), let pdf = CGContext(consumer: consumer, mediaBox: &box, nil) else { reply(id, error: "Could not create PDF."); return }
            pdf.beginPDFPage(nil); pdf.interpolationQuality = .high; pdf.draw(image, in: box); pdf.endPDFPage(); pdf.closePDF()
            let pdfData = output as Data
            exportingPDF = true
            let background = b["background"] as? String == "transparent" ? "transparent" : "white"
            let scope = b["scope"] as? String == "selection" ? "selection" : "all"
            pdfDestination(b, id: id, testName: "board-" + background + "-" + scope + "-test") { url, test in
                defer { self.exportingPDF = false }
                do {
                    try pdfData.write(to: url, options: .atomic)
                    if test, let saved = PDFDocument(url: url), let page = saved.page(at: 0) {
                        self.reply(id, result: ["pages": saved.pageCount, "path": url.path, "width": page.bounds(for: .mediaBox).width, "height": page.bounds(for: .mediaBox).height,
                            "pixelWidth": bitmap.pixelsWide, "pixelHeight": bitmap.pixelsHigh, "cornerAlpha": bitmap.colorAt(x: 0, y: 0)?.alphaComponent ?? -1])
                    } else { self.reply(id, result: true) }
                } catch { self.reply(id, error: error.localizedDescription) }
            }
        case "importMindmap":
            let panel = NSOpenPanel(); panel.allowedContentTypes = [.json]; panel.allowsMultipleSelection = false; panel.canChooseDirectories = false; panel.message = "Choose a mind-map JSON file"
            panel.beginSheetModal(for: window) { response in
                guard response == .OK, let url = panel.url else { self.reply(id); return }
                do {
                    let values = try url.resourceValues(forKeys: [.fileSizeKey])
                    guard let size = values.fileSize, size <= 2_000_000 else { self.reply(id, error: "File exceeds the 2 MB import limit."); return }
                    let text = try String(contentsOf: url, encoding: .utf8)
                    self.reply(id, result: text)
                } catch { self.reply(id, error: error.localizedDescription) }
            }
        case "loadPreferences": queue.async { self.reply(id,result:self.store.loadPreferences()) }
        case "savePreferences": guard let preferences=b["preferences"] as? [String:Any] else { reply(id,error:"Invalid preferences.");return };queue.async { do {try self.store.savePreferences(preferences);self.reply(id,result:true)}catch{self.reply(id,error:error.localizedDescription)} }
        case "putImage": guard let encoded=b["data"] as? String else {reply(id,error:"Missing image.");return};queue.async {do{self.reply(id,result:try self.store.putImage(encoded))}catch{self.reply(id,error:(error as? StoreFailure)?.message ?? error.localizedDescription)}}
        case "localFonts": reply(id,result:localFontFaces())
        case "clock": reply(id, result: monotonicClock())
        case "load": queue.async { do { var result = try self.store.load(); result["clock"] = monotonicClock(); self.reply(id, result: result) } catch { self.reply(id, error: (error as? StoreFailure)?.message ?? error.localizedDescription) } }
        case "save": guard let state = b["state"] else { return }; queue.async { do { try self.store.save(state); self.reply(id, result: true) } catch { self.reply(id, error: (error as? StoreFailure)?.message ?? error.localizedDescription) } }
        case "clipboardWrite":
            let board = NSPasteboard.general; board.clearContents()
            let text = b["text"] as? String ?? ""; var ok = board.setString(text, forType: .string)
            if let editable = b["editable"] as? String { ok = board.setString(editable, forType: NSPasteboard.PasteboardType("app.localflowchart.elements")) && ok }
            reply(id, result: ok)
        case "log": guard CommandLine.arguments.contains("--ui-test") else {reply(id,error:"Unavailable");return};print(String((b["message"] as? String ?? "").prefix(2000)));reply(id,result:true)
        case "snapshot":
            guard CommandLine.arguments.contains("--ui-test"), let name = b["name"] as? String, name.range(of:"^[a-zA-Z0-9_-]{1,64}$",options:.regularExpression) != nil else { reply(id, error: "Unavailable"); return }
            web.takeSnapshot(with: nil) { image, error in
                guard let tiff = image?.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff), let png = bitmap.representation(using: .png, properties: [:]) else { self.reply(id, error: "Snapshot failed"); return }
                do { try png.write(to: FileManager.default.temporaryDirectory.appendingPathComponent("excalidravv-" + name + ".png")); self.reply(id, result: true) } catch { self.reply(id, error: error.localizedDescription) }
            }
        case "clipboardProbe":
            guard CommandLine.arguments.contains("--ui-test") else { reply(id, error: "Unavailable"); return }
            let image = NSPasteboard.general.data(forType: .png).flatMap { NSBitmapImageRep(data: $0) }
            reply(id, result: ["png": image != nil, "alpha": image?.hasAlpha ?? false, "width": image?.pixelsWide ?? 0, "height": image?.pixelsHigh ?? 0, "cornerAlpha": image?.colorAt(x: 0, y: 0)?.alphaComponent ?? -1])
        case "clipboardRead":
            let board = NSPasteboard.general
            var clip: [String: Any] = ["text": board.string(forType: .string) ?? "", "editable": board.string(forType: NSPasteboard.PasteboardType("app.localflowchart.elements")) ?? ""]
            if let data = board.data(forType: .png) ?? board.data(forType: .tiff), let image = NSBitmapImageRep(data: data) {
                guard image.pixelsWide > 0, image.pixelsHigh > 0, image.pixelsWide * image.pixelsHigh <= 32_000_000, let png = image.representation(using: .png, properties: [:]), png.count <= 30_000_000 else { reply(id, error: "Image exceeds the 32 megapixel or 30 MB limit. Resize it before pasting."); return }
                clip["image"] = png.base64EncodedString()
            }
            reply(id, result: clip)
        case "png":
            guard let base64 = b["data"] as? String, let data = Data(base64Encoded: base64), data.count < 200_000_000, NSImage(data: data) != nil else { reply(id, error: "The PNG image is invalid or too large."); return }
            if b["clipboard"] as? Bool == true { NSPasteboard.general.clearContents(); if NSPasteboard.general.setData(data, forType: .png) { reply(id, result: true) } else { reply(id, error: "Tidak dapat menyalin gambar. Coba Export PNG.") } }
            else { let panel = NSSavePanel(); panel.allowedContentTypes = [.png]; panel.nameFieldStringValue = (b["filename"] as? String ?? "Diagram") + ".png"; panel.beginSheetModal(for: window) { response in
                guard response == .OK, let url = panel.url else { self.reply(id, result: false); return }
                do { try data.write(to: url, options: .atomic); self.reply(id, result: true) } catch { self.reply(id, error: error.localizedDescription) }
            } }
        default: reply(id, error: "Unknown action.")
        }
    }
    // Saves happen before this is called (window.openInBrowser flushes first).
    func enterBrowserMode() {
        guard browser == nil else { openBrowserTab(); return }
        let server = BrowserServer(store: store, queue: queue); server.delegate = self; browser = server
        browserPhase = "starting"; browserStarted = Date(); browserSawTab = false
        let page = Bundle.main.resourceURL!.appendingPathComponent("web/browser-mode.html")
        web.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
        window.title = "mapyourmind — open in browser"
        browserTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in self?.pushBrowserStatus() }
        server.start(ports: Array((browserTesting ? 4871 : 4870)...4879)) { port in
            guard port != nil else {
                self.browserTimer?.invalidate(); self.browserTimer = nil; self.browser = nil; self.showEditor()
                let alert = NSAlert(); alert.messageText = "Couldn't open in the browser"; alert.informativeText = "Other apps are using all the addresses mapyourmind can use (ports 4870 to 4879). Quit other copies of mapyourmind or other developer tools, then try again."
                alert.beginSheetModal(for: self.window, completionHandler: nil); return
            }
            self.browserPhase = "live"; self.pushBrowserStatus(); self.openBrowserTab()
        }
    }
    // Test hooks for --browser-test, so a script can use the same paths as the menus:
    // SIGUSR2 is File › Open in Browser, SIGUSR1 is Quit.
    var browserTestSignals = [DispatchSourceSignal]()
    func startBrowserTestSignals() {
        for (number, action) in [(SIGUSR1, { NSApp.terminate(nil) }), (SIGUSR2, { self.menuCommandNamed("browser") })] as [(Int32, () -> Void)] {
            signal(number, SIG_IGN)
            let source = DispatchSource.makeSignalSource(signal: number, queue: .main)
            // Run it as a run-loop block, as a menu event would: Quit waits in a nested run
            // loop, and inside a main-queue block the main queue could not drain meanwhile.
            source.setEventHandler { RunLoop.main.perform(action) }; source.resume(); browserTestSignals.append(source)
        }
    }
    func menuCommandNamed(_ command: String) { let item = NSMenuItem(); item.representedObject = command; menuCommand(item) }
    func openBrowserTab() { if let url = browser?.url, !browserTesting { NSWorkspace.shared.open(url) } }
    func pushBrowserStatus() {
        guard let server = browser else { return }
        let tabs = server.connectedTabs
        if tabs > 0 { browserSawTab = true }
        // Give a freshly opened tab a few seconds to connect before saying none is open.
        var phase = browserPhase
        if phase == "live", tabs == 0, !browserSawTab, browserStarted.timeIntervalSinceNow > -8 { phase = "starting" }
        let status: [String: Any] = ["phase": phase, "url": server.port > 0 ? server.url.absoluteString : "", "tabs": tabs, "lastSaved": server.lastSaved.map { DateFormatter.localizedString(from: $0, dateStyle: .none, timeStyle: .short) } ?? NSNull()]
        guard let data = try? JSONSerialization.data(withJSONObject: status), let json = String(data: data, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.setBrowserStatus && window.setBrowserStatus(\(json))", completionHandler: nil)
    }
    // Asks the live tab to save its last change and stop, then calls done. With no tab
    // connected, or none answering within four seconds, it goes ahead: every change the
    // tab already sent is saved, and the store queue drains before the server stops.
    func endBrowserMode(_ kind: String, immediately: Bool = false, then done: @escaping () -> Void) {
        guard let server = browser, browserFinish == nil else { return }
        browserPhase = "ending"; server.ending = kind; pushBrowserStatus()
        var finished = false
        let finish = { [weak self] in
            guard let self, !finished else { return }; finished = true
            self.browserFinish = nil; self.browserTimer?.invalidate(); self.browserTimer = nil
            // A moment for other tabs' heartbeats to see the ending, then stop.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.queue.async { DispatchQueue.main.async { server.stop(); self.browser = nil; done() } } }
        }
        browserFinish = finish
        if immediately || server.connectedTabs == 0 || server.activeSession == nil { finish(); return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 4, execute: finish)
    }
    func showEditor() {
        window.title = "mapyourmind"
        let url = Bundle.main.resourceURL!.appendingPathComponent("web/index.html")
        web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
    }
    func browserTabAskedToReturn() { endBrowserMode("back", immediately: true) { self.showEditor() } }
    func browserTabFinished() { browserFinish?() }
    func browserSaved() { pushBrowserStatus() }
    func windowDidResignKey(_ notification: Notification) { web.evaluateJavaScript("window.flushSave && window.flushSave()", completionHandler: nil) }
    func windowShouldClose(_ sender: NSWindow) -> Bool { NSApp.terminate(nil); return false }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if let server = browser, !terminating {
            if server.connectedTabs > 0, !browserTesting {
                let alert = NSAlert(); alert.messageText = "Quit and end the browser tab?"
                alert.informativeText = "The tab saves its last change first, then stops. If you're still sharing it, the meeting will see a “mapyourmind was closed” screen."
                alert.addButton(withTitle: "Save and quit"); alert.addButton(withTitle: "Cancel")
                if alert.runModal() != .alertFirstButtonReturn { return .terminateCancel }
            }
            terminating = true
            endBrowserMode("quit") { NSApp.reply(toApplicationShouldTerminate: true) }
            return .terminateLater
        }
        if terminating { return .terminateNow }; terminating = true
        web.callAsyncJavaScript("if (window.flushSave) await window.flushSave();", arguments: [:], in: nil, in: .page) { result in
            switch result {
            case .success: self.queue.async { DispatchQueue.main.async { NSApp.reply(toApplicationShouldTerminate: true) } }
            case .failure(let error): self.terminating = false; let alert = NSAlert(); alert.messageText = "Changes have not been saved"; alert.informativeText = error.localizedDescription; alert.addButton(withTitle: "Return to the app"); alert.runModal(); NSApp.reply(toApplicationShouldTerminate: false)
            }
        }
        return .terminateLater
    }
}
if CommandLine.arguments.contains("--storage-test") {
    do {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("flowchart-tests-" + UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = try LocalStore(directory: root)
        let rival = try LocalStore(directory: root); precondition(store.lock() && !rival.lock())
        let initial = try store.load(); precondition(initial["recovered"] as? Bool == false)
        let first: [String: Any] = ["schema": 1, "documents": [["id": "one", "title": "你好 🌱", "canvas": ["nodes": [], "edges": []]]]]
        try store.save(first); try store.save(first)
        let saved = try Data(contentsOf: store.primary); precondition(store.valid(saved))
        try Data("partial".utf8).write(to: store.primary)
        let restored = try store.load(); precondition(restored["recovered"] as? Bool == true)
        try Data("{\"schema\":4,\"documents\":[]}".utf8).write(to: store.primary)
        var rejected = false; do { _ = try store.load() } catch { rejected = true }; precondition(rejected)
        let note: [String: Any] = ["schema": 2, "documents": [["id": "note", "title": "Notes", "mode": "notes", "canvas": ["nodes": [], "edges": []], "note": ["html": "<p>Hello 🌱</p>", "fontFamily": "Excalifont", "fontSize": 19, "textColor": "#1b1b1f"]]]]
        try store.save(note)
        let roundtrip = try store.load(); precondition((roundtrip["state"] as? [String: Any])?["schema"] as? Int == 2)
        var invalidNote = note
        invalidNote["documents"] = [["id": "bad", "title": "Invalid", "mode": "notes", "canvas": ["nodes": [], "edges": []], "note": ["html": "<p>Bad</p>", "fontFamily": "Unbundled", "fontSize": 19, "textColor": "#1b1b1f"]]]
        let invalidData = try JSONSerialization.data(withJSONObject: invalidNote)
        precondition(!store.valid(invalidData))
        let bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:2,pixelsHigh:2,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
        for x in 0..<2 {for y in 0..<2 {bitmap.setColor(NSColor(deviceRed:1,green:0,blue:0,alpha:1),atX:x,y:y)}}
        let imageData="data:image/png;base64,"+bitmap.representation(using:.png,properties:[:])!.base64EncodedString()
        let reference=try store.putImage(imageData)
        let duplicateReference=try store.putImage(imageData);precondition(duplicateReference==reference)
        let image:[String:Any] = ["id":"image","kind":"image","text":"","x":0,"y":0,"w":80,"h":80,"imageRef":reference]
        let sticker:[String:Any] = ["id":"sticker","kind":"sticker","text":"🌱","x":100,"y":0,"w":80,"h":80]
        let schema3:[String:Any] = ["schema":3,"sidebarWidth":280,"documents":[["id":"canvas","title":"Synthetic schema 3","canvas":["nodes":[image,sticker],"edges":[]]],(note["documents"] as! [[String:Any]])[0]]]
        try store.save(schema3)
        let loaded3=try store.load(),state3=loaded3["state"] as! [String:Any],docs3=state3["documents"] as! [[String:Any]],nodes3=(docs3[0]["canvas"] as! [String:Any])["nodes"] as! [[String:Any]]
        precondition(state3["schema"] as? Int==3 && nodes3[0]["imageData"] as? String==imageData && nodes3[1]["kind"] as? String=="sticker")
        let intact=try Data(contentsOf:store.primary)
        var malformed=schema3;malformed["documents"]=[["id":"bad","title":"Invalid image","canvas":["nodes":[["id":"bad-image","kind":"image","text":"","x":0,"y":0,"w":80,"h":80,"imageRef":"../documents"]],"edges":[]]]]
        var badRejected=false;do{try store.save(malformed)}catch{badRejected=true}
        let afterRejected=try Data(contentsOf:store.primary);precondition(badRejected && afterRejected==intact)
        try store.savePreferences(["process":["fill":"#123456"]]);precondition((store.loadPreferences()["process"] as? [String:String])?["fill"]=="#123456")
        print("PASS native storage: schema 1/2/3, referenced images, deduplication, stickers, Notes, preferences, path traversal rejection, atomic recovery, future schema protection, single-writer lock")
    } catch { print("FAIL: \(error)"); exit(1) }
} else if CommandLine.arguments.contains("--serve") {
    serveBrowser()
} else {
    let app = NSApplication.shared; let delegate = AppDelegate(); app.delegate = delegate; app.setActivationPolicy(.regular); app.run()
}
