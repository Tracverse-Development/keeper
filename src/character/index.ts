/**
 * The character module's ONLY public entry. Everything else in `src/character/` is
 * internal: import from here, never from a file inside the folder.
 *
 *   createCharacter(canvas, { skin }) -> Character   (imperative: any canvas, any framework)
 *   <CharacterStage skin mood voiceLevel mouth memoryPulse onTouch />   (React)
 *   SKINS                                            (the looks it can wear, for a picker)
 */
export type { Character, HitRegion, Mood, TouchKind } from './contract';
export { createCharacter, type CreateCharacterOptions } from './create-character';
export { CharacterStage, type CharacterStageProps } from './CharacterStage';
export { DEFAULT_SKIN_ID, SKINS, type SkinInfo } from './skins/catalog';
