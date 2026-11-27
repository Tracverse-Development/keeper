/**
 * The robot's item moments (`../../item-moments.ts`). It has no arms, so its gestures are the head's:
 *
 *   tap-visor   with a welder's visor on: two quick dips of the head, as if knocking the visor down
 *               to work, then a settle
 *   beat-bob    with head gear on (headphones): the head bobs to a beat and the body sways along,
 *               a little tune it can hear
 *
 * Added on top of the frame's own pose and scaled by the moment's envelope (it eases in and out).
 */
import type { Object3D } from 'three';
import type { ActiveMoment, ItemMoment } from '../../item-moments';

export const ROBOT_MOMENTS: readonly ItemMoment[] = [
  { id: 'tap-visor', parts: ['welder-visor'], weight: 2, duration: 1.6, cooldown: 45 },
  { id: 'beat-bob', parts: ['head-gear'], weight: 3, duration: 4.5, cooldown: 35 },
];

/** Beats per second the robot bobs to, and how far (radians). */
const BEAT = 2.1;
const BOB = 0.13;
const SWAY = 0.05;
/** The visor taps: two dips, each this deep (radians), in the first half of the moment. */
const TAP = 0.22;

export function poseRobotMoment(head: Object3D, body: Object3D, moment: ActiveMoment | null): void {
  if (!moment) return;
  const k = moment.envelope;
  if (moment.id === 'tap-visor') {
    const p = moment.progress;
    // Two sharp dips in the first 60%, then held still (the envelope eases it back).
    const tap = p < 0.6 ? Math.max(0, Math.sin((p / 0.6) * Math.PI * 2 * 2)) ** 3 : 0;
    head.rotation.x += (0.12 + TAP * tap) * k;
  } else if (moment.id === 'beat-bob') {
    const beat = Math.abs(Math.sin(moment.elapsed * BEAT * Math.PI));
    head.rotation.x += BOB * beat * k;
    head.rotation.z += 0.04 * Math.sin(moment.elapsed * BEAT * Math.PI * 0.5) * k;
    body.rotation.z += SWAY * Math.sin(moment.elapsed * BEAT * Math.PI * 0.5) * k;
  }
}
