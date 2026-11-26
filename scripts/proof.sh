#!/usr/bin/env bash
# The release proof: every memory test run for real against this Mac's memory node, in a
# SUB-GRAPH (the shape a real keeper's memory has), on scratch graphs only
# (umoja-desk-livetest, umoja-desk-*test-*). scripts/release.sh runs it before it tags, so a
# release is never cut from code that cannot read real-shaped memory (FIX-0026, LES-013).
#
#   bash scripts/proof.sh
#
# Needs a running node in ~/.dkg. No node is a FAILURE, never a skip: an unproven release is
# the thing this script exists to stop. It writes only working-memory records on this
# computer's node; nothing is shared or published.
set -euo pipefail
cd "$(dirname "$0")/../src-tauri"
[ -f "$HOME/.dkg/api.port" ] || { echo "proof: no memory node in ~/.dkg, so nothing can be proven"; exit 1; }
out="$(mktemp)"
# One at a time: the tests share scratch graphs. The two long benchmarks are not part of the gate.
if ! cargo test --lib -- --ignored memory:: backup:: seasons:: --skip live_scale --skip live_bench --skip live_memory_meaning --test-threads=1 > "$out" 2>&1; then
  grep -E "^test |panicked|error" "$out" | tail -30
  echo "proof: FAILED"; exit 1
fi
summary="$(grep -E "^test result:" "$out" | tail -1)"
passed="$(echo "$summary" | sed -E 's/.* ([0-9]+) passed.*/\1/')"
# A gate that ran nothing proves nothing (LES-011).
[ "${passed:-0}" -ge 15 ] || { echo "proof: only ${passed:-0} tests ran (at least 15 expected)"; exit 1; }
echo "proof: $summary"
