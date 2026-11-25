/**
 * Invisible, low-poly ellipsoids that stand in for a skin's head and body when the stage
 * raycasts a touch. A material with `visible: false` is never drawn but still raycasts,
 * and a 16x12 sphere is a few hundred triangles instead of the tens of thousands of the
 * real crafted meshes, so `hitTest` stays cheap on every pointer move.
 */
import { Mesh, MeshBasicMaterial, SphereGeometry, type Object3D } from 'three';

export interface HitProxyShape {
  /** Half extents of the ellipsoid (x wide, y tall, z deep). */
  radii: readonly [number, number, number];
  /** Centre in the parent's space. */
  centre: readonly [number, number, number];
}

/** Adds a proxy to `parent` (so it follows the rig) and returns it. */
export function addHitProxy(parent: Object3D, shape: HitProxyShape): Mesh {
  const proxy = new Mesh(new SphereGeometry(1, 16, 12), new MeshBasicMaterial({ visible: false }));
  proxy.name = 'hit-proxy';
  proxy.scale.set(...shape.radii);
  proxy.position.set(...shape.centre);
  parent.add(proxy);
  return proxy;
}
