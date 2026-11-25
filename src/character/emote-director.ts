/**
 * The emote director: runs the expression state machine (`expression.ts`), the idle life
 * (`idle-life.ts`) and the effects (`effects/`), and hands the animator one expression frame
 * per frame for the skins.
 *
 * Each frame it samples the playing emote's timeline, fires that emote's cues once each (a
 * burst of sparkles at take-off, hearts as it swoons, a puff on surprise), eases drowsiness in
 * and out (heavy lids and a "z" every few seconds after a long quiet spell), streams data
 * motes while the keeper thinks or works, and throws hearts on a pat and a puff on a poke.
 * Under reduced motion every burst is smaller. Nothing allocates per frame.
 *
 * Pattern: Mediator between the pure state (machine, idle life, timelines) and the scene
 * (effect layer, the worn skin's anchors).
 */
import { Vector3 } from 'three';
import type { Emote, Mood, TouchKind } from './contract';
import type { EffectLayer } from './effects/effect-layer';
import type { EffectKind } from './effects/particle-kinds';
import { EMOTE_SPECS, sampleEmote, type CueOrigin } from './emotes';
import { addDrowsiness, restingExpression, type ExpressionFrame } from './expression-frame';
import { ExpressionMachine, PRIORITY, type Priority } from './expression';
import { IdleLife } from './idle-life';
import { damp, type MotionProfile } from './moods';
import type { Skin } from './skins';

/** Drowsiness eases in slowly and out quickly (1/s); a "z" drifts up every ZZZ_SECONDS. */
const DROWSY_IN = 0.8;
const DROWSY_OUT = 6;
const ZZZ_SECONDS = 2.6;
/** Data motes per second at full thinking drama, and at full work. */
const MOTES_THINKING = 7;
const MOTES_WORKING = 6;
/** Head-space points: the front of the face, and the eye that winks (screen right). */
const FACE_FRONT = new Vector3(0, 0, 1.1);
const WINK_EYE = new Vector3(0.3, 0.12, 1);

export interface DirectorInputs {
  readonly time: number;
  readonly dt: number;
  readonly mood: Mood;
  readonly motion: Readonly<MotionProfile>;
  /** True when nobody has moved the pointer for a while (idle glances are allowed). */
  readonly pointerStill: boolean;
  /** Thinking drama 0..1 (`thinking.ts`) and the eased work level 0..1. */
  readonly drama: number;
  readonly work: number;
  readonly skin: Skin;
}

export class EmoteDirector {
  private readonly effects: EffectLayer;
  private readonly frame: ExpressionFrame = restingExpression();
  private readonly machine = new ExpressionMachine();
  private readonly idle: IdleLife;
  private readonly at = new Vector3();
  private motion: Readonly<MotionProfile> = { amplitude: 1, speed: 1 };
  private quiet = 0;
  private drowsy = 0;
  private zzzClock = 0;
  private woke = false;
  private cueInstance = -1;
  private cuesFired = 0;

  /** `effects` is the stage's effect layer (the stage adds it to the scene and frees it). */
  constructor(effects: EffectLayer, random: () => number = Math.random) {
    this.effects = effects;
    this.idle = new IdleLife(random);
  }

  /** Plays `emote` (after `delay` s); an asked emote also counts as activity. */
  emote(emote: Emote, time: number, priority: Priority = PRIORITY.asked, delay = 0): void {
    if (this.machine.trigger(emote, time, priority, delay) && priority === PRIORITY.asked) this.activity();
  }

  /** Something happened (pointer, touch, voice, a mood change): the quiet spell is over. */
  activity(): void {
    this.quiet = 0;
  }

  /** A touch's effects: hearts float up from a pat, a puff pops from a poke. */
  touch(kind: TouchKind, skin: Skin, time: number): void {
    this.activity();
    if (kind === 'pat') this.burst('heart', 'top', skin, time, 4, 0.12);
    else this.burst('puff', 'top', skin, time, 7);
  }

  /** True once after drowsiness ends (the animator answers with a blink). */
  takeWake(): boolean {
    const woke = this.woke;
    this.woke = false;
    return woke;
  }

  /** Advances everything by one frame and returns the expression frame for the skins. */
  step(input: DirectorInputs): Readonly<ExpressionFrame> {
    const { time, dt, skin } = input;
    this.motion = input.motion;
    this.quiet += dt;
    const wasDrowsy = this.machine.drowsy;
    const state = this.machine.step(time, this.quiet, input.mood);
    if (wasDrowsy && !this.machine.drowsy) this.woke = true;
    if (state.kind === 'neutral') {
      const action = this.idle.step(dt, input.mood === 'idle', input.pointerStill);
      if (action) this.machine.trigger(action, time, PRIORITY.idle);
    }

    const now = this.machine.state; // read in place: no object per frame
    if (now.kind === 'emoting') {
      sampleEmote(now.emote, time - now.startedAt, this.frame);
      this.fireCues(now.emote, time - now.startedAt, now.instance, skin, time);
    } else {
      sampleEmote(null, 0, this.frame);
    }

    this.drowsy = damp(this.drowsy, this.machine.drowsy ? 1 : 0, this.machine.drowsy ? DROWSY_IN : DROWSY_OUT, dt);
    addDrowsiness(this.frame, this.drowsy);
    this.zzzClock = this.drowsy > 0.6 ? this.zzzClock + dt : ZZZ_SECONDS * 0.6;
    if (this.zzzClock >= ZZZ_SECONDS) {
      this.zzzClock = 0;
      this.burst('zzz', 'top', skin, time, 1);
    }

    const moteRate = MOTES_THINKING * input.drama + MOTES_WORKING * Math.max(input.work - 0.3, 0) / 0.7;
    if (moteRate > 0.05) this.effects.emit('mote', this.origin('head', skin), time, moteRate * this.share(), dt);
    this.effects.update(time);
    return this.frame;
  }

  /** Fires each cue of the playing emote once, the first frame its moment has passed. */
  private fireCues(emote: Emote, elapsed: number, instance: number, skin: Skin, time: number): void {
    if (instance !== this.cueInstance) {
      this.cueInstance = instance;
      this.cuesFired = 0;
    }
    const cues = EMOTE_SPECS[emote].cues;
    for (let i = 0; i < cues.length; i++) {
      const bit = 1 << i;
      if (this.cuesFired & bit || elapsed < cues[i].at) continue;
      this.cuesFired |= bit;
      this.burst(cues[i].effect, cues[i].from, skin, time, cues[i].count);
    }
  }

  private burst(kind: EffectKind, from: CueOrigin, skin: Skin, time: number, count: number, stagger = 0): void {
    this.effects.burst(kind, this.origin(from, skin), time, Math.max(1, Math.round(count * this.share())), stagger);
  }

  /** Reduced motion throws fewer particles. */
  private share(): number {
    return 0.35 + 0.65 * this.motion.amplitude;
  }

  /** The world position a cue starts from on the worn skin (reuses one vector). */
  private origin(from: CueOrigin, skin: Skin): Vector3 {
    if (from === 'top') return skin.touchOrigin.getWorldPosition(this.at);
    if (from === 'chest') return skin.sparkOrigin.getWorldPosition(this.at);
    skin.gazeAnchor.updateWorldMatrix(true, false);
    return skin.gazeAnchor.localToWorld(this.at.copy(from === 'eye' ? WINK_EYE : FACE_FRONT));
  }
}
