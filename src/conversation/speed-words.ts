/**
 * The speed line under a reply: how fast the person saw the first words and who answered
 * ("First words in 0.9 s · quick model"), so response time is visible on every turn.
 */
import type { Timings } from '../kernel/ipc-types';

const SOURCES: Record<string, string> = { instant: 'instant answer', cache: 'from memory', reflex: 'built-in mind' };

function seconds(ms: number): string {
  return ms < 1000 ? `${Math.max(1, Math.round(ms))} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function speedWords(t: Timings): string {
  const who = SOURCES[t.source] ?? t.source;
  const first = t.firstMs ?? t.totalMs;
  return t.firstMs !== null && t.totalMs - first > 400 ? `First words in ${seconds(first)} · done in ${seconds(t.totalMs)} · ${who}` : `Answered in ${seconds(t.totalMs)} · ${who}`;
}
