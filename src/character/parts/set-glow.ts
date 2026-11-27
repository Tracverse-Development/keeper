/**
 * The set glow: what three pieces of one set worn together share (plan: "Wear three pieces of one set
 * at once: a soft set glow"). Each glowing piece gets a slow ring of warm motes and a breath of
 * white-gold light on its surfaces, and every piece breathes on the SAME clock (the frame's time), so
 * the outfit visibly pulses as one. The core decides which pieces glow (`WornPart.set`, filled in
 * only while enough of that set is worn); this only draws it.
 *
 * Pattern: Decorator, like the rarity flourish (`rarity-flourish.ts`), built round the part's own
 * bounds and never known to the part.
 */
import { Color, Group, MeshStandardMaterial, type Mesh, type Object3D } from 'three';
import { disposeTree } from '../dispose-tree.ts';
import type { PartFrame } from './part.ts';
import { boundsOf, makePoints, type Flourish } from './rarity-flourish.ts';

/** The set glow's colour: warm white gold, apart from every tier colour. */
export const SET_GLOW_COLOUR = '#fff0c8';
/** Motes on each piece's ring, the ring's size over the piece's, and the shared breath (rad/s). */
const MOTES = 14;
const RING = 1.25;
const BREATH = 1.6;
/** How much light the surfaces take at the top of a breath. */
const SURFACE_GLOW = 0.35;
/** The least radius the ring is drawn at (a watch's glow must still read). */
const SMALLEST = 0.2;

/**
 * Builds the set glow round `target`. `surfaceShare` is how much light the piece's own surfaces take
 * at the top of a breath (0 on a body that already glows by itself, the God Keeper: its white robe
 * and cloud bloomed to white).
 */
export function createSetGlow(target: Object3D, surfaceShare = SURFACE_GLOW): Flourish {
  const bounds = boundsOf(target);
  const centre = bounds.center;
  const radius = Math.max(bounds.radius, SMALLEST) * RING;
  const colour = new Color(SET_GLOW_COLOUR);
  const group = new Group();
  group.name = 'set-glow';
  const motes = makePoints(MOTES, 0.4);
  for (let i = 0; i < MOTES; i++) motes.sizes[i] = radius * 0.05 + 0.012;
  group.add(motes.points);
  // Each surface remembers what it was before this glow and what this glow last wrote, so every
  // frame REPLACES its own share instead of adding to last frame's (the light never builds up).
  const surfaces: { material: MeshStandardMaterial; rest: number; base: number; written: number }[] = [];
  const seen = new Set<MeshStandardMaterial>();
  target.traverse((node) => {
    const m = (node as Mesh).material;
    if (m instanceof MeshStandardMaterial && !seen.has(m)) {
      seen.add(m);
      surfaces.push({ material: m, rest: m.emissiveIntensity, base: m.emissiveIntensity, written: m.emissiveIntensity });
    }
  });
  return {
    group,
    update(frame: PartFrame) {
      // One breath for the whole outfit: every piece reads the same clock.
      const breath = 0.5 + 0.5 * Math.sin(frame.time * BREATH);
      for (let i = 0; i < MOTES; i++) {
        const a = (i / MOTES) * Math.PI * 2 + frame.time * 0.5;
        motes.positions[i * 3] = centre.x + Math.cos(a) * radius;
        motes.positions[i * 3 + 1] = centre.y + Math.sin(a * 2 + frame.time) * radius * 0.12;
        motes.positions[i * 3 + 2] = centre.z + Math.sin(a) * radius;
        motes.brights[i] = 0.35 + 0.9 * breath * (0.6 + 0.4 * Math.sin(a * 3 + frame.time * 2));
      }
      motes.geometry.getAttribute('position').needsUpdate = true;
      motes.geometry.getAttribute('aBright').needsUpdate = true;
      motes.material.uniforms.uTime.value = frame.time;
      motes.material.uniforms.uWarm.value.copy(colour);
      // On top of whatever set the intensity this frame (the rarity flourish runs first and writes it
      // afresh); when nothing else wrote it, the base is what it was before our last share.
      for (const s of surfaces) {
        if (s.material.emissiveIntensity !== s.written) s.base = s.material.emissiveIntensity;
        s.written = s.base + surfaceShare * breath;
        s.material.emissiveIntensity = s.written;
      }
    },
    setPointScale(scale) {
      motes.material.uniforms.uScale.value = scale;
    },
    dispose: () => {
      for (const s of surfaces) s.material.emissiveIntensity = s.base;
      disposeTree(group);
    },
  };
}
