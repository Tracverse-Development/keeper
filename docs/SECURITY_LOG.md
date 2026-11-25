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

### 2026-11-25 — ElevenLabs key pasted in chat (accepted-risk class)
- **Where:** the owner's ElevenLabs key was pasted into the build session so it could be installed; it therefore exists in that session's transcript (and the Foreman prompt ledger). It was written only to the macOS Keychain, never to a file or the repo.
- **Severity:** Low
- **Status:** Noted; rotate the key at ElevenLabs at the owner's convenience and paste the new one in Settings → Voice.

### 2026-11-25 — Keys moved from the Keychain to Keeper's private store (supersedes the Keychain entry above)
- **Where:** `src-tauri/src/kernel/secrets.rs` (`~/Library/Application Support/Keeper/secrets.json`, 0600, atomic writes, cached in memory)
- **Severity:** Low (design change, recorded)
- **Status:** Done. Without a Developer ID, macOS ties Keychain access to each build's hash, so every update and every read prompted the owner. The private store has the trust boundary of per-user app config (FileVault at rest), works on every OS and never prompts. Revisit with a Developer ID (Keychain with a team-based designated requirement).

### 2026-11-25 — Panels people work in, and approve-before-acting (0.6)
- **Where:** `src-tauri/src/stage/cap.rs`, `assistant/approval.rs`, `assistant/actions.rs`, `src/stage/expression.ts`
- **Severity:** Medium (design review, recorded)
- **Status:** Done. Engines are untrusted writers: an `approval` or `facts` panel from an engine is dropped (only the core makes them, so a model cannot fake a plan the person "approved" or invent facts with working Forget buttons). Plans are kept in memory under a random 96-bit one-use token; `plan_decide` takes the plan by token, so the window cannot submit its own plan text. Panel actions are a closed, typed set; fact ids are checked as 16 hex characters before a retraction or pin is written. The what-if evaluator is a hand-written parser over numbers, the panel's own variable names and a fixed function list (never `eval`/`Function`; `constructor`, member access and brackets refused, tested). Remaining gap: DESK-APPROVAL-001.
