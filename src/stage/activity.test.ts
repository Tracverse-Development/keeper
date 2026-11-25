/**
 * Tests for the activity feed's tool words and path breadcrumbs (pure).
 * Run: node --test --experimental-strip-types src/stage/activity.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breadcrumbs, detailKind, toolLook, urlHost } from './activity.ts';

test('each tool gets a plain-language verb and an icon', () => {
  assert.deepEqual(toolLook('Bash'), { verb: 'Running a command', icon: 'run' });
  assert.deepEqual(toolLook('command'), { verb: 'Running a command', icon: 'run' });
  assert.deepEqual(toolLook('Edit'), { verb: 'Editing', icon: 'edit' });
  assert.deepEqual(toolLook('Write'), { verb: 'Editing', icon: 'edit' });
  assert.deepEqual(toolLook('Read'), { verb: 'Reading', icon: 'read' });
  assert.deepEqual(toolLook('Glob'), { verb: 'Searching', icon: 'search' });
  assert.deepEqual(toolLook('Grep'), { verb: 'Searching', icon: 'search' });
  assert.deepEqual(toolLook('find'), { verb: 'Searching', icon: 'search' });
  assert.deepEqual(toolLook('WebFetch'), { verb: 'Looking online', icon: 'web' });
  assert.deepEqual(toolLook('WebSearch'), { verb: 'Looking online', icon: 'web' });
  assert.deepEqual(toolLook('TodoWrite'), { verb: 'Working', icon: 'work' });
  assert.deepEqual(toolLook(''), { verb: 'Working', icon: 'work' });
});

test('details are told apart: paths, web addresses, commands', () => {
  assert.equal(detailKind('/Users/x/report.pdf'), 'path');
  assert.equal(detailKind('~/Downloads'), 'path');
  assert.equal(detailKind('notes/today.md'), 'path');
  assert.equal(detailKind('notes.md'), 'text');
  assert.equal(detailKind('ls ~/Downloads'), 'text');
  assert.equal(detailKind('https://en.wikipedia.org/wiki/Algebra'), 'url');
  assert.equal(urlHost('https://en.wikipedia.org/wiki/Algebra'), 'en.wikipedia.org');
  assert.equal(urlHost('not a url'), 'not a url');
});

test('a path becomes breadcrumbs, long ones keep the file', () => {
  assert.deepEqual(breadcrumbs('~/Downloads/a.pdf'), ['~', 'Downloads', 'a.pdf']);
  assert.deepEqual(breadcrumbs('/Users/x/report.pdf'), ['Users', 'x', 'report.pdf']);
  assert.deepEqual(breadcrumbs('/Users/x/Documents/School/Math/week3.pdf'), ['…', 'School', 'Math', 'week3.pdf']);
  assert.deepEqual(breadcrumbs('C:\\Users\\x\\a.txt'), ['C:', 'Users', 'x', 'a.txt']);
});
