//! The window's PIM commands: read calendar and contacts access, and ask for it (the
//! installer's Permissions step). Registered in `lib.rs` as `pim::commands::pim_access`
//! and `pim::commands::pim_request_access`.

use serde::Serialize;
use tauri::AppHandle;

use super::Access;

/// Calendar and contacts access, as the window sees it: `{ calendar, contacts }`.
#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
pub struct PimAccess {
    pub calendar: Access,
    pub contacts: Access,
}

impl From<(Access, Access)> for PimAccess {
    fn from((calendar, contacts): (Access, Access)) -> Self {
        PimAccess { calendar, contacts }
    }
}

#[tauri::command]
pub async fn pim_access(app: AppHandle) -> PimAccess {
    super::access(&app).await.into()
}

#[tauri::command]
pub async fn pim_request_access(app: AppHandle) -> PimAccess {
    super::request_access(&app).await.into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_window_sees_named_lowercase_fields() {
        let a: PimAccess = (Access::Allowed, Access::NotAsked).into();
        assert_eq!(serde_json::to_value(a).unwrap(), serde_json::json!({ "calendar": "allowed", "contacts": "notasked" }));
    }
}
