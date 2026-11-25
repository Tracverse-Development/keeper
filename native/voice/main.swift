// keeper-voice: Keeper's ears and mouth, on this Mac only.
//
// Hears with SFSpeechRecognizer using ON-DEVICE recognition (requiresOnDeviceRecognition),
// so audio never leaves the computer; speaks with AVSpeechSynthesizer (system voices).
//
// Protocol (one JSON object per line):
//   stdin  {"cmd":"listen","mode":"once"|"always"} {"cmd":"stop"} {"cmd":"speak","text":"…","voice":"Samantha"}
//          {"cmd":"play","path":"/…/speech.mp3"} (ElevenLabs audio; mouth follows the loudness)
//          {"cmd":"hush"} {"cmd":"authorize"} {"cmd":"voices"}
//   stdout {"type":"ready","onDevice":true} {"type":"level","value":0.4} {"type":"partial","text":"…"}
//          {"type":"final","text":"…"} {"type":"listening","on":true} {"type":"speech-start"}
//          {"type":"word","length":5} {"type":"mouth","value":0.6} {"type":"speech-end"} {"type":"authorized","speech":"…","mic":true}
//          {"type":"voices","voices":[…]} {"type":"error","message":"…"}

import AVFoundation
import Foundation
import Speech

func emit(_ event: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: event), let line = String(data: data, encoding: .utf8) else { return }
    FileHandle.standardOutput.write((line + "\n").data(using: .utf8)!)
}

/// The ears. One recognition task at a time; a sentence ends after a short silence.
final class Listener {
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var silenceTimer: Timer?
    private var restartTimer: Timer?
    private var lastText = ""
    private var lastLevelAt = Date.distantPast
    private(set) var mode: String = "off"
    /// Silence that ends a sentence.
    private let sentenceGap: TimeInterval = 1.3
    /// The recogniser limits one task's length; always-listening restarts before that.
    private let taskLifetime: TimeInterval = 50

    var onDevice: Bool { recognizer?.supportsOnDeviceRecognition ?? false }

    func start(mode: String) {
        stop(emitState: false)
        guard let recognizer, recognizer.isAvailable else {
            emit(["type": "error", "message": "Speech recognition is not available on this Mac right now."])
            return
        }
        guard SFSpeechRecognizer.authorizationStatus() == .authorized else {
            emit(["type": "error", "message": "Speech recognition is not allowed yet. Allow Keeper in System Settings, Privacy & Security, Speech Recognition."])
            return
        }
        self.mode = mode
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0 else {
            emit(["type": "error", "message": "No microphone was found."])
            return
        }
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.request?.append(buffer)
            self?.measure(buffer)
        }
        engine.prepare()
        do { try engine.start() } catch {
            emit(["type": "error", "message": "The microphone could not start: \(error.localizedDescription)"])
            return
        }
        beginTask()
        emit(["type": "listening", "on": true, "mode": mode])
    }

    private func beginTask() {
        task?.cancel()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if onDevice { request.requiresOnDeviceRecognition = true }
        request.taskHint = .dictation
        self.request = request
        lastText = ""
        task = recognizer?.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async { self?.handle(result: result, error: error) }
        }
        restartTimer?.invalidate()
        if mode == "always" {
            restartTimer = Timer.scheduledTimer(withTimeInterval: taskLifetime, repeats: false) { [weak self] _ in self?.finishSentence() }
        }
    }

    private func handle(result: SFSpeechRecognitionResult?, error: Error?) {
        if let result {
            let text = result.bestTranscription.formattedString
            if !text.isEmpty && text != lastText {
                lastText = text
                emit(["type": "partial", "text": text])
                silenceTimer?.invalidate()
                silenceTimer = Timer.scheduledTimer(withTimeInterval: sentenceGap, repeats: false) { [weak self] _ in self?.finishSentence() }
            }
            if result.isFinal { finishSentence() }
        } else if error != nil, mode == "always" {
            // A task ends with an error after long silence; start a fresh one.
            beginTask()
        }
    }

    private func finishSentence() {
        silenceTimer?.invalidate()
        let text = lastText.trimmingCharacters(in: .whitespacesAndNewlines)
        lastText = ""
        if !text.isEmpty { emit(["type": "final", "text": text]) }
        if mode == "always" {
            request?.endAudio()
            beginTask()
        } else {
            stop(emitState: true)
        }
    }

    private func measure(_ buffer: AVAudioPCMBuffer) {
        guard let samples = buffer.floatChannelData?[0] else { return }
        let n = Int(buffer.frameLength)
        if n == 0 { return }
        var sum: Float = 0
        for i in 0..<n { sum += samples[i] * samples[i] }
        let rms = sqrt(sum / Float(n))
        let level = min(1, max(0, (20 * log10(max(rms, 0.000_01)) + 55) / 45))
        let now = Date()
        if now.timeIntervalSince(lastLevelAt) > 0.07 {
            lastLevelAt = now
            emit(["type": "level", "value": Double(level)])
        }
    }

    func stop(emitState: Bool) {
        silenceTimer?.invalidate()
        restartTimer?.invalidate()
        task?.cancel()
        task = nil
        request?.endAudio()
        request = nil
        if engine.isRunning {
            engine.stop()
            engine.inputNode.removeTap(onBus: 0)
        }
        let was = mode
        mode = "off"
        if emitState && was != "off" { emit(["type": "listening", "on": false]) }
    }
}

/// The mouth. While it speaks the ears pause, so Umoja never hears itself.
final class Speaker: NSObject, AVSpeechSynthesizerDelegate {
    private let synth = AVSpeechSynthesizer()
    var onFinish: (() -> Void)?

    override init() {
        super.init()
        synth.delegate = self
    }

    func speak(_ text: String, voiceName: String) {
        synth.stopSpeaking(at: .immediate)
        let utterance = AVSpeechUtterance(string: text)
        let voices = AVSpeechSynthesisVoice.speechVoices()
        let preferred = voices.filter { $0.name == voiceName }.sorted { $0.quality.rawValue > $1.quality.rawValue }.first
        utterance.voice = preferred ?? AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = 0.5
        utterance.pitchMultiplier = 1.03
        synth.speak(utterance)
    }

    func hush() { synth.stopSpeaking(at: .immediate) }

    func speechSynthesizer(_ s: AVSpeechSynthesizer, didStart u: AVSpeechUtterance) { emit(["type": "speech-start"]) }
    func speechSynthesizer(_ s: AVSpeechSynthesizer, willSpeakRangeOfSpeechString r: NSRange, utterance u: AVSpeechUtterance) {
        emit(["type": "word", "length": r.length])
    }
    func speechSynthesizer(_ s: AVSpeechSynthesizer, didFinish u: AVSpeechUtterance) { emit(["type": "speech-end"]); onFinish?() }
    func speechSynthesizer(_ s: AVSpeechSynthesizer, didCancel u: AVSpeechUtterance) { emit(["type": "speech-end"]); onFinish?() }
}

/// Plays rendered speech (ElevenLabs MP3) and turns its loudness into mouth movement.
final class Player: NSObject, AVAudioPlayerDelegate {
    private var player: AVAudioPlayer?
    private var meter: Timer?
    var onFinish: (() -> Void)?

    func play(path: String) {
        stop()
        do {
            let p = try AVAudioPlayer(contentsOf: URL(fileURLWithPath: path))
            p.isMeteringEnabled = true
            p.delegate = self
            player = p
            emit(["type": "speech-start"])
            p.play()
            meter = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in
                guard let p = self?.player, p.isPlaying else { return }
                p.updateMeters()
                let db = p.averagePower(forChannel: 0)
                emit(["type": "mouth", "value": Double(min(1, max(0, (db + 42) / 34)))])
            }
        } catch {
            emit(["type": "error", "message": "The voice audio could not play."])
            emit(["type": "speech-end"])
        }
    }

    func stop() {
        meter?.invalidate()
        if player?.isPlaying == true {
            player?.stop()
            emit(["type": "speech-end"])
        }
        player = nil
    }

    func audioPlayerDidFinishPlaying(_ p: AVAudioPlayer, successfully flag: Bool) {
        meter?.invalidate()
        emit(["type": "mouth", "value": 0])
        emit(["type": "speech-end"])
        onFinish?()
    }
}

final class Helper {
    let listener = Listener()
    let speaker = Speaker()
    let player = Player()
    /// The mode to go back to after speaking.
    var resumeMode = "off"

    init() {
        let resume: () -> Void = { [weak self] in
            guard let self, self.resumeMode == "always" else { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { self.listener.start(mode: "always") }
        }
        speaker.onFinish = resume
        player.onFinish = resume
    }

    func handle(_ command: [String: Any]) {
        switch command["cmd"] as? String ?? "" {
        case "listen":
            let mode = (command["mode"] as? String) == "always" ? "always" : "once"
            resumeMode = mode == "always" ? "always" : "off"
            listener.start(mode: mode)
        case "stop":
            resumeMode = "off"
            listener.stop(emitState: true)
        case "speak":
            let text = command["text"] as? String ?? ""
            guard !text.isEmpty else { return }
            if listener.mode != "off" { listener.stop(emitState: false) }
            player.stop()
            speaker.speak(text, voiceName: command["voice"] as? String ?? "Samantha")
        case "play":
            guard let path = command["path"] as? String, path.hasSuffix(".mp3") else { return }
            if listener.mode != "off" { listener.stop(emitState: false) }
            speaker.hush()
            player.play(path: path)
        case "hush":
            speaker.hush()
            player.stop()
        case "authorize":
            authorize()
        case "voices":
            let english = AVSpeechSynthesisVoice.speechVoices().filter { $0.language.hasPrefix("en") }
            emit(["type": "voices", "voices": english.map { ["name": $0.name, "language": $0.language, "quality": $0.quality.rawValue] }])
        default:
            emit(["type": "error", "message": "unknown command"])
        }
    }

    func authorize() {
        SFSpeechRecognizer.requestAuthorization { status in
            AVCaptureDevice.requestAccess(for: .audio) { mic in
                let words: String
                switch status {
                case .authorized: words = "authorized"
                case .denied: words = "denied"
                case .restricted: words = "restricted"
                default: words = "not-determined"
                }
                emit(["type": "authorized", "speech": words, "mic": mic, "onDevice": self.listener.onDevice])
            }
        }
    }
}

let arguments = CommandLine.arguments
guard arguments.count > 1, arguments[1] == "serve" else {
    FileHandle.standardError.write("usage: keeper-voice serve\n".data(using: .utf8)!)
    exit(2)
}

let helper = Helper()
emit(["type": "ready", "onDevice": helper.listener.onDevice])

// stdin on a background thread, every command handled on the main run loop.
Thread.detachNewThread {
    while let line = readLine() {
        guard let data = line.data(using: .utf8), let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }
        DispatchQueue.main.async { helper.handle(object) }
    }
    // The app closed our stdin: it has quit, so do we.
    exit(0)
}
RunLoop.main.run()
