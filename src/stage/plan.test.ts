/**
 * Tests for reading the keeper's plan (pure).
 * Run: node --test --experimental-strip-types src/stage/plan.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDestructive } from './plan.ts';

test('destructive verbs in any form are caught', () => {
  for (const verb of ['Delete', 'delete files', 'Deleting', 'Remove', 'removed', 'Overwrite', 'Move to Trash', 'move to the bin',
    'Send', 'Send email', 'sent', 'Pay', 'paying', 'Paid', 'Trash', 'Erase', 'Wipe']) assert.ok(isDestructive(verb), verb);
  assert.ok(isDestructive('Move', 'to the Trash'));
});

test('safe verbs are not', () => {
  for (const verb of ['Open', 'Create', 'Move', 'Rename', 'Copy', 'Read', 'Find', 'Make folder', 'Sort', 'Payload check', 'Sender list', 'Remover tool'])
    assert.ok(!isDestructive(verb), verb);
});
