/**
 * Shoes (slot `paws`, shown as Feet; any body with feet): one shoe on every foot the body
 * publishes, from a person's two feet to a dog's four paws and an owl's talons.
 *
 * Pattern: Adapter. The part reads the feet (`BodyShape.feet`: an ellipsoid per foot, `fit.ts`),
 * never the species. Every shoe is built round its own foot: an UPPER that is the foot's ellipsoid
 * with a little ease (so it never sinks in), a SOLE as a flat slab just under it, and the style's
 * details placed on the upper's surface (laces, straps, cuffs, a shaft rising round the ankle).
 * When the live foot joints are given (`PartFit.follow`) each shoe follows its joint every frame,
 * as the Nail Set does (the dog's waving front paw); without them they rest in place.
 *
 * Styles (`style`, a whole number):
 *  0 low canvas sneaker: cloth upper, thick sole and toe cap in `trim`, cream laces.
 *  1 high-top: the sneaker with a padded collar rising round the ankle and an ankle patch.
 *  2 lace-up trail boot: leather upper, a taller shaft, a chunky lugged sole in `trim`.
 *  3 polished oxford: glossy leather, a thin sole and a heel block, a lace panel.
 *  4 sandal: a sole in `trim` with three straps over the foot and a toe post (the foot shows).
 *  5 slim heel: a glossy pointed pump, a slim heel at the back and an ankle strap.
 *  6 soft booties: a puffy rounded bootie with a cuff (made for a dog's paws, fits any foot).
 *  7 slipper socks: soft knit with a ribbed cuff and grip dots under the sole in `trim`.
 *
 * Effects: `color` (the upper), `trim` (the sole and details), `style`.
 */
import { BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry, Group, Matrix4, Mesh, MeshPhysicalMaterial, SphereGeometry, TorusGeometry, TubeGeometry, Vector3, type Material } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { clothMaterial, trimMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import type { Foot, PartFit } from '../fit.ts';
import type { PartFrame, PartInstance } from '../part';

const STYLE = { sneaker: 0, highTop: 1, boot: 2, oxford: 3, sandal: 4, heel: 5, bootie: 6, sock: 7 } as const;
/** The upper stands this far off the foot (a share of the foot's smallest radius, at least MIN_EASE). */
const EASE = 0.12;
const MIN_EASE = 0.008;
/** The puffy bootie and the sock stand further off. */
const PUFF = 0.24;
/** The sole's thickness over the foot's height, by style. */
const SOLE = [0.32, 0.34, 0.45, 0.18, 0.22, 0.14, 0.18, 0.08] as const;
/** A shaft's height over the foot's height (high-top, boot), from where it leaves the upper. */
const SHAFT = { highTop: 1.1, boot: 1.7 } as const;
const LACE = 0xf4eee2;

interface Built {
  readonly sole: number;
}

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
  const sphere = new SphereGeometry(1, 32, 20);

  const holders = feet.map((foot, i) => {
    const holder = new Group();
    holder.name = `shoe-${i}`;
    holder.position.set(...foot.position);
    buildShoe(holder, foot, style, { upper, trim, sole: soleMaterial, lace, sphere });
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
  readonly sphere: SphereGeometry;
}

function materialFor(style: number, colour: number): Material {
  if (style === STYLE.oxford || style === STYLE.heel) return glossy(colour);
  if (style === STYLE.boot) return new MeshPhysicalMaterial({ color: colour, roughness: 0.6, clearcoat: 0.3, sheen: 0.3, sheenColor: new Color(colour) });
  if (style === STYLE.sock || style === STYLE.bootie) return clothMaterial(colour, 0.9);
  return clothMaterial(colour, 0.82);
}

function glossy(colour: number): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({ color: colour, roughness: 0.25, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 });
}

/** One shoe round `foot`, in the foot's own space (its centre at the origin). */
function buildShoe(holder: Group, foot: Foot, style: number, m: Materials): Built {
  const [rx, ry, rz] = foot.radii;
  const small = Math.min(rx, ry, rz);
  const puffy = style === STYLE.bootie || style === STYLE.sock;
  const e = Math.max(small * (puffy ? PUFF : EASE), MIN_EASE);
  const ux = rx + e;
  const uy = ry + e;
  const uz = rz + e;
  const sole = ry * SOLE[style];
  const add = (mesh: Mesh): Mesh => (holder.add(mesh), mesh);

  // The sole: a flat slab just under the upper's lowest point.
  const slab = add(new Mesh(new CylinderGeometry(1, 1, sole, 36), style === STYLE.sock ? m.upper : m.sole));
  slab.scale.set(ux * 1.04, 1, uz * 1.04);
  slab.position.y = -uy - sole / 2 + e * 0.5;
  if (style === STYLE.heel) {
    slab.scale.set(ux * 0.92, 1, uz * 0.98);
  }
  if (style !== STYLE.sock && style !== STYLE.heel) {
    // A welt round the sole's top edge: the line that makes an egg read as a shoe.
    const welt = add(new Mesh(new TorusGeometry(1, sole * 0.35 / Math.max(ux, uz), 8, 40), m.sole));
    welt.rotation.x = Math.PI / 2;
    welt.scale.set(ux * 1.04, uz * 1.04, Math.max(ux, uz));
    welt.position.y = slab.position.y + sole / 2;
  }

  if (style !== STYLE.sandal) {
    const shell = add(new Mesh(m.sphere, m.upper));
    shell.scale.set(ux, uy, uz * (style === STYLE.heel ? 1.08 : 1));
    if (style === STYLE.heel) shell.position.z = rz * 0.06;
  }

  switch (style) {
    case STYLE.sneaker:
    case STYLE.highTop:
      add(toeCap(ux, uy, uz, m));
      laces(holder, ux, uy, uz, 4, m.lace);
      if (style === STYLE.highTop) {
        shaft(holder, foot, e, SHAFT.highTop, m.upper, m.trim);
        const patch = add(new Mesh(m.sphere, m.trim));
        patch.scale.set(0.004, ry * 0.4, ry * 0.4);
        patch.position.set(ux * 0.99, uy * 0.45, -uz * 0.25);
      }
      break;
    case STYLE.boot:
      laces(holder, ux, uy, uz, 3, m.trim);
      shaft(holder, foot, e, SHAFT.boot, m.upper, m.trim);
      for (let i = 0; i < 5; i++) {
        const lug = add(new Mesh(new CylinderGeometry(1, 1, sole * 0.4, 6), m.sole));
        lug.scale.set(ux * 0.9, 1, uz * 0.08);
        lug.position.set(0, -uy - sole * 1.05 + e * 0.5, -uz * 0.7 + (i * uz * 1.4) / 4);
      }
      break;
    case STYLE.oxford: {
      laces(holder, ux, uy, uz, 3, m.lace);
      const heelBlock = add(new Mesh(new CylinderGeometry(1, 1, sole * 1.6, 24), m.sole));
      heelBlock.scale.set(ux * 0.7, 1, uz * 0.3);
      heelBlock.position.set(0, -uy - sole * 0.8 + e * 0.5, -uz * 0.62);
      break;
    }
    case STYLE.sandal:
      for (const at of [0.45, 0.05, -0.55]) holder.add(strap(ux, uy, uz, at, m.trim));
      {
        const post = add(new Mesh(new CylinderGeometry(small * 0.12, small * 0.12, uy * 0.7, 8), m.trim));
        post.position.set(-ux * 0.25, -uy * 0.6, uz * 0.93);
      }
      break;
    case STYLE.heel: {
      const heel = add(new Mesh(new CylinderGeometry(small * 0.16, small * 0.09, uy * 1.1, 12), m.trim));
      heel.position.set(0, -uy * 0.55, -uz * 1.06);
      holder.add(ankleStrap(foot, e, m.trim));
      break;
    }
    case STYLE.bootie:
    case STYLE.sock: {
      const cuff = add(new Mesh(new TorusGeometry(Math.max(ux, uz) * 0.55, small * 0.18, 10, 32), style === STYLE.sock ? m.upper : m.trim));
      cuff.rotation.x = Math.PI / 2;
      cuff.scale.set(ux / Math.max(ux, uz), uz / Math.max(ux, uz), 1);
      cuff.position.y = uy * 0.86;
      if (style === STYLE.sock) dots(holder, ux, uy, uz, sole, e, m.trim);
      break;
    }
  }
  return { sole };
}

/** A rounded toe cap: the lower front of the upper, a hair outside it. */
function toeCap(ux: number, uy: number, uz: number, m: Materials): Mesh {
  const cap = new Mesh(new SphereGeometry(1, 24, 12, Math.PI / 2 - 1.1, 2.2, Math.PI * 0.55, Math.PI * 0.4), m.sole);
  cap.scale.set(ux * 1.03, uy * 1.03, uz * 1.03);
  return cap;
}

/** `count` laces across the top of the upper, from the toe back. */
function laces(holder: Group, ux: number, uy: number, uz: number, count: number, material: Material): void {
  for (let i = 0; i < count; i++) {
    const z = uz * (0.42 - i * 0.18);
    const y = uy * Math.sqrt(Math.max(1 - (z / uz) ** 2, 0)) + 0.003;
    const lace = new Mesh(new CylinderGeometry(0.006, 0.006, ux * 0.7, 6), material);
    lace.rotation.z = Math.PI / 2;
    lace.position.set(0, y, z);
    holder.add(lace);
  }
}

/** A strap over the foot at `at` (a share of the half-length, + toward the toe): a half ring over the top. */
function strap(ux: number, uy: number, uz: number, at: number, material: Material): Mesh {
  const z = uz * at;
  const k = Math.sqrt(Math.max(1 - at * at, 0.05));
  const tube = Math.min(ux, uy) * 0.12;
  // From under one side, over the top, to under the other: on the upper's ellipse, out by the tube.
  const points = Array.from({ length: 15 }, (_, i) => {
    const a = -0.45 + (i / 14) * (Math.PI + 0.9);
    return new Vector3(Math.cos(a) * (ux * k + tube * 1.4), Math.sin(a) * (uy * k + tube * 1.4), z);
  });
  return new Mesh(new TubeGeometry(new CatmullRomCurve3(points), 28, tube, 8, false), material);
}

/** A shaft rising round the ankle from the top of the upper, with a padded collar. */
function shaft(holder: Group, foot: Foot, e: number, height: number, upper: Material, trim: Material): void {
  const [rx, ry, rz] = foot.radii;
  const radius = Math.max(rx, Math.min(rx, rz)) * 1.0 + e;
  const start = shaftStart(foot, radius);
  const h = ry * height;
  const tube = new Mesh(new CylinderGeometry(radius, radius, h, 32, 2, true), upper);
  tube.position.set(0, start + h / 2, -rz * 0.2);
  holder.add(tube);
  const collar = new Mesh(new TorusGeometry(radius, Math.min(rx, ry) * 0.14, 10, 32), trim);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, start + h, -rz * 0.2);
  holder.add(collar);
}

/**
 * The lowest height a ring of `radius` round the ankle (centred 0.2 rz back) clears the foot at, in
 * foot space: where every point of the ring is outside the foot's ellipsoid.
 */
function shaftStart(foot: Foot, radius: number): number {
  const [rx, ry, rz] = foot.radii;
  let least = Infinity;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    least = Math.min(least, (radius * Math.sin(a)) ** 2 / rx ** 2 + (radius * Math.cos(a) - rz * 0.2) ** 2 / rz ** 2);
  }
  return least >= 1 ? 0 : ry * Math.sqrt(1 - least) + 0.004;
}

/** A thin strap round the ankle (the heel). */
function ankleStrap(foot: Foot, e: number, material: Material): Mesh {
  const [rx, ry, rz] = foot.radii;
  const radius = rx * 0.95 + e;
  const tube = Math.min(rx, ry) * 0.1;
  const ring = new Mesh(new TorusGeometry(radius, tube, 8, 32), material);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, shaftStart(foot, radius - tube) + tube + ry * 0.2, -rz * 0.2);
  return ring;
}

/** Grip dots under the sock's sole. */
function dots(holder: Group, ux: number, uy: number, uz: number, sole: number, e: number, material: Material): void {
  const dot: BufferGeometry = new SphereGeometry(1, 8, 6);
  for (let i = -2; i <= 2; i++) {
    for (const x of [-0.4, 0, 0.4]) {
      const d = new Mesh(dot, material);
      d.scale.set(Math.min(ux, uz) * 0.09, sole * 0.5, Math.min(ux, uz) * 0.09);
      d.position.set(x * ux, -uy - sole + e * 0.5, i * uz * 0.3);
      holder.add(d);
    }
  }
}
