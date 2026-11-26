/**
 * The Memory Halo part (slot `halo`, any species): the knowledge-graph orbit
 * (`halo-graph.ts`) worn around the head and upper body. It is the part that RECEIVES memory
 * sparks (`sparkTarget`): with no halo worn, a memory write shows no spark.
 *
 * Effects: `color` re-tints nodes, edges and rings; `spinIdle` scales the mood's orbit speed;
 * `spinWork` is the extra orbit speed (rad/s) at full work; `nodes` is how many nodes the
 * graph starts with. Work also brightens the nodes and makes the edges flicker. Thinking spins
 * it up hard (scaled by `spinWork`), lights travelling waves and streams sparks into the head;
 * the "got it" beat pulses it outward and flashes it.
 */
import { thinkDrama } from '../../thinking';
import { effectColour, effectNumber, type EffectValues } from '../effects';
import type { PartFrame, PartInstance } from '../part';
import { Vector3 } from 'three';
import { createHaloGraph } from './halo-graph';

/** How much brighter the nodes get at full work, and the voice/swell shares (as shipped). */
const WORK_GLOW = 0.6;
const VOICE_GLOW = 0.7;
const VOICE_SWELL = 0.14;
/** Thinking: extra orbit speed per unit of `spinWork` at full drama, and the brightening. */
const THINK_SPIN = 1.5;
const THINK_GLOW = 0.5;
/** The "got it" beat: how far the halo pulses outward and how much brighter it flashes. */
const GOT_IT_SWELL = 0.16;
const GOT_IT_GLOW = 1.4;

export function createMemoryHalo(effects: EffectValues, random: () => number = Math.random): PartInstance {
  const graph = createHaloGraph({ colour: effectColour(effects, 'color'), seedNodes: effectNumber(effects, 'nodes') }, random);
  const spinIdle = effectNumber(effects, 'spinIdle');
  const spinWork = effectNumber(effects, 'spinWork');
  const haloFrame = { dt: 0, time: 0, speed: 0, glow: 1, scale: 1, amplitude: 1, flow: 0, think: 0, gotIt: 0, head: new Vector3(), pace: 1 };

  function update(frame: PartFrame): void {
    const p = frame.mood;
    haloFrame.dt = frame.dt;
    haloFrame.time = frame.time;
    const think = thinkDrama(frame.thinking, frame.work, frame.dramaFloor);
    haloFrame.speed = (p.haloSpeed * spinIdle + frame.work * spinWork + think * THINK_SPIN * spinWork) * frame.motion.speed;
    haloFrame.glow = p.haloGlow * (1 + frame.voice * VOICE_GLOW) * (1 + WORK_GLOW * frame.work) * (1 + THINK_GLOW * think + GOT_IT_GLOW * frame.gotIt);
    haloFrame.scale = p.haloScale * (1 + frame.voice * VOICE_SWELL * frame.motion.amplitude) * (1 + GOT_IT_SWELL * frame.gotIt * frame.motion.amplitude);
    haloFrame.amplitude = frame.motion.amplitude;
    haloFrame.flow = frame.work;
    haloFrame.think = think;
    haloFrame.gotIt = frame.gotIt;
    haloFrame.head.copy(frame.head);
    haloFrame.pace = frame.motion.speed;
    graph.update(haloFrame);
  }

  return {
    group: graph.group,
    sparkTarget: graph,
    update,
    setPointScale: (scale) => graph.setPointScale(scale),
    dispose: () => graph.dispose(),
  };
}
