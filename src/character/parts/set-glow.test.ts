/**
 * The set glow never builds up: frame after frame it replaces its own share of a surface's light.
 * Run: node --test --experimental-strip-types src/character/parts/set-glow.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import { createSetGlow } from './set-glow.ts';

test('a surface under the set glow stays within its rest light plus one share, however long it is worn', () => {
  const material = new MeshStandardMaterial({ emissiveIntensity: 0.2 });
  const part = new Group().add(new Mesh(new SphereGeometry(0.3), material));
  const glow = createSetGlow(part);
  const frame = (time: number) => ({ dt: 1 / 60, time, motion: { speed: 1, amplitude: 1 }, mood: { presence: 1 }, voice: 0, work: 0, thinking: 0, gotIt: 0, dramaFloor: 0, head: { x: 0, y: 0, z: 0 } }) as never;
  let highest = 0;
  for (let i = 0; i < 2000; i++) {
    glow.update(frame(i / 60));
    highest = Math.max(highest, material.emissiveIntensity);
  }
  assert.ok(highest <= 0.2 + 0.36, `the light stays bounded (reached ${highest})`);
  glow.dispose();
  assert.ok(Math.abs(material.emissiveIntensity - 0.2) < 1e-9, 'taking it off restores the light');
});
