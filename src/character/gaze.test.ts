/**
 * Tests for the pure gaze follower. Run: node --test --experimental-strip-types src/character/gaze.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GazeFollower, POINTER_IDLE_SECONDS } from './gaze.ts';
import { moodTarget, motionProfile } from './moods.ts';

const NO_TOUCH = { poke: 0, pat: 0 };
const run = (gaze: GazeFollower, seconds: number, start = 0, mood = moodTarget('idle'), touch = NO_TOUCH): void => {
  for (let t = start; t < start + seconds; t += 1 / 60) gaze.step(1 / 60, t, mood, motionProfile(false), { x: 0, y: 0 }, touch);
};

test('the eyes follow the pointer relative to the head', () => {
  const gaze = new GazeFollower();
  gaze.point(0.5, -0.3);
  run(gaze, 1.5);
  assert.ok(gaze.gaze.x > 0.55, `x ${gaze.gaze.x}`);
  assert.ok(gaze.gaze.y < -0.3, `y ${gaze.gaze.y}`);
});

test('pointer values are clamped and NaN is ignored', () => {
  const gaze = new GazeFollower();
  assert.equal(gaze.point(Number.NaN, 0), false);
  assert.equal(gaze.pointerIdleSeconds, Infinity);
  assert.equal(gaze.point(9, -9), true);
  run(gaze, 2);
  assert.ok(gaze.gaze.x <= 1 && gaze.gaze.y >= -1);
});

test('without the pointer the gaze lets go and drifts near the rest point', () => {
  const gaze = new GazeFollower();
  gaze.point(1, 1);
  run(gaze, POINTER_IDLE_SECONDS + 4);
  assert.ok(gaze.following < 0.05);
  assert.ok(Math.abs(gaze.gaze.x) < 0.5 && Math.abs(gaze.gaze.y) < 0.5);
});

test('a poke turns the eyes to the viewer', () => {
  const gaze = new GazeFollower();
  gaze.point(1, 0);
  run(gaze, 1);
  run(gaze, 0.5, 1, moodTarget('idle'), { poke: 1, pat: 0 });
  assert.ok(Math.abs(gaze.gaze.x) < 0.1, `x ${gaze.gaze.x}`);
});

test('an idle glance steers a resting gaze, but the pointer wins', () => {
  const resting = new GazeFollower();
  const glance = { look: 1, lookX: -0.8, lookY: 0 };
  for (let t = 0; t < 2; t += 1 / 60) resting.step(1 / 60, t, moodTarget('idle'), motionProfile(false), { x: 0, y: 0 }, NO_TOUCH, glance);
  assert.ok(resting.gaze.x < -0.6, `x ${resting.gaze.x}`);

  const following = new GazeFollower();
  for (let t = 0; t < 2; t += 1 / 60) {
    following.point(0.6, 0);
    following.step(1 / 60, t, moodTarget('idle'), motionProfile(false), { x: 0, y: 0 }, NO_TOUCH, glance);
  }
  assert.ok(following.gaze.x > 0.6, `x ${following.gaze.x}`);
});
