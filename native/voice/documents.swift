// keeper-voice documents: the text of a PDF (PDFKit) and the words in a picture (Vision text
// recognition), read on this Mac only and handed to Keeper's core, never sent anywhere by this
// helper. Used when the person drops such a file on their keeper.
//
// Request/response by "id", like the calendar commands:
//   stdin  {"cmd":"doc-text","path":"/Users/…/file.pdf","limit":200000,"id":"…"}
//   stdout {"type":"doc","id":"…","ok":true,"text":"…","pages":12}
//          {"type":"doc","id":"…","ok":false,"error":"…"}
// The core validates the path before asking (a real file, not hidden, a sane size); this
// helper only reads it.

import AppKit
import Foundation
import PDFKit
import Vision

final class Documents {
    static let commands: Set<String> = ["doc-text"]
    private let work = DispatchQueue(label: "keeper.documents", qos: .userInitiated)
    private let pictures: Set<String> = ["png", "jpg", "jpeg", "heic", "tiff", "tif", "gif", "webp", "bmp"]

    func handle(_ command: [String: Any]) {
        let id = command["id"] as? String ?? ""
        let reply: ([String: Any]) -> Void = { body in
            var event = body
            event["type"] = "doc"
            event["id"] = id
            DispatchQueue.main.async { emit(event) }
        }
        guard let path = command["path"] as? String, !path.isEmpty else { return reply(["ok": false, "error": "I couldn't find that file."]) }
        let limit = max(1_000, min(command["limit"] as? Int ?? 200_000, 1_000_000))
        let url = URL(fileURLWithPath: path)
        let kind = url.pathExtension.lowercased()
        work.async {
            if kind == "pdf" {
                reply(self.pdf(url, limit: limit))
            } else if self.pictures.contains(kind) {
                reply(self.picture(url, limit: limit))
            } else {
                reply(["ok": false, "error": "I can't read that kind of file yet."])
            }
        }
    }

    /// A PDF's own text, page by page, up to `limit` characters.
    private func pdf(_ url: URL, limit: Int) -> [String: Any] {
        guard let document = PDFDocument(url: url) else { return ["ok": false, "error": "I couldn't open that PDF."] }
        if document.isLocked { return ["ok": false, "error": "That PDF is locked with a password."] }
        var text = ""
        for index in 0..<document.pageCount {
            if let page = document.page(at: index), let words = page.string {
                text += words + "\n"
            }
            if text.count >= limit { break }
        }
        if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return ["ok": false, "error": "That PDF has no text in it (it may be scanned pages)."]
        }
        return ["ok": true, "text": String(text.prefix(limit)), "pages": document.pageCount]
    }

    /// The words in a picture (a screenshot, a photo of a page), top to bottom.
    private func picture(_ url: URL, limit: Int) -> [String: Any] {
        guard let image = NSImage(contentsOf: url), let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            return ["ok": false, "error": "I couldn't open that picture."]
        }
        let request = VNRecognizeTextRequest()
        // The fast recogniser: a screenshot in a fraction of a second (the accurate one took over
        // 40 s on the same picture, measured 2026-11-26).
        request.recognitionLevel = .fast
        request.usesLanguageCorrection = true
        do {
            try VNImageRequestHandler(cgImage: cg, options: [:]).perform([request])
        } catch {
            return ["ok": false, "error": "I couldn't read that picture."]
        }
        let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
        let text = lines.joined(separator: "\n")
        if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return ["ok": false, "error": "I couldn't find any words in that picture."]
        }
        return ["ok": true, "text": String(text.prefix(limit)), "pages": 1]
    }
}
