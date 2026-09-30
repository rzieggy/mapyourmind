import Cocoa
import Network

// Browser mode: `mapyourmind --serve [--port N] [--no-open]` serves the same web page
// on 127.0.0.1 so it can be shared as a browser tab. It answers the page's storage
// actions with the same LocalStore as the app and holds the library lock, so the app
// and a browser tab never write to one library at once. web/browser-bridge.js stands
// in for the native message handler; everything else runs unchanged.
final class BrowserServer {
    let store: LocalStore
    let port: UInt16
    let root: URL
    let token = UUID().uuidString
    let queue = DispatchQueue(label: "mapyourmind.serve.storage", qos: .userInitiated)
    var listener: NWListener!
    static let bodyLimit = 64_000_000
    static let types = ["html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8", "css": "text/css; charset=utf-8", "png": "image/png", "woff2": "font/woff2", "ttf": "font/ttf", "json": "application/json", "txt": "text/plain; charset=utf-8", "md": "text/plain; charset=utf-8"]

    init(store: LocalStore, port: UInt16) {
        self.store = store; self.port = port
        root = Bundle.main.resourceURL!.appendingPathComponent("web", isDirectory: true).standardizedFileURL
    }
    var origins: [String] { ["127.0.0.1:\(port)", "localhost:\(port)"] }

    func start() throws {
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = NWEndpoint.hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: port)!)
        parameters.allowLocalEndpointReuse = true
        listener = try NWListener(using: parameters)
        listener.newConnectionHandler = { [weak self] connection in
            connection.start(queue: .global(qos: .userInitiated))
            self?.receive(connection, buffer: Data())
        }
        listener.stateUpdateHandler = { [port] state in
            switch state {
            case .ready: print("mapyourmind is running at http://127.0.0.1:\(port)\nKeep this window open while you use it. Close the browser tab first, then press Control-C to stop.")
            case .failed(let error): print("Could not start on port \(port): \(error). Another copy may be running; try --port with another number."); exit(1)
            default: break
            }
        }
        listener.start(queue: .main)
    }

    // One request per connection: read the head, then the body its Content-Length names.
    func receive(_ connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 1 << 20) { [weak self] data, _, complete, error in
            guard let self else { return }
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
            queue.async { self.native(action, message) { result, error in
                let reply: [String: Any] = ["result": result ?? NSNull(), "error": error ?? NSNull()]
                let data = (try? JSONSerialization.data(withJSONObject: reply, options: [.fragmentsAllowed])) ?? Data("{\"error\":\"Reply could not be encoded.\"}".utf8)
                self.send(connection, 200, type: "application/json", body: data)
            } }
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
            .replacingOccurrences(of: "</head>", with: "<meta name=\"mym-token\" content=\"\(token)\" />\n    <script src=\"browser-bridge.js\"></script>\n  </head>")
        send(connection, 200, type: "text/html; charset=utf-8", body: Data(rewritten.utf8))
    }

    func native(_ action: String, _ b: [String: Any], _ reply: @escaping (Any?, String?) -> Void) {
        let message = { (error: Error) in (error as? StoreFailure)?.message ?? error.localizedDescription }
        switch action {
        case "load": do { var result = try store.load(); result["clock"] = monotonicClock(); reply(result, nil) } catch { reply(nil, message(error)) }
        case "save": guard let state = b["state"] else { reply(nil, "Missing state."); return }; do { try store.save(state); reply(true, nil) } catch { reply(nil, message(error)) }
        case "putImage": guard let encoded = b["data"] as? String else { reply(nil, "Missing image."); return }; do { reply(try store.putImage(encoded), nil) } catch { reply(nil, message(error)) }
        case "loadPreferences": reply(store.loadPreferences(), nil)
        case "savePreferences": guard let preferences = b["preferences"] as? [String: Any] else { reply(nil, "Invalid preferences."); return }; do { try store.savePreferences(preferences); reply(true, nil) } catch { reply(nil, message(error)) }
        case "clock": reply(monotonicClock(), nil)
        case "localFonts": reply(localFontFaces(), nil)
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

func serveBrowser() -> Never {
    let arguments = CommandLine.arguments
    var port: UInt16 = 4870
    if let i = arguments.firstIndex(of: "--port") { guard i + 1 < arguments.count, let value = UInt16(arguments[i + 1]), value >= 1024 else { print("--port needs a number from 1024 to 65535."); exit(2) }; port = value }
    let store: LocalStore
    // As in the app, --ui-test uses a temporary library and never the real one.
    let testDirectory = arguments.contains("--ui-test") ? FileManager.default.temporaryDirectory.appendingPathComponent("flowchart-serve-" + UUID().uuidString) : nil
    do { store = try LocalStore(directory: testDirectory) } catch { print("Local storage could not be opened: \(error.localizedDescription)"); exit(1) }
    guard store.lock() else { print("mapyourmind is already open, as the app or another --serve. Quit it first so two copies never write to one library."); exit(1) }
    let server = BrowserServer(store: store, port: port)
    do { try server.start() } catch { print("Could not start: \(error)"); exit(1) }
    // Control-C waits for a save already in progress before exiting.
    signal(SIGINT, SIG_IGN); signal(SIGTERM, SIG_IGN)
    let stops = [SIGINT, SIGTERM].map { DispatchSource.makeSignalSource(signal: $0, queue: .main) }
    for source in stops { source.setEventHandler { server.queue.async { print("\nStopped. You can open the mapyourmind app again."); exit(0) } }; source.resume() }
    if !arguments.contains("--no-open") { DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { NSWorkspace.shared.open(URL(string: "http://127.0.0.1:\(port)")!) } }
    withExtendedLifetime((server, stops)) { dispatchMain() }
}
