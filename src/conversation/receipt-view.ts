/**
 * The receipt of what a keeper CHANGED on the computer in one answer: its tool calls that
 * wrote, moved, made or removed something, each in the words a person would use, and the
 * request that asks the keeper to put it all back. Looking and measuring are not on a receipt.
 * Pure, so it is tested.
 */
import type { AgentStep } from '../kernel/ipc-types';
import { narrate, type ActKind } from '../stage/activity.ts';

const CHANGES: readonly ActKind[] = ['write', 'move', 'create', 'remove'];
/** The most characters of one command quoted back in an undo request, and of the whole request. */
const QUOTE = 160;
const MAX_REQUEST = 1800;

export interface Change {
  /** What was done, as a person would say it ("Moving 12 files into Archive"). */
  words: string;
  kind: ActKind;
  /** The step itself (kept for the undo request, never shown raw). */
  step: AgentStep;
}

/** The steps that changed something, in order, without repeats of the same words. */
export function changes(steps: readonly AgentStep[]): Change[] {
  const out: Change[] = [];
  for (const step of steps) {
    const said = narrate(step.tool, step.detail);
    if (CHANGES.includes(said.kind) && !out.some((c) => c.words === said.words)) out.push({ words: said.words, kind: said.kind, step });
  }
  return out;
}

/** "1 change" / "3 changes", and whether any of them removed something (harder to put back). */
export function receiptLine(list: readonly Change[]): string {
  const n = list.length === 1 ? '1 change' : `${list.length} changes`;
  return list.some((c) => c.kind === 'remove') ? `${n} on your computer, including something removed` : `${n} on your computer`;
}

/**
 * The request that asks the keeper to reverse these changes. It names each one with the command
 * that made it (shortened), so the keeper undoes exactly this and nothing else; like any request
 * to act, it goes through the plan the person approves.
 */
export function undoRequest(list: readonly Change[]): string {
  const lines = list.map((c, i) => `${i + 1}. ${c.words} (${c.step.detail.replace(/\s+/g, ' ').slice(0, QUOTE)})`);
  let request = `Undo what you just did on my computer and put everything back the way it was. You made these changes, in this order:\n${lines.join('\n')}\nReverse them in the opposite order. If something cannot be put back (a file that was deleted for good), say so plainly and leave the rest as it is.`;
  if (request.length > MAX_REQUEST) request = `${request.slice(0, MAX_REQUEST - 1)}…`;
  return request;
}
