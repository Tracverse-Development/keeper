/**
 * The character module's ONLY public entry. Everything else in `src/character/` is
 * internal: import from here, never from a file inside the folder.
 *
 *   createCharacter(canvas, { skin, wearables }) -> Character   (imperative: any canvas)
 *   <CharacterStage skin wearables work mood voiceLevel mouth memoryPulse onTouch />   (React)
 *   SKINS                (the species it can be, with the slots each offers)
 *   PARTS                (the wearables: id, name, slot, species, effects schema)
 *   DEFAULT_WEARABLES    (the shipped look: Memory Halo + Ark Hull)
 */
export type { Character, HitRegion, Mood, TouchKind, WornPart } from './contract';
export { createCharacter, type CreateCharacterOptions } from './create-character';
export { CharacterStage, type CharacterStageProps } from './CharacterStage';
export { DEFAULT_SKIN_ID, SKINS, type SkinInfo, type SlotPlacement } from './skins/catalog';
export { DEFAULT_WEARABLES, PARTS, SLOT_IDS, type PartInfo, type SlotId } from './parts/catalog';
export type { ColourEffect, EffectSchema, EffectSpec, NumberEffect } from './parts/effects';
