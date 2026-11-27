/**
 * The divine light keeps surfaces under the bloom threshold with their shading intact, and lets
 * only the rim glow. Run: node --test --experimental-strip-types src/character/parts/divine-light.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MeshPhysicalMaterial, ShaderLib } from 'three';
import { addDivineLight, divineRim, KNEE_START, softCeiling, SURFACE_CEILING } from './divine-light.ts';

/** The stage's bloom threshold (`stage/scene.ts`: UnrealBloomPass luminance threshold). */
const BLOOM_THRESHOLD = 1.05;

test('the ceiling leaves darks and mid-tones alone and never reaches the bloom threshold', () => {
  for (const l of [0, 0.1, 0.3, KNEE_START]) assert.equal(softCeiling(l), l);
  let last = -1;
  for (let l = 0; l < 6; l += 0.05) { // the brightest a lit surface gets on any stage
    const out = softCeiling(l);
    assert.ok(out < SURFACE_CEILING && out < BLOOM_THRESHOLD, `${l} → ${out}`);
    assert.ok(out > last, 'brighter stays brighter: shading survives');
    last = out;
  }
});

test('a surface lit four times too bright still shows its folds (a real step between lit and half-lit)', () => {
  // A fold's lit side at 2.0 and its half-lit side at 1.0 under a celestial key light.
  assert.ok(softCeiling(2) - softCeiling(1) > 0.1, `step ${softCeiling(2) - softCeiling(1)}`);
});

test('the shader patch adds the ceiling and the rim after all lighting, before the output', () => {
  const material = new MeshPhysicalMaterial();
  const rim = divineRim(0.4, 4);
  addDivineLight(material, rim);
  const shader = { uniforms: {} as Record<string, unknown>, fragmentShader: ShaderLib.physical.fragmentShader, vertexShader: ShaderLib.physical.vertexShader };
  material.onBeforeCompile(shader as never, undefined as never);
  assert.ok(shader.fragmentShader.includes('uniform float uDivineRim;'));
  const ceiling = shader.fragmentShader.indexOf('divineL');
  assert.ok(ceiling > shader.fragmentShader.indexOf('vec3 outgoingLight'), 'after the lighting is summed');
  assert.ok(ceiling < shader.fragmentShader.indexOf('#include <opaque_fragment>'), 'before the output is written');
  assert.equal(shader.uniforms.uDivineRim, rim.strength, 'the rim is shared, so animating it is one write');
  assert.equal(material.customProgramCacheKey(), 'divine-light');
});
