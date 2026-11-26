/**
 * An Undo button for a fact that just left memory (forgotten, or replaced by a newer one): for
 * thirty seconds it puts the fact back exactly as it was; then it goes away.
 */
import { useEffect, useState } from 'react';

import { core, sentence } from '../kernel/ipc';
import type { Fact } from '../kernel/ipc-types';
import { canUndo, UNDO_MS } from './undo-view';

export function UndoFact({ fact, keeper, leftAt, onBack }: { fact: Fact; keeper: string; leftAt: number; onBack?: () => void }) {
  const [state, setState] = useState<'offer' | 'working' | 'back' | 'gone'>(() => (canUndo(leftAt, Date.now()) ? 'offer' : 'gone'));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state !== 'offer') return;
    const timer = window.setTimeout(() => setState('gone'), Math.max(0, UNDO_MS - (Date.now() - leftAt)));
    return () => window.clearTimeout(timer);
  }, [state, leftAt]);

  if (state === 'gone') return null;
  if (state === 'back') return <span className="muted small"> · put back</span>;
  return (
    <>
      <button
        type="button"
        className="link small undo-fact"
        disabled={state === 'working'}
        onClick={() => {
          setState('working');
          core
            .restoreFact(fact, keeper || undefined)
            .then(() => {
              setState('back');
              onBack?.();
            })
            .catch((e) => {
              setError(sentence(e));
              setState('offer');
            });
        }}
      >
        {state === 'working' ? 'Putting back…' : 'Undo'}
      </button>
      {error && <span className="error-line small"> {error}</span>}
    </>
  );
}
