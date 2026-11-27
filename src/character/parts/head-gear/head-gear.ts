/**
 * Head Gear (slot `head`, any species with a head): gear on a band over the head.
 *
 * Pattern: Adapter (styles as a small Strategy table). The band follows the head's published dome
 * (`brim-hat/head-wear.ts`, `fit.ts`), so it sits on every head that offers the slot. It rides the
 * head bone.
 *
 * Styles (`style`, a whole number; anything else is clamped):
 *  0 headphones  a padded band arching over the crown to two cups at the sides, their rings lit
 *  1 headlamp    an elastic strap round the brow and a lamp at the front throwing a soft beam
 *  2 sprout      a little seed cap on the crown with a stem and two leaves that sway
 *
 * Effects: `color` (the band, the strap, the seed cap), `trim` (cushions, the lamp's light, the
 * leaves) and `glow` (how bright the cups' rings, the lamp and the leaves' sheen are; work adds).
 */
import { AdditiveBlending, Color, ConeGeometry, CylinderGeometry, DoubleSide, EllipseCurve, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, SphereGeometry, TorusGeometry, Vector3, type Material } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { clothMaterial, trimMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import type { PartFit } from '../fit.ts';
import { fittedShell, piping, ringPoints } from '../fitted-shell.ts';
import type { PartFrame, PartInstance } from '../part';
import { headOf, headRing, type Head } from '../brim-hat/head-wear.ts';

const STYLES = 3;
const SEGMENTS = 64;
/** Headphones: the band's stand-off over the head and thickness, the cups (share of the head's width). */
const BAND_EASE = 0.075;
const BAND = 0.045;
const CUP = { radius: 0.3, depth: 0.15 } as const;
const CUSHION = 0.045;
/** Headlamp: the strap's ease and height (share of the head's height), the lamp, its beam. */
const STRAP_EASE = 0.025;
const STRAP_HEIGHT = 0.16;
const LAMP = { radius: 0.085, depth: 0.09 } as const;
const LAMP_STAND = 0.01;
const BEAM = { length: 0.55, spread: 0.3, opacity: 0.045, pitch: 0.95 } as const;
/** Sprout: the seed cap's share of the dome, the stem's height and the leaves' size (share of the head's width). */
const SEED_DEPTH = 0.22;
const SEED_EASE = 0.035;
const STEM_HEIGHT = 0.55;
const LEAF = 0.3;
const LEAF_SWAY = 0.12;

export function createHeadGear(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'head-gear';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };
  const style = Math.min(Math.max(Math.round(effectNumber(effects, 'style')), 0), STYLES - 1);
  const head = headOf(shape);
  const colour = effectColour(effects, 'color');
  const trimColour = effectColour(effects, 'trim');
  const glow = effectNumber(effects, 'glow');
  const update = [buildHeadphones, buildHeadlamp, buildSprout][style](group, head, colour, trimColour, glow);
  return { group, pivotY: head.rim, update, dispose: () => disposeTree(group) };
}

type Builder = (group: Group, head: Head, colour: number, trim: number, glow: number) => (frame: PartFrame) => void;

const lit = (colour: number, strength: number): MeshPhysicalMaterial =>
  new MeshPhysicalMaterial({ color: colour, emissive: new Color(colour), emissiveIntensity: strength, roughness: 0.3, metalness: 0.2, clearcoat: 0.6 });

const buildHeadphones: Builder = (group, head, colour, trimColour, glow) => {
  const shell = new MeshPhysicalMaterial({ color: colour, roughness: 0.35, metalness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const cushion = clothMaterial(trimColour === colour ? 0x222222 : 0x1a1a1a, 0.7);
  const ring = lit(trimColour, 0.4 + glow);
  // The cups sit at the sides just below the rim; the band arches from one to the other over the crown.
  const cupY = Math.max(head.rim * 0.35, 0);
  const side = headRing(head, cupY, BAND_EASE).rx + CUP.depth * 0.5 + CUSHION * 2;
  const arch = new EllipseCurve(0, cupY, side - CUP.depth * 0.4, head.top + BAND_EASE - cupY, 0, Math.PI, false, 0);
  const points = arch.getPoints(48).map((p) => new Vector3(p.x, p.y, 0)).filter((p) => p.y >= cupY + CUP.radius * head.width * 0.6);
  group.add(new Mesh(piping(points, BAND), shell));
  group.add(new Mesh(piping(points.map((p) => p.clone().multiplyScalar(0.985)), BAND * 0.8), cushion));
  const cups: Mesh[] = [];
  for (const s of [-1, 1]) {
    const r = CUP.radius * head.width;
    const cup = new Mesh(new CylinderGeometry(r, r * 0.92, CUP.depth, 32), shell);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(s * side, cupY, 0);
    const pad = new Mesh(new TorusGeometry(r * 0.78, CUSHION, 12, 32), cushion);
    pad.rotation.y = Math.PI / 2;
    pad.position.set(s * (side - CUP.depth * 0.5 - CUSHION * 0.6), cupY, 0);
    const light = new Mesh(new TorusGeometry(r * 0.72, r * 0.07, 10, 40), ring);
    light.rotation.y = Math.PI / 2;
    light.position.set(s * (side + CUP.depth * 0.5), cupY, 0);
    group.add(cup, pad, light);
    cups.push(light);
  }
  return (frame) => {
    ring.emissiveIntensity = 0.4 + glow * (0.7 + 0.3 * Math.sin(frame.time * 3)) + frame.work * 0.6 + frame.voice * 0.8;
  };
};

const buildHeadlamp: Builder = (group, head, colour, trimColour, glow) => {
  const sq = head.shape.squareness;
  const strap = clothMaterial(colour, 0.75);
  const height = (head.top - head.rim) * STRAP_HEIGHT;
  const y = head.rim + height * 0.6;
  const rings = [y + height / 2, y - height / 2].map((h) => headRing(head, h, STRAP_EASE));
  group.add(new Mesh(fittedShell(rings, { segments: SEGMENTS, opening: 0, squareness: sq }), strap));
  const housing = new MeshPhysicalMaterial({ color: 0x2a2a2e, roughness: 0.35, metalness: 0.6, clearcoat: 0.6 });
  const r = LAMP.radius * head.width * 1.4;
  // The lamp stands a little proud of the strap so its round back clears the brow.
  const front = headRing(head, y - r, STRAP_EASE).rz + LAMP_STAND;
  const body = new Mesh(new CylinderGeometry(r, r * 1.08, LAMP.depth, 28), housing);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, y, front + LAMP.depth / 2);
  const lens = lit(trimColour, 1 + glow);
  const glass = new Mesh(new SphereGeometry(r * 0.88, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lens);
  glass.rotation.x = Math.PI / 2;
  glass.position.set(0, y, front + LAMP.depth);
  const bezel = new Mesh(new TorusGeometry(r * 0.95, r * 0.12, 10, 32), trimMaterial(0xc9ccd4));
  bezel.position.set(0, y, front + LAMP.depth);
  // The beam: a soft additive cone thrown forward and a little down.
  const beamMaterial = new MeshBasicMaterial({ color: new Color(trimColour).lerp(new Color(0xffffff), 0.6), transparent: true, opacity: BEAM.opacity * (0.4 + glow), blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
  const length = BEAM.length * head.width * 2;
  const beam = new Mesh(new ConeGeometry(length * BEAM.spread, length, 32, 1, true), beamMaterial);
  // Thrown forward and down (lighting the way ahead), its tip at the lamp.
  const dir = new Vector3(0, -Math.sin(BEAM.pitch), Math.cos(BEAM.pitch));
  beam.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().negate());
  beam.position.set(0, y, front + LAMP.depth).addScaledVector(dir, length / 2);
  beam.name = 'headlamp-beam';
  group.add(body, glass, bezel, beam);
  return (frame) => {
    const flicker = 0.92 + 0.08 * Math.sin(frame.time * 23) * Math.sin(frame.time * 7);
    lens.emissiveIntensity = (1 + glow + frame.work) * flicker;
    beamMaterial.opacity = BEAM.opacity * (0.4 + glow + 0.6 * frame.work) * flicker;
  };
};

const buildSprout: Builder = (group, head, colour, trimColour, glow) => {
  const seed = clothMaterial(colour, 0.9);
  const leafMaterial: Material = new MeshPhysicalMaterial({ color: trimColour, roughness: 0.45, sheen: 1, sheenColor: new Color(trimColour).lerp(new Color(0xffffff), 0.3), emissive: new Color(trimColour), emissiveIntensity: 0.1 * glow, side: DoubleSide });
  const count = 8;
  const bottom = head.top - SEED_DEPTH * (head.top - head.rim);
  const rings = Array.from({ length: count }, (_, i) => headRing(head, head.top * 0.999 + ((bottom - head.top * 0.999) * i) / (count - 1), SEED_EASE));
  group.add(new Mesh(fittedShell(rings, { segments: SEGMENTS, opening: 0, squareness: head.shape.squareness }), seed));
  group.add(new Mesh(piping(ringPoints(rings[count - 1], head.shape.squareness, 0, Math.PI * 2, 48), 0.012, true), seed));
  const sprout = new Group();
  sprout.position.y = head.top + SEED_EASE * 0.6;
  const height = STEM_HEIGHT * head.width;
  const stem = [new Vector3(0, 0, 0), new Vector3(0.02, height * 0.4, 0), new Vector3(-0.015, height * 0.75, 0.01), new Vector3(0, height, 0)];
  sprout.add(new Mesh(piping(stem, 0.018), leafMaterial));
  const leaves: Group[] = [-1, 1].map((s) => {
    const pivot = new Group();
    pivot.position.set(0, height * 0.92, 0);
    const leaf = new Mesh(new SphereGeometry(1, 20, 12), leafMaterial);
    const size = LEAF * head.width;
    leaf.scale.set(size, size * 0.12, size * 0.5);
    leaf.position.set(s * size * 0.95, size * 0.15, 0);
    leaf.rotation.z = s * 0.35;
    pivot.add(leaf);
    sprout.add(pivot);
    return pivot;
  });
  group.add(sprout);
  return (frame) => {
    const t = frame.time * frame.motion.speed;
    const a = frame.motion.amplitude;
    sprout.rotation.z = LEAF_SWAY * 0.5 * a * Math.sin(t * 1.3);
    leaves.forEach((leaf, i) => (leaf.rotation.z = (i ? -1 : 1) * (0.1 + LEAF_SWAY * a * (0.5 + 0.5 * Math.sin(t * 2 + i)) + 0.2 * frame.gotIt)));
  };
};
