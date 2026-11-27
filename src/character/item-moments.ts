/**
 * Item moments: small idle gestures a keeper plays with what it WEARS. The owl nudges its
 * spectacles with a wing tip, the dog sniffs the brooch on its cord necklace, Malik checks his
 * watch. Each body keeps a table of moments (which worn parts call for it, how often, how long, how
 * soon it may come again); the skin runs one scheduler and poses the gesture from the envelope it
 * hands back, on top of everything else it draws.
 *
 * Rules (the same for every body):
 *   - only while FREE: idle, nothing playing (no emote, no touch), not working, not asleep;
 *   - never under reduced motion (`motion.amplitude` 0 turns every moment off);
 *   - a moment is offered when ANY part it names is worn (`parts`), so "spectacles or a monocle"
 *     is one row;
 *   - picks are weighted (`weight`), each moment rests for its own `cooldown` after it played, and
 *     between any two moments there is a random free gap (`ITEM_GAP`, scaled by `rate`);
 *   - a moment plays for `duration` seconds; its envelope eases in and out (0 at both ends), so a
 *     pose added with it never jumps.
 *
 * Pattern: a small scheduler with a weighted pick, like `idle-life.ts` (which picks the shared
 * habits); this one belongs to a skin, because only the skin knows how to move its own limbs.
 * Pure (no three.js; the random source is injectable): tested by `item-moments.test.ts`.
 *
 * Using it in a skin:
 *   const moments = createItemMoments(OWL_MOMENTS);
 *   wearing(parts) { moments.setWorn(parts); }
 *   apply(frame) { const m = moments.step(frame); if (m?.id === 'adjust-spectacles') wing.rotation.z += 1.2 * m.envelope; }
 */
import type { SkinFrame } from './skins/skin';

/** One row of a body's table. */
export interface ItemMoment {
  /** Stable id the skin switches on ('adjust-spectacles'). */
  readonly id: string;
  /** Worn part ids that call for it: the moment is offered when any of them is worn. */
  readonly parts: readonly string[];
  /** Share of the picks (relative to the other moments on offer). */
  readonly weight: number;
  /** Seconds it plays. */
  readonly duration: number;
  /** Seconds of rest after it played before it may be picked again. */
  readonly cooldown: number;
}

/** A moment playing now. */
export interface ActiveMoment {
  readonly id: string;
  /** 0 at the start .. 1 at the end. */
  readonly progress: number;
  /** 0..1, eased in and out (0 at both ends): multiply a pose by it. */
  readonly envelope: number;
  /** Seconds since it started (for wiggles inside the gesture). */
  readonly elapsed: number;
}

/** The free seconds between two moments (scaled by `rate`). */
export const ITEM_GAP = [16, 34] as const;
/** How idle the keeper must be (the idle mood's weight) for a moment to start. */
export const FREE_IDLE = 0.85;
/** Anything louder than this (an emote channel, a touch, work) means it is not free. */
const QUIET = 0.05;

/** The slice of a skin frame the scheduler reads (a whole `SkinFrame` fits). */
export type MomentFrame = Pick<SkinFrame, 'dt' | 'weights' | 'touch' | 'work' | 'motion' | 'emote'>;

/** True when the keeper is free for a moment: idle, nothing playing, not working or napping. */
export function isFree(frame: MomentFrame): boolean {
  if (frame.weights.idle < FREE_IDLE || frame.work > QUIET) return false;
  for (const level of Object.values(frame.touch)) if (level > QUIET) return false;
  const e = frame.emote;
  const busy = Math.abs(e.squash) + Math.abs(e.lift) + e.paw + e.hearts + e.stars + e.wink + e.wide + e.mouthO + e.hum + e.chase + e.scratch + e.nap + Math.abs(e.yaw);
  return busy <= QUIET;
}

/** The ease a moment's envelope follows: smooth up over the first quarter, down over the last. */
export function envelopeAt(progress: number): number {
  const p = Math.min(Math.max(progress, 0), 1);
  const edge = Math.min(p, 1 - p) / 0.25;
  const s = Math.min(edge, 1);
  return s * s * (3 - 2 * s);
}

export interface ItemMoments {
  /** The part ids worn now (call from `Skin.wearing`); a playing moment whose parts came off stops. */
  setWorn(parts: readonly string[]): void;
  /** Advances one frame; returns the moment playing (or null). */
  step(frame: MomentFrame): ActiveMoment | null;
  /** Starts `id` now if it is on offer (for previews and tests); false otherwise. */
  play(id: string): boolean;
}

export function createItemMoments(table: readonly ItemMoment[], random: () => number = Math.random, rate = 1): ItemMoments {
  const rest = new Map<string, number>();
  let worn = new Set<string>();
  let wait = gap();
  let playing: { row: ItemMoment; elapsed: number } | null = null;

  function gap(): number {
    return (ITEM_GAP[0] + random() * (ITEM_GAP[1] - ITEM_GAP[0])) / Math.max(rate, 0.05);
  }
  const offered = (row: ItemMoment) => row.weight > 0 && row.parts.some((p) => worn.has(p));

  function pick(): ItemMoment | null {
    const open = table.filter((row) => offered(row) && (rest.get(row.id) ?? 0) <= 0);
    const total = open.reduce((sum, row) => sum + row.weight, 0);
    if (total <= 0) return null;
    let roll = random() * total;
    for (const row of open) {
      roll -= row.weight;
      if (roll < 0) return row;
    }
    return open[open.length - 1];
  }

  return {
    setWorn(parts) {
      worn = new Set(parts);
      if (playing && !offered(playing.row)) playing = null;
    },
    play(id) {
      const row = table.find((r) => r.id === id);
      if (!row || !offered(row)) return false;
      playing = { row, elapsed: 0 };
      return true;
    },
    step(frame) {
      const dt = Math.max(frame.dt, 0);
      for (const [id, left] of rest) rest.set(id, left - dt);
      if (frame.motion.amplitude <= 0) {
        playing = null;
        return null;
      }
      if (playing) {
        playing.elapsed += dt;
        const progress = playing.elapsed / playing.row.duration;
        if (progress >= 1) {
          rest.set(playing.row.id, playing.row.cooldown);
          playing = null;
          wait = gap();
          return null;
        }
        return { id: playing.row.id, progress, envelope: envelopeAt(progress) * Math.min(frame.motion.amplitude, 1), elapsed: playing.elapsed };
      }
      if (!isFree(frame)) return null;
      wait -= dt;
      if (wait > 0) return null;
      const row = pick();
      wait = gap();
      if (!row) return null;
      playing = { row, elapsed: 0 };
      return { id: row.id, progress: 0, envelope: 0, elapsed: 0 };
    },
  };
}
