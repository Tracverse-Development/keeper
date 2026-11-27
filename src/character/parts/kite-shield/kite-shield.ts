/**
 * The Kite Shield (slot `back`, any species with a back; the robot's Ark Sentinel set): a tall kite
 * shield slung on the back, its face bowed outward. A navy field with a gilt rim and a ring of
 * studs inside it; on the field the ark and its waves in light under a small gilt boss; the shield
 * hangs on a diagonal baldric strap that crosses the body, and a short belt round the waist steadies
 * its foot. The mark breathes brighter as the keeper works and flares when a reply arrives.
 *
 * Pattern: Adapter (like the Trail Pack): its size and place come from the torso's published shape
 * (`fit.ts`); the shield stands just behind the deepest point of the back it covers (outside a
 * jacket too) and both straps are cut to the body, so it is held on a robot's spirit, a person's
 * back and the dog's pear the same way, with no arms needed.
 *
 * Effects: `color` (the field), `trim` (the gilt), `light` (the mark) and `glow` (its strength).
 */
import { CatmullRomCurve3, Color, ExtrudeGeometry, Group, MeshPhysicalMaterial, Shape, SphereGeometry, TubeGeometry, Vector2, Vector3, type BufferGeometry, type Material } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { crossSection, radiusAt, surfaceDepth, type BodyShape, type PartFit } from '../fit.ts';
import { pushOut } from '../garment.ts';
import { lightMaterial, metalMaterial } from '../glow-kit.ts';
import { leatherMaterial } from '../leather.ts';
import { arkMark, shieldOutline } from '../ark-emblem.ts';
import { keepColour, meshAdder, merged } from '../detail-kit.ts';
import type { PartFrame, PartInstance } from '../part';

/** The shield stands this far off the back; the straps this far off the body. */
const EASE = 0.09;
const STRAP_EASE = 0.06;
const STRAP = 0.02;
/** Size against the body: width (share of the half-width at its centre, clamped), height (share of the reach). */
const WIDTH_SHARE = 1.05;
const HEIGHT_SHARE = 1.0;
/** How far the face bows out at its middle (share of the width) and the board's thickness. */
const BOW = 0.14;
const THICK = 0.035;
const STUDS = 16;

export function createKiteShield(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'kite-shield';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };

  const fieldColour = new Color(effectColour(effects, 'color'));
  const field = keepColour(new MeshPhysicalMaterial({ color: fieldColour, metalness: 0.3, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.6 }));
  const gilt = metalMaterial(effectColour(effects, 'trim'), 0.22, 0.06);
  const glow = effectNumber(effects, 'glow');
  const light = lightMaterial(effectColour(effects, 'light'), 1.6 * glow);
  const strap = leatherMaterial(0x3a2414, 0.5);
  const add = meshAdder(group);

  // Where it hangs: centred low on the back, as tall as the torso allows.
  const y = shape.reach * 0.48;
  const height = Math.min(Math.abs(shape.reach) * HEIGHT_SHARE, 1.1);
  const width = Math.min(Math.max(radiusAt(shape, y) * WIDTH_SHARE, 0.4), 0.82);
  let back = 0;
  for (let i = 0; i <= 16; i++) back = Math.max(back, surfaceDepth(shape, y + height * (i / 16 - 0.5)));
  const z = -(back + EASE + width * BOW);

  // The board: the outline extruded, then bowed so its middle stands out from the body.
  const outline = shieldOutline(width, height, height * 0.04, 0.75);
  const board = new ExtrudeGeometry(new Shape(outline.map((p) => new Vector2(p.x, p.y))), { depth: THICK, bevelEnabled: true, bevelThickness: THICK * 0.3, bevelSize: THICK * 0.3, bevelSegments: 2, curveSegments: 8 });
  const bow = (g: BufferGeometry, lift = 0): BufferGeometry => {
    const position = g.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const u = position.getX(i) / (width / 2);
      // Turned half round (x and z both flip: a turn, not a mirror, so faces keep their winding) to
      // face away from the body: the shield's front at local z 0, its back at -THICK.
      position.setXYZ(i, -position.getX(i), y + position.getY(i), z - (position.getZ(i) + lift) + width * BOW * u * u);
    }
    g.computeVertexNormals();
    return g;
  };
  const pieces: [BufferGeometry, Material, string][] = [[bow(board.translate(0, 0, -THICK)), field, 'shield-board']];

  // The gilt rim round the edge, studs inside it, the boss and the ark in light.
  const rim = outline.map((p) => p.clone());
  pieces.push([bow(new TubeGeometry(new CatmullRomCurve3(rim, true), 200, THICK * 0.55, 8, true), THICK * 0.2), gilt, 'shield-rim']);
  const inset = shieldOutline(width * 0.84, height * 0.86, height * 0.03, 0.75, STUDS * 3);
  const studs = Array.from({ length: STUDS }, (_, k) => {
    const p = inset[Math.round((k * inset.length) / STUDS) % inset.length];
    return new SphereGeometry(width * 0.022, 10, 8).translate(p.x, p.y - height * 0.02, THICK * 0.5);
  });
  pieces.push([bow(merged(studs)), gilt, 'shield-studs']);
  const mark = arkMark(width * 0.62).translate(0, height * 0.02, THICK * 0.6);
  pieces.push([bow(mark), light, 'shield-mark']);
  pieces.push([bow(new SphereGeometry(width * 0.06, 16, 10).scale(1, 1, 0.6).translate(0, height * 0.3, THICK * 0.4)), gilt, 'shield-boss']);
  // The whole shield moves back together until no piece of it is nearer the body than EASE.
  const shift = needToClear(pieces.map(([g]) => g), shape, EASE);
  for (const [g, material, name] of pieces) add(g.translate(0, 0, -shift), material, name);

  // The baldric, diagonal round the body, and a waist belt steadying the shield's foot.
  add(strapRing(shape, y + height * 0.32, height * 0.22, 1), strap, 'shield-strap');
  add(strapRing(shape, y - height * 0.24, 0, 0), strap, 'shield-strap');

  return {
    group,
    update(frame: PartFrame) {
      light.opacity = Math.min(0.6 + 0.22 * Math.sin(frame.time * 1.6) + 0.3 * frame.work + 0.5 * frame.gotIt, 1);
    },
    dispose: () => disposeTree(group),
  };
}

/** How far the pieces must move straight back (away from the body) so every vertex stands `ease` behind it. */
function needToClear(geometries: readonly BufferGeometry[], shape: BodyShape, ease: number): number {
  let need = 0;
  for (const geometry of geometries) {
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const r = radiusAt(shape, position.getY(i));
      if (r <= 1e-6 || Math.abs(x) >= r) continue;
      const n = shape.squareness;
      const surface = r * shape.depth * (1 - Math.abs(x / r) ** n) ** (1 / n);
      need = Math.max(need, position.getZ(i) + surface + ease);
    }
  }
  return need;
}

/** A strap round the body, tilted by `tilt` (its height swings that much from one side to the other). */
function strapRing(shape: BodyShape, y: number, tilt: number, sides: number): BufferGeometry {
  const top = shape.profile[0][1] - 0.04;
  const points = Array.from({ length: 96 }, (_, i) => {
    const a = (i / 96) * Math.PI * 2;
    const h = Math.min(y + (sides ? tilt * Math.sin(a) : 0), top);
    const r = Math.max(radiusAt(shape, h), 0.05);
    const [x, zz] = crossSection(a, r + STRAP_EASE, r * shape.depth + STRAP_EASE, shape.squareness);
    return new Vector3(x, h, zz);
  });
  return pushOut(new TubeGeometry(new CatmullRomCurve3(points, true), 192, STRAP, 6, true), shape, STRAP_EASE * 0.6);
}
