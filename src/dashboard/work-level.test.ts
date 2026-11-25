import { test } from 'node:test';
import assert from 'node:assert/strict';

import { workLevel } from './work-level.ts';

test('idle is still, acting runs hotter, load pushes toward overheating', () => {
  assert.equal(workLevel(null, { cpu: 90, memory: 90 }), 0);
  assert.equal(workLevel('done', null), 0);
  assert.ok(workLevel('acting', null) > workLevel('thinking', null));
  assert.ok(workLevel('thinking', { cpu: 95, memory: 40 }) > workLevel('thinking', { cpu: 5, memory: 40 }));
  assert.ok(workLevel('acting', { cpu: 100, memory: 100 }) <= 1);
});
