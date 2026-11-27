/**
 * The Trail Pack (slot `back`, any species with a back): a rounded canvas backpack with a lid, a
 * front pocket with a gold zip and a grab loop, held on by two belts round the back and sides.
 *
 * Pattern: Adapter. Its size and place come from the body's published torso shape (`fit.ts`): it
 * hangs centred at half the shape's reach, as wide as the body there allows, and its front face
 * stands just behind the deepest point of the back it covers (outside a jacket too: EASE). The
 * two belts are arcs cut to the body at the pack's top and bottom, so it is held on a robot's
 * tapering spirit and a puppy's pear the same way, with no arms needed.
 *
 * Effects: `color` (the canvas), `trim` (the zip and the grab loop), `sway` (how much it bounces
 * as the body breathes; more with work), `style` (0 this rounded pack, as shipped; 1 a toolbox,
 * 2 saddlebags, 3 a book satchel, 4 thrusters: `pack-styles.ts`) and `glow` (the thrusters' flames).
 * Every style hangs in the same place on the same two belts.
 */
import { BoxGeometry, Group, Mesh, TorusGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { disposeTree } from '../../dispose-tree.ts';
import { clothMaterial, trimMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { garmentRings, radiusAt, surfaceDepth, type BodyShape, type PartFit } from '../fit.ts';
import { piping, ringPoints } from '../fitted-shell.ts';
import type { PartFrame, PartInstance } from '../part';
import { buildPackStyle, type PackMotion } from './pack-styles.ts';

const STYLES = 5;
/** How much bigger than the soft pack the gear styles (toolbox, saddlebags, satchel, thrusters) are cut. */
const STYLE_GROW = 1.45;

/** The pack stands this far off the back (a jacket fits under it); the belts this far off the body. */
const EASE = 0.085;
const BELT_EASE = 0.062;
const BELT = 0.016;
/** How far past the sides (radians) the belts wrap toward the front. */
const BELT_WRAP = 0.55;
/** Size against the body: width as a share of the body's half-width there, height share of the reach. */
const WIDTH_SHARE = 0.86;
const HEIGHT_SHARE = 0.5;
const DEPTH_SHARE = 0.44;
const BOUNCE = 0.022;

/** Where the pack sits and how big it is, for a torso shape (pure: the fit test reads it). */
export function packLayout(shape: BodyShape): { y: number; z: number; width: number; height: number; depth: number } {
  const y = shape.reach * 0.5;
  const height = Math.abs(shape.reach) * HEIGHT_SHARE;
  const width = Math.min(Math.max(radiusAt(shape, y) * WIDTH_SHARE, 0.28), 0.56);
  const depth = width * DEPTH_SHARE;
  let back = 0;
  for (let i = 0; i <= 16; i++) back = Math.max(back, surfaceDepth(shape, y + height * (i / 16 - 0.5)));
  return { y, z: -(back + EASE + depth / 2), width, height, depth };
}

export function createTrailPack(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'trail-pack';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };

  const canvas = clothMaterial(effectColour(effects, 'color'), 0.88);
  const lidCloth = clothMaterial(effectColour(effects, 'color'), 0.7);
  lidCloth.color.multiplyScalar(0.82);
  const trim = trimMaterial(effectColour(effects, 'trim'));
  const sway = effectNumber(effects, 'sway');
  const { y, z, width, height, depth } = packLayout(shape);

  const pack = new Group();
  pack.name = 'pack';
  pack.position.set(0, y + height / 2, z); // hung from its top, so a bounce swings it
  group.add(pack);
  const style = Math.min(Math.max(Math.round(effectNumber(effects, 'style')), 0), STYLES - 1);
  let motion: PackMotion | null = null;
  if (style === 0) {
    const body = new Mesh(new RoundedBoxGeometry(width, height, depth, 4, Math.min(0.07, depth * 0.45)), canvas);
    body.position.y = -height / 2;
    const lid = new Mesh(new RoundedBoxGeometry(width * 1.03, height * 0.26, depth * 1.08, 3, Math.min(0.05, depth * 0.3)), lidCloth);
    lid.position.y = -height * 0.1;
    const pocket = new Mesh(new RoundedBoxGeometry(width * 0.7, height * 0.4, depth * 0.36, 3, 0.035), lidCloth);
    pocket.position.set(0, -height * 0.66, -depth / 2 - depth * 0.12);
    const zip = new Mesh(new BoxGeometry(width * 0.6, 0.012, 0.012), trim);
    zip.position.set(0, -height * 0.48, -depth / 2 - depth * 0.31);
    const loop = new Mesh(new TorusGeometry(width * 0.12, 0.012, 8, 24, Math.PI), trim);
    loop.position.set(0, height * 0.03, 0);
    pack.add(body, lid, pocket, zip, loop);
    for (const part of [body, lid, pocket]) part.name = 'pack-body';
  } else {
    // The other shapes read as gear, so they are cut bigger than the soft pack, their face kept
    // the same ease off the back (the pack group moves out by the extra depth).
    pack.position.set(0, y + (height * STYLE_GROW) / 2, z - (depth * (STYLE_GROW - 1)) / 2);
    motion = buildPackStyle(style, pack, { width: width * STYLE_GROW, height: height * STYLE_GROW, depth: depth * STYLE_GROW }, { colour: effectColour(effects, 'color'), trim: effectColour(effects, 'trim'), trimMaterial: trim, glow: effectNumber(effects, 'glow') });
  }

  for (const beltY of [y + height * 0.32, y - height * 0.36]) {
    const [ring] = garmentRings(shape, beltY, beltY, BELT_EASE, 1);
    // Round the back and sides only, so the front (and a jacket's opening) stays clear.
    const belt = new Mesh(piping(ringPoints(ring, shape.squareness, Math.PI / 2 - BELT_WRAP, Math.PI * 1.5 + BELT_WRAP, 40), BELT), lidCloth);
    belt.name = 'pack-belt';
    group.add(belt);
  }

  function update(frame: PartFrame): void {
    const { amplitude, speed } = frame.motion;
    const bounce = BOUNCE * sway * amplitude * (1 + 0.8 * frame.work);
    // Swings back from its top (never toward the body): rotation about x lifts the bottom out.
    pack.rotation.x = bounce * (0.5 + 0.5 * Math.sin(frame.time * speed * 1.7));
    motion?.(frame.time, frame.work);
  }

  return { group, pivotY: y, update, dispose: () => disposeTree(group) };
}
