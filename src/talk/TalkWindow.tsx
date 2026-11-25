/**
 * The talk window: the small borderless always-on-top card the core opens while the keeper
 * button is held (`hotkey/mod.rs`, label "talk"). It only DISPLAYS: the live words, the
 * assistant's phases, then the reply. The main window sends the turn and speaks it. When the
 * reply has been spoken (or 7 s after it, if nothing speaks) it asks the core to hide it.
 * Every decision is in `talk-state.ts`; this file draws it and runs the hide timer.
 */
import { useEffect, useReducer } from 'react';

import { core, EVENTS, on, type Phase, type VoiceEvent } from '../kernel/ipc';
import { Mark } from '../kernel/Mark';
import { hideAfter, INITIAL, talkReducer, type TalkState } from './talk-state';
import './talk.css';

const STAGE_LABEL = { idle: 'Keeper', listening: 'Listening', thinking: 'Thinking', replied: 'Keeper', speaking: 'Speaking', done: 'Keeper' } as const;

export function TalkWindow() {
  const [state, dispatch] = useReducer(talkReducer, INITIAL);

  useEffect(() => {
    const offVoice = on<VoiceEvent>(EVENTS.voiceEvent, (event) => dispatch({ kind: 'voice', event }));
    const offPhase = on<{ phase: Phase; detail: string }>(EVENTS.assistantPhase, (p) => dispatch({ kind: 'phase', phase: p.phase, detail: p.detail ?? '' }));
    const offReply = on<{ keeper: string; chat: string; reply: string }>(EVENTS.assistantReply, (r) => dispatch({ kind: 'reply', reply: r.reply }));
    return () => {
      offVoice();
      offPhase();
      offReply();
    };
  }, []);

  // One timer per stage: a new stage (or a new turn) replaces it.
  const wait = hideAfter(state);
  useEffect(() => {
    if (wait === null) return;
    const timer = window.setTimeout(() => {
      core
        .talkHide()
        .then(() => dispatch({ kind: 'reset' }))
        .catch(() => undefined);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [state.stage, wait]);

  const glow = state.stage === 'listening' ? 0.35 + state.level * 0.65 : state.stage === 'thinking' ? 0.5 : 0.3;
  return (
    <main className={`talk is-${state.stage}`} aria-live="polite">
      <div className="talk-orb" style={{ ['--glow' as string]: glow.toFixed(3) }} aria-hidden>
        <span className="talk-ring" />
        <span className="talk-ring r2" />
        <Mark size={44} className="talk-mark" />
      </div>
      <div className="talk-words">
        <p className="talk-label">
          {STAGE_LABEL[state.stage]}
          {state.stage === 'thinking' && <span className="talk-dots" aria-hidden><i /><i /><i /></span>}
        </p>
        <TalkLine state={state} />
      </div>
    </main>
  );
}

function TalkLine({ state }: { state: TalkState }) {
  if (state.error) return <p className="talk-line talk-error">{state.error}</p>;
  if (state.reply) return <p className="talk-line talk-reply">{state.reply}</p>;
  if (state.stage === 'thinking') {
    return (
      <>
        {state.heard && <p className="talk-heard">“{state.heard}”</p>}
        <p className="talk-line talk-detail">{state.detail || 'Thinking…'}</p>
      </>
    );
  }
  if (state.stage === 'done') return <p className="talk-line talk-muted">I didn't catch anything.</p>;
  return <p className={`talk-line ${state.heard ? '' : 'talk-muted'}`}>{state.heard || 'Go ahead, I’m listening…'}</p>;
}
