/**
 * Shell fur: real-time fur for any soft body, drawn as a stack of thin shells pushed out along the
 * surface, each one cut into strands by a 3D cell pattern (a strand is a cell whose disc narrows
 * shell by shell, so it tapers to a point). Roots are dark, tips catch the light, the coat lies
 * back and down, sways a little, and grows longer where a surface faces sideways and down (cheek
 * tufts, a ruff) when the zone asks for `tuft`.
 *
 * Pattern: Decorator over a skin's own meshes. A skin names its fur ZONES (`FurZone`: the coat
 * materials of a paint zone, how long the fur is there); `show(zone, true)` wraps every mesh that
 * wears one of those materials with one instanced draw (SHELLS instances of the mesh's own
 * geometry), built the first time it is shown, so a body with no fur costs nothing. The shells take
 * their colour from the coat material (`sync`, after a repaint), so the look system paints fur like
 * any surface. Any soft skin can use it (the puppy does: a zone whose material is `fur`).
 *
 * The shells are children of the meshes they wrap, so they follow every pose; lengths are set in
 * view space, so a squashed or stretched blob still grows even fur.
 *
 * Level of detail (`detail-level.ts`): a keeper small on screen draws fewer shells
 * (`FUR_DETAIL_SHELLS`), spread over the same length, so the coat keeps its depth and costs a
 * fraction; a keeper filling the Studio draws all of them.
 */
import { createDetailWatch, type DetailLevel } from './detail-level.ts';
import { BufferGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Vector3, Vector4, type Color, type Mesh, type Object3D } from 'three';

/** Shells per furred mesh: more is denser fur and more to draw (one instanced draw per mesh either way). */
export const FUR_SHELLS = 22;
/** Shells drawn at each detail level (the coat's length stays the same; fewer shells, coarser strands). */
export const FUR_DETAIL_SHELLS: Readonly<Record<DetailLevel, number>> = { light: 8, balanced: 14, full: FUR_SHELLS };
/** Strands per world unit (the cell pattern's density). */
const DENSITY = 58;
/** How far the coat is combed down and back, as a share of its length at the tips. */
const COMB = 0.75;
/** Most bare spots one zone can name (the shader's array size). */
const MAX_BARE = 4;

export interface FurZone {
  /** The coat materials of this zone (every mesh wearing one grows fur); the first gives the colour of each its own mesh. */
  readonly materials: readonly MeshStandardMaterial[];
  /** Fur length in world units. */
  readonly length: number;
  /** Extra length where the surface faces sideways and down (0 = even; 1 = twice as long there). */
  readonly tuft?: number;
  /**
   * Spots the fur stays off (the eyes, the nose), as `[x, y, z, radius]` in the space of the furred
   * meshes' parent: no fur inside the radius, growing back to full length by twice it. At most MAX_BARE.
   */
  readonly bare?: readonly (readonly [number, number, number, number])[];
}

export interface FurOptions {
  /**
   * Lighter stand-ins for heavy shared geometries (a skin's fine unit sphere), source to stand-in:
   * the shells of a mesh using the source are drawn with the stand-in. The caller owns both.
   */
  readonly lighter?: ReadonlyMap<BufferGeometry, BufferGeometry>;
}

export interface Fur {
  /** Grows or removes the fur of `zone` (built on first use; unknown zones are ignored). */
  show(zone: string, on: boolean): void;
  /** Cuts the fur of `zone` to `share` of its length (1 = full): under clothes a coat lies short. */
  trim(zone: string, share: number): void;
  /** Copies each coat's colour to its shells (call after a repaint). */
  sync(): void;
  /** Advances the sway. */
  update(time: number): void;
  dispose(): void;
}

interface Shell {
  readonly mesh: InstancedMesh;
  readonly material: MeshStandardMaterial;
  readonly coat: MeshStandardMaterial;
}

const IDENTITY = new Matrix4();

export function createFur(root: Object3D, zones: Readonly<Record<string, FurZone>>, options: FurOptions = {}): Fur {
  const time = { value: 0 };
  const built = new Map<string, Shell[]>();
  // One length per zone, shared by its shells' shaders, so a trim costs one number.
  const lengths = new Map(Object.entries(zones).map(([id, zone]) => [id, { value: zone.length }]));
  // How small the keeper is on screen picks how many shells are drawn; `spread` (FUR_SHELLS / drawn)
  // spaces them over the full length. Both are shared by every coat of this body.
  const watch = createDetailWatch(root);
  const spread = { value: 1 };

  function build(zone: FurZone, length: { value: number }): Shell[] {
    const out: Shell[] = [];
    const sources: Mesh[] = [];
    root.traverse((node) => {
      const mesh = node as Mesh;
      if (mesh.isMesh && !(mesh instanceof InstancedMesh) && !mesh.userData.noFur && zone.materials.includes(mesh.material as MeshStandardMaterial)) sources.push(mesh);
    });
    for (const source of sources) {
      const coat = source.material as MeshStandardMaterial;
      const from = options.lighter?.get(source.geometry) ?? source.geometry;
      const geometry = new BufferGeometry();
      geometry.setIndex(from.getIndex());
      geometry.setAttribute('position', from.getAttribute('position'));
      geometry.setAttribute('normal', from.getAttribute('normal'));
      geometry.setAttribute('aLayer', new InstancedBufferAttribute(Float32Array.from({ length: FUR_SHELLS }, (_, i) => (i + 1) / FUR_SHELLS), 1));
      const scale = { value: new Vector3(1, 1, 1) };
      const offset = { value: new Vector3() };
      const material = furMaterial(coat.color, zone, length, scale, offset, time, spread);
      const mesh = new InstancedMesh(geometry, material, FUR_SHELLS);
      for (let i = 0; i < FUR_SHELLS; i++) mesh.setMatrixAt(i, IDENTITY);
      mesh.name = 'fur';
      mesh.frustumCulled = false;
      mesh.raycast = () => undefined; // touch goes to the body's own proxies
      mesh.onBeforeRender = (renderer, _scene, camera) => {
        scale.value.copy(source.scale);
        offset.value.copy(source.position);
        const drawn = FUR_DETAIL_SHELLS[watch.observe(renderer, camera)];
        spread.value = FUR_SHELLS / drawn;
        mesh.count = drawn;
      };
      source.add(mesh);
      out.push({ mesh, material, coat });
    }
    return out;
  }

  return {
    show(id, on) {
      const zone = zones[id];
      if (!zone) return;
      if (on && !built.has(id)) built.set(id, build(zone, lengths.get(id)!));
      for (const shell of built.get(id) ?? []) shell.mesh.visible = on;
    },
    trim(id, share) {
      const length = lengths.get(id);
      if (length) length.value = zones[id].length * Math.min(Math.max(share, 0), 1);
    },
    sync() {
      for (const shells of built.values()) for (const s of shells) s.material.color.copy(s.coat.color);
    },
    update(t) {
      time.value = t;
    },
    dispose() {
      for (const shells of built.values()) {
        for (const s of shells) {
          s.mesh.removeFromParent();
          s.mesh.dispose();
          s.material.dispose();
        }
      }
      built.clear();
    },
  };
}

/** One furred mesh's material: a lit standard material whose shader pushes shells out and cuts strands. */
function furMaterial(colour: Color, zone: FurZone, length: { value: number }, scale: { value: Vector3 }, offset: { value: Vector3 }, time: { value: number }, spread: { value: number }): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ color: colour.clone(), roughness: 0.92, metalness: 0 });
  material.customProgramCacheKey = () => 'fur-shells';
  material.onBeforeCompile = (shader) => {
    const bare = Array.from({ length: MAX_BARE }, (_, i) => new Vector4(...(zone.bare?.[i] ?? [0, 0, 0, 0])));
    Object.assign(shader.uniforms, { uFurLength: length, uFurTuft: { value: zone.tuft ?? 0 }, uFurScale: scale, uFurOffset: offset, uFurBare: { value: bare }, uFurTime: time, uFurSpread: spread });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_HEAD}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX_PUSH}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_HEAD}`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec4 diffuseColor = vec4( diffuse, opacity );\n${FRAGMENT_STRANDS}`);
  };
  return material;
}

const VERTEX_HEAD = /* glsl */ `
  attribute float aLayer;
  uniform float uFurLength;
  uniform float uFurTuft;
  uniform vec3 uFurScale;
  uniform vec3 uFurOffset;
  uniform vec4 uFurBare[${MAX_BARE}];
  uniform float uFurTime;
  uniform float uFurSpread;
  varying vec3 vFurPos;
  varying float vFurLayer;
  varying float vFurGrow;
`;

/** After the view position is known: out along the normal, then combed down and back, more toward the tip. */
const VERTEX_PUSH = /* glsl */ `
  float furLayer = min(aLayer * uFurSpread, 1.0); // fewer shells drawn: the same length, further apart
  vFurLayer = furLayer;
  vFurPos = position * uFurScale;
  vec3 furN = normalize(normalMatrix * normal);
  float furTuft = 1.0 + uFurTuft * smoothstep(0.25, 0.95, abs(normal.x)) * smoothstep(0.35, -0.5, normal.y);
  float furGrow = 1.0;
  vec3 furAt = vFurPos + uFurOffset;
  for (int i = 0; i < ${MAX_BARE}; i++) {
    if (uFurBare[i].w > 0.0) furGrow = min(furGrow, smoothstep(uFurBare[i].w, uFurBare[i].w * 2.0, distance(furAt, uFurBare[i].xyz)));
  }
  vFurGrow = furGrow;
  float furH = uFurLength * furTuft * furGrow * furLayer;
  vec3 furDown = (viewMatrix * vec4(0.0, -1.0, 0.0, 0.0)).xyz;
  vec3 furBack = normalize((modelViewMatrix * vec4(0.0, 0.0, -1.0, 0.0)).xyz);
  float furSway = sin(uFurTime * 1.7 + position.x * 9.0 + position.y * 7.0) * 0.08;
  mvPosition.xyz += furN * furH + (furDown * (0.7 + furSway) + furBack * 0.3) * furH * furLayer * ${COMB.toFixed(2)};
  gl_Position = projectionMatrix * mvPosition;
`;

const FRAGMENT_HEAD = /* glsl */ `
  varying vec3 vFurPos;
  varying float vFurLayer;
  varying float vFurGrow;
  float furHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
`;

/** A strand is a cell: it lives up to its own length, and its disc narrows toward the tip. */
const FRAGMENT_STRANDS = /* glsl */ `
  vec3 furP = vFurPos * ${DENSITY.toFixed(1)};
  vec3 furCell = floor(furP);
  vec3 furIn = fract(furP) - 0.5;
  float furRnd = furHash(furCell);
  vec3 furJit = (vec3(furHash(furCell + 7.1), furHash(furCell + 13.7), furHash(furCell + 29.3)) - 0.5) * 0.4;
  float furT = vFurLayer / (0.5 + 0.5 * furRnd);
  if (furT > 1.0 || vFurGrow < 0.02) discard;
  if (length(furIn - furJit) > 0.66 * (1.0 - 0.85 * furT * furT)) discard;
  diffuseColor.rgb *= mix(0.4, 1.14, vFurLayer) * (0.84 + 0.3 * furHash(furCell + 3.3));
`;
