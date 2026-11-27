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
import { HUMAN_HEAD_Y, HUMAN_NECK_Y, MAN_FRAME, elbowAt, handY } from './human-shape.ts';
import { Vector3 } from 'three';

const partIds = new Set(PARTS.map((p) => p.id as string));
const playing = (id: string, progress = 0.5): ActiveMoment => ({ id, progress, envelope: 1, elapsed: 0.37 });

function rig(): HumanRig {
  const r = { leftArm: new Group(), rightArm: new Group(), leftForearm: new Group(), rightForearm: new Group(), head: new Group() };
  r.leftArm.position.set(MAN_FRAME.shoulder.x, HUMAN_NECK_Y + MAN_FRAME.shoulder.y, 0);
  r.rightArm.position.set(-MAN_FRAME.shoulder.x, HUMAN_NECK_Y + MAN_FRAME.shoulder.y, 0);
  r.head.position.set(0, HUMAN_HEAD_Y, 0);
  return r as unknown as HumanRig;
}
const moved = (o: Group) => Math.abs(o.rotation.x) + Math.abs(o.rotation.y) + Math.abs(o.rotation.z) > 0.05;

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
    poseHumanMoment(r, MAN_FRAME, playing(row.id));
    assert.ok([r.leftArm, r.rightArm, r.head].some(moved), `${row.id} moves the rig`);
  }
  const still = rig();
  poseHumanMoment(still, MAN_FRAME, null);
  assert.deepEqual([still.leftArm.rotation.x, still.rightArm.rotation.x, still.head.rotation.x], [0, 0, 0]);
});

/** Where the hand's centre is (body space) for the rig's arm pose. */
function handAt(arm: Group, forearm: Group): Vector3 {
  arm.updateMatrixWorld(true);
  forearm.position.set(0, -elbowAt(MAN_FRAME), 0);
  arm.add(forearm);
  arm.updateMatrixWorld(true);
  return forearm.localToWorld(new Vector3(0, handY(MAN_FRAME) + elbowAt(MAN_FRAME), 0));
}

test('checking the watch brings the left forearm up in front of the chest, the elbow bent, the head looking down', () => {
  const r = rig();
  poseHumanMoment(r, MAN_FRAME, playing('check-watch'));
  const hand = handAt(r.leftArm, r.leftForearm);
  assert.ok(hand.z > 0.4, 'the hand is out in front');
  assert.ok(hand.y > -0.85 && hand.y < -0.55, 'at chest height');
  assert.ok(r.leftForearm.rotation.x < -0.8, 'the elbow bends');
  assert.ok(r.head.rotation.x > 0.1, 'the head tips down');
  assert.equal(r.rightArm.rotation.x, 0, 'the other arm stays');
});

test('tugging the tie puts the right hand on the knot at the collar', () => {
  const r = rig();
  poseHumanMoment(r, MAN_FRAME, { ...playing('tug-tie'), elapsed: 0 });
  const hand = handAt(r.rightArm, r.rightForearm);
  assert.ok(hand.distanceTo(new Vector3(-0.03, -0.56, 0.31)) < 0.01, `hand at the knot (${hand.toArray().map((n) => n.toFixed(2))})`);
});

test('a half-played moment is half-way: the arm blends from its rest pose', () => {
  const full = rig();
  const half = rig();
  poseHumanMoment(full, MAN_FRAME, playing('raise-lantern'));
  poseHumanMoment(half, MAN_FRAME, { ...playing('raise-lantern'), envelope: 0.5 });
  assert.ok(Math.abs(half.rightForearm.rotation.x - full.rightForearm.rotation.x / 2) < 1e-9);
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
