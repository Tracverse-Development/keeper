/**
 * The Transcript: the whole conversation in a column at the side of the window, every card as
 * it always was (`ExchangeView`), while the keeper stays in full view beside it. Opened from the
 * captions ("Read all"), the Transcript button by the message box, or by opening a past chat;
 * Close or the same button puts it away. It keeps itself scrolled to the newest.
 */
import { useEffect, useRef } from 'react';

import { ExchangeView } from './ExchangeView';
import type { Exchange } from './useAssistant';

interface Props {
  exchanges: Exchange[];
  busy: boolean;
  assistantName: string;
  onSend: (text: string) => void;
  onClose: () => void;
  /** The person is reading (scrolling the conversation): the keeper stays awake. */
  onRead?: () => void;
}

export function TranscriptRail({ exchanges, busy, assistantName, onSend, onClose, onRead }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [exchanges]);
  return (
    <aside className="transcript glass" aria-label={`Conversation with ${assistantName}`}>
      <div className="transcript-head">
        <p className="eyebrow">Transcript</p>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close the transcript">
          ✕
        </button>
      </div>
      <div className="transcript-feed" ref={scroller} onScroll={onRead}>
        {exchanges.length === 0 ? (
          <p className="muted small">Nothing said yet. Talk to {assistantName} and the whole conversation shows here.</p>
        ) : (
          exchanges.map((x) => <ExchangeView key={x.id} x={x} busy={busy} onSend={onSend} />)
        )}
      </div>
    </aside>
  );
}
