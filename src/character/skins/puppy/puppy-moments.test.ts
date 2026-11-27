/**
 * The dog's item-moment poses and its default fur (pure).
 * Run: node --test --experimental-strip-types src/character/skins/puppy/puppy-moments.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasFur, momentDials, PUPPY_MOMENTS } from './puppy-moments.ts';

test('every coat zone is furred unless its look picks another material; the eyes never are', () => {
  for (const zone of ['head', 'ears', 'muzzle', 'body', 'legs', 'paws', 'tail']) assert.ok(hasFur(zone, undefined), zone);
  assert.ok(!hasFur('eyes', undefined));
  assert.ok(!hasFur('body', 'gloss') && !hasFur('head', 'matte'), 'a chosen smooth material turns fur off');
  assert.ok(hasFur('eyes', 'fur'), 'asking for fur grows it anywhere');
});

test('each moment poses something, nothing at its ends, and no moment means no pose', () => {
  const rest = momentDials(null);
  assert.ok(Object.values(rest).every((v) => v === 0));
  for (const row of PUPPY_MOMENTS) {
    const mid = momentDials({ id: row.id, progress: 0.5, envelope: 1, elapsed: row.duration / 2 + 0.03 });
    assert.ok(Object.values(mid).some((v) => Math.abs(v) > 1e-3), `${row.id} moves the dog`);
    const end = momentDials({ id: row.id, progress: 1, envelope: 0, elapsed: row.duration });
    assert.ok(Object.values(end).every((v) => Math.abs(v) < 1e-9), `${row.id} is still at its end`);
  }
});
