/**
 * Tests for the activity feed's tool words and path breadcrumbs (pure).
 * Run: node --test --experimental-strip-types src/stage/activity.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupSteps, stepWords, breadcrumbs, detailKind, narrate, placeName, urlHost } from './activity.ts';

test('a path becomes breadcrumbs, long ones keep the file', () => {
  assert.deepEqual(breadcrumbs('~/Downloads/a.pdf'), ['~', 'Downloads', 'a.pdf']);
  assert.deepEqual(breadcrumbs('/Users/x/report.pdf'), ['Users', 'x', 'report.pdf']);
  assert.deepEqual(breadcrumbs('/Users/x/Documents/School/Math/week3.pdf'), ['…', 'School', 'Math', 'week3.pdf']);
  assert.deepEqual(breadcrumbs('C:\\Users\\x\\a.txt'), ['C:', 'Users', 'x', 'a.txt']);
});


test('steps are told in words, never as commands', () => {
  const founder = 'ls /Applications ~/Applications 2>/dev/null | grep -i fore; mdfind -name foreman 2>/dev/null | grep -v Library | head -20; ps aux | grep -i foreman';
  assert.deepEqual(narrate('Bash', founder), { words: 'Looking in Applications and searching for “foreman”', kind: 'folder' });
  assert.deepEqual(narrate('Bash', 'ls ~/Desktop ~/Downloads'), { words: 'Looking in Desktop and Downloads', kind: 'folder' });
  assert.deepEqual(narrate('Bash', 'cd ~ && mdfind -name foreman'), { words: 'Searching for “foreman”', kind: 'search' });
  assert.deepEqual(narrate('Bash', 'mv ~/Downloads/report.pdf ~/Documents/'), { words: 'Moving report.pdf to Documents', kind: 'move' });
  assert.deepEqual(narrate('Bash', 'mkdir -p ~/Desktop/Screenshots'), { words: 'Creating the folder Screenshots', kind: 'create' });
  assert.deepEqual(narrate('Bash', 'ps aux | grep -i foreman'), { words: 'Checking which apps are running', kind: 'process' });
  assert.deepEqual(narrate('Read', '/Users/a/notes/todo.md'), { words: 'Reading todo.md', kind: 'read' });
  assert.deepEqual(narrate('Edit', '/Users/a/notes/todo.md'), { words: 'Editing todo.md', kind: 'write' });
  assert.deepEqual(narrate('WebFetch', 'https://www.who.int/news'), { words: 'Reading www.who.int', kind: 'web' });
  assert.equal(narrate('Bash', 'some-unknown-tool --x').words, 'Working on your computer');
  for (const d of [founder, 'rm -rf ~/x', 'find . -name "*.pdf"', 'cat ~/a/b/c.txt | head -5']) {
    const words = narrate('Bash', d).words;
    assert.ok(!words.includes('/') && !/\s-\w/.test(words) && !words.includes('|'), `no paths, flags or pipes: ${words}`);
  }
});

test('places by the names people use', () => {
  assert.equal(placeName('~'), 'your home folder');
  assert.equal(placeName('/Users/amos'), 'your home folder');
  assert.equal(placeName('~/Desktop/'), 'Desktop');
});

test('details: paths, web addresses and plain text', () => {
  assert.equal(detailKind('~/Downloads/a.pdf'), 'path');
  assert.equal(detailKind('https://x.org/a'), 'url');
  assert.equal(urlHost('https://en.wikipedia.org/wiki/X'), 'en.wikipedia.org');
  assert.equal(detailKind('tidy the desktop'), 'text');
});

test('network looks are said by what they find out, never as commands', () => {
  assert.equal(narrate('Bash', 'arp -an -i en0').words, 'Listing the devices your Mac has seen nearby');
  assert.equal(
    narrate('Bash', 'ping -c 2 -t 3 192.168.1.255 ; ping -c 1 192.168.1.1 | tail -2; arp -an; networksetup -listallhardwareports').words,
    'Checking how fast your router and the internet answer and listing the devices your Mac has seen nearby',
  );
  assert.equal(narrate('Bash', '/Applications/Tailscale.app/Contents/MacOS/Tailscale status').words, 'Checking your private network');
  assert.equal(narrate('Bash', 'sudo diskutil list').words, 'Reading your disks');
  assert.ok(!/arp|ping|-c/.test(narrate('Bash', 'ping -c 3 1.1.1.1').words));
});

test('the status line under the reply never shows a command', () => {
  assert.equal(stepWords('Bash: arp -an'), 'Listing the devices your Mac has seen nearby…');
  assert.equal(stepWords('Doing it'), 'Doing it');
});

test('repeated steps are grouped', () => {
  const g = groupSteps([{ tool: 'Bash', detail: 'arp -an' }, { tool: 'Bash', detail: 'arp -a' }, { tool: 'Read', detail: '~/a.txt' }]);
  assert.deepEqual(g.map((s) => [s.words, s.times]), [['Listing the devices your Mac has seen nearby', 2], ['Reading a.txt', 1]]);
});
