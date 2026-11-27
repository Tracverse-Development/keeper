/**
 * `createCharacter(canvas, options)`: assembles the character (the shared stage, sparks and
 * backdrop, the species (skin) and the wearables in its slots), runs the render loop and
 * returns the `Character` contract.
 *
 * Pattern: Facade. Callers see a handful of methods; the scene graph, the skins, the animator and the
 * browser plumbing stay behind it. The facade also owns the plumbing every host would
 * otherwise repeat: it follows the canvas size (ResizeObserver) and the screen's pixel
 * ratio (capped at 2), pauses the loop while the window is hidden, honours
 * `prefers-reduced-motion` live, and `dispose()` frees every GPU resource it made.
 */
import { Raycaster, Vector2, type Camera } from 'three';
import { Animator } from './animator';
import type { Character, Emote, HitRegion, Habits, Look, Mood, StageMood, TouchKind, WornPart } from './contract';
import { createEffectLayer } from './effects/effect-layer';
import { isEmote } from './emotes';
import { isMood } from './moods';
import { DEFAULT_WEARABLES } from './parts';
import { SkinSwitcher } from './skin-switcher';
import { DEFAULT_SKIN_ID, createSkin, resolveSkinId } from './skins';
import { createBackdrop } from './stage/backdrop';
import { createMemorySparks } from './stage/memory-spark';
import { createStage } from './stage/scene';
import { createMoodRig } from './stage/stage-mood';
import { isStageMood, moodOfWear } from './stage/stage-moods';
import { createTouchSparkles } from './stage/touch-sparkles';
import { Wardrobe } from './wardrobe';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const TOUCH_KINDS: readonly TouchKind[] = ['poke', 'pat'];

export interface CreateCharacterOptions {
  /** The skin to start in, without a transition (`SKINS` ids; default: the robot). */
  skin?: string;
  /** The wearables to start in, without a transition (default: `DEFAULT_WEARABLES`). */
  wearables?: readonly WornPart[];
  /** The keeper's colours and materials per paint zone (default: the species' own). */
  look?: Look;
  /** The keeper's habits, 0 never .. 3 often (default: the species' own). */
  habits?: Habits;
  /** The stage's mood (default `auto`: a glowing set's mood, else the classic night). */
  stageMood?: StageMood | 'auto';
}

export function createCharacter(canvas: HTMLCanvasElement, options: CreateCharacterOptions = {}): Character {
  const stage = createStage(canvas);
  let skinId = resolveSkinId(options.skin ?? DEFAULT_SKIN_ID);
  const firstSkin = createSkin(skinId);
  const sparks = createMemorySparks();
  const wardrobe = new Wardrobe(sparks, firstSkin, options.wearables ?? DEFAULT_WEARABLES);
  const backdrop = createBackdrop();
  stage.scene.add(backdrop.mesh);
  const skins = new SkinSwitcher(stage.scene, firstSkin);
  const touchSparkles = createTouchSparkles();
  const effects = createEffectLayer();
  stage.scene.add(wardrobe.group, sparks.group, touchSparkles.group, effects.group);

  const animator = new Animator({ stage, skins, wardrobe, touchSparkles, backdrop, effects });
  // The stage's light: a mood chosen outright, or (auto) the mood of the set the outfit glows with.
  const moods = createMoodRig(stage, backdrop);
  let moodChoice: StageMood | 'auto' = options.stageMood ?? 'auto';
  let worn: readonly WornPart[] = options.wearables ?? DEFAULT_WEARABLES;
  const applyMood = (instant: boolean): void => moods.set(moodChoice === 'auto' ? moodOfWear(worn) ?? 'night' : moodChoice, instant);
  applyMood(true);
  animator.setLook(options.look ?? {});
  animator.setHabits(options.habits ?? {});
  const hitTest = createHitTester(stage.camera, skins);

  const reducedMotion = window.matchMedia?.(REDUCED_MOTION_QUERY);
  const onMotionChange = (): void => {
    animator.setReducedMotion(Boolean(reducedMotion?.matches));
    moods.setReducedMotion(Boolean(reducedMotion?.matches));
  };
  onMotionChange();
  reducedMotion?.addEventListener('change', onMotionChange);

  let lastSize = { width: 0, height: 0, ratio: 0 };
  const fitToCanvas = (): void => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (width === lastSize.width && height === lastSize.height && ratio === lastSize.ratio) return;
    if (width === 0 || height === 0) return;
    lastSize = { width, height, ratio };
    stage.resize(width, height, ratio);
    backdrop.setAspect(width / height);
    const pixelsPerUnit = (height * ratio) / (2 * Math.tan((stage.camera.fov * Math.PI) / 360));
    wardrobe.setPointScale(pixelsPerUnit);
    skins.setPointScale(pixelsPerUnit);
    touchSparkles.setPointScale(pixelsPerUnit);
    effects.setPointScale(pixelsPerUnit);
  };
  const resizeObserver = new ResizeObserver(fitToCanvas);
  resizeObserver.observe(canvas);
  fitToCanvas();

  let lastTimestamp: number | undefined;
  const tick = (timestamp: number): void => {
    fitToCanvas(); // cheap; catches a pixel-ratio change when the window moves screens
    const seconds = lastTimestamp === undefined ? 0 : (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    moods.update(seconds);
    animator.frame(seconds);
  };

  let disposed = false;
  const start = (): void => {
    if (disposed) return;
    lastTimestamp = undefined;
    stage.renderer.setAnimationLoop(tick);
  };
  const stop = (): void => stage.renderer.setAnimationLoop(null);
  const onVisibility = (): void => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);
  if (!document.hidden) start();

  return {
    setMood(mood: Mood) {
      if (isMood(mood)) animator.setMood(mood);
    },
    setVoiceLevel: (level) => animator.setVoiceLevel(level),
    setMouth: (openness) => animator.setMouth(openness),
    lookAt: (x, y) => animator.lookAt(x, y),
    pulseMemory: () => animator.pulseMemory(),
    setSkin(id: string) {
      const next = resolveSkinId(id);
      if (disposed || next === skinId) return;
      skinId = next;
      animator.setSkin(createSkin(next));
    },
    setWearables(parts: readonly WornPart[]) {
      if (disposed || !Array.isArray(parts)) return;
      animator.setWearables(parts);
      worn = parts;
      applyMood(false);
    },
    setStageMood(mood: StageMood | 'auto') {
      if (disposed || (mood !== 'auto' && !isStageMood(mood))) return;
      moodChoice = mood;
      applyMood(false);
    },
    setLook(look: Look) {
      if (!disposed) animator.setLook(look);
    },
    setHabits(habits: Habits) {
      if (!disposed) animator.setHabits(habits);
    },
    zoneFocus: (zone) => (typeof zone === 'string' ? animator.zoneFocus(zone) : null),
    focusZone(zone) {
      if (!disposed) animator.focusZone(typeof zone === 'string' ? zone : null);
    },
    setWork: (level) => animator.setWork(level),
    setFeeling(feeling) {
      if (!disposed) animator.setFeeling(feeling);
    },
    carry(offset) {
      if (!disposed) animator.carry(offset);
    },
    turn(command) {
      if (disposed || !command || typeof command !== 'object') return;
      const t = animator.turn;
      if (command.kind === 'drag') t.drag(command.delta, command.time);
      else if (command.kind === 'release') t.release(command.time);
      else if (command.kind === 'to') t.to(command.yaw);
      else if (command.kind === 'by') t.by(command.delta);
      else if (command.kind === 'around') t.around();
    },
    snapshot() {
      if (disposed) return null;
      try {
        // Drawn and read in the same task: the drawing buffer is still there to read.
        animator.frame(0);
        return canvas.toDataURL('image/png');
      } catch {
        return null;
      }
    },
    hitTest,
    react(kind: TouchKind) {
      if (TOUCH_KINDS.includes(kind)) animator.react(kind);
    },
    emote(name: Emote) {
      if (!disposed && isEmote(name)) animator.emote(name);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion?.removeEventListener('change', onMotionChange);
      resizeObserver.disconnect();
      skins.dispose();
      touchSparkles.dispose();
      effects.dispose();
      wardrobe.dispose();
      moods.dispose();
      backdrop.dispose();
      stage.dispose();
    },
  };
}

/**
 * Raycasts the worn skin's hit proxies from normalised device coordinates. The nearest
 * hit wins (the head in front of the body), and nothing is hit mid-swap.
 */
function createHitTester(camera: Camera, skins: SkinSwitcher): Character['hitTest'] {
  const raycaster = new Raycaster();
  const point = new Vector2();
  return (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || skins.swapping) return null;
    const { root, hitRegions } = skins.active;
    root.updateWorldMatrix(true, true);
    raycaster.setFromCamera(point.set(x, y), camera);
    let best: { region: HitRegion; distance: number } | null = null;
    for (const region of Object.keys(hitRegions) as HitRegion[]) {
      const hit = raycaster.intersectObjects([...hitRegions[region]], false)[0];
      if (hit && (!best || hit.distance < best.distance)) best = { region, distance: hit.distance };
    }
    return best?.region ?? null;
  };
}
