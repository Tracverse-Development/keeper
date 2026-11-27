/**
 * The divine finish: how any item looks when the God Keeper wears it. The God Keeper (race
 * `divine`, `skins/races.ts`) wears pieces from every race, and each is drawn in its own way:
 *
 *   - a light from within: every lit surface gains a rim of white-gold light at its edges (a fresnel
 *     glow added in the material's shader), breathing slowly, so the piece looks lit by the keeper;
 *   - a pearl sheen: physical materials gain iridescence and a clear coat, so cloth and metal alike
 *     shimmer like the keeper's own armour;
 *   - a trail of gold motes rising off the piece.
 *
 * Pattern: Decorator, like the rarity flourish (`rarity-flourish.ts`), and it stacks with it: a
 * mythical watch on the God Keeper has its tier's vortex AND the divine light. The part never knows.
 */
import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Points, Box3, Sphere, type Object3D } from 'three';
import { disposeTree } from '../dispose-tree';
import { createGlowPointsMaterial } from '../stage/glow-points-material';
import type { PartFrame } from './part';

/** The divine light's colour and how strong the rim is at its brightest. */
const DIVINE_GOLD = new Color(1.0, 0.86, 0.55);
const RIM_STRENGTH = 0.55;
const MOTES = 14;

export interface DivineFinish {
  readonly group: Group;
  update(frame: PartFrame): void;
  setPointScale(scale: number): void;
  dispose(): void;
}

export function applyDivineFinish(target: Object3D): DivineFinish {
  const rim = { value: 0.8 };
  const rimColour = { value: DIVINE_GOLD.clone() };
  const seen = new Set<MeshStandardMaterial>();
  target.traverse((node) => {
    const material = (node as Mesh).material as MeshStandardMaterial | undefined;
    if (!material || !(material instanceof MeshStandardMaterial) || seen.has(material)) return;
    seen.add(material);
    if (material instanceof MeshPhysicalMaterial) {
      material.iridescence = Math.max(material.iridescence, 0.3);
      material.iridescenceIOR = 1.6;
      material.clearcoat = Math.max(material.clearcoat, 0.4);
    }
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uDivineRim = rim;
      shader.uniforms.uDivineColour = rimColour;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uDivineRim;\nuniform vec3 uDivineColour;')
        .replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n  float divineEdge = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.6);\n  totalEmissiveRadiance += uDivineColour * divineEdge * uDivineRim;',
        );
    };
    material.customProgramCacheKey = () => 'divine-finish';
    material.needsUpdate = true;
  });

  // Gold motes rising off the piece.
  const box = new Box3().setFromObject((target.updateMatrixWorld(true), target), true);
  const sphere = box.isEmpty() ? new Sphere(undefined, 0.2) : box.getBoundingSphere(new Sphere());
  const radius = Math.max(sphere.radius, 0.08);
  const positions = new Float32Array(MOTES * 3);
  const sizes = new Float32Array(MOTES).fill(radius * 0.06 + 0.012);
  const brights = new Float32Array(MOTES);
  const phases = new Float32Array(MOTES).map((_, i) => (i * 0.37) % 1);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aBright', new BufferAttribute(brights, 1));
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));
  const material = createGlowPointsMaterial(0.4);
  material.uniforms.uWarm.value = DIVINE_GOLD.clone();
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  const group = new Group();
  group.name = 'divine-finish';
  group.add(points);
  const seeds = Array.from({ length: MOTES }, (_, i) => ({ angle: (i / MOTES) * Math.PI * 2 * 3.7, start: (i / MOTES) % 1 }));
  let clock = 0;

  return {
    group,
    update(frame) {
      clock += frame.dt * frame.motion.speed;
      rim.value = RIM_STRENGTH * (0.6 + 0.4 * Math.sin(clock * 1.4)) * (0.6 + 0.4 * frame.mood.presence);
      for (let i = 0; i < MOTES; i++) {
        const rise = (seeds[i].start + clock * 0.18) % 1;
        const a = seeds[i].angle + clock * 0.5;
        positions[i * 3] = sphere.center.x + Math.cos(a) * radius * 0.8;
        positions[i * 3 + 1] = sphere.center.y - radius * 0.3 + rise * radius * 1.8;
        positions[i * 3 + 2] = sphere.center.z + Math.sin(a) * radius * 0.8;
        brights[i] = Math.sin(rise * Math.PI) * 1.3;
      }
      geometry.getAttribute('position').needsUpdate = true;
      geometry.getAttribute('aBright').needsUpdate = true;
      material.uniforms.uTime.value = frame.time;
    },
    setPointScale(scale) {
      material.uniforms.uScale.value = scale;
    },
    dispose: () => disposeTree(group),
  };
}
