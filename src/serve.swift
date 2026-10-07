import Cocoa
private let servedVersion = (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "").filter { $0.isNumber || $0 == "." }
import Network

// Browser mode serves the same web page on 127.0.0.1 so it can be shared as a
// browser tab. The app starts it from File › Open in Browser and runs it in-process
// (AppDelegate is the delegate); `mapyourmind --serve` runs it on its own from
// Terminal. Storage actions use the same LocalStore and queue as the app, and the
// library lock keeps any other copy out. web/browser-bridge.js stands in for the
// native message handler; everything else in the page runs unchanged.
//
// Each tab says hello with a session id and then sends a heartbeat. The newest tab
// to say hello is the only one allowed to write, so two tabs never overwrite each
// other; the heartbeat also tells a tab when the app wants it to finish.
protocol BrowserServerDelegate: AnyObject {
    func browserTabAskedToReturn()
    func browserTabFinished()
    func browserSaved()
}

final class BrowserServer {
    let store: LocalStore
    let queue: DispatchQueue
    let root: URL
    let token = UUID().uuidString
    weak var delegate: BrowserServerDelegate?
    private(set) var port: UInt16 = 0
    var listener: NWListener?
    // Session state lives on the main queue.
    var sessions = [String: Date]()
    var activeSession: String?
    var ending: String?
    var lastSaved: Date?
    static let bodyLimit = 64_000_000
    static let types = ["html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8", "css": "text/css; charset=utf-8", "png": "image/png", "woff2": "font/woff2", "ttf": "font/ttf", "json": "application/json", "txt": "text/plain; charset=utf-8", "md": "text/plain; charset=utf-8"]

    init(store: LocalStore, queue: DispatchQueue) {
        self.store = store; self.queue = queue
        root = Bundle.main.resourceURL!.appendingPathComponent("web", isDirectory: true).standardizedFileURL
    }
    var url: URL { URL(string: "http://127.0.0.1:\(port)")! }
    var origins: [String] { ["127.0.0.1:\(port)", "localhost:\(port)"] }
    var connectedTabs: Int { sessions.values.filter { $0.timeIntervalSinceNow > -6 }.count }

    // Tries each port in turn and calls back on the main queue with the one it got,
    // or nil when every one is taken.
    func start(ports: [UInt16], completion: @escaping (UInt16?) -> Void) {
        guard let candidate = ports.first else { completion(nil); return }
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = NWEndpoint.hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: candidate)!)
        guard let listener = try? NWListener(using: parameters) else { start(ports: Array(ports.dropFirst()), completion: completion); return }
        var settled = false
        listener.newConnectionHandler = { [weak self] connection in
            connection.start(queue: .global(qos: .userInitiated))
            self?.receive(connection, buffer: Data())
        }
        listener.stateUpdateHandler = { [weak self] state in
            guard let self, !settled else { return }
            switch state {
            case .ready: settled = true; self.port = candidate; self.listener = listener; completion(candidate)
            case .failed, .cancelled: settled = true; listener.cancel(); self.start(ports: Array(ports.dropFirst()), completion: completion)
            default: break
            }
        }
        listener.start(queue: .main)
    }
    func stop() { listener?.cancel(); listener = nil }

    // One request per connection: read the head, then the body its Content-Length names.
    func receive(_ connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 1 << 20) { [weak self] data, _, complete, error in
            guard let self else { connection.cancel(); return }
            var buffer = buffer; if let data { buffer.append(data) }
            guard buffer.count <= BrowserServer.bodyLimit + 65_536 else { self.send(connection, 413, text: "Too large"); return }
            if let end = buffer.range(of: Data("\r\n\r\n".utf8)), let head = String(data: buffer[..<end.lowerBound], encoding: .utf8) {
                let lines = head.components(separatedBy: "\r\n"), start = lines[0].split(separator: " ")
                var headers = [String: String]()
                for line in lines.dropFirst() { if let colon = line.firstIndex(of: ":") { headers[line[..<colon].lowercased()] = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces) } }
                let length = Int(headers["content-length"] ?? "0") ?? -1
                guard start.count >= 2, length >= 0, length <= BrowserServer.bodyLimit else { self.send(connection, 400, text: "Bad request"); return }
                let body = buffer[end.upperBound...]
                if body.count >= length { self.handle(connection, method: String(start[0]), path: String(start[1]), headers: headers, body: Data(body.prefix(length))); return }
            }
            if complete || error != nil { connection.cancel(); return }
            self.receive(connection, buffer: buffer)
        }
    }

    func handle(_ connection: NWConnection, method: String, path: String, headers: [String: String], body: Data) {
        // A page from another site that rebinds its name to this address still
        // sends its own Host, so only these two names are served.
        guard let host = headers["host"], origins.contains(host) else { send(connection, 403, text: "Forbidden"); return }
        if method == "POST", path == "/native" {
            guard let origin = headers["origin"], origins.map({ "http://" + $0 }).contains(origin), headers["x-mym-token"] == token,
                  let message = try? JSONSerialization.jsonObject(with: body) as? [String: Any], let action = message["action"] as? String else { send(connection, 403, text: "Forbidden"); return }
            let reply = { (result: Any?, error: String?) in
                let body: [String: Any] = ["result": result ?? NSNull(), "error": error ?? NSNull()]
                let data = (try? JSONSerialization.data(withJSONObject: body, options: [.fragmentsAllowed])) ?? Data("{\"error\":\"Reply could not be encoded.\"}".utf8)
                self.send(connection, 200, type: "application/json", body: data)
            }
            DispatchQueue.main.async { self.native(action, message, reply) }
            return
        }
        guard method == "GET" else { send(connection, 405, text: "Method not allowed"); return }
        let relative = (path.split(separator: "?").first.map(String.init) ?? "/").removingPercentEncoding ?? ""
        if relative == "/" || relative == "/index.html" { index(connection); return }
        let file = root.appendingPathComponent(String(relative.drop(while: { $0 == "/" }))).standardizedFileURL
        var directory: ObjCBool = false
        guard file.path.hasPrefix(root.path + "/"), FileManager.default.fileExists(atPath: file.path, isDirectory: &directory), !directory.boolValue,
              let data = try? Data(contentsOf: file) else { send(connection, 404, text: "Not found"); return }
        send(connection, 200, type: BrowserServer.types[file.pathExtension.lowercased()] ?? "application/octet-stream", body: data)
    }

    // The app's page allows no network connections; this copy may reach its own
    // server, carries the request token and loads the bridge before the app scripts.
    func index(_ connection: NWConnection) {
        guard let page = try? String(contentsOf: root.appendingPathComponent("index.html"), encoding: .utf8) else { send(connection, 500, text: "Missing page"); return }
        let rewritten = page.replacingOccurrences(of: "connect-src 'none'", with: "connect-src 'self'")
            .replacingOccurrences(of: "</head>", with: "<meta name=\"mym-token\" content=\"\(token)\" />\n    <meta name=\"mym-version\" content=\"\(servedVersion)\" />\n    <script src=\"browser-bridge.js\"></script>\n  </head>")
        send(connection, 200, type: "text/html; charset=utf-8", body: Data(rewritten.utf8))
    }

    // Runs on the main queue; storage work moves to the store's queue.
    func native(_ action: String, _ b: [String: Any], _ reply: @escaping (Any?, String?) -> Void) {
        let session = b["session"] as? String ?? ""
        if !session.isEmpty { sessions[session] = Date() }
        let message = { (error: Error) in (error as? StoreFailure)?.message ?? error.localizedDescription }
        let write = { (work: @escaping () throws -> Any) in
            guard !session.isEmpty, session == self.activeSession else { reply(nil, "inactive"); return }
            self.queue.async {
                do { let result = try work(); DispatchQueue.main.async { self.lastSaved = Date(); self.delegate?.browserSaved() }; reply(result, nil) }
                catch { reply(nil, message(error)) }
            }
        }
        switch action {
        case "hello": activeSession = session; reply(["app": delegate != nil], nil)
        case "heartbeat": reply(["active": session == activeSession, "ending": (ending as Any?) ?? NSNull()], nil)
        case "backToApp": reply(true, nil); if session == activeSession { delegate?.browserTabAskedToReturn() }
        case "ended": reply(true, nil); if session == activeSession { delegate?.browserTabFinished() }
        case "save": guard let state = b["state"] else { reply(nil, "Missing state."); return }; write { try self.store.save(state); return true }
        case "putImage": guard let encoded = b["data"] as? String else { reply(nil, "Missing image."); return }; write { try self.store.putImage(encoded) }
        case "savePreferences": guard let preferences = b["preferences"] as? [String: Any] else { reply(nil, "Invalid preferences."); return }; write { try self.store.savePreferences(preferences); return true }
        case "load": queue.async { do { var result = try self.store.load(); result["clock"] = monotonicClock(); reply(result, nil) } catch { reply(nil, message(error)) } }
        case "loadPreferences": queue.async { reply(self.store.loadPreferences(), nil) }
        case "clock": reply(monotonicClock(), nil)
        default: reply(nil, "Unavailable in the browser.")
        }
    }

    func send(_ connection: NWConnection, _ status: Int, type: String = "text/plain; charset=utf-8", body: Data = Data(), text: String? = nil) {
        let body = text.map { Data($0.utf8) } ?? body
        let reason = [200: "OK", 400: "Bad Request", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed", 413: "Payload Too Large", 500: "Internal Server Error"][status] ?? "Error"
        let head = "HTTP/1.1 \(status) \(reason)\r\nContent-Type: \(type)\r\nContent-Length: \(body.count)\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n"
        connection.send(content: Data(head.utf8) + body, completion: .contentProcessed { _ in connection.cancel() })
    }
}

// Terminal fallback: `mapyourmind --serve [--port N] [--no-open]`.
func serveBrowser() -> Never {
    let arguments = CommandLine.arguments
    var port: UInt16 = 4870
    if let i = arguments.firstIndex(of: "--port") { guard i + 1 < arguments.count, let value = UInt16(arguments[i + 1]), value >= 1024 else { print("--port needs a number from 1024 to 65535."); exit(2) }; port = value }
    let store: LocalStore
    // As in the app, --ui-test uses a temporary library and never the real one.
    let testDirectory = arguments.contains("--ui-test") ? FileManager.default.temporaryDirectory.appendingPathComponent("flowchart-serve-" + UUID().uuidString) : nil
    do { store = try LocalStore(directory: testDirectory) } catch { print("Local storage could not be opened: \(error.localizedDescription)"); exit(1) }
    guard store.lock() else { print("mapyourmind is already open, either as the app or in another Terminal window. Quit it first, then try again. This keeps your work from being overwritten."); exit(1) }
    let server = BrowserServer(store: store, queue: DispatchQueue(label: "mapyourmind.serve.storage", qos: .userInitiated))
    server.start(ports: [port]) { got in
        guard got != nil else { print("Couldn't start browser mode: port \(port) is busy. Browser mode may already be running in another Terminal window. Or try another port, for example: --port 4871"); exit(1) }
        print("mapyourmind is open in your browser at \(server.url.absoluteString)\nKeep this window open while you work.\nTo stop: close the mapyourmind tab, then press Control-C here.")
        if !arguments.contains("--no-open") { NSWorkspace.shared.open(server.url) }
    }
    // Control-C waits for a save already in progress before exiting.
    signal(SIGINT, SIG_IGN); signal(SIGTERM, SIG_IGN)
    let stops = [SIGINT, SIGTERM].map { DispatchSource.makeSignalSource(signal: $0, queue: .main) }
    for source in stops { source.setEventHandler { server.queue.async { print("\nBrowser mode stopped. You can open the mapyourmind app again."); exit(0) } }; source.resume() }
    withExtendedLifetime((server, stops)) { dispatchMain() }
}
