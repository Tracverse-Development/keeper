//! "Remove Keeper from this Mac": stop what Keeper started and clear its folder, so deleting the
//! app leaves nothing running (the round-2 VM test found Keeper's DKG node still listening on the
//! network, with 547 MB of data, after the app was deleted).
//! - Keep my keepers and memories (default): stop the node Keeper installed and leave the data,
//!   so a reinstall finds every keeper and memory again.
//! - Otherwise: stop the node and delete Keeper's whole folder (settings, keys, its node and the
//!   memories on it). A node the person runs themselves is never stopped or deleted.
//! Keeper then quits; the person drags it from Applications to the Trash.

use tauri::AppHandle;

use crate::kernel::{paths, Result};

#[tauri::command]
pub async fn setup_remove(app: AppHandle, keep_memory: bool) -> Result<()> {
    crate::dkg::own_node::stop().await?;
    if !keep_memory {
        let home = paths::app_home();
        // Only ever Keeper's own folder (never the person's ~/.dkg or anything outside it).
        if home.ends_with("Keeper") || std::env::var_os("KEEPER_HOME").is_some() {
            std::fs::remove_dir_all(&home)?;
        }
    }
    app.exit(0);
    Ok(())
}
