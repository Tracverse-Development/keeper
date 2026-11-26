#!/usr/bin/env bash
# The check before every commit: typecheck, window tests, core unit tests. Fails on the first red
# (a grep on test output must never let a failure through again; see LESSONS LES-011).
set -euo pipefail
cd "$(dirname "$0")/.."
npx tsc --noEmit -p .
out="$(node --test --experimental-strip-types "src/**/*.test.ts" 2>&1)" || { echo "$out" | grep -A12 "failing tests"; exit 1; }
echo "$out" | grep -E "^ℹ (pass|fail)"
(cd src-tauri && cargo test -q --lib 2>&1 | tail -3)
