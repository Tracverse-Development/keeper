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
 * and it carries the body's `shape` there for the part to fit itself to (`parts/fit.ts`). A shape
 * with feet (the paws slot) also gets one joint per foot under that foot's own bone (a paw that
 * waves or scratches), placed where the foot rests, so a worn part can follow every foot.
 *
 * Effect slots (`thinking`, `celebrate`) get no anchor: nothing is drawn on the body for them.
 */
import { Object3D, Quaternion, Vector3 } from 'three';
import type { BodyShape } from '../parts/fit';
import { SLOT_IDS, isEffectSlot, type SlotId } from '../parts/slots';
import type { Bone, SlotPlacement } from './catalog';

export interface SlotAnchor {
  readonly object: Object3D;
  readonly scale: number;
  /** Present on worn slots: the part is parented to `object` and fitted to this shape. */
  readonly shape?: BodyShape;
  /** One joint per foot of the shape (`shape.feet`), riding that foot's bone, at the foot's rest place. */
  readonly feet?: readonly Object3D[];
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
    if (!placement || isEffectSlot(slot)) continue;
    const parent = placement.follow ? bones[placement.follow] : root;
    if (!parent) continue;
    const object = new Object3D();
    object.name = `slot-${slot}`;
    object.position.set(...placement.position);
    object.rotation.set(...placement.rotation);
    parent.add(object);
    const shape = placement.follow ? placement.shape : undefined;
    const feet = shape?.feet ? addFootJoints(root, object, shape, bones) : undefined;
    anchors[slot] = { object, scale: placement.scale, shape, feet };
  }
  return anchors;
}

/** One joint per foot, under the foot's bone (else the slot's), at the foot's rest place and turn. */
function addFootJoints(root: Object3D, anchor: Object3D, shape: BodyShape, bones: Readonly<Partial<Record<Bone, Object3D>>>): Object3D[] {
  root.updateMatrixWorld(true);
  const world = new Vector3();
  const turn = new Quaternion();
  const parentTurn = new Quaternion();
  return (shape.feet ?? []).map((foot, i) => {
    const parent = (foot.bone && bones[foot.bone as Bone]) || anchor;
    const joint = new Object3D();
    joint.name = `foot-${i}`;
    anchor.localToWorld(world.set(...foot.position));
    parent.worldToLocal(joint.position.copy(world));
    anchor.getWorldQuaternion(turn);
    parent.getWorldQuaternion(parentTurn);
    joint.quaternion.copy(parentTurn.invert().multiply(turn));
    parent.add(joint);
    return joint;
  });
}
