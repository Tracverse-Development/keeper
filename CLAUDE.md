# Umoja Desk

A Tauri 2 personal assistant whose memory lives on the person's own OriginTrail DKG V10 node.
Part of the Umoja Ark family (brand: navy #151C33, gold #D39744, cream #F4EEE2).

- **Map first:** `ARCHITECTURE.md` says where everything lives. A new file goes where it says; a new module updates it in the same commit.
- **The DKG is the database.** Remember = write a Knowledge Asset (Working Memory, `alsoShareSwm: false`). Recall = a query in `memory/queries.rs`: bounded, one class, no person's words interpolated, proven on the real node (LES-001). Never publish to Verifiable Memory.
- **One seam each:** DKG calls only in `dkg/`, OS calls only in `platform/`, window↔core only through `src/kernel/ipc.ts`.
- **Fix memory:** grep `FIXLOG.md`, `KNOWN_ISSUES.md`, `LESSONS.md` before fixing; append after.
- **Checks:** `npm run check` (typecheck, TS tests including the structure guards, Rust tests). Build: `npm run app:build`.
- **Commits** carry what changed, why, what else it affects, the evidence, and `Directed-By:` / `Foreman-Origin:` trailers.
