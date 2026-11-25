/**
 * Tests for the emote timelines and the expression frame (pure).
 * Run: node --test --experimental-strip-types src/character/emotes.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMOTE_NAMES, EMOTE_SPECS, envelope, isEmote, sampleEmote } from './emotes.ts';
import { addDrowsiness, foldExpression, restingExpression, type ExpressionChannel } from './expression-frame.ts';
import { EFFECT_KINDS } from './effects/particle-kinds.ts';
import { moodTarget } from './moods.ts';

const CONTRACT_EMOTES = ['wave', 'celebrate', 'streak', 'love', 'surprised', 'wink', 'sleepy', 'stretch', 'look-around', 'nod'];

test('every contract emote has a timeline, and only those', () => {
  assert.deepEqual([...EMOTE_NAMES].sort(), [...CONTRACT_EMOTES].sort());
  for (const name of CONTRACT_EMOTES) assert.ok(isEmote(name));
  for (const bad of ['dance', '', 'toString', 42, null]) assert.ok(!isEmote(bad));
});

test('every emote rests at its start and end (no snap in or out)', () => {
  const frame = restingExpression();
  for (const name of EMOTE_NAMES) {
    const { seconds } = EMOTE_SPECS[name];
    for (const t of [0, 0.001, seconds - 0.001, seconds, seconds + 1]) {
      sampleEmote(name, t, frame);
      for (const [channel, value] of Object.entries(frame)) {
        // A spin ends a full turn round (2π looks identical to 0).
        const rest = channel === 'yaw' ? Math.abs(Math.sin(value / 2)) : Math.abs(value);
        assert.ok(rest < 0.02, `${name} ${channel}=${value} at ${t}`);
      }
    }
  }
});

test('emotes stay smooth: no channel jumps between 60 fps frames', () => {
  const a = restingExpression();
  const b = restingExpression();
  for (const name of EMOTE_NAMES) {
    for (let t = 0; t + 1 / 60 < EMOTE_SPECS[name].seconds; t += 1 / 60) {
      sampleEmote(name, t, a);
      sampleEmote(name, t + 1 / 60, b);
      for (const key of Object.keys(a) as ExpressionChannel[]) {
        // Fast is allowed (a surprise widens in ~3 frames); a discontinuity is not.
        const limit = 0.34;
        assert.ok(Math.abs(a[key] - b[key]) < limit, `${name}.${key} jumps at ${t.toFixed(3)}`);
      }
    }
  }
});

test('celebrate anticipates: it crouches before it stretches into the jump, and lands squashed', () => {
  const frame = restingExpression();
  sampleEmote('celebrate', 0.16, frame);
  assert.ok(frame.squash < -0.08 && frame.lift < 0.05, 'crouch');
  sampleEmote('celebrate', 0.3, frame);
  assert.ok(frame.squash > 0.05 && frame.lift > 0.1, 'stretch in the air');
  sampleEmote('celebrate', 0.68, frame);
  assert.ok(frame.squash < -0.05, 'squash on landing');
  sampleEmote('celebrate', 0.5, frame);
  assert.ok(frame.stars > 0.9, 'sparkle eyes');
});

test('the signature channels show up: hearts, wink, wide, sleepy, paw, look, spin', () => {
  const peak = (name: (typeof EMOTE_NAMES)[number], channel: ExpressionChannel): number => {
    const frame = restingExpression();
    let best = 0;
    for (let t = 0; t < EMOTE_SPECS[name].seconds; t += 0.02) best = Math.max(best, Math.abs(sampleEmote(name, t, frame)[channel]));
    return best;
  };
  assert.ok(peak('love', 'hearts') > 0.95);
  assert.ok(peak('wink', 'wink') > 0.95);
  assert.ok(peak('surprised', 'wide') > 0.95 && peak('surprised', 'mouthO') > 0.95);
  assert.ok(peak('sleepy', 'sleepy') > 0.95 && peak('sleepy', 'mouthO') > 0.95);
  assert.ok(peak('wave', 'paw') > 0.95 && peak('wave', 'swing') > 0.9);
  assert.ok(peak('look-around', 'look') > 0.95 && peak('look-around', 'lookX') > 0.7);
  assert.ok(peak('streak', 'yaw') > 6);
});

test('cues land inside their emote, name real effects, and fit a 31-bit mask', () => {
  for (const name of EMOTE_NAMES) {
    const { seconds, cues } = EMOTE_SPECS[name];
    assert.ok(cues.length < 31);
    for (const cue of cues) {
      assert.ok(cue.at >= 0 && cue.at < seconds, `${name} cue at ${cue.at}`);
      assert.ok(cue.effect in EFFECT_KINDS);
      assert.ok(cue.count >= 1 && cue.count <= EFFECT_KINDS[cue.effect].capacity);
    }
  }
  assert.ok(EMOTE_SPECS.streak.cues.some((cue) => cue.effect === 'confetti'));
  assert.ok(EMOTE_SPECS.love.cues.every((cue) => cue.effect === 'heart'));
});

test('envelope rises, holds and falls inside its life only', () => {
  assert.equal(envelope(0, 1, 0.2, 0.2), 0);
  assert.equal(envelope(0.5, 1, 0.2, 0.2), 1);
  assert.equal(envelope(1, 1, 0.2, 0.2), 0);
  assert.ok(envelope(0.1, 1, 0.2, 0.2) > 0 && envelope(0.1, 1, 0.2, 0.2) < 1);
});

test('folding a resting frame changes nothing; channels move the face the right way', () => {
  const rest = moodTarget('idle');
  assert.deepEqual(foldExpression(moodTarget('idle'), restingExpression()), rest);

  const wide = foldExpression(moodTarget('idle'), { ...restingExpression(), wide: 1 });
  assert.ok(wide.eyeOpen > 1.3);
  const happy = foldExpression(moodTarget('idle'), { ...restingExpression(), happy: 1 });
  assert.equal(happy.squint, 1);
  assert.equal(happy.smile, 1);
  const sleepy = foldExpression(moodTarget('idle'), { ...restingExpression(), sleepy: 1 });
  assert.ok(sleepy.eyeOpen < 0.3);
  const o = foldExpression(moodTarget('idle'), { ...restingExpression(), mouthO: 1 });
  assert.equal(o.smile, 0);
});

test('drowsiness adds heavy lids and a slump, and nothing at 0', () => {
  assert.deepEqual(addDrowsiness(restingExpression(), 0), restingExpression());
  const drowsy = addDrowsiness(restingExpression(), 1);
  assert.ok(drowsy.sleepy > 0.7 && drowsy.pitch > 0 && drowsy.lift < 0);
});
