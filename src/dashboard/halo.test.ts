import assert from 'node:assert/strict';
import { test } from 'node:test';

import { haloNodes, withFactHalo } from './halo.ts';

test('the halo has one node per fact, within the graph it can draw', () => {
  assert.equal(haloNodes(0), 3);
  assert.equal(haloNodes(17), 17);
  assert.equal(haloNodes(900), 48);
});

test('only the halo is seeded; unknown counts leave the outfit alone', () => {
  const worn = [{ part: 'memory-halo', effects: { color: 'gold' } }, { part: 'ark-hull' }];
  assert.deepEqual(withFactHalo(worn, 12), [{ part: 'memory-halo', effects: { color: 'gold', nodes: 12 } }, { part: 'ark-hull' }]);
  assert.equal(withFactHalo(worn, null), worn);
});
