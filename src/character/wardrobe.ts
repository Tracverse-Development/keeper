/**
 * The wardrobe: the wearables the character has on (halo, base, aura), placed in the slots
 * the current species declares, swapped with an eased grow/shrink, and driven every frame.
 *
 * Pattern: Mediator between the species (which says WHERE each slot is: `Skin.slots`) and
 * the parts (which say WHAT is worn: `parts/`). Each slot is a holder group in the scene
 * that takes the species anchor's rest placement; a species swap glides the holders to the
 * new anchors, so a worn halo stays the same halo (its learned nodes too) across bodies.
 * Inside a holder, each worn part sits in a "presence" group the swap scales: the old part
 * shrinks out as the new one grows in (`skins/skin-transition.ts`, the same timeline as a
 * skin swap), then the old one is freed. The wear list is untrusted data: it is resolved
 * against the catalogue every time (`resolveWearables`: unknown parts and parts that do not
 * fit the species are skipped, effects clamped), and an unchanged list is a no-op.
 *
 * Memory sparks fly into the worn part that offers a `sparkTarget` (the Memory Halo); with
 * no such part worn, `pulse` shows nothing.
 */
import { Group, type Vector3 } from 'three';
import type { WornPart } from './contract';
import { DEFAULT_WEARABLES, SLOT_IDS, createPart, resolveWearables, type PartFrame, type PartInstance, type SlotId, type SparkTarget } from './parts';
import type { Skin } from './skins';
import { swapPose } from './skins/skin-transition';
import type { MemorySparks } from './stage/memory-spark';

/** How fast slot holders glide to a new species' anchors (1/s), and when they snap. */
const PLACE_RATE = 5;
const SETTLE_EPSILON = 1e-5;

interface Worn {
  readonly key: string;
  readonly instance: PartInstance;
  readonly presence: Group;
}

interface Slot {
  readonly id: SlotId;
  readonly holder: Group;
  current: Worn | null;
  outgoing: Worn | null;
  swapStartedAt: number;
  /** True while a grow/shrink is playing in this slot. */
  swapping: boolean;
  settled: boolean;
}

export class Wardrobe {
  readonly group = new Group();
  private readonly slots: Slot[];
  private readonly sparks: MemorySparks;
  private species: Skin;
  private worn: unknown;
  private pointScale = 0;
  private time = 0;

  /** Puts `worn` on `species` at once (no transition): the character's first frame. */
  constructor(sparks: MemorySparks, species: Skin, worn: unknown = DEFAULT_WEARABLES) {
    this.group.name = 'wardrobe';
    this.sparks = sparks;
    this.species = species;
    this.worn = worn;
    this.slots = SLOT_IDS.map((id) => {
      const holder = new Group();
      holder.name = `wear-${id}`;
      this.group.add(holder);
      return { id, holder, current: null, outgoing: null, swapStartedAt: 0, swapping: false, settled: false };
    });
    this.reconcile(true);
    for (const slot of this.slots) this.place(slot, 1);
  }

  /** Changes what is worn (eased); an equal list (by resolved content) changes nothing. */
  setWearables(worn: readonly WornPart[]): void {
    this.worn = worn;
    this.reconcile(false);
  }

  /** The body changed: glide to its anchors and drop parts it cannot wear. */
  setSpecies(species: Skin): void {
    this.species = species;
    for (const slot of this.slots) slot.settled = false;
    this.reconcile(false);
  }

  /** Sends a memory spark from `origin` into the worn halo; false when none is worn. */
  pulse(origin: Vector3): boolean {
    const target = this.sparkTarget();
    if (!target) return false;
    this.sparks.launch(origin, this.time, target);
    return true;
  }

  setPointScale(scale: number): void {
    this.pointScale = scale;
    this.sparks.setPointScale(scale);
    for (const slot of this.slots) {
      slot.current?.instance.setPointScale?.(scale);
      slot.outgoing?.instance.setPointScale?.(scale);
    }
  }

  /** Advances placements and swaps, then drives every worn part and the sparks. */
  update(frame: PartFrame): void {
    this.time = frame.time;
    const blend = 1 - Math.exp(-PLACE_RATE * frame.dt);
    for (const slot of this.slots) {
      if (!slot.settled) this.place(slot, blend);
      this.stepSwap(slot);
      slot.outgoing?.instance.update(frame);
      slot.current?.instance.update(frame);
    }
    this.sparks.update(frame.time, frame.mood.haloGlow);
  }

  dispose(): void {
    for (const slot of this.slots) {
      if (slot.outgoing) this.release(slot.outgoing);
      if (slot.current) this.release(slot.current);
      slot.outgoing = slot.current = null;
    }
    this.sparks.dispose();
    this.group.removeFromParent();
  }

  /** Brings every slot in line with the resolved wear list for the current species. */
  private reconcile(instant: boolean): void {
    const wanted = resolveWearables(this.worn, this.species.id);
    for (const slot of this.slots) {
      const next = this.species.slots[slot.id] ? wanted[slot.id] : undefined;
      if ((next?.key ?? null) === (slot.current?.key ?? null)) continue;
      if (slot.outgoing) this.release(slot.outgoing);
      slot.outgoing = instant ? null : slot.current;
      if (instant && slot.current) this.release(slot.current);
      slot.current = next ? this.wear(slot, next.key, createPart(next.id, next.effects)) : null;
      slot.swapStartedAt = this.time;
      slot.swapping = !instant;
      setPresence(slot.current, instant ? 1 : 0);
    }
  }

  private stepSwap(slot: Slot): void {
    if (!slot.swapping) return;
    const pose = swapPose(this.time - slot.swapStartedAt);
    setPresence(slot.outgoing, pose.outgoing);
    setPresence(slot.current, pose.done ? 1 : pose.incoming);
    if (!pose.done) return;
    if (slot.outgoing) this.release(slot.outgoing);
    slot.outgoing = null;
    slot.swapping = false;
  }

  /** Eases a slot holder toward its anchor (blend 1 = jump), snapping once close. */
  private place(slot: Slot, blend: number): void {
    const anchor = this.species.slots[slot.id];
    if (!anchor) {
      slot.settled = true;
      return;
    }
    const { holder } = slot;
    holder.position.lerp(anchor.object.position, blend);
    holder.quaternion.slerp(anchor.object.quaternion, blend);
    holder.scale.setScalar(holder.scale.x + (anchor.scale - holder.scale.x) * blend);
    const close =
      holder.position.distanceToSquared(anchor.object.position) < SETTLE_EPSILON &&
      Math.abs(holder.quaternion.angleTo(anchor.object.quaternion)) < SETTLE_EPSILON * 10 &&
      Math.abs(holder.scale.x - anchor.scale) < SETTLE_EPSILON;
    if (blend >= 1 || close) {
      holder.position.copy(anchor.object.position);
      holder.quaternion.copy(anchor.object.quaternion);
      holder.scale.setScalar(anchor.scale);
      slot.settled = true;
    }
  }

  private wear(slot: Slot, key: string, instance: PartInstance): Worn {
    const presence = new Group();
    presence.add(instance.group);
    slot.holder.add(presence);
    if (this.pointScale > 0) instance.setPointScale?.(this.pointScale);
    return { key, instance, presence };
  }

  private release(worn: Worn): void {
    if (worn.instance.sparkTarget) this.sparks.forget(worn.instance.sparkTarget);
    worn.instance.dispose();
    worn.presence.removeFromParent();
  }

  private sparkTarget(): SparkTarget | null {
    for (const slot of this.slots) if (slot.current?.instance.sparkTarget) return slot.current.instance.sparkTarget;
    return null;
  }
}

/**
 * Grow/shrink scale about the part's pivot (never exactly 0: three.js cannot invert a zero
 * matrix). At scale 1 the presence group is back at the identity transform.
 */
function setPresence(worn: Worn | null, scale: number): void {
  if (!worn) return;
  const s = Math.max(scale, 1e-4);
  worn.presence.scale.setScalar(s);
  worn.presence.position.y = scale >= 1 ? 0 : (worn.instance.pivotY ?? 0) * (1 - s);
  worn.presence.visible = scale > 0.002;
}
