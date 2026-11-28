/**
 * The bar under the character: captions of the latest exchange (the whole conversation is in the
 * Transcript, so nothing covers the keeper), what the microphone is hearing, and the place to type
 * or press the microphone. Enter sends; Escape stops listening or speaking.
 * While the keeper works, typing offers "Send as a correction" (Enter: it changes course at
 * once) or "Queue it" (sent after this turn).
 */
import { useEffect, useRef, useState } from 'react';

import { attentionWords, type Attention } from '../voice/attention.ts';
import { Captions } from './Captions';
import type { Exchange } from './useAssistant';
import { dockAction } from './work-control.ts';

interface Props {
  exchanges: Exchange[];
  busy: boolean;
  status: string;
  listening: boolean;
  speaking: boolean;
  partial: string;
  voiceError: string | null;
  /** Woken by its name, or still in conversation after answering (shown as "Yes? Kofi is listening."). */
  attention?: Attention | null;
  assistantName: string;
  /** The Transcript is open (it holds the conversation, so the captions step aside). */
  transcriptOpen: boolean;
  /** Opens or closes the Transcript. */
  onTranscript: (open: boolean) => void;
  /** Beside the Stage's panels: the keeper's column is narrow, so the captions are shorter. */
  narrow?: boolean;
  onSend: (text: string) => void;
  /** Words put in the box for the person to finish (a draft's "Change something"); a new `at` puts them in again. */
  compose?: { text: string; at: number } | null;
  /** Change course while the keeper works; resolves with a refusal to show, or null. */
  onCorrect?: (text: string) => Promise<string | null>;
  /** The person started typing (the keeper stops talking so it does not talk over them). */
  onType?: () => void;
  /** The mode and style controls, shown above the message box. */
  modeBar?: React.ReactNode;
  /** What the person handed over and has not sent yet (a dropped file), above the message box. */
  tray?: React.ReactNode;
  onMic: () => void;
  onStop: () => void;
}

export function ConversationDock(p: Props) {
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  // While the keeper listens, speaks or works, the button stops it.
  const stoppable = p.listening || p.speaking || p.busy;
  const attention = attentionWords(p.attention ?? null, p.assistantName, Date.now());

  // Composed words replace what is in the box, with the cursor after them, ready to type on.
  useEffect(() => {
    if (!p.compose) return;
    setText(p.compose.text);
    const field = input.current;
    if (!field) return;
    field.focus();
    window.requestAnimationFrame(() => field.setSelectionRange(field.value.length, field.value.length));
  }, [p.compose]);

  const [refusal, setRefusal] = useState<string | null>(null);
  useEffect(() => setRefusal(null), [p.busy]);

  /** Send, correct or queue what was typed (`dockAction`; `queue` forces the queue). */
  const submit = async (queue = false) => {
    if (!text.trim()) return;
    const action = queue ? 'queue' : dockAction(p.busy, Boolean(p.onCorrect));
    if (action === 'correct' && p.onCorrect) {
      const refused = await p.onCorrect(text);
      setRefusal(refused);
      if (refused) return;
    } else {
      p.onSend(text);
    }
    setText('');
  };
  const choosing = p.busy && Boolean(p.onCorrect) && text.trim() !== '';

  return (
    <div className="dock">
      {!p.transcriptOpen && <Captions exchange={p.exchanges.at(-1)} assistantName={p.assistantName} onReadAll={() => p.onTranscript(true)} narrow={p.narrow} />}
      <div className="dock-status" aria-live="polite">
        {refusal ? <span className="error-line">{refusal}</span> : p.partial ? <span className="hearing">{p.partial}</span> : attention ? <span className="attentive">{attention}</span> : p.listening ? <span className="hearing">{p.partial || 'Listening…'}</span> : p.status ? <span className="thinking-words">{p.status}</span> : p.voiceError ? <span className="error-line">{p.voiceError}</span> : null}
      </div>
      {p.tray}
      {p.modeBar}
      {choosing && (
        <div className="dock-choice" role="group" aria-label={`${p.assistantName} is working`}>
          <span className="muted small">{p.assistantName} is working.</span>
          <button type="button" className="btn btn-primary btn-small" onClick={() => void submit()}>
            Send as a correction
          </button>
          <button type="button" className="btn btn-small" onClick={() => void submit(true)}>
            Queue it
          </button>
        </div>
      )}
      <form
        className="dock-input glass"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          ref={input}
          className="dock-field"
          placeholder={`Talk to ${p.assistantName}…`}
          value={text}
          onChange={(e) => {
            if (text === '' && e.target.value !== '') p.onType?.();
            setText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') p.onStop();
          }}
          autoCorrect="off"
          spellCheck={false}
          maxLength={2000}
          autoFocus
        />
        <button type="button" className={`mic ${p.listening || p.busy ? 'is-on' : ''}`} onClick={stoppable ? p.onStop : p.onMic} aria-label={p.listening ? 'Stop listening' : p.busy ? 'Stop' : p.speaking ? 'Stop speaking' : 'Speak'} title={p.busy ? 'Stop (Esc)' : undefined}>
          {stoppable ? (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <path fill="currentColor" d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 1 0-7 0v5A3.5 3.5 0 0 0 12 15Zm6-3.6a.9.9 0 0 0-1.8 0 4.2 4.2 0 0 1-8.4 0 .9.9 0 0 0-1.8 0 6 6 0 0 0 5.1 5.93V20H9a.9.9 0 0 0 0 1.8h6a.9.9 0 0 0 0-1.8h-2.1v-2.67A6 6 0 0 0 18 11.4Z" />
            </svg>
          )}
        </button>
        <button type="button" className={`btn btn-ghost btn-icon transcript-toggle ${p.transcriptOpen ? 'is-on' : ''}`} onClick={() => p.onTranscript(!p.transcriptOpen)} aria-pressed={p.transcriptOpen} aria-label={p.transcriptOpen ? 'Close the transcript' : 'Open the transcript'} title="Transcript">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
            <path fill="currentColor" d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6.6l-4.2 3.4A.75.75 0 0 1 7 19.8V17H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 4.25a.75.75 0 0 0 0 1.5h10a.75.75 0 0 0 0-1.5H7Zm0 3.5a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5H7Z" />
          </svg>
        </button>
        <button type="submit" className="btn btn-primary send" disabled={!text.trim() || (p.busy && !p.onCorrect)}>
          {p.busy && !choosing ? <span className="spinner" /> : p.busy ? 'Correct' : 'Send'}
        </button>
      </form>
    </div>
  );
}
