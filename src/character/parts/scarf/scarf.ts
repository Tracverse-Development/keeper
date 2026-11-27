/**
 * The Knit Scarf (slot `neck`, any species with a neck): a chunky striped knit wrapped once round
 * the neck, its two ends hanging down the chest and swinging.
 *
 * Pattern: Adapter. The wrap is sized from the neck's published shape (`fit.ts`): it clears the
 * collar (and a jacket's collar, COLLAR_ROOM) at the neck's top ring, is as deep as the neck is,
 * and leans with the neck opening (the puppy's collar tips forward). The ends hang from the front
 * of the wrap, one a little longer, laid along the chest: each end's slope and stand-off are
 * worked out from the chest's own depth below the neck, so it lies on a robot's wide shoulders and
 * a puppy's narrow chest alike, never inside either. Stripes run across the knit (vertex colours);
 * the knit's ridges are a small bump in the tube.
 *
 * Effects: `color` (the wool), `stripe` (the stripes), `sway` (how far the ends swing; they only
 * ever swing out from the chest, never into it). The ends also swing and settle with the body's motion
 * and the Studio's turn (`sway/sway-bone.ts`).
 */
import { BoxGeometry, BufferAttribute, Color, Group, Mesh, TorusGeometry, type BufferGeometry } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { clothMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { radiusAt, surfaceDepth, widestBetween, type BodyShape, type PartFit } from '../fit.ts';
import { addSwayBone } from '../../sway/sway-bone.ts';
import type { PartFrame, PartInstance } from '../part';

/** Room left under the wrap for a jacket's collar, and the knit's thickness as a share of the neck. */
const COLLAR_ROOM = 0.05;
const TUBE_SHARE = 0.17;
const STRIPES = 14;
/** The two ends: across from the centre (share of the neck), length (share), width, thickness. */
const ENDS = [
  { across: 0.34, length: 1.05, swing: 1 },
  { across: 0.62, length: 0.85, swing: -0.8 },
] as const;
const END_WIDTH = 0.36;
const END_THICK = 0.045;
const END_CLEAR = 0.07;
const SWING = 0.07;

export function createKnitScarf(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'knit-scarf';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };

  const wool = clothMaterial(0xffffff, 0.86);
  wool.vertexColors = true;
  const colours = [new Color(effectColour(effects, 'color')), new Color(effectColour(effects, 'stripe'))];
  const sway = effectNumber(effects, 'sway');

  // The wrap is round: it must clear the widest the neck gets across its own thickness, and on a
  // boxy neck (squareness above 2) the corners, which reach 2^(1/2 - 1/n) further than a circle's.
  const tube = TUBE_SHARE * radiusAt(shape, 0);
  const neck = widestBetween(shape, tube * 1.1, -tube * 1.1) * 2 ** (0.5 - 1 / shape.squareness);
  const radius = neck + COLLAR_ROOM + tube;
  const lean = shape.lean ?? 0;
  const wrapGeometry = knitWrap(radius, tube, colours);
  const wrap = new Mesh(wrapGeometry, wool);
  wrap.name = 'scarf-wrap';
  wrap.scale.z = (neck * shape.depth + COLLAR_ROOM + tube) / radius;
  wrap.rotation.x = lean;
  group.add(wrap);

  const ends = ENDS.map((spec) => {
    const pivot = new Group();
    pivot.name = 'scarf-end';
    const x = spec.across * radius;
    const front = Math.sqrt(Math.max(radius ** 2 - x ** 2, 0)) * wrap.scale.z;
    const topY = -Math.sin(lean) * front - tube * 0.6;
    const length = spec.length * neck * 1.6;
    // Laid against the chest at the end's inner edge, where the chest stands out furthest.
    const lay = layOnChest(shape, Math.max(x - (END_WIDTH * neck) / 2, 0), topY, length, tube);
    pivot.position.set(x, topY, lay.z);
    pivot.rotation.x = lay.slope;
    const end = new Mesh(knitEnd(END_WIDTH * neck, length, END_THICK, colours), wool);
    end.position.y = -length / 2;
    pivot.add(end);
    group.add(pivot);
    // The end also swings with the body's motion (`sway/sway-bone.ts`), out from the chest, never into it.
    const bone = addSwayBone(pivot, { tip: [0, -length, 0], frequency: 1.9, damping: 0.3, maxAngle: 0.45 * Math.min(sway, 1.5), keepOut: { direction: [0, 0, -1], room: 0.01 } });
    return { pivot, bone, rest: lay.slope, swing: spec.swing };
  });

  function update(frame: PartFrame): void {
    const { amplitude, speed } = frame.motion;
    const t = frame.time * speed;
    const reach = SWING * sway * amplitude * (1 + 0.6 * frame.work);
    for (const end of ends) {
      // Swinging out (negative x rotation lifts the end away from the chest) and a little sideways.
      end.pivot.rotation.x = end.rest - reach * (0.5 + 0.5 * Math.sin(t * 1.3 + end.swing));
      end.pivot.rotation.z = reach * 0.6 * Math.sin(t * 0.9 + end.swing * 2);
      end.bone.update(frame.dt, amplitude);
    }
  }

  return { group, update, dispose: () => disposeTree(group) };
}

/**
 * Lays an end of `length` hanging from (x, topY) on the chest: the slope that follows the chest
 * from top to bottom, pushed out far enough that its middle clears a chest that bulges.
 */
export function layOnChest(shape: BodyShape, x: number, topY: number, length: number, tube: number): { z: number; slope: number } {
  const chestAt = (y: number): number => {
    const r = radiusAt(shape, y);
    const across = Math.min(Math.abs(x) / Math.max(r, 1e-6), 1);
    return surfaceDepth(shape, y) * (1 - across ** shape.squareness) ** (1 / shape.squareness);
  };
  const clear = END_THICK / 2 + END_CLEAR;
  const zTop = Math.max(chestAt(topY), 0) + clear + tube * 0.3;
  const zBottom = Math.max(chestAt(topY - length), 0) + clear;
  let push = 0;
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    push = Math.max(push, chestAt(topY - length * u) + clear - (zTop + (zBottom - zTop) * u));
  }
  const reach = zBottom - zTop;
  return { z: zTop + push, slope: -Math.asin(Math.max(-1, Math.min(1, reach / length))) };
}

/** The wrap: a torus with knit ridges, striped across. */
function knitWrap(radius: number, tube: number, colours: Color[]): BufferGeometry {
  const geometry = new TorusGeometry(radius, tube, 18, 96);
  geometry.rotateX(Math.PI / 2);
  const position = geometry.getAttribute('position');
  const colour = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const around = Math.atan2(x, z);
    const ridge = 1 + 0.035 * Math.sin(around * 48);
    const cx = (x / Math.hypot(x, z)) * radius;
    const cz = (z / Math.hypot(x, z)) * radius;
    position.setX(i, cx + (x - cx) * ridge);
    position.setZ(i, cz + (z - cz) * ridge);
    position.setY(i, position.getY(i) * ridge);
    const stripe = Math.floor(((around + Math.PI) / (Math.PI * 2)) * STRIPES * 2) % 2;
    colour.set(colours[stripe].toArray(), i * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colour, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** One hanging end: a soft slab striped across, with a darker fringe band at the bottom. */
function knitEnd(width: number, length: number, thick: number, colours: Color[]): BufferGeometry {
  const geometry = new BoxGeometry(width, length, thick, 2, 16, 1);
  const position = geometry.getAttribute('position');
  const colour = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const u = 0.5 - position.getY(i) / length; // 0 at the top, 1 at the bottom
    const stripe = u > 0.62 && u < 0.86 && Math.floor(u * 18) % 2 === 0 ? 1 : 0;
    colour.set(colours[stripe].toArray(), i * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colour, 3));
  return geometry;
}
