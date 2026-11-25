//! The phone link: talk to the assistant from a phone on the same Wi-Fi. Off until the person
//! turns it on; turning it on starts a small HTTP server on this Mac's LAN address and shows a
//! QR code holding the address and a fresh random token (in the URL fragment, so it is never
//! sent in a request line). Every API call must carry that token; turning the link off or on
//! again invalidates it. Turns from the phone run the same pipeline and memory as the window.

mod server;

use std::net::{IpAddr, UdpSocket};
use std::sync::{Arc, Mutex};

use base64::Engine;
use serde::Serialize;
use tauri::{AppHandle, State};

use crate::kernel::{DeskError, Result};
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhoneStatus {
    pub on: bool,
    pub url: String,
    /// The QR code as an SVG data URI (drawn in brand navy on cream).
    pub qr: String,
}

struct Running {
    server: Arc<tiny_http::Server>,
    status: PhoneStatus,
}

#[derive(Default)]
pub struct PhoneLink {
    running: Mutex<Option<Running>>,
}

/// This Mac's address on the local network (no packet is sent: a UDP "connect" only picks a route).
fn lan_address() -> Option<IpAddr> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("192.0.2.1:9").ok()?;
    let ip = socket.local_addr().ok()?.ip();
    (!ip.is_loopback() && !ip.is_unspecified()).then_some(ip)
}

/// 32 random bytes, hex (from the OS generator).
fn fresh_token() -> Result<String> {
    let mut bytes = [0u8; 32];
    getrandom::getrandom(&mut bytes).map_err(|e| DeskError::Io(e.to_string()))?;
    Ok(hex::encode(bytes))
}

pub fn qr_data_uri(text: &str) -> Result<String> {
    use qrcode::render::svg;
    let code = qrcode::QrCode::new(text.as_bytes()).map_err(|e| DeskError::Io(e.to_string()))?;
    let image = code.render::<svg::Color>().min_dimensions(260, 260).dark_color(svg::Color("#151C33")).light_color(svg::Color("#F4EEE2")).build();
    Ok(format!("data:image/svg+xml;base64,{}", base64::engine::general_purpose::STANDARD.encode(image)))
}

impl PhoneLink {
    pub fn status(&self) -> PhoneStatus {
        self.running.lock().ok().and_then(|r| r.as_ref().map(|r| r.status.clone())).unwrap_or(PhoneStatus { on: false, url: String::new(), qr: String::new() })
    }

    pub fn start(&self, app: &AppHandle) -> Result<PhoneStatus> {
        self.stop();
        let ip = lan_address().ok_or_else(|| DeskError::Io("This Mac is not on a network right now.".into()))?;
        let server = Arc::new(tiny_http::Server::http((ip, 0)).map_err(|e| DeskError::Io(format!("The phone link could not start: {e}")))?);
        let port = server.server_addr().to_ip().map(|a| a.port()).unwrap_or(0);
        let token = fresh_token()?;
        let url = format!("http://{ip}:{port}/#t={token}");
        let status = PhoneStatus { on: true, qr: qr_data_uri(&url)?, url };
        server::spawn(server.clone(), token, app.clone());
        if let Ok(mut r) = self.running.lock() {
            *r = Some(Running { server, status: status.clone() });
        }
        Ok(status)
    }

    pub fn stop(&self) {
        if let Some(r) = self.running.lock().ok().and_then(|mut r| r.take()) {
            r.server.unblock();
        }
    }
}

#[tauri::command]
pub fn phone_status(state: State<'_, AppState>) -> PhoneStatus {
    state.phone.status()
}

#[tauri::command]
pub fn phone_start(app: AppHandle, state: State<'_, AppState>) -> Result<PhoneStatus> {
    state.phone.start(&app)
}

#[tauri::command]
pub fn phone_stop(state: State<'_, AppState>) -> PhoneStatus {
    state.phone.stop();
    state.phone.status()
}

#[cfg(test)]
mod tests {
    #[test]
    fn tokens_are_long_and_fresh() {
        let a = super::fresh_token().unwrap();
        assert_eq!(a.len(), 64);
        assert_ne!(a, super::fresh_token().unwrap());
    }

    #[test]
    fn the_qr_is_an_svg() {
        assert!(super::qr_data_uri("http://192.168.1.2:5000/#t=abc").unwrap().starts_with("data:image/svg+xml;base64,"));
    }
}
