//! The person's own records on this computer: their calendar and contacts (through `pim`, read
//! and written here and never sent anywhere).

use super::super::{input, Ability, Access, Cx, Done, ALL};
use crate::kernel::Result;

pub const ABILITIES: &[Ability] = &[
    Ability {
        id: "add-event",
        how: "{\"title\": \"Dentist\", \"start\": \"2026-12-01T15:00:00-05:00\", \"end\": \"2026-12-01T16:00:00-05:00\"} puts an event on the person's calendar (RFC 3339 times with offset)",
        access: Access::Personal,
        platforms: ALL,
        run: |input, cx| Box::pin(add_event(input, cx)),
    },
    Ability {
        id: "find-contact",
        how: "{\"name\": \"Hannah\"} looks someone up in the person's contacts (phone numbers, emails)",
        access: Access::Personal,
        platforms: ALL,
        run: |input, cx| Box::pin(find_contact(input, cx)),
    },
];

/// The calendar validates the span (RFC 3339, end after start, at most a year).
async fn add_event(input: &serde_json::Value, cx: &Cx<'_>) -> Result<Done> {
    let event = crate::pim::create_event(cx.app, input::text(input, "title")?, input::text(input, "start")?, input::text(input, "end")?).await?;
    Ok(Done::said(format!("Added \"{}\" to your {} calendar.", event.title, event.calendar)))
}

async fn find_contact(input: &serde_json::Value, cx: &Cx<'_>) -> Result<Done> {
    let name = input::optional(input, "name").unwrap_or_default();
    let found = crate::pim::find_contacts(cx.app, name, 3).await?;
    if found.is_empty() {
        return Ok(Done::said(format!("I couldn't find {name} in your contacts.")));
    }
    Ok(Done::said(found.iter().map(|c| format!("{}: {}", c.name, c.phones.iter().chain(&c.emails).cloned().collect::<Vec<_>>().join(", "))).collect::<Vec<_>>().join("; ")))
}
