//! Keeper's browser: real web pages inside Keeper's own window, in the Stage area beside the
//! keeper (docs/design/keeper-browser.md). One child webview of the main window, labelled
//! `BROWSER`, made on the first page and reused; the window draws the toolbar and tells the core
//! where the page goes (`browser_place`), so the page sits exactly in the window's frame for it.
//!
//! Safety: only http(s) pages are ever loaded or navigated to (`on_navigation` refuses anything
//! else: file:, javascript:, custom schemes); a remote page has no way to call Keeper (the app's
//! capability grants its commands only to its own pages, never to remote origins). The webview
//! wears Safari's user agent, so sites (Google's sign-in among them) treat it as the Mac's browser.
//!
//! Every change is told to the window as `browser://state` (`BrowserState`): open or not, and the
//! page's address.

pub mod commands;

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Url, WebviewBuilder, WebviewUrl};

use crate::kernel::{DeskError, Result};

/// The browser's webview label (one per app).
pub const BROWSER: &str = "keeper-browser";
/// Safari on macOS, so sites treat Keeper's browser as the Mac's own browser.
const SAFARI: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

/// What the window shows of the browser.
#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserState {
    pub open: bool,
    pub url: String,
}

/// Where the page goes in the window (logical pixels from the window's top left), as the window
/// last reported it; until it does, a guess beside the keeper.
static PLACE: Mutex<Option<(f64, f64, f64, f64)>> = Mutex::new(None);

/// An http(s) address for a page, or why not: a bare domain gets https ("gmail.com").
pub fn web_url(raw: &str) -> Result<Url> {
    let address = crate::sdk::packs::desktop::normalise_url(raw).ok_or_else(|| DeskError::Invalid("That isn't a web address I can open.".into()))?;
    Url::parse(&address).map_err(|_| DeskError::Invalid("That isn't a web address I can open.".into()))
}

/// Only http(s) pages may load in the browser.
pub fn allowed(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https")
}

/// Opens `raw` in Keeper's browser: the page it already shows navigates there, or the browser is
/// made beside the keeper. The window is told (`browser://state`) and draws the toolbar.
pub fn open(app: &AppHandle, raw: &str) -> Result<BrowserState> {
    let url = web_url(raw)?;
    if let Some(view) = app.get_webview(BROWSER) {
        view.navigate(url.clone()).map_err(|e| DeskError::Io(format!("The page didn't open: {e}")))?;
        let _ = view.show();
        return Ok(tell(app, true, url.as_str()));
    }
    let window = app.get_window("main").ok_or_else(|| DeskError::Io("Keeper's window isn't open.".into()))?;
    let (x, y, w, h) = place_or_guess(&window);
    let handle = app.clone();
    let builder = WebviewBuilder::new(BROWSER, WebviewUrl::External(url.clone()))
        .user_agent(SAFARI)
        .on_navigation(allowed)
        .on_page_load(move |view, _| {
            if let Ok(now) = view.url() {
                tell(&handle, true, now.as_str());
            }
        });
    window.add_child(builder, LogicalPosition::new(x, y), LogicalSize::new(w, h)).map_err(|e| DeskError::Io(format!("Keeper's browser didn't open: {e}")))?;
    Ok(tell(app, true, url.as_str()))
}

/// The window's frame for the page moved or changed size (logical pixels). Zero size hides it.
pub fn place(app: &AppHandle, x: f64, y: f64, w: f64, h: f64) -> Result<()> {
    *PLACE.lock().map_err(|_| DeskError::Io("browser place".into()))? = Some((x, y, w, h));
    if let Some(view) = app.get_webview(BROWSER) {
        if w < 1.0 || h < 1.0 {
            let _ = view.hide();
        } else {
            let _ = view.set_position(LogicalPosition::new(x, y));
            let _ = view.set_size(LogicalSize::new(w, h));
            let _ = view.show();
        }
    }
    Ok(())
}

/// Back, forward or reload in the page's own history.
pub fn go(app: &AppHandle, how: &str) -> Result<()> {
    let script = match how {
        "back" => "history.back()",
        "forward" => "history.forward()",
        "reload" => "location.reload()",
        _ => return Err(DeskError::Invalid("That isn't a way to move in the browser.".into())),
    };
    let view = app.get_webview(BROWSER).ok_or_else(|| DeskError::Invalid("No page is open.".into()))?;
    view.eval(script).map_err(|e| DeskError::Io(format!("The browser didn't answer: {e}")))
}

/// Closes the browser (the next page makes a fresh one).
pub fn close(app: &AppHandle) -> Result<BrowserState> {
    if let Some(view) = app.get_webview(BROWSER) {
        let _ = view.close();
    }
    Ok(tell(app, false, ""))
}

/// What the browser shows now.
pub fn state(app: &AppHandle) -> BrowserState {
    match app.get_webview(BROWSER).and_then(|v| v.url().ok()) {
        Some(url) => BrowserState { open: true, url: url.to_string() },
        None => BrowserState::default(),
    }
}

fn tell(app: &AppHandle, open: bool, url: &str) -> BrowserState {
    let state = BrowserState { open, url: url.to_string() };
    let _ = app.emit(crate::kernel::events::BROWSER_STATE, &state);
    state
}

/// The last place the window reported, or the Stage area's usual place: the right 60% of the
/// window under the top bar.
fn place_or_guess(window: &tauri::Window) -> (f64, f64, f64, f64) {
    if let Some(p) = PLACE.lock().ok().and_then(|p| *p) {
        return p;
    }
    let scale = window.scale_factor().unwrap_or(1.0);
    let size = window.inner_size().map(|s| s.to_logical::<f64>(scale)).unwrap_or(tauri::LogicalSize::new(1200.0, 800.0));
    let left = size.width * 0.4;
    (left, 110.0, size.width - left - 18.0, size.height - 130.0)
}

#[cfg(test)]
mod tests {
    #[test]
    fn only_web_pages_open() {
        assert_eq!(super::web_url("gmail.com").unwrap().as_str(), "https://gmail.com/");
        assert!(super::web_url("https://mail.google.com/mail/u/0/").is_ok());
        for bad in ["file:///etc/passwd", "javascript:alert(1)", "", "keeper://x"] {
            assert!(super::web_url(bad).is_err(), "{bad}");
        }
        assert!(!super::allowed(&tauri::Url::parse("file:///etc/passwd").unwrap()));
        assert!(!super::allowed(&tauri::Url::parse("javascript:alert(1)").unwrap()));
        assert!(super::allowed(&tauri::Url::parse("https://example.com").unwrap()));
    }
}
