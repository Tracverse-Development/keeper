/**
 * "Set it up for me": Keeper installs Claude Code itself (with its own Node.js), then opens
 * Terminal so the person signs in through their browser, then checks again. Shown under the
 * Claude Code choice when it is missing (installer and Settings share the engine picker).
 */
import { useEffect, useState } from 'react';

import { core, EVENTS, on, sentence } from '../kernel/ipc';

type Stage = 'idle' | 'installing' | 'installed' | 'signing-in';

export function EngineSetup({ onReady }: { onReady: () => void }) {
  const [stage, setStage] = useState<Stage>('idle');
  const [line, setLine] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      on<{ step: string; detail: string }>(EVENTS.setupProgress, (p) => {
        if (p.step === 'engine') setLine(p.detail);
      }),
    [],
  );

  const install = async () => {
    setStage('installing');
    setError(null);
    try {
      await core.engineSetup('claude');
      setStage('installed');
    } catch (e) {
      setError(sentence(e));
      setStage('idle');
    }
  };

  const signIn = async () => {
    setError(null);
    try {
      await core.engineSignIn('claude');
      setStage('signing-in');
    } catch (e) {
      setError(sentence(e));
    }
  };

  return (
    <div className="engine-setup" onClick={(e) => e.stopPropagation()}>
      {stage === 'idle' && (
        <button type="button" className="btn btn-primary" onClick={install}>
          Set up Claude Code for me
        </button>
      )}
      {stage === 'installing' && (
        <p className="muted small">
          <span className="spinner" /> {line || 'Setting up Claude Code…'}
        </p>
      )}
      {stage === 'installed' && (
        <button type="button" className="btn btn-primary" onClick={signIn}>
          Sign in to Claude
        </button>
      )}
      {stage === 'signing-in' && (
        <p className="muted small">
          A Terminal window opened: sign in there (your browser opens), then{' '}
          <button type="button" className="link" onClick={onReady}>
            check again
          </button>
          .
        </p>
      )}
      {error && <p className="error-line">{error}</p>}
    </div>
  );
}
