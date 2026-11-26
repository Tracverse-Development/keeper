/**
 * Tests for the expression state machine, idle life and speech bars (pure).
 * Run: node --test --experimental-strip-types src/character/expression.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMOTE_SPECS } from './emotes.ts';
import { DROWSY_AFTER, ExpressionMachine, PRIORITY } from './expression.ts';
import { NAP_AFTER_DOZE } from './habits.ts';
import { IDLE_GAP, IdleLife } from './idle-life.ts';
import { BAR_COUNT, speechBars } from './speech-bars.ts';

/** The state's kind, read fresh (assert narrowing would otherwise pin the first answer). */
const kindOf = (machine: ExpressionMachine): string => machine.state.kind;

test('an emote plays for its timeline, then the machine returns to neutral', () => {
  const machine = new ExpressionMachine();
  assert.equal(kindOf(machine), 'neutral');
  assert.ok(machine.trigger('wink', 10));
  assert.equal(machine.playing(10.3)?.emote, 'wink');
  machine.step(10.3, 0, 'idle');
  assert.equal(kindOf(machine), 'emoting');
  machine.step(10 + EMOTE_SPECS.wink.seconds, 0, 'idle');
  assert.equal(kindOf(machine), 'neutral');
  assert.equal(machine.playing(12), null);
});

test('a delayed emote waits (negative elapsed) before it starts', () => {
  const machine = new ExpressionMachine();
  machine.trigger('wave', 0, PRIORITY.idle, 0.7);
  assert.ok((machine.playing(0.2)?.elapsed ?? 0) < 0);
  machine.step(0.5, 0, 'idle');
  assert.equal(kindOf(machine), 'emoting');
});

test('an idle emote never cuts an asked one short; an asked one replaces anything', () => {
  const machine = new ExpressionMachine();
  machine.trigger('celebrate', 0, PRIORITY.asked);
  assert.equal(machine.trigger('stretch', 0.5, PRIORITY.idle), false);
  assert.equal(machine.playing(0.5)?.emote, 'celebrate');
  assert.ok(machine.trigger('love', 0.6, PRIORITY.asked));
  assert.equal(machine.playing(0.7)?.emote, 'love');
  // Once the asked emote is over, an idle one may start.
  assert.ok(machine.trigger('nod', 0.6 + EMOTE_SPECS.love.seconds + 0.1, PRIORITY.idle));
});

test('every trigger is a new instance, even the same emote again', () => {
  const machine = new ExpressionMachine();
  machine.trigger('love', 0);
  const first = machine.playing(0.1)?.instance;
  machine.trigger('love', 0.2);
  assert.notEqual(machine.playing(0.3)?.instance, first);
});

test('a long quiet spell while idle turns drowsy; activity or another mood wakes it', () => {
  const machine = new ExpressionMachine();
  machine.step(1, DROWSY_AFTER - 1, 'idle');
  assert.equal(machine.drowsy, false);
  machine.step(2, DROWSY_AFTER, 'idle');
  assert.equal(machine.drowsy, true);
  machine.step(3, 0, 'idle');
  assert.equal(machine.drowsy, false);
  machine.step(4, DROWSY_AFTER + 5, 'thinking');
  assert.equal(machine.drowsy, false, 'never drowsy while working');
});

test('an emote ending deep in a quiet spell goes straight to drowsy; a trigger wakes it', () => {
  const machine = new ExpressionMachine();
  machine.trigger('stretch', 0, PRIORITY.idle);
  machine.step(EMOTE_SPECS.stretch.seconds + 0.1, DROWSY_AFTER + 10, 'idle');
  assert.equal(machine.drowsy, true);
  machine.trigger('wave', 100);
  assert.equal(kindOf(machine), 'emoting');
});

test('a doze that lasts becomes a nap; the sleep habit sets how soon; activity ends it', () => {
  const machine = new ExpressionMachine();
  machine.step(10, 40, 'idle', 30);
  assert.equal(machine.drowsy, true, 'a heavy sleeper dozes after 30 s');
  assert.equal(machine.napping(10 + NAP_AFTER_DOZE - 1), false);
  assert.equal(machine.napping(10 + NAP_AFTER_DOZE), true);
  machine.step(30, 0, 'idle', 30);
  assert.equal(machine.napping(30), false, 'the pointer, a voice or a turn wakes it');
  const never = new ExpressionMachine();
  never.step(1000, 1e6, 'idle', Infinity);
  assert.equal(never.drowsy, false, 'sleep weight 0 never dozes');
});

test('idle life acts only when free, after a gap inside IDLE_GAP', () => {
  const life = new IdleLife(() => 0);
  assert.equal(life.step(IDLE_GAP[1] + 1, false, true), null);
  let elapsed = 0;
  let action = null;
  while (!action && elapsed < 60) {
    action = life.step(0.5, true, true);
    elapsed += 0.5;
  }
  assert.equal(action, 'stretch', 'the first habit with an emote wins a zero roll');
  assert.ok(elapsed >= IDLE_GAP[0] && elapsed <= IDLE_GAP[1] + 0.5);
});

test('idle life never glances around while the pointer moves', () => {
  for (const r of [0, 0.2, 0.5, 0.99]) {
    const life = new IdleLife(() => r);
    const action = life.step(IDLE_GAP[1] + 1, true, false);
    assert.notEqual(action, 'look-around');
    assert.ok(action);
  }
});

test('speech bars: silent at 0, centre tallest, bounded, NaN safe', () => {
  const out = new Float32Array(BAR_COUNT);
  speechBars(0, 3, out);
  assert.deepEqual([...out], [0, 0, 0, 0, 0]);
  speechBars(Number.NaN, 3, out);
  assert.deepEqual([...out], [0, 0, 0, 0, 0]);
  let centreWins = 0;
  for (let t = 0; t < 10; t += 0.1) {
    speechBars(1, t, out);
    for (const h of out) assert.ok(h >= 0 && h <= 1);
    if (out[2] >= out[0] && out[2] >= out[4]) centreWins++;
  }
  assert.ok(centreWins > 60, `centre tallest ${centreWins}/100`);
});
