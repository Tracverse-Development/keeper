#!/usr/bin/env bash
# Builds native/voice (Swift: main.swift + pim.swift) into the Tauri sidecar src-tauri/binaries/keeper-voice-<triple>.
# The Info.plist is linked INTO the binary (__TEXT,__info_plist): macOS reads the privacy
# usage strings from there, so the helper may ask for the microphone, speech recognition,
# the calendar and contacts.
#
#   bash scripts/build-voice-helper.sh                       # this Mac's architecture
#   bash scripts/build-voice-helper.sh x86_64-apple-darwin   # cross-build for Intel (or aarch64-apple-darwin)
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
triple="${1:-}"
if [ -z "$triple" ]; then
  case "$(uname -m)" in
    arm64) triple="aarch64-apple-darwin" ;;
    x86_64) triple="x86_64-apple-darwin" ;;
    *) echo "unsupported architecture: $(uname -m)" >&2; exit 1 ;;
  esac
fi
case "$triple" in
  aarch64-apple-darwin) swift_arch="arm64" ;;
  x86_64-apple-darwin) swift_arch="x86_64" ;;
  *) echo "unsupported target: $triple (the voice helper is macOS-only)" >&2; exit 1 ;;
esac
out="$root/src-tauri/binaries/keeper-voice-$triple"
mkdir -p "$(dirname "$out")"
swiftc -O -target "$swift_arch-apple-macos13.0" \
  -Xlinker -sectcreate -Xlinker __TEXT -Xlinker __info_plist -Xlinker "$root/native/voice/Info.plist" \
  "$root"/native/voice/*.swift -o "$out"
codesign --force --sign - --identifier com.umojaark.desk.voice "$out"
echo "built $out"
