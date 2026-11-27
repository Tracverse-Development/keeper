/**
 * Bangles (slot `wrist`, humans): worn round the left wrist the body publishes, like the Trail Watch.
 *
 * Pattern: Adapter. Every ring is the wrist's own ring (`fit.ts`: the shape's radius at the anchor)
 * plus a little ease, so the same bangles fit a man's wrist, a woman's and the God Keeper's. They
 * ride the arm bone, so they swing and wave with the arm.
 *
 * Styles (`style`, a whole number):
 *  0 stacked bead bracelets: three strands of round beads, alternating `color`, `trim` and cream,
 *    each strand turned a little so the beads never line up.
 *  1 jewelled arm band: a broad polished band in `trim` set with faceted jewels in `color` that
 *    twinkle in turn (how brightly: `glow`), brighter as the keeper works.
 *
 * Effects: `color` (beads, jewels), `trim` (the second bead, the band), `glow` (sparkle), `style`.
 */
import { Color, CylinderGeometry, Group, Mesh, MeshPhysicalMaterial, OctahedronGeometry, SphereGeometry, TorusGeometry } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { trimMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { radiusAt, type PartFit } from '../fit.ts';
import type { PartFrame, PartInstance } from '../part';

/** Bead strands: their heights along the arm and the bead size over the wrist radius. */
const STRANDS = [0.032, 0, -0.032] as const;
const BEAD = 0.16;
const CREAM = 0xf4eee2;
/** The band's half-height, how far it stands off the wrist, and its jewels. */
const BAND_HALF = 0.04;
const BAND_EASE = 0.008;
const JEWELS = 7;

export function createBangles(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'bangles';
  if (!fit.shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };
  const wrist = radiusAt(fit.shape, 0) || 0.1;
  const colour = effectColour(effects, 'color');
  const trimColour = effectColour(effects, 'trim');
  const glow = effectNumber(effects, 'glow');
  const style = Math.round(Math.min(Math.max(effectNumber(effects, 'style'), 0), 1));
  const twinkles: MeshPhysicalMaterial[] = [];

  if (style === 0) {
    const bead = new SphereGeometry(1, 12, 8);
    const looks = [colour, trimColour, CREAM].map((c) => new MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 0.8, emissive: new Color(c), emissiveIntensity: 0.05 * glow }));
    const size = wrist * BEAD;
    const ring = wrist + size + 0.003;
    const count = Math.floor((Math.PI * 2 * ring) / (size * 2.05));
    STRANDS.forEach((y, s) => {
      for (let i = 0; i < count; i++) {
        const a = ((i + s * 0.5) / count) * Math.PI * 2;
        const b = new Mesh(bead, looks[(i + s) % looks.length]);
        b.scale.setScalar(size);
        b.position.set(Math.sin(a) * ring, y, Math.cos(a) * ring);
        group.add(b);
      }
    });
  } else {
    const r = wrist + BAND_EASE;
    const band = new Mesh(new CylinderGeometry(r, r, BAND_HALF * 2, 40, 1, true), trimMaterial(trimColour));
    group.add(band);
    for (const y of [BAND_HALF, -BAND_HALF]) {
      const lip = new Mesh(new TorusGeometry(r, 0.006, 8, 40), trimMaterial(trimColour));
      lip.rotation.x = Math.PI / 2;
      lip.position.y = y;
      group.add(lip);
    }
    const jewel = new OctahedronGeometry(wrist * 0.17, 0);
    for (let i = 0; i < JEWELS; i++) {
      const a = (i / JEWELS) * Math.PI * 2;
      const material = new MeshPhysicalMaterial({ color: colour, roughness: 0.05, metalness: 0.1, clearcoat: 1, emissive: new Color(colour), emissiveIntensity: 0.4 * glow });
      twinkles.push(material);
      const j = new Mesh(jewel, material);
      j.scale.set(1, 1.3, 0.55);
      j.position.set(Math.sin(a) * (r + wrist * 0.1), 0, Math.cos(a) * (r + wrist * 0.1));
      j.rotation.y = a;
      group.add(j);
    }
  }

  return {
    group,
    pivotY: 0,
    update(frame: PartFrame) {
      twinkles.forEach((m, i) => {
        // Each jewel catches the light in turn.
        const flash = Math.max(0, Math.sin(frame.time * 2.4 - i * 0.9)) ** 6;
        m.emissiveIntensity = glow * (0.35 + 1.6 * flash) * (1 + 0.6 * frame.work);
      });
    },
    dispose: () => disposeTree(group),
  };
}
