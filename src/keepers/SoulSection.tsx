/**
 * The keeper's soul (WHO it is): pick one of the built-in or your own souls, make a new one, or
 * edit one of yours. Souls live on your DKG (your kit graph); a soul is personality only, never
 * memories, so it can be shared as a pack.
 */
import { useState } from 'react';

import type { Soul } from '../kernel/ipc';
import { SoulEditor } from './SoulEditor';

interface Props {
  value: string;
  souls: Soul[];
  onPick: (id: string) => void;
  onSaved: (soul: Soul) => void;
}

export function SoulSection({ value, souls, onPick, onSaved }: Props) {
  const [editing, setEditing] = useState<Soul | 'new' | null>(null);
  const current = souls.find((s) => s.id === value);

  return (
    <div className="section">
      <div className="soul-list" role="radiogroup" aria-label="Soul">
        {souls.map((s) => (
          <button key={s.id} type="button" role="radio" aria-checked={value === s.id} className={`mind soul ${value === s.id ? 'is-on' : ''}`} onClick={() => onPick(s.id)}>
            <span className="engine-head">
              <strong>{s.name}</strong>
              {!s.builtin && <span className="mind-tag act">Yours</span>}
            </span>
            <span className="mind-body">{s.summary}</span>
          </button>
        ))}
      </div>
      <div className="voice-row">
        <button type="button" className="btn" onClick={() => setEditing('new')}>
          Make a soul
        </button>
        {current && !current.builtin && (
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(current)}>
            Edit {current.name}
          </button>
        )}
      </div>
      {editing && (
        <SoulEditor
          start={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(s) => {
            setEditing(null);
            onSaved(s);
          }}
        />
      )}
    </div>
  );
}
