/**
 * "Why did you say that?": the words for the list of what a keeper knew about the person when
 * it answered. Pure, so the wording is tested.
 */
import type { Fact } from '../kernel/ipc-types';

/** The facts still shown: the ones the person has not just forgotten from this list. */
export function stillKnown(facts: Fact[], forgotten: ReadonlySet<string>): Fact[] {
  return facts.filter((f) => !forgotten.has(f.id));
}

/** The line on the closed chip ("Knew 3 things about you"; says so when all were forgotten). */
export function knownLine(left: number, total: number): string {
  if (left === 0) return total === 1 ? 'Forgot the one thing it knew' : `Forgot all ${total} things it knew`;
  return left === 1 ? 'Knew 1 thing about you' : `Knew ${left} things about you`;
}
