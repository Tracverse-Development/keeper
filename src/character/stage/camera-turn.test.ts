/**
 * Tests for the Studio's turn round the keeper (pure maths; no GPU).
 * Run: node --test --experimental-strip-types src/character/stage/camera-turn.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { CameraTurn, IDLE_SECONDS, wrapAngle } from './camera-turn.ts';

const run = (turn: CameraTurn, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) turn.step(1 / 60);
};

test('angles wrap the short way round', () => {
  assert.ok(Math.abs(wrapAngle(Math.PI * 3) - Math.PI) < 1e-9 || Math.abs(wrapAngle(Math.PI * 3) + Math.PI) < 1e-9);
  assert.ok(Math.abs(wrapAngle(-0.5) + 0.5) < 1e-12);
  assert.ok(Math.abs(wrapAngle(Math.PI * 2 + 0.25) - 0.25) < 1e-9);
});

test('a drag turns one for one, a flick coasts and slows, a held stop stays put', () => {
  const turn = new CameraTurn();
  turn.drag(0.1, 0);
  turn.drag(0.1, 1 / 60);
  assert.ok(Math.abs(turn.yaw - 0.2) < 1e-9);
  turn.release(1 / 60 + 0.01);
  const before = turn.yaw;
  run(turn, 0.5);
  assert.ok(turn.yaw > before + 0.2, 'it coasts on after a flick');
  const coasted = turn.yaw;
  run(turn, 3);
  assert.ok(Math.abs(turn.yaw - coasted) < 1.5, 'and slows to a stop');
  const held = new CameraTurn();
  held.drag(0.3, 0);
  held.release(1);
  run(held, 1);
  assert.ok(Math.abs(held.yaw - 0.3) < 1e-9, 'a drag that stopped before letting go does not coast');
});

test('turning around glides to the back and holds, then springs to the front when left alone', () => {
  const turn = new CameraTurn();
  turn.around();
  run(turn, 2);
  assert.ok(Math.abs(Math.abs(turn.yaw) - Math.PI) < 1e-3, 'it shows the back');
  run(turn, IDLE_SECONDS - 2.5);
  assert.ok(Math.abs(turn.yaw) > 3, 'it holds the back view for a while');
  run(turn, 5);
  assert.ok(Math.abs(turn.yaw) < 1e-3 && !turn.active, 'then faces front again and rests');
  turn.around();
  run(turn, 2);
  turn.around();
  run(turn, 2);
  assert.ok(Math.abs(turn.yaw) < 1e-3, 'turning around again faces front');
});

test('arrow steps add up, and nonsense is ignored', () => {
  const turn = new CameraTurn();
  turn.by(0.5);
  turn.by(0.5);
  run(turn, 3);
  assert.ok(Math.abs(turn.yaw - 1) < 1e-3);
  turn.to(Number.NaN);
  turn.drag(Number.POSITIVE_INFINITY, 0);
  assert.ok(Number.isFinite(turn.yaw));
});

test('the camera walks round the target at the same distance and height, still looking at it', () => {
  const turn = new CameraTurn();
  const camera = new PerspectiveCamera();
  const target = new Vector3(0, 1, 0);
  turn.to(Math.PI / 2);
  run(turn, 3);
  turn.apply(camera, new Vector3(0, 1.5, 5), target);
  assert.ok(Math.abs(camera.position.x - 5) < 1e-3 && Math.abs(camera.position.z) < 1e-3 && camera.position.y === 1.5, 'a quarter turn looks from screen right');
});
