/** A keeper's name (also its wake word), saved on Enter or when the field loses focus. */
import { useState } from 'react';

export function KeeperNameField({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  const [value, setValue] = useState(name);
  const commit = () => {
    const v = value.trim();
    if (v && v !== name) onSave(v);
  };
  return (
    <div className="voice-row">
      <input className="field" value={value} maxLength={24} aria-label="Keeper name" onChange={(e) => setValue(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} autoCorrect="off" spellCheck={false} />
      <span className="muted small">Say “Hey {value.trim() || 'Keeper'}”</span>
    </div>
  );
}
