/**
 * Shoes (slot `paws`, shown as Feet; any body with feet): one shoe on every foot the body
 * publishes, from a person's two feet to a dog's four paws and an owl's talons.
 *
 * Pattern: Adapter. The part reads the feet (`BodyShape.feet`: an ellipsoid per foot, `fit.ts`),
 * never the species. Every shoe is built round its own foot on a LAST (`shoe-last.ts`): an upper
 * lofted heel to toe (a narrow heel, a wide ball, a round or pointed toe, a heel counter, a throat
 * left open where the foot goes in), a flat SOLE with toe spring under it, and the style's details
 * on the upper's surface (a toe cap, eyelets and criss-cross laces, straps, a shaft round the ankle,
 * a real heel). Nothing is smaller than the foot plus ease, so nothing sinks in.
 * When the live foot joints are given (`PartFit.follow`) each shoe follows its joint every frame,
 * as the Nail Set does (the dog's waving front paw); without them they rest in place.
 *
 * Styles (`style`, a whole number):
 *  0 low canvas sneaker: an open throat with a padded collar, a rubber toe cap and heel counter, a
 *    tongue, eyelets and criss-cross laces with a bow, a thick sole with toe spring.
 *  1 high-top: the sneaker with a shaft round the ankle and a padded top.
 *  2 lace-up trail boot: leather, a toe cap, laces, a tall shaft, a lugged sole and a heel block.
 *  3 polished oxford: a slim glossy last, a thin sole, a heel block, laces over a tongue.
 *  4 sandal: a sole with toe spring, three straps over the foot and one round the heel.
 *  5 slim heel: a pointed glossy pump with a wide throat, a slim heel post and an ankle strap.
 *  6 soft booties: a puffy closed last with a padded cuff (made for a dog's paws, fits any foot).
 *  7 slipper socks: soft knit, a thick cuff, grip dots under a thin sole.
 *
 * Effects: `color` (the upper), `trim` (the sole and details), `style`.
 */
import { BoxGeometry, CatmullRomCurve3, Color, CylinderGeometry, DoubleSide, Group, Matrix4, Mesh, MeshPhysicalMaterial, SphereGeometry, TorusGeometry, TubeGeometry, Vector3, type BufferGeometry, type Material } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { clothMaterial, trimMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import type { Foot, PartFit } from '../fit.ts';
import type { PartFrame, PartInstance } from '../part';
import { point, section, soleGeometry, span, throatRim, tongueGeometry, upperGeometry, type Last, type LastSpec } from './shoe-last.ts';

const STYLE = { sneaker: 0, highTop: 1, boot: 2, oxford: 3, sandal: 4, heel: 5, bootie: 6, sock: 7 } as const;
/** The upper stands this far off the foot (a share of the foot's smallest radius, at least MIN_EASE). */
const EASE = 0.14;
const MIN_EASE = 0.008;
/** The puffy bootie and the sock stand further off. */
const PUFF = 0.26;
/** The sole's thickness over the foot's height, by style. */
const SOLE = [0.3, 0.32, 0.42, 0.14, 0.2, 0.1, 0.16, 0.07] as const;
/** A shaft's height over the foot's height (high-top, boot). */
const SHAFT = { highTop: 1.0, boot: 1.5 } as const;
const LACE = 0xf4eee2;

/** Each style's last (`shoe-last.ts` `LastSpec`). */
const LASTS: readonly LastSpec[] = [
  { toe: 0.14, heel: 0.04, width: 1.04, point: 1, counter: 0.95, toeHeight: 0.62, throatEnd: 0.62, throat: 0.95, box: 2.6, spring: 0.28 },
  { toe: 0.14, heel: 0.04, width: 1.04, point: 1, counter: 1.0, toeHeight: 0.62, throatEnd: 0.6, throat: 0.85, box: 2.6, spring: 0.28 },
  { toe: 0.16, heel: 0.06, width: 1.08, point: 1, counter: 1.0, toeHeight: 0.7, throatEnd: 0.58, throat: 0.8, box: 2.8, spring: 0.3 },
  { toe: 0.2, heel: 0.04, width: 0.98, point: 1.6, counter: 0.85, toeHeight: 0.5, throatEnd: 0.6, throat: 0.75, box: 2.4, spring: 0.22 },
  { toe: 0.12, heel: 0.04, width: 1.02, point: 1, counter: 0.6, toeHeight: 0.4, throatEnd: 0, throat: 0, box: 2.4, spring: 0.2 },
  { toe: 0.3, heel: 0.02, width: 0.94, point: 2.8, counter: 0.7, toeHeight: 0.38, throatEnd: 0.74, throat: 1.35, box: 2.2, spring: 0.12 },
  { toe: 0.06, heel: 0.04, width: 1.1, point: 1, counter: 1.1, toeHeight: 0.85, throatEnd: 0.4, throat: 0.6, box: 2.2, spring: 0.1 },
  { toe: 0.04, heel: 0.03, width: 1.02, point: 1, counter: 1.0, toeHeight: 0.8, throatEnd: 0.45, throat: 0.7, box: 2.2, spring: 0.06 },
];

export function createShoes(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'shoes';
  const feet = fit.shape?.feet ?? [];
  const style = Math.round(Math.min(Math.max(effectNumber(effects, 'style'), 0), 7));
  const colour = effectColour(effects, 'color');
  const trimColour = effectColour(effects, 'trim');
  const upper = materialFor(style, colour);
  const trim = style === STYLE.oxford || style === STYLE.heel ? glossy(trimColour) : trimMaterial(trimColour);
  const soleMaterial = new MeshPhysicalMaterial({ color: trimColour, roughness: 0.7 });
  const lace = clothMaterial(LACE, 0.8);
  const inside = new MeshPhysicalMaterial({ color: new Color(colour).multiplyScalar(0.35), roughness: 0.9 });

  const holders = feet.map((foot, i) => {
    const holder = new Group();
    holder.name = `shoe-${i}`;
    holder.position.set(...foot.position);
    buildShoe(holder, foot, style, { upper, trim, sole: soleMaterial, lace, inside });
    group.add(holder);
    return holder;
  });

  const follow = fit.follow;
  const inverse = new Matrix4();
  function update(_frame: PartFrame): void {
    if (!follow || follow.feet.length !== holders.length) return;
    follow.base.updateWorldMatrix(true, false);
    inverse.copy(follow.base.matrixWorld).invert();
    for (let i = 0; i < holders.length; i++) {
      const joint = follow.feet[i];
      joint.updateWorldMatrix(true, false);
      holders[i].matrixAutoUpdate = false;
      holders[i].matrix.multiplyMatrices(inverse, joint.matrixWorld);
      holders[i].matrixWorldNeedsUpdate = true;
    }
  }
  return { group, update, dispose: () => disposeTree(group) };
}

interface Materials {
  readonly upper: Material;
  readonly trim: Material;
  readonly sole: Material;
  readonly lace: Material;
  /** The lining seen through the throat. */
  readonly inside: Material;
}

function materialFor(style: number, colour: number): Material {
  const m = style === STYLE.oxford || style === STYLE.heel
    ? glossy(colour)
    : style === STYLE.boot
      ? new MeshPhysicalMaterial({ color: colour, roughness: 0.6, clearcoat: 0.3, sheen: 0.3, sheenColor: new Color(colour) })
      : clothMaterial(colour, style === STYLE.sock || style === STYLE.bootie ? 0.9 : 0.82);
  m.side = DoubleSide;
  return m;
}

function glossy(colour: number): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({ color: colour, roughness: 0.25, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 });
}

/** One shoe round `foot`, in the foot's own space (its centre at the origin, the toe toward +z). */
function buildShoe(holder: Group, foot: Foot, style: number, m: Materials): void {
  const [, ry] = foot.radii;
  const small = Math.min(...foot.radii);
  const puffy = style === STYLE.bootie || style === STYLE.sock;
  const last: Last = { foot, ease: Math.max(small * (puffy ? PUFF : EASE), MIN_EASE), spec: LASTS[style] };
  const add = (geometry: BufferGeometry, material: Material, name: string): Mesh => {
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    holder.add(mesh);
    return mesh;
  };
  const sole = ry * SOLE[style];
  add(soleGeometry(last, sole, style === STYLE.sock ? 1.01 : 1.06), style === STYLE.sock ? m.upper : m.sole, 'shoe-sole');
  if (style !== STYLE.sandal) add(upperGeometry(last), m.upper, 'shoe-upper');
  const tube = Math.max(small * 0.085, 0.004);

  switch (style) {
    case STYLE.sneaker:
    case STYLE.highTop:
      add(upperGeometry(last, 0.86, 1, tube * 0.4), m.sole, 'shoe-toe-cap');
      add(upperGeometry(last, 0, 0.14, tube * 0.4), m.trim, 'shoe-counter');
      laces(holder, last, 4, m.lace, m.trim, tube);
      if (style === STYLE.highTop) shaft(holder, last, SHAFT.highTop, m, tube);
      else collar(holder, last, m.trim, tube * 1.4);
      break;
    case STYLE.boot:
      add(upperGeometry(last, 0.82, 1, tube * 0.6), m.trim, 'shoe-toe-cap');
      laces(holder, last, 4, m.trim, m.trim, tube);
      shaft(holder, last, SHAFT.boot, m, tube);
      lugs(holder, last, sole, m.sole);
      heelBlock(holder, last, sole * 0.6, 0.24, m.sole);
      break;
    case STYLE.oxford:
      add(upperGeometry(last, 0.84, 1, tube * 0.4), m.upper, 'shoe-toe-cap');
      laces(holder, last, 3, m.lace, m.upper, tube * 0.8);
      collar(holder, last, m.upper, tube);
      heelBlock(holder, last, sole * 1.6, 0.26, m.sole);
      break;
    case STYLE.sandal:
      for (const t of [0.86, 0.62, 0.34]) strap(holder, last, t, m.trim, tube * 1.6);
      heelStrap(holder, last, m.trim, tube * 1.4);
      break;
    case STYLE.heel:
      collar(holder, last, m.trim, tube);
      stiletto(holder, last, m.trim);
      ankleStrap(holder, last, m.trim, tube);
      break;
    case STYLE.bootie:
    case STYLE.sock:
      collar(holder, last, style === STYLE.sock ? m.upper : m.trim, tube * 3);
      if (style === STYLE.sock) dots(holder, last, sole, m.trim);
      break;
  }
}

/** Piping round the throat's rim (a padded collar). */
function collar(holder: Group, last: Last, material: Material, radius: number): void {
  const rim = throatRim(last, radius * 0.6);
  if (rim.length < 3) return;
  holder.add(Object.assign(new Mesh(new TubeGeometry(new CatmullRomCurve3(rim), rim.length * 3, radius, 8, false), material), { name: 'shoe-collar' }));
}

/**
 * A tongue over the throat, eyelets either side of it and laces criss-crossing between them over the
 * tongue, with a bow at the top pair.
 */
function laces(holder: Group, last: Last, count: number, lace: Material, eyelet: Material, tube: number): void {
  const end = last.spec.throatEnd;
  const from = end * 0.5;
  holder.add(Object.assign(new Mesh(tongueGeometry(last, from, end + 0.04, tube * 0.4), lace === eyelet ? lace : holderUpper(holder)), { name: 'shoe-tongue' }));
  const closed: Last = { ...last, spec: { ...last.spec, throat: 0 } };
  const pairs: [Vector3, Vector3][] = [];
  const tops: Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const t = from + (end - from) * (0.08 + (0.88 * i) / Math.max(count - 1, 1));
    const sec = section(last, t);
    const phi = Math.max(sec.open, 0.32) + 0.1;
    pairs.push([point(sec, phi, last.spec.box, tube), point(sec, Math.PI * 2 - phi, last.spec.box, tube)]);
    tops.push(point(section(closed, t), 0, last.spec.box, tube * 2.2));
  }
  const ring = new TorusGeometry(tube * 1.5, tube * 0.5, 6, 12);
  for (const [a, b] of pairs) {
    for (const p of [a, b]) {
      const e = new Mesh(ring, eyelet);
      e.position.copy(p);
      e.lookAt(p.clone().multiplyScalar(2));
      e.name = 'shoe-eyelet';
      holder.add(e);
    }
  }
  // Criss-cross: each eyelet to the opposite one of the next pair, over the tongue's top between them.
  for (let i = 0; i < pairs.length - 1; i++) {
    const over = tops[i].clone().add(tops[i + 1]).multiplyScalar(0.5);
    for (const [a, b] of [[pairs[i][0], pairs[i + 1][1]], [pairs[i][1], pairs[i + 1][0]]]) {
      holder.add(Object.assign(new Mesh(new TubeGeometry(new CatmullRomCurve3([a, over, b]), 10, tube * 0.7, 6, false), lace), { name: 'shoe-lace' }));
    }
  }
  // A bow over the top pair.
  const knot = tops[0].clone();
  knot.y += tube * 1.5;
  for (const side of [-1, 1]) {
    const loop = new Mesh(new TorusGeometry(tube * 3, tube * 0.6, 6, 14), lace);
    loop.position.copy(knot).add(new Vector3(side * tube * 3, tube * 2, 0));
    loop.rotation.set(-0.6, side * 0.5, 0);
    loop.name = 'shoe-lace';
    holder.add(loop);
  }
}

/** The upper's material, read from the shoe already built in `holder` (the tongue matches the upper). */
function holderUpper(holder: Group): Material {
  const upper = holder.children.find((c) => c.name === 'shoe-upper') as Mesh | undefined;
  return (upper?.material as Material | undefined) ?? new MeshPhysicalMaterial();
}

/** A shaft rising round the ankle from the throat, with a padded collar at its top. */
function shaft(holder: Group, last: Last, height: number, m: Materials, tube: number): void {
  const rim = throatRim(last, 0);
  if (rim.length < 3) return;
  const centre = rim.reduce((c, p) => c.add(p), new Vector3()).multiplyScalar(1 / rim.length);
  const rx = Math.max(...rim.map((p) => Math.abs(p.x - centre.x))) + tube;
  const rz = Math.max(...rim.map((p) => Math.abs(p.z - centre.z))) * 0.8 + tube;
  const base = Math.max(Math.min(...rim.map((p) => p.y)), clearAt(last, centre, rx, rz));
  const h = last.foot.radii[1] * height;
  const wall = new CylinderGeometry(1, 1.04, h, 36, 3, true);
  const mesh = new Mesh(wall, m.upper);
  mesh.scale.set(rx, 1, rz);
  mesh.position.set(centre.x, base + h / 2, centre.z);
  mesh.name = 'shoe-shaft';
  holder.add(mesh);
  const pad = new Mesh(new TorusGeometry(1, tube * 2.2 / Math.max(rx, rz), 8, 36), m.trim);
  pad.rotation.x = Math.PI / 2;
  pad.scale.set(rx, rz, Math.max(rx, rz));
  pad.position.set(centre.x, base + h, centre.z);
  pad.name = 'shoe-collar';
  holder.add(pad);
}

/**
 * The lowest height (foot space) a ring of half-widths `rx`, `rz` round `centre` stands outside the
 * foot's ellipsoid at every point: where a shaft round the ankle may begin.
 */
function clearAt(last: Last, centre: Vector3, rx: number, rz: number): number {
  const [fx, fy, fz] = last.foot.radii;
  let least = Infinity;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    least = Math.min(least, ((centre.x + rx * Math.sin(a)) / fx) ** 2 + ((centre.z + rz * Math.cos(a)) / fz) ** 2);
  }
  return least >= 1 ? -Infinity : fy * Math.sqrt(1 - least) + last.ease * 0.5;
}

/** A strap over the foot at `t`: an arc of the section over the top, standing just off the foot. */
function strap(holder: Group, last: Last, t: number, material: Material, tube: number): void {
  const sec = section(last, t);
  const points = Array.from({ length: 17 }, (_, i) => point(sec, -1.9 + (3.8 * i) / 16, last.spec.box, tube));
  holder.add(Object.assign(new Mesh(new TubeGeometry(new CatmullRomCurve3(points), 32, tube, 8, false), material), { name: 'shoe-strap' }));
}

/** The sandal's strap round the back of the heel, at the foot's middle height, standing off the foot. */
function heelStrap(holder: Group, last: Last, material: Material, tube: number): void {
  const [fx, , fz] = last.foot.radii;
  const points: Vector3[] = [];
  // A half ellipse round the heel at height 0, from one side (a third of the way to the toe) to the other.
  for (let i = 0; i <= 16; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 16;
    points.push(new Vector3(-(fx + last.ease + tube) * Math.sin(a), 0, -(fz + last.ease + tube) * Math.cos(a) * 0.9 - fz * 0.1));
  }
  holder.add(Object.assign(new Mesh(new TubeGeometry(new CatmullRomCurve3(points), 32, tube, 8, false), material), { name: 'shoe-strap' }));
}

/** A heel block under the back of the sole, `height` deep, covering `share` of the length. */
function heelBlock(holder: Group, last: Last, height: number, share: number, material: Material): void {
  const [back, front] = span(last);
  const sec = section(last, share / 2);
  const bottom = sec.yc - sec.hh - last.foot.radii[1] * SOLE[STYLE.oxford];
  const block = new Mesh(new BoxGeometry(sec.w * 1.7, height, (front - back) * share), material);
  block.position.set(0, bottom - height / 2, back + ((front - back) * share) / 2);
  block.name = 'shoe-heel';
  holder.add(block);
}

/** The slim heel: a tapering post under the back of the shoe. */
function stiletto(holder: Group, last: Last, material: Material): void {
  const [back] = span(last);
  const sec = section(last, 0.08);
  const small = Math.min(...last.foot.radii);
  const h = last.foot.radii[1] * 1.0;
  const post = new Mesh(new CylinderGeometry(small * 0.16, small * 0.07, h, 14), material);
  post.position.set(0, sec.yc - sec.hh - h / 2, back + small * 0.35);
  post.rotation.x = 0.12;
  post.name = 'shoe-heel';
  holder.add(post);
}

/** A thin strap round the ankle, above the throat. */
function ankleStrap(holder: Group, last: Last, material: Material, tube: number): void {
  const rim = throatRim(last, tube);
  if (rim.length < 3) return;
  const centre = rim.reduce((c, p) => c.add(p), new Vector3()).multiplyScalar(1 / rim.length);
  const radius = Math.max(...rim.map((p) => Math.hypot(p.x - centre.x, (p.z - centre.z) * 0.7))) * 0.75;
  const ring = new Mesh(new TorusGeometry(radius, tube, 8, 32), material);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(centre.x, Math.max(...rim.map((p) => p.y)) + tube * 3, centre.z);
  ring.name = 'shoe-strap';
  holder.add(ring);
}

/** Chunky lugs under the boot's sole. */
function lugs(holder: Group, last: Last, sole: number, material: Material): void {
  for (let i = 0; i < 6; i++) {
    const sec = section(last, 0.12 + (i * 0.76) / 5);
    const lug = new Mesh(new BoxGeometry(sec.w * 1.6, sole * 0.35, sole * 0.5), material);
    lug.position.set(0, sec.yc - sec.hh - sole * 1.02, sec.z);
    lug.name = 'shoe-lug';
    holder.add(lug);
  }
}

/** Grip dots under the sock's sole. */
function dots(holder: Group, last: Last, sole: number, material: Material): void {
  const dot = new SphereGeometry(1, 8, 6);
  for (let i = 1; i < 6; i++) {
    const sec = section(last, i / 6);
    for (const x of [-0.45, 0, 0.45]) {
      const d = new Mesh(dot, material);
      d.scale.set(sec.w * 0.12, sole * 0.5, sec.w * 0.12);
      d.position.set(x * sec.w, sec.yc - sec.hh - sole * 0.85, sec.z);
      d.name = 'shoe-dot';
      holder.add(d);
    }
  }
}
