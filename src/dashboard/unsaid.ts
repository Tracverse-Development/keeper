/**
 * Say the reply first: the reply is spoken as soon as it arrives (before the panels finish), so
 * the final result speaks only what was not already said: nothing, the added part (what a skill
 * did), or all of it when the final words differ. Also: a submitted form as the next message.
 */
export function unsaid(reply: string, early: string): string {
  if (!early) return reply;
  if (reply === early) return '';
  return reply.startsWith(early) ? reply.slice(early.length).trim() : reply;
}

/** A submitted form as the person's next message ("My answers for "Plan your trip": …"). */
export function formMessage(title: string, values: Record<string, string>): string {
  const filled = Object.entries(values).filter(([, v]) => v.trim() !== '');
  const list = filled.map(([k, v]) => `${k.replace(/[-_]+/g, ' ')}: ${v.trim()}`).join('; ');
  return `My answers for "${title}": ${list || 'nothing filled in'}.`;
}

/** A reply longer than this is not read out whole. */
export const SPOKEN_MAX = 280;
/** What is said after the short version of a long reply. */
export const REST_ON_SCREEN = 'The rest is on your screen.';

/**
 * What is said out loud of a reply: all of a short one; of a long one its first two sentences
 * (never past `SPOKEN_MAX`), then "The rest is on your screen." The whole reply is always shown.
 */
export function spokenPart(reply: string): string {
  const text = reply.trim();
  if (text.length <= SPOKEN_MAX) return text;
  const sentences = text.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [];
  let said = '';
  for (const s of sentences.slice(0, 2)) {
    if ((said + s).length > SPOKEN_MAX) break;
    said += s;
  }
  // No sentence end in reach (a list, a long run): cut at a word.
  if (!said.trim()) said = `${text.slice(0, SPOKEN_MAX).replace(/\s+\S*$/, '')}.`;
  return `${said.trim()} ${REST_ON_SCREEN}`;
}
