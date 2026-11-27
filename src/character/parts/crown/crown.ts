/**
 * The Crown (slot `head`, any species with a head): something worn round the brow.
 *
 * Pattern: Adapter (styles as a small Strategy table). Every style is built on the ring the head
 * publishes at its rim (`brim-hat/head-wear.ts`, `fit.ts`), eased, so it sits on the robot's dome,
 * the dog's skull, a person's hair and the owl's head alike, never inside it. It rides the head bone.
 *
 * Styles (`style`, a whole number; anything else is clamped):
 *  0 circlet          a thin gold band with small beads round it and a cut jewel at the front
 *  1 leaf crown       a ring of leaves laid round the head, tips up, with a few berries
 *  2 feather plumes   a jewelled band with a tall fan of plumes rising at the front, swaying (carnival)
 *  3 crown of rays    a gold band with tall rays all round, tallest at the front, burning brighter
 *                     with work and flaring as an answer arrives (the Seraph crown)
 *
 * Effects: `color` (the metal, the leaves, the band), `trim` (the jewel, berries, alternate plumes,
 * the rays' light) and `glow` (how much the jewel, plumes and rays shine).
 */
import { Color, ConeGeometry, DoubleSide, Group, Mesh, MeshPhysicalMaterial, OctahedronGeometry, SphereGeometry, Vector3 } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import type { GarmentRing, PartFit } from '../fit.ts';
import { fittedShell, piping, ringPoints } from '../fitted-shell.ts';
import type { PartFrame, PartInstance } from '../part';
import { headOf, headRing, onRing, type Head } from '../brim-hat/head-wear.ts';

const STYLES = 4;
const SEGMENTS = 72;
/** Where the band sits above the rim (share of the head's height above it) and how far it stands off. */
const BAND_LIFT = 0.12;
const EASE = 0.025;
const BAND = 0.02;
/** The circlet's beads and its jewel (share of the head's width). */
const BEADS = 16;
const JEWEL = 0.09;
/** Leaves: how many round the head, their size (share of the head's width), berries. */
const LEAVES = 18;
const LEAF = 0.15;
const BERRIES = 6;
/** Plumes: how many in the fan, their height (share of the head's height), the fan's spread, sway. */
const PLUMES = 9;
const PLUME_HEIGHT = 0.95;
const PLUME_SPREAD = 1.1;
const PLUME_SWAY = 0.06;
/** The fan leans forward a little, away from the head. */
const PLUME_LEAN = 0.16;
/** Rays: how many round the head, the tallest (share of the head's height), their width, their outward lean. */
const RAYS = 13;
const RAY_HEIGHT = 0.9;
const RAY_WIDTH = 0.06;
const RAY_LEAN = 0.32;

export function createCrown(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'crown';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };
  const style = Math.min(Math.max(Math.round(effectNumber(effects, 'style')), 0), STYLES - 1);
  const head = headOf(shape);
  const look: Look = { metal: effectColour(effects, 'color'), jewel: effectColour(effects, 'trim'), glow: effectNumber(effects, 'glow') };
  const band = headRing(head, head.rim + BAND_LIFT * (head.top - head.rim), EASE);
  const update = [buildCirclet, buildLeaves, buildPlumes, buildRays][style](group, head, band, look);
  return { group, pivotY: head.rim, update, dispose: () => disposeTree(group) };
}

interface Look {
  readonly metal: number;
  readonly jewel: number;
  readonly glow: number;
}

type Builder = (group: Group, head: Head, band: GarmentRing, look: Look) => (frame: PartFrame) => void;

const gold = (colour: number): MeshPhysicalMaterial => new MeshPhysicalMaterial({ color: colour, roughness: 0.22, metalness: 0.95, clearcoat: 0.6, clearcoatRoughness: 0.15, emissive: new Color(colour), emissiveIntensity: 0.06 });
const gem = (colour: number, glow: number): MeshPhysicalMaterial =>
  new MeshPhysicalMaterial({ color: colour, roughness: 0.05, metalness: 0.1, clearcoat: 1, emissive: new Color(colour), emissiveIntensity: 0.25 + 0.6 * glow, transmission: 0.2, thickness: 0.1 });

/** A ring of the band (a thin metal tube) round `ring`, pushed `out`. */
function bandTube(ring: GarmentRing, squareness: number, radius: number): Mesh {
  return new Mesh(piping(ringPoints({ ...ring, rx: ring.rx + radius, rz: ring.rz + radius }, squareness, 0, Math.PI * 2, 96).slice(0, -1), radius, true));
}

const buildCirclet: Builder = (group, head, band, look) => {
  const sq = head.shape.squareness;
  const metal = gold(look.metal);
  const tube = bandTube(band, sq, BAND);
  tube.material = metal;
  group.add(tube);
  const bead = new SphereGeometry(BAND * 1.3, 12, 8);
  for (let i = 1; i < BEADS; i++) {
    const b = new Mesh(bead, metal);
    b.position.copy(onRing(band, sq, (i / BEADS) * Math.PI * 2, BAND * 2.2));
    group.add(b);
  }
  // The jewel at the front in a small pointed setting.
  const stone = gem(look.jewel, look.glow);
  const size = JEWEL * head.width;
  const front = onRing(band, sq, 0, BAND * 2 + size * 0.6);
  const jewel = new Mesh(new OctahedronGeometry(size, 0), stone);
  jewel.scale.set(0.8, 1.15, 0.55);
  jewel.position.copy(front).add(new Vector3(0, size * 0.35, 0));
  const setting = new Mesh(new ConeGeometry(size * 0.55, size * 1.6, 4, 1, true), metal);
  setting.position.copy(front).add(new Vector3(0, size * 0.9, -size * 0.2));
  group.add(jewel, setting);
  return (frame) => {
    stone.emissiveIntensity = 0.25 + look.glow * (0.6 + 0.3 * Math.sin(frame.time * 2)) + 0.8 * frame.gotIt;
  };
};

const buildLeaves: Builder = (group, head, band, look) => {
  const sq = head.shape.squareness;
  const leafMaterial = new MeshPhysicalMaterial({ color: look.metal, roughness: 0.5, sheen: 1, sheenColor: new Color(look.metal).lerp(new Color(0xffffff), 0.3), side: DoubleSide });
  const vine = bandTube(band, sq, BAND * 0.7);
  vine.material = new MeshPhysicalMaterial({ color: new Color(look.metal).multiplyScalar(0.55), roughness: 0.7 });
  group.add(vine);
  const leaf = new SphereGeometry(1, 16, 10);
  const size = LEAF * head.width;
  for (let i = 0; i < LEAVES; i++) {
    const angle = (i / LEAVES) * Math.PI * 2;
    const base = onRing(band, sq, angle, size * 0.2 + BAND);
    const out = new Vector3(base.x, 0, base.z).normalize();
    const m = new Mesh(leaf, leafMaterial);
    m.scale.set(size * 0.38, size, size * 0.1);
    // Tip up and leaning out, alternate leaves turned a little.
    m.position.copy(base).addScaledVector(out, size * 0.22).add(new Vector3(0, size * 0.55, 0));
    m.lookAt(m.position.clone().add(out));
    m.rotateX(-0.45);
    m.rotateZ((i % 2 ? 1 : -1) * 0.35);
    group.add(m);
  }
  const berry = new SphereGeometry(0.03 * head.width + 0.012, 12, 8);
  const berryMaterial = gem(look.jewel, look.glow * 0.4);
  for (let i = 0; i < BERRIES; i++) {
    const b = new Mesh(berry, berryMaterial);
    b.position.copy(onRing(band, sq, ((i + 0.5) / BERRIES) * Math.PI * 2, BAND * 3 + 0.02));
    group.add(b);
  }
  return () => undefined;
};

const buildPlumes: Builder = (group, head, band, look) => {
  const sq = head.shape.squareness;
  const metal = gold(look.metal);
  const height = (head.top - head.rim) * 0.35;
  const rings = [band.y + height, band.y - height * 0.3].map((y) => headRing(head, y, EASE));
  group.add(new Mesh(fittedShell(rings, { segments: SEGMENTS, opening: 0, squareness: sq }), metal));
  const jewels = gem(look.jewel, look.glow);
  const stoneSize = 0.045 * head.width + 0.015;
  const stone = new OctahedronGeometry(stoneSize, 0);
  for (let i = 0; i < 9; i++) {
    const s = new Mesh(stone, jewels);
    s.position.copy(onRing(headRing(head, band.y + height * 0.35, EASE), sq, ((i - 4) / 9) * 1.6, stoneSize * 1.1));
    group.add(s);
  }
  const front = onRing(rings[0], sq, 0, 0.03);
  const fan = new Group();
  fan.position.copy(front);
  const tall = PLUME_HEIGHT * (head.top - head.rim + head.width * 0.5);
  const featherA = plumeMaterial(look.metal, look.glow);
  const featherB = plumeMaterial(look.jewel, look.glow);
  const quill = gold(look.metal);
  const plumes: Group[] = [];
  for (let i = 0; i < PLUMES; i++) {
    const u = i / (PLUMES - 1) - 0.5;
    const pivot = new Group();
    pivot.rotation.z = -u * PLUME_SPREAD;
    pivot.rotation.x = PLUME_LEAN;
    const length = tall * (1 - 0.35 * Math.abs(u) * 2);
    const vane = new Mesh(new SphereGeometry(1, 20, 14), i % 2 ? featherB : featherA);
    vane.scale.set(length * 0.12, length * 0.5, length * 0.03);
    vane.position.y = length * 0.55;
    const spine = new Mesh(piping([new Vector3(0, 0, 0.005), new Vector3(0, length * 0.5, length * 0.03), new Vector3(0, length * 1.02, 0.01)], 0.006), quill);
    pivot.add(vane, spine);
    fan.add(pivot);
    plumes.push(pivot);
  }
  group.add(fan);
  const rest = plumes.map((p) => p.rotation.z);
  return (frame) => {
    const t = frame.time * frame.motion.speed;
    plumes.forEach((p, i) => (p.rotation.z = rest[i] + PLUME_SWAY * frame.motion.amplitude * (1 + frame.work) * Math.sin(t * 1.6 + i * 0.7)));
    jewels.emissiveIntensity = 0.25 + look.glow * (0.6 + 0.4 * Math.sin(t * 3)) + frame.gotIt;
  };
};

const plumeMaterial = (colour: number, glow: number): MeshPhysicalMaterial =>
  new MeshPhysicalMaterial({ color: colour, roughness: 0.55, sheen: 1, sheenRoughness: 0.3, sheenColor: new Color(colour).lerp(new Color(0xffffff), 0.5), emissive: new Color(colour), emissiveIntensity: 0.08 * glow, side: DoubleSide });

const buildRays: Builder = (group, head, band, look) => {
  const sq = head.shape.squareness;
  const metal = gold(look.metal);
  const tube = bandTube(band, sq, BAND * 1.6);
  tube.material = metal;
  group.add(tube);
  const upper = headRing(head, band.y + (head.top - head.rim) * 0.12, EASE);
  const upperTube = bandTube(upper, sq, BAND);
  upperTube.material = metal;
  group.add(upperTube);
  const light = new MeshPhysicalMaterial({ color: look.metal, roughness: 0.2, metalness: 0.7, emissive: new Color(look.jewel).lerp(new Color(look.metal), 0.4), emissiveIntensity: 0.3 + look.glow, clearcoat: 1 });
  const tall = RAY_HEIGHT * (head.top - head.rim + head.width * 0.4);
  const rays: Mesh[] = [];
  for (let i = 0; i < RAYS; i++) {
    const angle = (i / RAYS) * Math.PI * 2;
    const front = 0.5 + 0.5 * Math.cos(angle);
    const length = tall * (0.55 + 0.45 * front);
    const base = onRing(band, sq, angle, BAND * 2);
    const out = new Vector3(base.x, 0, base.z).normalize();
    const ray = new Mesh(new ConeGeometry(RAY_WIDTH * head.width, length, 4), light);
    // Stand the ray on the band, leaning outward, so it never cuts into the head.
    const dir = new Vector3(0, 1, 0).addScaledVector(out, RAY_LEAN).normalize();
    ray.position.copy(base).addScaledVector(dir, length / 2);
    ray.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir);
    group.add(ray);
    rays.push(ray);
  }
  // A jewel at the front, between the bands.
  const stone = gem(look.jewel, look.glow);
  const jewel = new Mesh(new OctahedronGeometry(JEWEL * head.width, 0), stone);
  jewel.scale.set(0.8, 1.1, 0.5);
  jewel.position.copy(onRing(headRing(head, (band.y + upper.y) / 2, EASE), sq, 0, JEWEL * head.width * 0.6));
  group.add(jewel);
  return (frame) => {
    const t = frame.time * frame.motion.speed;
    light.emissiveIntensity = 0.3 + look.glow * (0.8 + 0.2 * Math.sin(t * 2.2)) + 1.2 * frame.work + 2 * frame.gotIt;
    stone.emissiveIntensity = 0.3 + look.glow + frame.gotIt;
    rays.forEach((ray, i) => ray.scale.set(1, 1 + 0.06 * frame.work * Math.sin(t * 4 + i), 1));
  };
};
