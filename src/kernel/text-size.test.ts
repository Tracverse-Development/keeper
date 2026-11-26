import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sizeOf, TEXT_SIZES } from './text-size.ts';

test('text size: three sizes, growing, and anything unknown is Normal', () => {
  assert.deepEqual(TEXT_SIZES.map((s) => s.id), ['normal', 'large', 'larger']);
  assert.ok(TEXT_SIZES[0].scale === 1 && TEXT_SIZES[1].scale > 1 && TEXT_SIZES[2].scale > TEXT_SIZES[1].scale && TEXT_SIZES[2].scale <= 1.3);
  assert.equal(sizeOf('large').id, 'large');
  assert.equal(sizeOf('huge').id, 'normal');
  assert.equal(sizeOf(null).id, 'normal');
});
