# Releasing Keeper

Keeper updates itself from this repository's GitHub releases: every installed copy reads
`https://github.com/tracverse-development/keeper/releases/latest/download/latest.json`
(`plugins.updater.endpoints` in `src-tauri/tauri.conf.json`) and installs only bundles signed with the
updater key whose public half is `plugins.updater.pubkey`.

## Release a version (in-house: nothing is built on GitHub's runners)

Founder, 2026-11-25: every build and test runs in-house (this Mac, the tart VMs, DigitalOcean
droplets); GitHub CI runs only the basic Linux checks on push (`.github/workflows/check.yml`).

1. Raise the version in all three places, identically: `src-tauri/tauri.conf.json`, `package.json`,
   `src-tauri/Cargo.toml` (then `cargo check` so `Cargo.lock` follows). Commit and push to `main`.
   Before tagging, `scripts/release.sh` runs `scripts/proof.sh`: every memory test for real against this Mac's memory node, in a
   sub-graph (the shape real memory has), on scratch graphs. A failure, or no node, stops the release (FIX-0026: 0.10.0 shipped
   unable to read a keeper's level because no test ran in that shape).
2. Tag it: `git tag -a vX.Y.Z -m "Keeper vX.Y.Z" && git push origin vX.Y.Z` (`scripts/release.sh`
   checks the versions agree and the commit is on `origin/main` first).
3. On the build Mac, with the tag checked out: `bash scripts/release-mac.sh`. It builds Apple silicon and
   Intel (voice helper included), signs the updater archives with `~/.tauri/umoja-desk-updater.key`,
   creates the draft release if needed, uploads the `.dmg`, `.app.tar.gz` and `.sig` files, merges both
   Macs into the draft's `latest.json` (the `darwin-<arch>` and `darwin-<arch>-app` entries both name
   the new build), checks the platforms in `REQUIRE` are signed, and publishes.
4. Prove it: an installed older copy in a clean VM updates itself (round 10 did 0.6.2 → 0.7.0;
   `~/ForemanProjects/vm` holds tart and the VM driver scripts).

Linux and Windows: built in-house on a VM or droplet (Windows cross-built from Linux with
cargo-xwin) once that build host exists; until then a release carries the Mac builds, and Linux and
Windows copies stay on their last version (founder decision pending, docs/plans/ten-rounds.md).

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
