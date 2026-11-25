/**
 * Tests for the species reaction tables (pure data): the shared shape, sane timings and
 * the shipped touch numbers.
 * Run: node --test --experimental-strip-types src/character/skins/reactions.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_REACTION_TIMING, reactionEnvelope } from '../reactions.ts';
import { SKINS } from './catalog.ts';
import { PUPPY_REACTIONS } from './puppy/reactions.ts';
import { REACTION_FIELDS, type ReactionTable } from './reactions-table.ts';
import { ROBOT_REACTIONS } from './robot/reactions.ts';

const TABLES: Record<string, ReactionTable> = { robot: ROBOT_REACTIONS, puppy: PUPPY_REACTIONS };

test('every species in the catalogue has a reaction table', () => {
  assert.deepEqual(Object.keys(TABLES).sort(), SKINS.map((skin) => skin.id as string).sort());
});

test('every table has every shared section and field, all finite numbers', () => {
  for (const [species, table] of Object.entries(TABLES)) {
    for (const [section, fields] of Object.entries(REACTION_FIELDS)) {
      const row = (table as unknown as Record<string, Record<string, unknown>>)[section];
      assert.ok(row, `${species}.${section}`);
      for (const field of fields) assert.equal(typeof row[field], 'number', `${species}.${section}.${field}`);
      for (const [field, value] of Object.entries(row)) assert.ok(Number.isFinite(value), `${species}.${section}.${field}`);
    }
  }
});

test('touch timings are sane envelopes', () => {
  for (const [species, table] of Object.entries(TABLES)) {
    for (const kind of ['poke', 'pat'] as const) {
      const timing = table[kind];
      assert.ok(timing.attack > 0 && timing.attack < timing.seconds, `${species}.${kind} attack`);
      assert.ok(timing.holdShare >= 0 && timing.holdShare < 1, `${species}.${kind} hold`);
      let peak = 0;
      for (let t = 0; t < timing.seconds; t += 0.01) peak = Math.max(peak, reactionEnvelope(kind, t, timing));
      assert.equal(peak, 1, `${species}.${kind} peaks`);
      assert.equal(reactionEnvelope(kind, timing.seconds, timing), 0);
    }
  }
});

test('the shipped timings and touch numbers are unchanged', () => {
  for (const table of Object.values(TABLES)) {
    for (const kind of ['poke', 'pat'] as const) {
      const { seconds, attack, holdShare } = table[kind];
      assert.deepEqual({ seconds, attack, holdShare }, DEFAULT_REACTION_TIMING[kind]);
    }
  }
  assert.deepEqual(
    [ROBOT_REACTIONS.poke.lift, ROBOT_REACTIONS.poke.headPitch, ROBOT_REACTIONS.pat.headRoll, ROBOT_REACTIONS.celebrate.hopSpeed],
    [0.05, 0.14, 0.16, 1.7],
  );
  assert.deepEqual([PUPPY_REACTIONS.poke.earPop, PUPPY_REACTIONS.pat.tailSpeed, PUPPY_REACTIONS.sleep.headDrop], [0.6, 3.4, 0.14]);
});

test('work ranges are ordered within 0..1', () => {
  const r = ROBOT_REACTIONS.work;
  assert.ok(0 <= r.coolFrom && r.coolFrom < r.coolTo && r.coolTo <= r.hotFrom && r.hotFrom < r.hotTo && r.hotTo <= 1);
  assert.ok(r.heatFrom > 0 && r.emberFrom > r.heatFrom && r.emberFrom < 1);
  const p = PUPPY_REACTIONS.work;
  assert.ok(0 < p.pantFrom && p.pantFrom < p.pantTo && p.pantTo <= 1 && p.sweatFrom > p.pantFrom && p.sweatFrom < 1);
});
