/**
 * The chat list's rules: pinned chats first (each group newest first), and when a search is
 * long enough to run. Pure, so they are tested.
 */
import type { Chat } from '../kernel/ipc-chats';

/** A search runs from this many characters. */
export const MIN_SEARCH = 2;

/** Pinned chats first, then the rest, each in the order given (the core sends newest first). */
export function ordered(chats: readonly Chat[]): Chat[] {
  return [...chats.filter((c) => c.pinned), ...chats.filter((c) => !c.pinned)];
}

export function searchable(query: string): boolean {
  return query.trim().length >= MIN_SEARCH;
}
