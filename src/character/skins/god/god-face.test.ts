/**
 * The God Keeper's radiance per expression (pure).
 * Run: node --test --experimental-strip-types src/character/skins/god/god-face.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { godFaceGlow } from './god-face.ts';

const mix = (over: Partial<Record<'happy' | 'focused' | 'sleepy' | 'surprised', number>> = {}) => ({ happy: 0, focused: 0, sleepy: 0, surprised: 0, ...over });

test('god face: exactly 1 at rest; brighter glad or surprised, dimmer sleepy or focused, never dark', () => {
  assert.equal(godFaceGlow(mix()), 1);
  assert.ok(godFaceGlow(mix({ happy: 1 })) > 1);
  assert.ok(godFaceGlow(mix({ surprised: 1 })) > godFaceGlow(mix({ happy: 1 })));
  assert.ok(godFaceGlow(mix({ sleepy: 1 })) < godFaceGlow(mix({ focused: 1 })));
  assert.ok(godFaceGlow(mix({ focused: 1 })) < 1);
  assert.ok(godFaceGlow(mix({ sleepy: 1, focused: 1 })) >= 0.3);
});
