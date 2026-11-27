/**
 * The stage mood rig: applies a mood (`stage-moods.ts`) to the live stage, easing from the last one
 * over MOOD_EASE seconds (instantly under reduced motion). It tints the rim, key, fill and ambient
 * lights, drives two extra directional lights of its own (real lights: the models' physically based
 * materials take their colour), recolours the backdrop sky and sets a thin fog.
 *
 * Pattern: State with an eased transition. The animator still owns the rim lights' STRENGTH (they
 * dim when the keeper sleeps); this rig owns only their colour, so the two never fight.
 */
import { Color, DirectionalLight, FogExp2, type Scene } from 'three';
import type { Backdrop } from './backdrop';
import type { Stage } from './scene';
import { MOOD_SPECS, type MoodLight, type MoodSpec, type StageMood } from './stage-moods';

/** Seconds a change of mood takes. */
const MOOD_EASE = 1.2;

export interface MoodRig {
  readonly mood: StageMood;
  set(mood: StageMood, instant?: boolean): void;
  setReducedMotion(reduced: boolean): void;
  /** Advances the easing by `dt` seconds (call once per frame, before rendering). */
  update(dt: number): void;
  dispose(): void;
}

export function createMoodRig(stage: Stage, backdrop: Backdrop): MoodRig {
  const scene: Scene = stage.scene;
  const extra = [0, 1].map(() => {
    // Directional, so the mood lights the whole keeper evenly at stage distance (it aims at the
    // origin from its position; points would fall off before they reached the body).
    const light = new DirectionalLight(0x000000, 0);
    // On the stage's light rig, so a mood's lights turn with the camera too (the target stays at the origin).
    stage.lightRig.add(light);
    scene.add(light.target);
    return light;
  });
  let current: StageMood = 'night';
  let from = snapshot(MOOD_SPECS.night);
  let to = MOOD_SPECS.night;
  let progress = 1;
  let reduced = false;
  const fog = new FogExp2(0x000000, 0);

  function apply(t: number): void {
    const e = t * t * (3 - 2 * t);
    stage.rimLights.forEach((rim, i) => mixColour(rim.color, from.rims[i], to.rims[i], e));
    mixLight(stage.lights.key, from.key, to.key, e);
    mixLight(stage.lights.fill, from.fill, to.fill, e);
    mixLight(stage.lights.ambient, from.ambient, to.ambient, e);
    extra.forEach((light, i) => {
      const a = from.lights[i];
      const b = to.lights[i];
      // A light fading in takes the new colour at once; one fading out keeps the old.
      light.color.setHex(b.intensity > 0 ? b.colour : a.colour);
      light.intensity = a.intensity + (b.intensity - a.intensity) * e;
      const position = b.intensity > 0 ? b.position : a.position;
      light.position.set(position[0], position[1], position[2]);
    });
    const sky = backdrop.palette;
    mixColour(sky.deep, from.sky.deep, to.sky.deep, e);
    mixColour(sky.mid, from.sky.mid, to.sky.mid, e);
    mixColour(sky.high, from.sky.high, to.sky.high, e);
    mixColour(sky.gold, from.sky.gold, to.sky.gold, e);
    const density = from.fog + (to.fog - from.fog) * e;
    fog.density = density;
    fog.color.copy(sky.deep);
    scene.fog = density > 0 ? fog : null;
  }

  return {
    get mood() {
      return current;
    },
    set(mood, instant = false) {
      if (mood === current && progress >= 1) return;
      from = snapshotNow(stage, backdrop, extra, from, to, progress);
      to = MOOD_SPECS[mood];
      current = mood;
      progress = instant || reduced ? 1 : 0;
      apply(progress);
    },
    setReducedMotion(value) {
      reduced = value;
    },
    update(dt) {
      if (progress >= 1) return;
      progress = Math.min(1, progress + dt / MOOD_EASE);
      apply(progress);
    },
    dispose() {
      for (const light of extra) {
        light.removeFromParent();
        light.target.removeFromParent();
      }
      if (scene.fog === fog) scene.fog = null;
    },
  };
}

function mixColour(target: Color, a: number, b: number, t: number): void {
  target.setHex(a).lerp(SCRATCH.setHex(b), t);
}

function mixLight(light: { color: Color; intensity: number }, a: { colour: number; intensity: number }, b: { colour: number; intensity: number }, t: number): void {
  mixColour(light.color, a.colour, b.colour, t);
  light.intensity = a.intensity + (b.intensity - a.intensity) * t;
}

const SCRATCH = new Color();

function lightNow(light: DirectionalLight): MoodLight {
  return { colour: light.color.getHex(), intensity: light.intensity, position: [light.position.x, light.position.y, light.position.z] };
}

/** A plain copy of a spec (the "from" end of an easing). */
function snapshot(spec: MoodSpec): MoodSpec {
  return JSON.parse(JSON.stringify(spec)) as MoodSpec;
}

/**
 * Where the stage stands now, as a spec, so a mood changed mid-easing starts from what is on screen
 * (never jumps back to the previous mood first). Mid-easing, the blend of `from` and `to` is used.
 */
function snapshotNow(stage: Stage, backdrop: Backdrop, extra: readonly DirectionalLight[], from: MoodSpec, to: MoodSpec, progress: number): MoodSpec {
  if (progress >= 1) return snapshot(to);
  const sky = backdrop.palette;
  return {
    name: to.name,
    rims: [stage.rimLights[0].color.getHex(), stage.rimLights[1].color.getHex()],
    key: { colour: stage.lights.key.color.getHex(), intensity: stage.lights.key.intensity },
    fill: { colour: stage.lights.fill.color.getHex(), intensity: stage.lights.fill.intensity },
    ambient: { colour: stage.lights.ambient.color.getHex(), intensity: stage.lights.ambient.intensity },
    lights: [lightNow(extra[0]), lightNow(extra[1])],
    sky: { deep: sky.deep.getHex(), mid: sky.mid.getHex(), high: sky.high.getHex(), gold: sky.gold.getHex() },
    fog: from.fog + (to.fog - from.fog) * progress,
  };
}
