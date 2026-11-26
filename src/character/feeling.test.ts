import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blinkPace, easeFeeling, foldFeeling, readFeeling, SMILE_FLOOR } from './feeling.ts';
import { MOOD_NAMES, moodTarget } from './moods.ts';

test('feeling: no mood leaves every dial of every mood exactly as it was', () => {
  for (const mood of MOOD_NAMES) {
    assert.deepEqual(foldFeeling(moodTarget(mood), readFeeling(null)), moodTarget(mood));
    assert.deepEqual(foldFeeling(moodTarget(mood), { pleasure: 0.8, arousal: -0.8 }, 0), moodTarget(mood), 'asleep shows none');
  }
  assert.equal(blinkPace(readFeeling(null)), 1);
});

test('feeling: glad smiles more and glows, low only quiets, and never frowns', () => {
  const idle = moodTarget('idle');
  const glad = foldFeeling(moodTarget('idle'), { pleasure: 0.8, arousal: 0 });
  assert.ok(glad.smile > idle.smile && glad.glow > idle.glow);
  const low = foldFeeling(moodTarget('idle'), { pleasure: -1, arousal: 0 });
  assert.ok(low.smile < idle.smile && low.smile >= SMILE_FLOOR);
  // A mood whose resting smile is already flat is not pushed lower.
  assert.equal(foldFeeling(moodTarget('thinking'), { pleasure: -1, arousal: 0 }).smile, moodTarget('thinking').smile);
});

test('feeling: lively breathes and blinks faster, tired slower with heavier lids', () => {
  const idle = moodTarget('idle');
  const lively = foldFeeling(moodTarget('idle'), { pleasure: 0, arousal: 0.8 });
  const tired = foldFeeling(moodTarget('idle'), { pleasure: 0, arousal: -0.8 });
  assert.ok(lively.bobSpeed > idle.bobSpeed && tired.bobSpeed < idle.bobSpeed);
  assert.ok(tired.eyeOpen < idle.eyeOpen && tired.eyeOpen > 0.5, 'heavy lids, still awake');
  assert.ok(tired.bobAmp > idle.bobAmp, 'deeper breaths');
  assert.ok(blinkPace({ pleasure: 0, arousal: 0.8 }) > 1 && blinkPace({ pleasure: 0, arousal: -0.8 }) < 1);
});

test('feeling: outside values are clamped and the body eases toward a mood', () => {
  assert.deepEqual(readFeeling({ pleasure: 9, arousal: Number.NaN }), { pleasure: 1, arousal: 0 });
  assert.deepEqual(readFeeling('glad'), { pleasure: 0, arousal: 0 });
  const body = readFeeling(null);
  easeFeeling(body, { pleasure: 1, arousal: -1 }, 0.5);
  assert.ok(body.pleasure > 0 && body.pleasure < 1 && body.arousal < 0 && body.arousal > -1);
  for (let i = 0; i < 200; i++) easeFeeling(body, { pleasure: 1, arousal: -1 }, 0.05);
  assert.ok(Math.abs(body.pleasure - 1) < 0.01 && Math.abs(body.arousal + 1) < 0.01);
});
