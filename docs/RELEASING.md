# Releasing Keeper

Keeper updates itself from this repository's GitHub releases: every installed copy reads
`https://github.com/tracverse-development/keeper/releases/latest/download/latest.json`
(`plugins.updater.endpoints` in `src-tauri/tauri.conf.json`) and installs only bundles signed with the
updater key whose public half is `plugins.updater.pubkey`.

## Release a version

1. Raise the version in all three places, identically: `src-tauri/tauri.conf.json`, `package.json`,
   `src-tauri/Cargo.toml` (then `cargo check` so `Cargo.lock` follows). Commit and get it onto `main`.
2. From a clean checkout of that commit: `bash scripts/release.sh`.
   It bumps nothing; it refuses a dirty tree, versions that disagree, a tag that already exists, or a
   commit that is not on `origin/main`, then tags `vX.Y.Z` and pushes the tag.
3. The tag starts `.github/workflows/release.yml`:
   - **create-release** makes a draft release "Keeper vX.Y.Z" (the tag must equal the app version);
   - **build** (one job each: macOS Apple silicon, macOS Intel cross-built on the arm64 runner, Windows,
     Linux on Ubuntu 22.04) builds with `tauri-apps/tauri-action`, uploads the installers, their `.sig`
     files, and merges its platform into the release's `latest.json`;
   - **publish** checks `latest.json` has `darwin-aarch64`, `darwin-x86_64`, `windows-x86_64` and
     `linux-x86_64`, then publishes the release. Until then it is a draft, and installed copies never see a
     half release.

   A failed platform leaves the draft unpublished: fix, then re-run the failed jobs (Actions → the run →
   Re-run failed jobs). To rebuild an existing tag by hand: Actions → release → Run workflow → `vX.Y.Z`.

What each platform gets: macOS `Keeper_X.Y.Z_<arch>.dmg` (+ the `.app.tar.gz` updater archive), Windows
`Keeper_X.Y.Z_x64-setup.exe` (NSIS, also the updater bundle) and `Keeper_X.Y.Z_x64_en-US.msi`, Linux
`Keeper_X.Y.Z_amd64.AppImage` (also the updater bundle) and `.deb`.

### From this Mac only (the old path)

`LOCAL=1 bash scripts/release.sh "What changed"` builds the macOS bundle here and publishes a release
whose `latest.json` lists only this Mac's architecture. `SKIP_BUILD=1` publishes the build already in
`src-tauri/target`. Use it only when CI is unavailable: it replaces the feed with a macOS-only one.

## One-time setup: the signing secrets

CI signs the updater bundles with the same key as the local path. Set it once (run by a maintainer,
signed in to `gh` as Tracverse-Development):

```bash
export GH_TOKEN="$(gh auth token -u Tracverse-Development)"
gh secret set TAURI_SIGNING_PRIVATE_KEY --repo tracverse-development/keeper < ~/.tauri/umoja-desk-updater.key
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo tracverse-development/keeper --body ""
```

The key has no password, so the password secret is empty. The private key lives at
`~/.tauri/umoja-desk-updater.key`; its backup is in umoja-ark's `/secure` folder. Losing it means installed
copies can never update again (they trust only this key), so restore it from `/secure`, never make a new one.

## Configuration

`src-tauri/tauri.conf.json` is platform-neutral. Tauri merges the platform file on top when building:
`tauri.macos.conf.json` (targets `app` + `dmg`, the `keeper-voice` sidecar), `tauri.windows.conf.json`
(`nsis` + `msi`), `tauri.linux.conf.json` (`appimage` + `deb`). The voice helper is macOS-only, so only the
macOS file names it; `scripts/build-voice-helper.sh [<target triple>]` builds it before a macOS build.
