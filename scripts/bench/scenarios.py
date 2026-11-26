#!/usr/bin/env python3
"""Scenario bench: real multi-turn conversations per mode, through a running Keeper's test link.

Each turn records the time, the reply, the panel kinds; checks the kinds against what the turn
should show (any of `want`, none of `never`); then a judge model rates the turn 1 to 5 for
"do the panels fit what was asked, with enough context to understand them?". Run:

    KEEPER_HOME=misc/bench-home KEEPER_TEST_LINK=1 src-tauri/target/release/keeper &
    python3 scripts/bench/scenarios.py [scenario-name ...]

The judge is Claude Code on the quick model (`claude -p --model haiku`); its notes say what to fix.
Results also go to misc/bench-home/scenarios-<time>.json for comparing rounds.
"""
import json, os, subprocess, sys, time, urllib.request
from pathlib import Path

HOME = Path(os.environ.get('KEEPER_HOME', 'misc/bench-home'))
LIVE = {'live'}
TEACH = {'steps', 'cards', 'diagram', 'formula', 'chart', 'timeline', 'text', 'table', 'sliders'}
CHECK = {'quiz', 'flashcards'}
NONE = set()

SCENARIOS = {
    'tutor': ('tutor', [
        ('Teach me how photosynthesis works.', TEACH, CHECK - {'quiz'} | {'live', 'files', 'approval'}),
        ('Why are leaves green and not black?', TEACH, {'live', 'approval'}),
        ('Quiz me on it.', CHECK, {'live', 'approval'}),
        ('Go back to the light part and explain it more simply.', TEACH, {'live', 'approval'}),
    ]),
    'research': ('researcher', [
        ('What does the research say about creatine and memory?', {'sources'}, {'live', 'quiz', 'approval'}),
        ('How strong is that evidence?', {'sources', 'table', 'text', 'cards'}, {'live', 'approval'}),
    ]),
    'sysadmin': ('system', [
        ('Show me my home network.', LIVE | {'table'}, {'quiz', 'flashcards'}),
        ('Is my Wi-Fi secure?', {'table', 'text', 'cards', 'checklist'}, {'quiz', 'flashcards'}),
        ('How much storage do I have left?', LIVE | {'table', 'chart'}, {'quiz', 'flashcards'}),
        ('Make a folder called keeper-bench-fix in /tmp.', {'approval'}, {'quiz'}),
    ]),
    'companion': ('companion', [
        ('I had a rough day at work.', NONE, {'quiz', 'live', 'table', 'flashcards'}),
        ('Thanks, that helps.', NONE, {'quiz', 'live', 'table'}),
    ]),
    'memory': ('assistant', [
        ('Remember that my bench test cat is called Biscuit Moon.', NONE | {'facts', 'text'}, {'quiz', 'live'}),
    ]),
    'switch': ('system', [
        ('How do I make banana bread?', TEACH | {'checklist'}, {'live', 'approval'}),
    ]),
}

JUDGE = """You review one turn of a desktop assistant that answers in words plus visual panels.
Mode: {mode}. The person said: "{said}". Earlier in this chat: {earlier}
The assistant replied: "{reply}"
Panels shown, one per line ([kind] title: content; a live panel shows real readings that update, its content here is only its settings): {panels}
Rate 1-5: do the panels fit what was asked (a lesson for learning, a dashboard or tables for
looking at a computer, sources for research, none for feelings), and is there enough context in
them to understand without asking? Then one sentence on the single most useful fix.
Answer only JSON: {{"score": n, "fix": "..."}}"""


def link():
    url = (HOME / 'test-link.txt').read_text().strip()
    return url.split('/#t=')


def turn(base, tok, text, chat, mode):
    req = urllib.request.Request(f'{base}/api/turn', data=json.dumps({'text': text, 'chat': chat, 'mode': mode}).encode(), headers={'content-type': 'application/json', 'authorization': f'Bearer {tok}'})
    return json.load(urllib.request.urlopen(req, timeout=300))


def sample(p):
    body = {k: v for k, v in p.items() if k not in ('id', 'kind', 'title')}
    text = json.dumps(body, ensure_ascii=False)
    # Whole content up to 900 characters; a cut is marked so the judge never reads it as broken.
    return f"[{p.get('kind')}] {p.get('title')}: {text[:900]}{' (sample cut here)' if len(text) > 900 else ''}"


def judge(mode, said, earlier, reply, panels):
    prompt = JUDGE.format(mode=mode, said=said, earlier=earlier or '(nothing)', reply=reply[:600], panels='\n' + '\n'.join(sample(p) for p in panels) if panels else '(none)')
    try:
        out = subprocess.run(['claude', '-p', '--model', 'haiku', '--output-format', 'json', '--tools', '', '--setting-sources', '', '--no-session-persistence', prompt], capture_output=True, text=True, timeout=90)
        text = json.loads(out.stdout).get('result', '')
        return json.loads(text[text.index('{'): text.rindex('}') + 1])
    except Exception as e:
        return {'score': 0, 'fix': f'(judge failed: {e})'}


def main():
    base, tok = link()
    names = sys.argv[1:] or list(SCENARIOS)
    results = []
    for name in names:
        mode, turns = SCENARIOS[name]
        chat, earlier = '', []
        print(f'\n== {name} ({mode})')
        for said, want, never in turns:
            t = time.time()
            r = turn(base, tok, said, chat, mode)
            secs = round(time.time() - t, 1)
            chat = r.get('chat') or chat
            panels = r.get('panelSpecs') or r.get('panelList') or []
            kinds = [p.get('kind') for p in panels] if panels else r.get('kinds', [])
            ok_kinds = (not want and not kinds) or (bool(want) and any(k in want for k in kinds))
            bad = [k for k in kinds if k in never]
            j = judge(mode, said, ' / '.join(earlier[-2:]), r.get('reply', ''), panels)
            results.append({'scenario': name, 'said': said, 'secs': secs, 'kinds': kinds, 'ok': ok_kinds and not bad, 'score': j.get('score'), 'fix': j.get('fix'), 'reply': r.get('reply', '')[:300], 'switched': r.get('switched')})
            flag = 'ok ' if ok_kinds and not bad else 'BAD'
            print(f"{flag} {secs:>5}s judge={j.get('score')} kinds={kinds} | {said}\n      reply: {r.get('reply','')[:140]}\n      fix: {j.get('fix')}")
            earlier.append(said)
            time.sleep(2)
    out = HOME / f"scenarios-{time.strftime('%Y%m%d-%H%M%S')}.json"
    out.write_text(json.dumps(results, indent=1))
    scored = [x['score'] for x in results if x['score']]
    print(f"\n{sum(x['ok'] for x in results)}/{len(results)} panel kinds right · judge mean {sum(scored)/max(1,len(scored)):.2f} · median time {sorted(x['secs'] for x in results)[len(results)//2]} s · {out}")


if __name__ == '__main__':
    main()
