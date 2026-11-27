#!/usr/bin/env bash
# Start an ISOLATED test Keeper (own app folder under misc/, a Bench keeper on the
# `umoja-desk-bench` DKG graph, auto-update off) with its test link, run bench.py against it,
# then stop the test instance (only the process this script started).
#   bash scripts/bench/run.sh [rounds]   (BUILD=release for a release build; default debug)
#   PROFILE=admin: a System Administrator keeper with acting on and ask-before-acting, the
#   first keeper every new person gets (default: a companion that never acts).
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
home="$root/misc/bench-home"
mkdir -p "$home"
token="$(grep -v '^#' "$HOME/.dkg/auth.token" | head -1)"
curl -s -m 10 -X POST http://127.0.0.1:9200/api/context-graph/create -H "authorization: Bearer $token" -H 'content-type: application/json' \
  -d '{"id":"umoja-desk-bench","name":"Keeper bench","accessPolicy":1}' > /dev/null || true
today="$(date +%Y-%m-%d)"
if [ "${PROFILE:-}" = admin ]; then role=system; act=true; else role=companion; act=false; fi
cat > "$home/settings.json" <<JSON
{"setupComplete": true, "nodeHome": "$HOME/.dkg", "activeKeeper": "keeper-bench",
 "keepers": [{"id": "keeper-bench", "name": "Bench", "skin": "robot", "role": "$role", "soul": "steady", "graphId": "umoja-desk-bench", "brain": "claude", "model": ""}],
 "agentActions": $act, "askBeforeActing": true, "visual": true, "fastModel": "haiku", "quickReplies": true, "prefetchScenes": true,
 "alwaysListening": false, "talkShortcut": "", "autoUpdate": false, "lastBrief": "$today", "voice": "Samantha"}
JSON
rm -f "$home/test-link.txt"
mode="${BUILD:-debug}"
bin="$root/src-tauri/target/$mode/keeper"
(cd "$root/src-tauri" && if [ "$mode" = release ]; then cargo build --release -q; else cargo build -q; fi)
KEEPER_HOME="$home" KEEPER_TEST_LINK=1 KEEPER_SILENT=1 "$bin" > "$home/app.log" 2>&1 &
pid=$!
trap 'kill $pid 2>/dev/null || true' EXIT
for i in $(seq 1 60); do [ -s "$home/test-link.txt" ] && break; sleep 0.5; done
[ -s "$home/test-link.txt" ] || { echo "the test Keeper did not open its link"; tail -20 "$home/app.log"; exit 1; }
sleep 8   # let the warm spares start, as they would while the person reads the screen
python3 "$root/scripts/bench/bench.py" "$home" "${1:-1}"
