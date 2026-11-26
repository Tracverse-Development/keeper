import assert from 'node:assert/strict';
import { test } from 'node:test';

import { passphraseProblem, restoredWords, savedWords, toBase64 } from './backup-view.ts';

test('backup: a passphrase must be long enough and, when saving, typed the same twice', () => {
  assert.equal(passphraseProblem('short'), 'Use at least 8 characters.');
  assert.equal(passphraseProblem('long enough', 'long enouh'), 'The two passphrases are not the same.');
  assert.equal(passphraseProblem('long enough', 'long enough'), null);
  assert.equal(passphraseProblem('long enough'), null);
});

test('backup: the words after saving and after bringing one in', () => {
  assert.match(savedWords({ keepers: 1, records: 1204 }), /^Saved 1 keeper and 1,204 records to your Downloads folder\./);
  assert.equal(restoredWords({ keepers: ['Trini Boi'], written: 88, already: 0 }), 'Brought in Trini Boi: 88 records written.');
  assert.equal(restoredWords({ keepers: ['Trini Boi', 'Pup', 'Sage'], written: 1, already: 2 }), 'Brought in Trini Boi, Pup and Sage: 1 record written. 2 records were already here and left as they were.');
});

test('backup: bytes become base64 exactly, however many', () => {
  assert.equal(toBase64(new Uint8Array([75, 69, 69, 80])), 'S0VFUA==');
  const big = new Uint8Array(100_000).map((_, i) => i % 251);
  assert.deepEqual(Uint8Array.from(atob(toBase64(big)), (c) => c.charCodeAt(0)), big);
});
