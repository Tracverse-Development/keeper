/**
 * The model for one engine: its known models, the engine's own default (empty), or "Other…",
 * a model name typed in (checked by the core: letters, digits and . _ : - / only).
 */
import { useState } from 'react';

import type { EngineStatus } from '../kernel/ipc';

const OTHER = '__other__';

export function ModelSelect({ engine, model, onChange }: { engine: EngineStatus; model: string; onChange: (model: string) => void }) {
  const known = engine.models.some((m) => m.id === model);
  const [typing, setTyping] = useState(!known && model !== '');
  const [custom, setCustom] = useState(known ? '' : model);

  return (
    <div className="model-row" onClick={(e) => e.stopPropagation()}>
      <label className="muted small">Model</label>
      <select
        className="field"
        value={typing ? OTHER : model}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setTyping(true);
            return;
          }
          setTyping(false);
          onChange(e.target.value);
        }}
      >
        {engine.id !== 'ollama' && <option value="">{engine.label}'s default</option>}
        {engine.models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
        <option value={OTHER}>Other…</option>
      </select>
      {typing && (
        <input
          className="field"
          placeholder="Model name, e.g. claude-sonnet-5-5"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onBlur={() => custom.trim() && onChange(custom.trim())}
          onKeyDown={(e) => e.key === 'Enter' && custom.trim() && onChange(custom.trim())}
          autoCorrect="off"
          spellCheck={false}
        />
      )}
    </div>
  );
}
