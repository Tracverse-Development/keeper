/**
 * Command palette ranking: which commands match what was typed, best first. A command matches
 * when every typed word is the start of one of its words (or of its keywords), in any order;
 * an exact start of the title ranks first. Pure and tested.
 */
export interface Command {
  id: string;
  title: string;
  /** Extra words people may type for it ("switch", "change"). */
  keywords?: string[];
  /** A short line under the title. */
  hint?: string;
  run: () => void;
}

const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Higher is better; -1 = no match. */
export function score(c: Command, typed: string): number {
  const q = words(typed);
  if (q.length === 0) return 0;
  const own = words(`${c.title} ${(c.keywords ?? []).join(' ')}`);
  if (!q.every((w) => own.some((o) => o.startsWith(w)))) return -1;
  const title = c.title.toLowerCase();
  const t = typed.trim().toLowerCase();
  return 1 + (title.startsWith(t) ? 100 : 0) + (words(c.title).some((o) => o.startsWith(q[0])) ? 10 : 0) - title.length / 100;
}

export function rank(commands: Command[], typed: string, limit = 8): Command[] {
  return commands
    .map((c, i) => ({ c, s: score(c, typed), i }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.c);
}
