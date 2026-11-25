/**
 * The face on the visor: two large glowing pill eyes and a small glowing mouth line,
 * all drawn by the glyph shader (`glyph-material.ts`) on quads that hug the visor.
 *
 * The face holds no timing of its own: the animator computes one `FaceState` per
 * frame (lids, squint, gaze, mouth) and `update` writes it into the shader uniforms.
 * Gaze slides the eye shapes across the glass inside their quads, so the eyes move
 * like light under the visor rather than like objects stuck on it.
 */
import { Group, Mesh, Vector2 } from 'three';
import { disposeTree } from '../../dispose-tree';
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
}

const EYE_HALF = new Vector2(0.115, 0.17);
const EYE_SPACING = 0.3;
const EYE_Y = 0.08;
const EYE_MARGIN = 0.15;
const GAZE_TRAVEL = new Vector2(0.075, 0.055);

const MOUTH_HALF = new Vector2(0.1, 0.016);
const MOUTH_Y = -0.2;
const MOUTH_OPEN_HEIGHT = 0.065;

const FACE_INFLATE = 0.022;

export interface Face {
  readonly group: Group;
  update(state: FaceState): void;
  dispose(): void;
}

export function createFace(): Face {
  const group = new Group();
  group.name = 'face';

  const eyeQuad = new Vector2(EYE_HALF.x + EYE_MARGIN, EYE_HALF.y + EYE_MARGIN).multiplyScalar(2);
  const eyes: GlyphMaterial[] = [-1, 1].map((side) => {
    const material = createGlyphMaterial({ quad: eyeQuad, half: EYE_HALF, line: 0.016, glowWidth: 0.045 });
    const mesh = new Mesh(curvedQuad(eyeQuad.x, eyeQuad.y, side * EYE_SPACING, EYE_Y, FACE_INFLATE), material);
    mesh.renderOrder = 2;
    group.add(mesh);
    return material;
  });

  const mouthQuad = new Vector2(0.42, 0.34);
  const mouth = createGlyphMaterial({ quad: mouthQuad, half: MOUTH_HALF, line: 0.012, glowWidth: 0.035 });
  const mouthMesh = new Mesh(curvedQuad(mouthQuad.x, mouthQuad.y, 0, MOUTH_Y, FACE_INFLATE), mouth);
  mouthMesh.renderOrder = 2;
  group.add(mouthMesh);

  function update(state: FaceState): void {
    const shiftX = state.gazeX * GAZE_TRAVEL.x;
    const shiftY = state.gazeY * GAZE_TRAVEL.y;
    for (const eye of eyes) {
      const u = eye.uniforms;
      u.uOpen.value = Math.max(state.eyeOpen, 0);
      u.uSquint.value = state.squint;
      u.uBend.value = state.eyeBend;
      u.uGlow.value = state.glow;
      u.uShift.value.set(shiftX, shiftY);
    }

    const m = mouth.uniforms;
    m.uHalf.value.set(MOUTH_HALF.x * (1 - 0.18 * state.mouthOpen), MOUTH_HALF.y + state.mouthOpen * MOUTH_OPEN_HEIGHT);
    m.uBend.value = state.smile * 0.55 * (1 - 0.5 * state.mouthOpen);
    m.uGlow.value = state.glow * 0.9;
    m.uShift.value.set(shiftX * 0.4, shiftY * 0.3);
  }

  return { group, update, dispose: () => disposeTree(group) };
}
