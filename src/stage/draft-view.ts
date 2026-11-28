/**
 * Pure helpers for the draft panel (`panels/DraftPanel.tsx`): reading the core's draft safely,
 * the order changed lines appear in (so the person watches the edit happen), the words for
 * what changed, and the talk-box opening for "Change something".
 */
import type { DraftLine, DraftView } from '../kernel/ipc-drafts.ts';

/** The whole reveal takes at most this long, however many lines changed. */
export const REVEAL_MS = 1600;
/** And each changed line follows the last after at most this. */
export const STEP_MS = 140;

/** The words put in the talk box by "Change something"; the next edit updates the same draft. */
export function changeOpening(name: string): string {
  return `About ${name}: `;
}

/**
 * When each line appears: changed lines (removed, added) one after another in order, numbered
 * from 0; unchanged lines and gaps are there from the start (-1).
 */
export function revealOrder(lines: DraftLine[]): number[] {
  let next = 0;
  return lines.map((l) => (l.kind === 'added' || l.kind === 'removed' ? next++ : -1));
}

/** The delay between changed lines, so a long edit still arrives within `REVEAL_MS`. */
export function stepMs(changedLines: number): number {
  return changedLines <= 1 ? STEP_MS : Math.min(STEP_MS, Math.floor(REVEAL_MS / changedLines));
}

/** What changed, in a few words ("2 lines changed", "1 line added", "No changes yet"). */
export function changeWords(v: Pick<DraftView, 'added' | 'removed' | 'changed'>): string {
  if (!v.changed) return 'No changes yet';
  const lines = (n: number) => `${n} ${n === 1 ? 'line' : 'lines'}`;
  const edited = Math.min(v.added, v.removed);
  const parts: string[] = [];
  if (edited) parts.push(`${lines(edited)} changed`);
  if (v.added > edited) parts.push(`${lines(v.added - edited)} added`);
  if (v.removed > edited) parts.push(`${lines(v.removed - edited)} taken out`);
  return parts.length ? parts.join(', ') : 'Only spacing changed';
}

const KINDS = new Set(['same', 'added', 'removed', 'gap']);

function isLine(l: unknown): l is DraftLine {
  if (typeof l !== 'object' || l === null) return false;
  const line = l as Record<string, unknown>;
  const parts = line.parts;
  return typeof line.kind === 'string' && KINDS.has(line.kind) && typeof line.text === 'string'
    && (parts === undefined || (Array.isArray(parts) && parts.every((p) => typeof p?.text === 'string' && typeof p?.changed === 'boolean')));
}

/** The core's draft, checked: anything not in the `DraftView` shape is refused (null). */
export function readDraftView(raw: unknown): DraftView | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const v = raw as Record<string, unknown>;
  const texts = ['draft', 'name', 'folder', 'path', 'text'].every((k) => typeof v[k] === 'string');
  const counts = typeof v.added === 'number' && typeof v.removed === 'number' && typeof v.changed === 'boolean';
  if (!texts || !counts || !Array.isArray(v.lines) || !v.lines.every(isLine)) return null;
  return v as unknown as DraftView;
}
