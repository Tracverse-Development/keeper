/**
 * Answer styles (mirrors `src-tauri/src/brain/styles.rs`; structure.test.ts keeps the ids equal):
 * HOW a keeper shows its answer. Its MODE (the job) is a role from the core's list.
 */
export const STYLES = [
  { id: 'balanced', name: 'Balanced', blurb: 'Words, with panels when they help.' },
  { id: 'explainer', name: 'Explainer', blurb: 'Teaches deeply, step by step, with more panels.' },
  { id: 'brief', name: 'Brief', blurb: 'The essentials only: one sentence and one panel.' },
  { id: 'chat', name: 'Chat', blurb: 'Just conversation, no panels.' },
] as const;

/** The mode a chat is in: its own choice, else the mode of its latest turn, else the keeper's default. */
export function chatMode(turns: { mode?: string }[], fallback: string): string {
  for (let i = turns.length - 1; i >= 0; i--) if (turns[i].mode) return turns[i].mode as string;
  return fallback;
}
