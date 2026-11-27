/**
 * The Trail Pack's other shapes (`backpack.ts` `style` 1..4), each built into the pack group hung
 * from its top (the pack's own space: its back face toward +z, the body; x across; the top at y 0),
 * at the size the pack layout gives:
 *   1 toolbox    - a steel toolbox with a lid seam, a carry handle and two latches
 *   2 saddlebags - two pouches low on either side of a strap, each with a cross badge
 *   3 satchel    - a leather satchel with a flap and a buckle, a book peeking out of the top
 *   4 thrusters  - twin thrusters on a mounting plate, soft flames from their nozzles (`glow`,
 *                  brighter and longer with work, flickering)
 * Each returns what moves each frame (the thrusters' flames), or nothing.
 */
import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, TorusGeometry, type MeshPhysicalMaterial } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { clothMaterial } from '../cloth.ts';
import { lightMaterial, metalMaterial } from '../glow-kit.ts';

export interface PackSize {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}

export interface PackLook {
  readonly colour: number;
  readonly trim: number;
  readonly trimMaterial: MeshPhysicalMaterial;
  readonly glow: number;
}

/** A step for the parts that move: `time` (s), `work` 0..1. */
export type PackMotion = (time: number, work: number) => void;

/** Builds style `style` (1..4) into `pack`. */
export function buildPackStyle(style: number, pack: Group, size: PackSize, look: PackLook): PackMotion | null {
  return [toolbox, saddlebags, satchel, thrusters][style - 1](pack, size, look);
}

/** A rounded box centred at (x, y, z) in the pack's space. */
function box(pack: Group, material: MeshPhysicalMaterial | MeshBasicMaterial, w: number, h: number, d: number, at: readonly [number, number, number], round = 0.02): Mesh {
  const m = new Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(round, w / 2.2, h / 2.2, d / 2.2)), material);
  m.position.set(...at);
  m.name = 'pack-body';
  pack.add(m);
  return m;
}

function toolbox(pack: Group, { width, height, depth }: PackSize, look: PackLook): null {
  const steel = metalMaterial(look.colour, 0.35, 0);
  steel.metalness = 0.6;
  box(pack, steel, width, height * 0.82, depth, [0, -height * 0.55, 0], 0.025);
  box(pack, steel, width * 1.03, height * 0.2, depth * 1.04, [0, -height * 0.13, 0], 0.02);
  const silver = metalMaterial(look.trim, 0.25, 0);
  const handle = new Mesh(new TorusGeometry(width * 0.2, 0.014, 8, 24, Math.PI), silver);
  handle.position.y = 0.0;
  pack.add(handle);
  for (const side of [-1, 1]) box(pack, silver, width * 0.12, height * 0.12, 0.03, [side * width * 0.3, -height * 0.24, -depth / 2 - 0.012], 0.008);
  box(pack, silver, width * 1.0, 0.012, 0.012, [0, -height * 0.24, -depth / 2 - 0.004], 0.004);
  return null;
}

function saddlebags(pack: Group, { width, height, depth }: PackSize, look: PackLook): null {
  const leather = clothMaterial(look.colour, 0.6);
  box(pack, leather, width * 0.5, height * 0.18, depth * 0.6, [0, -height * 0.12, 0], 0.03);
  for (const side of [-1, 1]) {
    box(pack, leather, width * 0.46, height * 0.62, depth * 0.95, [side * width * 0.36, -height * 0.58, 0], 0.06);
    box(pack, leather, width * 0.48, height * 0.2, depth * 1.0, [side * width * 0.36, -height * 0.33, 0], 0.04);
    const badge = lightMaterial(look.trim, 1, 1);
    const cx = side * width * 0.36;
    const cz = -depth * 0.5 - 0.012;
    for (const [w, h] of [[0.1, 0.03], [0.03, 0.1]] as const) {
      const bar = new Mesh(new BoxGeometry(w, h, 0.008), badge);
      bar.position.set(cx, -height * 0.6, cz);
      pack.add(bar);
    }
  }
  return null;
}

function satchel(pack: Group, { width, height, depth }: PackSize, look: PackLook): null {
  const leather = clothMaterial(look.colour, 0.55);
  box(pack, leather, width, height * 0.8, depth * 0.85, [0, -height * 0.58, 0], 0.05);
  const flap = clothMaterial(look.colour, 0.45);
  flap.color.multiplyScalar(0.85);
  box(pack, flap, width * 1.02, height * 0.45, 0.035, [0, -height * 0.38, -depth * 0.44], 0.02);
  box(pack, look.trimMaterial, 0.07, 0.05, 0.02, [0, -height * 0.6, -depth * 0.47], 0.01);
  // A book peeking out of the top, a little askew.
  const cover = clothMaterial(look.trim, 0.6);
  const pages = clothMaterial(0xf4eee2, 0.9);
  const book = new Group();
  book.position.set(width * 0.18, -height * 0.18, 0.02);
  book.rotation.z = -0.18;
  pack.add(book);
  const b = new Mesh(new BoxGeometry(width * 0.32, height * 0.34, depth * 0.36), cover);
  const p = new Mesh(new BoxGeometry(width * 0.3, height * 0.33, depth * 0.3), pages);
  p.position.y = 0.006;
  book.add(b, p);
  return null;
}

function thrusters(pack: Group, { width, height, depth }: PackSize, look: PackLook): PackMotion {
  const steel = metalMaterial(look.colour, 0.28, 0);
  const dark = metalMaterial(look.trim, 0.4, 0);
  box(pack, dark, width * 0.62, height * 0.75, depth * 0.35, [0, -height * 0.45, depth * 0.2], 0.03);
  const flames: { outer: Mesh; inner: Mesh; side: number }[] = [];
  const glowOuter = lightMaterial(0x4fa8ff, 1.6, 0.7);
  const glowInner = lightMaterial(0xe8f6ff, 2.6, 0.9);
  for (const side of [-1, 1]) {
    const x = side * width * 0.32;
    const tube = Math.max(width * 0.17, depth * 0.42);
    const body = new Mesh(new CylinderGeometry(tube, tube * 1.08, height * 0.9, 24), steel);
    body.position.set(x, -height * 0.5, -depth * 0.05);
    const cap = new Mesh(new ConeGeometry(tube, height * 0.22, 24), steel);
    cap.position.set(x, height * 0.06, -depth * 0.05);
    const nozzle = new Mesh(new CylinderGeometry(tube * 0.72, tube * 0.95, height * 0.14, 24, 1, true), dark);
    nozzle.position.set(x, -height * 1.0, -depth * 0.05);
    const ring = new Mesh(new TorusGeometry(tube * 0.72, 0.01, 8, 32), glowInner);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, -height * 1.06, -depth * 0.05);
    pack.add(body, cap, nozzle, ring);
    // Flames: cones pointing down, origin at the nozzle (geometry shifted so scaling grows them downward).
    const outerGeometry = new ConeGeometry(tube * 0.7, 1, 20, 1, true);
    outerGeometry.rotateX(Math.PI);
    outerGeometry.translate(0, -0.5, 0);
    const innerGeometry = outerGeometry.clone();
    innerGeometry.scale(0.55, 0.7, 0.55);
    const outer = new Mesh(outerGeometry, glowOuter);
    const inner = new Mesh(innerGeometry, glowInner);
    for (const f of [outer, inner]) {
      f.position.set(x, -height * 1.06, -depth * 0.05);
      f.name = 'thruster-flame';
      pack.add(f);
    }
    flames.push({ outer, inner, side });
  }
  return (time, work) => {
    const strength = look.glow * (0.6 + 0.9 * work);
    for (const { outer, inner, side } of flames) {
      const flicker = 0.85 + 0.15 * Math.sin(time * 31 + side) * Math.sin(time * 17.3);
      const length = height * (0.6 + 0.7 * strength) * flicker;
      outer.scale.set(1, length, 1);
      inner.scale.set(1, length, 1);
    }
    glowOuter.opacity = Math.min(0.9, 0.35 + 0.3 * strength);
    glowInner.opacity = Math.min(1, 0.5 + 0.3 * strength);
  };
}
