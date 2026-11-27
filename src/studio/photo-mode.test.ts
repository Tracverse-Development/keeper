/**
 * Tests for photo mode's rules (pure).
 * Run: node --test --experimental-strip-types src/studio/photo-mode.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARD } from './keeper-card.ts';
import { PHOTO_KINDS, PHOTO_SCALE, photoRequest, pngBase64, savedWords } from './photo-mode.ts';

test('both kinds are offered, each once', () => {
  assert.deepEqual(PHOTO_KINDS.map((k) => k.id).sort(), ['card', 'portrait']);
});

test('photos are drawn finer than the screen: the card picture square, the portrait 4:5', () => {
  assert.ok(PHOTO_SCALE >= 2);
  const card = photoRequest('card');
  assert.equal(card.width, CARD.picture);
  assert.equal(card.height, CARD.picture);
  const portrait = photoRequest('portrait');
  assert.equal(portrait.width / portrait.height, 4 / 5);
  assert.equal(portrait.width * portrait.scale, 2160);
});

test('pngBase64 takes only a PNG data URL', () => {
  assert.equal(pngBase64('data:image/png;base64,iVBORw0KGgo='), 'iVBORw0KGgo=');
  assert.equal(pngBase64('data:image/jpeg;base64,/9j/'), null);
  assert.equal(pngBase64('data:image/png;base64,'), null);
  assert.equal(pngBase64('data:,'), null);
  assert.equal(pngBase64(null), null);
  assert.equal(pngBase64(undefined), null);
});

test('the confirmation says what was saved and where', () => {
  assert.equal(savedWords('portrait', 'Pictures/Keeper/Malik-2026-11-27-143005.png'), 'Portrait saved on this Mac in Pictures/Keeper/Malik-2026-11-27-143005.png.');
  assert.match(savedWords('card', 'Pictures/Keeper/x.png'), /^Card saved/);
});
