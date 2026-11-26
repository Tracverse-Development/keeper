import assert from 'node:assert/strict';
import { test } from 'node:test';

import { problemsFirst, summaryLine, worst } from './health-view.ts';

const c = (id: string, level: 'ok' | 'warn' | 'bad') => ({ id, name: id, level, detail: '', fix: null });

test('health: the summary is the worst thing found, in plain words', () => {
  assert.equal(summaryLine([c('a', 'ok')]), 'Everything is working.');
  assert.equal(summaryLine([c('a', 'ok'), c('b', 'warn')]), 'Working, with 1 thing to know.');
  assert.equal(summaryLine([c('a', 'bad'), c('b', 'warn'), c('c', 'bad')]), '2 things are not working.');
  assert.equal(worst([c('a', 'ok'), c('b', 'warn')]), 'warn');
  assert.equal(worst([]), 'ok');
});

test('health: problems are listed first, the rest keep their order', () => {
  assert.deepEqual(problemsFirst([c('a', 'ok'), c('b', 'bad'), c('c', 'warn'), c('d', 'ok')]).map((x) => x.id), ['b', 'c', 'a', 'd']);
});
