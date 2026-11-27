/**
 * The Gear Loupe (slot `face`, every face; the owl's Clockwork set): a clockmaker's loupe. A brass
 * head band runs round the brow; on the wearer's right a hinge block carries a short arm down to a
 * stepped eyepiece over the right eye (three brass barrels, each narrower than the last, with
 * knurled rings and a lens that catches the light). Over the left eye a second, smaller lens is
 * flipped up on its own arm. Two gears mesh at the hinge and turn as the keeper works.
 *
 * Pattern: Adapter. The eyepiece is sized to the eye the face publishes (`BodyShape.eyes`) and
 * starts just outside the face's surface in front of it (`face-fit.ts`); the band follows the
 * head's rings at brow height. So it sits on the owl's facial disc and on every other face too.
 *
 * Effects: `color` (the brass), `lens` (the glass tint) and `shine` (its glint).
 */
import { CircleGeometry, CylinderGeometry, Group, Mesh, MeshPhysicalMaterial, SphereGeometry, TorusGeometry, BoxGeometry, type BufferGeometry, type Material } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import type { PartFit } from '../fit.ts';
import { fittedShell } from '../fitted-shell.ts';
import { metalMaterial } from '../glow-kit.ts';
import { gear, meshAdder, merged } from '../detail-kit.ts';
import { bandRings, frontUnder } from '../face-fit.ts';
import type { PartFrame, PartInstance } from '../part';

/** The eyepiece's barrels: radius (share of the eye's) and length (share of the eye's radius). */
const BARRELS: readonly { readonly radius: number; readonly length: number }[] = [
  { radius: 1.18, length: 0.42 },
  { radius: 0.98, length: 0.5 },
  { radius: 0.78, length: 0.44 },
];
/** The band: its height above the eyes (share of the eye's radius), its own height and ease. */
const BAND_LIFT = 1.9;
const BAND_HEIGHT = 0.34;
const EASE = 0.02;
const KNURLS = 28;

export function createGearLoupe(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'gear-loupe';
  const shape = fit.shape;
  const eyes = shape?.eyes;
  if (!shape || !eyes) return { group, update: () => undefined, dispose: () => disposeTree(group) };

  const brass = metalMaterial(effectColour(effects, 'color'), 0.26, 0.05);
  const darkBrass = metalMaterial(0x6a4a22, 0.4, 0.02);
  const shine = effectNumber(effects, 'shine');
  const glass = new MeshPhysicalMaterial({ color: effectColour(effects, 'lens'), transparent: true, opacity: 0.32 + 0.2 * shine, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, emissive: effectColour(effects, 'lens'), emissiveIntensity: 0.1, depthWrite: false });
  const add = meshAdder(group);
  const e = eyes.radius;

  // The brow band.
  const bandY = eyes.y + e * BAND_LIFT;
  const rings = bandRings(shape, bandY + (e * BAND_HEIGHT) / 2, bandY - (e * BAND_HEIGHT) / 2, EASE);
  add(fittedShell(rings, { segments: 72, opening: 0, squareness: shape.squareness }), brass, 'loupe-band');
  const front = rings[1].rz;

  // The eyepiece over the right eye (-x), barrel by barrel out from the face.
  const x = -eyes.x;
  let z = frontUnder(shape, x, eyes.y, e * BARRELS[0].radius) + 0.012;
  const knurls: BufferGeometry[] = [];
  for (const [i, barrel] of BARRELS.entries()) {
    const r = e * barrel.radius;
    const length = e * barrel.length;
    add(new CylinderGeometry(r, r, length, 36, 1, false).rotateX(Math.PI / 2).translate(x, eyes.y, z + length / 2), i === 1 ? darkBrass : brass, 'loupe-barrel');
    add(new TorusGeometry(r, r * 0.07, 8, 40).translate(x, eyes.y, z + length), brass, 'loupe-step');
    if (i < 2) for (let k = 0; k < KNURLS; k++) {
      const a = (k / KNURLS) * Math.PI * 2;
      knurls.push(new BoxGeometry(r * 0.05, r * 0.05, length * 0.7).translate(x + Math.cos(a) * r, eyes.y + Math.sin(a) * r, z + length / 2));
    }
    z += length;
  }
  add(merged(knurls), brass, 'loupe-knurls');
  const lensRadius = e * BARRELS[BARRELS.length - 1].radius * 0.9;
  add(new SphereGeometry(lensRadius, 28, 12, 0, Math.PI * 2, 0, 0.6).rotateX(Math.PI / 2).translate(x, eyes.y, z - lensRadius * Math.cos(0.6)), glass, 'loupe-lens');

  // The hinge on the right of the band, its arm down to the eyepiece, and two meshing gears.
  const hingeX = x - e * 0.9;
  const hingeZ = Math.max(front, z * 0.55) + 0.01;
  add(new BoxGeometry(e * 0.5, e * 0.55, e * 0.42).translate(hingeX, bandY, front + e * 0.18), brass, 'loupe-hinge');
  add(armBetween(hingeX + e * 0.1, bandY - e * 0.2, front + e * 0.3, x - e * BARRELS[0].radius * 0.8, eyes.y + e * 0.4, hingeZ + e * 0.3, e * 0.09), brass, 'loupe-arm');
  const gears = new Group();
  gears.name = 'loupe-gears';
  gears.position.set(hingeX - e * 0.12, bandY + e * 0.05, front + e * 0.42);
  group.add(gears);
  const big = new Mesh(gear(e * 0.5, 12, e * 0.1, 0.22, 4), brass);
  const small = new Mesh(gear(e * 0.3, 8, e * 0.1, 0.25), darkBrass);
  small.position.set(e * 0.72, e * 0.38, e * 0.06);
  gears.add(big, small);

  // The second lens, flipped up over the left eye: hinged on the band, swung forward and up.
  const flip = new Group();
  flip.name = 'loupe-flip';
  flip.position.set(eyes.x, bandY - e * 0.05, front + e * 0.12);
  flip.rotation.x = -1.25;
  group.add(flip);
  const flipRadius = e * 0.72;
  const reach = e * 0.5 + flipRadius;
  flip.add(named(new Mesh(new BoxGeometry(e * 0.36, e * 0.24, e * 0.24), brass), 'loupe-flip-hinge'));
  flip.add(named(new Mesh(new BoxGeometry(e * 0.12, e * 0.6, e * 0.06).translate(0, -e * 0.3, 0), brass), 'loupe-flip-arm'));
  flip.add(named(new Mesh(new TorusGeometry(flipRadius, flipRadius * 0.12, 8, 36).translate(0, -reach, 0), brass), 'loupe-flip-rim'));
  flip.add(named(new Mesh(new CircleGeometry(flipRadius * 0.92, 32).translate(0, -reach, 0), glass), 'loupe-flip-lens'));

  const update = (frame: PartFrame) => {
    // The gears turn against each other; faster while the keeper works.
    const turn = frame.dt * (0.4 + 2.2 * frame.work) * frame.motion.speed;
    big.rotation.z += turn;
    small.rotation.z -= turn * (12 / 8);
    const glint = Math.max(0, Math.sin(frame.time * 0.7 + 2)) ** 22;
    glass.emissiveIntensity = 0.1 + shine * (0.1 + glint);
  };
  return { group, pivotY: eyes.y, update, dispose: () => disposeTree(group) };
}

/** A bar from one point to another (the hinge arm). */
function armBetween(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, thickness: number): BufferGeometry {
  const length = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
  const bar = new CylinderGeometry(thickness, thickness, length, 10);
  const mesh = new Mesh(bar);
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  mesh.lookAt(x1, y1, z1);
  mesh.rotateX(Math.PI / 2);
  mesh.updateMatrix();
  return bar.applyMatrix4(mesh.matrix);
}

function named<T extends Mesh<BufferGeometry, Material>>(mesh: T, name: string): T {
  mesh.name = name;
  return mesh;
}
