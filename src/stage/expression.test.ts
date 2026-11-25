/**
 * Tests for the safe what-if evaluator (pure).
 * Run: node --test --experimental-strip-types src/stage/expression.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from './expression.ts';

const value = (src: string, vars: Record<string, number> = {}) => {
  const r = evaluate(src, vars);
  assert.ok(r.ok, `${src} should calculate: ${r.ok ? '' : r.error}`);
  return r.ok ? r.value : NaN;
};
const refused = (src: string, vars: Record<string, number> = {}) => assert.equal(evaluate(src, vars).ok, false, `${src} must be refused`);

test('numbers and the four operations', () => {
  assert.equal(value('1 + 2'), 3);
  assert.equal(value('10 - 4 - 3'), 3);
  assert.equal(value('2.5 * 4'), 10);
  assert.equal(value('9 / 2'), 4.5);
  assert.equal(value('.5 + 1.'), 1.5);
  assert.equal(value('17 % 5'), 2);
});

test('precedence, parentheses, powers and unary minus', () => {
  assert.equal(value('2 + 3 * 4'), 14);
  assert.equal(value('(2 + 3) * 4'), 20);
  assert.equal(value('2 ^ 3 ^ 2'), 512);
  assert.equal(value('-2 ^ 2'), -4);
  assert.equal(value('2 ^ -1'), 0.5);
  assert.equal(value('--3'), 3);
  assert.equal(value('-(1 + 2) * 2'), -6);
  assert.equal(value('6 − 2 × 2 ÷ 4'), 5);
});

test('variables and functions', () => {
  assert.equal(value('weekly * weeks * (1 + rate/100)', { weekly: 50, weeks: 52, rate: 3 }), 2678);
  assert.equal(value('round(x / 3)', { x: 10 }), 3);
  assert.equal(value('floor(2.7) + ceil(2.1) + abs(-1) + sqrt(16)'), 2 + 3 + 1 + 4);
  assert.equal(value('min(a, b, 3) + max(a, b)', { a: 5, b: 1 }), 6);
});

test('anything unsafe or unknown is refused, never run', () => {
  for (const src of ['constructor', 'alert(1)', 'a.b', '[]', 'x[0]', 'this', 'globalThis', '__proto__', 'toString()',
    'Math.max(1)', '"a"', '`1`', '1;2', 'a = 1', '() => 1', 'eval("1")', 'Function("1")()', 'x => x', '1 +', '(1', '1)', '', '  ', 'max()', 'sqrt(1, 2)', '2x', '1..2']) {
    refused(src, { a: 1 });
  }
  // A panel variable that happens to be named like a prototype key is just a number (a Map, not the object).
  assert.equal(value('constructor + 1', { constructor: 1 } as Record<string, number>), 2);
  refused('hasOwnProperty');
  refused('1 / 0');
  refused('sqrt(-1)');
  refused('9'.repeat(500));
  refused('('.repeat(100) + '1' + ')'.repeat(100));
});
