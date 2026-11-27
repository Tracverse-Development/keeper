/**
 * The stage: one WebGL renderer, the camera, the lights, the image-based environment
 * and the post-processing chain (render -> bloom -> ACES tone map + sRGB output).
 *
 * Why a composer: the eyes, mouth and halo are drawn in HDR (values above 1) and only
 * those bright parts bloom; the physically based body stays crisp. Tone mapping and
 * colour space conversion happen once, in `OutputPass`, at the end of the chain.
 *
 * Framing: the character (halo top to wave rings) is ~4.3 units tall. `resize` picks a
 * camera distance so it fills ~60% of the viewport height (or fits the width on a narrow
 * window) and aims slightly below it, leaving the bottom of the window for the chat bar.
 *
 * Cost: `setQuality` takes a tier from the frame governor (`frame-governor.ts`): fewer MSAA
 * samples on the HDR buffers, or no bloom. The pixel ratio is the caller's (`resize`).
 */
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  HalfFloatType,
  PMREMGenerator,
  PerspectiveCamera,
  PointLight,
  SRGBColorSpace,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PALETTE } from '../palette';
import type { QualityTier } from './frame-governor';

/** Height of the framed subject (world units) and the share of the viewport it fills. */
const SUBJECT_HEIGHT = 4.3;
const SUBJECT_WIDTH = 4.8;
const VIEWPORT_SHARE = 0.6;
/** World y of the subject's centre, and how far below it the camera aims (chat-bar room). */
const SUBJECT_CENTRE_Y = -0.35;
const AIM_DROP_SHARE = 0.12;
/** Shared with the zone focus maths (`look/zone-focus.ts` FOCUS_FIELD_OF_VIEW). */
export const FIELD_OF_VIEW = 30;
const MAX_PIXEL_RATIO = 2;
/** A photo (`Character.photo`) frames the keeper larger and centred: no room kept for a chat bar. */
const PORTRAIT = { share: 0.8, drop: 0 } as const;

/** How `resize` frames the subject: `stage` (the window, room for the chat bar) or `portrait` (a photo). */
export type Framing = 'stage' | 'portrait';

export interface Stage {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly bloom: UnrealBloomPass;
  /** The light that follows the eyes' glow onto the visor and chest; its intensity is eased. */
  readonly faceLight: PointLight;
  /** The gold rim lights, dimmed together when the character sleeps. */
  readonly rimLights: readonly DirectionalLight[];
  /** The ambient, key and fill lights (a stage mood tints them: `stage-mood.ts`). */
  readonly lights: { readonly ambient: AmbientLight; readonly key: DirectionalLight; readonly fill: DirectionalLight };
  /** Where the camera stands and looks to frame the whole character (set by `resize`). */
  readonly home: { readonly position: Vector3; readonly target: Vector3 };
  /** Resize to CSS pixels; `pixelRatio` is capped at 2. `framing` defaults to `stage`. */
  resize(width: number, height: number, pixelRatio: number, framing?: Framing): void;
  /** Draw with this tier's MSAA samples and bloom (the HDR buffers are remade only on a change). */
  setQuality(tier: QualityTier): void;
  render(): void;
  dispose(): void;
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(PALETTE.navy900, 1);

  const scene = new Scene();
  scene.background = new Color(PALETTE.navy900);

  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  scene.environment = environment;
  scene.environmentIntensity = 0.3;

  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 100);
  const home = { position: new Vector3(), target: new Vector3() };

  const { faceLight, rimLights, lights } = addLights(scene);

  // MSAA on the HDR buffers keeps the glossy silhouette smooth even with post-processing.
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.6, 0.55, 1.05);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize(width: number, height: number, pixelRatio: number, framing: Framing = 'stage'): void {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    const ratio = Math.min(Math.max(pixelRatio, 1), MAX_PIXEL_RATIO);
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(ratio);
    composer.setSize(w, h);
    frameSubject(camera, w / h, home, framing === 'portrait' ? PORTRAIT : { share: VIEWPORT_SHARE, drop: AIM_DROP_SHARE });
  }

  function setQuality(tier: QualityTier): void {
    bloom.enabled = tier.bloom;
    const samples = Math.max(0, Math.floor(tier.samples));
    // Both of the composer's buffers carry the samples; a disposed buffer is remade at its next use.
    for (const buffer of [composer.renderTarget1, composer.renderTarget2]) {
      if (buffer.samples === samples) continue;
      buffer.samples = samples;
      buffer.dispose();
    }
  }

  return {
    renderer,
    scene,
    camera,
    bloom,
    faceLight,
    rimLights,
    lights,
    home,
    resize,
    setQuality,
    render: () => composer.render(),
    dispose() {
      composer.dispose();
      target.dispose();
      bloom.dispose();
      environment.dispose();
      renderer.dispose();
    },
  };
}

/** Key, fill and two gold rim lights from behind, plus the eye-glow light on the face. */
function addLights(scene: Scene): { faceLight: PointLight; rimLights: DirectionalLight[]; lights: Stage['lights'] } {
  const ambient = new AmbientLight(PALETTE.navy500, 0.35);
  scene.add(ambient);

  const key = new DirectionalLight(PALETTE.cream50, 1.25);
  key.position.set(-3, 4, 5);
  scene.add(key);

  const fill = new DirectionalLight(PALETTE.navy500, 0.9);
  fill.position.set(4, -1, 3);
  scene.add(fill);

  const rimLeft = new DirectionalLight(PALETTE.gold400, 2.6);
  rimLeft.position.set(-4.5, 2.5, -4);
  const rimRight = new DirectionalLight(PALETTE.gold500, 2.2);
  rimRight.position.set(4.5, 1.5, -4.5);
  scene.add(rimLeft, rimRight);

  const faceLight = new PointLight(PALETTE.gold300, 0.5, 2.5, 2);
  faceLight.position.set(0, 0.6, 1.6);
  scene.add(faceLight);

  return { faceLight, rimLights: [rimLeft, rimRight], lights: { ambient, key, fill } };
}

/**
 * Places the camera so the subject fills `fit.share` of the height, or fits the width, aiming
 * `fit.drop` of the view below its centre; writes the pose into `home`.
 */
function frameSubject(camera: PerspectiveCamera, aspect: number, home: { position: Vector3; target: Vector3 }, fit: { share: number; drop: number }): void {
  const halfFov = (FIELD_OF_VIEW * Math.PI) / 360;
  const distanceForHeight = SUBJECT_HEIGHT / fit.share / (2 * Math.tan(halfFov));
  const distanceForWidth = SUBJECT_WIDTH / 0.9 / (2 * Math.tan(halfFov) * aspect);
  const distance = Math.max(distanceForHeight, distanceForWidth);
  const visibleHeight = 2 * distance * Math.tan(halfFov);
  const aimY = SUBJECT_CENTRE_Y - visibleHeight * fit.drop;
  camera.aspect = aspect;
  camera.position.set(0, aimY + 0.4, distance);
  camera.lookAt(0, aimY, 0);
  camera.updateProjectionMatrix();
  home.position.copy(camera.position);
  home.target.set(0, aimY, 0);
}
