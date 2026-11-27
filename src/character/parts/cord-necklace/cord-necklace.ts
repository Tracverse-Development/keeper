/**
 * The Cord Necklace (slot `neck`, any species with a neck): three strands of twisted cord, each a
 * pair of plies wound round each other, hanging lower at the front one below the next; on the
 * lowest strand a steel brooch with a glowing core, and from it a chain of interlocked links that
 * swings a little.
 *
 * Pattern: Adapter: it reads the neck's published shape (`fit.ts`), never the species. Each strand
 * follows the neck's own ring, dropped at the front, and every piece is kept clear of the body.
 * Effects: `color` (the cord), `trim` (the metal), `light` (the brooch's glow) with `glow`.
 */
import { CatmullRomCurve3, Color, Group, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry, TubeGeometry, Vector3, type BufferGeometry, type Material } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { crossSection, radiusAt, type BodyShape, type PartFit } from '../fit.ts';
import { outward, pushOut } from '../garment.ts';
import { lightMaterial, metalMaterial } from '../glow-kit.ts';
import type { PartFrame, PartInstance } from '../part';
import { onSurface } from '../top/top-shell.ts';

/** How far the cord stands off the neck, a ply's radius, and how far apart the two plies wind. */
const EASE = 0.06;
const PLY = 0.012;
const WIND = 0.011;
/** Twists of a strand round the neck, and points along it. */
const TWISTS = 46;
const POINTS = 320;
/** Each strand: where it sits at the back (share of the way down to the reach) and how far it drops at the front. */
const STRANDS: readonly { readonly back: number; readonly drop: number }[] = [
  { back: 0.12, drop: 0.1 },
  { back: 0.2, drop: 0.22 },
  { back: 0.28, drop: 0.36 },
];
/** The brooch: its angle round the neck (toward the wearer's left), ring size, and the chain's links. */
const BROOCH_ANGLE = 0.5;
const BROOCH = 0.072;
const LINKS = 7;
const LINK = 0.024;

export function createCordNecklace(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'cord-necklace';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };

  const colour = effectColour(effects, 'color');
  const cord = new MeshStandardMaterial({ color: colour, roughness: 0.82 });
  const cordDark = new MeshStandardMaterial({ color: new Color(colour).multiplyScalar(0.62), roughness: 0.86 });
  const steel = metalMaterial(effectColour(effects, 'trim'), 0.28, 0.02);
  const glow = effectNumber(effects, 'glow');
  const light = lightMaterial(effectColour(effects, 'light'), 1.8 * glow);
  const add = (geometry: BufferGeometry, material: Material, name: string): Mesh => {
    const mesh = Object.assign(new Mesh(geometry, material), { name });
    group.add(mesh);
    return mesh;
  };

  const top = shape.profile[0][1];
  const span = top - shape.reach;
  for (const [i, strand] of STRANDS.entries()) {
    for (const [ply, material] of [cord, cordDark].entries()) {
      const path = strandPath(shape, top - span * strand.back, span * strand.drop, ply * Math.PI, EASE + i * 0.006);
      add(pushOut(new TubeGeometry(new CatmullRomCurve3(path, true), POINTS, PLY, 6, true), shape, EASE * 0.5), material, 'cord');
    }
  }

  // The brooch on the lowest strand, and its chain.
  const lowest = STRANDS[STRANDS.length - 1];
  const hold = strandPoint(shape, top - span * lowest.back, span * lowest.drop, BROOCH_ANGLE, EASE + 0.03);
  const n = outward(shape, hold.x, hold.z);
  const facing = Math.atan2(n.x, n.z);
  const place = (g: BufferGeometry, down: number, lift: number): BufferGeometry =>
    onSurface(g.rotateY(facing).translate(hold.x + n.x * lift, hold.y - down, hold.z + n.z * lift), shape, EASE + lift);
  add(place(new TorusGeometry(BROOCH, 0.011, 10, 44), 0, 0.01), steel, 'brooch');
  add(place(new TorusGeometry(BROOCH * 0.62, 0.005, 8, 36), 0, 0.014), steel, 'brooch');
  const core = add(place(new SphereGeometry(BROOCH * 0.5, 24, 16).scale(1, 1, 0.45), 0, 0.016), light, 'brooch-core');
  const chain = new Group();
  chain.name = 'chain';
  chain.position.set(hold.x, hold.y - BROOCH, hold.z);
  group.add(chain);
  for (let k = 0; k < LINKS; k++) {
    const link = new TorusGeometry(LINK, 0.006, 8, 24).scale(0.8, 1.25, 1);
    if (k % 2) link.rotateY(Math.PI / 2);
    link.rotateY(facing).translate(hold.x + n.x * 0.014, hold.y - BROOCH - LINK * 1.1 - k * LINK * 1.75, hold.z + n.z * 0.014);
    onSurface(link, shape, EASE + 0.012).translate(-chain.position.x, -chain.position.y, -chain.position.z);
    chain.add(Object.assign(new Mesh(link, steel), { name: 'link' }));
  }

  function update(frame: PartFrame): void {
    const a = frame.motion.amplitude;
    // The chain swings from the brooch; only sideways and outward, never into the chest.
    chain.rotation.z = Math.sin(frame.time * 1.9) * 0.05 * a;
    chain.rotation.x = -Math.abs(Math.sin(frame.time * 1.3)) * 0.03 * a;
    light.opacity = 0.72 + 0.28 * Math.sin(frame.time * 2.6);
    core.scale.setScalar(1 + 0.04 * Math.sin(frame.time * 2.6));
  }
  return { group, update, dispose: () => disposeTree(group) };
}

/** Where a strand is at `angle` round the neck: on the neck's ring at its height there, `ease` off it. */
function strandPoint(shape: BodyShape, back: number, drop: number, angle: number, ease: number): Vector3 {
  // Lowest at the front (angle 0), level with `back` behind.
  const y = back - drop * (0.5 + 0.5 * Math.cos(angle)) ** 1.5;
  const r = Math.max(radiusAt(shape, y), radiusAt(shape, back));
  const [x, z] = crossSection(angle, r + ease, r * shape.depth + ease, shape.squareness);
  return new Vector3(x, y, z);
}

/** One ply of a strand: the strand's path with the ply winding round it (`phase` sets which ply). */
function strandPath(shape: BodyShape, back: number, drop: number, phase: number, ease: number): Vector3[] {
  return Array.from({ length: POINTS }, (_, i) => {
    const angle = (i / POINTS) * Math.PI * 2;
    const p = strandPoint(shape, back, drop, angle, ease + WIND);
    const out = outward(shape, p.x, p.z);
    const wind = angle * TWISTS + phase;
    return p.add(out.multiplyScalar(Math.cos(wind) * WIND)).add(new Vector3(0, Math.sin(wind) * WIND, 0));
  });
}
