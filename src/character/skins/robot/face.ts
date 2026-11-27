/**
 * The face on the visor: two large glowing pill eyes and a small glowing mouth line,
 * all drawn by the glyph shader (`glyph-material.ts`) on quads that hug the visor.
 *
 * The face holds no timing of its own: the animator computes one `FaceState` per
 * frame (lids, squint, gaze, mouth) and `update` writes it into the shader uniforms.
 * Gaze slides the eye shapes across the glass inside their quads, so the eyes move
 * like light under the visor rather than like objects stuck on it. While the robot works
 * the glyphs shift from warm cream toward electric cyan (`cool`), then hot amber (`hot`).
 * While it thinks (`scan` 0..1) the eyes narrow and widen into two processing bars, go cyan,
 * pulse alternately and carry one scan bar that sweeps through both (`scanX` -1..1 across the
 * pair); `scan` 0 leaves every uniform exactly as before.
 *
 * The visor is a screen, so expressions are drawn on it: heart eyes that beat (`hearts`),
 * spinning sparkle-star eyes (`stars`), loader rings while thinking (`loader`), one eye shut
 * for a wink (`wink`, the screen-right eye), a round "o" mouth (`mouthO`) and, while it
 * speaks or listens, an equaliser mouth (`bars`, heights in `barHeights`). All 0 = as before.
 *
 * The face mix (`expression-mix.ts`) is drawn the screen's way: `focus` slants each eye's top down
 * toward the nose (a brow drawn in light) and presses the mouth into a short line, `sleepy` slants
 * them the other way (drooping outer corners), `surprise` rounds the eyes wider and the mouth into
 * an "o". The lids, squint, smile and glow arrive already folded in `eyeOpen`/`squint`/`smile`/`glow`.
 */
import { Color, Group, Mesh, Vector2 } from 'three';
import { disposeTree } from '../../dispose-tree';
import { PALETTE } from '../../palette';
import { BAR_COUNT } from '../../speech-bars';
import type { ResolvedZone } from '../../look/zones';
import { createGlyphMaterial, type GlyphMaterial } from './glyph-material';
import { curvedQuad } from './head-shape';

/** Everything the face shows in one frame. */
export interface FaceState {
  /** Lid opening: 0 closed, 1 open, >1 wide. Blinks are already folded in. */
  eyeOpen: number;
  squint: number;
  eyeBend: number;
  glow: number;
  /** Gaze in -1..1 on both axes (positive x is the character's left on screen-right). */
  gazeX: number;
  gazeY: number;
  /** Mouth openness 0..1 and resting smile -1..1. */
  mouthOpen: number;
  smile: number;
  /** Working tint 0..1: toward cyan (`cool`), then amber over it (`hot`). 0 = the warm face. */
  cool: number;
  hot: number;
  /** Thinking display 0..1, the scan bar's place across both eyes -1..1, and its clock (s). */
  scan: number;
  scanX: number;
  scanTime: number;
  /** Screen expressions 0..1: heart eyes, star eyes, loader eyes, a wink, an "o" mouth, bars. */
  hearts: number;
  stars: number;
  loader: number;
  wink: number;
  mouthO: number;
  bars: number;
  /** The face mix 0..1 (`SkinFrame.face`): focused, sleepy, surprised (happy is all in squint and smile). */
  focus: number;
  sleepy: number;
  surprise: number;
  /** Seconds, for the beating hearts and the spinning stars and loader. */
  time: number;
}

/** The glyph colours at rest, working and hot (core, edge). */
const REST = { core: new Color(PALETTE.cream50), edge: new Color(PALETTE.gold400) };
const COOL = { core: new Color(PALETTE.workCyanCore), edge: new Color(PALETTE.workCyanEdge) };
const HOT = { core: new Color(PALETTE.heatCore), edge: new Color(PALETTE.heatAmber) };
const WHITE = new Color(0xffffff);

const EYE_HALF = new Vector2(0.115, 0.17);
const EYE_SPACING = 0.3;
const EYE_Y = 0.08;
const EYE_MARGIN = 0.15;
const GAZE_TRAVEL = new Vector2(0.075, 0.055);
/** Thinking eyes: lid opening of the processing bar, extra width, and pulse rate (rad/s). */
const SCAN_OPEN = 0.3;
const SCAN_WIDEN = 0.22;
const SCAN_PULSE_RATE = 7;

const MOUTH_HALF = new Vector2(0.1, 0.016);
const MOUTH_Y = -0.2;
const MOUTH_OPEN_HEIGHT = 0.065;
/** The round "o" mouth's half size. */
const MOUTH_O = new Vector2(0.05, 0.058);
/** Heart eyes beat this much bigger at each beat, this many beats a second (rad/s). */
const HEART_BEAT = 0.1;
const HEART_RATE = 7.5;
/** How steeply focus and sleep slant the eyes' tops, how much a surprise widens them, and a focused mouth's narrowing. */
const FOCUS_SLANT = 0.5;
const SLEEPY_SLANT = 0.45;
const SURPRISE_WIDEN = 0.16;
const FOCUS_MOUTH = 0.35;

const FACE_INFLATE = 0.022;

export interface Face {
  readonly group: Group;
  /** The two eye quads (the `eyes` paint zone's meshes, for framing it). */
  readonly eyeMeshes: readonly Mesh[];
  /**
   * Paints the glyphs (the `eyes` zone): a colour becomes the glow's edge with a near-white core
   * of the same hue; `glow` burns brighter, `matte` softer. Undefined = the shipped warm cream.
   * Work and thinking tints still play over it.
   */
  paintEyes(zone: ResolvedZone | undefined): void;
  /** The equaliser bar heights 0..1 the mouth shows when `bars` > 0 (write them each frame). */
  readonly barHeights: Float32Array;
  update(state: FaceState): void;
  dispose(): void;
}

export function createFace(): Face {
  const group = new Group();
  group.name = 'face';

  const eyeQuad = new Vector2(EYE_HALF.x + EYE_MARGIN, EYE_HALF.y + EYE_MARGIN).multiplyScalar(2);
  const sides = [-1, 1] as const;
  const eyeMeshes: Mesh[] = [];
  const eyes: GlyphMaterial[] = sides.map((side) => {
    const material = createGlyphMaterial({ quad: eyeQuad, half: EYE_HALF, line: 0.016, glowWidth: 0.045 });
    const mesh = new Mesh(curvedQuad(eyeQuad.x, eyeQuad.y, side * EYE_SPACING, EYE_Y, FACE_INFLATE), material);
    mesh.renderOrder = 2;
    group.add(mesh);
    eyeMeshes.push(mesh);
    return material;
  });
  /** This face's resting glyph colours (painted by the `eyes` zone) and glow. */
  const rest = { core: REST.core.clone(), edge: REST.edge.clone(), glow: 1 };

  const mouthQuad = new Vector2(0.42, 0.34);
  const mouth = createGlyphMaterial({ quad: mouthQuad, half: MOUTH_HALF, line: 0.012, glowWidth: 0.035 });
  const mouthMesh = new Mesh(curvedQuad(mouthQuad.x, mouthQuad.y, 0, MOUTH_Y, FACE_INFLATE), mouth);
  mouthMesh.renderOrder = 2;
  group.add(mouthMesh);
  const glyphs: readonly GlyphMaterial[] = [...eyes, mouth];
  const barHeights = new Float32Array(BAR_COUNT);
  mouth.uniforms.uBarH.value = barHeights;

  function update(state: FaceState): void {
    const shiftX = state.gazeX * GAZE_TRAVEL.x;
    const shiftY = state.gazeY * GAZE_TRAVEL.y;
    const scan = state.scan;
    // Thinking reads data in cyan whatever the work level; amber heat still shows, halved.
    const cool = scan > 0 ? Math.max(state.cool, scan) : state.cool;
    const hot = scan > 0 ? state.hot * (1 - 0.5 * scan) : state.hot;
    for (const glyph of glyphs) {
      glyph.uniforms.uCore.value.copy(rest.core).lerp(COOL.core, cool).lerp(HOT.core, hot);
      glyph.uniforms.uEdge.value.copy(rest.edge).lerp(COOL.edge, cool).lerp(HOT.edge, hot);
    }
    const barX = state.scanX * (EYE_SPACING + EYE_HALF.x);
    const beat = 1 + state.hearts * HEART_BEAT * Math.max(0, Math.sin(state.time * HEART_RATE)) ** 4;
    for (let i = 0; i < eyes.length; i++) {
      const u = eyes[i].uniforms;
      const open = Math.max(state.eyeOpen, 0) * (sides[i] === 1 ? 1 - state.wink : 1);
      u.uOpen.value = scan > 0 ? open + (Math.min(open, SCAN_OPEN) - open) * scan : open;
      u.uHalf.value.set(EYE_HALF.x * (1 + SCAN_WIDEN * scan + SURPRISE_WIDEN * state.surprise) * beat, EYE_HALF.y * beat);
      // The screen-left eye (side -1) has the nose on its +x side: + slant lowers that end.
      u.uSlant.value = -sides[i] * (FOCUS_SLANT * state.focus * (1 - 0.6 * scan) - SLEEPY_SLANT * state.sleepy) * (1 - state.hearts) * (1 - state.stars);
      // A winking eye stays a closed line, never a heart or a star.
      const shut = sides[i] === 1 ? 1 - state.wink : 1;
      u.uHeart.value = state.hearts * shut;
      u.uStar.value = state.stars * shut;
      u.uLoader.value = state.loader;
      u.uTime.value = state.time;
      u.uSquint.value = state.squint;
      u.uBend.value = state.eyeBend * (1 - scan);
      u.uGlow.value = state.glow * rest.glow;
      u.uShift.value.set(shiftX, shiftY);
      u.uScan.value = scan;
      u.uScanX.value = barX - sides[i] * EYE_SPACING;
      u.uScanPulse.value = 1 + 0.45 * Math.sin(state.scanTime * SCAN_PULSE_RATE + (sides[i] * Math.PI) / 2);
      u.uScanTime.value = state.scanTime;
    }

    const m = mouth.uniforms;
    const o = state.mouthO;
    const halfX = MOUTH_HALF.x * (1 - 0.18 * state.mouthOpen) * (1 - FOCUS_MOUTH * state.focus * (1 - state.mouthOpen));
    const halfY = MOUTH_HALF.y + state.mouthOpen * MOUTH_OPEN_HEIGHT;
    m.uHalf.value.set(halfX + (MOUTH_O.x - halfX) * o, halfY + (MOUTH_O.y - halfY) * o);
    m.uBend.value = state.smile * 0.55 * (1 - 0.5 * state.mouthOpen) * (1 - o);
    m.uBars.value = state.bars * (1 - o);
    m.uGlow.value = state.glow * 0.9;
    m.uShift.value.set(shiftX * 0.4, shiftY * 0.3);
  }

  function paintEyes(zone: ResolvedZone | undefined): void {
    rest.core.copy(REST.core);
    rest.edge.copy(REST.edge);
    if (zone?.color !== undefined) {
      rest.edge.setHex(zone.color);
      rest.core.setHex(zone.color).lerp(WHITE, 0.7);
    }
    rest.glow = zone?.material === 'glow' ? 1.45 : zone?.material === 'matte' ? 0.75 : 1;
  }

  return { group, eyeMeshes, barHeights, update, paintEyes, dispose: () => disposeTree(group) };
}
