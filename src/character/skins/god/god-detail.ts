/**
 * The God Keeper's fine detail (hero pass), over the rig `god-skin.ts` builds:
 *
 *   engraving   scrollwork engraved into the gold mask, the crest and the bands (`surface-maps.ts`)
 *   armour      layered plates: a gorget at the throat, three overlapping pauldron plates on each
 *               shoulder, and a breastplate ridge down the chest, all in the obsidian armour
 *   robe        the robe's lathe gathered into flowing folds that deepen toward the hem
 *   crown       a filigree ring of small rays between the great ones, and jewels set round the halo
 *
 * The plates use the armour's own material (the `body` zone paints them); the filigree uses the
 * crown's light (the `crown` zone). Pattern: Builder over the finished rig.
 */
import {
  CapsuleGeometry,
  Group,
  LatheGeometry,
  Mesh,
  OctahedronGeometry,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  type Material,
  type MeshPhysicalMaterial,
  type Object3D,
} from 'three';
import { HUMAN_NECK_Y } from '../human/human-shape';
import { engraving } from '../human/surface-maps';
import { GOD_FRAME } from './god-shape';

/** Folds round the robe, and how deep they get at the hem (share of the radius). */
const ROBE_FOLDS = 13;
const FOLD_DEPTH = 0.15;
/** Small rays in the filigree ring and the jewels round the halo. */
const FILIGREE_RAYS = 48;
const HALO_JEWELS = 12;

interface GodParts {
  readonly body: Group;
  readonly crown: Group;
  readonly mask: MeshPhysicalMaterial;
  readonly gold: MeshPhysicalMaterial;
  readonly armour: MeshPhysicalMaterial;
  readonly robe: Material;
  readonly crownLight: Material;
  readonly jewel: Material;
}

export function addGodDetail(p: GodParts): void {
  engrave(p.mask, 6, 4, 0.6);
  engrave(p.gold, 10, 3, 0.8);
  foldRobe(p.body, p.robe);
  addArmourPlates(p.body, p.armour, p.gold);
  addFiligree(p.crown, p.crownLight, p.jewel);
}

/** Engraved scrollwork as a bump map, tiled `u` by `v` times. */
function engrave(material: MeshPhysicalMaterial, u: number, v: number, depth: number): void {
  const map = engraving().clone();
  map.repeat.set(u, v);
  map.needsUpdate = true;
  material.bumpMap = map;
  material.bumpScale = depth;
}

/** Finds the robe's lathe (the torso below the waist) and gathers it into folds toward the hem. */
function foldRobe(body: Object3D, robe: Material): void {
  body.traverse((node) => {
    const mesh = node as Mesh;
    if (!(mesh.geometry instanceof LatheGeometry) || mesh.material !== robe) return;
    const position = mesh.geometry.getAttribute('position');
    let top = -Infinity;
    let bottom = Infinity;
    for (let i = 0; i < position.count; i++) {
      top = Math.max(top, position.getY(i));
      bottom = Math.min(bottom, position.getY(i));
    }
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const y = position.getY(i);
      const down = (top - y) / Math.max(top - bottom, 1e-6); // 0 at the waist .. 1 at the hem
      const angle = Math.atan2(x, z);
      // Folds sway a little as they fall, and deepen toward the hem (never inward of the body).
      const fold = 1 + FOLD_DEPTH * down ** 1.4 * (0.5 + 0.5 * Math.sin(angle * ROBE_FOLDS + down * 1.6));
      position.setXYZ(i, x * fold, y, z * fold);
    }
    mesh.geometry.computeVertexNormals();
  });
}

/** A gorget at the throat, three overlapping plates on each shoulder and a ridge down the chest. */
function addArmourPlates(body: Group, armour: Material, gold: Material): void {
  const gorget = new Mesh(new TorusGeometry(0.25, 0.06, 12, 48), armour);
  gorget.rotation.x = Math.PI / 2;
  gorget.scale.set(1, GOD_FRAME.depth * 1.1, 0.8);
  gorget.position.y = HUMAN_NECK_Y - 0.06;
  body.add(gorget);
  const plate = new SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42);
  const trim = new TorusGeometry(1, 0.06, 6, 40);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const p = new Group();
      p.position.set(side * (GOD_FRAME.shoulder.x + 0.02 + i * 0.035), HUMAN_NECK_Y + GOD_FRAME.shoulder.y + 0.06 - i * 0.085, 0);
      p.rotation.z = -side * (0.5 + i * 0.22);
      p.scale.setScalar(0.19 - i * 0.022);
      p.add(new Mesh(plate, armour));
      // A gold edge round each plate.
      const edge = new Mesh(trim, gold);
      edge.rotation.x = Math.PI / 2;
      edge.position.y = Math.cos(Math.PI * 0.42);
      edge.scale.setScalar(Math.sin(Math.PI * 0.42));
      p.add(edge);
      body.add(p);
    }
  }
  const ridge = new Mesh(new CapsuleGeometry(0.018, 0.34, 4, 10), gold);
  ridge.position.set(0, HUMAN_NECK_Y - 0.28, GOD_FRAME.torso[4][0] * GOD_FRAME.depth + 0.005);
  ridge.rotation.x = 0.12;
  body.add(ridge);
}

/** A ring of small rays between the great ones, and jewels set round the halo ring. */
function addFiligree(crown: Group, light: Material, jewel: Material): void {
  const ray = new PlaneGeometry(0.022, 0.24, 1, 4);
  ray.translate(0, 1.1, 0);
  const filigree = new Group();
  filigree.name = 'filigree';
  for (let i = 0; i < FILIGREE_RAYS; i++) {
    const r = new Mesh(ray, light);
    r.rotation.z = ((i + 0.5) / FILIGREE_RAYS) * Math.PI * 2;
    r.scale.y = i % 3 === 0 ? 1.3 : 0.8;
    filigree.add(r);
  }
  crown.add(filigree);
  const gem = new OctahedronGeometry(0.03, 0);
  for (let i = 0; i < HALO_JEWELS; i++) {
    const a = (i / HALO_JEWELS) * Math.PI * 2;
    const g = new Mesh(gem, jewel);
    g.position.set(Math.cos(a) * 0.97, Math.sin(a) * 0.97, 0.01);
    crown.add(g);
  }
}
