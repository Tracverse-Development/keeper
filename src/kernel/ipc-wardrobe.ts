/**
 * The wardrobe's shapes as the core sends them (`src-tauri/src/keepers/wardrobe_commands.rs` and
 * `kit/wardrobe.rs`, serde camelCase): the person's items, which keepers wear each, and which
 * slots each keeper's body offers. Kept beside `ipc-types.ts` (re-exported by `ipc.ts`).
 */

/**
 * Where a wearable goes: floating round the body, worn on it (fitted to each species), or an
 * effect slot (`thinking`, `celebrate`) whose part changes how a moment looks.
 */
export interface SlotInfo {
  id: string;
  name: string;
  kind: 'floating' | 'worn' | 'effect';
}

/** One thing the person owns. A design can be worn by many keepers; one of a kind by one. */
export interface WardrobeItem {
  /** `part:<id>` (a catalogue part), `stock:<id>` (a built-in variant) or `kit:<id>` (theirs). */
  id: string;
  name: string;
  part: string;
  slot: string;
  effects: Record<string, number | string>;
  oneOfAKind: boolean;
  source: 'built-in' | 'yours';
  /** Keeper ids wearing it. */
  wornBy: string[];
}

export interface WardrobeKeeper {
  id: string;
  name: string;
  species: string;
  /** The slots its body offers. */
  slots: string[];
}

export interface Wardrobe {
  slots: SlotInfo[];
  items: WardrobeItem[];
  keepers: WardrobeKeeper[];
  /** False when the memory node could not be read (only built-in items are listed). */
  complete: boolean;
}

/** Giving an item: `move` (the giver takes it off) or `share` (both wear it; designs only). */
export type GiveMode = 'move' | 'share';

/** A new item of the person's own: a part in their colours, maybe one of a kind. */
export interface NewWardrobeItem {
  name: string;
  part: string;
  effects: Record<string, number | string>;
  oneOfAKind: boolean;
}
