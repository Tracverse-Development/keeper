/**
 * Tests for the touch reaction envelopes and the shared expression fold (pure).
 * Run: node --test --experimental-strip-types src/character/reactions.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moodTarget } from './moods.ts';
import { REACTION_SECONDS, foldTouch, reactionEnvelope } from './reactions.ts';

test('envelopes are 0 outside the reaction and reach 1 inside it', () => {
  for (const kind of ['poke', 'pat'] as const) {
    assert.equal(reactionEnvelope(kind, -0.1), 0);
    assert.equal(reactionEnvelope(kind, 0), 0);
    assert.equal(reactionEnvelope(kind, REACTION_SECONDS[kind]), 0);
    assert.equal(reactionEnvelope(kind, Number.NaN), 0);
    let peak = 0;
    for (let t = 0; t < REACTION_SECONDS[kind]; t += 0.01) {
      const value = reactionEnvelope(kind, t);
      assert.ok(value >= 0 && value <= 1, `${kind} at ${t}`);
      peak = Math.max(peak, value);
    }
    assert.equal(peak, 1, `${kind} peaks`);
  }
});

test('a poke is a quick jolt; a pat holds longer', () => {
  assert.ok(reactionEnvelope('poke', 0.06) > 0.99, 'poke rises fast');
  assert.ok(REACTION_SECONDS.pat > REACTION_SECONDS.poke);
  assert.equal(reactionEnvelope('pat', REACTION_SECONDS.pat * 0.5), 1, 'pat holds');
});

test('with no touch the expression is left exactly as it was', () => {
  for (const mood of ['idle', 'happy', 'asleep', 'thinking'] as const) {
    const folded = foldTouch(moodTarget(mood), { poke: 0, pat: 0 });
    assert.deepEqual(folded, moodTarget(mood), mood);
  }
});

test('a pat squints happily; a poke widens the eyes', () => {
  const pat = foldTouch(moodTarget('idle'), { poke: 0, pat: 1 });
  assert.equal(pat.squint, 1);
  assert.equal(pat.smile, 1);
  assert.ok(pat.eyeBend < 0);
  const poke = foldTouch(moodTarget('idle'), { poke: 1, pat: 0 });
  assert.ok(poke.eyeOpen > moodTarget('idle').eyeOpen);
});
