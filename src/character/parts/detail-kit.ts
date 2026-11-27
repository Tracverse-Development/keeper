/**
 * Small geometry helpers the 0.16.0 set pieces share (`set-parts.ts`), on top of `fit.ts`,
 * `fitted-shell.ts` and `garment.ts`:
 *
 *  - `merged`: many small pieces (stitches, studs, fringe threads) as one geometry, one draw;
 *  - `dash`: a thin bar lying from one point to another (a stitch, a strap's edge, a rib);
 *  - `loft`: a closed surface through a stack of cross-section loops (a bat's blade, a staff,
 *    a goggle cup), capped at both ends;
 *  - `meshAdder`: the `add(geometry, material, name)` every part uses to fill its group;
 *  - `gear`: a flat toothed gear with a hub hole, for anything clockwork.
 *
 * Pure geometry on three.js (no GPU), so the wearables-fit test builds and measures it.
 */
import { BufferAttribute, BufferGeometry, BoxGeometry, ExtrudeGeometry, Group, Matrix4, Mesh, Path, Quaternion, Shape, Vector3, type Material, type MeshStandardMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Several pieces as one geometry (one draw); the pieces are disposed. Pieces of mixed kinds (a
 * lofted surface without UVs beside a box with them, indexed beside not) are brought to the
 * attributes they all share first.
 */
export function merged(pieces: BufferGeometry[]): BufferGeometry {
  const shared = ['position', 'normal', 'uv'].filter((name) => pieces.every((p) => p.getAttribute(name)));
  const mixed = pieces.some((p) => p.index) && pieces.some((p) => !p.index);
  const ready = pieces.map((p) => {
    const g = mixed && p.index ? p.toNonIndexed() : p;
    for (const name of Object.keys(g.attributes)) if (!shared.includes(name)) g.deleteAttribute(name);
    return g;
  });
  const out = mergeGeometries(ready, false);
  for (const piece of new Set([...pieces, ...ready])) piece.dispose();
  return out;
}

/** A box lying from `a` to `b`, `share` of the gap long, `width` by `depth` across (a stitch, a rib). */
export function dash(a: Vector3, b: Vector3, share: number, width: number, depth: number): BufferGeometry {
  const span = b.clone().sub(a);
  const box = new BoxGeometry(width, Math.max(span.length() * share, 1e-4), depth);
  const turn = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), span.clone().normalize());
  return box.applyMatrix4(new Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), turn, new Vector3(1, 1, 1)));
}

/**
 * A closed surface through `loops` (each the same number of points, in order round the section),
 * from the first loop to the last, with flat caps closing both ends. Normals are computed.
 */
export function loft(loops: readonly (readonly Vector3[])[]): BufferGeometry {
  const n = loops[0].length;
  const positions: number[] = [];
  for (const loop of loops) for (const p of loop) positions.push(p.x, p.y, p.z);
  const index: number[] = [];
  for (let i = 0; i < loops.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * n + j;
      const b = i * n + ((j + 1) % n);
      index.push(a, a + n, b, b, a + n, b + n);
    }
  }
  // Caps: a fan round each end loop's centre.
  for (const [k, flip] of [[0, true], [loops.length - 1, false]] as const) {
    const centre = loops[k].reduce((sum, p) => sum.add(p), new Vector3()).multiplyScalar(1 / n);
    const c = positions.length / 3;
    positions.push(centre.x, centre.y, centre.z);
    for (let j = 0; j < n; j++) {
      const a = k * n + j;
      const b = k * n + ((j + 1) % n);
      if (flip) index.push(c, b, a);
      else index.push(c, a, b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** The `add(geometry, material, name)` a part fills its group with; returns the new mesh. */
export function meshAdder(group: Group): (geometry: BufferGeometry, material: Material, name: string) => Mesh {
  return (geometry, material, name) => {
    const mesh = Object.assign(new Mesh(geometry, material), { name });
    group.add(mesh);
    return mesh;
  };
}

/**
 * A flat gear in the XY plane, `thickness` deep along z (centred): `teeth` square-topped teeth
 * round a rim of `radius`, a hub hole of `hole` (share of the radius) and, when `spokes` > 0, that
 * many spokes with the windows between them cut out.
 */
export function gear(radius: number, teeth: number, thickness: number, hole = 0.22, spokes = 0): BufferGeometry {
  const tooth = radius * 0.16;
  const shape = new Shape();
  const steps = teeth * 4;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    // Each tooth is a quarter up, a quarter on top, a quarter down, a quarter in the gap.
    const r = i % 4 === 1 || i % 4 === 2 ? radius + tooth : radius;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const hub = new Path();
  hub.absarc(0, 0, radius * hole, 0, Math.PI * 2, true);
  shape.holes.push(hub);
  if (spokes > 0) {
    const inner = radius * 0.78;
    const outer = radius * (hole + 0.16);
    const window = (Math.PI * 2) / spokes;
    for (let k = 0; k < spokes; k++) {
      const a0 = k * window + window * 0.18;
      const a1 = (k + 1) * window - window * 0.18;
      const w = new Path();
      w.absarc(0, 0, inner, a0, a1, false);
      w.absarc(0, 0, outer, a1, a0, true);
      shape.holes.push(w);
    }
  }
  const geometry = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: thickness * 0.2, bevelSize: thickness * 0.2, bevelSegments: 1, curveSegments: 6 });
  geometry.translate(0, 0, -thickness / 2);
  return geometry;
}

/** The faint light of its own a `keepColour` surface carries. */
const OWN_LIGHT = 0.035;

/**
 * Gives a large dark surface (navy enamel, navy wool, dark silk, brown leather) a faint light of its
 * own colour. The rarity flourish leaves surfaces that light themselves alone (`rarity-flourish.ts`
 * `glowingSurfaces`), so the tier's sparkles, rings and rays still come but its colour never washes
 * a navy coat blue or a brown helmet green; the set glow then brightens it in its own colour.
 * Returns the material.
 */
export function keepColour<T extends MeshStandardMaterial>(material: T): T {
  material.emissive.copy(material.color);
  material.emissiveIntensity = OWN_LIGHT;
  return material;
}
