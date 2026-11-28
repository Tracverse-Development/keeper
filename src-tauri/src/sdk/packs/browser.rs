//! Keeper's browser, for the mind: the page the person has open in Keeper reaches the mind as
//! material (`browser::page::material`, added by the turn), and these act on it in front of them.
//!
//!   fill-form     puts values in the page's fields by id (never a password field)
//!   press         presses a link or button by id; a button that sends, submits, pays, buys,
//!                 deletes or posts is NOT pressed: the person presses it themselves (nothing goes
//!                 out without their own press)
//!   ask-password  asks the person for a password in Keeper's own secure field; it goes straight
//!                 into the page's password field and never reaches the mind, memory or a log

use serde_json::json;
use tauri::Emitter;

use super::super::{input, Ability, Access, Done, Instant, MAC};
use crate::kernel::{DeskError, Result};

pub const ABILITIES: &[Ability] = &[
    Ability {
        id: "fill-form",
        how: "{\"fields\": {\"f1\": \"Amos\", \"f3\": \"amos@example.com\"}} fills fields of the page open in Keeper's browser, by the field ids the page material lists (never a password: use ask-password)",
        access: Access::Open,
        platforms: MAC, modes: &["assistant"], instant: Instant::No,
        run: |input, cx| Box::pin(fill_form(input, cx)),
    },
    Ability {
        id: "press",
        how: "{\"id\": \"p4\"} presses a link or button on the page open in Keeper's browser, by the id the page material lists (buttons that send, submit, pay or delete are left for the person to press)",
        access: Access::Open,
        platforms: MAC, modes: &["assistant"], instant: Instant::No,
        run: |input, cx| Box::pin(press(input, cx)),
    },
    Ability {
        id: "ask-password",
        how: "{\"field\": \"f2\"} asks the person for the password of that password field in Keeper's own secure box; it goes straight into the page (you never see it)",
        access: Access::Open,
        platforms: MAC, modes: &["assistant"], instant: Instant::No,
        run: |input, cx| Box::pin(ask_password(input, cx)),
    },
];

/// Words on a button that send something out or cannot be undone: the person presses those.
const THEIRS_TO_PRESS: &[&str] = &["send", "submit", "pay", "buy", "order", "purchase", "checkout", "check out", "delete", "remove", "post", "publish", "transfer", "confirm", "sign up", "subscribe", "place order", "donate", "book now"];

/// True when a button's words mean it sends, pays, buys, deletes or posts.
pub fn theirs_to_press(text: &str) -> bool {
    let lower = text.to_lowercase();
    THEIRS_TO_PRESS.iter().any(|w| lower.split(|c: char| !c.is_alphanumeric() && c != ' ').any(|part| part.trim() == *w || part.trim().starts_with(&format!("{w} "))) || lower.trim() == *w)
}

fn must_be_at_the_mac(cx: &super::super::Cx<'_>) -> Result<()> {
    if cx.at_the_mac {
        Ok(())
    } else {
        Err(DeskError::Invalid("Keeper's browser is on the Mac; ask me there.".into()))
    }
}

async fn fill_form(input: &serde_json::Value, cx: &super::super::Cx<'_>) -> Result<Done> {
    must_be_at_the_mac(cx)?;
    let values = input.get("fields").and_then(|f| f.as_object()).filter(|f| !f.is_empty()).ok_or_else(|| DeskError::Invalid("That needs the fields to fill.".into()))?;
    let page = crate::browser::page::read(cx.app).await?;
    // Never a password through here: a password field is the person's own (ask-password).
    if values.keys().any(|id| page.fields.iter().any(|f| &f.id == id && f.kind == "password")) {
        return Err(DeskError::Invalid("I don't put passwords in by filling; I'll ask you for it in Keeper's own box instead.".into()));
    }
    let filled = crate::browser::page::fill(cx.app, values).await?;
    let names: Vec<String> = filled.iter().filter_map(|id| page.fields.iter().find(|f| &f.id == id).map(|f| if f.label.is_empty() { id.clone() } else { f.label.clone() })).collect();
    Ok(Done::said(match names.len() {
        0 => "I couldn't find those fields on the page any more; ask me to look again.".to_string(),
        _ => format!("I filled in {}. Check them on the page (they're outlined); nothing is sent until you press the page's own button.", names.join(", ")),
    }))
}

async fn press(input: &serde_json::Value, cx: &super::super::Cx<'_>) -> Result<Done> {
    must_be_at_the_mac(cx)?;
    let id = input::text(input, "id")?;
    let page = crate::browser::page::read(cx.app).await?;
    let target = page.presses.iter().find(|p| p.id == id).ok_or_else(|| DeskError::Invalid("I can't find that on the page any more; ask me to look again.".into()))?;
    if !target.link && theirs_to_press(&target.text) {
        return Ok(Done::said(format!("\"{}\" sends or changes something, so that one is yours to press: it's on the page whenever you're ready.", target.text)));
    }
    crate::browser::page::press(cx.app, id).await?;
    Ok(Done::said(format!("Pressed \"{}\".", target.text)))
}

async fn ask_password(input: &serde_json::Value, cx: &super::super::Cx<'_>) -> Result<Done> {
    must_be_at_the_mac(cx)?;
    let field = input::text(input, "field")?;
    let page = crate::browser::page::read(cx.app).await?;
    let wanted = page.fields.iter().find(|f| f.id == field && f.kind == "password").ok_or_else(|| DeskError::Invalid("That isn't a password field on this page.".into()))?;
    let host = tauri::Url::parse(&page.url).ok().and_then(|u| u.host_str().map(str::to_string)).unwrap_or_default();
    let _ = cx.app.emit(crate::kernel::events::BROWSER_PASSWORD, json!({ "field": wanted.id, "label": wanted.label, "host": host }));
    Ok(Done::said(format!("Type your password for {host} in the box I opened; it goes straight into the page, and I never see it.")))
}

#[cfg(test)]
mod tests {
    #[test]
    fn buttons_that_send_or_pay_are_the_persons_to_press() {
        for theirs in ["Send", "Submit", "Pay now", "Place order", "Delete", "Confirm purchase", "Sign up", "Post"] {
            assert!(super::theirs_to_press(theirs), "{theirs}");
        }
        for mine in ["Next", "Compose", "Inbox", "Search", "Show more", "Sign in", "Continue"] {
            assert!(!super::theirs_to_press(mine), "{mine}");
        }
    }
}
