/**
 * The stage moods are data: `night` is the classic stage exactly, every set named in the map is a
 * real set, and the moods the contract offers are the moods the data defines.
 * Run: node --test --experimental-strip-types src/character/stage/stage-moods.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOOD_SPECS, SET_MOODS, STAGE_MOODS, isStageMood, moodOfWear } from './stage-moods.ts';
import { PALETTE } from '../palette.ts';

test('night is the stage as it always was (the lights and sky scene.ts and backdrop.ts set)', () => {
  const night = MOOD_SPECS.night;
  assert.deepEqual(night.rims, [PALETTE.gold400, PALETTE.gold500]);
  assert.deepEqual([night.key.colour, night.key.intensity], [PALETTE.cream50, 1.25]);
  assert.deepEqual([night.fill.colour, night.fill.intensity], [PALETTE.navy500, 0.9]);
  assert.deepEqual([night.ambient.colour, night.ambient.intensity], [PALETTE.navy500, 0.35]);
  assert.ok(night.lights.every((l) => l.intensity === 0) && night.fog === 0, 'no extra light, no fog');
  assert.deepEqual(night.sky, { deep: PALETTE.navy950, mid: PALETTE.navy800, high: PALETTE.navy600, gold: PALETTE.gold500 });
  const scene = readFileSync(new URL('./scene.ts', import.meta.url), 'utf8');
  assert.match(scene, /new DirectionalLight\(PALETTE\.cream50, 1\.25\)/, 'scene.ts key light unchanged');
  assert.match(scene, /new AmbientLight\(PALETTE\.navy500, 0\.35\)/, 'scene.ts ambient unchanged');
});

test('every other mood adds coloured light that reaches the models, and fog stays thin', () => {
  for (const mood of STAGE_MOODS.filter((m) => m !== 'night')) {
    const spec = MOOD_SPECS[mood];
    assert.ok(spec.lights.some((l) => l.intensity > 0), `${mood} has a light of its own`);
    assert.ok(spec.fog <= 0.03, `${mood} fog is thin`);
  }
});

test('the contract offers exactly the moods the data defines', () => {
  const contract = readFileSync(new URL('../contract.ts', import.meta.url), 'utf8');
  const union = contract.match(/export type StageMood = ([^;]+);/)?.[1] ?? '';
  assert.deepEqual([...union.matchAll(/'([a-z]+)'/g)].map((m) => m[1]), [...STAGE_MOODS]);
});

test('every set in the map is a real official set, and its mood a real mood', () => {
  const core = new URL('../../../src-tauri/src/keepers/kit/collection/', import.meta.url);
  const ids = ['robot', 'dog', 'man', 'woman', 'owl', 'shared', 'divine'].flatMap((f) => [...readFileSync(new URL(`${f}.rs`, core), 'utf8').matchAll(/ItemSet \{ id: "([^"]+)"/g)].map((m) => m[1]));
  for (const [set, mood] of Object.entries(SET_MOODS)) {
    assert.ok(ids.includes(set), `${set} is a set`);
    assert.ok(isStageMood(mood), `${set} -> ${mood}`);
  }
  assert.equal(ids.filter((id) => !(id in SET_MOODS)).length, 0, 'every set has a mood');
});

test('a wear list brings the mood of the set it glows with, and nothing otherwise', () => {
  assert.equal(moodOfWear([{ set: 'cozy-den' }, { set: undefined }]), 'lamplight');
  assert.equal(moodOfWear([{}, { set: 42 }]), null);
  assert.equal(moodOfWear([{ set: 'not-a-set' }]), null);
});
