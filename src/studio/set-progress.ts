/**
 * Set progress you can feel: which pieces of each set a keeper has opened, what a level up just
 * opened ("Gala Night: 4 of 5 ready"), which pieces are new since the person last looked at the
 * Sets side, and which modes wear a set (loadouts). Pure rules (tested by `set-progress.test.ts`),
 * plus the small per-keeper "seen" memory kept in this browser's storage (a convenience: losing it
 * only shows the badges again).
 */
import type { Rarity, Wardrobe } from '../kernel/ipc';

/** Pieces of `set` this keeper's body may wear and its `level` opens (wardrobe ids). */
export function openPieces(w: Wardrobe, rarities: readonly Rarity[], keeper: string, set: string, level: number): string[] {
  const wears = new Set(w.keepers.find((k) => k.id === keeper)?.wears ?? []);
  const levelOf = (id: string | undefined) => rarities.find((r) => r.id === id)?.level ?? 1;
  return w.items.filter((i) => i.set === set && wears.has(i.id) && Math.max(1, level) >= levelOf(i.rarity)).map((i) => i.id);
}

/**
 * The level a level-up event came from: its `from` (several levels can be gained at once, so the
 * notes must count every piece opened on the way), else the level below (an older core).
 */
export function levelBefore(e: { level: number; from?: unknown }): number {
  return typeof e.from === 'number' && Number.isFinite(e.from) && e.from < e.level ? e.from : e.level - 1;
}

/** One line per set a level up moved forward: "Gala Night: 4 of 5 ready". */
export function levelUpNotes(w: Wardrobe, rarities: readonly Rarity[], keeper: string, from: number, to: number): string[] {
  const wears = new Set(w.keepers.find((k) => k.id === keeper)?.wears ?? []);
  return (w.sets ?? []).flatMap((set) => {
    const before = openPieces(w, rarities, keeper, set.id, from).length;
    const after = openPieces(w, rarities, keeper, set.id, to).length;
    const total = w.items.filter((i) => i.set === set.id && wears.has(i.id)).length;
    if (after <= before || total === 0) return [];
    return [after === total ? `${set.name}: every piece ready` : `${set.name}: ${after} of ${total} ready`];
  });
}

/** Pieces opened that the person has not seen on the Sets side yet. */
export function newPieces(open: readonly string[], seen: ReadonlySet<string>): Set<string> {
  return new Set(open.filter((id) => !seen.has(id)));
}

/** The modes that wear `set` (their ids), from a keeper's loadouts. */
export function modesWearing(loadouts: Readonly<Record<string, string>>, set: string): string[] {
  return Object.entries(loadouts)
    .filter(([, s]) => s === set)
    .map(([mode]) => mode);
}

/**
 * What to save when the person picks `mode` for `set` ('' = none): the old mode for this set is
 * untied, the new one tied. Returns the calls to make, in order.
 */
export function loadoutChanges(loadouts: Readonly<Record<string, string>>, set: string, mode: string): { mode: string; set: string | null }[] {
  const changes: { mode: string; set: string | null }[] = modesWearing(loadouts, set)
    .filter((m) => m !== mode)
    .map((m) => ({ mode: m, set: null }));
  if (mode && loadouts[mode] !== set) changes.push({ mode, set });
  return changes;
}

const SEEN_KEY = 'keeper.seen-set-pieces.';

/** The pieces the person has already seen for `keeper` (empty when storage is unavailable). */
export function readSeen(keeper: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY + keeper);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Remembers `ids` as seen for `keeper` (quietly does nothing when storage is unavailable). */
export function writeSeen(keeper: string, ids: Iterable<string>): void {
  try {
    window.localStorage.setItem(SEEN_KEY + keeper, JSON.stringify([...new Set(ids)]));
  } catch {
    /* a private window or blocked storage: the badges simply show again next time */
  }
}
