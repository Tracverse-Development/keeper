/**
 * The Studio's shapes (`keepers/studio_commands.rs`, `kit/look.rs`, `kit/rarity.rs`,
 * `kit/levels.rs`): look zones, a keeper's own voice, rarity, experience and the Studio's data.
 * Re-exported by `ipc.ts`.
 */
import type { VoiceEngine } from './ipc-types';

export interface ZoneLook {
  color?: string;
  material?: string;
}

export interface KeeperVoice {
  engine: VoiceEngine;
  id: string;
}

/** Rarity, common to mythical (`kit/rarity.rs`): the level it needs and its frame colour. */
export interface Rarity {
  id: string;
  name: string;
  level: number;
  color: string;
}

export interface Unlock {
  level: number;
  id: string;
  name: string;
}

/** A keeper's experience, derived from its own graph (`kit/levels.rs`). */
export interface Experience {
  xp: number;
  level: number;
  levelXp: number;
  nextXp: number;
  done: { turns: number; lessons: number; quizRight: number; actions: number };
  unlocked: Unlock[];
  nextUnlocks: Unlock[];
}

export interface Named {
  id: string;
  name: string;
}

/** What the Studio shows besides the wardrobe (`keeper_studio`). */
export interface StudioInfo {
  keeper: string;
  experience: Experience;
  zones: Named[];
  materials: Named[];
  habits: Named[];
  maxHabit: number;
  rarities: Rarity[];
  partRarity: Record<string, string>;
  unlocks: Unlock[];
}
