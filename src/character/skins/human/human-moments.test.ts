/**
 * The people's, the robot's and the God Keeper's item moments: every row names real catalogue
 * parts, plays a sane length, and its gesture really moves the rig (and only while it plays).
 * Run: node --test --experimental-strip-types src/character/skins/human/human-moments.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three';
import { PARTS } from '../../parts/catalog.ts';
import type { ActiveMoment, ItemMoment } from '../../item-moments.ts';
import { HUMAN_MOMENTS, poseHumanMoment } from './human-moments.ts';
import { GOD_MOMENTS, crownFlare, poseGodMoment } from '../god/god-moments.ts';
import { ROBOT_MOMENTS, poseRobotMoment } from '../robot/robot-moments.ts';
import type { HumanRig } from './human-body.ts';

const partIds = new Set(PARTS.map((p) => p.id as string));
const playing = (id: string, progress = 0.5): ActiveMoment => ({ id, progress, envelope: 1, elapsed: 0.37 });

function rig(): HumanRig {
  return { leftArm: new Group(), rightArm: new Group(), head: new Group() } as unknown as HumanRig;
}

test('every moment names catalogue parts and has a sane length and rest', () => {
  for (const table of [HUMAN_MOMENTS, ROBOT_MOMENTS, GOD_MOMENTS] as readonly (readonly ItemMoment[])[]) {
    const ids = new Set<string>();
    for (const row of table) {
      assert.ok(!ids.has(row.id), `${row.id} listed twice`);
      ids.add(row.id);
      assert.ok(row.parts.length > 0, `${row.id} names a part`);
      for (const p of row.parts) assert.ok(partIds.has(p), `${row.id}: ${p} is a catalogue part`);
      assert.ok(row.duration >= 1 && row.duration <= 6, `${row.id} duration`);
      assert.ok(row.cooldown >= row.duration * 5, `${row.id} rests well after it plays`);
      assert.ok(row.weight > 0, `${row.id} weight`);
    }
  }
});

test('each people gesture moves the rig while it plays, and nothing moves when none plays', () => {
  for (const row of HUMAN_MOMENTS) {
    const r = rig();
    poseHumanMoment(r, playing(row.id));
    const moved = [r.leftArm, r.rightArm, r.head].some((o) => Math.abs(o.rotation.x) + Math.abs(o.rotation.y) + Math.abs(o.rotation.z) > 0.05);
    assert.ok(moved, `${row.id} moves the rig`);
  }
  const still = rig();
  poseHumanMoment(still, null);
  assert.deepEqual([still.leftArm.rotation.x, still.rightArm.rotation.x, still.head.rotation.x], [0, 0, 0]);
});

test('checking the watch lifts the left arm (it wears the watch) forward, and the head looks down at it', () => {
  const r = rig();
  poseHumanMoment(r, playing('check-watch'));
  assert.ok(r.leftArm.rotation.x < -0.5, 'the left arm comes forward');
  assert.ok(r.leftArm.rotation.z < 0, 'and in toward the body');
  assert.ok(r.head.rotation.x > 0.1, 'the head tips down');
  assert.equal(r.rightArm.rotation.x, 0, 'the other arm stays');
});

test('the robot bobs to the beat with head gear on; the God Keeper flares its crown and smooths its robe', () => {
  const head = new Group();
  const body = new Group();
  poseRobotMoment(head, body, playing('beat-bob'));
  assert.ok(head.rotation.x > 0, 'the head bobs');
  assert.equal(crownFlare(playing('crown-flare')), 1);
  assert.equal(crownFlare(playing('check-watch')), 0);
  const r = rig();
  poseGodMoment(r, playing('smooth-robe', 0.2));
  assert.ok(r.leftArm.rotation.x < 0 && r.rightArm.rotation.x < 0, 'both hands sweep the front');
});
