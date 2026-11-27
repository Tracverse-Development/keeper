/**
 * The Cape (slot `back`, any species with a back): something worn from the shoulders. One kit,
 * three shapes, picked by `style`:
 *   0 cloak          - a long cloak cut to the back and sides, falling past the body and flaring at
 *                      the hem, its lining glowing softly (`trim` + `glow`), held by a gold clasp
 *   1 carnival wings - huge feathered wings in two colours, fanned wide from the shoulder blades,
 *                      swaying with the music (`feathers.ts`)
 *   2 wings of light - three pairs of luminous feathered wings, slowly beating, made of light: the
 *                      God Keeper's own (`feathers.ts`)
 *
 * Pattern: Adapter (like the jacket and the pack): it reads the torso's published shape (`fit.ts`)
 * and builds itself to it. The cloak follows the body's own rings with ease all round the back half
 * (the arms and the front stay clear) and keeps falling below the shape's reach; the wings root just
 * behind the deepest point of the upper back. Effects: `color` (outside / feathers), `trim` (lining /
 * second feather colour), `glow`, `sway` (how much it moves), `style`.
 */
import { Color, Group, Mesh, SphereGeometry, type BufferAttribute } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { clothMaterial, trimMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { garmentRings, radiusAt, surfaceDepth, widestBetween, type BodyShape, type GarmentRing, type PartFit } from '../fit.ts';
import { edgePoints, fittedShell, piping, ringPoints } from '../fitted-shell.ts';
import { lightMaterial } from '../glow-kit.ts';
import type { PartFrame, PartInstance } from '../part';
import { buildWings, type Wings } from './feathers.ts';

/** The lining stands this far off the body, the outside this far (a jacket fits under both). */
const LINING_EASE = 0.06;
const OUTER_EASE = 0.074;
/** The cloak wraps the back and sides only: this gap (radians, total) is left open at the front. */
const OPENING = Math.PI * 1.22;
/** Below the shape's reach the cloak falls this share of the body's height again, flaring out. */
const FALL = 1.15;
const FLARE = 0.16;
const RINGS = 26;
/** The mantle covers this share of the torso, this far off it, open this much at the front. */
const MANTLE = 0.32;
const MANTLE_EASE = 0.09;
const MANTLE_OPENING = 0.9;
const SEGMENTS = 48;
/** Hem swing at full sway (world units). */
const SWING = 0.05;
const STYLES = 3;

export function createCape(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'cape';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };
  const style = Math.min(Math.max(Math.round(effectNumber(effects, 'style')), 0), STYLES - 1);
  const colour = effectColour(effects, 'color');
  const trim = effectColour(effects, 'trim');
  const glow = effectNumber(effects, 'glow');
  const sway = effectNumber(effects, 'sway');
  if (style > 0) return wingsPart(group, shape, colour, trim, glow, sway, style === 2);
  return cloakPart(group, shape, colour, trim, glow, sway);
}

/** The cloak's rings: the body's own from the shoulders down, then on past the reach, flaring. */
function cloakRings(shape: BodyShape, ease: number): GarmentRing[] {
  const top = shape.profile[0][1] - 0.02;
  const body = garmentRings(shape, top, shape.reach, ease, RINGS);
  const widest = widestBetween(shape, top, shape.reach);
  const last = body[body.length - 1];
  const length = Math.abs(shape.reach - top) * FALL;
  const below: GarmentRing[] = Array.from({ length: 10 }, (_, i) => {
    const t = (i + 1) / 10;
    const y = shape.reach - length * t;
    // Below the reach the body may go on (hips, a skirt): never closer to it than the ease.
    const r = radiusAt(shape, y);
    const rx = Math.max(last.rx, widest * 0.9 + ease, r + ease) + FLARE * t;
    return { y, rx, rz: Math.max(rx * shape.depth, r * shape.depth + ease) };
  });
  // The shoulders: never narrower than most of the widest point, so it drapes over them.
  return [...body.map((r) => ({ ...r, rx: Math.max(r.rx, widest * 0.55 + ease), rz: Math.max(r.rz, (widest * 0.55) * shape.depth + ease) })), ...below];
}

function cloakPart(group: Group, shape: BodyShape, colour: number, trim: number, glow: number, sway: number): PartInstance {
  const outside = clothMaterial(colour, 0.7);
  // The lining is seen inside the cloak from the front: the outside's colour touched with `trim`, lit by `glow`.
  const lining = clothMaterial(new Color(colour).lerp(new Color(trim), 0.12).getHex(), 0.5);
  lining.sheenColor.copy(lining.color).multiplyScalar(1.6);
  lining.emissive.set(trim);
  lining.emissiveIntensity = 0.06 * glow;
  const outer = fittedShell(cloakRings(shape, OUTER_EASE), { segments: SEGMENTS, opening: OPENING, squareness: shape.squareness });
  const inner = fittedShell(cloakRings(shape, LINING_EASE), { segments: SEGMENTS, opening: OPENING, squareness: shape.squareness });
  const outerMesh = new Mesh(outer, outside);
  const innerMesh = new Mesh(inner, lining);
  outerMesh.name = 'cloak';
  innerMesh.name = 'cloak-lining';
  // The mantle: a short shoulder cape in the outside colour, closed further round the front, so the
  // cloak reads from the front as well as from behind.
  const crownY = shape.profile[0][1] - 0.02;
  const mantleRings = garmentRings(shape, crownY, crownY + (shape.reach - crownY) * MANTLE, MANTLE_EASE, 10).map((r, i) => {
    const flare = 0.03 * (i / 9) ** 2;
    return { y: r.y, rx: r.rx + flare, rz: r.rz + flare };
  });
  const mantle = new Mesh(fittedShell(mantleRings, { segments: SEGMENTS, opening: MANTLE_OPENING, squareness: shape.squareness }), outside);
  mantle.name = 'cloak-mantle';
  group.add(innerMesh, outerMesh, mantle);
  // A glowing edge in the lining's colour down both fronts and along the hem frames it from the front.
  const rings = cloakRings(shape, OUTER_EASE + 0.004);
  const edge = lightMaterial(trim, 1.3, 0.6);
  const right = OPENING / 2;
  const left = Math.PI * 2 - OPENING / 2;
  for (const points of [edgePoints(rings, shape.squareness, right), edgePoints(rings, shape.squareness, left), ringPoints(rings[rings.length - 1], shape.squareness, right, left, 48)]) {
    group.add(Object.assign(new Mesh(piping(points, 0.008), edge), { name: 'cloak-edge' }));
  }
  // The clasp: two gold discs where the cloak's edges meet the shoulders.
  const top = cloakRings(shape, OUTER_EASE)[1];
  const gold = trimMaterial(0xd39744);
  for (const side of [-1, 1]) {
    const angle = side > 0 ? OPENING / 2 : Math.PI * 2 - OPENING / 2;
    const disc = new Mesh(new SphereGeometry(0.045, 16, 10), gold);
    disc.scale.z = 0.5;
    // Outside the cloth by its own radius, so it never presses into the shoulder.
    disc.position.set(Math.sin(angle) * (top.rx + 0.06), top.y, Math.cos(angle) * (top.rz + 0.06));
    disc.name = 'cloak-clasp';
    group.add(disc);
  }
  const moving = [outer, inner].map((g) => ({ positions: g.getAttribute('position') as BufferAttribute, rest: Float32Array.from(g.getAttribute('position').array as Float32Array) }));
  const crown = shape.profile[0][1];
  const hem = shape.reach - Math.abs(shape.reach - crown) * FALL;

  function update(frame: PartFrame): void {
    const t = frame.time * frame.motion.speed;
    const reach = SWING * sway * frame.motion.amplitude * (1 + 0.8 * frame.work);
    lining.emissiveIntensity = 0.06 * glow * (1 + frame.work + frame.gotIt);
    edge.opacity = Math.min(1, 0.4 + 0.3 * glow * (1 + frame.work));
    if (reach <= 0) return;
    for (const { positions, rest } of moving) {
      const array = positions.array as Float32Array;
      for (let k = 0; k < array.length; k += 3) {
        const x = rest[k], y = rest[k + 1], z = rest[k + 2];
        const hang = Math.max(0, (crown - y) / (crown - hem)) ** 2;
        // Billows outward only (never into the body), more at the hem, in slow waves round it.
        const push = 1 + (reach * hang * (0.55 + 0.45 * Math.sin(t * 1.2 + y * 3 + Math.atan2(x, z) * 1.5))) / Math.max(Math.hypot(x, z), 0.1);
        array[k] = x * push;
        array[k + 2] = z * push;
      }
      positions.needsUpdate = true;
    }
  }
  return { group, update, dispose: () => disposeTree(group) };
}

function wingsPart(group: Group, shape: BodyShape, colour: number, trim: number, glow: number, sway: number, light: boolean): PartInstance {
  const rootY = shape.profile[0][1] + (shape.reach - shape.profile[0][1]) * 0.28;
  let back = 0;
  for (let i = 0; i <= 8; i++) back = Math.max(back, surfaceDepth(shape, rootY + (shape.reach - rootY) * (i / 16)));
  const wings: Wings = buildWings({ colour, trim, glow, light, scale: Math.min(Math.max(widestBetween(shape, rootY, shape.reach) * 2.4, 1.0), 1.5) });
  wings.group.position.set(0, rootY, -(back + 0.09));
  group.add(wings.group);
  function update(frame: PartFrame): void {
    wings.update(frame.time * frame.motion.speed, sway * frame.motion.amplitude, glow * (0.5 + 0.5 * frame.mood.presence) * (1 + frame.work + frame.gotIt));
  }
  return { group, pivotY: rootY, update, dispose: () => disposeTree(group) };
}
