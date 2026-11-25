/**
 * Slot anchors: turns a species' slot placements (catalogue data) into anchor objects on
 * its rig, the `Skin.slots` the wardrobe reads.
 *
 * A FLOATING slot's anchor is an `Object3D` added directly under the skin's `root`, holding the
 * slot's rest placement as its LOCAL transform, plus the scale the worn part is drawn at. The
 * wardrobe reads that local transform (not the world one), so the halo, the ark and the aura
 * float steady while the body bobs and breathes, exactly as they always have.
 *
 * A WORN slot's anchor is added under the rig bone it names (`follow`: the body or the head), so
 * whatever the wardrobe parents to it (a cap, a jacket) turns, leans and breathes with the body,
 * and it carries the body's `shape` there for the part to fit itself to (`parts/fit.ts`).
 */
import { Object3D } from 'three';
import type { BodyShape } from '../parts/fit';
import { SLOT_IDS, type SlotId } from '../parts/slots';
import type { Bone, SlotPlacement } from './catalog';

export interface SlotAnchor {
  readonly object: Object3D;
  readonly scale: number;
  /** Present on worn slots: the part is parented to `object` and fitted to this shape. */
  readonly shape?: BodyShape;
}

export type SlotAnchors = Readonly<Partial<Record<SlotId, SlotAnchor>>>;

/**
 * Adds one anchor per declared slot and returns them by slot: floating ones under `root`, worn
 * ones under their `follow` bone from `bones` (a worn slot whose bone is missing is left out).
 */
export function addSlotAnchors(
  root: Object3D,
  placements: Readonly<Partial<Record<SlotId, SlotPlacement>>>,
  bones: Readonly<Partial<Record<Bone, Object3D>>> = {},
): SlotAnchors {
  const anchors: Partial<Record<SlotId, SlotAnchor>> = {};
  for (const slot of SLOT_IDS) {
    const placement = placements[slot];
    if (!placement) continue;
    const parent = placement.follow ? bones[placement.follow] : root;
    if (!parent) continue;
    const object = new Object3D();
    object.name = `slot-${slot}`;
    object.position.set(...placement.position);
    object.rotation.set(...placement.rotation);
    parent.add(object);
    anchors[slot] = { object, scale: placement.scale, shape: placement.follow ? placement.shape : undefined };
  }
  return anchors;
}
