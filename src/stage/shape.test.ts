/**
 * Tests for shaping panel content (pure).
 * Run: node --test --experimental-strip-types src/stage/shape.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barScale, formatValue, paragraphs, splitExpression } from './shape.ts';

test('paragraphs split on blank lines', () => {
  assert.deepEqual(paragraphs('One.\nStill one.\n\n  Two.  \n \n\nThree.'), ['One.\nStill one.', 'Two.', 'Three.']);
  assert.deepEqual(paragraphs('   '), []);
});

test('an expression is split around its symbols', () => {
  assert.deepEqual(splitExpression('A = πr²', ['A', 'π', 'r']), [
    { text: 'A', part: 0 }, { text: ' = ' }, { text: 'π', part: 1 }, { text: 'r', part: 2 }, { text: '²' },
  ]);
});

test('the longer symbol wins at the same place, every occurrence is marked', () => {
  const pieces = splitExpression('r² + r', ['r', 'r²']);
  assert.deepEqual(pieces, [{ text: 'r²', part: 1 }, { text: ' + ' }, { text: 'r', part: 0 }]);
});

test('empty symbols are ignored; no symbols leaves the expression whole', () => {
  assert.deepEqual(splitExpression('x + 1', ['']), [{ text: 'x + 1' }]);
  assert.deepEqual(splitExpression('', ['x']), []);
});

test('bars scale to the tallest; negatives and NaN draw as 0', () => {
  assert.deepEqual(barScale([5, 10, 0]), [0.5, 1, 0]);
  assert.deepEqual(barScale([-3, Number.NaN, 4]), [0, 0, 1]);
  assert.deepEqual(barScale([0, 0]), [0, 0]);
  assert.deepEqual(barScale([]), []);
});

test('values read like a person writes them', () => {
  assert.equal(formatValue(56), '56');
  assert.equal(formatValue(3.14159), '3.14');
  assert.equal(formatValue(Number.POSITIVE_INFINITY), '—');
});
