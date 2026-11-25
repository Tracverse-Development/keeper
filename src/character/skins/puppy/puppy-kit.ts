/**
 * The puppy's materials and its one modelling primitive.
 *
 * The coat is `MeshPhysicalMaterial` with a strong warm sheen and soft roughness: sheen
 * is the cloth/fur lobe, so the edges of every rounded form catch a velvety glow under
 * the gold rim lights instead of a plastic highlight. Eyes and nose are the opposite:
 * near-black with a mirror clearcoat, so they read wet and glossy.
 *
 * Every soft form is a `blob`: one shared high-resolution unit sphere scaled into an
 * ellipsoid, so the whole puppy is built from a single geometry (disposed once).
 */
import { Color, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, SphereGeometry, type Material, type Object3D } from 'three';
import { PALETTE } from '../../palette';

export interface PuppyMaterials {
  caramel: MeshPhysicalMaterial;
  caramelDeep: MeshPhysicalMaterial;
  cream: MeshPhysicalMaterial;
  nose: MeshPhysicalMaterial;
  eye: MeshPhysicalMaterial;
  iris: MeshPhysicalMaterial;
  pupil: MeshPhysicalMaterial;
  catchlight: MeshBasicMaterial;
  collar: MeshPhysicalMaterial;
  gold: MeshPhysicalMaterial;
  tagGlow: MeshBasicMaterial;
  tongue: MeshPhysicalMaterial;
  mouth: MeshPhysicalMaterial;
}

export interface PuppyKit {
  readonly materials: PuppyMaterials;
  /** Adds an ellipsoid of `radii` at `position` to `parent`, returns the mesh. */
  blob(parent: Object3D, material: Material, radii: readonly [number, number, number], position: readonly [number, number, number]): Mesh;
}

const fur = (color: number, sheenColor: number): MeshPhysicalMaterial =>
  new MeshPhysicalMaterial({
    color,
    roughness: 0.68,
    metalness: 0,
    sheen: 1,
    sheenRoughness: 0.42,
    sheenColor: new Color(sheenColor),
    envMapIntensity: 0.8,
  });

export function createPuppyKit(): PuppyKit {
  const materials: PuppyMaterials = {
    caramel: fur(PALETTE.caramel500, PALETTE.gold300),
    caramelDeep: fur(PALETTE.caramel700, PALETTE.gold400),
    cream: fur(new Color(PALETTE.coatCream).multiplyScalar(0.92).getHex(), PALETTE.cream50),
    nose: new MeshPhysicalMaterial({
      color: PALETTE.nose900,
      roughness: 0.32,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      sheen: 0.4,
      sheenColor: new Color(PALETTE.navy500),
    }),
    eye: new MeshPhysicalMaterial({
      color: PALETTE.eye950,
      roughness: 0.16,
      specularIntensity: 0.45,
      clearcoat: 0.5,
      clearcoatRoughness: 0.05,
    }),
    iris: new MeshPhysicalMaterial({
      color: PALETTE.iris600,
      emissive: new Color(PALETTE.caramel700),
      emissiveIntensity: 0.3,
      roughness: 0.3,
      specularIntensity: 0.45,
      clearcoat: 0.5,
      clearcoatRoughness: 0.05,
    }),
    pupil: new MeshPhysicalMaterial({ color: 0x030202, roughness: 0.16, specularIntensity: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.05 }),
    // HDR white (above 1) so the catchlights bloom softly, like light in a wet eye.
    catchlight: new MeshBasicMaterial({ color: new Color(PALETTE.cream50).multiplyScalar(1.4) }),
    collar: new MeshPhysicalMaterial({
      color: PALETTE.navy500,
      roughness: 0.38,
      metalness: 0.35,
      clearcoat: 1,
      clearcoatRoughness: 0.2,
      sheen: 0.6,
      sheenRoughness: 0.4,
      sheenColor: new Color(PALETTE.gold600),
    }),
    gold: new MeshPhysicalMaterial({
      color: PALETTE.gold500,
      roughness: 0.22,
      metalness: 1,
      clearcoat: 0.6,
      clearcoatRoughness: 0.1,
    }),
    tagGlow: new MeshBasicMaterial({ color: new Color(PALETTE.gold300).multiplyScalar(3) }),
    tongue: new MeshPhysicalMaterial({ color: PALETTE.tongue400, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
    mouth: new MeshPhysicalMaterial({ color: PALETTE.mouth900, roughness: 0.75 }),
  };

  const sphere = new SphereGeometry(1, 72, 54);
  return {
    materials,
    blob(parent, material, radii, position) {
      const mesh = new Mesh(sphere, material);
      mesh.scale.set(...radii);
      mesh.position.set(...position);
      parent.add(mesh);
      return mesh;
    },
  };
}
