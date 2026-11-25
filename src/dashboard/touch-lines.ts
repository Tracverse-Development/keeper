/**
 * What the assistant says when it is touched: a poke (a click) or a pat (a stroke over the head).
 * Pure and tested: lines are picked at random but never the same one twice in a row, and the
 * assistant's name and the person's name (when the graph knows it) are woven in.
 */
export type Touch = 'poke' | 'pat';

const POKE = [
  'Hmm? What do you need?',
  'You rang?',
  "I'm here. What's on your mind?",
  'Yes, {you}?',
  'Oh! You startled me. How can I help?',
  'At your service.',
  "Ready when you are. Just say the word.",
  'Mm-hm? I’m listening.',
  'Need something? I remember everything you tell me.',
  "That's me. {name}, reporting for duty.",
];

const PAT = [
  'Aww, thank you. That’s nice.',
  'Hehe, that tickles!',
  'Mmm… I could get used to this.',
  'You’re the best, {you}.',
  'Happy little circuits over here.',
  'Okay, okay, I feel appreciated!',
  'That made my day. Now, what can I do for you?',
];

/** Pick a line for a touch: the keeper's soul's own lines when it has them, else the defaults. */
export function touchLine(kind: Touch, opts: { name: string; you: string | null; last: string | null; random?: () => number; soulLines?: string[] }): string {
  const pool = (opts.soulLines && opts.soulLines.length > 0 ? opts.soulLines : kind === 'poke' ? POKE : PAT).map((l) => l.replaceAll('{name}', opts.name).replaceAll('{you}', opts.you ?? 'friend'));
  const choices = pool.filter((l) => l !== opts.last);
  const r = opts.random ?? Math.random;
  return choices[Math.floor(r() * choices.length) % choices.length];
}

/** The person's first name from a fact like "Your name is Ada". */
export function nameFromFacts(facts: { text: string; category: string }[]): string | null {
  const fact = facts.find((f) => f.category === 'identity' && /^your name is /i.test(f.text));
  return fact ? fact.text.replace(/^your name is /i, '').split(/\s+/)[0].replace(/[.,!]$/, '') : null;
}
