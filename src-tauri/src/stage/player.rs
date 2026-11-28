//! The YouTube player page, served from this Mac (127.0.0.1) so a video plays inside Keeper.
//!
//! YouTube's embedded player now refuses to play without the address of the page it sits in
//! ("Video player configuration error, Error 153"), and Keeper's window has its own app address
//! (`tauri://`) that a browser never sends. So the media panel loads a one-line page from this
//! small loopback server, and that page embeds YouTube's privacy-enhanced player: YouTube sees
//! `http://127.0.0.1:<port>`, a normal address, and plays. The server answers only
//! `GET /youtube/<video id>` (an id is 6 to 20 letters, digits, `-` or `_`), on the loopback
//! interface only, with nothing about the person in it.

use std::sync::OnceLock;

/// The player's address, `http://127.0.0.1:<port>`, starting the server the first time.
pub fn base() -> Option<String> {
    static BASE: OnceLock<Option<String>> = OnceLock::new();
    BASE.get_or_init(start).clone()
}

fn start() -> Option<String> {
    let server = tiny_http::Server::http("127.0.0.1:0").ok()?;
    let port = server.server_addr().to_ip()?.port();
    std::thread::spawn(move || {
        for request in server.incoming_requests() {
            let page = (request.method() == &tiny_http::Method::Get).then(|| page_for(request.url())).flatten();
            let response = match page {
                Some(html) => tiny_http::Response::from_string(html)
                    .with_header(header("Content-Type", "text/html; charset=utf-8"))
                    .with_header(header("Content-Security-Policy", "default-src 'none'; frame-src https://www.youtube-nocookie.com; style-src 'unsafe-inline'"))
                    .with_header(header("Referrer-Policy", "strict-origin-when-cross-origin")),
                None => tiny_http::Response::from_string("").with_status_code(404),
            };
            let _ = request.respond(response);
        }
    });
    Some(format!("http://127.0.0.1:{port}"))
}

fn header(name: &str, value: &str) -> tiny_http::Header {
    tiny_http::Header::from_bytes(name.as_bytes(), value.as_bytes()).expect("a fixed header is valid")
}

/// The page for `/youtube/<id>`, or None for anything else.
pub fn page_for(path: &str) -> Option<String> {
    let id = path.strip_prefix("/youtube/")?;
    let valid = (6..=20).contains(&id.len()) && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    valid.then(|| {
        format!(
            "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"referrer\" content=\"strict-origin-when-cross-origin\"><style>html,body{{margin:0;height:100%;background:#000;overflow:hidden}}iframe{{border:0;width:100%;height:100%}}</style></head><body><iframe src=\"https://www.youtube-nocookie.com/embed/{id}?autoplay=1&rel=0\" allow=\"autoplay; encrypted-media; picture-in-picture; fullscreen\" allowfullscreen></iframe></body></html>"
        )
    })
}

/// The player's address for the window (`http://127.0.0.1:<port>`).
#[tauri::command]
pub fn media_player_base() -> crate::kernel::Result<String> {
    base().ok_or_else(|| crate::kernel::DeskError::Io("The video player could not start.".into()))
}

#[cfg(test)]
mod tests {
    // FIX-0044: YouTube refused to play inside Keeper (Error 153: no page address).
    #[test]
    fn only_a_video_id_gets_a_page_and_it_embeds_the_privacy_enhanced_player() {
        let page = super::page_for("/youtube/lAmqsMQG3RM").unwrap();
        assert!(page.contains("https://www.youtube-nocookie.com/embed/lAmqsMQG3RM?autoplay=1"));
        for bad in ["/youtube/", "/youtube/abc", "/youtube/a\"><script>", "/youtube/../etc", "/other/lAmqsMQG3RM", "/youtube/lAmqsMQG3RM?x=1"] {
            assert!(super::page_for(bad).is_none(), "{bad}");
        }
    }

    #[test]
    fn the_server_answers_on_the_loopback_only() {
        let base = super::base().unwrap();
        assert!(base.starts_with("http://127.0.0.1:"));
    }
}
