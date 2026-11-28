/**
 * What the talk window shows, as a pure reducer (State pattern; tested in talk-state.test.ts).
 * One push-to-talk turn walks: listening (live words) → thinking (the assistant's phases) →
 * replied (the answer, shown until it has been spoken) → done (the window may hide).
 * A new `listening: true` always starts a fresh turn. The window draws `TalkState` and turns
 * `hideAfter` into a timer; it never decides anything itself.
 */
import type { Phase, VoiceEvent } from '../kernel/ipc';

export type TalkStage = 'idle' | 'listening' | 'thinking' | 'replied' | 'speaking' | 'done';

export interface TalkState {
  stage: TalkStage;
  /** The words heard so far (partial, then final). */
  heard: string;
  /** The assistant's current phase line, e.g. "Querying your DKG…". */
  detail: string;
  reply: string;
  /** Microphone level, 0–1. */
  level: number;
  error: string | null;
}

export type TalkInput =
  | { kind: 'voice'; event: VoiceEvent }
  | { kind: 'phase'; phase: Phase; detail: string }
  | { kind: 'reply'; reply: string }
  /** The window was hidden: start blank, so the next press never flashes the last answer. */
  | { kind: 'reset' };

export const INITIAL: TalkState = { stage: 'idle', heard: '', detail: '', reply: '', level: 0, error: null };

/** How long the reply stays when nothing speaks it, and how long after the voice ends. */
export const UNSPOKEN_REPLY_MS = 7000;
export const AFTER_SPEECH_MS = 1200;
/** Nothing was heard (the button was tapped, not held): a short goodbye. */
export const NOTHING_HEARD_MS = 2500;
export const ERROR_MS = 5000;
/** A voice that started but never reported its end still lets the window go. */
export const SPEAKING_LIMIT_MS = 60000;

const PHASE_WORDS: Record<Phase, string> = {
  recalling: 'Querying your DKG…',
  thinking: 'Thinking…',
  acting: 'Working on it…',
  redirected: 'Changing course…',
  remembering: 'Writing to your memory…',
  done: 'Thinking…',
};

/** The line shown while the assistant works: its own detail when it sent one. */
export function phaseLine(phase: Phase, detail: string): string {
  // A correction's detail is the person's own words: said as the change it is.
  if (phase === 'redirected' && detail.trim()) return `Changed course: ${detail.trim()}`;
  return detail.trim() || PHASE_WORDS[phase] || 'Thinking…';
}

export function talkReducer(s: TalkState, input: TalkInput): TalkState {
  if (input.kind === 'reset') return INITIAL;
  if (input.kind === 'phase') {
    if (s.stage === 'replied' || s.stage === 'speaking') return s;
    return { ...s, stage: 'thinking', detail: phaseLine(input.phase, input.detail), level: 0 };
  }
  if (input.kind === 'reply') return { ...s, stage: 'replied', reply: input.reply, detail: '', level: 0 };
  const e = input.event;
  switch (e.type) {
    case 'listening':
      if (e.on) return { ...INITIAL, stage: 'listening' };
      // Let go: with words heard the main window sends the turn; with none, the turn is over.
      if (s.stage !== 'listening') return s;
      return s.heard.trim() ? { ...s, stage: 'thinking', detail: 'Thinking…', level: 0 } : { ...s, stage: 'done', level: 0 };
    case 'level':
      return s.stage === 'listening' ? { ...s, level: Math.max(0, Math.min(1, e.value)) } : s;
    case 'partial':
    case 'final':
      return s.stage === 'listening' || s.stage === 'idle' || s.stage === 'thinking' ? { ...s, heard: e.text } : s;
    case 'speech-start':
      return s.stage === 'replied' ? { ...s, stage: 'speaking' } : s;
    case 'speech-end':
      return s.stage === 'speaking' || s.stage === 'replied' ? { ...s, stage: 'done' } : s;
    case 'error':
      return { ...s, stage: 'done', error: e.message, level: 0 };
    default:
      return s;
  }
}

/** When to hide the window from this state (ms from now), or null to stay. */
export function hideAfter(s: TalkState): number | null {
  if (s.stage === 'replied') return UNSPOKEN_REPLY_MS;
  if (s.stage === 'speaking') return SPEAKING_LIMIT_MS;
  if (s.stage !== 'done') return null;
  if (s.error) return ERROR_MS;
  return s.reply ? AFTER_SPEECH_MS : NOTHING_HEARD_MS;
}
