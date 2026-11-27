/**
 * The Emblem Halo (slot `halo`, any species, floating): something turning over the head. One kit,
 * five shapes, picked by `style`:
 *   0 satellites    - a thin orbit ring with eight tiny satellites (body and two solar wings) circling it
 *   1 petals        - a crown of sun-seeking petals round a glowing seed disc, opening and turning
 *   2 crescent      - a thin crescent moon standing over the head, rocking softly in its own glow
 *   3 compass rose  - a ring with eight star points and a needle that swings and settles
 *   4 halo of ages  - three rings of old gold glyphs at three tilts, turning against each other,
 *                     with a ring of light and motes: the God Keeper's own (very grand)
 *
 * Pattern: Strategy by data. Each style is a builder returning its group and an `animate` step;
 * the part owns the shared light, the clock and the reaction to work (faster, brighter) and
 * thinking (spins up). Effects: `color` (metal and light), `glow` (how bright its light is), `speed`
 * (turn speed), `style`. Floating: it ignores the body's shape and sits where the halo anchor is.
 */
import { CylinderGeometry, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, Shape, SphereGeometry, TorusGeometry, BoxGeometry, ConeGeometry } from 'three';
import { disposeTree } from '../../dispose-tree';
import { thinkDrama } from '../../thinking';
import { effectColour, effectNumber, type EffectValues } from '../effects';
import type { PartFrame, PartInstance } from '../part';
import { fadingLightMaterial, glowDisc, lightMaterial, metalMaterial } from '../glow-kit';

/** Where the emblem floats in the halo anchor's (tilted) space: above the head, pulled back to undo the tilt. */
const EMBLEM_Y = 1.42;
const EMBLEM_Z = -0.42;
/** Counter-tilt (radians) so the emblem's plane reads level over the head. */
const LEVEL = -0.32;
const RADIUS = 0.62;
/** Work and thinking make it turn faster and burn brighter. */
const WORK_SPIN = 1.6;
const THINK_SPIN = 2.5;
const WORK_GLOW = 0.6;
const STYLES = 5;
/** How far each style leans its face toward the viewer (radians), and the halo of ages' extra lift. */
const FACE_TILT = [0, 0.75, 0, 0.85, 0.15] as const;
const AGES_LIFT = 0.18;

interface Built {
  readonly group: Group;
  /** One step: `spin` is the accumulated turn (radians), `light` the glow level now. */
  animate(spin: number, time: number, light: number): void;
}

interface Kit {
  readonly colour: number;
  readonly metal: MeshPhysicalMaterial;
  readonly light: MeshBasicMaterial;
}

export function createEmblemHalo(effects: EffectValues): PartInstance {
  const colour = effectColour(effects, 'color');
  const glow = effectNumber(effects, 'glow');
  const speed = effectNumber(effects, 'speed');
  const style = Math.min(Math.max(Math.round(effectNumber(effects, 'style')), 0), STYLES - 1);
  const group = new Group();
  group.name = 'emblem-halo';
  const holder = new Group();
  holder.position.set(0, EMBLEM_Y, EMBLEM_Z);
  holder.rotation.x = LEVEL;
  group.add(holder);

  const kit: Kit = { colour, metal: metalMaterial(colour, 0.2, 0.12), light: lightMaterial(colour, 1.6, 0.7) };
  const built = [satellites, petals, crescent, compass, ages][style](kit);
  // Flat emblems (the petals, the compass rose) lean their face toward the viewer; the halo of ages
  // floats a little higher so its tilted rings clear the head.
  built.group.rotation.x = FACE_TILT[style];
  built.group.position.y = style === 4 ? AGES_LIFT : 0;
  holder.add(built.group);
  const aura = new Mesh(glowDisc(RADIUS * (style === 4 ? 2.1 : 1.5), colour, 2.2), fadingLightMaterial(0.5));
  aura.name = 'emblem-glow';
  if (style !== 2) holder.add(aura);

  let spin = 0;
  function update(frame: PartFrame): void {
    const think = thinkDrama(frame.thinking, frame.work, frame.dramaFloor);
    spin += frame.dt * frame.motion.speed * speed * (0.5 + WORK_SPIN * frame.work + THINK_SPIN * think);
    const light = glow * (0.45 + 0.55 * frame.mood.presence) * (1 + WORK_GLOW * frame.work + think + 1.2 * frame.gotIt);
    kit.light.opacity = Math.min(1, 0.35 + 0.35 * light);
    kit.metal.emissiveIntensity = 0.06 + 0.22 * light;
    (aura.material as MeshBasicMaterial).opacity = 0.18 + 0.22 * light;
    holder.position.y = EMBLEM_Y + Math.sin(frame.time * 0.8 * frame.motion.speed) * 0.04 * frame.motion.amplitude;
    built.animate(spin, frame.time, light);
  }

  return { group, pivotY: EMBLEM_Y, update, dispose: () => disposeTree(group) };
}

/** A thin ring in the XZ plane. */
function ring(radius: number, tube: number): TorusGeometry {
  const geometry = new TorusGeometry(radius, tube, 10, 160);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function satellites(kit: Kit): Built {
  const group = new Group();
  group.add(new Mesh(ring(RADIUS, 0.008), kit.light));
  const sats = new Group();
  group.add(sats);
  const panel = lightMaterial(0x4a8df0, 1.2, 0.9);
  const COUNT = 8;
  for (let i = 0; i < COUNT; i++) {
    const a = (i / COUNT) * Math.PI * 2;
    const sat = new Group();
    sat.position.set(Math.cos(a) * RADIUS, 0, Math.sin(a) * RADIUS);
    sat.rotation.y = -a;
    sat.add(new Mesh(new BoxGeometry(0.05, 0.05, 0.07), kit.metal));
    for (const side of [-1, 1]) {
      const wing = new Mesh(new BoxGeometry(0.004, 0.035, 0.09), panel);
      wing.position.set(0, 0, side * 0.085);
      sat.add(wing);
    }
    const beacon = new Mesh(new SphereGeometry(0.014, 10, 8), kit.light);
    beacon.position.y = 0.035;
    sat.add(beacon);
    sats.add(sat);
  }
  return { group, animate: (spin, time) => { sats.rotation.y = spin; sats.children.forEach((s, i) => (s.position.y = Math.sin(time * 1.3 + i) * 0.02)); } };
}

function petals(kit: Kit): Built {
  const group = new Group();
  const seed = new Mesh(new SphereGeometry(0.11, 24, 16), kit.light);
  seed.scale.y = 0.4;
  group.add(seed);
  const crown = new Group();
  group.add(crown);
  const petal = new SphereGeometry(1, 20, 12);
  const COUNT = 12;
  for (let i = 0; i < COUNT; i++) {
    const a = (i / COUNT) * Math.PI * 2;
    const hinge = new Group();
    hinge.rotation.y = -a;
    const p = new Mesh(petal, kit.metal);
    p.scale.set(0.2, 0.025, 0.075);
    p.position.x = 0.32;
    hinge.add(p);
    crown.add(hinge);
  }
  return {
    group,
    animate(spin, time, light) {
      crown.rotation.y = spin * 0.5;
      // Petals open toward the light as it glows, and breathe.
      const open = 0.35 + 0.2 * Math.min(light, 1.5) + 0.05 * Math.sin(time * 1.2);
      crown.children.forEach((h) => (h.children[0].rotation.z = open));
    },
  };
}

function crescent(kit: Kit): Built {
  const group = new Group();
  const shape = new Shape();
  shape.absarc(0, 0, 0.32, Math.PI * 0.18, Math.PI * 1.82, false);
  shape.absarc(0.12, 0, 0.27, Math.PI * 1.72, Math.PI * 0.28, true);
  const moon = new Mesh(new ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 4, curveSegments: 64 }), kit.metal);
  moon.geometry.center();
  // Stands up over the head (the holder is level), facing the camera.
  moon.rotation.x = -LEVEL;
  moon.position.y = 0.2;
  const glow = new Mesh(glowDisc(0.7, kit.colour, 2.4), fadingLightMaterial(0.6));
  glow.rotation.x = Math.PI / 2 - LEVEL;
  glow.position.set(0, 0.2, -0.05);
  group.add(glow, moon);
  return { group, animate: (spin, time) => { moon.rotation.z = Math.sin(time * 0.6) * 0.12 + Math.sin(spin) * 0.05; } };
}

function compass(kit: Kit): Built {
  const group = new Group();
  group.add(new Mesh(ring(RADIUS * 0.85, 0.014), kit.metal), new Mesh(ring(RADIUS * 0.95, 0.006), kit.light));
  const rose = new Group();
  group.add(rose);
  for (let i = 0; i < 8; i++) {
    const long = i % 2 === 0;
    const point = new Mesh(new ConeGeometry(long ? 0.06 : 0.04, long ? 0.42 : 0.26, 4), long ? kit.metal : kit.light);
    point.rotation.z = -Math.PI / 2;
    point.scale.z = 0.25;
    point.position.x = long ? 0.21 : 0.13;
    const arm = new Group();
    arm.rotation.y = (i / 8) * Math.PI * 2;
    arm.add(point);
    rose.add(arm);
  }
  const needle = new Mesh(new ConeGeometry(0.03, 0.5, 4), lightMaterial(0xe2425f, 1.8));
  needle.rotation.z = -Math.PI / 2;
  needle.position.x = 0.25;
  const pivot = new Group();
  pivot.position.y = 0.03;
  pivot.add(needle, new Mesh(new CylinderGeometry(0.03, 0.03, 0.03, 16), kit.metal));
  group.add(pivot);
  return { group, animate: (spin, time) => { rose.rotation.y = spin * 0.4; pivot.rotation.y = Math.sin(time * 0.9) * 0.6 * Math.exp(-((time * 0.25) % 4)) + 0.2; } };
}

function ages(kit: Kit): Built {
  const group = new Group();
  const rings: Group[] = [];
  const glyph = new BoxGeometry(1, 1, 1);
  const bright = lightMaterial(kit.colour, 2.4, 0.85);
  [0.66, 0.82, 0.98].forEach((radius, k) => {
    const tilt = new Group();
    tilt.rotation.set([0, 0.42, -0.36][k], 0, [0, 0.2, -0.25][k]);
    const turn = new Group();
    tilt.add(turn);
    turn.add(new Mesh(ring(radius, 0.012), kit.metal), new Mesh(ring(radius + 0.035, 0.004), bright), new Mesh(ring(radius - 0.035, 0.004), bright));
    // Old script: a band of marks of three widths, like letters, round the ring.
    const marks = 44 + k * 10;
    for (let i = 0; i < marks; i++) {
      if (i % 9 === 4) continue;
      const a = (i / marks) * Math.PI * 2;
      const m = new Mesh(glyph, i % 3 === 0 ? bright : kit.metal);
      const w = [0.012, 0.022, 0.034][(i * 7 + k) % 3];
      m.scale.set(0.006, 0.045, w);
      m.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
      m.rotation.y = -a;
      m.rotation.z = Math.PI / 2;
      turn.add(m);
    }
    group.add(tilt);
    rings.push(turn);
  });
  const heart = new Mesh(new SphereGeometry(0.07, 20, 14), bright);
  group.add(heart);
  const rays = new Group();
  for (let i = 0; i < 16; i++) {
    const ray = new Mesh(new BoxGeometry(0.4 + (i % 2) * 0.25, 0.004, 0.012), bright);
    ray.position.x = 0.3 + (i % 2) * 0.12;
    const arm = new Group();
    arm.rotation.y = (i / 16) * Math.PI * 2;
    arm.add(ray);
    rays.add(arm);
  }
  group.add(rays);
  return {
    group,
    animate(spin, time, light) {
      rings[0].rotation.y = spin * 0.6;
      rings[1].rotation.y = -spin * 0.45;
      rings[2].rotation.y = spin * 0.3;
      rays.rotation.y = -spin * 0.2;
      heart.scale.setScalar(1 + 0.15 * Math.sin(time * 2) + 0.2 * Math.min(light, 2));
      bright.opacity = Math.min(1, 0.5 + 0.3 * light);
    },
  };
}
