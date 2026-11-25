/**
 * The Ark Hull part (slot `base`, any species): a polished gold hull crescent (the Umoja
 * Ark brand mark, an ark on waves) that rocks gently, floating over three thin gold wave
 * rings that ripple outward and fade, like light on water.
 *
 * Effects: `color` re-tints the hull and rings; `rock` scales how far it rocks. Work makes
 * the ripples run faster and brighter (their clock is accumulated, so speeding up never
 * makes the rings jump).
 *
 * The hull is an extruded, bevelled crescent built from two Bezier curves, so it reads
 * as a crafted jewel rather than a primitive. The rings share one wavy tube geometry
 * (a hair-thin torus) and each scales and fades on its own phase.
 */
import {
  AdditiveBlending,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Shape,
  TorusGeometry,
} from 'three';
import { disposeTree } from '../../dispose-tree';
import { PALETTE } from '../../palette';
import { effectColour, effectNumber, type EffectValues } from '../effects';
import type { PartFrame, PartInstance } from '../part';
import { tintColour } from '../tint';

const ARK_Y = -2.32;
const RING_Y = -2.58;
const RING_COUNT = 3;
const RIPPLE_SECONDS = 7;
/** At full work the ripples run this much faster and the rings this much brighter. */
const WORK_RIPPLE_SPEED = 1.6;
const WORK_RING_GLOW = 0.4;

export function createArkHull(effects: EffectValues): PartInstance {
  const colour = effectColour(effects, 'color');
  const rock = effectNumber(effects, 'rock');
  const group = new Group();
  group.name = 'ark';

  const gold = new MeshPhysicalMaterial({
    color: tintColour(PALETTE.gold500, colour),
    roughness: 0.18,
    metalness: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    emissive: tintColour(PALETTE.gold600, colour),
    emissiveIntensity: 0.12,
  });
  const hull = new Mesh(buildHullGeometry(), gold);
  hull.position.y = ARK_Y;
  group.add(hull);

  const ringGeometry = new TorusGeometry(1, 0.0065, 8, 256);
  ringGeometry.rotateX(Math.PI / 2);
  const rings = Array.from({ length: RING_COUNT }, () => {
    const material = new MeshBasicMaterial({
      color: tintColour(PALETTE.gold400, colour).multiplyScalar(1.4),
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

  let rippleClock = 0;

  function update(frame: PartFrame): void {
    const { time, work } = frame;
    const { amplitude, speed } = frame.motion;
    const presence = frame.mood.presence;
    hull.rotation.z = Math.sin(time * 0.55 * speed) * 0.055 * amplitude * rock;
    hull.rotation.x = Math.sin(time * 0.37 * speed + 1.1) * 0.03 * amplitude * rock;
    hull.position.y = ARK_Y + Math.sin(time * 0.55 * speed - 0.8) * 0.035 * amplitude * rock;
    gold.emissiveIntensity = 0.04 + 0.12 * presence;

    rippleClock += frame.dt * speed * (1 + WORK_RIPPLE_SPEED * work);
    const ringLight = (0.35 + 0.65 * presence) * (1 + WORK_RING_GLOW * work);
    for (let i = 0; i < rings.length; i++) {
      const { ring, material } = rings[i];
      const phase = ((rippleClock / RIPPLE_SECONDS + i / RING_COUNT) % 1 + 1) % 1;
      const radius = 0.75 + phase * 1.75;
      ring.scale.set(radius, 1, radius);
      material.opacity = Math.sin(phase * Math.PI) ** 1.5 * 0.55 * ringLight;
    }
  }

  // Grow and shrink in place, between the hull and its rings, not from the body's centre.
  return { group, pivotY: (ARK_Y + RING_Y) / 2, update, dispose: () => disposeTree(group) };
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
