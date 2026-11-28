/**
 * The health list's words (`health::Check`): the one-line summary above it and the order the
 * checks are shown in (problems first). Pure, so it is tested.
 */
import type { HealthCheck } from '../kernel/ipc-studio';

type Level = HealthCheck['level'];
const RANK: Record<Level, number> = { bad: 0, warn: 1, ok: 2 };

/** The worst level among the checks ('ok' for none). */
export function worst(checks: readonly HealthCheck[]): Level {
  return checks.reduce<Level>((w, c) => (RANK[c.level] < RANK[w] ? c.level : w), 'ok');
}

/** Problems first, then things to know, then what is fine; the core's order within each. */
export function problemsFirst(checks: readonly HealthCheck[]): HealthCheck[] {
  return [...checks].sort((a, b) => RANK[a.level] - RANK[b.level]);
}

/** "Everything is working." / "1 thing needs attention." / "2 things are not working." */
export function summaryLine(checks: readonly HealthCheck[]): string {
  const bad = checks.filter((c) => c.level === 'bad').length;
  const warn = checks.filter((c) => c.level === 'warn').length;
  if (bad > 0) return bad === 1 ? '1 thing is not working.' : `${bad} things are not working.`;
  if (warn > 0) return warn === 1 ? 'Working, with 1 thing to know.' : `Working, with ${warn} things to know.`;
  return 'Everything is working.';
}

/**
 * Where in Settings a check with no fix of its own is put right, as the search that lands on that
 * section and the button's words ("Choose a mind" opens the Brain section). Null: nowhere to go.
 */
export function placeFor(checkId: string): { find: string; label: string } | null {
  const PLACES: Readonly<Record<string, { find: string; label: string }>> = {
    mind: { find: 'mind', label: 'Choose a mind' },
    voice: { find: 'voice', label: 'Voice settings' },
    spending: { find: 'spending', label: 'Spending limit' },
  };
  return PLACES[checkId] ?? null;
}
