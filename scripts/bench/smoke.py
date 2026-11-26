#!/usr/bin/env python3
"""End-to-end smoke: the REAL app (a test copy with its own folder and its own memory, started
by scripts/bench/smoke.sh) is sent real messages through its test link, and each reply is
checked. Only instant features (no model, no cost): the week in review, focus sessions,
routines, snooze, what it knows. It proves the path a person's message takes (window link ->
turn -> instant lane -> the memory node, in the keeper's own sub-graph -> the record), which
unit tests and the node-only proof cannot.

    python3 scripts/bench/smoke.py <test home>

Exit 1 on the first reply that is not what the feature should say.
"""
import json, sys, time, urllib.request
from pathlib import Path

HOME = Path(sys.argv[1])
# What must never appear in a reply: an error shown as an answer.
BROKEN = ('memory node', "couldn't read", 'did not answer', 'something went wrong', 'not answering')

# (what is said, words the reply must hold (any of), what it proves)
STEPS = [
    ('Week in review', ('This week', 'quiet week'), 'the week is read from memory'),
    ('Focus for 25 minutes', ('Focus session started: 25 minutes',), 'a focus session starts'),
    ('Stop the focus session', ('ended early',), 'and stops, releasing reminders'),
    ('What routines do I have?', ('no routines yet', 'routine'), 'routines are read from the keeper\'s own place'),
    ('Save that as my smoke test routine', ('do this again: Stop the focus session',), 'a routine is written there, from the request just before'),
    ('What routines do I have?', ('smoke test',), 'and read back'),
    ('Forget my smoke test routine', ('forgotten the smoke test routine',), 'and erased'),
    ('What routines do I have?', ('no routines yet', 'routine'), 'the list still reads after erasing'),
    ('Tidy my memory', ('looks tidy', 'something newer has replaced'), 'memory is read and checked for replaced facts'),
    ('Snooze', ('no reminder to snooze',), 'snooze says so when nothing has gone off'),
    ('Start a focus session for 500 minutes', ('between 5 and 120',), 'an out-of-range request is said, not started'),
]


# With a model (`smoke.sh model`): memory through a real mind. Each step: what is said, words the
# reply must hold (any of), words it must NOT hold, what it proves. Not part of the release gate
# (a model's wording varies); run by hand after changes to memory or the prompt.
MODEL_STEPS = [
    ('Please remember that my sister is called Maya Comet.', ('maya', 'remember', 'got it', 'noted'), (), 'a fact is learned'),
    ('Who should I call for family news?', ('maya',), (), 'it is recalled by meaning, with no word in common'),
    ('Please remember that I live in Arima.', ('arima', 'remember', 'got it', 'noted'), (), 'a single-valued fact is learned'),
    ('I moved to Boston last week.', ('boston',), (), 'a newer fact arrives'),
    ('Where do I live now?', ('boston',), ('arima',), 'the old address is no longer what it knows'),
    ('Tidy my memory', ('looks tidy',), (), 'and nothing out of date is left behind'),
]


def turn(base, token, text, chat):
    body = json.dumps({'text': text, 'chat': chat, 'mode': 'assistant'}).encode()
    req = urllib.request.Request(f'{base}/api/turn', data=body, headers={'content-type': 'application/json', 'authorization': f'Bearer {token}'})
    return json.load(urllib.request.urlopen(req, timeout=120))


def main():
    base, token = (HOME / 'test-link.txt').read_text().strip().split('/#t=')
    chat, failed = '', 0
    steps = [(s, w, (), p) for s, w, p in STEPS] if sys.argv[2:3] != ['model'] else MODEL_STEPS
    for said, want, never, proves in steps:
        started = time.time()
        try:
            r = turn(base, token, said, chat)
        except Exception as e:  # the app refused or died: that is a failure, not a skip
            print(f'FAIL  {said!r}: no reply ({e})')
            failed += 1
            break
        chat = r.get('chat') or chat
        reply = r.get('reply', '')
        ok = any(w.lower() in reply.lower() for w in want) and not any(b in reply.lower() for b in BROKEN + tuple(never))
        print(f"{'ok  ' if ok else 'FAIL'}  {round(time.time() - started, 1):>5}s  {said!r} -> {reply[:110]!r}  ({proves})")
        failed += 0 if ok else 1
        # With a model, the turn's records are written after the reply: give them a moment.
        time.sleep(3 if never or sys.argv[2:3] == ['model'] else 0.5)
    print(f'\nsmoke: {len(steps) - failed}/{len(steps)} steps as expected')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
