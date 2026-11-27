/**
 * The Top Hat (slot `head`, any species with a head; the owl's Clockwork set): a tall silk top hat.
 * The crown rises from the head's own rim, pinched a little at the waist and flaring to a flat top
 * with a rolled edge; the brim curls up at the sides and dips at the front and back, bound at its
 * edge. A wide band in `trim` carries a gold buckle at the front, and on the wearer's left a cluster
 * of three brass gears (one spoked) on a brass plate with rivets turns slowly, quicker as it works.
 *
 * Pattern: Adapter. Every size reads the head's published dome (`head-wear.ts`, `fit.ts`), never the
 * species, so it sits on the owl's round head, a person's hair, the dog's skull and the robot's dome.
 * It rides the head bone and keeps still (a hat that wobbles looks loose); only the gears move.
 *
 * Effects: `color` (the silk), `trim` (the band) and `metal` (the gears, buckle and plate).
 */
import { BoxGeometry, CircleGeometry, Color, Group, Mesh, MeshPhysicalMaterial, SphereGeometry } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { effectColour, type EffectValues } from '../effects.ts';
import type { GarmentRing, PartFit } from '../fit.ts';
import { fittedShell, piping, ringPoints } from '../fitted-shell.ts';
import { metalMaterial } from '../glow-kit.ts';
import { crownAt } from '../brim-hat/brim-hat.ts';
import { brimGeometry, headOf, onRing, ringAround } from '../brim-hat/head-wear.ts';
import { gear, keepColour, meshAdder, merged } from '../detail-kit.ts';
import { trimMaterial } from '../cloth.ts';
import type { PartFrame, PartInstance } from '../part';

const EASE = 0.03;
const SEGMENTS = 72;
/** The crown: its height over the head's width, the waist's pinch and the top's flare. */
const HEIGHT = 1.05;
const WAIST = 0.035;
const FLARE = 0.07;
const CROWN_RINGS = 18;
/** The band's height (share of the crown) and the brim (share of the head's width). */
const BAND = 0.2;
const BRIM_FRONT = 0.42;
const BRIM_SIDE = 0.4;
const BRIM_CURL = 0.5;
const EDGE = 0.014;

export function createTopHat(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'top-hat';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };
  const head = headOf(shape);
  const sq = shape.squareness;
  const silkColour = new Color(effectColour(effects, 'color'));
  const silk = keepColour(new MeshPhysicalMaterial({ color: silkColour, roughness: 0.3, sheen: 0.45, sheenRoughness: 0.35, sheenColor: silkColour.clone().lerp(new Color(0xffffff), 0.12), clearcoat: 0.3, clearcoatRoughness: 0.35 }));
  const band = keepColour(trimMaterial(effectColour(effects, 'trim')));
  Object.assign(band, { metalness: 0.15, roughness: 0.45 });
  const metal = metalMaterial(effectColour(effects, 'metal'), 0.24, 0.05);
  const darkMetal = metalMaterial(new Color(effectColour(effects, 'metal')).multiplyScalar(0.55).getHex(), 0.35, 0.02);
  const add = meshAdder(group);

  // The crown: from the rim (at the head's own width plus ease) up, waisted, flaring to the top.
  const base = head.width + EASE;
  const height = HEIGHT * head.width * 1.1;
  const topY = Math.max(head.top + EASE * 2, head.rim + height);
  const crown: GarmentRing[] = Array.from({ length: CROWN_RINGS }, (_, i) => {
    const t = i / (CROWN_RINGS - 1); // 0 at the top, 1 at the rim
    const y = topY - (topY - head.rim) * t;
    const pinch = Math.sin(Math.PI * Math.min(Math.max((t - 0.1) / 0.9, 0), 1)) * WAIST;
    return ringAround(head, y, base * (1 + FLARE * (1 - t) ** 1.5) - pinch * base, EASE);
  });
  add(fittedShell(crown, { segments: SEGMENTS, opening: 0, squareness: sq }), silk, 'hat-crown');
  const lid = new CircleGeometry(1, SEGMENTS).rotateX(-Math.PI / 2);
  lid.scale(crown[0].rx, 1, crown[0].rz).translate(0, topY, 0);
  add(lid, silk, 'hat-top');
  add(piping(ringPoints(crown[0], sq, 0, Math.PI * 2, 96), EDGE * 1.2, true), silk, 'hat-top-edge');

  // The band, piped top and bottom, with a gold buckle at the front-left.
  const bandTop = head.rim + (topY - head.rim) * BAND;
  const bandRings = [bandTop, head.rim + 0.004].map((y) => {
    const r = crownAt(crown, y);
    return { y, rx: r.rx + 0.006, rz: r.rz + 0.006 };
  });
  add(fittedShell(bandRings, { segments: SEGMENTS, opening: 0, squareness: sq }), band, 'hat-band');
  for (const ring of bandRings) add(piping(ringPoints(ring, sq, 0, Math.PI * 2, 96), EDGE * 0.6, true), band, 'hat-band-edge');
  const bandHeight = bandTop - head.rim;
  const buckleAt = onRing({ y: (bandTop + head.rim) / 2, rx: bandRings[0].rx, rz: bandRings[0].rz }, sq, 0.35, 0.008);
  const buckle = merged([
    new BoxGeometry(bandHeight * 0.95, bandHeight * 0.14, 0.012).translate(0, bandHeight * 0.45, 0),
    new BoxGeometry(bandHeight * 0.95, bandHeight * 0.14, 0.012).translate(0, -bandHeight * 0.45, 0),
    new BoxGeometry(bandHeight * 0.14, bandHeight, 0.012).translate(bandHeight * 0.42, 0, 0),
    new BoxGeometry(bandHeight * 0.14, bandHeight, 0.012).translate(-bandHeight * 0.42, 0, 0),
    new BoxGeometry(bandHeight * 0.6, bandHeight * 0.08, 0.008).translate(0, 0, 0.006),
  ]);
  add(buckle.rotateY(0.35).translate(buckleAt.x, buckleAt.y, buckleAt.z), metal, 'hat-buckle');

  // The brim: up at the sides, down a touch front and back, with a bound edge.
  const rim = bandRings[1];
  const reach = (a: number) => head.width * (BRIM_SIDE + (BRIM_FRONT - BRIM_SIDE) * Math.cos(a) ** 2);
  const lift = (a: number, u: number) => (BRIM_CURL * Math.sin(a) ** 2 - 0.12 * Math.cos(a) ** 2) * u * u;
  add(brimGeometry({ y: rim.y, rx: rim.rx - 0.004, rz: rim.rz - 0.004 }, sq, Math.PI, reach, lift), silk, 'hat-brim');
  const edge = ringPoints(rim, sq, 0, Math.PI * 2, 120).slice(0, -1).map((p, i) => {
    const a = (i / 119) * Math.PI * 2;
    const out = Math.hypot(p.x, p.z) || 1;
    const length = reach(a);
    return p.set(p.x + (p.x / out) * length, rim.y + lift(a, 1) * length, p.z + (p.z / out) * length);
  });
  add(piping(edge, EDGE, true), band, 'hat-brim-edge');

  // The clockwork on the wearer's left: a riveted plate and three meshing gears that turn.
  const side = onRing(crownAt(crown, head.rim + (topY - head.rim) * 0.42), sq, Math.PI / 2 - 0.55, 0.006);
  const works = new Group();
  works.name = 'hat-works';
  works.position.copy(side);
  works.rotation.y = Math.PI / 2 - 0.55;
  group.add(works);
  const w = head.width;
  const plate = new Mesh(new CircleGeometry(w * 0.2, 32), darkMetal);
  plate.name = 'hat-plate';
  works.add(plate);
  const rivets = merged(Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return new SphereGeometry(w * 0.012, 8, 6).translate(Math.cos(a) * w * 0.18, Math.sin(a) * w * 0.18, 0.004);
  }));
  works.add(Object.assign(new Mesh(rivets, metal), { name: 'hat-rivets' }));
  const gears: { mesh: Mesh; speed: number }[] = [];
  for (const [radius, teeth, x, y, speed, spokes] of [
    [0.11, 14, -0.02, 0.02, 1, 5],
    [0.065, 9, 0.12, 0.08, -14 / 9, 0],
    [0.05, 8, 0.07, -0.12, -14 / 8, 0],
  ] as const) {
    const mesh = new Mesh(gear(w * radius, teeth, w * 0.022, 0.24, spokes), spokes ? metal : darkMetal);
    mesh.name = 'hat-gear';
    mesh.position.set(w * x, w * y, w * 0.02);
    works.add(mesh);
    gears.push({ mesh, speed });
  }
  const pin = new SphereGeometry(w * 0.025, 10, 8);
  for (const g of gears) {
    const p = Object.assign(new Mesh(pin, metal), { name: 'hat-pin' });
    p.position.copy(g.mesh.position).setZ(w * 0.035);
    works.add(p);
  }

  return {
    group,
    pivotY: head.rim,
    update(frame: PartFrame) {
      const turn = frame.dt * (0.35 + 1.8 * frame.work) * frame.motion.speed;
      for (const g of gears) g.mesh.rotation.z += turn * g.speed;
    },
    dispose: () => disposeTree(group),
  };
}
