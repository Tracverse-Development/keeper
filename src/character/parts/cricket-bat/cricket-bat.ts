/**
 * The Cricket Bat (slot `held`, humans): a willow bat carried in the right hand the way a batter
 * walks out, blade down and a little forward. The blade is lofted from real bat sections: a flat
 * face, a raised spine down the back that is thickest at the sweet spot, sloping shoulders into the
 * splice and a rounded toe. On it: the willow grain in fine lines, a gold maker's badge on the
 * face and a navy label on the back, twine binding above the shoulders, and a handle wrapped in a
 * spiral grip with a capped end.
 *
 * Pattern: Adapter. It is sized from the hand the body publishes (`fit.ts`: the held shape's
 * radius), and the grip passes through that hand. It rides the arm, so it swings with it.
 *
 * Effects: `color` (the willow) and `trim` (the grip and the back label).
 */
import { Color, CylinderGeometry, Group, MeshPhysicalMaterial, MeshStandardMaterial, SphereGeometry, TorusGeometry, TubeGeometry, CatmullRomCurve3, Vector3, type BufferGeometry } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { effectColour, type EffectValues } from '../effects.ts';
import { radiusAt, type PartFit } from '../fit.ts';
import { metalMaterial } from '../glow-kit.ts';
import { loft, meshAdder, merged } from '../detail-kit.ts';
import type { PartFrame, PartInstance } from '../part';

/** Sizes as multiples of the hand's radius: the whole bat, the blade, the handle. */
const LENGTH = 8.6;
const BLADE_SHARE = 0.66;
const WIDTH = 1.0;
const EDGE = 0.2;
const SPINE = 0.42;
const HANDLE = 0.17;
/** How the bat is carried: tipped forward (radians about x) and away from the leg (about z). */
const TIP_FORWARD = 0.32;
const TIP_OUT = 0.1;
/** Cross-section points round the blade, and sections down it. */
const AROUND = 28;
const DOWN = 30;
const GRAIN_LINES = 9;

export function createCricketBat(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'cricket-bat';
  if (!fit.shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };
  const hand = radiusAt(fit.shape, 0) || 0.1;
  const willowColour = new Color(effectColour(effects, 'color'));
  const willow = new MeshPhysicalMaterial({ color: willowColour, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.3, sheenColor: willowColour.clone().lerp(new Color(0xffffff), 0.4) });
  const grain = new MeshStandardMaterial({ color: willowColour.clone().multiplyScalar(0.6), roughness: 0.7 });
  const grip = new MeshStandardMaterial({ color: effectColour(effects, 'trim'), roughness: 0.85 });
  const twine = new MeshStandardMaterial({ color: 0x2a2018, roughness: 0.9 });
  const gold = metalMaterial(0xd39744, 0.25, 0.05);

  // The bat in its own frame: the top of the handle at +y, the toe at -y, the face toward +z.
  const bat = new Group();
  bat.name = 'bat';
  bat.rotation.set(TIP_FORWARD, 0, -TIP_OUT);
  group.add(bat);
  const add = meshAdder(bat);
  const length = LENGTH * hand;
  const handleTop = hand * 1.6;
  const shoulder = handleTop - length * (1 - BLADE_SHARE);
  const toe = handleTop - length;
  const w = (WIDTH * hand) / 2;

  add(loft(bladeLoops(shoulder, toe, w, hand)), willow, 'bat-blade');
  add(grainLines(shoulder, toe, w, hand), grain, 'bat-grain');

  // The handle: a cane core, its spiral grip, the twine binding at the splice and a capped end.
  const handleRadius = HANDLE * hand * 2.2;
  const handleLength = handleTop - shoulder + hand * 0.4;
  add(new CylinderGeometry(handleRadius, handleRadius * 1.08, handleLength, 20).translate(0, handleTop - handleLength / 2, 0), grip, 'bat-grip');
  const spiral = Array.from({ length: 160 }, (_, i) => {
    const t = i / 159;
    const a = t * Math.PI * 2 * 11;
    return new Vector3(Math.cos(a) * handleRadius * 1.04, handleTop - hand * 0.15 - t * (handleLength - hand * 0.6), Math.sin(a) * handleRadius * 1.04);
  });
  add(new TubeGeometry(new CatmullRomCurve3(spiral), 480, handleRadius * 0.12, 5), grip, 'bat-grip');
  add(new SphereGeometry(handleRadius * 1.12, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, handleTop, 0), grip, 'bat-cap');
  const binding = Array.from({ length: 7 }, (_, k) => new TorusGeometry(handleRadius * 1.16, handleRadius * 0.11, 6, 22).rotateX(Math.PI / 2).translate(0, shoulder + hand * 0.08 + k * handleRadius * 0.24, 0));
  add(merged(binding), twine, 'bat-twine');

  // The maker's badge on the face (a gold oval with a navy bar) and the label down the back.
  const badgeY = shoulder - length * BLADE_SHARE * 0.2;
  add(new CylinderGeometry(w * 0.55, w * 0.55, 0.004, 32).scale(1, 1, 1.5).rotateX(Math.PI / 2).translate(0, badgeY, 0.003), gold, 'bat-badge');
  add(new CylinderGeometry(w * 0.4, w * 0.4, 0.005, 32).scale(1, 1, 0.42).rotateX(Math.PI / 2).translate(0, badgeY, 0.006), grip, 'bat-badge');
  const backY = shoulder - length * BLADE_SHARE * 0.42;
  const back = bladeBack(backY, shoulder, toe, hand);
  add(new CylinderGeometry(w * 0.3, w * 0.3, 0.004, 24).scale(1, 1, 3.2).rotateX(Math.PI / 2).translate(0, backY, -back - 0.004), grip, 'bat-label');

  return {
    group,
    pivotY: 0,
    update(frame: PartFrame) {
      // A batter's restless grip: the bat rocks a touch as the keeper breathes and works.
      bat.rotation.x = TIP_FORWARD + Math.sin(frame.time * 1.1) * 0.025 * frame.motion.amplitude * (1 + frame.work);
    },
    dispose: () => disposeTree(group),
  };
}

/** How thick the spine stands at height `y` (thickest at the sweet spot, low on the blade). */
function spineAt(y: number, shoulder: number, toe: number, hand: number): number {
  const s = (shoulder - y) / (shoulder - toe);
  const swell = Math.exp(-(((s - 0.68) / 0.34) ** 2));
  return hand * (SPINE * (0.45 + 0.55 * swell));
}

/** The depth of the back at the middle of the blade at height `y` (for the back label). */
function bladeBack(y: number, shoulder: number, toe: number, hand: number): number {
  return spineAt(y, shoulder, toe, hand);
}

/** The blade's sections: flat face, edges, a raised spine, shoulders sloping in and a rounded toe. */
function bladeLoops(shoulder: number, toe: number, w: number, hand: number): Vector3[][] {
  const loops: Vector3[][] = [];
  const top = shoulder + hand * 0.55;
  for (let i = 0; i <= DOWN; i++) {
    const t = i / DOWN;
    const y = top - (top - toe) * t;
    // Shoulders: the blade narrows into the splice above the shoulder line; the toe rounds off.
    const intoHandle = y > shoulder ? 1 - ((y - shoulder) / (top - shoulder)) ** 0.7 * 0.78 : 1;
    const toeRound = t > 0.94 ? Math.sqrt(Math.max(1 - ((t - 0.94) / 0.06) ** 2, 0.04)) : 1;
    const half = w * intoHandle * (0.94 + 0.06 * Math.min(t * 3, 1)) * toeRound;
    const edge = hand * EDGE * Math.max(intoHandle, 0.6) * toeRound;
    const spine = (y > shoulder ? hand * SPINE * 0.5 * intoHandle + edge * 0.5 : spineAt(y, shoulder, toe, hand)) * toeRound;
    loops.push(section(half, edge, spine, y));
  }
  return loops;
}

/** One blade section: from the left edge along the flat face, round the right edge, back over the spine. */
function section(half: number, edge: number, spine: number, y: number): Vector3[] {
  const out: Vector3[] = [];
  const faceCount = AROUND / 2;
  for (let j = 0; j < faceCount; j++) {
    const u = -1 + (2 * j) / (faceCount - 1);
    // The face is flat with softly rounded edges.
    out.push(new Vector3(u * half, y, edge * 0.12 * (1 - u * u) ** 0.3));
  }
  for (let j = 0; j < faceCount; j++) {
    const u = 1 - (2 * j) / (faceCount - 1);
    // The back: the edge's thickness at the sides rising to the spine in the middle.
    const rise = (1 - Math.abs(u)) ** 0.85;
    out.push(new Vector3(u * half * 0.99, y, -(edge + (spine - edge) * rise)));
  }
  return out;
}

/** Fine darker lines of grain running down the face. */
function grainLines(shoulder: number, toe: number, w: number, hand: number): BufferGeometry {
  const lines: BufferGeometry[] = [];
  for (let k = 0; k < GRAIN_LINES; k++) {
    const u = -0.8 + (1.6 * k) / (GRAIN_LINES - 1) + (k % 2 ? 0.04 : -0.03);
    const length = (shoulder - toe) * (0.86 + 0.08 * Math.sin(k * 2.1));
    const g = new CylinderGeometry(hand * 0.006, hand * 0.006, length, 4);
    lines.push(g.translate(u * w, shoulder - hand * 0.12 - length / 2, hand * EDGE * 0.12 + 0.0015));
  }
  return merged(lines);
}
