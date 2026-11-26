/**
 * Tests for the fit maths (pure, no three.js): the profile curve, the body's width and level,
 * garment rings, and the shapes every species publishes for its worn slots.
 * Run: node --test --experimental-strip-types src/character/parts/fit.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKINS } from '../skins/catalog.ts';
import { ROBOT_TORSO_PROFILE } from '../skins/robot/robot-shape.ts';
import { bodyLevel, clearance, crossSection, domeProfile, garmentRings, profilePoint, radiusAt, type BodyShape } from './fit.ts';
import { SLOTS } from './slots.ts';

const TORSO: BodyShape = { profile: ROBOT_TORSO_PROFILE, depth: 1, squareness: 2, reach: -0.86 };

test('the profile curve passes through its control points (as three.js SplineCurve does)', () => {
  const n = ROBOT_TORSO_PROFILE.length - 1;
  ROBOT_TORSO_PROFILE.forEach(([r, y], i) => {
    const [pr, py] = profilePoint(ROBOT_TORSO_PROFILE, i / n);
    assert.ok(Math.abs(pr - r) < 1e-9 && Math.abs(py - y) < 1e-9, `point ${i}`);
  });
});

test('radiusAt reads the body width at a height; nothing above or below it', () => {
  assert.ok(Math.abs(radiusAt(TORSO, 0) - 0.31) < 1e-3);
  assert.ok(Math.abs(radiusAt(TORSO, -0.6) - 0.6) < 1e-3);
  assert.equal(radiusAt(TORSO, 0.5), 0);
  assert.equal(radiusAt(TORSO, -2), 0);
});

test('bodyLevel: inside below 1, on the surface 1, outside above; clearance is the gap share', () => {
  assert.ok(bodyLevel(TORSO, 0, -0.6, 0) < 1e-9);
  assert.ok(Math.abs(bodyLevel(TORSO, 0.6, -0.6, 0) - 1) < 1e-3);
  assert.ok(bodyLevel(TORSO, 0.7, -0.6, 0) > 1);
  assert.ok(Math.abs(clearance(TORSO, 0.66, -0.6, 0) - 0.1) < 2e-3);
  assert.equal(bodyLevel(TORSO, 0, 3, 0), Infinity);
});

test('crossSection: front is +z, a quarter turn is +x; squareness 4 is boxier than 2', () => {
  const [fx, fz] = crossSection(0, 1, 0.5, 2);
  assert.ok(Math.abs(fx) < 1e-9 && Math.abs(fz - 0.5) < 1e-9);
  const [sx] = crossSection(Math.PI / 2, 1, 0.5, 2);
  assert.ok(Math.abs(sx - 1) < 1e-9);
  const round = crossSection(Math.PI / 4, 1, 1, 2);
  const box = crossSection(Math.PI / 4, 1, 1, 4);
  assert.ok(Math.hypot(...box) > Math.hypot(...round));
});

test('garment rings sit outside the body by the ease, all round', () => {
  for (const ring of garmentRings(TORSO, -0.1, -0.8, 0.04, 12)) {
    for (const a of [0, 1, 2, 3, 4, 5]) {
      const [x, z] = crossSection(a, ring.rx, ring.rz, 2);
      assert.ok(bodyLevel(TORSO, x, ring.y, z) > 1, `ring ${ring.y} angle ${a}`);
    }
  }
});

test('a dome profile runs from the crown down to the equator', () => {
  const dome = domeProfile(1, 0.9, 9);
  assert.ok(Math.abs(dome[0][1] - 0.9) < 1e-9 && dome[0][0] < 0.01);
  assert.ok(Math.abs(dome[8][0] - 1) < 1e-9 && Math.abs(dome[8][1]) < 1e-9);
});

test('every species publishes a sound shape for each worn slot it offers, and none for floating ones', () => {
  for (const skin of SKINS) {
    for (const slot of SLOTS) {
      const placement = (skin.slots as Record<string, { follow?: string; shape?: BodyShape }>)[slot.id];
      if (!placement) continue;
      if (slot.kind !== 'worn') {
        assert.equal(placement.shape, undefined, `${skin.id}.${slot.id}`);
        continue;
      }
      const shape = placement.shape!;
      assert.ok(shape && placement.follow, `${skin.id}.${slot.id} has a bone and a shape`);
      if (shape.feet) {
        // A paws slot: no surface ring, a finite ellipsoid per foot.
        assert.ok(shape.feet.length > 0 && shape.profile.length === 0, `${skin.id}.${slot.id} feet`);
        for (const foot of shape.feet) for (const n of [...foot.position, ...foot.radii]) assert.ok(Number.isFinite(n), `${skin.id}.${slot.id} foot`);
        continue;
      }
      assert.ok(shape.profile.length >= 2, `${skin.id}.${slot.id} profile`);
      for (let i = 1; i < shape.profile.length; i++) assert.ok(shape.profile[i][1] < shape.profile[i - 1][1], `${skin.id}.${slot.id} runs top to bottom`);
      assert.ok(shape.depth > 0.3 && shape.depth <= 1.2 && shape.squareness >= 2, `${skin.id}.${slot.id} cross-section`);
      assert.ok(shape.reach < shape.profile[0][1] && shape.reach >= shape.profile[shape.profile.length - 1][1], `${skin.id}.${slot.id} reach inside the profile`);
    }
  }
});
