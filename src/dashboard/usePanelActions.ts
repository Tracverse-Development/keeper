/**
 * The window's side of "panels you work in", "say the reply first" and the morning brief:
 * - a panel action (tick, answer, flashcard, form, forget, pin) is written to the keeper's graph;
 *   a reminder deleted from an agenda is erased (`reminderCancel`);
 *   a submitted form is also sent as the next message, so the keeper carries on with it;
 *   an approval decision runs the plan (or records the no); a quiz streak of 3+ is celebrated;
 *   a draft's "Change something" puts its opening in the talk box (nothing is written or sent)
 * - the reply's first sentence, then the whole reply, arrive before the panels finish
 *   (`earlyReply`): each is spoken at once, the later ones queued after what is being said and
 *   only the part not already said (`unsaid`); the final result speaks whatever is left
 * - the brief is asked for once when the keeper's screen first opens (the core shows it at most
 *   once a day)
 */
import { useEffect, useRef } from 'react';

import { core, EVENTS, on, sentence } from '../kernel/ipc';
import type { PanelAction } from '../kernel/panel-spec';
import { formMessage, unsaid, spokenPart } from './unsaid';

/** Right answers in a row worth a celebration. */
const STREAK = 3;

interface Deps {
  keeper: string | null;
  /** `queue`: after what is being said, instead of cutting it off. */
  speak: (text: string, queue?: boolean) => void;
  celebrate: () => void;
  /** A quiz streak: the character's confetti spin. */
  streak: () => void;
  announce: (text: string) => void;
  decide: (token: string, approve: boolean) => Promise<void>;
  brief: () => Promise<void>;
  /** Send a message to the keeper (a submitted form continues the conversation). */
  send: (text: string) => void;
  /** Put words in the talk box for the person to finish, without sending (a draft's "Change something"). */
  compose: (text: string) => void;
  /** Called when the graph changed (forget/pin), so counts and drawers refresh. */
  changed: () => void;
}

export function usePanelActions(deps: Deps) {
  const ref = useRef(deps);
  ref.current = deps;
  const early = useRef('');

  useEffect(
    () =>
      on<{ keeper: string; text: string }>(EVENTS.earlyReply, (e) => {
        if (e.keeper !== ref.current.keeper) return;
        const first = !early.current;
        const rest = unsaid(e.text, early.current);
        early.current = e.text;
        if (rest) ref.current.speak(rest, !first);
      }),
    [],
  );

  // Once per keeper opened; the core decides whether today's brief was already shown.
  useEffect(() => {
    if (deps.keeper) void ref.current.brief();
  }, [deps.keeper]);

  /** The final reply: speak only what the early reply did not already say. */
  const speakFinal = (reply: string) => {
    const queued = !!early.current;
    // A long reply is spoken as its first two sentences; the rest is on screen.
    const rest = unsaid(spokenPart(reply), early.current);
    early.current = '';
    if (rest) ref.current.speak(rest, queued);
  };

  const act = async (a: PanelAction) => {
    const d = ref.current;
    if (a.type === 'approve' || a.type === 'deny') {
      await d.decide(a.token, a.type === 'approve');
      return;
    }
    if (a.type === 'compose') {
      d.compose(a.text);
      return;
    }
    // A reminder deleted from an agenda: erased from the keeper's graph, it will not fire.
    if (a.type === 'reminder-delete') {
      try {
        await core.reminderCancel(a.reminderId, d.keeper ?? undefined);
        d.changed();
      } catch (e) {
        d.announce(sentence(e));
      }
      return;
    }
    try {
      const done = await core.stageAction(a, d.keeper ?? undefined);
      if (a.type === 'quiz' && a.correct && done.streak >= STREAK) {
        d.celebrate();
        d.streak();
        const line = `${done.streak} right in a row!`;
        d.announce(line);
        d.speak(line);
      }
      if (a.type === 'forget' || a.type === 'pin') d.changed();
      if (a.type === 'submit') d.send(formMessage(a.panelTitle, a.values));
    } catch (e) {
      d.announce(sentence(e));
    }
  };

  return { act, speakFinal };
}
