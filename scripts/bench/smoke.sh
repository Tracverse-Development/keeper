#!/usr/bin/env bash
# Start an ISOLATED test Keeper (its own app folder under misc/, a Smoke keeper whose memory
# lives in a sub-graph of that copy's own home graph, updates off, no shortcut, not listening)
# and run smoke.py against it through its test link; then stop the test copy (only the process
# this script started). The real Keeper, its settings and its memory are never touched.
#   bash scripts/bench/smoke.sh        (BUILD=release for a release build; default debug)
#   bash scripts/bench/smoke.sh model  memory through a real mind (Claude Code, the quick model): learn,
#                                      recall by meaning, replace an old fact. Not part of the release gate.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
home="$root/misc/smoke-home"
rm -rf "$home" && mkdir -p "$home"
today="$(date +%Y-%m-%d)"
# The built-in mind: every step of the default run is an instant feature, so no model is ever
# called. `model` runs the memory steps through Claude Code on the quick model.
if [ "${1:-}" = model ]; then brain=claude; model=haiku; else brain=reflex; model=""; fi
cat > "$home/settings.json" <<JSON
{"setupComplete": true, "nodeHome": "$HOME/.dkg", "activeKeeper": "keeper-smoke",
 "keepers": [{"id": "keeper-smoke", "name": "Smoke", "skin": "robot", "role": "assistant", "soul": "steady", "graphId": "umoja-desk-smoke-$(date +%s)", "brain": "$brain", "model": "$model"}],
 "agentActions": false, "askBeforeActing": true, "visual": true, "fastModel": "", "quickReplies": false, "prefetchScenes": false,
 "alwaysListening": false, "talkShortcut": "", "autoUpdate": false, "lastBrief": "$today", "voice": "Samantha"}
JSON
mode="${BUILD:-debug}"
bin="$root/src-tauri/target/$mode/keeper"
(cd "$root/src-tauri" && if [ "$mode" = release ]; then cargo build --release -q; else cargo build -q; fi)
KEEPER_HOME="$home" KEEPER_TEST_LINK=1 KEEPER_SILENT=1 "$bin" > "$home/app.log" 2>&1 &
pid=$!
trap 'kill $pid 2>/dev/null || true' EXIT
for i in $(seq 1 80); do [ -s "$home/test-link.txt" ] && break; sleep 0.5; done
[ -s "$home/test-link.txt" ] || { echo "the test Keeper did not open its link"; tail -20 "$home/app.log"; exit 1; }
sleep 4   # the memory move into the sub-graph finishes at start
python3 "$root/scripts/bench/smoke.py" "$home" "${1:-}"
