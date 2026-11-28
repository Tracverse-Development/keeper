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
  /** Each material: its grade, and whether it is a coat a keeper must obtain (fur, feathers). Absent from an older core = common, pickable. */
  materials: (Named & { rarity?: string; obtainedOnly?: boolean })[];
  /** The coat this body can grow (absent: none). */
  coat?: { material: string; zones: string[] } | null;
  /** The coats this keeper has obtained and may wear. */
  obtained?: string[];
  habits: Named[];
  maxHabit: number;
  rarities: Rarity[];
  partRarity: Record<string, string>;
  unlocks: Unlock[];
  /** The finishes this keeper's body can wear (absent from an older core). */
  finishes?: Finish[];
  /** The starter keepers a person can add in one press (absent from an older core). */
  starters?: Starter[];
}

/** A ready-made paint and material treatment for a body (`kit/finishes.rs`). */
export interface Finish {
  id: string;
  name: string;
  species: string;
  rarity: string;
  blurb: string;
  /** [zone, colour, material] for every zone it paints. */
  look: [string, string, string][];
}

/** A starter keeper (`kit/starters.rs`): a body, a role, a soul and its first piece. */
export interface Starter {
  id: string;
  name: string;
  skin: string;
  role: string;
  soul: string;
  /** The official item id it starts wearing. */
  piece: string;
  blurb: string;
}

/** A personal item: a pendant or a T-shirt print with the person's own picture. */
export type PersonalKind = 'pendant' | 'shirt';

export interface PersonalPicture {
  kind: PersonalKind;
  /** A data URL (the picture never leaves the computer). */
  dataUrl: string;
}

/** Where photo mode saved a still (`photo_save`): the full path, and `Pictures/Keeper/<file>` to show. */
export interface PhotoSaved {
  path: string;
  shown: string;
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
  /** This computer's own address on its network ('' when it is on none). */
  netAddress: string;
  /** Gigabytes received and sent since the computer started. */
  netTotalDownGb: number;
  netTotalUpGb: number;
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

/** One health check (`health::Check`): what was found, and the one fix Keeper can offer. */
export interface HealthCheck {
  id: string;
  name: string;
  level: 'ok' | 'warn' | 'bad';
  detail: string;
  /** The fix's label (`health_fix` with this check's id), or null when there is none. */
  fix: string | null;
}

/** What a pack's signature says (`keepers::kit::pack_sign::Check`). */
export type PackSignature = { state: 'unsigned' } | { state: 'valid'; key: string; fingerprint: string } | { state: 'broken' };

/** Where a pack comes from, checked before it is added (`pack_sign::Trust`). */
export interface PackTrust {
  signature: PackSignature;
  maker: string | null;
  seenBefore: boolean;
  otherKeyForName: boolean;
}
