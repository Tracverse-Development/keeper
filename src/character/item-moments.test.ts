/**
 * Tests for the item-moment scheduler (pure).
 * Run: node --test --experimental-strip-types src/character/item-moments.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createItemMoments, envelopeAt, isFree, ITEM_GAP, type ItemMoment, type MomentFrame } from './item-moments.ts';
import { restingExpression } from './expression-frame.ts';
import { OWL_MOMENTS } from './skins/owl/owl-moments.ts';
import { PUPPY_MOMENTS } from './skins/puppy/puppy-moments.ts';
import { PARTS } from './parts/catalog.ts';

const TABLE: ItemMoment[] = [
  { id: 'adjust', parts: ['round-spectacles'], weight: 1, duration: 2, cooldown: 30 },
  { id: 'tassel', parts: ['soft-hat'], weight: 1, duration: 1, cooldown: 10 },
];

function frame(over: Partial<MomentFrame> = {}): MomentFrame {
  return {
    dt: 0.5,
    weights: { idle: 1, listening: 0, thinking: 0, speaking: 0, happy: 0, asleep: 0 },
    touch: { poke: 0, pat: 0 } as MomentFrame['touch'],
    work: 0,
    motion: { amplitude: 1, speed: 1 } as MomentFrame['motion'],
    emote: restingExpression(),
    ...over,
  };
}

/** Steps until a moment starts (or gives up), returning its id. */
function runUntilMoment(m: ReturnType<typeof createItemMoments>, f: MomentFrame, seconds: number): string | null {
  for (let t = 0; t < seconds; t += f.dt) {
    const active = m.step(f);
    if (active) return active.id;
  }
  return null;
}

test('nothing worn, nothing plays; a worn part offers its moment after a free gap', () => {
  const m = createItemMoments(TABLE, () => 0);
  assert.equal(runUntilMoment(m, frame(), 120), null);
  m.setWorn(['round-spectacles']);
  assert.equal(runUntilMoment(m, frame(), ITEM_GAP[0] + 1), 'adjust', 'starts once the shortest gap has passed (random 0)');
});

test('only while free: busy, touched, working, thinking or under reduced motion, it waits', () => {
  const m = createItemMoments(TABLE, () => 0);
  m.setWorn(['round-spectacles']);
  const busy: MomentFrame[] = [
    frame({ work: 0.5 }),
    frame({ touch: { poke: 0.8, pat: 0 } as MomentFrame['touch'] }),
    frame({ weights: { idle: 0.2, listening: 0, thinking: 0.8, speaking: 0, happy: 0, asleep: 0 } }),
    frame({ emote: { ...restingExpression(), paw: 1 } }),
    frame({ motion: { amplitude: 0, speed: 1 } as MomentFrame['motion'] }),
  ];
  for (const f of busy) assert.equal(runUntilMoment(m, f, 200), null);
  assert.ok(!isFree(busy[0]) && isFree(frame()));
});

test('the envelope eases in and out and never jumps', () => {
  assert.equal(envelopeAt(0), 0);
  assert.equal(envelopeAt(1), 0);
  assert.equal(envelopeAt(0.5), 1);
  for (let p = 0; p < 1; p += 0.01) assert.ok(Math.abs(envelopeAt(p + 0.01) - envelopeAt(p)) < 0.08, `smooth at ${p}`);
});

test('a moment rests for its cooldown, and taking the part off stops it at once', () => {
  const m = createItemMoments(TABLE, () => 0);
  m.setWorn(['round-spectacles']);
  assert.ok(m.play('adjust'));
  let last = null;
  for (let i = 0; i < 4; i++) last = m.step(frame());
  assert.equal(last, null, 'it ended after its 2 s');
  assert.equal(runUntilMoment(m, frame(), 25), null, 'resting: not again within its 30 s cooldown');
  assert.ok(m.play('adjust') === true);
  m.setWorn([]);
  assert.equal(m.step(frame()), null, 'spectacles off: the gesture stops');
  assert.equal(m.play('tassel'), false, 'a moment for a part not worn is never on offer');
});

test("the owl's and the dog's tables name real parts, with sane timings and unique ids", () => {
  const ids = new Set(PARTS.map((p) => p.id as string));
  for (const [name, table] of [['owl', OWL_MOMENTS], ['dog', PUPPY_MOMENTS]] as const) {
    const seen = new Set<string>();
    for (const row of table) {
      assert.ok(!seen.has(row.id), `${name}: ${row.id} twice`);
      seen.add(row.id);
      for (const p of row.parts) assert.ok(ids.has(p), `${name}.${row.id}: unknown part ${p}`);
      assert.ok(row.weight > 0 && row.duration > 0.5 && row.duration < 6 && row.cooldown >= row.duration, `${name}.${row.id} timings`);
    }
    assert.ok(table.length >= 4, `${name} has several moments`);
  }
});
