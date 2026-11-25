/**
 * Tests for the thinking beat curves: drama scaling, cycles, heartbeat, rings, the "got it"
 * envelope and trigger, waves, bubble dots, tilt, twitch and sniff (pure).
 * Run: node --test --experimental-strip-types src/character/thinking.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GOT_IT_SECONDS,
  bubbleDot,
  cyclePhase,
  gotItEnvelope,
  heartbeat,
  heartbeatRate,
  holdWave,
  isGotIt,
  nodeWave,
  ringPulse,
  scanSweep,
  sniff,
  thinkDrama,
  twitch,
} from './thinking.ts';

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('thinkDrama is exactly 0 when not thinking, and grows with work', () => {
  assert.equal(thinkDrama(0, 0), 0);
  assert.equal(thinkDrama(0, 1), 0);
  close(thinkDrama(1, 0), 0.6);
  close(thinkDrama(1, 1), 1);
  assert.ok(thinkDrama(1, 0.9) > thinkDrama(1, 0.4));
  assert.ok(thinkDrama(0.5, 0.4) < thinkDrama(1, 0.4));
  assert.equal(thinkDrama(Number.NaN, 1), 0);
  close(thinkDrama(3, 5), 1);
});

test('cyclePhase wraps into 0..1, negatives too, and guards bad periods', () => {
  close(cyclePhase(2.5, 1), 0.5);
  close(cyclePhase(-0.25, 1), 0.75);
  close(cyclePhase(3.6, 1.2), 0);
  assert.equal(cyclePhase(1, 0), 0);
  assert.equal(cyclePhase(Number.NaN, 1), 0);
});

test('heartbeat has a strong lub, a softer dub and rests near 0', () => {
  close(heartbeat(0.1), 1, 0.02);
  assert.ok(heartbeat(0.3) > 0.5 && heartbeat(0.3) < 0.7);
  assert.ok(heartbeat(0.7) < 1e-6);
  assert.ok(heartbeatRate(1) > heartbeatRate(0.4) && heartbeatRate(0.4) > heartbeatRate(0));
});

test('scanSweep sweeps -1 -> 1 -> -1 smoothly', () => {
  close(scanSweep(0), -1);
  close(scanSweep(0.5), 1);
  close(scanSweep(1), -1);
});

test('ringPulse grows and fades: invisible at birth and death, never snaps', () => {
  const r = { radius: 0, fade: 0 };
  ringPulse(0, r);
  close(r.radius, 1);
  assert.equal(r.fade, 0);
  ringPulse(1, r);
  close(r.radius, 2.3);
  assert.equal(r.fade, 0);
  let last = 1;
  for (let p = 0; p <= 1; p += 0.01) {
    ringPulse(p, r);
    assert.ok(r.radius >= last - 1e-12, 'radius only grows');
    last = r.radius;
  }
  ringPulse(0.1, r);
  assert.ok(r.fade > 0.7);
});

test('gotItEnvelope rises quickly, falls smoothly and is 0 outside the beat', () => {
  assert.equal(gotItEnvelope(0), 0);
  assert.equal(gotItEnvelope(-1), 0);
  assert.equal(gotItEnvelope(Infinity), 0);
  assert.equal(gotItEnvelope(GOT_IT_SECONDS), 0);
  close(gotItEnvelope(GOT_IT_SECONDS * 0.12), 1);
  assert.ok(gotItEnvelope(GOT_IT_SECONDS * 0.5) < 1 && gotItEnvelope(GOT_IT_SECONDS * 0.5) > 0.2);
  assert.ok(gotItEnvelope(GOT_IT_SECONDS * 0.99) < 0.01, 'no snap at the end');
});

test('isGotIt fires only when a reply follows real thinking', () => {
  assert.equal(isGotIt('thinking', 'speaking', 0.9), true);
  assert.equal(isGotIt('thinking', 'happy', 0.5), true);
  assert.equal(isGotIt('thinking', 'idle', 1), false);
  assert.equal(isGotIt('listening', 'speaking', 1), false);
  assert.equal(isGotIt('thinking', 'speaking', 0.1), false);
});

test('nodeWave lights narrow travelling bands', () => {
  assert.equal(nodeWave(0, 0, 4), 0);
  close(nodeWave(Math.PI / 6, 0, 4), 1);
  close(nodeWave(Math.PI / 6 + 1 / 3, 1, 1), 1, 1e-9);
  assert.equal(nodeWave(-Math.PI / 6, 0, 4), 0);
});

test('bubbleDot: dots appear in order, pop together, and are gone before the loop repeats', () => {
  const d = { size: 0, bright: 0, rise: 0 };
  assert.equal(bubbleDot(0, 0, d).bright, 0);
  assert.ok(bubbleDot(0, 0.3, d).bright > 0.9);
  assert.equal(bubbleDot(2, 0.3, d).bright, 0, 'the third dot is not there yet');
  assert.ok(bubbleDot(2, 0.6, d).bright > 0.9);
  const before = bubbleDot(1, 0.7, d).size;
  assert.ok(bubbleDot(1, 0.79, d).size > before, 'pop swells');
  for (const i of [0, 1, 2]) assert.equal(bubbleDot(i, 0.9, d).bright, 0);
  assert.equal(bubbleDot(0, 0.999, d).bright, 0);
});

test('holdWave reaches both sides and lingers there', () => {
  close(holdWave(0.25), 1);
  close(holdWave(0.75), -1);
  close(holdWave(0), 0);
  assert.ok(holdWave(0.15) > Math.sin(0.15 * Math.PI * 2), 'lingers nearer the side than a sine');
});

test('twitch and sniff are brief and rest at 0', () => {
  close(twitch(0.25), 1);
  assert.ok(twitch(0.1) < 0.1);
  assert.equal(twitch(0.6), 0);
  close(sniff(0.06), 1);
  close(sniff(0.18), 1);
  assert.equal(sniff(0.5), 0);
  assert.ok(sniff(0.12) < 1e-9);
});
