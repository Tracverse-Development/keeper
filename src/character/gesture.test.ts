/**
 * Tests for the touch gesture classifier (pure: no DOM, no three.js).
 * Run: node --test --experimental-strip-types src/character/gesture.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { HitRegion } from './contract.ts';
import { CLICK_MS, GestureTracker, PAT_REARM_MS, type GestureEvent, type GestureSample } from './gesture.ts';

const at = (x: number, y: number, t: number, region: HitRegion | null = 'head'): GestureSample => ({ x, y, t, region });

/** Down at the first sample, move through the rest, up at the last; collects every event. */
function play(samples: GestureSample[]): { events: GestureEvent[]; tracker: GestureTracker } {
  const tracker = new GestureTracker();
  const events: GestureEvent[] = [];
  tracker.down(samples[0]);
  for (const sample of samples.slice(1, -1)) {
    const event = tracker.move(sample);
    if (event) events.push(event);
  }
  const last = samples[samples.length - 1];
  const moved = tracker.move(last);
  if (moved) events.push(moved);
  const ended = tracker.up(last);
  if (ended) events.push(ended);
  return { events, tracker };
}

/** A back-and-forth stroke: `swings` sweeps of `width` px, `stepMs` apart per 10 px step. */
function stroke(swings: number, width: number, stepMs: number, region: HitRegion | null = 'head'): GestureSample[] {
  const samples: GestureSample[] = [at(100, 100, 0, region)];
  let t = 0;
  for (let s = 0; s < swings; s++) {
    const dir = s % 2 === 0 ? 1 : -1;
    for (let step = 1; step <= width / 10; step++) {
      t += stepMs;
      const x = s % 2 === 0 ? 100 + step * 10 : 100 + width - step * 10;
      samples.push(at(x, 100 + dir, t, region));
    }
  }
  return samples;
}

test('a quick click on the head is a poke on the head', () => {
  const { events } = play([at(10, 10, 0, 'head'), at(12, 11, 120, 'head')]);
  assert.deepEqual(events, [{ kind: 'poke', region: 'head' }]);
});

test('a quick click on the body is a poke on the body', () => {
  const { events } = play([at(10, 10, 0, 'body'), at(10, 10, 80, 'body')]);
  assert.deepEqual(events, [{ kind: 'poke', region: 'body' }]);
});

test('a click that misses the character is nothing', () => {
  assert.deepEqual(play([at(10, 10, 0, null), at(10, 10, 80, null)]).events, []);
});

test('a slow press is not a poke', () => {
  assert.deepEqual(play([at(10, 10, 0), at(10, 10, CLICK_MS + 50)]).events, []);
});

test('a press that wanders past the slop is not a poke, even if it comes back', () => {
  assert.deepEqual(play([at(10, 10, 0), at(30, 10, 60), at(10, 10, 120)]).events, []);
});

test('stroking back and forth over the head is one pat on the head', () => {
  const { events } = play(stroke(3, 60, 20));
  assert.deepEqual(events, [{ kind: 'pat', region: 'head' }]);
});

test('a long single sweep over the character counts as a pat by travel', () => {
  const { events } = play(stroke(1, 160, 30, 'body'));
  assert.deepEqual(events, [{ kind: 'pat', region: 'body' }]);
});

test('a one-way drag that is short is a drag: no event', () => {
  assert.deepEqual(play(stroke(1, 80, 30)).events, []);
});

test('back and forth off the character is a drag: no event', () => {
  assert.deepEqual(play(stroke(4, 60, 20, null)).events, []);
});

test('a stroke too slow for the window never becomes a pat', () => {
  // 3 swings of 40 px at 400 ms per step: turns 1.6 s apart, ~30 px of travel per window.
  assert.deepEqual(play(stroke(3, 40, 400)).events, []);
});

test('a pat fires once per stroke burst and re-arms only after the cool-down', () => {
  const burst = stroke(20, 60, 20);
  const { events } = play(burst);
  const span = burst[burst.length - 1].t;
  assert.ok(events.length >= 2, 'a long stroke earns more than one pat');
  assert.ok(events.length <= Math.ceil(span / PAT_REARM_MS) + 1, `throttled: ${events.length} pats in ${span} ms`);
  assert.ok(events.every((event) => event.kind === 'pat'));
});

test('the up after a pat is never also a poke', () => {
  const { events } = play(stroke(3, 60, 5));
  assert.deepEqual(
    events.map((event) => event.kind),
    ['pat'],
  );
});

test('cursor: pointer over the character, grab while stroking, default elsewhere', () => {
  const tracker = new GestureTracker();
  assert.equal(tracker.cursor('head'), 'pointer');
  assert.equal(tracker.cursor(null), 'default');
  tracker.down(at(0, 0, 0));
  assert.equal(tracker.cursor('head'), 'pointer', 'a press alone is not a stroke yet');
  tracker.move(at(20, 0, 30));
  assert.equal(tracker.cursor('head'), 'grab');
  tracker.cancel();
  assert.equal(tracker.pressed, false);
  assert.equal(tracker.cursor(null), 'default');
});

test('a still hold on the character, then a move, picks it up: no pat, no poke', () => {
  const tracker = new GestureTracker();
  tracker.down({ x: 100, y: 100, t: 0, region: 'body' });
  assert.equal(tracker.carry(), null, 'not yet');
  // Moving back and forth a long way would be a pat, were it not being carried.
  for (let i = 1; i <= 20; i++) assert.equal(tracker.move({ x: 100 + (i % 2 ? 80 : -80), y: 100 + i * 4, t: 400 + i * 30, region: 'body' }), null);
  assert.deepEqual(tracker.carry(), { dx: -80, dy: 80 });
  assert.equal(tracker.cursor('body'), 'grab');
  assert.equal(tracker.up({ x: 20, y: 180, t: 1100, region: null }), null);
  assert.equal(tracker.carry(), null, 'let go');
});

test('moving straight away is still a stroke, and a press off the character never carries', () => {
  const stroke = new GestureTracker();
  stroke.down({ x: 100, y: 100, t: 0, region: 'head' });
  stroke.move({ x: 140, y: 100, t: 50, region: 'head' });
  stroke.move({ x: 100, y: 100, t: 500, region: 'head' });
  assert.equal(stroke.carry(), null, 'it moved before the hold was up');
  const off = new GestureTracker();
  off.down({ x: 5, y: 5, t: 0, region: null });
  off.move({ x: 60, y: 60, t: 900, region: null });
  assert.equal(off.carry(), null);
});
