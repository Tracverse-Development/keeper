/**
 * Set progress you can feel: when a keeper levels up and the new level opens pieces of its sets, a
 * small notice says so ("Gala Night: 4 of 5 ready") in the corner, then fades (one per set, at most
 * a few at once). The rules are in `set-progress.ts`; the level up comes from `useLevelUp`.
 */
import { useEffect, useRef, useState } from 'react';

import { core } from '../kernel/ipc';
import { levelUpNotes } from './set-progress';
import { useLevelUp } from './useLevelUp';

/** How long a notice stays (ms) and the most shown at once. */
const SHOWN_FOR = 7000;
const MOST = 3;

export function SetProgressToasts({ keeper }: { keeper: string | null }) {
  const [notes, setNotes] = useState<{ id: number; text: string }[]>([]);
  const nextId = useRef(1);
  useLevelUp(keeper, (level) => {
    if (!keeper) return;
    void Promise.all([core.wardrobe(), core.keeperStudio(keeper)])
      .then(([w, info]) => {
        const lines = levelUpNotes(w, info.rarities, keeper, level - 1, level).slice(0, MOST);
        if (lines.length) setNotes((list) => [...list, ...lines.map((text) => ({ id: nextId.current++, text }))].slice(-MOST));
      })
      .catch(() => undefined);
  });
  useEffect(() => {
    if (!notes.length) return;
    const timer = window.setTimeout(() => setNotes((list) => list.slice(1)), SHOWN_FOR);
    return () => window.clearTimeout(timer);
  }, [notes]);
  if (!notes.length) return null;
  return (
    <div className="set-toasts" role="status" aria-live="polite">
      {notes.map((n) => (
        <div key={n.id} className="set-toast">
          <span className="set-toast-mark" aria-hidden="true">✦</span>
          <span>{n.text}</span>
          <button type="button" className="set-toast-close" aria-label="Dismiss" onClick={() => setNotes((list) => list.filter((x) => x.id !== n.id))}>×</button>
        </div>
      ))}
    </div>
  );
}
