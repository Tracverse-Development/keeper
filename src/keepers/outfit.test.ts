import { test } from 'node:test';
import assert from 'node:assert/strict';

import { outfitChoices, wear } from './outfit.ts';

const kit = {
  species: [{ id: 'puppy', name: 'Dog', slots: ['halo', 'base'] }],
  parts: [
    { id: 'memory-halo', name: 'Memory Halo', slot: 'halo', species: [], effects: [] },
    { id: 'visor-glow', name: 'Visor Glow', slot: 'halo', species: ['robot'], effects: [] },
    { id: 'ark-hull', name: 'Ark Hull', slot: 'base', species: [], effects: [] },
  ],
  roles: [],
  souls: [],
  variants: [{ id: 'ruby-halo', name: 'Ruby Halo', part: 'memory-halo', effects: { color: '#e2425f' } }],
};

test('a dog can wear the halo and its variants, not robot-only parts', () => {
  const names = outfitChoices(kit as never, 'puppy', 'halo').map((c) => c.name);
  assert.deepEqual(names, ['Memory Halo', 'Ruby Halo']);
});

test('one part per slot', () => {
  const outfit = wear([{ part: 'memory-halo' }, { part: 'ark-hull' }], kit as never, 'halo', { part: 'memory-halo', effects: { color: '#e2425f' } });
  assert.equal(outfit.length, 2);
  assert.deepEqual(wear(outfit, kit as never, 'halo', null), [{ part: 'ark-hull' }]);
});
