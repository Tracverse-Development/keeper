/**
 * The man's trimmed full beard as ONE shell over the sculpted head (`human-face.ts` `sculptedShell`):
 * a moustache over the upper lip that runs down past the mouth's corners into the chin and jaw, up
 * the cheeks to a soft line and into sideburns in front of the ears, with the lips left bare.
 *
 * It used to be three pieces (a chin cap, a stippled band above it and a torus moustache) with bare
 * skin at the mouth's corners between the moustache and the chin: the gap. Here the coverage is a
 * region worked out per vertex (`beardFade`, pure: 1 inside, falling to 0 across the edge), so the
 * moustache and the chin are one piece by construction. The edge is broken into single hairs by a
 * noise alpha map multiplied with the vertex fade (alpha test 0.5): crisp along the moustache and
 * round the lips, sparse and feathered up the cheeks. A second, thicker layer gives the moustache
 * its body. Pattern: Builder functions plus one pure region function.
 */
import { BufferAttribute, DataTexture, LinearFilter, Mesh, RepeatWrapping, RGBAFormat, type Group, type MeshPhysicalMaterial } from 'three';
import { sculptedShell } from './human-face.ts';
import type { HumanFrame } from './human-shape.ts';
import { MOUTH_Y } from './human-mouth.ts';

/** The beard's top line: heights (head space) at azimuths round the face (radians from the front). */
const TOP_LINE: readonly (readonly [number, number])[] = [
  [0, -0.212], // the moustache's top, under the nostrils
  [0.2, -0.225],
  [0.34, -0.28], // dipping to the mouth's corners
  [0.62, -0.3], // the cheek line, low on the face
  [0.95, -0.24],
  [1.18, -0.12], // rising into the sideburn
  [1.32, 0.02],
  [1.42, 0.05],
];
/** Edge width (how far the fade runs, head units) along the top line: crisp moustache, soft cheeks. */
const EDGE: readonly (readonly [number, number])[] = [
  [0, 0.018],
  [0.3, 0.03],
  [0.62, 0.07],
  [1.0, 0.06],
  [1.38, 0.04],
];
/** The furthest round the head the beard reaches (radians from the front), above the jaw and below it. */
const SIDE_REACH = 1.48;
const UNDER_REACH = 1.95;
/** Below this height the beard wraps under the jaw. */
const JAW_Y = -0.5;
/** The bare lips: an ellipse round the mouth (head space), and its edge width. */
const LIPS = { x: 0, y: MOUTH_Y - 0.004, rx: 0.108, ry: 0.047, edge: 0.01 } as const;
/** The moustache's thicker layer: its reach across the face and its bottom (just above the lips). */
const MOUSTACHE = { halfWidth: 0.17, bottom: MOUTH_Y + 0.05 } as const;

function lerpTable(table: readonly (readonly [number, number])[], at: number): number {
  if (at <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    if (at <= x1) {
      const [x0, y0] = table[i - 1];
      const t = (at - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t * t * (3 - 2 * t);
    }
  }
  return table[table.length - 1][1];
}

function ramp(from: number, to: number, value: number): number {
  const t = Math.min(Math.max((value - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * How much beard grows at head-space point (x, y, z): 1 well inside, 0 outside, a ramp across the
 * edge. Pure (no three.js).
 */
export function beardFade(x: number, y: number, z: number): number {
  const azimuth = Math.abs(Math.atan2(x, z));
  const reach = y < JAW_Y ? UNDER_REACH : SIDE_REACH;
  if (azimuth > reach) return 0;
  const edge = lerpTable(EDGE, azimuth);
  const top = ramp(0, edge, lerpTable(TOP_LINE, azimuth) - y);
  const side = ramp(reach, reach - 0.12, azimuth);
  // The lips stay bare: the distance outside their ellipse (front of the face only).
  const q = z > 0 ? Math.hypot((x - LIPS.x) / LIPS.rx, (y - LIPS.y) / LIPS.ry) : 9;
  const lips = ramp(1, 1 + LIPS.edge / LIPS.ry, q);
  return top * side * lips;
}

/** Noise in [0.25, 1]: times a fade of 2 (vertex alpha) it clears alpha test 0.5 fully inside, partly at the edge. */
function hairNoise(): DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  let seed = 41;
  for (let i = 0; i < size * size; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const n = Math.round(255 * (0.25 + 0.75 * (seed / 4294967296)));
    data.set([n, n, n, 255], i * 4);
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = texture.minFilter = LinearFilter;
  texture.repeat.set(36, 14);
  texture.needsUpdate = true;
  return texture;
}

/**
 * A shell over the lower head grown by `inflate`, keeping only the triangles where `fade` grows
 * hair, with the fade (doubled) in the vertex alpha.
 */
function regionShell(frame: HumanFrame, inflate: number, fade: (x: number, y: number, z: number) => number): ReturnType<typeof sculptedShell> {
  const geometry = sculptedShell(frame, inflate, { thetaStart: 1.25, thetaLength: Math.PI - 1.25 });
  const position = geometry.getAttribute('position');
  const colour = new Float32Array(position.count * 4);
  const alpha = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    alpha[i] = fade(position.getX(i), position.getY(i), position.getZ(i));
    colour.set([1, 1, 1, 2 * alpha[i]], i * 4);
  }
  geometry.setAttribute('color', new BufferAttribute(colour, 4));
  const index = geometry.getIndex();
  if (index) {
    const kept: number[] = [];
    for (let t = 0; t < index.count; t += 3) {
      const a = index.getX(t);
      const b = index.getX(t + 1);
      const c = index.getX(t + 2);
      if (alpha[a] > 0 || alpha[b] > 0 || alpha[c] > 0) kept.push(a, b, c);
    }
    geometry.setIndex(kept);
  }
  return geometry;
}

/** The moustache's thicker layer: the beard over the upper lip only, crisp at its bottom. */
function moustacheFade(x: number, y: number, z: number): number {
  return beardFade(x, y, z) * ramp(MOUSTACHE.halfWidth, MOUSTACHE.halfWidth - 0.05, Math.abs(x)) * ramp(MOUSTACHE.bottom - 0.01, MOUSTACHE.bottom + 0.01, y);
}

/** Adds the beard and the moustache's body to `head`, in `beard` (the strand-bumped beard material). */
export function addBeard(head: Group, frame: HumanFrame, beard: MeshPhysicalMaterial): void {
  const material = beard.clone();
  material.vertexColors = true;
  material.alphaMap = hairNoise();
  material.alphaTest = 0.5;
  head.add(new Mesh(regionShell(frame, 0.016, beardFade), material));
  head.add(new Mesh(regionShell(frame, 0.03, moustacheFade), material));
}
