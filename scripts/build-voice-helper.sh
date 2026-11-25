#!/usr/bin/env bash
# Builds native/voice (Swift) into the Tauri sidecar src-tauri/binaries/umoja-voice-<triple>.
# The Info.plist is linked INTO the binary (__TEXT,__info_plist): macOS reads the privacy
# usage strings from there, so the helper may ask for the microphone and speech recognition.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
arch="$(uname -m)"
case "$arch" in
  arm64) triple="aarch64-apple-darwin" ;;
  x86_64) triple="x86_64-apple-darwin" ;;
  *) echo "unsupported architecture: $arch" >&2; exit 1 ;;
esac
out="$root/src-tauri/binaries/umoja-voice-$triple"
mkdir -p "$(dirname "$out")"
swiftc -O -target "${arch/arm64/arm64}-apple-macos13.0" \
  -Xlinker -sectcreate -Xlinker __TEXT -Xlinker __info_plist -Xlinker "$root/native/voice/Info.plist" \
  "$root/native/voice/main.swift" -o "$out"
codesign --force --sign - --identifier com.umojaark.desk.voice "$out"
echo "built $out"
