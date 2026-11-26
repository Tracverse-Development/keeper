/**
 * Something handed to the keeper (a file dropped on it, text dragged in): the words on its
 * card and the ready-made requests. Pure, so the wording is tested.
 */

/** What the person can ask about what they handed over, in one press. */
export const HANDED_ASKS: readonly { id: string; label: string; say: string }[] = [
  { id: 'summarise', label: 'Summarise', say: 'Summarise this for me.' },
  { id: 'explain', label: 'Explain it simply', say: 'Explain this to me in simple words.' },
  { id: 'remember', label: 'Remember what matters', say: 'Read this and remember what matters about me from it. Tell me what you kept.' },
];

/** "3,200 characters" or, when only the start fits a turn, how much of it will be read. */
export function handedSize(chars: number, truncated: boolean, limit = 24_000): string {
  const n = (v: number) => v.toLocaleString('en-US');
  if (truncated) return `${n(chars)} characters. I'll read the first ${n(limit)}.`;
  return chars === 1 ? '1 character' : `${n(chars)} characters`;
}

/** How a message that came with something is shown and stored: its words, then the name. */
export function saidWith(said: string, name: string): string {
  return `${said} (${name})`;
}

/** The one file a drop means: the first path (a drop of several reads the first and says so). */
export function firstDropped(paths: readonly string[]): { path: string; more: number } | null {
  const real = paths.filter((p) => typeof p === 'string' && p.trim() !== '');
  return real.length ? { path: real[0], more: real.length - 1 } : null;
}
