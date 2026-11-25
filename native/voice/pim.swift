// keeper-voice PIM: the person's calendar (EventKit) and contacts (Contacts framework), read
// on this Mac only and handed to Keeper's core, never sent anywhere.
//
// Request/response: every command carries an "id" and is answered by ONE event with that id.
//   stdin  {"cmd":"pim-access","id":"…"} {"cmd":"pim-request","id":"…"}
//          {"cmd":"events","from":"<RFC 3339>","to":"<RFC 3339>","id":"…"}
//          {"cmd":"event-create","title":"…","start":"…","end":"…","id":"…"}
//          {"cmd":"contacts","name":"…","limit":10,"id":"…"}
//   stdout {"type":"pim","id":"…","ok":true,"calendar":"allowed","contacts":"notasked"}
//          {"type":"pim","id":"…","ok":true,"events":[{title,start,end,allDay,location,calendar}]}
//          {"type":"pim","id":"…","ok":true,"event":{…}} {"type":"pim","id":"…","ok":true,"contacts":[{name,phones,emails,birthday}]}
//          {"type":"pim","id":"…","ok":false,"error":"…"}
// Access words: "allowed", "denied", "notasked" (write-only calendar access reads as "denied").

import Contacts
import EventKit
import Foundation

final class Pim {
    static let commands: Set<String> = ["pim-access", "pim-request", "events", "event-create", "contacts"]
    private let events = EKEventStore()
    private let people = CNContactStore()
    /// Reads run off the main thread; replies go back through the main thread (one writer).
    private let work = DispatchQueue(label: "keeper.pim", qos: .userInitiated)
    private let maxTitle = 200
    private let maxName = 100
    private let maxContacts = 50

    func handle(_ command: [String: Any]) {
        let id = command["id"] as? String ?? ""
        let reply: ([String: Any]) -> Void = { body in
            var event = body
            event["type"] = "pim"
            event["id"] = id
            DispatchQueue.main.async { emit(event) }
        }
        let fail: (String) -> Void = { reply(["ok": false, "error": $0]) }
        switch command["cmd"] as? String ?? "" {
        case "pim-access":
            reply(["ok": true, "calendar": calendarAccess(), "contacts": contactsAccess()])
        case "pim-request":
            requestAccess { calendar, contacts in reply(["ok": true, "calendar": calendar, "contacts": contacts]) }
        case "events":
            guard let from = parseTime(command["from"]), let to = parseTime(command["to"]), to > from else { return fail("Those times aren't dates I can read.") }
            guard calendarAccess() == "allowed" else { return fail("Keeper isn't allowed to read your calendar. Allow it in System Settings, Privacy & Security, Calendars.") }
            work.async { reply(["ok": true, "events": self.readEvents(from: from, to: to)]) }
        case "event-create":
            let title = (command["title"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !title.isEmpty, title.count <= maxTitle else { return fail("An event needs a title of up to \(maxTitle) characters.") }
            guard let start = parseTime(command["start"]), let end = parseTime(command["end"]), end > start else { return fail("The end has to come after the start.") }
            guard calendarAccess() == "allowed" else { return fail("Keeper isn't allowed to add to your calendar. Allow it in System Settings, Privacy & Security, Calendars.") }
            work.async {
                do { reply(["ok": true, "event": try self.createEvent(title: title, start: start, end: end)]) } catch { fail("The event could not be saved: \(error.localizedDescription)") }
            }
        case "contacts":
            let name = (command["name"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !name.isEmpty, name.count <= maxName else { return fail("Tell me whose name to look for.") }
            let limit = min(max(command["limit"] as? Int ?? 10, 1), maxContacts)
            guard contactsAccess() == "allowed" else { return fail("Keeper isn't allowed to read your contacts. Allow it in System Settings, Privacy & Security, Contacts.") }
            work.async {
                do { reply(["ok": true, "contacts": try self.findContacts(name: name, limit: limit)]) } catch { fail("Your contacts could not be read: \(error.localizedDescription)") }
            }
        default:
            fail("unknown command")
        }
    }

    // MARK: access

    func calendarAccess() -> String {
        let status = EKEventStore.authorizationStatus(for: .event)
        if #available(macOS 14.0, *) {
            switch status {
            case .fullAccess: return "allowed"
            case .notDetermined: return "notasked"
            default: return "denied"  // denied, restricted, write-only (we need to read)
            }
        }
        switch status {
        case .authorized: return "allowed"
        case .notDetermined: return "notasked"
        default: return "denied"
        }
    }

    func contactsAccess() -> String {
        switch CNContactStore.authorizationStatus(for: .contacts) {
        case .authorized: return "allowed"
        case .notDetermined: return "notasked"
        default: return "denied"
        }
    }

    /// Calendar first (full access on macOS 14+), then contacts; answers once both are settled.
    private func requestAccess(_ done: @escaping (String, String) -> Void) {
        let afterCalendar: () -> Void = {
            self.people.requestAccess(for: .contacts) { _, _ in done(self.calendarAccess(), self.contactsAccess()) }
        }
        if #available(macOS 14.0, *) {
            events.requestFullAccessToEvents { _, _ in afterCalendar() }
        } else {
            events.requestAccess(to: .event) { _, _ in afterCalendar() }
        }
    }

    // MARK: calendar

    private func readEvents(from: Date, to: Date) -> [[String: Any]] {
        let predicate = events.predicateForEvents(withStart: from, end: to, calendars: nil)
        return events.events(matching: predicate).sorted { $0.startDate < $1.startDate }.map(describe)
    }

    private func createEvent(title: String, start: Date, end: Date) throws -> [String: Any] {
        guard let calendar = events.defaultCalendarForNewEvents else {
            throw NSError(domain: "keeper.pim", code: 1, userInfo: [NSLocalizedDescriptionKey: "there is no default calendar"])
        }
        let event = EKEvent(eventStore: events)
        event.title = title
        event.startDate = start
        event.endDate = end
        event.calendar = calendar
        try events.save(event, span: .thisEvent, commit: true)
        return describe(event)
    }

    private func describe(_ e: EKEvent) -> [String: Any] {
        ["title": e.title ?? "", "start": formatTime(e.startDate), "end": formatTime(e.endDate), "allDay": e.isAllDay, "location": e.location ?? "", "calendar": e.calendar?.title ?? ""]
    }

    // MARK: contacts

    private func findContacts(name: String, limit: Int) throws -> [[String: Any]] {
        let keys: [CNKeyDescriptor] = [
            CNContactFormatter.descriptorForRequiredKeys(for: .fullName),
            CNContactOrganizationNameKey as CNKeyDescriptor,
            CNContactPhoneNumbersKey as CNKeyDescriptor,
            CNContactEmailAddressesKey as CNKeyDescriptor,
            CNContactBirthdayKey as CNKeyDescriptor,
        ]
        let found = try people.unifiedContacts(matching: CNContact.predicateForContacts(matchingName: name), keysToFetch: keys)
        return found.prefix(limit).map { c in
            let full = CNContactFormatter.string(from: c, style: .fullName) ?? ""
            return [
                "name": full.isEmpty ? c.organizationName : full,
                "phones": c.phoneNumbers.map { $0.value.stringValue },
                "emails": c.emailAddresses.map { $0.value as String },
                "birthday": birthday(c.birthday),
            ]
        }
    }

    /// "1990-04-12", or "--04-12" when the year is not recorded (ISO 8601 without a year).
    private func birthday(_ parts: DateComponents?) -> String {
        guard let parts, let month = parts.month, let day = parts.day else { return "" }
        let md = String(format: "%02d-%02d", month, day)
        if let year = parts.year, year != NSDateComponentUndefined { return String(format: "%04d-", year) + md }
        return "--" + md
    }

    // MARK: time

    private func parseTime(_ value: Any?) -> Date? {
        guard let text = value as? String, text.count <= 40 else { return nil }
        let plain = ISO8601DateFormatter()
        if let d = plain.date(from: text) { return d }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: text)
    }

    private func formatTime(_ date: Date?) -> String {
        guard let date else { return "" }
        return ISO8601DateFormatter().string(from: date)
    }
}
