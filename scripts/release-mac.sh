#!/usr/bin/env bash
# The in-house half of a release: builds Keeper for macOS (Apple silicon and Intel) on THIS Mac,
# never on GitHub's runners (founder 2026-11-25: "all in-house"). It makes the tag's DRAFT release,
# adds both Mac builds and their updater entries to the draft's latest.json, checks every platform
# in REQUIRE is signed, and only then publishes, so installed copies never see half a release.
#
#   bash scripts/release-mac.sh            # the version in tauri.conf.json, tag vX.Y.Z
#   SKIP_BUILD=1 bash scripts/release-mac.sh   # publish builds already in src-tauri/target/<target>
#   NO_PUBLISH=1 ...                       # upload and merge, leave the draft unpublished
#
# Needs: the updater key at ~/.tauri/umoja-desk-updater.key (backup: umoja-ark /secure), both Rust
# targets (rustup target add x86_64-apple-darwin), and the Tracverse-Development sign-in in gh.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
repo="Tracverse-Development/keeper"
version="$(python3 -c 'import json;print(json.load(open("src-tauri/tauri.conf.json"))["version"])')"
tag="v$version"
key="$HOME/.tauri/umoja-desk-updater.key"
[ -f "$key" ] || { echo "missing $key (restore it from /secure)"; exit 1; }
export GH_TOKEN="$(gh auth token -u Tracverse-Development)"

# The build must be the tagged code.
[ "$(git rev-parse HEAD)" = "$(git rev-parse "$tag^{commit}" 2>/dev/null)" ] || { echo "HEAD is not $tag; check out the tag first"; exit 1; }
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "uncommitted changes; the build would not be $tag"; exit 1; }

out="$(mktemp -d)"
for target in aarch64-apple-darwin x86_64-apple-darwin; do
  arch="${target%%-*}"
  label="$([ "$arch" = aarch64 ] && echo aarch64 || echo x64)"
  bundle="src-tauri/target/$target/release/bundle"
  if [ "${SKIP_BUILD:-}" != "1" ]; then
    echo "== building $target"
    bash scripts/build-voice-helper.sh "$target"
    TAURI_SIGNING_PRIVATE_KEY="$(cat "$key")" TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" npx tauri build --target "$target"
  fi
  # Never publish a half build: the signed updater archive and the disk image must both exist.
  [ -f "$bundle/macos/Keeper.app.tar.gz" ] && [ -f "$bundle/macos/Keeper.app.tar.gz.sig" ] || { echo "$target: no signed updater archive"; exit 1; }
  dmg="$(ls "$bundle"/dmg/Keeper_"$version"_*.dmg | head -1)"
  [ -f "$dmg" ] || { echo "$target: no disk image"; exit 1; }
  cp "$bundle/macos/Keeper.app.tar.gz" "$out/Keeper_${version}_${label}.app.tar.gz"
  cp "$bundle/macos/Keeper.app.tar.gz.sig" "$out/Keeper_${version}_${label}.app.tar.gz.sig"
  cp "$dmg" "$out/Keeper_${version}_${label}.dmg"
  echo "darwin-$arch $label" >> "$out/platforms.txt"
done

# The draft for this tag: this script makes it (nothing is built on GitHub's runners any more).
if ! gh release view "$tag" -R "$repo" >/dev/null 2>&1; then
  gh release create "$tag" -R "$repo" --draft --verify-tag --title "Keeper $version" --notes "Keeper $version" >/dev/null
  echo "created the $tag draft"
fi
gh release download "$tag" -R "$repo" -p latest.json -D "$out" --clobber 2>/dev/null || echo '{"platforms":{}}' > "$out/latest.json"

python3 - "$out" "$version" "$repo" <<'PY'
import json, sys, datetime
out, version, repo = sys.argv[1:]
feed = json.load(open(f"{out}/latest.json"))
feed.setdefault("version", version)
feed.setdefault("notes", f"Keeper {version}")
feed.setdefault("pub_date", datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
for line in open(f"{out}/platforms.txt"):
    platform, label = line.split()
    tgz = f"Keeper_{version}_{label}.app.tar.gz"
    entry = {"signature": open(f"{out}/{tgz}.sig").read().strip(), "url": f"https://github.com/{repo}/releases/download/v{version}/{tgz}"}
    # The updater tries "<os>-<arch>-<installer>" before "<os>-<arch>": both must name THIS build,
    # or a stale entry's signature fails against the new file (0.6.2's Intel entry, 2026-11-25).
    feed["platforms"][platform] = entry
    feed["platforms"][f"{platform}-app"] = entry
json.dump(feed, open(f"{out}/latest.json", "w"), indent=2)
print("feed platforms:", ", ".join(sorted(feed["platforms"])))
PY

gh release upload "$tag" -R "$repo" --clobber "$out"/*.dmg "$out"/*.app.tar.gz "$out"/*.app.tar.gz.sig "$out/latest.json"

# The platforms this release must carry signed (default both Macs; add windows-x86_64 and
# linux-x86_64 once the in-house build host makes them): REQUIRE="..." to change.
for p in ${REQUIRE:-darwin-aarch64 darwin-x86_64}; do
  python3 -c "import json,sys;f=json.load(open('$out/latest.json'));sys.exit(0 if f['platforms'].get('$p',{}).get('signature') else 1)" || { echo "latest.json lacks $p; left as a draft"; exit 1; }
done
if [ "${NO_PUBLISH:-}" = "1" ]; then echo "uploaded; $tag left as a draft"; exit 0; fi
gh release edit "$tag" -R "$repo" --draft=false --title "Keeper $version" >/dev/null
echo "Published $tag: https://github.com/$repo/releases/tag/$tag"
