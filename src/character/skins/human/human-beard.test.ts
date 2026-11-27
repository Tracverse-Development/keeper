/**
 * The man's beard region (pure): one piece from the moustache round the mouth into the chin, the
 * lips bare, the cheeks clear above the line.
 * Run: node --test --experimental-strip-types src/character/skins/human/human-beard.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beardFade } from './human-beard.ts';
import { surfaceZ } from './human-face.ts';
import { MOUTH_Y } from './human-mouth.ts';
import { MAN_FRAME } from './human-shape.ts';

/** The beard's amount on the skin at (x, y) of the face. */
const on = (x: number, y: number): number => beardFade(x, y, surfaceZ(MAN_FRAME, x, y));

test('beard: the moustache, the mouth corners and the chin are one piece (no gap)', () => {
  // Down beside the mouth (just past its corners), from the moustache to the chin, it never thins out.
  for (const x of [0.14, 0.16, 0.18]) {
    for (let y = -0.28; y >= -0.6; y -= 0.02) assert.ok(on(x, y) > 0.5, `bare at (${x}, ${y.toFixed(2)}): ${on(x, y)}`);
  }
  assert.ok(on(0, -0.235) > 0.5, 'the moustache over the upper lip');
  assert.ok(on(0, -0.55) > 0.9, 'the chin');
  assert.ok(on(0.5, -0.45) > 0.9, 'the jaw');
});

test('beard: the lips are bare, and so are the cheeks, the nose and the eyes', () => {
  assert.equal(on(0, MOUTH_Y), 0, 'the lips');
  assert.equal(on(0.06, MOUTH_Y + 0.01), 0, 'the lips toward a corner');
  assert.equal(on(0, -0.15), 0, 'the nose tip');
  assert.equal(on(0.26, 0), 0, 'the eye');
  assert.equal(on(0.36, -0.16), 0, 'the cheekbone');
  // Behind the sideburns (round the back of the head) nothing grows.
  assert.equal(beardFade(0.2, -0.2, -0.6), 0);
});

test('beard: its edge feathers (partial values) along the cheek line', () => {
  const values: number[] = [];
  for (let y = -0.1; y >= -0.4; y -= 0.01) values.push(on(0.42, y));
  assert.ok(values.some((v) => v > 0 && v < 1), 'a soft edge, not a hard cut');
  for (let i = 1; i < values.length; i++) assert.ok(values[i] >= values[i - 1] - 1e-9, 'denser going down the cheek');
});
