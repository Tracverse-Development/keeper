/**
 * The skin registry: the catalogue (`SKINS`) plus the factory for each id.
 *
 * `createSkin(id)` resolves unknown ids to the default, so a stale setting can never
 * leave the window without a face. The factory table is a `Record<SkinId, ...>`: the
 * typecheck fails if a catalogue row has no factory, or a factory has no row.
 */
import { resolveSkinId, type SkinId } from './catalog';
import { createPuppySkin } from './puppy/puppy-skin';
import { createRobotSkin } from './robot/robot-skin';
import { createHumanSkin } from './human/human-skin';
import { createOwlSkin } from './owl/owl-skin';
import { createGodSkin } from './god/god-skin';
import type { Skin, SkinFactory } from './skin';

export { DEFAULT_SKIN_ID, SKINS, isSkinId, resolveSkinId, type SkinId, type SkinInfo } from './catalog';
export type { Skin, SkinFactory, SkinFrame } from './skin';

const FACTORIES: Readonly<Record<SkinId, SkinFactory>> = {
  robot: createRobotSkin,
  puppy: createPuppySkin,
  man: () => createHumanSkin('man'),
  woman: () => createHumanSkin('woman'),
  owl: createOwlSkin,
  god: createGodSkin,
};

/** Builds the skin for `id` (unknown ids get the default skin). */
export function createSkin(id: string): Skin {
  return FACTORIES[resolveSkinId(id)]();
}
