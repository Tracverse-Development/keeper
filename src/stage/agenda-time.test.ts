/**
 * Tests for splitting an agenda row's time label (pure).
 * Run: node --test --experimental-strip-types src/stage/agenda-time.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agendaTime } from './agenda-time.ts';

test('the day part goes above the clock', () => {
  assert.deepEqual(agendaTime('Tomorrow 9:00 AM'), { day: 'Tomorrow', clock: '9:00 AM' });
  assert.deepEqual(agendaTime('4 Dec 10:30 PM'), { day: '4 Dec', clock: '10:30 PM' });
  assert.deepEqual(agendaTime('9:00 AM'), { clock: '9:00 AM' });
});

test('a label with no clock is shown whole', () => {
  assert.deepEqual(agendaTime('All day'), { clock: 'All day' });
  assert.deepEqual(agendaTime('Morning'), { clock: 'Morning' });
});
