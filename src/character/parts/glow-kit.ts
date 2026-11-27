/**
 * Shared bits for the glowing kits (the emblem halo, the platform, the drift aura, the cape's wings of
 * light, the thrusters' flames): an additive light material (HDR above 1 blooms on the stage), a
 * polished metal, and a soft radial glow disc. One home so each kit does not grow its own copy.
 */
import { AdditiveBlending, BufferAttribute, CircleGeometry, Color, DoubleSide, MeshBasicMaterial, MeshPhysicalMaterial } from 'three';

/** Light that adds to the scene: `colour` scaled by `strength` (>1 blooms), never writing depth. */
export function lightMaterial(colour: number, strength = 1, opacity = 1): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: new Color(colour).multiplyScalar(strength),
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
    vertexColors: false,
  });
}

/** Additive light whose strength comes from per-vertex colours (a soft glow disc, a fading cone). */
export function fadingLightMaterial(opacity = 1): MeshBasicMaterial {
  return new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false });
}

/** Polished metal in `colour` with a faint glow of its own. */
export function metalMaterial(colour: number, roughness = 0.22, emissive = 0.08): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({ color: colour, roughness, metalness: 1, clearcoat: 0.8, clearcoatRoughness: 0.12, emissive: colour, emissiveIntensity: emissive });
}

/**
 * A flat glow disc of `radius` in the XZ plane: `colour` at the centre fading to nothing at the edge
 * (vertex colours, for `fadingLightMaterial`). `falloff` above 1 keeps the light tighter.
 */
export function glowDisc(radius: number, colour: number, falloff = 1.6, segments = 64): CircleGeometry {
  const geometry = new CircleGeometry(radius, segments, 0, Math.PI * 2);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute('position');
  const colours = new Float32Array(position.count * 3);
  const c = new Color(colour);
  for (let i = 0; i < position.count; i++) {
    const r = Math.hypot(position.getX(i), position.getZ(i)) / radius;
    const k = Math.max(0, 1 - r) ** falloff;
    colours.set([c.r * k, c.g * k, c.b * k], i * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colours, 3));
  return geometry;
}
