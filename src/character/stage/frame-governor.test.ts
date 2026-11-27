/**
 * Tests for the frame-time governor and the loop's pacing (pure).
 * Run: node --test --experimental-strip-types src/character/stage/frame-governor.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUDGET_MS, FrameGovernor, QUALITY_TIERS, RISE_HOLD_MS, SLOW_HOLD_MS, tierPixelRatio } from './frame-governor.ts';
import { BACKGROUND_FPS, FramePacer, RESUME_STEP_S, frameStep } from './frame-pace.ts';

/** Feeds `ms`-long frames for `forMs`, starting at `from`; returns the clock and every tier change. */
function run(g: FrameGovernor, ms: number, forMs: number, from: number): { now: number; changes: number[] } {
  const changes: number[] = [];
  let now = from;
  while (now < from + forMs) {
    now += ms;
    const t = g.sample(ms, now);
    if (t !== null) changes.push(t);
  }
  return { now, changes };
}

test('a smooth 60 fps keeper stays at the full look', () => {
  const g = new FrameGovernor();
  assert.deepEqual(run(g, BUDGET_MS, 30000, 0).changes, []);
  assert.equal(g.tier, 0);
});

test('a 120 Hz screen is headroom, not a problem', () => {
  const g = new FrameGovernor();
  assert.deepEqual(run(g, 1000 / 120, 30000, 0).changes, []);
});

test('frames that keep missing the budget step down one tier at a time, not on one slow frame', () => {
  const g = new FrameGovernor();
  // One slow frame among smooth ones changes nothing.
  let { now } = run(g, BUDGET_MS, 2000, 0);
  assert.equal(g.sample(80, now + 80), null);
  now = run(g, BUDGET_MS, 3000, now + 80).now;
  assert.equal(g.tier, 0);
  // Steady 30 fps: down one tier after the hold, then another after the next hold.
  const slow = run(g, 1000 / 30, SLOW_HOLD_MS + 1200, now);
  assert.deepEqual(slow.changes, [1]);
  const slower = run(g, 1000 / 30, SLOW_HOLD_MS + 1200, slow.now);
  assert.deepEqual(slower.changes, [2]);
});

test('it never steps below the cheapest tier', () => {
  const g = new FrameGovernor();
  run(g, 100, 120000, 0);
  assert.equal(g.tier, QUALITY_TIERS.length - 1);
});

test('the in-between band holds the tier (hysteresis)', () => {
  const g = new FrameGovernor(QUALITY_TIERS.length, 2);
  // ~50 fps: neither slow nor headroom.
  assert.deepEqual(run(g, 20, 120000, 0).changes, []);
  assert.equal(g.tier, 2);
});

test('headroom steps back up only after a long quiet spell, and a relapse doubles the wait', () => {
  const g = new FrameGovernor(QUALITY_TIERS.length, 2);
  let r = run(g, BUDGET_MS, RISE_HOLD_MS - 1000, 0);
  assert.deepEqual(r.changes, [], 'not yet');
  r = run(g, BUDGET_MS, 2000, r.now);
  assert.deepEqual(r.changes, [1], 'up one tier after the hold');
  // The dearer tier is too slow: it drops back at once.
  r = run(g, 1000 / 30, SLOW_HOLD_MS + 1200, r.now);
  assert.deepEqual(r.changes, [2]);
  // The next try waits twice as long.
  r = run(g, BUDGET_MS, RISE_HOLD_MS + 1000, r.now);
  assert.deepEqual(r.changes, [], 'the wait doubled');
  r = run(g, BUDGET_MS, RISE_HOLD_MS, r.now);
  assert.deepEqual(r.changes, [1]);
});

test('a pause is not a sample and restarts the measurement', () => {
  const g = new FrameGovernor();
  let r = run(g, 1000 / 30, SLOW_HOLD_MS - 300, 0);
  assert.equal(g.sample(5000, r.now + 5000), null);
  assert.equal(g.averageMs, null);
  // The slow spell before the pause does not count towards the hold.
  r = run(g, 1000 / 30, SLOW_HOLD_MS - 300, r.now + 5000);
  assert.deepEqual(r.changes, []);
  assert.equal(g.sample(Number.NaN, r.now), null);
  assert.equal(g.sample(-3, r.now), null);
});

test('tierPixelRatio: the screen ratio, capped by the tier, at least 1', () => {
  assert.equal(tierPixelRatio(2, QUALITY_TIERS[0]), 2);
  assert.equal(tierPixelRatio(3, QUALITY_TIERS[0]), 2);
  assert.equal(tierPixelRatio(2, QUALITY_TIERS[1]), 1.5);
  assert.equal(tierPixelRatio(1, QUALITY_TIERS[1]), 1);
  assert.equal(tierPixelRatio(0, QUALITY_TIERS[0]), 1);
  assert.equal(tierPixelRatio(Number.NaN, QUALITY_TIERS[0]), 1);
});

test('the tiers only ever get cheaper', () => {
  for (let i = 1; i < QUALITY_TIERS.length; i++) {
    const a = QUALITY_TIERS[i - 1];
    const b = QUALITY_TIERS[i];
    assert.ok(b.maxPixelRatio <= a.maxPixelRatio && b.samples <= a.samples && (a.bloom || !b.bloom));
    assert.notDeepEqual(a, b);
  }
});

test('frameStep: the first frame and a frame after a pause never jump', () => {
  assert.equal(frameStep(undefined, 1000), 0);
  assert.equal(frameStep(1000, 1016), 0.016);
  assert.equal(frameStep(1000, 61000), RESUME_STEP_S, 'a minute hidden is one frame');
  assert.equal(frameStep(1000, 900), 0);
  assert.equal(frameStep(Number.NaN, 900), 0);
});

test('FramePacer: every frame when focused, about BACKGROUND_FPS when not', () => {
  const p = new FramePacer();
  let drawn = 0;
  for (let i = 0; i < 60; i++) if (p.due((i * 1000) / 60)) drawn++;
  assert.equal(drawn, 60);
  p.setBackground(true);
  drawn = 0;
  for (let i = 0; i < 60; i++) if (p.due(1000 + (i * 1000) / 60)) drawn++;
  assert.ok(Math.abs(drawn - BACKGROUND_FPS) <= 1, `drew ${drawn}`);
  drawn = 0;
  for (let i = 0; i < 120; i++) if (p.due(2000 + (i * 1000) / 120)) drawn++;
  assert.ok(Math.abs(drawn - BACKGROUND_FPS) <= 1, `120 Hz: drew ${drawn}`);
  p.setBackground(false);
  p.reset();
  assert.equal(p.due(5000), true);
});
