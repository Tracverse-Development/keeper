/**
 * The memory trail chip under an answer, in words: "1 DKG query · 42 records · 2 written" (one
 * thing, many things). Pure (tested by `trail-words.test.ts`); `DkgTrail` shows it.
 */

/** `n` with its noun, one or many ("1 record", "2 records"). */
function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The chip's words for an answer's queries, rows read and records written. */
export function trailWords(queries: number, rows: number, written: number): string {
  return [count(queries, 'DKG query', 'DKG queries'), count(rows, 'record', 'records'), `${written} written`].join(' · ');
}
