//! Playing a video or audio file from this computer inside Keeper, through Keeper's own
//! `keeper-media:` address (registered in `lib.rs`; the window builds the address with
//! `ipc.ts` `localMediaSrc`). Every request is checked here, whatever the window asked for: the
//! file must exist, resolve (links followed) inside one of the person's media folders
//! ([`FOLDERS`]) and have a video or audio extension. Nothing else on the computer can be read
//! this way, and the window's content policy lets only media elements load it (not `fetch`).
//!
//! Files are served in ranges (`Range: bytes=…`), as video players ask for them, so a long
//! movie is never read into memory whole.

use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use tauri::http::{header, Request, Response, StatusCode};

/// The address scheme the window loads local media from.
pub const SCHEME: &str = "keeper-media";

/// The folders in the person's home a local video or song may be played from.
pub const FOLDERS: &[&str] = &["Movies", "Downloads", "Desktop", "Documents", "Music"];

/// Video files the window's player plays (WebKit: MP4/QuickTime/WebM).
pub const VIDEO_EXTENSIONS: &[&str] = &["mp4", "m4v", "mov", "webm"];
/// Audio files the window's player plays.
pub const AUDIO_EXTENSIONS: &[&str] = &["mp3", "m4a", "aac", "wav", "aif", "aiff", "flac"];

/// The most bytes one range answer carries (a player asks again for the next part).
const MAX_CHUNK: u64 = 4 * 1024 * 1024;

fn extension(path: &Path) -> String {
    path.extension().and_then(|e| e.to_str()).map(str::to_ascii_lowercase).unwrap_or_default()
}

/// Is this a video file the player plays?
pub fn is_video(path: &Path) -> bool {
    VIDEO_EXTENSIONS.contains(&extension(path).as_str())
}

/// Is this a video or audio file the player plays?
pub fn is_media(path: &Path) -> bool {
    is_video(path) || AUDIO_EXTENSIONS.contains(&extension(path).as_str())
}

/// The content type a media file is served with (None for anything that is not media).
pub fn content_type(path: &Path) -> Option<&'static str> {
    Some(match extension(path).as_str() {
        "mp4" | "m4v" => "video/mp4",
        "mov" => "video/quicktime",
        "webm" => "video/webm",
        "mp3" => "audio/mpeg",
        "m4a" | "aac" => "audio/mp4",
        "wav" => "audio/wav",
        "aif" | "aiff" => "audio/aiff",
        "flac" => "audio/flac",
        _ => return None,
    })
}

/// Could a panel's path be a playable file? Text only, no file system (a panel read back from
/// memory may name a file that has since moved): an absolute path or `~/…` in a home folder,
/// no climbing out, a media extension. The real check is [`playable`], at play time.
pub fn plausible(path: &str) -> bool {
    let p = path.trim();
    (p.starts_with("~/") || p.starts_with("/Users/") || p.starts_with("/home/")) && !p.contains("..") && p.len() <= 500 && is_media(Path::new(p))
}

/// Is a resolved path inside one of the media folders of `home`, and a media file by name?
pub fn in_media_folders(real: &Path, home: &Path) -> bool {
    is_media(real) && FOLDERS.iter().any(|f| real.starts_with(home.join(f)))
}

/// The real file to play for a path (`~/…` or absolute), or None: it must exist, be a file and,
/// with links resolved, sit inside the person's media folders.
pub fn playable(path: &str) -> Option<PathBuf> {
    playable_in(path, &dirs::home_dir()?)
}

/// [`playable`] for the home folder `home` (tests use a scratch folder).
pub fn playable_in(path: &str, home: &Path) -> Option<PathBuf> {
    let home = home.canonicalize().ok()?;
    let p = path.trim();
    let full = match p.strip_prefix("~/") {
        Some(rest) => home.join(rest),
        None => PathBuf::from(p),
    };
    let real = full.canonicalize().ok()?;
    (real.is_file() && in_media_folders(&real, &home)).then_some(real)
}

/// Undo the window's `encodeURIComponent` on the address path (`%2FUsers%2F…` → `/Users/…`).
/// None for a broken escape or text that is not UTF-8.
pub fn percent_decode(raw: &str) -> Option<String> {
    let bytes = raw.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = raw.get(i + 1..i + 3)?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// The bytes a `Range` header asks for, as an inclusive `(first, last)` within a file of `len`
/// bytes, at most [`MAX_CHUNK`] long. No header: the start of the file. None: not satisfiable.
pub fn byte_range(header: Option<&str>, len: u64) -> Option<(u64, u64)> {
    if len == 0 {
        return None;
    }
    let chunk_end = |first: u64| (first + MAX_CHUNK - 1).min(len - 1);
    let Some(spec) = header else { return Some((0, chunk_end(0))) };
    let spec = spec.trim().strip_prefix("bytes=")?.split(',').next()?.trim();
    let (a, b) = spec.split_once('-')?;
    let (first, last) = match (a.trim(), b.trim()) {
        ("", suffix) => {
            let n: u64 = suffix.parse().ok()?;
            (len.saturating_sub(n.min(MAX_CHUNK)), len - 1)
        }
        (a, "") => (a.parse().ok()?, len - 1),
        (a, b) => (a.parse().ok()?, b.parse::<u64>().ok()?.min(len - 1)),
    };
    (first <= last && first < len).then(|| (first, last.min(chunk_end(first))))
}

fn status(code: StatusCode) -> Response<Vec<u8>> {
    Response::builder().status(code).body(Vec::new()).unwrap_or_default()
}

/// Answers one `keeper-media:` request: the asked-for part of a playable file, or 404/416.
/// Blocking (reads the disk): call it off the async runtime.
pub fn serve(request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    match dirs::home_dir() {
        Some(home) => serve_in(request, &home),
        None => status(StatusCode::NOT_FOUND),
    }
}

/// [`serve`] for the home folder `home`.
pub fn serve_in(request: &Request<Vec<u8>>, home: &Path) -> Response<Vec<u8>> {
    if request.method() != tauri::http::Method::GET {
        return status(StatusCode::METHOD_NOT_ALLOWED);
    }
    let asked = request.uri().path().trim_start_matches('/');
    let Some(file) = percent_decode(asked).and_then(|p| playable_in(&p, home)) else { return status(StatusCode::NOT_FOUND) };
    let (Some(kind), Ok(mut handle)) = (content_type(&file), std::fs::File::open(&file)) else { return status(StatusCode::NOT_FOUND) };
    let len = handle.metadata().map(|m| m.len()).unwrap_or(0);
    let range = request.headers().get(header::RANGE).and_then(|v| v.to_str().ok());
    let Some((first, last)) = byte_range(range, len) else {
        return Response::builder().status(StatusCode::RANGE_NOT_SATISFIABLE).header(header::CONTENT_RANGE, format!("bytes */{len}")).body(Vec::new()).unwrap_or_default();
    };
    let mut body = vec![0; (last - first + 1) as usize];
    if handle.seek(SeekFrom::Start(first)).and_then(|_| handle.read_exact(&mut body)).is_err() {
        return status(StatusCode::NOT_FOUND);
    }
    Response::builder()
        .status(StatusCode::PARTIAL_CONTENT)
        .header(header::CONTENT_TYPE, kind)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CONTENT_RANGE, format!("bytes {first}-{last}/{len}"))
        .header(header::CONTENT_LENGTH, body.len().to_string())
        .header(header::CACHE_CONTROL, "no-store")
        .body(body)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_media_files_inside_the_media_folders() {
        let home = Path::new("/Users/ada");
        assert!(in_media_folders(Path::new("/Users/ada/Movies/Holiday.mp4"), home));
        assert!(in_media_folders(Path::new("/Users/ada/Downloads/talk/part 1.MOV"), home));
        assert!(in_media_folders(Path::new("/Users/ada/Music/song.mp3"), home));
        assert!(!in_media_folders(Path::new("/Users/ada/Movies/notes.txt"), home), "not media");
        assert!(!in_media_folders(Path::new("/Users/ada/Library/secret.mp4"), home), "not a media folder");
        assert!(!in_media_folders(Path::new("/Users/ada/MoviesExtra/x.mp4"), home), "a lookalike folder");
        assert!(!in_media_folders(Path::new("/Users/bob/Movies/x.mp4"), home), "someone else's home");
    }

    #[test]
    fn a_panel_path_must_look_like_a_media_file_in_a_home() {
        assert!(plausible("~/Movies/Holiday.mp4"));
        assert!(plausible("/Users/ada/Desktop/clip.webm"));
        assert!(!plausible("/etc/passwd"));
        assert!(!plausible("~/Movies/../../etc/x.mp4"));
        assert!(!plausible("~/Movies/readme.txt"));
        assert!(!plausible("https://example.org/a.mp4"));
    }

    #[test]
    fn playable_refuses_what_is_not_there_or_not_in_a_media_folder() {
        assert!(playable("/etc/hosts").is_none());
        assert!(playable("~/Movies/definitely-not-here-123.mp4").is_none());
        assert!(playable("~/../../etc/hosts").is_none());
    }

    #[test]
    fn the_window_address_decodes_back_to_the_path() {
        assert_eq!(percent_decode("%2FUsers%2Fada%2FMovies%2FHoliday%20%C3%A9t%C3%A9.mp4").as_deref(), Some("/Users/ada/Movies/Holiday été.mp4"));
        assert_eq!(percent_decode("bad%2"), None);
        assert_eq!(percent_decode("bad%zz"), None);
    }

    #[test]
    fn ranges_are_clamped_and_bounded() {
        assert_eq!(byte_range(Some("bytes=0-1"), 100), Some((0, 1)));
        assert_eq!(byte_range(Some("bytes=10-"), 100), Some((10, 99)));
        assert_eq!(byte_range(Some("bytes=-10"), 100), Some((90, 99)));
        assert_eq!(byte_range(Some("bytes=50-500"), 100), Some((50, 99)));
        assert_eq!(byte_range(None, 100), Some((0, 99)));
        let big = 10 * MAX_CHUNK;
        assert_eq!(byte_range(Some("bytes=0-"), big), Some((0, MAX_CHUNK - 1)), "never more than one chunk");
        assert_eq!(byte_range(Some("bytes=200-"), 100), None, "past the end");
        assert_eq!(byte_range(Some("bytes=9-3"), 100), None);
        assert_eq!(byte_range(Some("items=0-1"), 100), None);
        assert_eq!(byte_range(Some("bytes=0-1"), 0), None);
    }

    #[test]
    fn only_media_types_are_served() {
        assert_eq!(content_type(Path::new("a.MP4")), Some("video/mp4"));
        assert_eq!(content_type(Path::new("a.m4a")), Some("audio/mp4"));
        assert_eq!(content_type(Path::new("a.html")), None);
    }

    #[test]
    fn serving_answers_a_range_of_a_real_file_and_nothing_else() {
        // A scratch home with made-up bytes (never played, never the person's own folders).
        let home = std::env::temp_dir().join(format!("keeper-media-test-{}", std::process::id()));
        std::fs::create_dir_all(home.join("Movies")).unwrap();
        std::fs::create_dir_all(home.join("Library")).unwrap();
        std::fs::write(home.join("Movies/Holiday 1.mp4"), b"0123456789").unwrap();
        std::fs::write(home.join("Movies/notes.txt"), b"secret").unwrap();
        std::fs::write(home.join("Library/hidden.mp4"), b"secret").unwrap();
        let address = |p: &Path| format!("keeper-media://localhost/{}", p.display().to_string().replace('/', "%2F").replace(' ', "%20"));
        let ask = |p: &Path, range: Option<&str>| {
            let mut r = Request::builder().method("GET").uri(address(p));
            if let Some(range) = range {
                r = r.header(header::RANGE, range);
            }
            serve_in(&r.body(Vec::new()).unwrap(), &home)
        };
        let got = ask(&home.join("Movies/Holiday 1.mp4"), Some("bytes=2-5"));
        assert_eq!(got.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(got.body().as_slice(), b"2345");
        assert_eq!(got.headers()[header::CONTENT_RANGE], "bytes 2-5/10");
        assert_eq!(got.headers()[header::CONTENT_TYPE], "video/mp4");
        assert_eq!(ask(&home.join("Movies/Holiday 1.mp4"), Some("bytes=20-")).status(), StatusCode::RANGE_NOT_SATISFIABLE);
        assert_eq!(ask(&home.join("Movies/notes.txt"), None).status(), StatusCode::NOT_FOUND, "a text file in Movies is not media");
        assert_eq!(ask(&home.join("Library/hidden.mp4"), None).status(), StatusCode::NOT_FOUND, "outside the media folders");
        assert_eq!(ask(&home.join("Movies/../Library/hidden.mp4"), None).status(), StatusCode::NOT_FOUND, "no climbing out");
        assert_eq!(ask(Path::new("/etc/hosts"), None).status(), StatusCode::NOT_FOUND);
        let _ = std::fs::remove_dir_all(&home);
    }
}
