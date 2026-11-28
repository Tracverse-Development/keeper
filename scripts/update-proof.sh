#!/usr/bin/env bash
# Prove that an installed copy updates itself (docs/RELEASING.md step 4), in a FRESH clone of the
# test VM (wiped of Keeper first) (tart, ~/ForemanProjects/vm): the previous release is installed from GitHub,
# opened, and must replace itself with the newest published release on its own.
#
#   bash scripts/update-proof.sh <previous version> <newest version>    e.g. 0.11.1 0.11.2
#
# Starts and stops only its own VM clone (keeper-proof-<time>), deleted at the end.
set -euo pipefail
from="${1:?previous version}"; to="${2:?newest version}"
vm="$HOME/ForemanProjects/vm"
tart="$vm/tart.app/Contents/MacOS/tart"
name="keeper-proof-$(date +%s)"
work="$(mktemp -d)"
log="$work/vm.log"
cleanup() {
  "$tart" stop "$name" >/dev/null 2>&1 || true
  "$tart" delete "$name" >/dev/null 2>&1 || true
}
trap cleanup EXIT
# keeper-test is the test VM that accepts the login key (rebuilt 2026-11-27 from the stock
# macOS Sequoia image); the copy is wiped of Keeper first.
base="${PROOF_BASE:-keeper-test}"
# The feed is served through GitHub's cache: right after a release it can still name the version
# before. Wait until it names $to, or the proof fails for the cache, not for Keeper (2026-11-28).
feed="https://github.com/tracverse-development/keeper/releases/latest/download/latest.json"
for i in $(seq 1 36); do
  [ "$(curl -sL -m 15 "$feed" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("version",""))' 2>/dev/null)" = "$to" ] && break
  [ "$i" = 36 ] && { echo "update-proof: the update feed still does not name $to after 3 minutes"; exit 1; }
  sleep 5
done
echo "== fresh VM $name from $base"
"$tart" clone "$base" "$name"
"$tart" run --no-graphics --no-audio "$name" > "$log" 2>&1 &
ip=""
for i in $(seq 1 90); do ip="$("$tart" ip "$name" 2>/dev/null || true)"; [ -n "$ip" ] && break; sleep 2; done
[ -n "$ip" ] || { echo "the VM did not get an address"; exit 1; }
ssh_vm() { ssh -i "$vm/vmkey" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes -o ConnectTimeout=5 -o LogLevel=ERROR "admin@$ip" "$@"; }
for i in $(seq 1 60); do ssh_vm true 2>/dev/null && break; sleep 3; done
ssh_vm true || { echo "no ssh into the VM at $ip"; exit 1; }
echo "== VM at $ip; installing Keeper $from from its GitHub release"
export GH_TOKEN="$(gh auth token -u Tracverse-Development)"
gh release download "v$from" -R Tracverse-Development/keeper -p "Keeper_${from}_aarch64.app.tar.gz" -D "$work" --clobber
scp -i "$vm/vmkey" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR "$work/Keeper_${from}_aarch64.app.tar.gz" "admin@$ip:/tmp/keeper.tgz"
# A clean start: no Keeper, no Keeper settings or data left from earlier tests in the copy.
ssh_vm 'pkill -x keeper 2>/dev/null; rm -rf /Applications/Keeper.app ~/Library/Application\ Support/Keeper ~/Library/Caches/com.umojaark.desk ~/Library/WebKit/com.umojaark.desk; true'
ssh_vm 'cd /Applications && rm -rf Keeper.app && tar xzf /tmp/keeper.tgz && xattr -cr Keeper.app && /usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" Keeper.app/Contents/Info.plist'
echo "== opening it; it checks for updates at launch and installs the newest"
ssh_vm 'open -a /Applications/Keeper.app'
for i in $(seq 1 60); do
  v="$(ssh_vm '/usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" /Applications/Keeper.app/Contents/Info.plist' 2>/dev/null || true)"
  [ "$v" = "$to" ] && { echo "update-proof: Keeper $from replaced itself with $to (after about $((i * 5)) s)"; exit 0; }
  sleep 5
done
echo "update-proof: FAILED: still version ${v:-unknown} after 5 minutes (wanted $to)"
ssh_vm 'tail -20 ~/Library/Logs/com.umojaark.desk/*.log 2>/dev/null; ls ~/Library/Application\ Support/Keeper 2>/dev/null' || true
exit 1
