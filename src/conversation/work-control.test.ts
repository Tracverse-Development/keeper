import { test } from 'node:test';
import assert from 'node:assert/strict';

import { afterCorrection, correctionWords, dockAction, pauseClock, resumeClock, startClock, workedMs } from './work-control.ts';

test('the clock counts work, not time paused', () => {
  let c = startClock(1000);
  assert.equal(workedMs(c, 11_000), 10_000);
  c = pauseClock(c, 11_000);
  assert.equal(workedMs(c, 71_000), 10_000, 'frozen while paused');
  assert.equal(pauseClock(c, 80_000), c, 'pausing twice changes nothing');
  c = resumeClock(c, 71_000);
  assert.equal(workedMs(c, 76_000), 15_000);
  assert.equal(resumeClock(c, 90_000), c, 'resuming when not paused changes nothing');
});

test('Enter while the keeper works sends a correction; free, it sends', () => {
  assert.equal(dockAction(false, true), 'send');
  assert.equal(dockAction(true, true), 'correct');
  assert.equal(dockAction(true, false), 'queue');
});

test('a correction with nothing left to correct is queued, other refusals are shown', () => {
  assert.equal(afterCorrection('Nothing is running right now.'), 'queue');
  assert.equal(afterCorrection("That's a lot at once. Try a shorter correction."), 'show');
  assert.equal(correctionWords('  use metric '), 'Changed course: use metric');
});

test('work time reads as a clock', async () => {
  const { elapsedWords } = await import('./work-control.ts');
  assert.equal(elapsedWords(7_400), '0:07');
  assert.equal(elapsedWords(272_000), '4:32');
  assert.equal(elapsedWords(3_725_000), '1:02:05');
  assert.equal(elapsedWords(-5), '0:00');
});
