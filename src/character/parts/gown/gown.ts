/**
 * The Gown kit (slot `torso`, and it covers the legs: `kit-parts.ts` `COVERS`): a floor-length
 * gown with a fitted bodice and a skirt that flares from the waist and falls on below the torso,
 * as far again as the torso is tall (on a person, to the tops of the shoes), with a soft shimmer.
 *
 * Pattern: Adapter. It reads the torso's published shape (`fit.ts`), never the species: the bodice
 * follows the body's rings with a little ease from the neckline to the waist (the narrowest point
 * below the widest, `garment.ts` `waistOf`); from there the skirt keeps the body's ease wherever
 * the body is wider (a skirt built into the woman's body, a robe) and otherwise flares out at
 * SKIRT_FLARE per unit of drop, down to `hemOf` (`longRings`). Gold trim runs round the neckline,
 * the waist and the hem; two thin straps rise over the shoulders; a scatter of tiny sparkles on the
 * skirt glints with the shimmer.
 *
 * Effects: `color` (the silk), `trim` (neckline, sash, hem, straps and sparkles), `glow` (the
 * shimmer: the silk's own sheen and how bright the sparkles glint). The skirt sways softly with the
 * breath, more toward the hem, always outward.
 */
import { Color, DoubleSide, Group, Mesh, MeshPhysicalMaterial, Vector3, type BufferGeometry, type Material } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { clothMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { crossSection, radiusAt, type GarmentRing, type PartFit } from '../fit.ts';
import { fittedShell, piping, ringPoints } from '../fitted-shell.ts';
import { garmentSway, glowTrim, hemOf, longRings, outward, pushOut, scatterQuads, waistOf } from '../garment.ts';
import { necklineOf } from '../jacket/jacket.ts';
import type { PartFrame, PartInstance } from '../part';

const EASE = 0.04;
const RINGS = 40;
const SEGMENTS = 72;
/** How fast the skirt widens below the waist (half-width per unit of drop), and how far it falls. */
const SKIRT_FLARE = 0.42;
const HEM_DROP = 1;
const PIPING = 0.012;
const SWAY = 0.022;
const SPARKLES = 140;
const SPARKLE_SIZE = 0.022;
/** The neckline sits this far lower than a jacket's (a gown shows the collarbones). */
const NECK_DROP = 0.05;

export function createGown(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'gown';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };

  const colour = effectColour(effects, 'color');
  const glow = effectNumber(effects, 'glow');
  const silk = clothMaterial(colour, 0.42);
  Object.assign(silk, { sheen: 1, sheenRoughness: 0.3, emissive: new Color(colour), emissiveIntensity: 0.06 * glow });
  const trim = glowTrim(effectColour(effects, 'trim'), glow * 0.4);
  const add = (geometry: BufferGeometry, material: Material, name: string) => group.add(Object.assign(new Mesh(pushOut(geometry, shape, 0.004), material), { name }));

  const top = necklineOf(shape) - NECK_DROP;
  const waistY = waistOf(shape);
  const hem = hemOf(shape, HEM_DROP);
  const rings = longRings(shape, top, hem, EASE, RINGS, radiusAt(shape, waistY) + EASE, SKIRT_FLARE);
  const geometry = fittedShell(rings, { segments: SEGMENTS, opening: 0, squareness: shape.squareness });
  add(geometry, silk, 'gown-shell');

  const around = (ring: GarmentRing, by: number) => piping(ringPoints({ y: ring.y, rx: ring.rx + by, rz: ring.rz + by }, shape.squareness, 0, Math.PI * 2, 72), PIPING, true);
  const waistRing = rings.reduce((best, r) => (Math.abs(r.y - waistY) < Math.abs(best.y - waistY) ? r : best), rings[0]);
  add(around(rings[0], PIPING * 0.6), trim, 'gown-neckline');
  add(around(waistRing, PIPING), trim, 'gown-sash');
  add(around(rings[rings.length - 1], PIPING * 0.6), trim, 'gown-hem');

  // Two straps from the neckline over the shoulders to the back, following the body upward.
  for (const side of [1, -1]) {
    const strap: Vector3[] = [];
    const crown = shape.profile[0][1];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12; // 0 at the front neckline, 1 at the back
      const y = top + (crown - top) * 0.45 * Math.sin(Math.PI * u);
      const r = radiusAt(shape, y);
      const [x, z] = crossSection(side * 0.5 + side * (Math.PI - 1) * u, r + EASE, r * shape.depth + EASE, shape.squareness);
      strap.push(new Vector3(x, y, z));
    }
    add(piping(strap, PIPING * 0.8), trim, 'gown-strap');
  }

  // Sparkles scattered over the skirt.
  const sparkle = new MeshPhysicalMaterial({ color: effectColour(effects, 'trim'), emissive: new Color(effectColour(effects, 'trim')), emissiveIntensity: glow, metalness: 0.9, roughness: 0.15, side: DoubleSide });
  const skirt = rings.filter((r) => r.y < waistY);
  const pieces = Array.from({ length: SPARKLES }, (_, i) => {
    const ring = skirt[Math.floor(((i * 0.618034) % 1) * skirt.length)];
    const angle = (i * 2.399963) % (Math.PI * 2);
    const [x, z] = crossSection(angle, ring.rx + 0.004, ring.rz + 0.004, shape.squareness);
    return { at: new Vector3(x, ring.y, z), normal: outward(shape, x, z), spin: i };
  });
  if (pieces.length > 0) add(scatterQuads(pieces, SPARKLE_SIZE), sparkle, 'gown-sparkles');

  const sway = garmentSway(geometry, waistY, hem, SWAY);
  function update(frame: PartFrame): void {
    sway(frame);
    sparkle.emissiveIntensity = glow * (0.55 + 0.45 * Math.sin(frame.time * 2.3));
  }
  return { group, update, dispose: () => disposeTree(group) };
}
