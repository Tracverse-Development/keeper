# Keeper's browser: the web inside Keeper, driven in front of you

Founder, 2026-11-28: "go to my Gmail account and tell me what emails are there… it opens the
Gmail account browser in front of you, inside of the Keeper application… filling out form
information on a website for them… asking them what password they need to enter… using their web
browser like in front of them."

## What the person gets

- **Browse inside Keeper.** "Open gmail.com", "look up flights to Port of Spain": the page opens in
  Keeper's own browser, in the Stage area beside the keeper, with Back, Forward, Reload, the
  address, Open in my browser and Close. The person can click and type in it like any browser.
- **The keeper reads the page.** "What emails are there?", "summarise this page", "which flight is
  cheapest?": the keeper reads the page's visible text (never hidden fields, never a password) and
  answers. Research opens its sources here too.
- **The keeper fills forms.** "Fill this in with my details": the keeper puts each value in its field
  (it shows which fields it filled, highlighted on the page). It never submits: the person checks
  and presses the page's own button, or says "submit it" and approves.
- **Passwords: asked, handed over, never kept.** When a page needs a password, the keeper asks for it
  in Keeper's own secure field and puts it straight into the page's password field. The password
  never reaches the keeper's mind (no AI ever sees it), is never written to memory, a log, a chat or
  the DKG, and is gone when the field is filled. (The person can always type it in the page
  themselves, or use macOS Passwords autofill.)

## How it is built (one seam each)

- `browser/` (core): one child webview of the main window (Tauri `unstable` multi-webview), placed
  over the Stage area the window reports; Safari's user agent; NO Keeper IPC for remote pages (the
  capability files only grant the app's own pages). Navigation, history and placement are commands.
- `platform/browser_macos.rs`: reading and filling through WebKit's own `evaluateJavaScript` with a
  completion handler (objc2-web-kit, already in the build through wry). Scripts are fixed text; any
  value reaches them as a JSON-encoded argument, never pasted into code.
- `sdk/packs/browser.rs`: abilities `browse` {url}, `read-page` {}, `fill-form` {fields},
  `submit-form` (Access::Change, approval), `ask-password` {field} (Keeper's own field → the page).
  The page's text reaches the mind fenced as MATERIAL (never instructions: a web page can be
  written to trick an AI).
- Window: `BrowserPane` (toolbar + the placed webview's frame) in the Stage area; the keeper and its
  captions stay beside it.

## Rules (security)

1. A remote page can never call Keeper (no IPC capability for remote origins).
2. Page text is material, fenced, never instructions; the keeper says when a page asked it to do
   something.
3. Passwords: only from Keeper's secure field into a `type=password` field of the page on screen;
   never to the mind, memory, logs or the phone link; the value is cleared after.
4. Nothing is submitted, sent, bought or deleted on a site without the person's own press or an
   approval for that one action (LES-006 in spirit).
5. Only http(s) pages; downloads go through macOS's usual prompts.

## Known limits

- Google may refuse sign-in in an embedded browser. Then Gmail is read through Apple Mail (where
  the person adds their Google account once), and the browser opens Gmail in their own browser.
- Sites that need a passkey or a security key work only in the person's own browser.

## Proof (each phase is done only when shown in the VM)

1. Browse: open a site inside Keeper, click, type, Back, Open in my browser, Close.
2. Read: "summarise this page" on a news page; research opens sources here.
3. Fill: a test form (a local page) filled, highlighted, not submitted; submit only on approval.
4. Password: the secure field fills a test page's password field; the value appears in no log, chat
   or memory (grep after).
5. YouTube: a video plays inside Keeper (already: the loopback player).
