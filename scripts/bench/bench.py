#!/usr/bin/env python3
"""Keeper speed and behaviour bench: drives a REAL running Keeper through its phone link (started
with KEEPER_TEST_LINK=1) and reports, per turn, what the person waits for: first words, done,
source. Run by scripts/bench/run.sh, which starts an isolated test Keeper (its own app folder and
Bench keeper on the `umoja-desk-bench` graph, never the person's keepers).

    python3 scripts/bench/bench.py <keeper-home> [rounds]
"""
import json, statistics, sys, time, urllib.request
from pathlib import Path

TURNS = [
    ("hello", "Hi! How are you today?"),
    ("name", "what is your name?"),
    ("fact-in", "My favourite colour is green and my dog is called Rex."),
    ("recall", "What is my dog called?"),
    ("quick-q", "What's the capital of Japan?"),
    ("system", "How's my computer?"),
    ("find", "Where is my Downloads folder?"),
    ("lesson", "Explain how a rainbow forms, visually."),
    # A new topic every run, so the main model's streamed lesson is measured (never the cache).
    ("lesson-fresh", f"Explain how a lighthouse lens works, visually. (Bench run {int(time.time())})"),
    ("lesson-again", "Explain how a rainbow forms, visually."),
    ("follow-up", 'About "How a rainbow forms": explain the card Refraction. Show it step by step in a panel if that helps.'),
    ("brief", "Brief me"),
    # Computer work (an admin keeper plans it; a companion says it does not operate the computer).
    ("computer", "Tidy up my desktop"),
    ("computer-miss", "Can you see what I was working on yesterday?"),
    ("facts", "What do you know about me?"),
]

def link(home):
    url = (Path(home) / "test-link.txt").read_text().strip()
    base, token = url.split("/#t=")
    return base, token

def turn(base, token, text, chat):
    body = json.dumps({"text": text, "chat": chat}).encode()
    req = urllib.request.Request(f"{base}/api/turn", data=body, headers={"content-type": "application/json", "authorization": f"Bearer {token}"})
    t = time.time()
    with urllib.request.urlopen(req, timeout=240) as r:
        out = json.load(r)
    out["wall_ms"] = round((time.time() - t) * 1000)
    return out

def main():
    home = sys.argv[1]
    rounds = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    base, token = link(home)
    rows, chat = [], ""
    for r in range(rounds):
        for label, text in TURNS:
            try:
                out = turn(base, token, text, chat)
            except Exception as e:  # a failed turn is a finding, not a crash
                rows.append({"label": label, "error": str(e)}); print(f"{label:>13}  ERROR {e}"); continue
            chat = out.get("chat", chat)
            t = out.get("timings") or {}
            first = t.get("firstMs") if t.get("firstMs") is not None else t.get("totalMs")
            rows.append({"label": label, "first": first, "done": t.get("totalMs"), "wall": out["wall_ms"], "source": t.get("source"), "recall": t.get("recallMs"), "panels": out.get("panels"), "reply": out.get("reply", "")[:90]})
            print(f"{label:>13}  first {first:>6} ms  panel {str(t.get('panelMs') if t.get('panelMs') is not None else '-'):>6}  done {t.get('totalMs'):>6} ms  recall {t.get('recallMs'):>4} ms  {t.get('source'):<10} panels {out.get('panels')}  | {out.get('reply','')[:150]}")
            time.sleep(3.2)  # stay under the link's 20 turns a minute
    ok = [r for r in rows if "error" not in r]
    if ok:
        firsts = sorted(r["first"] for r in ok)
        print(f"\nFIRST WORDS  median {statistics.median(firsts):.0f} ms  p90 {firsts[int(len(firsts)*0.9)-1]:.0f} ms  over {len(ok)} turns; errors {len(rows)-len(ok)}")
    Path(home, "bench-results.json").write_text(json.dumps(rows, indent=2))

if __name__ == "__main__":
    main()
