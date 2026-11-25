/**
 * Tests for the pure mood table and easing maths (no three.js, no DOM).
 * Run: node --test --experimental-strip-types src/character/moods.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLINK_DURATION,
  BLINK_MAX_GAP,
  BLINK_MIN_GAP,
  MOOD_NAMES,
  MOOD_TABLE,
  blendInto,
  blinkClosure,
  clampUnit,
  damp,
  easeInOut,
  isMood,
  moodTarget,
  motionProfile,
  nextBlinkDelay,
} from './moods.ts';

test('every mood of the contract has a row, and every row has the same dials', () => {
  assert.deepEqual([...MOOD_NAMES].sort(), ['asleep', 'happy', 'idle', 'listening', 'speaking', 'thinking']);
  const idleKeys = Object.keys(MOOD_TABLE.idle).sort();
  for (const mood of MOOD_NAMES) {
    assert.deepEqual(Object.keys(MOOD_TABLE[mood]).sort(), idleKeys, mood);
    for (const value of Object.values(MOOD_TABLE[mood])) assert.ok(Number.isFinite(value), mood);
  }
});

test('moods look the way the contract describes them', () => {
  const t = MOOD_TABLE;
  assert.equal(t.asleep.eyeOpen, 0, 'asleep: eyes closed');
  assert.ok(t.asleep.glow < t.idle.glow && t.asleep.presence < t.idle.presence, 'asleep: dim');
  assert.ok(t.asleep.haloSpeed < t.idle.haloSpeed, 'asleep: halo slow');
  assert.ok(t.listening.eyeOpen > t.idle.eyeOpen, 'listening: eyes widen');
  assert.ok(t.listening.lean > 0, 'listening: leans in');
  assert.ok(t.listening.voiceGain > 0 && t.idle.voiceGain === 0, 'only listening reacts to the microphone');
  assert.ok(t.thinking.haloSpeed > 3 * t.idle.haloSpeed, 'thinking: halo orbits faster');
  assert.ok(t.thinking.gazeY > 0 && t.thinking.gazeX !== 0, 'thinking: looks up and aside');
  assert.ok(t.speaking.nod > 0, 'speaking: gentle nods');
  assert.ok(t.happy.squint > 0.5 && t.happy.smile > t.idle.smile, 'happy: smile and squint');
});

test('moodTarget returns a copy, never the shared row', () => {
  const copy = moodTarget('idle');
  copy.glow = 99;
  assert.notEqual(MOOD_TABLE.idle.glow, 99);
});

test('isMood guards unknown strings', () => {
  assert.equal(isMood('happy'), true);
  assert.equal(isMood('angry'), false);
  assert.equal(isMood('toString'), false);
  assert.equal(isMood(3), false);
});

test('damp is frame-rate independent and never overshoots', () => {
  const oneStep = damp(0, 1, 4, 1);
  let manySteps = 0;
  for (let i = 0; i < 60; i++) manySteps = damp(manySteps, 1, 4, 1 / 60);
  assert.ok(Math.abs(oneStep - manySteps) < 1e-9);
  assert.ok(oneStep > 0 && oneStep < 1);
  assert.equal(damp(0.3, 1, 4, 0), 0.3, 'no time, no movement');
});

test('blendInto eases every dial toward the target without snapping', () => {
  const current = moodTarget('idle');
  const target = MOOD_TABLE.asleep;
  blendInto(current, target, 3, 1 / 60);
  assert.ok(current.eyeOpen < 1 && current.eyeOpen > 0, 'moved, but not snapped');
  for (let i = 0; i < 600; i++) blendInto(current, target, 3, 1 / 60);
  assert.ok(Math.abs(current.eyeOpen - target.eyeOpen) < 1e-3, 'arrives in the end');
});

test('blinks come every 3 to 6 seconds', () => {
  assert.equal(nextBlinkDelay(() => 0), BLINK_MIN_GAP);
  assert.equal(nextBlinkDelay(() => 1), BLINK_MAX_GAP);
  assert.equal(nextBlinkDelay(() => 7), BLINK_MAX_GAP, 'bad random input is clamped');
  for (let i = 0; i < 100; i++) {
    const delay = nextBlinkDelay();
    assert.ok(delay >= 3 && delay <= 6);
  }
});

test('blinkClosure closes fully mid-blink and is open outside it', () => {
  assert.equal(blinkClosure(0), 0);
  assert.equal(blinkClosure(BLINK_DURATION), 0);
  assert.equal(blinkClosure(-1), 0);
  assert.ok(Math.abs(blinkClosure(BLINK_DURATION * 0.4) - 1) < 1e-9);
  assert.ok(blinkClosure(BLINK_DURATION * 0.2) > 0 && blinkClosure(BLINK_DURATION * 0.2) < 1);
});

test('easeInOut and clampUnit stay inside 0..1', () => {
  assert.equal(easeInOut(-2), 0);
  assert.equal(easeInOut(2), 1);
  assert.equal(easeInOut(0.5), 0.5);
  assert.equal(clampUnit(Number.NaN), 0);
  assert.equal(clampUnit(Infinity), 0);
  assert.equal(clampUnit(1.7), 1);
  assert.equal(clampUnit(-0.2), 0);
});

test('reduced motion is smaller and slower', () => {
  const full = motionProfile(false);
  const reduced = motionProfile(true);
  assert.deepEqual(full, { amplitude: 1, speed: 1 });
  assert.ok(reduced.amplitude < 1 && reduced.speed < 1);
});
