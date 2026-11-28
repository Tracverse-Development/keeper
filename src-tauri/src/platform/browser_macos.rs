//! Running a script in Keeper's browser page and reading its answer (macOS: WebKit's own
//! `evaluateJavaScript:inFrame:inContentWorld:completionHandler:`). The script runs in the
//! default CLIENT world, isolated from the page's own scripts: a page cannot see, replace or
//! fake what Keeper reads or fills (it can still read its own fields, as any page can).
//!
//! The caller passes FIXED script text with any value already JSON-encoded into it
//! (`browser::scripts`); the answer is the script's string result (scripts return
//! `JSON.stringify(...)`).

use std::sync::{Arc, Mutex};
use std::time::Duration;

use block2::RcBlock;
use objc2::runtime::AnyObject;
use objc2::MainThreadMarker;
use objc2_foundation::{NSError, NSString};
use objc2_web_kit::{WKContentWorld, WKWebView};

use crate::kernel::{DeskError, Result};

/// A page that does not answer within this is treated as busy.
const ANSWER_WITHIN: Duration = Duration::from_secs(8);

type Answer = std::result::Result<String, String>;

/// Runs `script` in `view`'s page (isolated world) and returns its string answer.
pub async fn run_script(view: &tauri::Webview, script: String) -> Result<String> {
    let (tx, rx) = tokio::sync::oneshot::channel::<Answer>();
    let tx = Arc::new(Mutex::new(Some(tx)));
    view.with_webview(move |platform| {
        let send = tx.clone();
        let done = RcBlock::new(move |result: *mut AnyObject, error: *mut NSError| {
            // SAFETY: WebKit hands either a valid object or null for each, valid for this call.
            let answer: Answer = unsafe {
                if !error.is_null() {
                    Err((*error).localizedDescription().to_string())
                } else if result.is_null() {
                    Ok(String::new())
                } else {
                    Ok((*result).downcast_ref::<NSString>().map(|s| s.to_string()).unwrap_or_default())
                }
            };
            if let Some(sender) = send.lock().ok().and_then(|mut s| s.take()) {
                let _ = sender.send(answer);
            }
        });
        // SAFETY: `with_webview` runs this on the main thread with the live WKWebView.
        unsafe {
            let Some(mtm) = MainThreadMarker::new() else { return };
            let web: &WKWebView = &*(platform.inner() as *const WKWebView);
            let world = WKContentWorld::defaultClientWorld(mtm);
            web.evaluateJavaScript_inFrame_inContentWorld_completionHandler(&NSString::from_str(&script), None, &world, Some(&done));
        }
    })
    .map_err(|e| DeskError::Io(format!("Keeper's browser didn't answer: {e}")))?;
    match tokio::time::timeout(ANSWER_WITHIN, rx).await {
        Ok(Ok(Ok(text))) => Ok(text),
        Ok(Ok(Err(why))) => Err(DeskError::Io(format!("The page refused: {why}"))),
        _ => Err(DeskError::Io("The page didn't answer in time.".into())),
    }
}
