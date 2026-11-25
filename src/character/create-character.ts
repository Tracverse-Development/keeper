/**
 * `createCharacter(canvas, options)`: assembles the character (the shared stage, halo,
 * sparks, ark and backdrop, plus the worn skin), runs the render loop and returns the
 * `Character` contract.
 *
 * Pattern: Facade. Callers see a handful of methods; the scene graph, the skins, the animator and the
 * browser plumbing stay behind it. The facade also owns the plumbing every host would
 * otherwise repeat: it follows the canvas size (ResizeObserver) and the screen's pixel
 * ratio (capped at 2), pauses the loop while the window is hidden, honours
 * `prefers-reduced-motion` live, and `dispose()` frees every GPU resource it made.
 */
import { Raycaster, Vector2, type Camera } from 'three';
import { Animator } from './animator';
import type { Character, HitRegion, Mood, TouchKind } from './contract';
import { isMood } from './moods';
import { SkinSwitcher } from './skin-switcher';
import { DEFAULT_SKIN_ID, createSkin, resolveSkinId } from './skins';
import { createArk } from './stage/ark';
import { createBackdrop } from './stage/backdrop';
import { createHalo } from './stage/halo';
import { createMemorySparks } from './stage/memory-spark';
import { createStage } from './stage/scene';
import { createTouchSparkles } from './stage/touch-sparkles';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const TOUCH_KINDS: readonly TouchKind[] = ['poke', 'pat'];

export interface CreateCharacterOptions {
  /** The skin to start in, without a transition (`SKINS` ids; default: the robot). */
  skin?: string;
}

export function createCharacter(canvas: HTMLCanvasElement, options: CreateCharacterOptions = {}): Character {
  const stage = createStage(canvas);
  let skinId = resolveSkinId(options.skin ?? DEFAULT_SKIN_ID);
  const firstSkin = createSkin(skinId);
  const halo = createHalo();
  const sparks = createMemorySparks(halo);
  const ark = createArk();
  const backdrop = createBackdrop();
  stage.scene.add(backdrop.mesh);
  const skins = new SkinSwitcher(stage.scene, firstSkin);
  const touchSparkles = createTouchSparkles();
  stage.scene.add(halo.group, sparks.group, ark.group, touchSparkles.group);

  const animator = new Animator({ stage, skins, halo, sparks, touchSparkles, ark, backdrop });
  const hitTest = createHitTester(stage.camera, skins);

  const reducedMotion = window.matchMedia?.(REDUCED_MOTION_QUERY);
  const onMotionChange = (): void => animator.setReducedMotion(Boolean(reducedMotion?.matches));
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
    halo.setPointScale(pixelsPerUnit);
    sparks.setPointScale(pixelsPerUnit);
    touchSparkles.setPointScale(pixelsPerUnit);
  };
  const resizeObserver = new ResizeObserver(fitToCanvas);
  resizeObserver.observe(canvas);
  fitToCanvas();

  let lastTimestamp: number | undefined;
  const tick = (timestamp: number): void => {
    fitToCanvas(); // cheap; catches a pixel-ratio change when the window moves screens
    const seconds = lastTimestamp === undefined ? 0 : (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
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
    hitTest,
    react(kind: TouchKind) {
      if (TOUCH_KINDS.includes(kind)) animator.react(kind);
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
      sparks.dispose();
      halo.dispose();
      ark.dispose();
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
