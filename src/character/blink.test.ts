/**
 * Tests for the pure blink scheduler. Run: node --test --experimental-strip-types src/character/blink.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BlinkScheduler, DOUBLE_BLINK_GAP } from './blink.ts';
import { BLINK_DURATION, BLINK_MAX_GAP, BLINK_MIN_GAP } from './moods.ts';

/** Runs the scheduler at 60 fps for `seconds`, returning the times each blink started. */
function blinkStarts(scheduler: BlinkScheduler, seconds: number, eyeOpen = 1): number[] {
  const starts: number[] = [];
  const dt = 1 / 60;
  let wasBlinking = false;
  for (let time = dt; time < seconds; time += dt) {
    scheduler.step(time, dt, eyeOpen);
    if (scheduler.blinking && !wasBlinking) starts.push(time);
    wasBlinking = scheduler.blinking;
  }
  return starts;
}

test('blinks come every 3 to 6 seconds when no double blink is drawn', () => {
  const starts = blinkStarts(new BlinkScheduler(() => 0.5), 40);
  assert.ok(starts.length >= 6, `only ${starts.length} blinks`);
  for (let i = 1; i < starts.length; i++) {
    const gap = starts[i] - starts[i - 1];
    assert.ok(gap >= BLINK_MIN_GAP - 0.05 && gap <= BLINK_MAX_GAP + BLINK_DURATION + 0.05, `gap ${gap}`);
  }
});

// FIX-0007: the second blink of a double never earns a third.
test('a drawn double blink follows quickly, and never three in a row', () => {
  const starts = blinkStarts(new BlinkScheduler(() => 0), 20);
  const quick = starts.slice(1).map((t, i) => t - starts[i]).filter((gap) => gap < 1);
  assert.ok(quick.length > 0);
  for (const gap of quick) assert.ok(gap <= BLINK_DURATION + DOUBLE_BLINK_GAP + 0.05);
  for (let i = 2; i < starts.length; i++) assert.ok(starts[i] - starts[i - 2] > 1, 'a triple blink');
});

test('nearly shut eyes do not blink; blinkNow forces one', () => {
  const scheduler = new BlinkScheduler(() => 0.5);
  assert.equal(blinkStarts(scheduler, 20, 0.1).length, 0);
  scheduler.blinkNow(30);
  assert.ok(scheduler.blinking);
  assert.ok(scheduler.step(30 + BLINK_DURATION * 0.4, 0.01, 0) > 0.9, 'shut mid-blink');
  assert.equal(scheduler.step(30 + BLINK_DURATION + 0.01, 0.01, 0), 0);
});
