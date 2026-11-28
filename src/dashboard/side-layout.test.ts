/** Run: node --test --experimental-strip-types src/dashboard/side-layout.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepersBeside, setTranscript, toggleKeepers } from './side-layout.ts';

test('on a narrow window the keepers list and the Transcript take turns', () => {
  assert.deepEqual(setTranscript({ keepers: true, transcript: false, stage: false }, true, 1000), { keepers: false, transcript: true, stage: false });
  assert.deepEqual(toggleKeepers({ keepers: false, transcript: true, stage: false }, 1000), { keepers: true, transcript: false, stage: false });
});

test('on a wide window both stay open', () => {
  assert.deepEqual(setTranscript({ keepers: true, transcript: false, stage: false }, true, 1600), { keepers: true, transcript: true, stage: false });
  assert.deepEqual(toggleKeepers({ keepers: false, transcript: true, stage: false }, 1600), { keepers: true, transcript: true, stage: false });
});

test('the Stage gives way to either, and folding the list never touches the rest', () => {
  assert.deepEqual(toggleKeepers({ keepers: true, transcript: false, stage: true }, 1600), { keepers: true, transcript: false, stage: false }, 'the list folded beside the Stage opens');
  assert.equal(setTranscript({ keepers: false, transcript: false, stage: true }, true, 1600).stage, false);
  assert.deepEqual(toggleKeepers({ keepers: true, transcript: true, stage: false }, 1600), { keepers: false, transcript: true, stage: false });
  assert.deepEqual(setTranscript({ keepers: true, transcript: true, stage: false }, false, 1000), { keepers: true, transcript: false, stage: false });
});

test('Memory opening on the right folds the keepers list only on a narrow window', () => {
  assert.equal(keepersBeside(true, 1000), false);
  assert.equal(keepersBeside(true, 1600), true);
  assert.equal(keepersBeside(false, 1600), false);
});
