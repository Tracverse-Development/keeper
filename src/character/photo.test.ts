/**
 * Tests for photo mode's measurements (pure).
 * Run: node --test --experimental-strip-types src/character/photo.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHOTO_MAX_SIDE, PHOTO_MIN_SIDE, photoSize } from './photo.ts';

const pixels = (s: { width: number; height: number; ratio: number }) => [Math.round(s.width * s.ratio), Math.round(s.height * s.ratio)];

test('a portrait is drawn at twice the density by default', () => {
  const s = photoSize({ width: 1080, height: 1350 }, 16384);
  assert.deepEqual(s, { width: 1080, height: 1350, ratio: 2 });
  assert.deepEqual(pixels(s), [2160, 2700]);
});

test('the density gives way first when the GPU is small, keeping the size', () => {
  const s = photoSize({ width: 1080, height: 1350, scale: 2 }, 2048);
  assert.equal(s.width, 1080);
  assert.equal(s.height, 1350);
  assert.ok(Math.max(...pixels(s)) <= 2048);
  assert.ok(s.ratio >= 1);
});

test('then the size shrinks, keeping the shape', () => {
  const s = photoSize({ width: 2000, height: 1000, scale: 2 }, 1024);
  assert.equal(s.ratio, 1);
  assert.deepEqual([s.width, s.height], [1024, 512]);
});

test('never past the stage cap, PHOTO_MAX_SIDE or the minimum, whatever is asked', () => {
  assert.equal(photoSize({ width: 500, height: 500, scale: 8 }, 16384).ratio, 2);
  assert.equal(photoSize({ width: 500, height: 500, scale: 0.2 }, 16384).ratio, 1);
  const huge = photoSize({ width: 1e9, height: 1e9, scale: 2 }, 1e9);
  assert.ok(Math.max(...pixels(huge)) <= PHOTO_MAX_SIDE);
  const tiny = photoSize({ width: -5, height: Number.NaN, scale: Number.NaN }, Number.NaN);
  assert.deepEqual([tiny.width, tiny.height, tiny.ratio], [PHOTO_MIN_SIDE, PHOTO_MIN_SIDE, 2]);
});
