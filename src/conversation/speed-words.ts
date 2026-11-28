/**
 * The speed line under a reply: how fast the person saw the first words, who answered and,
 * when the engine reported one, what the answer cost ("First words in 0.9 s · quick model ·
 * about 2¢"), so response time and spending are visible on every turn.
 */
import type { Timings } from '../kernel/ipc-usage';
import { mindName } from '../kernel/mind-words.ts';


function seconds(ms: number): string {
  return ms < 1000 ? `${Math.max(1, Math.round(ms))} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** A cost in plain words: "under 1¢", "about 3¢", "about $1.20". Dollars at the engine's own prices. */
export function costWords(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return '';
  if (usd < 0.01) return 'under 1¢';
  return usd < 1 ? `about ${Math.round(usd * 100)}¢` : `about $${usd.toFixed(2)}`;
}

export function speedWords(t: Timings): string {
  const who = mindName(t.source);
  const first = t.firstMs ?? t.totalMs;
  const picture = t.panelMs != null && t.panelMs - first > 400 ? ` · first picture ${seconds(t.panelMs)}` : '';
  const cost = t.costUsd ? ` · ${costWords(t.costUsd)}` : '';
  const speed = t.firstMs !== null && t.totalMs - first > 400 ? `First words in ${seconds(first)}${picture} · done in ${seconds(t.totalMs)} · ${who}` : `Answered in ${seconds(t.totalMs)} · ${who}`;
  return `${speed}${cost}`;
}

/** The note under an answer that did not come from the chosen mind, in plain words. */
export function fellBackWords(why: string): string {
  if (why.includes('spending limit')) return "This month's spending limit is reached, so this answer stayed on this Mac. Change the limit in Settings, under Spending.";
  return `The chosen mind did not answer (${why}), so the built-in mind replied.`;
}
