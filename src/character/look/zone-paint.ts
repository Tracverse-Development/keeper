/**
 * Painting a zone: a body material repainted live with a keeper's colour and material
 * (`zones.ts`), restored to the species' own look when the zone is left out.
 *
 * `PaintableMaterial` snapshots a material's shipped values once, then `paint` restores them and
 * applies the zone's look on top: the colour replaces the base colour, and the material preset
 * sets the surface (`MATERIAL_PRESETS`). Only plain numbers and colours change, so repainting
 * never rebuilds the rig; a feature switching on or off (a clearcoat or sheen lobe going to or
 * from 0) bumps the material's version once and three.js compiles that variant once, never per
 * frame. Skins call `paint` only when the look changes. The glow preset on an iris (`iris-glow.ts`)
 * lights it as a luminous iris with a dark rim instead of one flat disc.
 *
 * Skins that also animate a value per frame (the robot's torso sheen breathes with presence)
 * read the painted rest value back (`rest`), so their animation rides on the painted surface.
 *
 * `ZoneTarget` is what a zone paints: a material (the usual case) or a custom painter (the robot's
 * glyph eyes, its chest core light), so a skin can map any zone onto its own drawing.
 */
import { Color, MeshPhysicalMaterial, type MeshStandardMaterial, type Texture } from 'three';
import { IRIS_GLOW, IRIS_GLOW_BASE, irisGlowMap, isIris } from './iris-glow.ts';
import type { MaterialId, ResolvedZone } from './zones.ts';

/** The surface each material id draws (applied over the colour; fields a material lacks are skipped). */
export const MATERIAL_PRESETS: Readonly<Record<MaterialId, Readonly<SurfacePreset>>> = {
  matte: { roughness: 0.86, metalness: 0, clearcoat: 0, sheen: 0, iridescence: 0, emissive: 0 },
  gloss: { roughness: 0.14, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0, iridescence: 0, emissive: 0 },
  metal: { roughness: 0.36, metalness: 1, clearcoat: 0.1, clearcoatRoughness: 0.2, sheen: 0, iridescence: 0, emissive: 0 },
  fur: { roughness: 0.74, metalness: 0, clearcoat: 0, sheen: 1, sheenRoughness: 0.42, iridescence: 0, emissive: 0 },
  glow: { roughness: 0.4, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.2, sheen: 0, iridescence: 0, emissive: 1.8 },
};

export interface SurfacePreset {
  readonly roughness: number;
  readonly metalness: number;
  readonly clearcoat: number;
  readonly clearcoatRoughness?: number;
  readonly sheen: number;
  readonly sheenRoughness?: number;
  readonly iridescence: number;
  /** Emissive intensity in the zone's own colour (glow); 0 = none. */
  readonly emissive: number;
}

/** Anything a zone can paint. */
export interface ZoneTarget {
  /** Restores the species' own look, then applies `zone` (undefined = leave it as shipped). */
  paint(zone: ResolvedZone | undefined): void;
}

type Paintable = MeshStandardMaterial | MeshPhysicalMaterial;

interface Snapshot {
  color: Color;
  emissive: Color;
  emissiveIntensity: number;
  emissiveMap: Texture | null;
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  sheen: number;
  sheenRoughness: number;
  sheenColor: Color;
  iridescence: number;
}

export class PaintableMaterial implements ZoneTarget {
  readonly material: Paintable;
  private readonly shipped: Snapshot;
  private readonly physical: boolean;

  constructor(material: Paintable) {
    this.material = material;
    this.physical = material instanceof MeshPhysicalMaterial;
    const m = material as MeshPhysicalMaterial;
    this.shipped = {
      color: material.color.clone(),
      emissive: material.emissive.clone(),
      emissiveIntensity: material.emissiveIntensity,
      emissiveMap: material.emissiveMap,
      roughness: material.roughness,
      metalness: material.metalness,
      clearcoat: this.physical ? m.clearcoat : 0,
      clearcoatRoughness: this.physical ? m.clearcoatRoughness : 0,
      sheen: this.physical ? m.sheen : 0,
      sheenRoughness: this.physical ? m.sheenRoughness : 0,
      sheenColor: this.physical ? m.sheenColor.clone() : new Color(),
      iridescence: this.physical ? m.iridescence : 0,
    };
    this.paint(undefined);
  }

  /** The painted rest values a per-frame animation scales from (set by every `paint`). */
  readonly painted = { sheen: 0, emissiveIntensity: 0 };

  paint(zone: ResolvedZone | undefined): void {
    this.apply(zone);
    this.painted.sheen = this.physical ? (this.material as MeshPhysicalMaterial).sheen : 0;
    this.painted.emissiveIntensity = this.material.emissiveIntensity;
  }

  private apply(zone: ResolvedZone | undefined): void {
    const m = this.material;
    const s = this.shipped;
    m.color.copy(s.color);
    m.emissive.copy(s.emissive);
    m.emissiveIntensity = s.emissiveIntensity;
    if (m.emissiveMap !== s.emissiveMap) {
      m.emissiveMap = s.emissiveMap;
      m.needsUpdate = true;
    }
    m.roughness = s.roughness;
    m.metalness = s.metalness;
    const p = m as MeshPhysicalMaterial;
    if (this.physical) {
      p.clearcoat = s.clearcoat;
      p.clearcoatRoughness = s.clearcoatRoughness;
      p.sheen = s.sheen;
      p.sheenRoughness = s.sheenRoughness;
      p.sheenColor.copy(s.sheenColor);
      p.iridescence = s.iridescence;
    }
    if (!zone) return;
    if (zone.color !== undefined) {
      m.color.setHex(zone.color);
      // A coloured coat keeps its velvet edge in its own (lighter) colour, never the old tint.
      if (this.physical && p.sheen > 0) p.sheenColor.setHex(zone.color).lerp(WHITE, 0.35);
    }
    if (!zone.material) return;
    const preset = MATERIAL_PRESETS[zone.material];
    m.roughness = preset.roughness;
    m.metalness = preset.metalness;
    if (preset.emissive > 0) {
      m.emissive.copy(m.color);
      m.emissiveIntensity = preset.emissive;
      if (isIris(m)) {
        // A luminous iris: bright around the pupil, fibred, dark at the rim (never a flat disc).
        m.emissiveIntensity = IRIS_GLOW;
        m.color.multiplyScalar(IRIS_GLOW_BASE);
        m.emissiveMap = irisGlowMap();
        m.needsUpdate = true;
      }
    }
    if (!this.physical) return;
    p.clearcoat = preset.clearcoat;
    p.clearcoatRoughness = preset.clearcoatRoughness ?? s.clearcoatRoughness;
    p.sheen = preset.sheen;
    p.sheenRoughness = preset.sheenRoughness ?? s.sheenRoughness;
    if (preset.sheen > 0) p.sheenColor.copy(m.color).lerp(WHITE, 0.35);
    p.iridescence = preset.iridescence;
  }
}

const WHITE = new Color(0xffffff);

/** A zone made of several targets (a pearl head and its collar; ear rings and their discs). */
export function zoneOf(...targets: ZoneTarget[]): ZoneTarget {
  return { paint: (zone) => targets.forEach((t) => t.paint(zone)) };
}
