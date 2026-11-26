import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clockLeft, isOver } from './focus-view.ts';

test('focus: the time left reads as a clock and stops at zero', () => {
  const now = Date.parse('2026-11-26T10:00:00Z');
  assert.equal(clockLeft('2026-11-26T10:25:00Z', now), '25:00');
  assert.equal(clockLeft('2026-11-26T10:24:10Z', now), '24:10');
  assert.equal(clockLeft('2026-11-26T10:00:05Z', now), '0:05');
  assert.equal(clockLeft('2026-11-26T09:59:00Z', now), '0:00');
  assert.equal(clockLeft('not a time', now), '0:00');
  assert.equal(isOver('2026-11-26T09:59:00Z', now), true);
  assert.equal(isOver('2026-11-26T10:25:00Z', now), false);
});
