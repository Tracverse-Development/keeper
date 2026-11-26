import assert from 'node:assert/strict';
import { test } from 'node:test';

import { trustLine } from './pack-trust.ts';

const valid = { state: 'valid' as const, key: 'ab', fingerprint: '3f9a 21c0' };

test('pack trust: a broken signature is refused, a borrowed name is a warning', () => {
  assert.equal(trustLine({ signature: { state: 'broken' }, maker: 'Amos', seenBefore: false, otherKeyForName: false }).tone, 'bad');
  const borrowed = trustLine({ signature: valid, maker: 'Amos', seenBefore: false, otherKeyForName: true });
  assert.equal(borrowed.tone, 'warn');
  assert.match(borrowed.words, /Amos/);
});

test('pack trust: known key, new key and unsigned are told apart', () => {
  assert.equal(trustLine({ signature: valid, maker: null, seenBefore: true, otherKeyForName: false }).tone, 'ok');
  assert.match(trustLine({ signature: valid, maker: null, seenBefore: false, otherKeyForName: false }).words, /first pack/);
  assert.equal(trustLine({ signature: { state: 'unsigned' }, maker: null, seenBefore: false, otherKeyForName: false }).tone, 'plain');
});
