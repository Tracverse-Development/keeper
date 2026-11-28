/**
 * What the person has handed the keeper and not yet sent: a file dropped on the window (the
 * system's drag events, which carry the real path) or text dragged in. The core looks at it
 * first (`attach_peek`), so a file it cannot read says why at once and is never held.
 */
import { useEffect, useState } from 'react';

import { core, onFileDrop, sentence, type Handed, type HandedPeek } from '../kernel/ipc';
import { firstDropped } from './handed';

export interface Held {
  what: Handed;
  peek: HandedPeek;
  /** Other files dropped with it that were not taken (one at a time). */
  more: number;
}

export function useHanded(): { over: boolean; held: Held | null; error: string | null; clear: () => void; hand: (path: string) => void } {
  const [over, setOver] = useState(false);
  const [held, setHeld] = useState<Held | null>(null);
  const [error, setError] = useState<string | null>(null);

  const take = (what: Handed, more: number) => {
    setError(null);
    core
      .attachPeek(what)
      .then((peek) => setHeld({ what, peek, more }))
      .catch((e) => {
        setHeld(null);
        setError(sentence(e));
      });
  };

  useEffect(() => {
    const offFiles = onFileDrop((e) => {
      setOver(e.kind === 'over');
      if (e.kind !== 'drop') return;
      const first = firstDropped(e.paths);
      if (first) take({ path: first.path }, first.more);
    });
    // Text dragged in from another app arrives as an ordinary page drop.
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('text/plain')) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      const text = e.dataTransfer?.getData('text/plain')?.trim();
      if (!text || (e.target instanceof HTMLElement && e.target.closest('input, textarea'))) return;
      e.preventDefault();
      take({ text }, 0);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      offFiles();
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
    // `take` only sets state; listening once is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    over,
    held,
    error,
    clear: () => {
      setHeld(null);
      setError(null);
    },
    /** Hands a file to the keeper as if it were dropped (the file viewer's "Ask … about it"). */
    hand: (path: string) => take({ path }, 0),
  };
}
