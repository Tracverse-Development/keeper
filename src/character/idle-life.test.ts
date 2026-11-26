/**
 * Tests for the habits and the idle life they drive (pure).
 * Run: node --test --experimental-strip-types src/character/idle-life.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOZE_AFTER, HABITS, MAX_HABIT, SPECIES_HABITS, dozeAfter, habitsOf, resolveHabits } from './habits.ts';
import { IDLE_GAP, IdleLife, idleActions } from './idle-life.ts';
import { EMOTE_NAMES } from './emotes.ts';

/** Plays `n` idle picks with a seeded random and counts each emote. */
function picks(life: IdleLife, n: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const action = life.step(IDLE_GAP[1] + 1, true, true);
    if (action) out[action] = (out[action] ?? 0) + 1;
  }
  return out;
}

function seeded(seed = 7): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

test('every habit with an emote names a real emote; species-only habits stay with their species', () => {
  for (const h of HABITS) if (h.emote) assert.ok(EMOTE_NAMES.includes(h.emote), h.id);
  assert.ok(habitsOf('robot').some((h) => h.id === 'hum') && !habitsOf('robot').some((h) => h.id === 'chase-tail' || h.id === 'scratch'));
  assert.ok(habitsOf('puppy').some((h) => h.id === 'chase-tail') && habitsOf('puppy').some((h) => h.id === 'scratch') && !habitsOf('puppy').some((h) => h.id === 'hum'));
  for (const [species, defaults] of Object.entries(SPECIES_HABITS)) {
    assert.deepEqual(Object.keys(defaults).sort(), habitsOf(species).map((h) => h.id).sort(), `${species} has a default for every habit it has`);
  }
});

test('resolveHabits: own weights clamped over the species defaults; unknown and other-species habits dropped', () => {
  const h = resolveHabits({ sleep: 9, hum: 2, 'chase-tail': 1, fly: 3, wink: Number.NaN, nod: -1 }, 'robot');
  assert.equal(h.sleep, MAX_HABIT);
  assert.equal(h.hum, 2);
  assert.equal(h.nod, 0);
  assert.equal(h.wink, SPECIES_HABITS.robot.wink, 'NaN falls back to the default');
  assert.ok(!('chase-tail' in h) && !('fly' in h));
  assert.deepEqual(resolveHabits(null, 'puppy'), SPECIES_HABITS.puppy);
});

test('weight 0 never plays; the weights set the share of the picks', () => {
  const quiet = new IdleLife(seeded());
  quiet.setHabits({ stretch: 0, 'look-around': 0, wink: 0, nod: 0, 'chase-tail': 0, scratch: 3 }, 'puppy');
  assert.deepEqual(Object.keys(picks(quiet, 200)), ['scratch']);
  const none = new IdleLife(seeded());
  none.setHabits({ stretch: 0, 'look-around': 0, wink: 0, nod: 0, hum: 0 }, 'robot');
  assert.deepEqual(picks(none, 50), {}, 'all habits off: it just breathes');
  const mixed = new IdleLife(seeded(3));
  mixed.setHabits({ stretch: 3, 'look-around': 0, wink: 0, nod: 0, hum: 1 }, 'robot');
  const counts = picks(mixed, 2000);
  assert.ok(Math.abs(counts.stretch / counts.hum - 3) < 0.5, JSON.stringify(counts));
});

test('a dog never hums and a robot never chases its tail, whatever the keeper asks', () => {
  const robot = new IdleLife(seeded(11));
  robot.setHabits({ 'chase-tail': 3, scratch: 3 }, 'robot');
  const r = picks(robot, 500);
  assert.ok(!r['chase-tail'] && !r.scratch && r.hum > 0, JSON.stringify(r));
  const dog = new IdleLife(seeded(11));
  dog.setHabits({ hum: 3 }, 'puppy');
  const d = picks(dog, 500);
  assert.ok(!d.hum && d['chase-tail'] > 0 && d.scratch > 0, JSON.stringify(d));
});

test('the sleep habit sets how soon a quiet keeper dozes; 0 never', () => {
  assert.equal(dozeAfter(1), DOZE_AFTER);
  assert.ok(dozeAfter(3) < dozeAfter(1) && dozeAfter(0.5) > dozeAfter(1));
  assert.equal(dozeAfter(0), Infinity);
  assert.equal(idleActions(resolveHabits({}, 'robot'), 'robot').some((a) => (a.emote as string) === 'sleep'), false, 'sleep is a state, not an emote');
});
