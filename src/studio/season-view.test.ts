import assert from 'node:assert/strict';
import { test } from 'node:test';

import { daysLeftWords, questAction, questLine, questProgress } from './season-view.ts';

const quest = { quest: 'Finish 3 focus sessions', done: 1, goal: 3, earned: false, claimed: false };

test('season: a quest says how far it is, when it is done, and when the item is kept', () => {
  assert.equal(questLine(quest), 'Finish 3 focus sessions · 1 of 3');
  assert.equal(questLine({ ...quest, done: 3, earned: true }), 'Finish 3 focus sessions: done.');
  assert.equal(questLine({ ...quest, done: 3, earned: true, claimed: true }), 'Yours to keep.');
  assert.equal(questProgress(quest), 1 / 3);
  assert.equal(questProgress({ done: 9, goal: 3 }), 1);
});

test('season: only a finished quest can be claimed, and only once', () => {
  assert.deepEqual(questAction(quest), { label: 'Not earned yet', can: false });
  assert.deepEqual(questAction({ earned: true, claimed: false }), { label: 'Claim', can: true });
  assert.deepEqual(questAction({ earned: true, claimed: true }), { label: 'In your inventory', can: false });
});

test('season: how long it is still open', () => {
  assert.equal(daysLeftWords(13), 'Open for 12 more days');
  assert.equal(daysLeftWords(2), 'Open for 1 more day');
  assert.equal(daysLeftWords(1), 'Last day today');
});
