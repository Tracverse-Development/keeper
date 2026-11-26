import { test } from 'node:test';
import assert from 'node:assert/strict';

import { nameFromFacts } from './person-name.ts';

test('the first name comes from the identity fact', () => {
  assert.equal(nameFromFacts([{ text: 'Your name is Ada Lovelace', category: 'identity' }]), 'Ada');
  assert.equal(nameFromFacts([{ text: 'You love sorrel', category: 'preference' }]), null);
});
