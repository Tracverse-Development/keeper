/**
 * A checklist panel: tickable items with a progress bar. Ticking toggles the item here AND
 * reports it with `onAction` (type "check"), so the keeper remembers what is done. The tick
 * draws itself; when everything is ticked, a small celebration.
 */
import { useEffect, useState, type CSSProperties } from 'react';

import { stagger } from '../stagger.ts';
import type { ActingPanelProps } from './panel-props.ts';
import { Celebration } from './Celebration.tsx';

export function ChecklistPanel({ panel, onAction }: ActingPanelProps<'checklist'>) {
  const [done, setDone] = useState<Record<string, boolean>>(() => Object.fromEntries(panel.items.map((i) => [i.id, i.done])));
  // A new version of the same panel (the keeper re-sent it) brings its own ticks.
  const signature = panel.items.map((i) => `${i.id}:${i.done}`).join('|');
  useEffect(() => setDone(Object.fromEntries(panel.items.map((i) => [i.id, i.done]))), [signature]);

  const count = panel.items.filter((i) => done[i.id]).length;
  const total = panel.items.length;
  const share = total ? count / total : 0;
  const toggle = (item: { id: string; text: string }) => {
    const next = !done[item.id];
    setDone((d) => ({ ...d, [item.id]: next }));
    onAction({ type: 'check', panelId: panel.id, panelTitle: panel.title, itemId: item.id, text: item.text, done: next });
  };

  return (
    <div className="checklist">
      <div className="check-progress" style={{ '--share': share } as CSSProperties}>
        <span className="check-bar"><i /></span>
        <span className="check-count">{count} of {total}</span>
      </div>
      <ul className="check-list">
        {panel.items.map((item, i) => (
          <li key={item.id} style={stagger(i)}>
            <button type="button" role="checkbox" aria-checked={!!done[item.id]} className={done[item.id] ? 'check-item is-done' : 'check-item'}
              onClick={() => toggle(item)}>
              <span className="check-box" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16"><path d="m5 12.5 4.5 4.5L19 7.5" pathLength={1} /></svg>
              </span>
              <span className="check-text">{item.text}</span>
            </button>
          </li>
        ))}
      </ul>
      {total > 0 && count === total && <Celebration title="All done." detail="Every item is ticked off." />}
    </div>
  );
}
