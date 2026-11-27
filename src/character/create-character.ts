/**
 * `createCharacter(canvas, options)`: assembles the character (the shared stage, sparks and
 * backdrop, the species (skin) and the wearables in its slots), runs the render loop and
 * returns the `Character` contract.
 *
 * Pattern: Facade. Callers see a handful of methods; the scene graph, the skins, the animator and the
 * browser plumbing stay behind it. The facade also owns the plumbing every host would
 * otherwise repeat: it follows the canvas size (ResizeObserver) and the screen's pixel
 * ratio (capped at 2), pauses the loop while the window is hidden (minimised, covered, another
 * space: `visibilitychange`) and resumes without a jump (`stage/frame-pace.ts`), draws at 30 fps
 * while the window is shown but not focused, steps the render cost down and back up with the
 * frame times (`stage/frame-governor.ts`), honours `prefers-reduced-motion` live, draws photos
 * offscreen (`photo`), and `dispose()` frees every GPU resource it made.
 */
import { Raycaster, Vector2, type Camera } from 'three';
import { Animator } from './animator';
import type { Character, Emote, HitRegion, Habits, Look, Mood, StageMood, TouchKind, WornPart } from './contract';
import { createEffectLayer } from './effects/effect-layer';
import { isEmote } from './emotes';
import { isExpressionChoice } from './expression-mix';
import { isMood } from './moods';
import { DEFAULT_WEARABLES } from './parts';
import { SkinSwitcher } from './skin-switcher';
import { DEFAULT_SKIN_ID, createSkin, resolveSkinId } from './skins';
import { photoSize } from './photo';
import { createBackdrop } from './stage/backdrop';
import { FrameGovernor, QUALITY_TIERS, tierPixelRatio } from './stage/frame-governor';
import { FramePacer, frameStep } from './stage/frame-pace';
import { createMemorySparks } from './stage/memory-spark';
import { createStage, type Framing } from './stage/scene';
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
  /** Step the render cost with the frame times (default true; false = always the full look, for measuring). */
  governor?: boolean;
  /** Told each time the governor picks a quality tier (0 = full look; `QUALITY_TIERS`). */
  onQuality?: (tier: number) => void;
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
  const applyMood = (instant: boolean): void => {
    const mood = moodChoice === 'auto' ? moodOfWear(worn) ?? 'night' : moodChoice;
    moods.set(mood, instant);
    animator.setStageMood(mood); // the stage leans the face (`expression-mix.ts`)
  };
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

  const governed = options.governor !== false;
  const governor = new FrameGovernor();
  const pacer = new FramePacer();
  stage.setQuality(QUALITY_TIERS[governor.tier]);

  /** Sizes the drawing buffer, the framing, the backdrop and every point sprite together. */
  const applySize = (width: number, height: number, ratio: number, framing: Framing): void => {
    stage.resize(width, height, ratio, framing);
    backdrop.setAspect(width / height);
    const pixelsPerUnit = (height * ratio) / (2 * Math.tan((stage.camera.fov * Math.PI) / 360));
    wardrobe.setPointScale(pixelsPerUnit);
    skins.setPointScale(pixelsPerUnit);
    touchSparkles.setPointScale(pixelsPerUnit);
    effects.setPointScale(pixelsPerUnit);
  };
  let lastSize = { width: 0, height: 0, ratio: 0 };
  const fitToCanvas = (): void => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = tierPixelRatio(window.devicePixelRatio, QUALITY_TIERS[governor.tier]);
    if (width === lastSize.width && height === lastSize.height && ratio === lastSize.ratio) return;
    if (width === 0 || height === 0) return;
    lastSize = { width, height, ratio };
    applySize(width, height, ratio, 'stage');
  };
  const resizeObserver = new ResizeObserver(fitToCanvas);
  resizeObserver.observe(canvas);
  fitToCanvas();

  let lastTimestamp: number | undefined;
  const tick = (timestamp: number): void => {
    if (!pacer.due(timestamp)) return;
    // Measured only at the full rate: the background rate's long frames are by design.
    if (governed && lastTimestamp !== undefined && !pacer.inBackground) {
      const tier = governor.sample(timestamp - lastTimestamp, timestamp);
      if (tier !== null) {
        stage.setQuality(QUALITY_TIERS[tier]);
        options.onQuality?.(tier);
      }
    }
    fitToCanvas(); // cheap; catches a pixel-ratio change (the screen's or the governor's)
    const seconds = frameStep(lastTimestamp, timestamp);
    lastTimestamp = timestamp;
    moods.update(seconds);
    animator.frame(seconds);
  };

  let disposed = false;
  /** Forget the last frame: the next one advances nothing and is not measured. */
  const restartClock = (): void => {
    lastTimestamp = undefined;
    pacer.reset();
    governor.reset();
  };
  const start = (): void => {
    if (disposed) return;
    restartClock();
    stage.renderer.setAnimationLoop(tick);
  };
  const stop = (): void => stage.renderer.setAnimationLoop(null);
  const onVisibility = (): void => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);
  // Focus is plain DOM in the Tauri window too (the same as its focus-changed event); it has no
  // event for being covered, which WebKit already reports as `visibilitychange`.
  const onFocus = (): void => {
    pacer.setBackground(!document.hasFocus());
    restartClock();
  };
  window.addEventListener('focus', onFocus);
  window.addEventListener('blur', onFocus);
  pacer.setBackground(!document.hasFocus());
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
    photo(request) {
      if (disposed || !request || typeof request !== 'object') return null;
      const size = photoSize(request, stage.renderer.capabilities.maxTextureSize);
      try {
        // Offscreen in all but name: the canvas's CSS size never changes, and the screen is
        // drawn again before this task ends, so the photo's size is never seen.
        stage.setQuality(QUALITY_TIERS[0]);
        applySize(size.width, size.height, size.ratio, 'portrait');
        // Drawn and read in the same task: the drawing buffer is still there to read.
        animator.frame(0);
        return canvas.toDataURL('image/png');
      } catch {
        return null;
      } finally {
        stage.setQuality(QUALITY_TIERS[governor.tier]);
        lastSize = { width: 0, height: 0, ratio: 0 };
        fitToCanvas();
        animator.frame(0);
        restartClock();
      }
    },
    hitTest,
    react(kind: TouchKind) {
      if (TOUCH_KINDS.includes(kind)) animator.react(kind);
    },
    setExpression(expression) {
      if (!disposed && isExpressionChoice(expression)) animator.setExpression(expression);
    },
    emote(name: Emote) {
      if (!disposed && isEmote(name)) animator.emote(name);
    },
    playMoment: (id) => !disposed && typeof id === 'string' && animator.playMoment(id),
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onFocus);
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
