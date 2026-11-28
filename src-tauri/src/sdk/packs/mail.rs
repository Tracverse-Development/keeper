//! Email: a keeper writes an email for the person and checks what came in, through the person's
//! own mail app. Writing never sends: `draft-email` opens the mail app with the email filled in
//! (a `mailto:` link, so it is whichever app they chose) and shows the words on the Stage; the
//! person reads it and presses Send themselves. `check-email` lists the unread messages in the
//! inbox (who, subject, when), never a message's words, after macOS has asked the person.

use std::sync::OnceLock;

use regex::Regex;

use super::super::{input, instant, Ability, Access, Done, Instant, MAC};
use crate::kernel::{DeskError, Result};
use crate::stage::Panel;

pub const ABILITIES: &[Ability] = &[
    Ability {
        id: "draft-email",
        how: "{\"to\": \"ann@example.com\", \"subject\": \"Dinner on Saturday\", \"body\": \"<the whole email>\"} opens the person's mail app with the email written, ready for them to read and send (it is NEVER sent by Keeper; \"to\" may be empty, several addresses separated by commas)",
        // Opens the mail app with words in it; sending is the person's own press.
        access: Access::Open,
        platforms: MAC, modes: &["assistant"], instant: Instant::No,
        run: |input, _| Box::pin(async move { draft_email(input) }),
    },
    Ability {
        id: "check-email",
        how: "{} lists the unread emails in the person's inbox: who sent each, its subject and when (never the words of a message)",
        access: Access::Personal,
        platforms: MAC, modes: &["assistant"], instant: Instant::Also(check_words),
        run: |_, _| Box::pin(check_email()),
    },
];

/// The most unread messages listed at once.
const SHOWN: usize = 12;
/// The most body a mail link carries (mail apps cut long links); longer bodies are refused.
const MAX_BODY: usize = 6000;

fn check_words(said: &str) -> Option<serde_json::Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    instant::whole(&R, r"(?i)^(?:(?:please\s+)?check\s+(?:my\s+)?(?:e-?mails?|inbox|mail)|(?:do\s+i\s+have|have\s+i\s+got|any)\s+(?:new\s+|unread\s+)?(?:e-?mails?|mail)|what'?s\s+(?:new\s+)?in\s+my\s+inbox|(?:show|read)\s+(?:me\s+)?my\s+(?:inbox|unread\s+(?:e-?mails?|mail)))[\s?.!]*$", said)
}

fn draft_email(input: &serde_json::Value) -> Result<Done> {
    let to: Vec<String> = input::optional(input, "to").map(|t| t.split([',', ';']).map(|a| a.trim().to_string()).filter(|a| !a.is_empty()).collect()).unwrap_or_default();
    if let Some(bad) = to.iter().find(|a| !is_address(a)) {
        return Err(DeskError::Invalid(format!("{bad} isn't an email address I can use.")));
    }
    let subject = input::optional(input, "subject").unwrap_or("");
    let body = input.get("body").and_then(|b| b.as_str()).unwrap_or("").trim();
    if subject.is_empty() && body.is_empty() {
        return Err(DeskError::Invalid("That needs a subject or some words for the email.".into()));
    }
    if body.chars().count() > MAX_BODY {
        return Err(DeskError::Invalid("That email is too long to open in your mail app from here; ask me to make it shorter.".into()));
    }
    crate::platform::compose_mail(&mailto(&to, subject, body))?;
    let who = if to.is_empty() { "an email".to_string() } else { format!("an email to {}", to.join(", ")) };
    let title = if subject.is_empty() { "Your email".to_string() } else { subject.to_string() };
    Ok(Done::said(format!("I opened {who} in your mail app. Read it over and press Send when it's right; I never send it myself.")).showing(Panel::Text { id: "email-draft".into(), title, body: body.to_string(), bullets: Vec::new() }))
}

async fn check_email() -> Result<Done> {
    let (total, rows) = crate::platform::unread_mail(SHOWN).await?;
    if total == 0 {
        return Ok(Done::answer("Your inbox has no unread emails."));
    }
    let first = rows.first().map(|r| format!(" The newest is from {}: \"{}\".", sender_name(&r.from), r.subject)).unwrap_or_default();
    let count = if total == 1 { "one unread email".to_string() } else { format!("{total} unread emails") };
    let table = Panel::Table {
        id: "inbox".into(),
        title: "Unread email".into(),
        caption: (total > rows.len()).then(|| format!("The newest {} of {total}.", rows.len())),
        columns: vec!["From".into(), "Subject".into(), "When".into()],
        rows: rows.iter().map(|r| vec![sender_name(&r.from).into(), r.subject.clone().into(), when(&r.received).into()]).collect(),
        highlight: Vec::new(),
    };
    Ok(Done::answer(format!("You have {count}.{first}")).showing(table))
}

/// A plain address: one `@`, a dot in the domain, no spaces and none of the characters that
/// would change a mail link (`?`, `&`, `,`, `<`, `>`).
pub fn is_address(a: &str) -> bool {
    let Some((user, domain)) = a.split_once('@') else { return false };
    !user.is_empty() && domain.contains('.') && !domain.starts_with('.') && !domain.ends_with('.') && a.len() <= 254 && !a.chars().any(|c| c.is_whitespace() || "?&,;<>\"'@".contains(c) && c != '@') && a.matches('@').count() == 1
}

/// The `mailto:` link for an email (RFC 6068): addresses joined by commas, subject and body
/// percent-encoded so the words stay words.
pub fn mailto(to: &[String], subject: &str, body: &str) -> String {
    let mut link = format!("mailto:{}", to.join(","));
    let mut fields = Vec::new();
    if !subject.is_empty() {
        fields.push(format!("subject={}", encode(subject)));
    }
    if !body.is_empty() {
        fields.push(format!("body={}", encode(&body.replace("\r\n", "\n").replace('\n', "\r\n"))));
    }
    if !fields.is_empty() {
        link.push('?');
        link.push_str(&fields.join("&"));
    }
    link
}

fn encode(text: &str) -> String {
    text.bytes().map(|b| if b.is_ascii_alphanumeric() || b"-_.~".contains(&b) { (b as char).to_string() } else { format!("%{b:02X}") }).collect()
}

/// "Ann Lee <ann@example.com>" → "Ann Lee"; a bare address stays as it is.
fn sender_name(from: &str) -> String {
    from.split('<').next().map(|n| n.trim().trim_matches('"')).filter(|n| !n.is_empty()).unwrap_or(from).to_string()
}

/// "2026-11-28T09:15:00" → "28 Nov 09:15" (as received, the Mac's own time).
fn when(iso: &str) -> String {
    chrono::NaiveDateTime::parse_from_str(iso, "%Y-%m-%dT%H:%M:%S").map(|t| t.format("%-d %b %H:%M").to_string()).unwrap_or_else(|_| iso.to_string())
}

#[cfg(test)]
mod tests {
    #[test]
    fn a_mail_link_keeps_the_words_as_words() {
        let link = super::mailto(&["ann@example.com".into()], "Dinner & drinks?", "Hi Ann,\nSaturday at 7?\n\nAmos");
        assert_eq!(link, "mailto:ann@example.com?subject=Dinner%20%26%20drinks%3F&body=Hi%20Ann%2C%0D%0ASaturday%20at%207%3F%0D%0A%0D%0AAmos");
        assert_eq!(super::mailto(&[], "Hello", ""), "mailto:?subject=Hello");
    }

    #[test]
    fn only_plain_addresses() {
        for ok in ["ann@example.com", "a.b-c+tag@mail.example.org"] {
            assert!(super::is_address(ok), "{ok}");
        }
        for bad in ["", "ann", "ann@", "@example.com", "ann@example", "ann @example.com", "ann@example.com?bcc=x@y.z", "a@b@c.com", "ann@example.com&body=x"] {
            assert!(!super::is_address(bad), "{bad}");
        }
    }

    #[test]
    fn inbox_rows_read_plainly() {
        assert_eq!(super::sender_name("\"Ann Lee\" <ann@example.com>"), "Ann Lee");
        assert_eq!(super::sender_name("bank@example.com"), "bank@example.com");
        assert_eq!(super::when("2026-11-28T09:15:00"), "28 Nov 09:15");
    }

    #[test]
    fn check_my_email_is_asked_in_whole_phrasings_only() {
        for said in ["check my email", "Check my inbox.", "any new emails?", "do I have new mail", "what's in my inbox", "show me my unread emails"] {
            assert!(super::check_words(said).is_some(), "{said}");
        }
        for not in ["email Ann about dinner", "check my email from Ann and reply", "write an email"] {
            assert!(super::check_words(not).is_none(), "{not}");
        }
    }
}
