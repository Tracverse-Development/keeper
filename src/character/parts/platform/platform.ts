/**
 * The Platform (slot `base`, any species, floating): what the keeper stands on, in place of the ark
 * (it sits where the Ark Hull sits: `ark-hull.ts` ARK_Y). One kit, seven shapes, picked by `style`:
 *   0 hover ring - a humming metal ring with a glowing inner band, pulses of light dropping below it
 *   1 cushion    - a round plump cushion with piping and a button, softly breathing
 *   2 branch     - a mossy branch perch with two twigs and leaves
 *   3 stone      - a flat river stone with moss on top
 *   4 waves      - a pool of gently lapping water with foam rings running out
 *   5 spotlight  - a cone of stage light from above onto a bright pool of light
 *   6 cloud      - a bank of cloud lit gold from beneath, with light motes in it (the God Keeper's throne)
 *
 * Pattern: Strategy by data (one builder per style, each with its own `animate`). Effects: `color`
 * (the main material), `trim` (the accent: band, piping, moss, foam), `glow` (how bright its light
 * is; more with work), `style`. Floating: it ignores the body's shape.
 */
import { BufferAttribute, CylinderGeometry, Group, IcosahedronGeometry, Mesh, MeshBasicMaterial, RingGeometry, SphereGeometry, TorusGeometry, Color, type BufferGeometry } from 'three';
import { disposeTree } from '../../dispose-tree';
import { clothMaterial, trimMaterial } from '../cloth';
import { effectColour, effectNumber, type EffectValues } from '../effects';
import type { PartFrame, PartInstance } from '../part';
import { fadingLightMaterial, glowDisc, lightMaterial, metalMaterial } from '../glow-kit';

/** The stand's top, where the keeper's feet are (the ark's height: `ark-hull.ts`). */
const TOP_Y = -2.26;
const STYLES = 7;
const WORK_GLOW = 0.7;
/** The water pool's radius, and how much bigger than designed the small stands are drawn. */
const POOL = 1.25;
const GROW = [1.2, 1.2, 1, 1.15, 1, 1, 1] as const;

interface Kit {
  readonly colour: number;
  readonly trim: number;
}

interface Built {
  readonly group: Group;
  /** One step at `time` with light level `light` (0..~3). */
  animate(time: number, light: number, dt: number): void;
}

export function createPlatform(effects: EffectValues): PartInstance {
  const kit: Kit = { colour: effectColour(effects, 'color'), trim: effectColour(effects, 'trim') };
  const glow = effectNumber(effects, 'glow');
  const style = Math.min(Math.max(Math.round(effectNumber(effects, 'style')), 0), STYLES - 1);
  const group = new Group();
  group.name = 'platform';
  const built = [hoverRing, cushion, branch, stone, waves, spotlight, cloud][style](kit);
  built.group.position.y = TOP_Y;
  built.group.scale.setScalar(GROW[style]);
  group.add(built.group);

  function update(frame: PartFrame): void {
    const light = glow * (0.5 + 0.5 * frame.mood.presence) * (1 + WORK_GLOW * frame.work + frame.gotIt);
    built.animate(frame.time * frame.motion.speed, light, frame.dt);
  }

  return { group, pivotY: TOP_Y, update, dispose: () => disposeTree(group) };
}

function flatRing(radius: number, tube: number): TorusGeometry {
  const geometry = new TorusGeometry(radius, tube, 16, 128);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function hoverRing(kit: Kit): Built {
  const group = new Group();
  const metal = metalMaterial(kit.colour, 0.25, 0.05);
  const band = lightMaterial(kit.trim, 2, 0.9);
  const shell = new Mesh(flatRing(0.95, 0.075), metal);
  shell.scale.y = 0.6;
  const inner = new Mesh(flatRing(0.86, 0.022), band);
  const outer = new Mesh(flatRing(1.03, 0.012), band);
  const floor = new Mesh(glowDisc(1.1, kit.trim, 1.3), fadingLightMaterial(0.45));
  group.add(floor, shell, inner, outer);
  const pulses = [0, 1, 2].map(() => {
    const m = new Mesh(flatRing(0.9, 0.008), lightMaterial(kit.trim, 1.6, 0));
    group.add(m);
    return m;
  });
  return {
    group,
    animate(time, light) {
      group.position.y = TOP_Y + Math.sin(time * 1.4) * 0.03;
      band.opacity = Math.min(1, 0.55 + 0.3 * light * (0.85 + 0.15 * Math.sin(time * 18)));
      (floor.material as MeshBasicMaterial).opacity = 0.25 + 0.2 * light;
      pulses.forEach((p, i) => {
        const phase = (time * 0.6 + i / 3) % 1;
        p.position.y = -phase * 0.5;
        p.scale.setScalar(1 - phase * 0.35);
        (p.material as MeshBasicMaterial).opacity = (1 - phase) * 0.6 * Math.min(light, 1.5);
      });
    },
  };
}

function cushion(kit: Kit): Built {
  const group = new Group();
  const cloth = clothMaterial(kit.colour, 0.85);
  const pillow = new Mesh(new SphereGeometry(1, 48, 24), cloth);
  pillow.scale.set(1.05, 0.2, 0.9);
  pillow.position.y = -0.14;
  const piping = new Mesh(flatRing(1, 0.035), trimMaterial(kit.trim));
  piping.scale.set(1.05, 1, 0.9);
  piping.position.y = -0.14;
  const button = new Mesh(new SphereGeometry(0.05, 16, 10), trimMaterial(kit.trim));
  button.scale.y = 0.5;
  button.position.y = 0.05;
  group.add(pillow, piping, button);
  return { group, animate: (time) => { pillow.scale.y = 0.2 + 0.006 * Math.sin(time * 1.1); } };
}

function branch(kit: Kit): Built {
  const group = new Group();
  const bark = clothMaterial(kit.colour, 0.95);
  const moss = clothMaterial(kit.trim, 0.9);
  const log = new Mesh(new CylinderGeometry(0.11, 0.14, 2.3, 18, 6), bark);
  log.rotation.z = Math.PI / 2 + 0.05;
  log.position.y = -0.1;
  group.add(log);
  for (const [x, a, len] of [[0.8, 0.7, 0.55], [-0.75, -0.9, 0.45]] as const) {
    const twig = new Mesh(new CylinderGeometry(0.025, 0.05, len, 10), bark);
    twig.position.set(x + Math.sin(a) * len * 0.4, -0.05 + Math.cos(a) * len * 0.4, 0);
    twig.rotation.z = -a;
    group.add(twig);
    for (let i = 0; i < 3; i++) {
      const leaf = new Mesh(new SphereGeometry(1, 12, 8), moss);
      leaf.scale.set(0.09, 0.02, 0.05);
      leaf.position.set(x + Math.sin(a) * len * (0.75 + i * 0.1), -0.05 + Math.cos(a) * len * (0.75 + i * 0.1), (i - 1) * 0.06);
      leaf.rotation.set(0.4 * i, i, -a + 0.5);
      group.add(leaf);
    }
  }
  for (let i = 0; i < 9; i++) {
    const tuft = new Mesh(new SphereGeometry(1, 14, 10), moss);
    tuft.scale.set(0.14 + (i % 3) * 0.04, 0.05, 0.12);
    tuft.position.set(-0.9 + i * 0.22, 0.02 - Math.abs(i - 4) * 0.004, (i % 2) * 0.04 - 0.02);
    group.add(tuft);
  }
  return { group, animate: (time) => { group.rotation.z = Math.sin(time * 0.5) * 0.015; } };
}

/** A lumpy stone: an icosphere pushed in and out by a fixed pattern (no randomness, so it never changes). */
function lumpy(geometry: BufferGeometry, amount: number): BufferGeometry {
  const p = geometry.getAttribute('position') as BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + amount * (Math.sin(x * 5.1 + z * 3.3) * 0.6 + Math.sin(z * 7.7 - y * 2.1) * 0.4);
    p.setXYZ(i, x * k, y * k, z * k);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function stone(kit: Kit): Built {
  const group = new Group();
  const rock = new Mesh(lumpy(new IcosahedronGeometry(1, 4), 0.06), clothMaterial(kit.colour, 0.92));
  rock.scale.set(1.0, 0.26, 0.8);
  rock.position.y = -0.24;
  const cap = new Mesh(lumpy(new SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.35), 0.08), clothMaterial(kit.trim, 0.95));
  cap.scale.set(0.8, 0.26, 0.64);
  cap.position.y = -0.22;
  group.add(rock, cap);
  return { group, animate: () => undefined };
}

function waves(kit: Kit): Built {
  const group = new Group();
  // A round pool: a disc with rings of vertices from the middle out, so the waves can run across it.
  const water = new RingGeometry(0.001, POOL, 96, 28);
  water.rotateX(-Math.PI / 2);
  const rest = Float32Array.from(water.getAttribute('position').array as Float32Array);
  // Glassy water lit a little from within, so it reads even seen almost edge on, over a body of
  // water (a shallow drum, fading down) that gives the pool its depth.
  const waterMaterial = metalMaterial(kit.colour, 0.12, 0.35);
  waterMaterial.metalness = 0.25;
  waterMaterial.transparent = true;
  waterMaterial.opacity = 0.9;
  const surface = new Mesh(water, waterMaterial);
  surface.position.y = -0.12;
  const depth = new Mesh(new CylinderGeometry(POOL, POOL * 0.9, 0.22, 96, 1, true), lightMaterial(kit.colour, 0.6, 0.35));
  depth.position.y = -0.23;
  group.add(depth, surface);
  const foams = [0, 1, 2, 3].map(() => {
    const m = new Mesh(flatRing(1, 0.01), lightMaterial(kit.trim, 0.7, 0));
    group.add(m);
    return m;
  });
  const p = water.getAttribute('position') as BufferAttribute;
  return {
    group,
    animate(time, light) {
      for (let i = 0; i < p.count; i++) {
        const x = rest[i * 3], z = rest[i * 3 + 2];
        const r = Math.hypot(x, z);
        // Waves calm toward the rim, so the pool's edge stays level.
        const calm = 1 - (r / POOL) ** 2;
        p.setY(i, (0.035 * Math.sin(r * 6 - time * 2) + 0.018 * Math.sin(x * 4 + time * 1.3)) * calm);
      }
      p.needsUpdate = true;
      water.computeVertexNormals();
      foams.forEach((f, i) => {
        const phase = (time * 0.18 + i / 4) % 1;
        f.scale.setScalar(0.5 + phase * 0.8);
        f.position.y = -0.09;
        (f.material as MeshBasicMaterial).opacity = Math.sin(phase * Math.PI) * 0.45 * Math.min(1.2, 0.5 + light);
      });
    },
  };
}

/** A beam of light from a lamp above: faint, brightest near the floor, fading to nothing at the top (vertex colours). */
function lightCone(radius: number, height: number, colour: number): CylinderGeometry {
  const geometry = new CylinderGeometry(radius * 0.18, radius, height, 64, 12, true);
  const p = geometry.getAttribute('position');
  const colours = new Float32Array(p.count * 3);
  const c = new Color(colour);
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + height / 2) / height; // 0 at the wide floor end, 1 at the lamp
    const k = 0.4 * (1 - t) ** 1.4;
    colours.set([c.r * k, c.g * k, c.b * k], i * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colours, 3));
  return geometry;
}

function spotlight(kit: Kit): Built {
  const group = new Group();
  const pool = new Mesh(glowDisc(1.2, kit.colour, 1.2), fadingLightMaterial(0.9));
  pool.position.y = -0.05;
  const core = new Mesh(glowDisc(0.7, 0xffffff, 1.8), fadingLightMaterial(0.5));
  core.position.y = -0.04;
  const HEIGHT = 5.2;
  const cone = new Mesh(lightCone(1.15, HEIGHT, kit.colour), fadingLightMaterial(0.35));
  cone.position.y = HEIGHT / 2 - 0.05;
  const rim = new Mesh(flatRing(1.15, 0.01), lightMaterial(kit.trim, 1.6, 0.6));
  rim.position.y = -0.04;
  group.add(cone, pool, core, rim);
  return {
    group,
    animate(time, light) {
      const flick = 0.92 + 0.08 * Math.sin(time * 3.1) * Math.sin(time * 1.7);
      (cone.material as MeshBasicMaterial).opacity = Math.min(0.28, 0.06 + 0.05 * light * flick);
      (pool.material as MeshBasicMaterial).opacity = Math.min(1, 0.45 + 0.35 * light) * flick;
      (core.material as MeshBasicMaterial).opacity = 0.25 + 0.2 * light;
    },
  };
}

function cloud(kit: Kit): Built {
  const group = new Group();
  const puff = new SphereGeometry(1, 28, 18);
  const vapour = clothMaterial(kit.colour, 0.95);
  vapour.emissive.set(kit.trim);
  vapour.emissiveIntensity = 0.12;
  vapour.sheenColor.set(kit.trim);
  const puffs: Mesh[] = [];
  const PUFFS = 16;
  for (let i = 0; i < PUFFS; i++) {
    const a = (i / PUFFS) * Math.PI * 2 + (i % 3) * 0.3;
    const r = i % 2 ? 0.95 : 0.55;
    const m = new Mesh(puff, vapour);
    const s = 0.28 + ((i * 37) % 10) / 50;
    m.scale.set(s * 1.3, s * 0.7, s);
    m.position.set(Math.cos(a) * r, -0.22 + ((i * 13) % 5) / 40, Math.sin(a) * r * 0.75);
    m.userData.restY = m.position.y;
    group.add(m);
    puffs.push(m);
  }
  const under = new Mesh(glowDisc(1.6, kit.trim, 1.4), fadingLightMaterial(0.8));
  under.position.y = -0.42;
  const halo = new Mesh(flatRing(1.25, 0.01), lightMaterial(kit.trim, 2.2, 0.7));
  halo.position.y = -0.3;
  group.add(under, halo);
  const motes = new Group();
  const mote = new SphereGeometry(0.018, 8, 6);
  const moteLight = lightMaterial(kit.trim, 3, 0.9);
  for (let i = 0; i < 24; i++) {
    const m = new Mesh(mote, moteLight);
    const a = (i / 24) * Math.PI * 2;
    m.position.set(Math.cos(a) * (0.5 + (i % 4) * 0.25), -0.1, Math.sin(a) * (0.4 + (i % 3) * 0.25));
    motes.add(m);
  }
  group.add(motes);
  return {
    group,
    animate(time, light) {
      puffs.forEach((m, i) => (m.position.y = (m.userData.restY as number) + Math.sin(time * 0.6 + i) * 0.025));
      vapour.emissiveIntensity = 0.08 + 0.1 * light;
      (under.material as MeshBasicMaterial).opacity = 0.45 + 0.25 * light;
      motes.rotation.y = time * 0.15;
      motes.children.forEach((m, i) => (m.position.y = -0.1 + ((time * 0.12 + i / 24) % 1) * 0.5));
      moteLight.opacity = Math.min(1, 0.4 + 0.3 * light);
    },
  };
}
