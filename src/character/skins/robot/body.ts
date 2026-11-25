/**
 * Umoja's body and rig: a pearl head, a navy-glass visor framed in gold, two gold
 * "ear" rings that glow with the microphone, a pearl collar, and a glossy navy torso
 * that tapers into a spirit's tail. A small gold heart-light on the chest is where
 * memory sparks leave from.
 *
 * Rig (every joint is a Group so the animator can move it without touching meshes):
 *   root        - breathing bob and happy bounce
 *   └ body      - lean (listening leans in) and slow sway
 *     ├ torso, collar, chest emblem, heart
 *     └ head    - gaze yaw/pitch, micro tilts, nods; the face is mounted here
 *
 * The torso is a lathe of a Catmull-Rom profile sampled finely, so its silhouette is
 * one continuous crafted curve rather than stacked primitives.
 *
 * Lights are set together (`setLights`): the ear glow follows the microphone, presence dims
 * the whole being asleep, and heat (work) warms the heart-light toward amber and makes the
 * visor's gold rim glow. With heat 0 everything is exactly as it shipped.
 */
import {
  CircleGeometry,
  Color,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  SplineCurve,
  TorusGeometry,
  Vector2,
} from 'three';
import { disposeTree } from '../../dispose-tree';
import { HEAD_RADII, ellipsoidPatch } from './head-shape';
import { PALETTE } from '../../palette';

/** World height of the head centre and of the neck (top of the torso). */
export const HEAD_CENTRE_Y = 0.5;
const NECK_Y = -0.42;

/** The torso silhouette as (radius, height below the neck) control points. */
const TORSO_PROFILE: readonly [number, number][] = [
  [0.001, 0.06],
  [0.2, 0.05],
  [0.31, 0],
  [0.4, -0.14],
  [0.53, -0.36],
  [0.6, -0.6],
  [0.57, -0.84],
  [0.47, -1.06],
  [0.33, -1.27],
  [0.18, -1.41],
  [0.07, -1.48],
  [0.001, -1.5],
];

/** How bright the visor rim glows at full heat. */
const RIM_HEAT = 1.1;

export interface Body {
  readonly root: Group;
  readonly body: Group;
  readonly head: Group;
  /** The chest heart-light (memory sparks start at its world position). */
  readonly heart: Mesh;
  /**
   * Ear glow 0..1 (the microphone level), overall light 0..1 (asleep dims it) and heat
   * 0..1 (work warms the heart-light toward amber, `heartBoost` times brighter at full heat,
   * and lights the visor rim), all already eased.
   */
  setLights(earGlow: number, presence: number, heat: number, heartBoost: number): void;
  dispose(): void;
}

export function createBody(): Body {
  const pearl = new MeshPhysicalMaterial({
    color: new Color(PALETTE.cream300).multiplyScalar(0.86),
    roughness: 0.34,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.07,
    iridescence: 0.55,
    iridescenceIOR: 1.35,
    iridescenceThicknessMinimum: 180,
    iridescenceThicknessMaximum: 520,
    sheen: 0.35,
    sheenRoughness: 0.35,
    sheenColor: new Color(PALETTE.gold300),
  });
  const navyGloss = new MeshPhysicalMaterial({
    color: PALETTE.navy500,
    roughness: 0.3,
    metalness: 0.55,
    clearcoat: 1,
    clearcoatRoughness: 0.24,
    sheen: 0.7,
    sheenRoughness: 0.45,
    sheenColor: new Color(PALETTE.gold600),
    iridescence: 0.2,
    iridescenceThicknessMinimum: 300,
    iridescenceThicknessMaximum: 700,
    envMapIntensity: 1.1,
  });
  const visorGlass = new MeshPhysicalMaterial({
    color: PALETTE.navy950,
    roughness: 0.3,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.03,
    envMapIntensity: 0.1,
    specularIntensity: 0.35,
  });
  const gold = new MeshPhysicalMaterial({
    color: PALETTE.gold500,
    roughness: 0.22,
    metalness: 1,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1,
  });
  const earGlowMaterial = new MeshStandardMaterial({
    color: PALETTE.navy800,
    emissive: new Color(PALETTE.gold300),
    emissiveIntensity: 0.12,
    roughness: 0.4,
  });
  const heartMaterial = new MeshStandardMaterial({
    color: PALETTE.gold300,
    emissive: new Color(PALETTE.gold300),
    emissiveIntensity: 3,
  });

  const root = new Group();
  root.name = 'umoja';
  const body = new Group();
  root.add(body);

  const torso = new Mesh(new LatheGeometry(torsoPoints(), 128), navyGloss);
  torso.position.y = NECK_Y;
  body.add(torso);

  const collar = new Mesh(new TorusGeometry(0.335, 0.048, 32, 128), pearl);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = NECK_Y + 0.005;
  body.add(collar);

  const { emblem, heart } = buildChestEmblem(gold, heartMaterial);
  body.add(emblem);

  const head = new Group();
  head.position.y = HEAD_CENTRE_Y;
  body.add(head);

  const shell = new Mesh(new SphereGeometry(1, 128, 96), pearl);
  shell.scale.set(HEAD_RADII.x, HEAD_RADII.y, HEAD_RADII.z);
  head.add(shell);

  const visorShape = { halfWidth: 0.7, halfHeight: 0.4, centreY: 0.02, exponent: 4.2 };
  const border = new Mesh(ellipsoidPatch({ ...visorShape, halfWidth: 0.735, halfHeight: 0.435, inflate: 0.006 }), gold);
  // The rim has its own gold so only it (not the ears or the emblem) glows with heat.
  const rimGold = gold.clone();
  rimGold.emissive.set(PALETTE.heatAmber);
  rimGold.emissiveIntensity = 0;
  border.material = rimGold;
  const visor = new Mesh(ellipsoidPatch({ ...visorShape, inflate: 0.013 }), visorGlass);
  head.add(border, visor);

  for (const side of [-1, 1]) head.add(buildEar(side, gold, earGlowMaterial));

  const baseRim = earGlowMaterial.emissiveIntensity;
  const heartRest = heartMaterial.emissive.clone();
  const heartHot = new Color(PALETTE.heatAmber);
  const applyLight = (earGlow: number, presence: number, heat: number, heartBoost: number): void => {
    earGlowMaterial.emissiveIntensity = (baseRim + earGlow * 2.6) * presence;
    heartMaterial.emissiveIntensity = (1 + 2.2 * presence) * (0.85 + earGlow * 0.6) * (1 + heartBoost * heat);
    heartMaterial.emissive.copy(heartRest).lerp(heartHot, heat);
    rimGold.emissiveIntensity = RIM_HEAT * heat * presence;
    navyGloss.sheen = 0.2 + 0.5 * presence;
  };
  applyLight(0, 1, 0, 0);

  return {
    root,
    body,
    head,
    heart,
    setLights: applyLight,
    dispose: () => disposeTree(root),
  };
}

/** The torso profile sampled into a smooth lathe outline. */
function torsoPoints(): Vector2[] {
  const curve = new SplineCurve(TORSO_PROFILE.map(([r, y]) => new Vector2(r, y)));
  return curve.getSpacedPoints(96).map((p) => new Vector2(Math.max(p.x, 0.001), p.y));
}

/** Radius of the torso at a height below the neck (sampled from the profile curve). */
function torsoRadiusAt(depth: number): number {
  const points = torsoPoints();
  let best = points[0];
  for (const p of points) if (Math.abs(p.y - depth) < Math.abs(best.y - depth)) best = p;
  return best.x;
}

/** A gold ark crescent on the chest with the glowing heart-light just above it. */
function buildChestEmblem(gold: MeshPhysicalMaterial, heartMaterial: MeshStandardMaterial): { emblem: Group; heart: Mesh } {
  const emblem = new Group();
  const depth = -0.5;
  const radius = torsoRadiusAt(depth);
  emblem.position.set(0, NECK_Y + depth, radius - 0.012);
  emblem.rotation.x = -0.32; // follow the torso's outward slope at this height

  const hull = new Mesh(new TorusGeometry(0.12, 0.017, 24, 96, Math.PI), gold);
  hull.rotation.z = Math.PI;
  emblem.add(hull);

  const heart = new Mesh(new SphereGeometry(0.038, 32, 24), heartMaterial);
  heart.position.set(0, 0.035, 0.01);
  emblem.add(heart);
  return { emblem, heart };
}

/** A gold ring with a glowing inner disc on one side of the head (side -1 left, 1 right). */
function buildEar(side: number, gold: MeshPhysicalMaterial, glow: MeshStandardMaterial): Group {
  const ear = new Group();
  ear.position.set(side * HEAD_RADII.x * 1.002, 0.02, 0);
  ear.rotation.y = (side * Math.PI) / 2;

  const ring = new Mesh(new TorusGeometry(0.17, 0.038, 32, 96), gold);
  const disc = new Mesh(new CircleGeometry(0.15, 64), glow);
  disc.position.z = 0.012;
  ear.add(ring, disc);
  return ear;
}
