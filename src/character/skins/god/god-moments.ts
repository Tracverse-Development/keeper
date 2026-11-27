/**
 * The God Keeper's own item moments (`../../item-moments.ts`), on top of the people's (it is built on
 * the human rig and wears everything, so it checks a watch and lifts a lantern too):
 *
 *   crown-flare   with a halo worn: the crown of light swells and blazes for a breath
 *   smooth-robe   with a top or a gown worn: both hands sweep down the front, the head bowing a little
 *
 * `crownFlare` is read by the skin (it scales the crown and its light); the robe sweep is a pose.
 */
import type { ActiveMoment, ItemMoment } from '../../item-moments';
import type { HumanRig } from '../human/human-body';
import { HUMAN_MOMENTS } from '../human/human-moments.ts';

export const GOD_MOMENTS: readonly ItemMoment[] = [
  ...HUMAN_MOMENTS,
  { id: 'crown-flare', parts: ['memory-halo', 'emblem-halo', 'crown'], weight: 2, duration: 2.4, cooldown: 40 },
  { id: 'smooth-robe', parts: ['top', 'gown', 'ark-jacket', 'ranger-jacket'], weight: 1.5, duration: 2.6, cooldown: 55 },
];

/** How much brighter and bigger the crown gets at the top of a flare. */
export const FLARE = { light: 1.6, scale: 0.12 } as const;

/** 0..1: how far into a crown flare it is (0 when none plays). */
export function crownFlare(moment: ActiveMoment | null): number {
  return moment?.id === 'crown-flare' ? moment.envelope : 0;
}

/** The robe sweep: both arms forward and in, sweeping from the chest down as it plays. */
export function poseGodMoment(rig: HumanRig, moment: ActiveMoment | null): void {
  if (moment?.id !== 'smooth-robe') return;
  const k = moment.envelope;
  const sweep = 0.9 - 0.7 * moment.progress; // high at the start, low by the end
  rig.leftArm.rotation.x -= sweep * k;
  rig.leftArm.rotation.z -= 0.45 * k;
  rig.rightArm.rotation.x -= sweep * k;
  rig.rightArm.rotation.z += 0.45 * k;
  rig.head.rotation.x += 0.22 * k;
}
