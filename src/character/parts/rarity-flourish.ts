/**
 * The rarity flourish: the effect a worn item carries for its tier, grander from common to mythical
 * (`rarity.ts` `FLOURISH` holds the numbers). It is built AROUND any part, from the part's own
 * bounds, so every item (a watch, a cap, a jacket, a halo) gets its tier without a line of its own:
 *
 *   glow      the item's own surfaces breathe light in the tier colour
 *   sparkles  twinkling points on a shell round the item
 *   rings     thin halo rings orbiting it, each on its own tilt (one, then two, then three)
 *   rays      light rays turning slowly behind it
 *   motes     points orbiting it and rising through it (a vortex at mythical)
 *   shift     the tier colour drifts through the spectrum (mythical)
 *   bursts    every few seconds the sparkles flare (mythical)
 *
 * Pattern: Decorator. The wardrobe builds the part, then wraps it (`createFlourish`); the part never
 * knows. Surfaces a part already lights itself (a watch dial, a visor's glass) are left alone, so
 * the two never fight over one value. `light` drops the rings and rays: for parts that float round
 * the whole body (a halo, an aura, the ark), where a ring round the ring would be noise. `restrained`
 * (the God Keeper) casts no light and halves the surface glow (`RESTRAINED_GLOW`).
 *
 * Positions are written into preallocated buffers each frame (no allocation).
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Points,
  Sphere,
  TorusGeometry,
  Vector3,
  Box3,
  type Object3D,
} from 'three';
import { disposeTree } from '../dispose-tree.ts';
import { createGlowPointsMaterial, type GlowPointsMaterial } from '../stage/glow-points-material.ts';
import type { PartFrame } from './part.ts';
import { FLOURISH, RARITIES, type RarityId } from './rarity.ts';

/** The least radius an effect is drawn at (world units): a watch's tier must read at a glance. */
const SMALLEST_EFFECT = 0.24;
/**
 * The largest radius the flare and the cast light are sized from: a big piece (wings, the Halo of
 * Ages) keeps a flare the size of a jewel's, not one that fills the stage and washes it white.
 */
const LARGEST_FLARE = 0.4;
/**
 * On a body that glows by itself (the God Keeper, whose divine finish already lights every piece),
 * a tier keeps its rings, sparkles and motes but casts no light and glows at this share: five
 * grand pieces each lighting the body washed the whole stage white.
 */
const RESTRAINED_GLOW = 0.5;

export interface Flourish {
  readonly group: Group;
  update(frame: PartFrame): void;
  setPointScale(scale: number): void;
  dispose(): void;
}

/** The parts' surfaces glowing for the tier: each material's rest emissive, to blend from. */
interface GlowingSurface {
  readonly material: MeshStandardMaterial;
  readonly rest: Color;
  readonly restIntensity: number;
}

/** Builds the flourish for `target` at `rarity` (null for common: nothing to add). */
export function createFlourish(target: Object3D, rarity: RarityId, light = false, random: () => number = Math.random, restrained = false): Flourish | null {
  const spec = FLOURISH[rarity];
  if (spec.glow === 0 && spec.sparkles === 0) return null;
  const bounds = boundsOf(target);
  const centre = bounds.center;
  // A small piece (a watch, a lantern) still gets an effect you can see from across the room.
  const radius = Math.max(bounds.radius, SMALLEST_EFFECT);
  const tint = new Color(RARITIES.find((r) => r.id === rarity)?.color ?? '#ffffff');
  const colour = tint.clone();
  const group = new Group();
  group.name = `flourish-${rarity}`;

  const surfaces = glowingSurfaces(target);
  const sparkles = makePoints(spec.sparkles, 0.6);
  const sparkleSeeds = Array.from({ length: spec.sparkles }, () => randomOnShell(random, radius * 1.15, centre));
  sparkleSeeds.forEach((p, i) => sparkles.positions.set([p.x, p.y, p.z], i * 3));
  for (let i = 0; i < spec.sparkles; i++) sparkles.sizes[i] = radius * (0.06 + random() * 0.07) + 0.018;
  group.add(sparkles.points);

  const rings: Mesh[] = [];
  const ringCount = light ? 0 : spec.rings;
  for (let i = 0; i < ringCount; i++) {
    // Orbit rings: close round the item, nearly level, each on its own small tilt (a halo of the tier).
    const ring = new Mesh(
      new TorusGeometry(radius * (0.95 + 0.1 * i), Math.min(Math.max(radius * 0.008, 0.003), 0.008), 8, 96),
      new MeshBasicMaterial({ color: colour.clone(), transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false }),
    );
    ring.position.copy(centre);
    ring.rotation.set(Math.PI / 2 + [0.28, -0.32, 0.12][i % 3], 0, [0.15, -0.2, 0.5][i % 3]);
    group.add(ring);
    rings.push(ring);
  }

  const rays = new Group();
  rays.position.copy(centre);
  rays.position.z -= radius * 0.4;
  const rayCount = light ? 0 : spec.rays;
  const rayMaterial = new MeshBasicMaterial({ color: colour.clone().multiplyScalar(0.4), transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
  if (rayCount > 0) {
    const blade = new PlaneGeometry(radius * 0.07, radius * 1.9, 1, 8);
    taperBlade(blade);
    for (let i = 0; i < rayCount; i++) {
      const ray = new Mesh(blade, rayMaterial);
      ray.rotation.z = (i / rayCount) * Math.PI;
      rays.add(ray);
    }
    group.add(rays);
  }

  const moteCount = light ? Math.round(spec.motes / 3) : spec.motes;
  const motes = makePoints(moteCount, 0.3);
  const moteSeeds = Array.from({ length: moteCount }, () => ({ angle: random() * Math.PI * 2, height: random(), speed: 0.4 + random() * 0.8, reach: 0.7 + random() * 0.6 }));
  for (let i = 0; i < moteCount; i++) motes.sizes[i] = radius * 0.05 + 0.01;
  group.add(motes.points);

  // The flare: one big soft point at the item's heart; and the light it casts on the body.
  const flare = makePoints(spec.flare > 0 ? 1 : 0, 0);
  flare.positions.set([centre.x, centre.y, centre.z]);
  flare.sizes[0] = Math.min(radius, LARGEST_FLARE) * spec.flare;
  if (spec.flare > 0) group.add(flare.points);
  const lamp = spec.light > 0 && !restrained ? new PointLight(colour, 0, Math.min(radius, LARGEST_FLARE) * 9, 2) : null;
  if (lamp) {
    lamp.position.copy(centre);
    group.add(lamp);
  }

  let clock = 0;
  return {
    group,
    update(frame: PartFrame) {
      const speed = frame.motion.speed;
      clock += frame.dt * speed;
      if (spec.shift) colour.setHSL((clock * 0.08) % 1, 0.75, 0.62);
      // Glow: the surfaces breathe in the tier colour.
      const breathe = 0.65 + 0.35 * Math.sin(clock * 2.1);
      for (const s of surfaces) {
        s.material.emissive.copy(s.rest).lerp(colour, 0.7);
        s.material.emissiveIntensity = s.restIntensity + spec.glow * (restrained ? RESTRAINED_GLOW : 1) * breathe * (0.6 + 0.4 * frame.mood.presence);
      }
      // Sparkles twinkle; a burst flares them all now and then.
      const burst = spec.burstEvery > 0 ? Math.max(0, 1 - ((clock % spec.burstEvery) / 0.5)) : 0;
      for (let i = 0; i < spec.sparkles; i++) {
        const tw = Math.max(0, Math.sin(clock * (2 + (i % 5) * 0.7) + i * 1.7));
        sparkles.brights[i] = 0.25 + 1.5 * tw ** 3 + 1.8 * burst;
      }
      sparkles.geometry.getAttribute('aBright').needsUpdate = true;
      for (const [i, ring] of rings.entries()) {
        ring.rotation.z += frame.dt * speed * (0.35 + 0.25 * i) * (i % 2 ? -1 : 1);
        (ring.material as MeshBasicMaterial).color.copy(colour).multiplyScalar(0.9 + 0.4 * breathe);
      }
      rays.rotation.z += frame.dt * speed * 0.15;
      rayMaterial.color.copy(colour).multiplyScalar(0.25 + 0.2 * breathe);
      // Motes orbit the item and rise through it (a tightening vortex for the grandest tiers).
      for (let i = 0; i < moteCount; i++) {
        const m = moteSeeds[i];
        const rise = (m.height + clock * 0.12 * m.speed) % 1;
        const angle = m.angle + clock * m.speed * (spec.shift ? 1.6 : 0.8);
        const r = radius * m.reach * spec.reach * (spec.shift ? 1.3 - 0.6 * rise : 1.15);
        motes.positions[i * 3] = centre.x + Math.cos(angle) * r;
        motes.positions[i * 3 + 1] = centre.y - radius + rise * radius * 2.2 * spec.reach;
        motes.positions[i * 3 + 2] = centre.z + Math.sin(angle) * r;
        motes.brights[i] = Math.sin(rise * Math.PI) * 1.1;
      }
      if (moteCount) {
        motes.geometry.getAttribute('position').needsUpdate = true;
        motes.geometry.getAttribute('aBright').needsUpdate = true;
      }
      if (spec.flare > 0) {
        flare.brights[0] = 0.5 + 0.35 * breathe + 0.8 * burst;
        flare.geometry.getAttribute('aBright').needsUpdate = true;
      }
      if (lamp) {
        lamp.color.copy(colour);
        lamp.intensity = spec.light * (0.7 + 0.3 * breathe) * (1 + burst);
      }
      for (const p of [sparkles, motes, flare]) {
        p.material.uniforms.uTime.value = frame.time;
        p.material.uniforms.uWarm.value.copy(colour);
      }
    },
    setPointScale(scale) {
      for (const p of [sparkles, motes, flare]) p.material.uniforms.uScale.value = scale;
    },
    dispose: () => disposeTree(group),
  };
}

/**
 * The bounding sphere of `target` in its parent's space. It is measured before it is put on (no
 * parent yet), so its world space IS that space, and the flourish sits beside it in the same group.
 */
export function boundsOf(target: Object3D): Sphere {
  target.updateMatrixWorld(true);
  const box = new Box3().setFromObject(target, true);
  const sphere = new Sphere();
  if (box.isEmpty()) return sphere.set(new Vector3(), 0.2);
  return box.getBoundingSphere(sphere);
}

/** The surfaces that may glow: lit materials the part does not light itself. */
function glowingSurfaces(target: Object3D): GlowingSurface[] {
  const out: GlowingSurface[] = [];
  const seen = new Set<MeshStandardMaterial>();
  target.traverse((node) => {
    const material = (node as Mesh).material as MeshStandardMaterial | undefined;
    if (!material || !(material instanceof MeshStandardMaterial) || seen.has(material)) return;
    seen.add(material);
    const lit = material.emissiveIntensity > 0 && material.emissive.getHex() !== 0;
    if (!lit) out.push({ material, rest: material.emissive.clone(), restIntensity: 0 });
  });
  return out;
}

export function makePoints(count: number, twinkle: number): { points: Points; geometry: BufferGeometry; material: GlowPointsMaterial; positions: Float32Array; sizes: Float32Array; brights: Float32Array } {
  const positions = new Float32Array(Math.max(count, 1) * 3);
  const sizes = new Float32Array(Math.max(count, 1));
  const brights = new Float32Array(Math.max(count, 1));
  const phases = new Float32Array(Math.max(count, 1)).map((_, i) => (i * 0.618) % 1);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aBright', new BufferAttribute(brights, 1));
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));
  geometry.setDrawRange(0, count);
  const material = createGlowPointsMaterial(twinkle);
  material.uniforms.uGlow.value = 1.2;
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return { points, geometry, material, positions, sizes, brights };
}

function randomOnShell(random: () => number, radius: number, centre: Vector3): Vector3 {
  const u = random() * 2 - 1;
  const a = random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  const r = radius * (0.85 + random() * 0.3);
  return new Vector3(centre.x + s * Math.cos(a) * r, centre.y + u * r, centre.z + s * Math.sin(a) * r);
}

/** Narrows a ray blade to points at both ends (a long diamond), so rays read as light, not sticks. */
function taperBlade(blade: PlaneGeometry): void {
  const position = blade.getAttribute('position');
  const half = blade.parameters.height / 2;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    position.setX(i, position.getX(i) * Math.max(0, 1 - Math.abs(y) / half) ** 0.5);
  }
  position.needsUpdate = true;
}
