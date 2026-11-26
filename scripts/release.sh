#!/usr/bin/env bash
# Releases Keeper. Installed copies find new versions through the GitHub release feed
# (tauri.conf.json plugins.updater.endpoints → releases/latest/download/latest.json). See docs/RELEASING.md.
#
#   bash scripts/release.sh
#     The default: checks the working tree is clean and committed, that tauri.conf.json, package.json
#     and Cargo.toml carry the same version, then tags vX.Y.Z and pushes the tag. CI
#     (.github/workflows/release.yml) builds macOS, Windows and Linux and publishes the release.
#     Bumps nothing: raise the version in all three files and commit first.
#
#   LOCAL=1 bash scripts/release.sh "What changed, in one line"
#     The old path: builds and publishes from this Mac only (darwin-<arch> in latest.json).
#     Needs the updater key at ~/.tauri/umoja-desk-updater.key (backup: umoja-ark /secure).
#     SKIP_BUILD=1 publishes the build already in src-tauri/target.
#
# Both use the Tracverse-Development GitHub sign-in in `gh` (for this command only).
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
repo="tracverse-development/keeper"

version="$(python3 -c 'import json;print(json.load(open("src-tauri/tauri.conf.json"))["version"])')"

if [ "${LOCAL:-}" != "1" ]; then
  pkg_version="$(python3 -c 'import json;print(json.load(open("package.json"))["version"])')"
  cargo_version="$(python3 -c 'import re;t=open("src-tauri/Cargo.toml").read();print(re.search(r"^\[package\][^\[]*?^version\s*=\s*\"([^\"]+)\"",t,re.M|re.S).group(1))')"
  [ "$version" = "$pkg_version" ] && [ "$version" = "$cargo_version" ] || {
    echo "versions disagree: tauri.conf.json $version, package.json $pkg_version, Cargo.toml $cargo_version"; exit 1; }
  [ -z "$(git status --porcelain)" ] || { echo "the working tree is not clean; commit or set aside first:"; git status --short; exit 1; }
  tag="v$version"
  if git rev-parse -q --verify "refs/tags/$tag" > /dev/null; then echo "tag $tag already exists here"; exit 1; fi
  export GH_TOKEN="$(gh auth token -u Tracverse-Development)"
  if git ls-remote --exit-code --tags origin "refs/tags/$tag" > /dev/null 2>&1; then echo "tag $tag already exists on origin"; exit 1; fi
  # A release is made from code already on main, so the tag never carries an unreviewed commit.
  git fetch -q origin main
  git merge-base --is-ancestor HEAD origin/main || { echo "HEAD $(git rev-parse --short HEAD) is not on origin/main; push it to main first"; exit 1; }
  # A version is written in the changelog before it is tagged; its entry becomes the release notes.
  python3 scripts/changelog.py --check "$version"
  # Proven against real-shaped memory on this Mac's node before anything is tagged (FIX-0026).
  bash scripts/proof.sh
  # And the real app, end to end, as a test copy with its own memory (the window shows briefly).
  bash scripts/bench/smoke.sh
  echo "Tagging Keeper $version at $(git rev-parse --short HEAD) and pushing $tag (scripts/release-mac.sh builds and publishes it)"
  git tag -a "$tag" -m "Keeper $tag"
  git push origin "$tag"
  echo "Building: https://github.com/$repo/actions/workflows/release.yml"
  exit 0
fi

# LOCAL=1: build and publish from this Mac.
notes="${1:?usage: LOCAL=1 release.sh \"release notes\"}"
key="$HOME/.tauri/umoja-desk-updater.key"
[ -f "$key" ] || { echo "missing $key (restore it from /secure)"; exit 1; }

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
