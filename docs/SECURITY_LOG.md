# Security log

Append-only. `### YYYY-MM-DD — title` with **Where / Severity / Status** bullets.

### 2026-11-25 — Phone link exposes the assistant on the local network (by design, guarded)
- **Where:** `src-tauri/src/phone/` (tiny_http on the LAN address)
- **Severity:** Medium
- **Status:** Mitigated. Off by default; a fresh 256-bit token per start, carried in the URL fragment (never in a request line), compared in constant time; every `/api/*` route requires it; 4 KB body cap; 20 turns a minute; no-store, frame-deny and CSP headers; replies rendered as text only. Open: plain HTTP on the LAN (DESK-PHONE-TLS-001).

### 2026-11-25 — Agent engines can act on the computer when allowed
- **Where:** `src-tauri/src/brain/engines/` (claude, codex, gemini, hermes)
- **Severity:** Medium
- **Status:** Flagged (DESK-ACT-001). Off by default, explicit switch with a plain warning; chat turns disallow acting tools; every tool call is written to the DKG as a `desk:Action`.

### 2026-11-25 — ElevenLabs key handling
- **Where:** `src-tauri/src/voice/eleven.rs`, `platform/macos.rs`
- **Severity:** Low
- **Status:** Done. The key goes from the settings field straight to the login Keychain (security-framework, never argv or a file), is read per call, never returned to the window; only api.elevenlabs.io is called; voice ids are validated before they reach a URL.

### 2026-11-25 — Updater signing key
- **Where:** `~/.tauri/umoja-desk-updater.key`, backup in umoja-ark `/secure`
- **Severity:** High if lost or leaked
- **Status:** Done. Updates are verified against the public key in tauri.conf.json; the private key never enters the repo.
