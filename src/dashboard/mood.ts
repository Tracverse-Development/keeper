/**
 * Which mood the character shows, from what the assistant and the voice are doing.
 * Pure (tested in mood.test.ts): speaking beats listening beats thinking beats a short
 * celebration beats idle.
 */
import type { Mood } from '../character/contract';
import type { Phase } from '../kernel/ipc';

export interface MoodInputs {
  speaking: boolean;
  listening: boolean;
  phase: Phase | null;
  /** Until when (ms since epoch) to show the happy mood after something was remembered or done. */
  happyUntil: number;
  now: number;
}

export function moodFor(i: MoodInputs): Mood {
  if (i.speaking) return 'speaking';
  if (i.listening) return 'listening';
  if (i.phase && i.phase !== 'done') return 'thinking';
  if (i.now < i.happyUntil) return 'happy';
  return 'idle';
}

/** What the status line under the character says during a turn. */
export function phaseWords(phase: Phase | null, graphId: string, detail = ''): string {
  switch (phase) {
    case 'recalling':
      return `Querying your DKG graph ${graphId}…`;
    case 'thinking':
      return detail ? `Thinking with ${detail}…` : 'Thinking…';
    case 'acting':
      return detail ? `${detail}` : 'Doing it…';
    case 'remembering':
      return 'Writing to your memory graph…';
    default:
      return '';
  }
}
