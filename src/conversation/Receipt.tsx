/**
 * Under an answer in which the keeper changed something on the computer: what it changed, in
 * plain words, and "Put it back", which asks the keeper to reverse exactly those changes (the
 * keeper shows its plan first, like any request to act). Answers that only looked show nothing.
 */
import { useState } from 'react';

import type { AgentStep } from '../kernel/ipc-types';
import { changes, receiptLine, undoRequest } from './receipt-view';

export function Receipt({ steps, busy, onUndo }: { steps: AgentStep[]; busy: boolean; onUndo: (request: string) => void }) {
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(false);
  const list = changes(steps);
  if (list.length === 0) return null;
  return (
    <div className="known receipt">
      <button type="button" className="trail-chip" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="known-mark" aria-hidden>
          ✎
        </span>
        {receiptLine(list)}
      </button>
      {open && (
        <>
          <ol className="receipt-list">
            {list.map((c) => (
              <li key={c.words}>{c.words}</li>
            ))}
          </ol>
          <div className="receipt-actions">
            <button
              type="button"
              className="btn btn-small"
              disabled={busy || asked}
              onClick={() => {
                setAsked(true);
                onUndo(undoRequest(list));
              }}
            >
              {asked ? 'Asked to put it back' : 'Put it back'}
            </button>
            <span className="muted small">The keeper shows its plan before it changes anything back.</span>
          </div>
        </>
      )}
    </div>
  );
}
