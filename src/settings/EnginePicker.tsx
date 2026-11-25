/**
 * The engine picker, shared by the installer and Settings: every engine the core knows, whether
 * it works on this computer right now (and what to do when it does not), where it thinks, and
 * the Ollama model when that engine is chosen. Choosing calls `onPick`; the caller saves.
 */
import { useEffect, useState } from 'react';

import { core, sentence, type EngineId, type EngineStatus } from '../kernel/ipc';

interface Props {
  value: EngineId;
  model: string;
  onPick: (id: EngineId, model: string) => void;
}

export function EnginePicker({ value, model, onPick }: Props) {
  const [engines, setEngines] = useState<EngineStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    core.engines().then(setEngines).catch((e) => setError(sentence(e)));
  }, []);

  if (error) return <p className="error-line">{error}</p>;
  if (!engines) {
    return (
      <div className="scanning">
        <span className="spinner" /> Looking for engines on this Mac…
      </div>
    );
  }
  return (
    <div className="minds engines" role="radiogroup" aria-label="Engine">
      {engines.map((e) => (
        <button
          key={e.id}
          type="button"
          role="radio"
          aria-checked={value === e.id}
          className={`mind ${value === e.id ? 'is-on' : ''}`}
          disabled={!e.available}
          onClick={() => onPick(e.id, e.id === 'ollama' ? model || e.models[0] || '' : model)}
        >
          <span className="engine-head">
            <strong>{e.label}</strong>
            <span className={`mind-tag ${e.place === 'device' ? 'local' : 'cloud'}`}>{e.place === 'device' ? 'On this Mac' : 'Your subscription'}</span>
            {e.canAct && <span className="mind-tag act">Can act</span>}
          </span>
          <span className="mind-body">{e.available ? e.blurb : e.problem}</span>
          {e.id === 'ollama' && value === 'ollama' && e.models.length > 0 && (
            <select className="field" value={model} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => onPick('ollama', ev.target.value)}>
              {e.models.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          )}
        </button>
      ))}
    </div>
  );
}
