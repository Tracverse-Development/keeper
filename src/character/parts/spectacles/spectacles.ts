/**
 * Round Spectacles (slot `face`, every face): two round wire rims over the eyes the face publishes
 * (`BodyShape.eyes`), a bridge between them and temples running back to the sides of the head.
 *
 * Pattern: Adapter. The rims are sized to the eyes, set just in front of the face's surface at eye
 * height, and the temples follow the head's own width there, so the same pair sits on the robot's
 * visor, the dog's blaze, a person's nose and the owl's facial disc. It rides the head bone.
 *
 * Effects: `color` (the wire), `lens` (the glass tint), `shine` (how much the glass catches the
 * light, and its soft glint sweeping now and then) and `style`: 0 the round pair, 1 a single
 * monocle over the right eye (a heavier rim, etched with small stars, on a chain that loops down
 * the side of the face).
 */
import { CatmullRomCurve3, CircleGeometry, Group, Mesh, MeshPhysicalMaterial, OctahedronGeometry, TorusGeometry, TubeGeometry, Vector3, type Material } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { trimMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { radiusAt, type FaceEyes, type PartFit } from '../fit.ts';
import type { PartFrame, PartInstance } from '../part';

/** Rim size over the eye's radius, how far in front of the face it sits, and the wire's thickness. */
const RIM_SHARE = 1.12;
const STAND_OFF = 0.05;
const WIRE = 0.01;
/** The monocle: its rim over the eye's radius, its thicker wire, its etched stars and its chain. */
const MONOCLE_SHARE = 1.3;
const MONOCLE_WIRE = 0.018;
const MONOCLE_STARS = 8;
const CHAIN_LINKS = 14;

export function createSpectacles(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'round-spectacles';
  const eyes = fit.shape?.eyes;
  if (!fit.shape || !eyes) return { group, update: () => undefined, dispose: () => disposeTree(group) };

  const wire = trimMaterial(effectColour(effects, 'color'));
  const shine = effectNumber(effects, 'shine');
  const glass = new MeshPhysicalMaterial({
    color: effectColour(effects, 'lens'),
    transparent: true,
    opacity: 0.22 + 0.18 * shine,
    roughness: 0.05,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    emissive: effectColour(effects, 'lens'),
    emissiveIntensity: 0.08,
    depthWrite: false,
  });
  const z = eyes.front + STAND_OFF;
  const update = (frame: PartFrame) => {
    // Now and then the glass catches the light: a soft glint that sweeps and fades.
    const glint = Math.max(0, Math.sin(frame.time * 0.7)) ** 24;
    glass.emissiveIntensity = 0.08 + shine * (0.1 + 0.9 * glint);
  };
  if (Math.round(effectNumber(effects, 'style')) >= 1) {
    buildMonocle(group, wire, glass, eyes, z, radiusAt(fit.shape, eyes.y));
    return { group, pivotY: eyes.y, update, dispose: () => disposeTree(group) };
  }
  const rim = eyes.radius * RIM_SHARE;
  for (const side of [-1, 1]) {
    const ring = new Mesh(new TorusGeometry(rim, WIRE, 10, 48), wire);
    ring.position.set(side * eyes.x, eyes.y, z);
    group.add(ring);
    const lens = new Mesh(new CircleGeometry(rim, 40), glass);
    lens.position.set(side * eyes.x, eyes.y, z - 0.004);
    group.add(lens);
    // The temple: from the rim's outer edge back along the side of the head, just off its surface.
    const width = radiusAt(fit.shape, eyes.y) || eyes.x + rim * 2;
    const temple = new CatmullRomCurve3([
      new Vector3(side * (eyes.x + rim), eyes.y, z - 0.01),
      new Vector3(side * (width * 0.92 + 0.03), eyes.y + 0.01, z * 0.55),
      new Vector3(side * (width + 0.03), eyes.y - 0.02, 0),
    ]);
    group.add(new Mesh(new TubeGeometry(temple, 24, WIRE * 0.8, 8), wire));
  }
  const gap = Math.max(eyes.x - rim, 0.01);
  const bridge = new Mesh(new TorusGeometry(gap, WIRE, 8, 16, Math.PI), wire);
  bridge.position.set(0, eyes.y + rim * 0.15, z + 0.005);
  group.add(bridge);

  return { group, pivotY: eyes.y, update, dispose: () => disposeTree(group) };
}

/** One rim over the right eye (-x, the keeper's own right), etched with stars, on a hanging chain. */
function buildMonocle(group: Group, wire: Material, glass: Material, eyes: FaceEyes, z: number, width: number): void {
  const rim = eyes.radius * MONOCLE_SHARE;
  const x = -eyes.x;
  const ring = new Mesh(new TorusGeometry(rim, MONOCLE_WIRE, 12, 56), wire);
  ring.position.set(x, eyes.y, z);
  const lens = new Mesh(new CircleGeometry(rim, 48), glass);
  lens.position.set(x, eyes.y, z - 0.004);
  group.add(ring, lens);
  const star = new OctahedronGeometry(MONOCLE_WIRE * 0.9, 0);
  for (let i = 0; i < MONOCLE_STARS; i++) {
    const a = (i / MONOCLE_STARS) * Math.PI * 2;
    const s = new Mesh(star, wire);
    s.position.set(x + Math.cos(a) * rim, eyes.y + Math.sin(a) * rim, z + MONOCLE_WIRE);
    group.add(s);
  }
  // The chain: from the rim's outer edge down and back along the side of the face.
  const side = Math.max(width, Math.abs(x) + rim) + 0.04;
  const chain = new CatmullRomCurve3([
    new Vector3(x - rim, eyes.y - rim * 0.3, z),
    new Vector3(-side * 0.95, eyes.y - rim * 1.6, z * 0.75),
    new Vector3(-side, eyes.y - rim * 2.6, z * 0.35),
  ]);
  const link = new TorusGeometry(MONOCLE_WIRE * 0.9, MONOCLE_WIRE * 0.3, 6, 12);
  for (let i = 0; i <= CHAIN_LINKS; i++) {
    const l = new Mesh(link, wire);
    l.position.copy(chain.getPoint(i / CHAIN_LINKS));
    l.rotation.set(i % 2 ? Math.PI / 2 : 0, 0.4, 0);
    group.add(l);
  }
}
