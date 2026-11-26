#!/usr/bin/env python3
"""One version's entry from CHANGELOG.md, as the release's notes.

    python3 scripts/changelog.py 0.11.1        # prints the entry's body (Added / Changed / Fixed)
    python3 scripts/changelog.py --check 0.11.1  # exit 1 when the version has no entry, or an empty one
    python3 scripts/changelog.py --versions      # every version in the file, newest first

The changelog is the one place a version's changes are written; the release scripts read it from
here so GitHub's notes and the in-app update notes can never say something else.
"""
import re
import sys
from pathlib import Path

FILE = Path(__file__).resolve().parent.parent / 'CHANGELOG.md'
HEADING = re.compile(r'^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})\s*$', re.M)


def entries(text):
    """[(version, date, body)] in file order."""
    found = list(HEADING.finditer(text))
    return [(m.group(1), m.group(2), text[m.end():(found[i + 1].start() if i + 1 < len(found) else len(text))].strip()) for i, m in enumerate(found)]


def main(argv):
    all_entries = entries(FILE.read_text(encoding='utf-8'))
    if argv[:1] == ['--versions']:
        print('\n'.join(v for v, _, _ in all_entries))
        return 0
    check = argv[:1] == ['--check']
    version = (argv[1:] if check else argv)[:1]
    if not version:
        print(__doc__)
        return 2
    version = version[0].lstrip('v')
    body = next((b for v, _, b in all_entries if v == version), None)
    # An entry needs at least one change written under a heading.
    if not body or not re.search(r'^- \S', body, re.M):
        print(f'CHANGELOG.md has no entry for {version}: write what was added, changed and fixed first.', file=sys.stderr)
        return 1
    if not check:
        print(body)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
