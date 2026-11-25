import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formMessage, unsaid } from './unsaid.ts';

test('the reply is never said twice', () => {
  assert.equal(unsaid('Here it is.', ''), 'Here it is.');
  assert.equal(unsaid('Here it is.', 'Here it is.'), '');
  assert.equal(unsaid('Here it is. Opened Safari.', 'Here it is.'), 'Opened Safari.');
  assert.equal(unsaid('Something else entirely.', 'Here it is.'), 'Something else entirely.');
});

test('a submitted form becomes the next message', () => {
  assert.equal(formMessage('Plan your trip', { where_to: 'Edinburgh', people: '4', notes: ' ' }), 'My answers for "Plan your trip": where to: Edinburgh; people: 4.');
});
