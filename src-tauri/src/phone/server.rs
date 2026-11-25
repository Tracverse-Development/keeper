//! The phone link's request loop (tiny_http, one thread). Routes:
//!   GET  /            the chat page (holds no data; the token stays in the URL fragment)
//!   GET  /api/hello   who the assistant is            (token required)
//!   POST /api/turn    {"text": "..."} → the reply     (token required, 4 KB body, 20 turns a minute)

use std::collections::VecDeque;
use std::io::Read;
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};
use tiny_http::{Header, Method, Request, Response};

use crate::kernel::events;
use crate::state::AppState;

const PAGE: &str = include_str!("page.html");
const MAX_BODY: u64 = 4096;
const TURNS_PER_MINUTE: usize = 20;

/// Compare without leaking how many leading characters matched.
pub fn same_token(given: &str, expected: &str) -> bool {
    given.len() == expected.len() && given.bytes().zip(expected.bytes()).fold(0u8, |acc, (a, b)| acc | (a ^ b)) == 0
}

fn header(name: &str, value: &str) -> Header {
    Header::from_bytes(name.as_bytes(), value.as_bytes()).expect("static header")
}

fn send(req: Request, status: u16, content_type: &str, body: String) {
    let res = Response::from_string(body)
        .with_status_code(status)
        .with_header(header("Content-Type", content_type))
        .with_header(header("Cache-Control", "no-store"))
        .with_header(header("X-Frame-Options", "DENY"))
        .with_header(header("X-Content-Type-Options", "nosniff"))
        .with_header(header("Content-Security-Policy", "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'"));
    let _ = req.respond(res);
}

fn json_reply(req: Request, status: u16, value: serde_json::Value) {
    send(req, status, "application/json", value.to_string());
}

fn authorised(req: &Request, token: &str) -> bool {
    req.headers()
        .iter()
        .find(|h| h.field.equiv("Authorization"))
        .and_then(|h| h.value.as_str().strip_prefix("Bearer "))
        .is_some_and(|given| same_token(given, token))
}

pub fn spawn(server: Arc<tiny_http::Server>, token: String, app: AppHandle) {
    std::thread::spawn(move || {
        let mut recent: VecDeque<Instant> = VecDeque::new();
        for mut req in server.incoming_requests() {
            let path = req.url().split('?').next().unwrap_or("/").to_string();
            match (req.method().clone(), path.as_str()) {
                (Method::Get, "/") => send(req, 200, "text/html; charset=utf-8", PAGE.to_string()),
                (_, p) if p.starts_with("/api/") && !authorised(&req, &token) => json_reply(req, 401, json!({ "error": "This link has expired. Scan the code on your Mac again." })),
                (Method::Get, "/api/hello") => {
                    let keeper = app.state::<AppState>().active_keeper().ok();
                    json_reply(req, 200, json!({ "name": keeper.as_ref().map(|k| k.name.as_str()).unwrap_or("Keeper"), "graph": keeper.as_ref().map(|k| k.graph_id.as_str()).unwrap_or("") }));
                }
                (Method::Post, "/api/turn") => {
                    recent.retain(|t| t.elapsed() < Duration::from_secs(60));
                    if recent.len() >= TURNS_PER_MINUTE {
                        json_reply(req, 429, json!({ "error": "Slow down a little, then try again." }));
                        continue;
                    }
                    recent.push_back(Instant::now());
                    let mut body = String::new();
                    if req.as_reader().take(MAX_BODY).read_to_string(&mut body).is_err() {
                        json_reply(req, 400, json!({ "error": "That message could not be read." }));
                        continue;
                    }
                    let body: serde_json::Value = serde_json::from_str(&body).unwrap_or_default();
                    let text = body["text"].as_str().unwrap_or_default().to_string();
                    // Continue a chat the phone started (its id came back with the last reply).
                    let chat: String = body["chat"].as_str().unwrap_or_default().chars().filter(|c| c.is_ascii_hexdigit()).take(32).collect();
                    let state = app.state::<AppState>();
                    match tauri::async_runtime::block_on(crate::assistant::run_turn(&app, &state, "", &chat, &text)) {
                        Ok(result) => {
                            let _ = app.emit(events::PHONE_TURN, json!({ "said": text, "result": &result }));
                            json_reply(req, 200, json!({ "reply": result.reply, "mind": result.mind.label, "chat": result.chat, "panels": result.panels.len(), "timings": result.timings, "learned": result.learned.iter().map(|f| &f.text).collect::<Vec<_>>() }));
                        }
                        Err(e) => json_reply(req, 400, json!({ "error": e.to_string() })),
                    }
                }
                _ => json_reply(req, 404, json!({ "error": "not found" })),
            }
        }
    });
}

#[cfg(test)]
mod tests {
    #[test]
    fn token_comparison() {
        assert!(super::same_token("abc", "abc"));
        assert!(!super::same_token("abd", "abc"));
        assert!(!super::same_token("ab", "abc"));
    }
}
