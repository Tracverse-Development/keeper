/**
 * The owl's breast is strewn, not gridded, and its feathers thin and coarsen when the owl is small.
 * Run: node --test --experimental-strip-types src/character/skins/owl/owl-detail.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MeshStandardMaterial, PerspectiveCamera, Scene, Vector3, type WebGLRenderer } from 'three';
import { createDetailWatch } from '../detail-level.ts';
import { COAT_SHARE, featherSet, FINE_SHARE, followDetail } from './owl-detail.ts';
import { featherLayer, scatterFeathers, type Surface } from './owl-feathers.ts';

const flat: Surface = (a, b) => new Vector3(a, -b, 0);
const strew = (seed: number) => scatterFeathers(flat, { rows: 20, perRow: 20, seed, inside: new Vector3(0, 0, -1), tint: () => 1 });

test('the scatter is the same every build for a seed, and different for another seed', () => {
  const one = strew(7).map((p) => p.at.toArray().join());
  assert.deepEqual(strew(7).map((p) => p.at.toArray().join()), one);
  assert.notDeepEqual(strew(8).map((p) => p.at.toArray().join()), one);
});

test('no rows or columns show: feathers stray off any shared line, vary in size and turn', () => {
  const feathers = strew(7);
  assert.equal(feathers.length, 400);
  // In a grid every feather of a row shares one height; here a row's heights spread over most of a cell.
  const row = feathers.slice(0, 20).map((p) => p.at.y);
  const spread = Math.max(...row) - Math.min(...row);
  assert.ok(spread > 0.5 / 20, `row heights spread ${spread}`);
  const sizes = feathers.map((p) => p.scale ?? 1);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) > 0.3, 'sizes vary');
  const turns = new Set(feathers.map((p) => p.toward.clone().normalize().x.toFixed(2)));
  assert.ok(turns.size > 50, 'tips turn their own ways');
});

test('each level cuts a feather coarser: 60, 24 and 12 triangles', () => {
  const set = featherSet(0.1, 0.1, 0.01);
  const triangles = (level: 'light' | 'balanced' | 'full') => set[level].getIndex()!.count / 3;
  assert.deepEqual([triangles('full'), triangles('balanced'), triangles('light')], [60, 24, 12]);
});

/** A renderer stand-in with a frame counter and a drawing buffer `height` tall. */
function fakeRenderer(height: number): WebGLRenderer & { next(): void } {
  const frame = { value: 0 };
  return {
    info: { render: { get frame() { return frame.value; } } },
    getDrawingBufferSize: (v: { set(x: number, y: number): unknown }) => (v.set(height, height), v),
    next: () => frame.value++,
  } as unknown as WebGLRenderer & { next(): void };
}

test('a layer draws every feather when the owl is large and a scattered share, coarser, when small', () => {
  const set = featherSet(0.1, 0.1, 0.01);
  const coat = featherLayer('coat', set.full, new MeshStandardMaterial(), strew(3));
  const fine = featherLayer('fine', set.full, new MeshStandardMaterial(), strew(4));
  const owl = new Scene().add(coat, fine);
  const watch = createDetailWatch(owl);
  followDetail(coat, watch, { geometries: set, share: COAT_SHARE });
  followDetail(fine, watch, { geometries: set, share: FINE_SHARE });
  const camera = new PerspectiveCamera(30, 1, 0.01, 1000);
  const renderer = fakeRenderer(900);
  const render = (z: number) => {
    camera.position.set(0.5, -0.5, z);
    camera.updateMatrixWorld(true);
    renderer.next();
    for (const mesh of [coat, fine]) mesh.onBeforeRender(renderer, owl, camera, mesh.geometry, mesh.material as never, null as never);
  };
  render(1); // ~1 unit tall from 1 unit away: large
  assert.equal(watch.level, 'full');
  assert.equal(coat.count, 400);
  assert.equal(coat.geometry, set.full);
  render(40); // far: small
  assert.equal(watch.level, 'light');
  assert.equal(coat.count, Math.round(400 * COAT_SHARE.light));
  assert.equal(coat.geometry, set.light);
  assert.equal(fine.count, 0, 'the finest layer is skipped');
  render(1);
  assert.equal(coat.count, 400, 'and everything comes back when it is large again');
  assert.equal(fine.count, 400);
});
