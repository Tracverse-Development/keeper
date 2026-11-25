/**
 * A facts panel: "what I know about you". Each fact shows with its category chip and two small
 * actions: "Pin" (reported as `{ type: 'pin', factId }`; a pin badge appears) and "Forget"
 * (reported as `{ type: 'forget', factId }`; the row fades out and is gone).
 */
import { useState } from 'react';

import { Icon } from '../icons.tsx';
import { stagger } from '../stagger.ts';
import type { ActingPanelProps } from './panel-props.ts';

export function FactsPanel({ panel, onAction }: ActingPanelProps<'facts'>) {
  const [pinned, setPinned] = useState<Set<string>>(() => new Set());
  const [fading, setFading] = useState<Set<string>>(() => new Set());
  const [gone, setGone] = useState<Set<string>>(() => new Set());
  const add = (set: Set<string>, id: string) => new Set(set).add(id);

  const pin = (id: string) => {
    if (pinned.has(id)) return;
    setPinned((s) => add(s, id));
    onAction({ type: 'pin', factId: id });
  };
  const forget = (id: string) => {
    if (fading.has(id)) return;
    setFading((s) => add(s, id));
    onAction({ type: 'forget', factId: id });
  };

  const shown = panel.facts.filter((f) => !gone.has(f.id));
  return (
    <div className="facts">
      {shown.length === 0 && <p className="facts-empty">Nothing here now. Forgotten facts are gone from the keeper's memory.</p>}
      <ul className="facts-list">
        {shown.map((fact, i) => (
          <li key={fact.id} style={stagger(i)} className={fading.has(fact.id) ? 'fact is-fading' : pinned.has(fact.id) ? 'fact is-pinned' : 'fact'}
            onAnimationEnd={(e) => { if (fading.has(fact.id) && e.target === e.currentTarget && e.animationName === 'fact-out') setGone((s) => add(s, fact.id)); }}>
            <span className="fact-chip">{fact.category}</span>
            <span className="fact-text selectable">{fact.text}</span>
            {pinned.has(fact.id) && <span className="fact-pin-badge" title="Pinned"><Icon name="pin" size={13} /> Pinned</span>}
            <span className="fact-actions">
              {!pinned.has(fact.id) && (
                <button type="button" className="fact-action" onClick={() => pin(fact.id)} aria-label={`Pin: ${fact.text}`}>
                  <Icon name="pin" size={14} /> Pin
                </button>
              )}
              <button type="button" className="fact-action is-forget" onClick={() => forget(fact.id)} aria-label={`Forget: ${fact.text}`}>
                <Icon name="forget" size={14} /> Forget
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
