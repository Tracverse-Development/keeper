/**
 * Tests for part effects resolution: clamping, defaults, unknown keys, colours (pure).
 * Run: node --test --experimental-strip-types src/character/parts/effects.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectColour, effectNumber, effectsKey, isHexColour, resolveEffects, type EffectSchema } from './effects.ts';

const SCHEMA: EffectSchema = {
  color: { kind: 'colour', label: 'Colour', default: '#d39744' },
  spin: { kind: 'number', label: 'Spin', min: 0, max: 4, default: 1 },
  nodes: { kind: 'number', label: 'Nodes', min: 24, max: 200, default: 84, step: 1 },
};

test('no input gives every default', () => {
  assert.deepEqual(resolveEffects(SCHEMA, undefined), { color: '#d39744', spin: 1, nodes: 84 });
  assert.deepEqual(resolveEffects(SCHEMA, null), { color: '#d39744', spin: 1, nodes: 84 });
  assert.deepEqual(resolveEffects(SCHEMA, 'ruby'), { color: '#d39744', spin: 1, nodes: 84 });
});

test('numbers are clamped into range; step 1 rounds', () => {
  const out = resolveEffects(SCHEMA, { spin: 99, nodes: 3.6 });
  assert.equal(out.spin, 4);
  assert.equal(out.nodes, 24);
  assert.equal(resolveEffects(SCHEMA, { spin: -5 }).spin, 0);
  assert.equal(resolveEffects(SCHEMA, { nodes: 120.4 }).nodes, 120);
  assert.equal(resolveEffects(SCHEMA, { spin: 2.5 }).spin, 2.5);
});

test('NaN, infinities and wrong types fall back to the default', () => {
  for (const bad of [Number.NaN, Infinity, -Infinity, '3', true, {}, null]) {
    assert.equal(resolveEffects(SCHEMA, { spin: bad }).spin, 1, String(bad));
  }
});

test('colours must be #rrggbb; they are lower-cased', () => {
  assert.equal(resolveEffects(SCHEMA, { color: '#E2425F' }).color, '#e2425f');
  for (const bad of ['red', '#fff', '#12345g', 'e2425f', 0xe2425f, 'url(x)']) {
    assert.equal(resolveEffects(SCHEMA, { color: bad }).color, '#d39744', String(bad));
  }
  assert.equal(isHexColour('#00ff00'), true);
  assert.equal(isHexColour('#00ff0'), false);
});

test('unknown keys are ignored, including prototype tricks', () => {
  const input = JSON.parse('{"__proto__": {"spin": 3}, "script": "alert(1)", "spin": 2}');
  const out = resolveEffects(SCHEMA, input);
  assert.deepEqual(Object.keys(out).sort(), ['color', 'nodes', 'spin']);
  assert.equal(out.spin, 2);
});

test('typed accessors and a stable key', () => {
  const out = resolveEffects(SCHEMA, { color: '#e2425f', spin: 3 });
  assert.equal(effectColour(out, 'color'), 0xe2425f);
  assert.equal(effectNumber(out, 'spin'), 3);
  assert.equal(effectsKey(out), effectsKey(resolveEffects(SCHEMA, { spin: 3, color: '#E2425F' })));
  assert.notEqual(effectsKey(out), effectsKey(resolveEffects(SCHEMA, {})));
});
