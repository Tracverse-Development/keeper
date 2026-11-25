/**
 * The engine picker, shared by the installer and Settings: every engine the core knows, whether
 * it works on this computer right now (and what to do when it does not), where it thinks, and
 * the chosen engine's MODEL (its own list, the engine's default, or a model name typed in).
 * Choosing calls `onPick(engine, model)`; the caller saves.
 */
import { Fragment, useEffect, useState } from 'react';

import { core, sentence, type EngineId, type EngineStatus } from '../kernel/ipc';
import { EngineSetup } from './EngineSetup';
import { ModelSelect } from './ModelSelect';

interface Props {
  value: EngineId;
  model: string;
  onPick: (id: EngineId, model: string) => void;
}

export function EnginePicker({ value, model, onPick }: Props) {
  const [engines, setEngines] = useState<EngineStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => void core.engines().then(setEngines).catch((e) => setError(sentence(e)));
  useEffect(load, []);

  if (error) return <p className="error-line">{error}</p>;
  if (!engines) {
    return (
      <div className="scanning">
        <span className="spinner" /> Looking for engines on this computer…
      </div>
    );
  }
  return (
    <div className="minds engines" role="radiogroup" aria-label="Engine">
      {engines.map((e) => {
        const chosen = value === e.id;
        return (
          <Fragment key={e.id}>
          <div role="radio" aria-checked={chosen} aria-disabled={!e.available} tabIndex={e.available ? 0 : -1}
            className={`mind ${chosen ? 'is-on' : ''} ${e.available ? '' : 'is-disabled'}`}
            onClick={() => e.available && !chosen && onPick(e.id, e.id === 'ollama' ? e.models[0]?.id ?? '' : '')}
            onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && e.available && !chosen && onPick(e.id, e.id === 'ollama' ? e.models[0]?.id ?? '' : '')}>
            <span className="engine-head">
              <strong>{e.label}</strong>
              <span className={`mind-tag ${e.place === 'device' ? 'local' : 'cloud'}`}>{e.place === 'device' ? 'On this computer' : 'Your subscription'}</span>
              {e.canAct && <span className="mind-tag act">Can act</span>}
            </span>
            <span className="mind-body">{e.available ? e.blurb : e.problem}</span>
            {chosen && e.id !== 'reflex' && e.id !== 'hermes' && <ModelSelect engine={e} model={model} onChange={(m) => onPick(e.id, m)} />}
          </div>
          {/* Beside the radio, never inside it: a radio hides its children from VoiceOver. */}
          {!e.available && e.id === 'claude' && <EngineSetup onReady={load} />}
          </Fragment>
        );
      })}
    </div>
  );
}
