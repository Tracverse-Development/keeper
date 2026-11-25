/**
 * The memory halo shows the keeper's real graph: it starts with one node per fact the keeper
 * holds (each new memory then adds one live, through `memoryPulse`). The seed is latched once
 * per keeper by the caller, because changing a wearable's effects re-dresses the character.
 */
import type { WornPart } from '../character';

const HALO = 'memory-halo';
/** The halo graph's own capacity; more facts than this still show a full halo. */
const MOST = 48;
/** Even a keeper that knows nothing yet shows a few nodes waiting to be filled. */
const FEWEST = 3;

export function haloNodes(facts: number): number {
  return Math.min(Math.max(Math.round(facts), FEWEST), MOST);
}

/** The keeper's wearables with the halo seeded from its fact count (other parts unchanged). */
export function withFactHalo(worn: readonly WornPart[], facts: number | null): readonly WornPart[] {
  if (facts === null) return worn;
  return worn.map((w) => (w.part === HALO ? { ...w, effects: { ...w.effects, nodes: haloNodes(facts) } } : w));
}
