/**
 * Zone focus: where a camera should look to frame one paint zone (the Studio's zoom onto the
 * part being changed), measured from the rig itself so it always matches the body.
 *
 * A skin lists, for each zone, the meshes that make it up and the side to look from (`yaw`,
 * radians round the body: 0 = from the front, positive = from the character's left, which is the
 * screen's right); `measureZones` takes their bounding sphere in the skin root's space with the
 * rig at rest (once, at build) and turns it into a camera distance that frames it with a margin.
 * The character's world transform at rest is the identity, so these are world coordinates.
 */
import { Box3, Sphere, type Material, type Mesh, type Object3D } from 'three';
import type { ZoneFocus } from '../contract';

export type { ZoneFocus } from '../contract';

export interface ZoneParts {
  readonly meshes: readonly Object3D[];
  readonly yaw?: number;
}

/** The vertical field of view the stage camera uses (degrees; `stage/scene.ts`). */
export const FOCUS_FIELD_OF_VIEW = 30;
/** How much of the view the zone fills, and the closest the camera comes. */
const FILL = 0.62;
const NEAREST = 3.4;

/** Measures every zone's focus on `root` (the rig at rest). */
export function measureZones(root: Object3D, zones: Readonly<Record<string, ZoneParts>>): Readonly<Record<string, ZoneFocus>> {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const out: Record<string, ZoneFocus> = {};
  const box = new Box3();
  const part = new Box3();
  const sphere = new Sphere();
  for (const [zone, { meshes, yaw = 0 }] of Object.entries(zones)) {
    box.makeEmpty();
    for (const mesh of meshes) box.union(part.setFromObject(mesh, true).applyMatrix4(inverse));
    if (box.isEmpty()) continue;
    box.getBoundingSphere(sphere);
    const halfFov = (FOCUS_FIELD_OF_VIEW * Math.PI) / 360;
    const distance = Math.max(NEAREST, sphere.radius / FILL / Math.tan(halfFov));
    const c = sphere.center;
    out[zone] = { target: { x: c.x, y: c.y, z: c.z }, distance, yaw };
  }
  return out;
}



/**
 * Each zone's meshes found by material: every visible mesh under `root` wearing that zone's
 * material, framed from `yaw[zone]` (default the front). For bodies whose zones are their materials.
 */
export function zonesByMaterial(root: Object3D, materials: Readonly<Record<string, Material>>, yaw: Readonly<Record<string, number>> = {}): Record<string, ZoneParts> {
  const meshes: Record<string, Object3D[]> = {};
  root.traverse((node) => {
    const material = (node as Mesh).material;
    for (const [zone, m] of Object.entries(materials)) if (material === m && node.visible) (meshes[zone] ??= []).push(node);
  });
  return Object.fromEntries(Object.entries(meshes).map(([zone, list]) => [zone, { meshes: list, yaw: yaw[zone] ?? 0 }]));
}
