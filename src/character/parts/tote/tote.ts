/**
 * The Tote (slot `held`, humans): something carried in the right hand that hangs straight down
 * whatever the arm does, like the Star Lantern.
 *
 * Pattern: Adapter. It is sized to the hand the body publishes (`fit.ts`: the held shape's radius),
 * so it sits in any hand that offers the slot. It rides the arm and turns against the hand's own
 * turn each frame, so it stays upright and only sways a little. Its broad side faces sideways
 * (along the body, not across it, turned a little toward the front so its face shows), as a bag
 * carried at your side does, so it never swings into the
 * hips.
 *
 * Styles (`style`, a whole number):
 *  0 woven basket tote: a deep basket in `color`, woven bands round it in a darker shade, a rim,
 *    and two leather handles in `trim` rising into the grip.
 *  1 a closed book: a hard cover in `color`, cream pages showing, a spine and corner caps in `trim`,
 *    held by its top edge.
 *
 * Effects: `color` (the weave or the cover), `trim` (handles, spine), `style`.
 */
import { BoxGeometry, Color, Group, Mesh, MeshPhysicalMaterial, Quaternion, TorusGeometry } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { clothMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { radiusAt, type PartFit } from '../fit.ts';
import type { PartFrame, PartInstance } from '../part';

/** The basket's width (along the body), depth (across it) and height, over the hand's radius. */
const BASKET = { width: 3.8, depth: 1.4, height: 3.0 } as const;
const BANDS = 5;
/** The book's height, width and thickness over the hand's radius. */
const BOOK = { height: 2.9, width: 2.2, thick: 0.55 } as const;
const PAGES = 0xf4ecd8;
/** How far it swings on the hand (radians at full motion). */
const SWING = 0.05;
/**
 * How far each piece is turned toward the front (radians about the vertical) so its face shows to
 * the camera: the basket only a little (it must stay clear of the hip), the thin book more.
 */
const TURN = { basket: 0.35, book: 0.9 } as const;

export function createTote(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'tote';
  if (!fit.shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };
  const hand = radiusAt(fit.shape, 0) || 0.1;
  const colour = effectColour(effects, 'color');
  const trimColour = effectColour(effects, 'trim');
  const style = Math.round(Math.min(Math.max(effectNumber(effects, 'style'), 0), 1));
  const leather = new MeshPhysicalMaterial({ color: trimColour, roughness: 0.5, clearcoat: 0.4 });

  const carried = new Group();
  group.add(carried);
  if (style === 0) basket(carried, hand, colour, leather);
  else book(carried, hand, colour, leather);

  const upright = new Quaternion();
  const turn = style === 0 ? TURN.basket : TURN.book;
  return {
    group,
    pivotY: 0,
    update(frame: PartFrame) {
      group.getWorldQuaternion(upright).invert();
      carried.quaternion.copy(upright);
      carried.rotateY(turn);
      carried.rotateX(Math.sin(frame.time * 1.1) * SWING * frame.motion.amplitude);
    },
    dispose: () => disposeTree(group),
  };
}

/** The woven basket and its two handles, hanging below the grip (the grip is the origin). */
function basket(holder: Group, hand: number, colour: number, leather: MeshPhysicalMaterial): void {
  const w = hand * BASKET.width;
  const d = hand * BASKET.depth;
  const h = hand * BASKET.height;
  const top = -hand * 1.5;
  const weave = clothMaterial(colour, 0.9);
  const dark = clothMaterial(new Color(colour).multiplyScalar(0.72).getHex(), 0.9);
  const body = new Mesh(new BoxGeometry(d, h, w, 1, 4, 4), weave);
  body.position.y = top - h / 2;
  holder.add(body);
  for (let i = 0; i < BANDS; i++) {
    const band = new Mesh(new BoxGeometry(d * 1.04, h * 0.07, w * 1.02), dark);
    band.position.y = top - h * (0.14 + (i * 0.76) / (BANDS - 1));
    holder.add(band);
  }
  const rim = new Mesh(new BoxGeometry(d * 1.1, h * 0.06, w * 1.06), leather);
  rim.position.y = top;
  holder.add(rim);
  // Two handles, one each side of the opening, both rising into the hand.
  for (const side of [-1, 1]) {
    const handle = new Mesh(new TorusGeometry(w * 0.3, hand * 0.09, 8, 28, Math.PI), leather);
    handle.position.set(side * d * 0.32, top, 0);
    handle.scale.y = (-top + hand * 0.2) / (w * 0.3);
    handle.rotation.y = Math.PI / 2;
    holder.add(handle);
  }
}

/** A closed book held by its top edge in the hand. */
function book(holder: Group, hand: number, colour: number, trim: MeshPhysicalMaterial): void {
  const h = hand * BOOK.height;
  const w = hand * BOOK.width;
  const t = hand * BOOK.thick;
  const centre = -h / 2 + hand * 0.45;
  const cover = new MeshPhysicalMaterial({ color: colour, roughness: 0.55, clearcoat: 0.3 });
  const pages = new Mesh(new BoxGeometry(t * 0.82, h * 0.95, w * 0.96), new MeshPhysicalMaterial({ color: PAGES, roughness: 0.9 }));
  pages.position.set(0, centre, w * 0.02);
  holder.add(pages);
  for (const side of [-1, 1]) {
    const board = new Mesh(new BoxGeometry(t * 0.12, h, w), cover);
    board.position.set(side * t * 0.47, centre, 0);
    holder.add(board);
  }
  const spine = new Mesh(new BoxGeometry(t * 1.04, h * 1.01, t * 0.18), trim);
  spine.position.set(0, centre, -w / 2);
  holder.add(spine);
  for (const y of [centre + h * 0.42, centre - h * 0.42]) {
    const band = new Mesh(new BoxGeometry(t * 1.06, h * 0.03, t * 0.2), trim);
    band.position.set(0, y, -w / 2);
    holder.add(band);
  }
}
