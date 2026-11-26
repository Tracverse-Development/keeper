/**
 * "Why did you say that?": under an answer, what the keeper knew about the person when it
 * wrote it (the facts recall handed the mind), each with a Forget button that erases it from
 * the keeper's graph. Wrong or unwanted memory is corrected where it shows.
 */
import { useState } from 'react';

import { core, sentence } from '../kernel/ipc';
import type { Fact } from '../kernel/ipc-types';
import { knownLine, stillKnown } from './known-facts';
import { UndoFact } from './UndoFact';

export function KnownFacts({ facts, keeper }: { facts: Fact[]; keeper: string }) {
  const [open, setOpen] = useState(false);
  // What was forgotten here, and when (Undo is offered for a while after).
  const [forgottenAt, setForgottenAt] = useState<ReadonlyMap<string, number>>(new Map());
  const forgotten: ReadonlySet<string> = new Set(forgottenAt.keys());
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const left = stillKnown(facts, forgotten);

  const forget = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await core.forgetFact(id, keeper || undefined);
      setForgottenAt((m) => new Map(m).set(id, Date.now()));
    } catch (e) {
      setError(sentence(e));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="known">
      <button type="button" className="trail-chip" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="known-mark" aria-hidden>
          ◆
        </span>
        {knownLine(left.length, facts.length)}
      </button>
      {open && (
        <ul className="known-list">
          {left.map((f) => (
            <li key={f.id}>
              <span className="selectable">{f.text}</span>
              <button type="button" className="btn btn-ghost btn-small" disabled={busy === f.id} onClick={() => forget(f.id)} aria-label={`Forget: ${f.text}`}>
                {busy === f.id ? 'Forgetting…' : 'Forget'}
              </button>
            </li>
          ))}
          {facts
            .filter((f) => forgottenAt.has(f.id))
            .map((f) => (
              <li key={f.id} className="is-forgotten">
                <span className="muted">Forgot: {f.text}</span>
                <UndoFact
                  fact={f}
                  keeper={keeper}
                  leftAt={forgottenAt.get(f.id) ?? 0}
                  onBack={() =>
                    setForgottenAt((m) => {
                      const next = new Map(m);
                      next.delete(f.id);
                      return next;
                    })
                  }
                />
              </li>
            ))}
          {left.length === 0 && forgottenAt.size === 0 && <li className="muted">Nothing from this answer is remembered any more.</li>}
          {error && <li className="error-line">{error}</li>}
        </ul>
      )}
    </div>
  );
}
