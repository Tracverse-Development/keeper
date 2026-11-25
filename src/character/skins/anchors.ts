/**
 * Slot anchors: turns a species' slot placements (catalogue data) into anchor objects on
 * its rig, the `Skin.slots` the wardrobe reads.
 *
 * An anchor is an `Object3D` added directly under the skin's `root`, holding the slot's rest
 * placement as its LOCAL transform, plus the scale the worn part is drawn at. The wardrobe
 * reads that local transform (not the world one), so wearables float steady while the body
 * bobs and breathes, exactly as the halo and the ark always have.
 */
import { Object3D } from 'three';
import { SLOT_IDS, type SlotId } from '../parts/catalog';
import type { SlotPlacement } from './catalog';

export interface SlotAnchor {
  readonly object: Object3D;
  readonly scale: number;
}

export type SlotAnchors = Readonly<Partial<Record<SlotId, SlotAnchor>>>;

/** Adds one anchor per declared slot under `root` and returns them by slot. */
export function addSlotAnchors(root: Object3D, placements: Readonly<Partial<Record<SlotId, SlotPlacement>>>): SlotAnchors {
  const anchors: Partial<Record<SlotId, SlotAnchor>> = {};
  for (const slot of SLOT_IDS) {
    const placement = placements[slot];
    if (!placement) continue;
    const object = new Object3D();
    object.name = `slot-${slot}`;
    object.position.set(...placement.position);
    object.rotation.set(...placement.rotation);
    root.add(object);
    anchors[slot] = { object, scale: placement.scale };
  }
  return anchors;
}
