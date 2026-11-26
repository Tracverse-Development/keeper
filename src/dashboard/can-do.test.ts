import assert from 'node:assert/strict';
import { test } from 'node:test';

import { allExamples, CAN_DO, matching } from './can-do.ts';

test('what I can do: every example does at most one thing and none is listed twice', () => {
  const all = allExamples();
  assert.ok(all.length >= 15);
  assert.equal(new Set(all.map((e) => e.title)).size, all.length);
  for (const e of all) {
    assert.ok(!(e.say && e.open), `${e.title} both says and opens`);
    assert.ok(e.title.trim() && /[.?]$/.test(e.hint), `${e.title}: a hint is a full sentence`);
  }
  assert.equal(new Set(CAN_DO.map((g) => g.id)).size, CAN_DO.length);
});

test('what I can do: typing narrows the list by every word', () => {
  assert.deepEqual(matching('copied fix').flatMap((g) => g.examples.map((e) => e.title)), ['Fix what I copied']);
  assert.equal(matching('').length, CAN_DO.length);
  assert.equal(matching('zebra').length, 0);
});
