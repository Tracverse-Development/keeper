import assert from 'node:assert/strict';
import { test } from 'node:test';

import { crumbs, fewCrumbs, sizeWords, whenWords } from './files-view.ts';

test('sizes read the way people say them', () => {
  assert.equal(sizeWords(500), '500 bytes');
  assert.equal(sizeWords(12 * 1024), '12 KB');
  assert.equal(sizeWords(3.4 * 1024 * 1024), '3.4 MB');
});

test('crumbs open the folder they name', () => {
  assert.deepEqual(crumbs('~/Documents/Taxes', '/Users/ann/Documents/Taxes'), [
    { label: 'Home', path: '/Users/ann' },
    { label: 'Documents', path: '/Users/ann/Documents' },
    { label: 'Taxes', path: '/Users/ann/Documents/Taxes' },
  ]);
  assert.deepEqual(crumbs('~', '/Users/ann'), [{ label: 'Home', path: '/Users/ann' }]);
});

test('when a file changed, in everyday words', () => {
  const now = new Date(2026, 10, 28, 17, 0);
  assert.match(whenWords(new Date(2026, 10, 28, 15, 4).toISOString(), now), /^Today /);
  assert.equal(whenWords(new Date(2026, 10, 27, 9, 0).toISOString(), now), 'Yesterday');
  assert.equal(whenWords('nonsense', now), '');
});

test('a deep folder shows its last crumbs after a … that goes up', () => {
  const all = crumbs('~/Documents/Garden Club/Photos/2026', '/Users/ann/Documents/Garden Club/Photos/2026');
  assert.deepEqual(fewCrumbs(all).map((c) => c.label), ['…', 'Garden Club', 'Photos', '2026']);
  assert.equal(fewCrumbs(all)[0].path, '/Users/ann/Documents');
  assert.equal(fewCrumbs(all.slice(0, 2)).length, 2);
});
