/**
 * Tests for the sway module: the spring maths (settles, bounded, frame-rate independent, capped dt,
 * snaps on a jump), the bone (trails a turn the right way, stays in its cone, keeps out of the body,
 * looks exactly as built when still) and the drape (swings the hem, never the top, never inward).
 * Run: node --test --experimental-strip-types src/character/sway/sway.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, Quaternion, Vector3 } from 'three';
import { createDrapeSway } from './drape-sway.ts';
import { addSwayBone, swayFraction } from './sway-bone.ts';
import { MAX_DT, SwaySpring } from './sway-spring.ts';

const TUNING = { frequency: 1.6, damping: 0.35, maxLag: 0.2 };

/** The target's x over time: still, then a smooth push over 0.4 s, then still again. */
const push = (t: number): number => (t < 0.2 ? 0 : t > 0.6 ? 0.5 : 0.5 * (0.5 - 0.5 * Math.cos(((t - 0.2) / 0.4) * Math.PI)));

/** Runs `spring` over `seconds` at frame lengths from `frame(i)`, recording the lag at each time. */
function run(spring: SwaySpring, seconds: number, frame: (i: number) => number, target = push): { t: number; lag: number }[] {
  const out: { t: number; lag: number }[] = [];
  let t = 0;
  spring.step(0, target(0), 0, 0);
  for (let i = 0; t < seconds; i++) {
    const dt = frame(i);
    t += dt;
    spring.step(dt, target(t), 0, 0);
    out.push({ t, lag: spring.lag()[0] });
  }
  return out;
}

const lagAt = (samples: { t: number; lag: number }[], t: number): number => samples.reduce((best, s) => (Math.abs(s.t - t) < Math.abs(best.t - t) ? s : best)).lag;

test('a push swings the point the other way, then it settles to rest', () => {
  const samples = run(new SwaySpring(TUNING), 5, () => 1 / 60);
  const peak = Math.min(...samples.map((s) => s.lag));
  assert.ok(peak < -0.02, `it trails the push (peak lag ${peak})`);
  assert.ok(Math.abs(lagAt(samples, 5)) < 1e-3, 'and settles back');
  // Underdamped: it swings past the rest once after the stop.
  assert.ok(samples.some((s) => s.t > 0.6 && s.lag > 0.002), 'it overshoots a little before settling');
});

test('the lag never exceeds maxLag, however wild the motion', () => {
  const spring = new SwaySpring({ frequency: 1, damping: 0.1, maxLag: 0.05, snap: 100 });
  let worst = 0;
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  spring.step(0, 0, 0, 0);
  for (let i = 0; i < 2000; i++) {
    spring.step(1 / 60, random() * 3, random() * 3, random() * 3);
    const [x, y, z] = spring.lag();
    worst = Math.max(worst, Math.hypot(x, y, z));
  }
  assert.ok(worst <= 0.05 + 1e-9, `worst lag ${worst}`);
});

test('frame-rate independent: 30, 60, 144 fps and ragged frames trace the same swing', () => {
  const reference = run(new SwaySpring(TUNING), 2, () => 1 / 144);
  const peak = Math.max(...reference.map((s) => Math.abs(s.lag)));
  const ragged = [1 / 30, 1 / 90, 1 / 50, 1 / 144, 1 / 24];
  for (const frame of [() => 1 / 30, () => 1 / 60, (i: number) => ragged[i % ragged.length]]) {
    const samples = run(new SwaySpring(TUNING), 2, frame);
    for (const t of [0.4, 0.7, 1, 1.5]) {
      const error = Math.abs(lagAt(samples, t) - lagAt(reference, t));
      assert.ok(error < peak * 0.12, `at ${t}s off by ${error} (peak ${peak})`);
    }
  }
});

test('a long stall counts as MAX_DT, and a jump past snap resets instead of whipping', () => {
  const a = new SwaySpring(TUNING);
  const b = new SwaySpring(TUNING);
  for (const s of [a, b]) {
    s.step(0, 0, 0, 0);
    s.step(1 / 60, 0.01, 0, 0);
  }
  a.step(5, 0.05, 0, 0);
  b.step(MAX_DT, 0.05, 0, 0);
  assert.deepEqual(a.lag(), b.lag());
  a.step(1 / 60, 50, 0, 0);
  assert.deepEqual(a.lag(), [0, 0, 0]);
  a.step(1 / 60, Number.NaN, 0, 0);
  assert.deepEqual(a.lag(), [0, 0, 0], 'a non-finite target is ignored');
});

test('steady motion leaves no lag without drag (only a change of motion swings it)', () => {
  const spring = new SwaySpring({ ...TUNING, drag: 0 });
  const samples = run(spring, 6, () => 1 / 60, (t) => t * 0.3);
  assert.ok(Math.abs(lagAt(samples, 6)) < 1e-3);
});

test('swayFraction eases into the cone and never passes it', () => {
  for (const raw of [0.01, 0.2, 0.5, 1, 3]) {
    const shown = raw * swayFraction(raw, 1, 0.4);
    assert.ok(shown <= 0.4 + 1e-12 && shown <= raw + 1e-12);
  }
  assert.ok(Math.abs(0.01 * swayFraction(0.01, 1, 0.4) - 0.01) < 1e-5, 'a small swing passes as it is');
  assert.equal(swayFraction(0.3, 0, 0.4), 0, 'amplitude 0 shows nothing');
});

/** A body that can turn on the spot, with an ear hanging off its side. */
function rig() {
  const body = new Group();
  const pivot = new Group();
  pivot.position.set(0.5, 1, 0);
  body.add(pivot);
  const ear = new Mesh();
  ear.position.y = -0.5;
  pivot.add(ear);
  const bone = addSwayBone(pivot, { tip: [0, -1, 0], frequency: 2, damping: 0.3, maxAngle: 0.4, keepOut: { direction: [-1, 0, 0], room: 0.02 } });
  return { body, pivot, ear, bone };
}

const tipOf = (bone: { layer: Group }): Vector3 => new Vector3(0, -1, 0).applyQuaternion(bone.layer.quaternion);

test('a bone moves the pivot\'s children onto its layer and is the identity while still', () => {
  const { pivot, ear, bone } = rig();
  assert.equal(ear.parent, bone.layer);
  assert.equal(bone.layer.parent, pivot);
  for (let i = 0; i < 120; i++) bone.update(1 / 60);
  assert.ok(bone.layer.quaternion.angleTo(new Quaternion()) < 1e-9, 'standing still, it looks exactly as built');
});

test('a bone trails a turn, stays in its cone, keeps out of the body and settles', () => {
  const { body, bone } = rig();
  let worst = 0;
  let mostInward = -Infinity;
  let trailed = 0;
  for (let i = 0; i < 300; i++) {
    const t = i / 60;
    const before = body.rotation.y;
    // A quick turn (a spin) for the first half second, then still.
    body.rotation.y = t < 0.5 ? (t / 0.5) * Math.PI * 0.6 : Math.PI * 0.6;
    bone.update(1 / 60);
    const tip = tipOf(bone);
    worst = Math.max(worst, bone.layer.quaternion.angleTo(new Quaternion()));
    mostInward = Math.max(mostInward, -(tip.x - 0));
    // Turning to +y moves the side ear toward -z; the soft tip trails toward +z.
    if (body.rotation.y > before) trailed = Math.max(trailed, tip.z);
  }
  assert.ok(trailed > 0.01, `it trails the turn (${trailed})`);
  assert.ok(worst <= 0.4 + 1e-9, `within the cone (${worst})`);
  assert.ok(mostInward <= 0.02 + 1e-6, `never into the body beyond its room (${mostInward})`);
  assert.ok(bone.layer.quaternion.angleTo(new Quaternion()) < 0.01, 'and settles after the turn');
});

test('reduced motion (amplitude 0.4) swings less; amplitude 0 not at all', () => {
  const peak = (amplitude: number): number => {
    const { body, bone } = rig();
    let most = 0;
    for (let i = 0; i < 90; i++) {
      body.position.x = Math.min(i / 30, 1) * 0.6;
      bone.update(1 / 60, amplitude);
      most = Math.max(most, bone.layer.quaternion.angleTo(new Quaternion()));
    }
    return most;
  };
  const full = peak(1);
  assert.ok(full > 0.02);
  assert.ok(peak(0.4) < full * 0.6);
  assert.equal(peak(0), 0);
});

test('a drape swings the hem with the body, not its top, and never draws cloth inward', () => {
  const anchor = new Group();
  const drape = createDrapeSway(anchor, { top: 0, bottom: -1, radius: 0.4, maxLag: 0.1 });
  const out = new Vector3();
  drape.step(1 / 60);
  assert.equal(drape.moving, false);
  assert.deepEqual(drape.displace(0.3, -1, 0.2, 0.3, 0.2, out).toArray(), [0.3, -1, 0.2], 'still: unchanged');
  let swung = 0;
  let inward = 0;
  for (let i = 0; i < 40; i++) {
    anchor.position.x = Math.min(i / 15, 1) * 0.5;
    anchor.rotation.y = Math.min(i / 15, 1) * 0.8;
    drape.step(1 / 60);
    for (const [x, z] of [[0.4, 0], [0, 0.4], [-0.3, -0.25], [0, -0.4]]) {
      drape.displace(x, -1, z, x, z, out);
      swung = Math.max(swung, Math.hypot(out.x - x, out.z - z));
      inward = Math.max(inward, Math.hypot(x, z) - Math.hypot(out.x, out.z));
      assert.deepEqual(drape.displace(x, 0, z, x, z, out).toArray(), [x, 0, z], 'the top is held');
    }
  }
  assert.ok(swung > 0.01, `the hem swings (${swung})`);
  assert.ok(inward <= 1e-9, `never inward (${inward})`);
});
