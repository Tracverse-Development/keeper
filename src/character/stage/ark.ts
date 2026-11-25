/**
 * The ark beneath Umoja: a polished gold hull crescent (the Umoja Ark brand mark, an
 * ark on waves) that rocks gently, floating over three thin gold wave rings that ripple
 * outward and fade, like light on water.
 *
 * The hull is an extruded, bevelled crescent built from two Bezier curves, so it reads
 * as a crafted jewel rather than a primitive. The rings share one wavy tube geometry
 * (a hair-thin torus) and each scales and fades on its own phase.
 */
import {
  AdditiveBlending,
  Color,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Shape,
  TorusGeometry,
} from 'three';
import { disposeTree } from '../dispose-tree';
import { PALETTE } from '../palette';

const ARK_Y = -2.32;
const RING_Y = -2.58;
const RING_COUNT = 3;
const RIPPLE_SECONDS = 7;

export interface ArkFrame {
  time: number;
  amplitude: number;
  speed: number;
  /** 0..1 overall light (asleep dims the rings). */
  presence: number;
}

export interface Ark {
  readonly group: Group;
  update(frame: ArkFrame): void;
  dispose(): void;
}

export function createArk(): Ark {
  const group = new Group();
  group.name = 'ark';

  const gold = new MeshPhysicalMaterial({
    color: PALETTE.gold500,
    roughness: 0.18,
    metalness: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    emissive: new Color(PALETTE.gold600),
    emissiveIntensity: 0.12,
  });
  const hull = new Mesh(buildHullGeometry(), gold);
  hull.position.y = ARK_Y;
  group.add(hull);

  const ringGeometry = new TorusGeometry(1, 0.0065, 8, 256);
  ringGeometry.rotateX(Math.PI / 2);
  const rings = Array.from({ length: RING_COUNT }, () => {
    const material = new MeshBasicMaterial({
      color: new Color(PALETTE.gold400).multiplyScalar(1.4),
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const ring = new Mesh(ringGeometry, material);
    ring.position.y = RING_Y;
    group.add(ring);
    return { ring, material };
  });

  function update(frame: ArkFrame): void {
    const { time, amplitude, speed } = frame;
    hull.rotation.z = Math.sin(time * 0.55 * speed) * 0.055 * amplitude;
    hull.rotation.x = Math.sin(time * 0.37 * speed + 1.1) * 0.03 * amplitude;
    hull.position.y = ARK_Y + Math.sin(time * 0.55 * speed - 0.8) * 0.035 * amplitude;
    gold.emissiveIntensity = 0.04 + 0.12 * frame.presence;

    rings.forEach(({ ring, material }, i) => {
      const phase = (((time * speed) / RIPPLE_SECONDS + i / RING_COUNT) % 1 + 1) % 1;
      const radius = 0.75 + phase * 1.75;
      ring.scale.set(radius, 1, radius);
      material.opacity = Math.sin(phase * Math.PI) ** 1.5 * 0.55 * (0.35 + 0.65 * frame.presence);
    });
  }

  return { group, update, dispose: () => disposeTree(group) };
}

/** The hull crescent: a deep Bezier keel under a shallower deck line, tips raised. */
function buildHullGeometry(): ExtrudeGeometry {
  const shape = new Shape();
  shape.moveTo(-1, 0.16);
  shape.bezierCurveTo(-0.72, -0.5, 0.72, -0.5, 1, 0.16);
  shape.bezierCurveTo(0.6, -0.16, -0.6, -0.16, -1, 0.16);
  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.34,
    curveSegments: 96,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.04,
    bevelSegments: 8,
  });
  geometry.center();
  geometry.scale(0.88, 0.88, 0.88);
  return geometry;
}
