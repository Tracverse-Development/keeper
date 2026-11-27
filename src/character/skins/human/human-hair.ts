/**
 * The people's hair, with real volume and a strand texture (`surface-maps.ts`):
 *
 *   man    a close crop on top whose strands run back from the brow, fading at the sides and the
 *          nape into single hairs over the skin (a stipple edge), a hairline that steps back at the
 *          temples, and a trimmed full beard, moustache to sideburns in one piece (`human-beard.ts`)
 *   woman  a crown of natural hair: a cap of coily texture, a high puff built of a few hundred
 *          small coils (one instanced mesh) over a soft core, fuller at the temples, and gold hoops
 *
 * The hair material is the `hair` paint zone's, so painting the zone repaints the crop and the
 * puff. The fade and the beard are their own materials (they need an alpha edge); `syncHair` copies
 * the painted hair colour onto the fade after every paint. Pattern: Builder functions.
 */
import { Color, DoubleSide, InstancedMesh, Matrix4, Mesh, MeshPhysicalMaterial, Quaternion, SphereGeometry, TorusGeometry, Vector3, type Group } from 'three';
import { PALETTE } from '../../palette';
import type { Blob, HumanMaterials } from './human-body';
import { MAN_FRAME, WOMAN_FRAME, type HumanFrame } from './human-shape';
import { addBeard } from './human-beard';
import { sculptedShell, type ShellCut } from './human-face';
import { coilBump, stippleAlpha, strandBump } from './surface-maps';

/** How strongly the strand texture shades the hair (bump units). */
const STRAND_BUMP = 0.9;
/** Coils in the woman's puff and at her temples, and their size. */
const PUFF_COILS = 420;
const COIL_RADIUS = 0.055;

/** A shell over the sculpted head (`sculptedShell`), added to `head`. */
function shell(head: Group, material: MeshPhysicalMaterial, frame: HumanFrame, inflate: number, cut: ShellCut): Mesh {
  const mesh = new Mesh(sculptedShell(frame, inflate, cut), material);
  head.add(mesh);
  return mesh;
}

/** The face's front (three.js' phi for +z) and how wide the fade leaves it bare. */
const FRONT = Math.PI / 2;
const FADE_GAP = 0.95;

/** Gives the zone's hair material its strand texture (along the cap's crown-to-nape lines). */
export function textureHair(m: HumanMaterials, repeat = 6): void {
  const strands = strandBump().clone();
  strands.repeat.set(repeat, 1);
  strands.needsUpdate = true;
  m.hair.bumpMap = strands;
  m.hair.bumpScale = STRAND_BUMP;
}

export interface ManHair {
  /** The fade's own material: `syncHair` keeps its colour the zone's. */
  readonly fade: MeshPhysicalMaterial;
}

export function dressManHair(head: Group, m: HumanMaterials, beard: MeshPhysicalMaterial): ManHair {
  textureHair(m, 10);
  // The crop: tight to the crown, tilted back so the forehead shows.
  shell(head, m.hair, MAN_FRAME, 0.03, { thetaLength: 1.3, tilt: 0.55 });
  // The fade: a band below the crop at the sides and back (never the face) that breaks into single
  // hairs toward the ears and the nape.
  const fade = m.hair.clone();
  fade.alphaMap = stippleAlpha(1.6);
  fade.alphaTest = 0.5;
  fade.side = DoubleSide;
  fade.bumpMap = m.hair.bumpMap;
  shell(head, fade, MAN_FRAME, 0.022, { thetaStart: 1.22, thetaLength: 0.6, tilt: 0.55, phiStart: FRONT + FADE_GAP, phiLength: Math.PI * 2 - 2 * FADE_GAP });
  // The beard: strands of its own, one piece from the moustache round the mouth into the chin and
  // up to the sideburns (`human-beard.ts`).
  const beardStrands = strandBump(220).clone();
  beardStrands.repeat.set(14, 2);
  beardStrands.needsUpdate = true;
  beard.bumpMap = beardStrands;
  beard.bumpScale = STRAND_BUMP;
  addBeard(head, MAN_FRAME, beard);
  return { fade };
}

/** The woman's crown of natural hair and her hoops. */
export function dressWomanHair(head: Group, m: HumanMaterials, blob: Blob): void {
  m.hair.bumpScale = STRAND_BUMP;
  const coil = coilBump().clone();
  coil.repeat.set(6, 4);
  coil.needsUpdate = true;
  m.hair.bumpMap = coil;
  shell(head, m.hair, WOMAN_FRAME, 0.07, { thetaLength: 1.42, tilt: 0.5 });
  // The puff's soft core, then coils all over it and at the temples.
  const puffCentre = new Vector3(0, 0.66, -0.36);
  const puffRadii = new Vector3(0.48, 0.44, 0.44);
  blob(head, m.hair, [puffRadii.x, puffRadii.y, puffRadii.z], [puffCentre.x, puffCentre.y, puffCentre.z]);
  const temples = [-1, 1].map((side) => ({ centre: new Vector3(side * 0.62, 0.12, -0.2), radii: new Vector3(0.19, 0.29, 0.25) }));
  for (const t of temples) blob(head, m.hair, [t.radii.x, t.radii.y, t.radii.z], [t.centre.x, t.centre.y, t.centre.z]);
  const coils = new InstancedMesh(new SphereGeometry(1, 10, 8), m.hair, PUFF_COILS);
  const at = new Matrix4();
  const q = new Quaternion();
  const scale = new Vector3();
  const p = new Vector3();
  // Golden-angle spiral over each ellipsoid, so the coils cover it evenly.
  let k = 0;
  const cover = (centre: Vector3, radii: Vector3, count: number, minY: number): void => {
    for (let i = 0; i < count && k < PUFF_COILS; i++) {
      const y = 1 - (2 * (i + 0.5)) / count;
      if (y < minY) continue;
      const r = Math.sqrt(1 - y * y);
      const a = i * 2.39996;
      p.set(Math.cos(a) * r, y, Math.sin(a) * r).multiply(radii).add(centre);
      const size = COIL_RADIUS * (0.75 + 0.5 * ((i * 0.618) % 1));
      scale.setScalar(size);
      q.setFromAxisAngle(new Vector3(0, 1, 0), a);
      at.compose(p, q, scale);
      coils.setMatrixAt(k++, at);
    }
  };
  cover(puffCentre, puffRadii, 330, -0.55);
  for (const t of temples) cover(t.centre, t.radii, 60, -0.4);
  coils.count = k;
  coils.instanceMatrix.needsUpdate = true;
  head.add(coils);
  const gold = new MeshPhysicalMaterial({ color: PALETTE.gold500, roughness: 0.22, metalness: 1, clearcoat: 0.6 });
  for (const side of [-1, 1]) {
    const hoop = new Mesh(new TorusGeometry(0.07, 0.012, 8, 28), gold);
    hoop.position.set(side * WOMAN_FRAME.head[0] * 0.98, -0.27, 0.0);
    hoop.rotation.y = Math.PI / 2;
    head.add(hoop);
  }
}

/** Copies the painted hair colour onto the fade (it has its own material for the alpha edge). */
export function syncHair(m: HumanMaterials, hair: ManHair | null): void {
  if (!hair) return;
  hair.fade.color.copy(m.hair.color);
  hair.fade.roughness = m.hair.roughness;
  hair.fade.sheen = m.hair.sheen;
}

/** The beard's colour: the hair's, a touch warmer and lighter (short hair catches more light). */
export const BEARD_COLOUR = new Color(0x4a3426);
