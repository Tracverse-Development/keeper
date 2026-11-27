/**
 * The character module's ONLY public entry. Everything else in `src/character/` is
 * internal: import from here, never from a file inside the folder.
 *
 *   createCharacter(canvas, { skin, wearables, look, habits }) -> Character   (imperative: any canvas)
 *   <CharacterStage skin wearables look habits focusZone work mood voiceLevel mouth memoryPulse turnable turnAround onTouch />   (React)
 *   STAGE_MOODS, MOOD_SPECS, SET_MOODS (the stage's light moods, and which set brings which)
 *   LOOK_ZONES, MATERIALS (the paint zones per species and the materials a zone can take)
 *   HABITS, SPECIES_HABITS (the habits, which species have each, and each species' defaults)
 *   EMOTE_NAMES          (every emote `Character.emote` plays: wave, celebrate, streak, love, ...)
 *   SKINS                (the species it can be, with the slots each offers)
 *   PARTS                (the wearables: id, name, slot, species, effects schema)
 *   DEFAULT_WEARABLES    (the shipped look: Memory Halo + Ark Hull)
 */
export type { Character, Emote, Expression, Feeling, Habits, HitRegion, Look, Mood, TouchKind, TurnCommand, WornPart, ZoneFocus } from './contract';
export { LOOK_ZONES, MATERIALS, type MaterialId } from './look/zones';
export { HABITS, SPECIES_HABITS, type HabitInfo } from './habits';
export { EMOTE_NAMES } from './emotes';
export { createCharacter, type CreateCharacterOptions } from './create-character';
export { CharacterStage, type CharacterStageProps } from './CharacterStage';
export { DEFAULT_SKIN_ID, SKINS, type SkinInfo, type SlotPlacement } from './skins/catalog';
export { DEFAULT_WEARABLES, PARTS, SLOTS, SLOT_IDS, type PartInfo, type SlotId } from './parts/catalog';
export type { ColourEffect, EffectSchema, EffectSpec, NumberEffect } from './parts/effects';
