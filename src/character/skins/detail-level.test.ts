/**
 * Level of detail: the band a keeper's on-screen height falls in, with hysteresis so it never
 * flickers, and the watch that measures it from a real camera.
 * Run: node --test --experimental-strip-types src/character/skins/detail-level.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, MeshBasicMaterial, PerspectiveCamera, SphereGeometry, type WebGLRenderer } from 'three';
import { chooseDetail, createDetailWatch, DETAIL_BANDS, DETAIL_HYSTERESIS, projectedHeightPx, type DetailLevel } from './detail-level.ts';

test('the first frame picks the plain band', () => {
  assert.equal(chooseDetail(100, null), 'light');
  assert.equal(chooseDetail(DETAIL_BANDS.balanced, null), 'balanced');
  assert.equal(chooseDetail(DETAIL_BANDS.full - 1, null), 'balanced');
  assert.equal(chooseDetail(DETAIL_BANDS.full, null), 'full');
  assert.equal(chooseDetail(5000, null), 'full');
});

test('growing steps up at the band at once, even from light to full', () => {
  assert.equal(chooseDetail(DETAIL_BANDS.balanced, 'light'), 'balanced');
  assert.equal(chooseDetail(DETAIL_BANDS.full + 10, 'light'), 'full');
});

test('shrinking holds the level within the hysteresis margin, then steps down', () => {
  const justBelow = DETAIL_BANDS.full * (1 - DETAIL_HYSTERESIS / 2);
  const wellBelow = DETAIL_BANDS.full * (1 - DETAIL_HYSTERESIS * 2);
  assert.equal(chooseDetail(justBelow, 'full'), 'full');
  assert.equal(chooseDetail(wellBelow, 'full'), 'balanced');
  assert.equal(chooseDetail(DETAIL_BANDS.balanced * (1 - DETAIL_HYSTERESIS / 2), 'balanced'), 'balanced');
  assert.equal(chooseDetail(DETAIL_BANDS.balanced * (1 - DETAIL_HYSTERESIS * 2), 'balanced'), 'light');
  // A full keeper that shrinks into balanced's margin lands on balanced, not light.
  assert.equal(chooseDetail(DETAIL_BANDS.balanced * (1 - DETAIL_HYSTERESIS / 2), 'full'), 'balanced');
  assert.equal(chooseDetail(10, 'full'), 'light');
});

test('a keeper bobbing round a band never flickers', () => {
  let level: DetailLevel | null = null;
  const seen = new Set<DetailLevel>();
  for (let i = 0; i < 600; i++) {
    const h = DETAIL_BANDS.full * (1 + 0.05 * Math.sin(i * 0.3)); // ±5%, inside the 15% margin
    level = chooseDetail(h, level);
    if (i > 0) seen.add(level);
  }
  assert.deepEqual([...seen], ['full']);
});

test('projected height follows distance and field of view', () => {
  // 1 unit tall at depth 1 under a 90° lens fills half a 1000 px viewport.
  assert.ok(Math.abs(projectedHeightPx(1, 1, 90, 1000) - 500) < 1e-6);
  assert.ok(Math.abs(projectedHeightPx(1, 2, 90, 1000) - 250) < 1e-6);
  assert.equal(projectedHeightPx(1, 0, 90, 1000), Infinity);
});

/** A renderer stand-in: the watch reads only the frame counter and the drawing buffer's size. */
function fakeRenderer(height: number, frame = { value: 0 }): WebGLRenderer {
  return {
    info: { render: { get frame() { return frame.value; } } },
    getDrawingBufferSize: (v: { set(x: number, y: number): unknown; y: number }) => (v.set(height, height), v),
  } as unknown as WebGLRenderer;
}

test('the watch measures the keeper from the camera and steps with the distance', () => {
  const keeper = new Group().add(new Mesh(new SphereGeometry(1), new MeshBasicMaterial())); // 2 units tall
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  const frame = { value: 0 };
  const renderer = fakeRenderer(900, frame);
  const watch = createDetailWatch(keeper);
  const at = (z: number): DetailLevel => {
    camera.position.set(0, 0, z);
    camera.updateMatrixWorld(true);
    frame.value++;
    return watch.observe(renderer, camera);
  };
  assert.equal(at(3), 'full'); // 2 / (2 · 3 · tan 15°) · 900 ≈ 1120 px
  assert.ok(Math.abs(watch.heightPx - 1120) < 5, `height ${watch.heightPx}`);
  assert.equal(at(8), 'balanced'); // 2 / (2 · 8 · tan 15°) · 900 ≈ 420 px
  assert.equal(at(30), 'light'); // ~112 px
  // Scaling the keeper up (Studio zoom, a swap growing in) is followed through its world matrix.
  keeper.scale.setScalar(6);
  keeper.updateMatrixWorld(true);
  assert.equal(at(30), 'full');
});

test('the watch measures once per frame however many meshes ask, and an override pins it', () => {
  const keeper = new Group().add(new Mesh(new SphereGeometry(1), new MeshBasicMaterial()));
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 30);
  camera.updateMatrixWorld(true);
  const renderer = fakeRenderer(900);
  const watch = createDetailWatch(keeper);
  assert.equal(watch.observe(renderer, camera), 'light');
  keeper.scale.setScalar(6);
  keeper.updateMatrixWorld(true);
  assert.equal(watch.observe(renderer, camera), 'light', 'same frame: the answer is cached');
  assert.equal(createDetailWatch(keeper, 'full').observe(renderer, camera), 'full');
});
