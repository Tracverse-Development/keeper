#!/usr/bin/env bash
# Builds a signed release and publishes it on GitHub, where installed copies find it
# (tauri.conf.json plugins.updater.endpoints → releases/latest/download/latest.json).
#
#   bash scripts/release.sh "What changed, in one line"
#
# Needs: the updater key at ~/.tauri/umoja-desk-updater.key (backup: umoja-ark /secure),
# and the Tracverse-Development GitHub sign-in in `gh` (used for this command only).
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
notes="${1:?usage: release.sh \"release notes\"}"
repo="tracverse-development/keeper"
key="$HOME/.tauri/umoja-desk-updater.key"
[ -f "$key" ] || { echo "missing $key (restore it from /secure)"; exit 1; }

version="$(python3 -c 'import json;print(json.load(open("src-tauri/tauri.conf.json"))["version"])')"
arch="$(uname -m | sed 's/arm64/aarch64/')"
echo "Releasing Keeper $version ($arch)"

# SKIP_BUILD=1 publishes the build already in src-tauri/target (made by this same command, then checked).
if [ "${SKIP_BUILD:-}" != "1" ]; then
  bash scripts/build-voice-helper.sh
  TAURI_SIGNING_PRIVATE_KEY="$(cat "$key")" TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" npx tauri build
fi
# The build must have produced the signed updater archive; never publish a half build (FIX-0008 in umoja-ark).
bundle="src-tauri/target/release/bundle"
app_tgz="$bundle/macos/Keeper.app.tar.gz"
[ -f "$app_tgz" ] && [ -f "$app_tgz.sig" ] || { echo "build did not produce a signed updater archive"; exit 1; }

out="$(mktemp -d)"
tgz_name="Keeper_${version}_${arch}.app.tar.gz"
dmg_name="Keeper_${version}_${arch}.dmg"
cp "$app_tgz" "$out/$tgz_name"
cp "$bundle/dmg/Keeper_${version}_${arch}.dmg" "$out/$dmg_name"
python3 - "$out" "$version" "$notes" "$repo" "$tgz_name" "$arch" "$(cat "$app_tgz.sig")" <<'PY'
import json, sys, datetime
out, version, notes, repo, tgz, arch, sig = sys.argv[1:]
manifest = {
    "version": version,
    "notes": notes,
    "pub_date": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "platforms": {f"darwin-{arch}": {"signature": sig, "url": f"https://github.com/{repo}/releases/download/v{version}/{tgz}"}},
}
json.dump(manifest, open(f"{out}/latest.json", "w"), indent=2)
PY
GH_TOKEN="$(gh auth token -u Tracverse-Development)" gh release create "v$version" --repo "$repo" --title "Keeper $version" --notes "$notes" \
  "$out/$dmg_name" "$out/$tgz_name" "$out/latest.json"
echo "Published v$version: https://github.com/$repo/releases/tag/v$version"
