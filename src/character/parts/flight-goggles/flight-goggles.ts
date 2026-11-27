/**
 * Flight Goggles (slot `face`, every face; the woman's Sky Pilot set): a pair of flying goggles
 * over the eyes. Each eye gets a padded leather cushion against the face, a short brass cup with
 * vent slits round its side, a heavy brass rim held by six screws and a disc of tinted glass that
 * catches the light; a leather bridge with a brass plate joins the two, and a leather strap runs
 * from each cup round the back of the head with a brass buckle on one side.
 *
 * Pattern: Adapter. Every size comes from the eyes the face publishes (`BodyShape.eyes`), each cup
 * starts just outside the face's own surface in front of its eye (`face-fit.ts`), and the strap
 * follows the head's rings at eye height, so the same goggles sit on the robot's visor, the dog's
 * muzzle, a person's face and the owl's facial disc. It rides the head bone.
 *
 * Effects: `color` (the brass), `trim` (the leather), `lens` (the glass tint), `shine` (its glint).
 */
import { BoxGeometry, CircleGeometry, CylinderGeometry, Group, MeshPhysicalMaterial, SphereGeometry, TorusGeometry, type BufferGeometry } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import type { PartFit } from '../fit.ts';
import { fittedShell } from '../fitted-shell.ts';
import { metalMaterial } from '../glow-kit.ts';
import { leatherMaterial } from '../leather.ts';
import { meshAdder, merged } from '../detail-kit.ts';
import { bandRings, frontUnder } from '../face-fit.ts';
import type { PartFrame, PartInstance } from '../part';

/** The rim over the eye's radius, the cup's depth over the rim, the cushion and rim tubes. */
const RIM_SHARE = 1.28;
const CUP_DEPTH = 0.62;
const CUSHION = 0.2;
const RIM_TUBE = 0.11;
/** The cushion stands this far off the face; the strap this far off the head, this tall. */
const EASE = 0.012;
const STRAP_EASE = 0.022;
const STRAP_HEIGHT = 0.55;
const SCREWS = 6;
const VENTS = 8;

export function createFlightGoggles(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'flight-goggles';
  const shape = fit.shape;
  const eyes = shape?.eyes;
  if (!shape || !eyes) return { group, update: () => undefined, dispose: () => disposeTree(group) };

  const brass = metalMaterial(effectColour(effects, 'color'), 0.28, 0.04);
  const strap = leatherMaterial(effectColour(effects, 'trim'), 0.55);
  const shine = effectNumber(effects, 'shine');
  const glass = new MeshPhysicalMaterial({ color: effectColour(effects, 'lens'), transparent: true, opacity: 0.38 + 0.2 * shine, roughness: 0.04, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, emissive: effectColour(effects, 'lens'), emissiveIntensity: 0.1, depthWrite: false });
  const dark = new MeshPhysicalMaterial({ color: 0x14100c, roughness: 0.8 });
  const add = meshAdder(group);

  const rim = eyes.radius * RIM_SHARE;
  const depth = rim * CUP_DEPTH;
  const cushion = rim * CUSHION;
  let outer = 0;
  let deepest = 0;
  for (const side of [-1, 1]) {
    const x = side * eyes.x;
    // The cup starts just outside the face wherever its cushion would touch.
    const back = frontUnder(shape, x, eyes.y, rim + cushion) + cushion + EASE;
    deepest = Math.max(deepest, back);
    const front = back + depth;
    add(new TorusGeometry(rim * 1.02, cushion, 12, 40).translate(x, eyes.y, back), strap, 'goggle-cushion');
    add(new CylinderGeometry(rim * 0.98, rim * 1.06, depth, 36, 1, true).rotateX(Math.PI / 2).translate(x, eyes.y, back + depth / 2), brass, 'goggle-cup');
    add(vents(x, eyes.y, back + depth * 0.5, rim * 1.0, depth), dark, 'goggle-vents');
    add(new TorusGeometry(rim, rim * RIM_TUBE, 12, 48).translate(x, eyes.y, front), brass, 'goggle-rim');
    add(screws(x, eyes.y, front + rim * RIM_TUBE * 0.6, rim), brass, 'goggle-screws');
    add(new CircleGeometry(rim * 0.95, 40).translate(x, eyes.y, front - 0.002), glass, 'goggle-lens');
    outer = Math.max(outer, Math.abs(x) + rim + cushion);
  }
  // The bridge between the cups: a leather band with a small brass plate.
  const gap = Math.max(eyes.x - rim - cushion * 0.5, 0.01);
  add(new BoxGeometry(gap * 2 + cushion, rim * 0.34, cushion * 1.2).translate(0, eyes.y + rim * 0.1, deepest + cushion * 0.2), strap, 'goggle-bridge');
  add(new BoxGeometry(gap * 1.2, rim * 0.22, cushion * 0.5).translate(0, eyes.y + rim * 0.1, deepest + cushion * 0.9), brass, 'goggle-bridge-plate');

  // The strap round the back of the head, from one cup's outer edge to the other's.
  const height = rim * STRAP_HEIGHT;
  const rings = bandRings(shape, eyes.y + height / 2, eyes.y - height / 2, STRAP_EASE);
  const halfWidth = rings[1].rx;
  const opening = 2 * Math.asin(Math.min(outer / halfWidth, 0.98));
  add(fittedShell(rings, { segments: 64, opening, squareness: shape.squareness }), strap, 'goggle-strap');
  // A brass buckle on the wearer's left side, standing on the strap.
  const buckleAngle = Math.PI / 2 + 0.35;
  const bx = Math.sin(buckleAngle) * (rings[1].rx + 0.012);
  const bz = Math.cos(buckleAngle) * (rings[1].rz + 0.012);
  const buckle = merged([
    new BoxGeometry(0.012, height * 1.25, 0.01).translate(0, 0, -height * 0.32),
    new BoxGeometry(0.012, height * 1.25, 0.01).translate(0, 0, height * 0.32),
    new BoxGeometry(0.012, 0.01, height * 0.74).translate(0, height * 0.6, 0),
    new BoxGeometry(0.012, 0.01, height * 0.74).translate(0, -height * 0.6, 0),
  ]);
  add(buckle.rotateY(buckleAngle - Math.PI / 2).translate(bx, eyes.y, bz), brass, 'goggle-buckle');

  const update = (frame: PartFrame) => {
    const glint = Math.max(0, Math.sin(frame.time * 0.6 + 0.8)) ** 20;
    glass.emissiveIntensity = 0.1 + shine * (0.12 + 1.1 * glint);
  };
  return { group, pivotY: eyes.y, update, dispose: () => disposeTree(group) };
}

/** Six screw heads round a rim, standing on its front face. */
function screws(x: number, y: number, z: number, rim: number): BufferGeometry {
  return merged(Array.from({ length: SCREWS }, (_, i) => {
    const a = (i / SCREWS) * Math.PI * 2 + Math.PI / 6;
    return new SphereGeometry(rim * 0.07, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(x + Math.cos(a) * rim, y + Math.sin(a) * rim, z);
  }));
}

/** Dark vent slits round the upper side of a cup. */
function vents(x: number, y: number, z: number, radius: number, depth: number): BufferGeometry {
  return merged(Array.from({ length: VENTS }, (_, i) => {
    const a = Math.PI * 0.15 + (Math.PI * 0.7 * i) / (VENTS - 1);
    return new BoxGeometry(radius * 0.09, 0.008, depth * 0.5).rotateZ(a - Math.PI / 2).translate(x + Math.cos(a) * radius * 1.06, y + Math.sin(a) * radius * 1.06, z);
  }));
}
