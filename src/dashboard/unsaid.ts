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
