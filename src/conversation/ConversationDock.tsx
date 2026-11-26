/**
 * The bar under the character: the last exchanges, what the microphone is hearing, and the
 * place to type or press the microphone. Enter sends; Escape stops listening or speaking.
 */
import { useEffect, useRef, useState } from 'react';

import { DkgTrail } from './DkgTrail';
import { KnownFacts } from './KnownFacts';
import { Receipt } from './Receipt';
import { forgottenWords } from './known-facts';
import { speedWords } from './speed-words';
import type { Exchange } from './useAssistant';

interface Props {
  exchanges: Exchange[];
  busy: boolean;
  status: string;
  listening: boolean;
  speaking: boolean;
  partial: string;
  voiceError: string | null;
  assistantName: string;
  /** Show the whole chat (opened from the keepers panel), not just the last few exchanges. */
  full: boolean;
  /** Beside the stage: only the latest exchange, so nothing covers the character. */
  compact?: boolean;
  onSend: (text: string) => void;
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
  const scroller = useRef<HTMLDivElement>(null);
  const shown = p.full ? p.exchanges : p.exchanges.slice(p.compact ? -1 : -3);
  // While the keeper listens, speaks or works, the button stops it.
  const stoppable = p.listening || p.speaking || p.busy;

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [p.exchanges]);

  const submit = () => {
    if (!text.trim() || p.busy) return;
    p.onSend(text);
    setText('');
  };

  return (
    <div className="dock">
      <div className="dock-feed" ref={scroller} aria-live="polite">
        {shown.map((x) => (
          <div key={x.id} className="exchange">
            {x.said && (
              <p className={`bubble you selectable ${x.queued ? 'is-queued' : ''}`}>
                {x.said}
                {x.queued && <span className="queued-note">waiting its turn</span>}
              </p>
            )}
            {x.result && (
              <div className="bubble them">
                <p className="selectable">{x.result.reply}</p>
                {x.result.learned.length + x.result.forgotten.length > 0 && (
                  <ul className="learned">
                    {x.result.learned.map((f) => (
                      <li key={f.id}>Remembered: {f.text}</li>
                    ))}
                    {x.result.forgotten.map((f) => (
                      <li key={f.id} className="is-gone">{forgottenWords(x.result!.learned.length > 0)}: {f.text}</li>
                    ))}
                  </ul>
                )}
                {x.note && <p className="bubble-note">✦ {x.note}</p>}
                {x.result.steps.length > 0 && <Receipt steps={x.result.steps} busy={p.busy} onUndo={p.onSend} />}
                {(x.result.used?.length ?? 0) > 0 && <KnownFacts facts={x.result.used ?? []} keeper={x.result.keeper} />}
                {x.result.timings && <p className="turn-speed muted small">{speedWords(x.result.timings)}</p>}
                {x.result.traces.length + x.result.writes.length > 0 && <DkgTrail result={x.result} />}
              </div>
            )}
            {!x.result && !x.error && x.live && (
              <div className="bubble them is-live">
                <p className="selectable">
                  {x.live}
                  <span className="caret" aria-hidden />
                </p>
              </div>
            )}
            {x.error && <p className="bubble them error-line">{x.error}</p>}
          </div>
        ))}
      </div>
      <div className="dock-status" aria-live="polite">
        {p.listening ? <span className="hearing">{p.partial || 'Listening…'}</span> : p.status ? <span className="thinking-words">{p.status}</span> : p.voiceError ? <span className="error-line">{p.voiceError}</span> : null}
      </div>
      {p.tray}
      {p.modeBar}
      <form
        className="dock-input glass"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
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
        <button type="submit" className="btn btn-primary send" disabled={!text.trim() || p.busy}>
          {p.busy ? <span className="spinner" /> : 'Send'}
        </button>
      </form>
    </div>
  );
}
