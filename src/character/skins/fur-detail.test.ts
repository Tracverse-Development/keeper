/**
 * Shell fur draws fewer shells, spread over the same length, when the keeper is small on screen.
 * Run: node --test --experimental-strip-types src/character/skins/fur-detail.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InstancedMesh, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, SphereGeometry, type WebGLRenderer } from 'three';
import { createFur, FUR_DETAIL_SHELLS, FUR_SHELLS } from './fur-shells.ts';

test('a small keeper draws the light shell count, a large one all of them', () => {
  const coat = new MeshStandardMaterial();
  const keeper = new Scene().add(new Mesh(new SphereGeometry(1), coat));
  const fur = createFur(keeper, { coat: { materials: [coat], length: 0.05 } });
  fur.show('coat', true);
  let shells: InstancedMesh | undefined;
  keeper.traverse((node) => {
    if (node instanceof InstancedMesh) shells = node;
  });
  assert.ok(shells, 'the coat grew shells');
  const frame = { value: 0 };
  const renderer = { info: { render: { get frame() { return frame.value; } } }, getDrawingBufferSize: (v: { set(x: number, y: number): unknown }) => (v.set(900, 900), v) } as unknown as WebGLRenderer;
  const camera = new PerspectiveCamera(30, 1, 0.1, 1000);
  const at = (z: number): number => {
    camera.position.set(0, 0, z);
    camera.updateMatrixWorld(true);
    frame.value++;
    shells!.onBeforeRender(renderer, keeper, camera, shells!.geometry, shells!.material as never, null as never);
    return shells!.count;
  };
  assert.equal(at(4), FUR_SHELLS);
  assert.equal(at(60), FUR_DETAIL_SHELLS.light);
  assert.ok(FUR_DETAIL_SHELLS.light < FUR_DETAIL_SHELLS.balanced && FUR_DETAIL_SHELLS.balanced < FUR_SHELLS);
  fur.dispose();
});
