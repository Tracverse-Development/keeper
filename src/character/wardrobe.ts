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
 * Slots worn ON the body (head, neck, torso, back) work differently: their part is built FOR
 * the species (fitted to the shape its anchor publishes: `parts/fit.ts`) and parented to that
 * anchor on the rig, so a cap turns with the head and a jacket leans with the body. Its key
 * includes the species, so a species swap re-tailors it: the old jacket shrinks away on the old
 * body while a new one, cut to the new body, grows in on it. A slot the species lacks is empty.
 *
 * Memory sparks fly into the worn part that offers a `sparkTarget` (the Memory Halo); with
 * no such part worn, `pulse` shows nothing.
 *
 * Effect slots (`thinking`, `celebrate`) draw nothing here: the wardrobe only resolves which
 * moment effect is worn (`moment`) for the emote director to play. Parts worn on feet (the
 * paws slot) get the live foot joints of the anchor, so they follow a paw that waves; parts on a
 * shape with moving limbs (a torso with arms) get the live limb joints, so sleeves follow the arms.
 *
 * Every drawn part is decorated for its rarity (`parts/rarity-flourish.ts`: grander from common to
 * mythical) and, on a body whose race wears everything (the God Keeper), in the divine finish
 * (`parts/divine-finish.ts`), and three pieces of one set glow together (`parts/set-glow.ts`). All
 * three are part of the key, so a new tier, a new body or a set completed redraws them.
 */
import { Group, type Vector3 } from 'three';
import type { WornPart } from './contract';
import {
  DEFAULT_WEARABLES,
  SLOT_IDS,
  createPart,
  isEffectSlot,
  resolveWearables,
  type DrawnPartId,
  type PartFrame,
  type PartInstance,
  type ResolvedWear,
  type SlotId,
  type SparkTarget,
} from './parts';
import type { Skin } from './skins';
import type { SlotAnchor } from './skins/anchors';
import { slotsOf, type SkinId } from './skins/catalog';
import { raceOf, WEARS_EVERYTHING } from './skins/races';
import { createFlourish } from './parts/rarity-flourish';
import { applyDivineFinish } from './parts/divine-finish';
import { createSetGlow } from './parts/set-glow';
import { isWornSlot } from './parts/slots';
import { swapPose } from './skins/skin-transition';
import type { RarityId } from './parts/rarity';
import type { MemorySparks } from './stage/memory-spark';

/** How fast slot holders glide to a new species' anchors (1/s), and when they snap. */
const PLACE_RATE = 5;
const SETTLE_EPSILON = 1e-5;

interface Worn {
  readonly key: string;
  readonly instance: PartInstance;
  readonly presence: Group;
  /** What wraps the part: its rarity flourish and, on the God Keeper, the divine finish. */
  readonly decorations: readonly Decoration[];
}

/** A decorator drawn beside a worn part (`parts/rarity-flourish.ts`, `parts/divine-finish.ts`). */
interface Decoration {
  readonly group: Group;
  update(frame: PartFrame): void;
  setPointScale(scale: number): void;
  dispose(): void;
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
  private moments: Partial<Record<SlotId, ResolvedWear>> = {};
  private pointScale = 0;
  private time = 0;

  /** Puts `worn` on `species` at once (no transition): the character's first frame. */
  constructor(sparks: MemorySparks, species: Skin, worn: unknown = DEFAULT_WEARABLES) {
    this.group.name = 'wardrobe';
    this.sparks = sparks;
    this.species = species;
    this.worn = worn;
    this.slots = SLOT_IDS.filter((id) => !isEffectSlot(id)).map((id) => {
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

  /** The moment effect worn in effect slot `slot` (`thinking`, `celebrate`), if the body offers it. */
  moment(slot: 'thinking' | 'celebrate'): ResolvedWear | undefined {
    return this.moments[slot];
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
      for (const worn of [slot.current, slot.outgoing]) {
        worn?.instance.setPointScale?.(scale);
        worn?.decorations.forEach((d) => d.setPointScale(scale));
      }
    }
  }

  /** Advances placements and swaps, then drives every worn part and the sparks. */
  update(frame: PartFrame): void {
    this.time = frame.time;
    const blend = 1 - Math.exp(-PLACE_RATE * frame.dt);
    for (const slot of this.slots) {
      if (!slot.settled) this.place(slot, blend);
      this.stepSwap(slot);
      for (const worn of [slot.outgoing, slot.current]) {
        if (!worn) continue;
        worn.instance.update(frame);
        for (const d of worn.decorations) d.update(frame);
      }
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
    const species = this.species;
    const wanted = resolveWearables(this.worn, species.id);
    const divine = raceOf(species.id) === WEARS_EVERYTHING;
    const offered = new Set(Object.keys(slotsOf(species.id as SkinId)));
    this.moments = {};
    for (const slot of SLOT_IDS) if (isEffectSlot(slot) && offered.has(slot) && wanted[slot]) this.moments[slot] = wanted[slot];
    for (const slot of this.slots) {
      const anchor = species.slots[slot.id];
      const next = anchor ? wanted[slot.id] : undefined;
      // A fitted part is cut for one body: another species needs a new one.
      const key = next && (anchor?.shape ? `${next.key}|${species.id}` : `${next.key}${divine ? '|divine' : ''}`);
      if ((key ?? null) === (slot.current?.key ?? null)) continue;
      if (slot.outgoing) this.release(slot.outgoing);
      slot.outgoing = instant ? null : slot.current;
      if (instant && slot.current) this.release(slot.current);
      const follow = anchor?.feet || anchor?.limbs ? { base: anchor.object, feet: anchor.feet ?? [], limbs: anchor.limbs, elbows: anchor.elbows } : undefined;
      slot.current =
        next && anchor && key ? this.wear(slot, anchor, key, createPart(next.id as DrawnPartId, next.effects, { species: species.id, shape: anchor.shape, follow }), next.rarity, divine, next.set !== null) : null;
      slot.swapStartedAt = this.time;
      slot.swapping = !instant;
      setPresence(slot.current, instant ? 1 : 0);
    }
    species.covered?.(Object.keys(wanted));
    species.wearing?.(Object.values(wanted).map((w) => w.id));
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
    if (!anchor || anchor.shape) {
      // No such slot, or one worn on the body (its part rides the anchor itself).
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

  /**
   * Puts `instance` on: on the anchor itself for a worn slot, in the gliding holder otherwise, with
   * its rarity flourish (measured from the part before it is placed) and, on a divine body, the
   * divine finish, and the set glow while three pieces of its set are worn (`parts/set-glow.ts`).
   * Parts floating round the whole body get the light flourish (no rings or rays).
   */
  private wear(slot: Slot, anchor: SlotAnchor, key: string, instance: PartInstance, rarity: RarityId, divine: boolean, setGlow: boolean): Worn {
    const presence = new Group();
    const decorations: Decoration[] = [];
    const flourish = createFlourish(instance.group, rarity, !isWornSlot(slot.id), Math.random, divine);
    if (flourish) decorations.push(flourish);
    if (divine) decorations.push(applyDivineFinish(instance.group));
    if (setGlow) decorations.push(createSetGlow(instance.group, divine ? 0 : undefined));
    presence.add(instance.group, ...decorations.map((d) => d.group));
    (anchor.shape ? anchor.object : slot.holder).add(presence);
    if (this.pointScale > 0) {
      instance.setPointScale?.(this.pointScale);
      decorations.forEach((d) => d.setPointScale(this.pointScale));
    }
    return { key, instance, presence, decorations };
  }

  private release(worn: Worn): void {
    if (worn.instance.sparkTarget) this.sparks.forget(worn.instance.sparkTarget);
    worn.instance.dispose();
    worn.decorations.forEach((d) => d.dispose());
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
