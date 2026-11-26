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

/** A personal item: a pendant or a T-shirt print with the person's own picture. */
export type PersonalKind = 'pendant' | 'shirt';

export interface PersonalPicture {
  kind: PersonalKind;
  /** A data URL (the picture never leaves the computer). */
  dataUrl: string;
}

/** A mode (stored as a keeper's `role`): Keeper's built-in, an edited built-in, or the person's own. */
export interface RoleInfo {
  id: string;
  title: string;
  blurb: string;
  /** Its instructions to the engine (Markdown; editable). */
  brief: string;
  /** What it handles, in one line (anything else switches mode). */
  scope: string;
  /** What the mode may touch: talk only, the web, look at the computer, or change it. */
  tools: 'none' | 'web' | 'look' | 'act';
  skills: string[];
  resources: { title: string; url: string }[];
  builtin: boolean;
  edited: boolean;
  /** The keeper may have a simulated mood in this mode (never in Look or Act modes). */
  mood: boolean;
}

/** A point in PAD space: pleasure, arousal (energy), dominance (confidence), each -1..1. */
export interface Pad {
  p: number;
  a: number;
  d: number;
}

/** A keeper's simulated feelings (`feelings::engine`): mood, active emotions, and why. */
export interface FeelingsInfo {
  view: {
    label: string;
    mood: Pad;
    baseline: Pad;
    emotions: { kind: string; intensity: number }[];
    causes: { what: string; emotion: string | null }[];
    steppedAside: boolean;
  } | null;
  off: boolean;
  modesWithMood: string[];
  /** It shows a mood right now in the mode asked about (the character's body follows it). */
  shows: boolean;
}

/** A live reading of this computer (`system::live`). */
export interface SystemLive {
  cpu: number;
  memory: number;
  memoryUsedGb: number;
  memoryTotalGb: number;
  netDownKbps: number;
  netUpKbps: number;
  diskUsedGb: number;
  diskTotalGb: number;
  top: [string, number][];
}

/** A tap on the character (asking for its attention) or a stroke over it (affection). */
export type Touch = 'poke' | 'pat';

/** What a keeper says back to a touch (`assistant::touch::TouchReply`). */
export interface TouchReply {
  line: string;
  /** Its mood word, when it has a mood in this mode. */
  mood: string | null;
  /** Written by the helper model for this keeper and mood (false: composed with no model). */
  written: boolean;
}

/** A focus session (`focus::Session`): reminders are held until `endsAt`. */
export interface FocusSession {
  keeper: string;
  minutes: number;
  startedAt: string;
  endsAt: string;
}

/** One season item with this keeper's progress on its quest (`keepers::season_commands`). */
export interface SeasonQuest {
  id: string;
  name: string;
  part: string;
  slot: string;
  effects: Record<string, number | string>;
  blurb: string;
  /** What to do ("Finish 3 focus sessions"), how far along, and the goal. */
  quest: string;
  done: number;
  goal: number;
  earned: boolean;
  /** Already in the person's inventory. */
  claimed: boolean;
}

/** The season open today (`null` from the core when none is). */
export interface SeasonNow {
  id: string;
  name: string;
  closes: string;
  /** Days left, today included. */
  daysLeft: number;
  items: SeasonQuest[];
}
