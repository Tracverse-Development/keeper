/** Updates: install new versions automatically (default), or check now. */
import { useState } from 'react';

import { core, sentence } from '../kernel/ipc';

export function UpdatesSection({ autoUpdate, onToggle }: { autoUpdate: boolean; onToggle: (on: boolean) => void }) {
  const [state, setState] = useState<{ busy: boolean; words: string | null }>({ busy: false, words: null });

  const check = async () => {
    setState({ busy: true, words: null });
    try {
      const s = await core.updateCheck();
      setState({ busy: false, words: s.installed ? `Version ${s.installed} is installed. Restart to use it.` : `You're up to date (version ${s.current}).` });
    } catch (e) {
      setState({ busy: false, words: sentence(e) });
    }
  };

  return (
    <div className="section">
      <label className="toggle">
        <input type="checkbox" checked={autoUpdate} onChange={(e) => onToggle(e.target.checked)} />
        <span>
          <strong>Update automatically</strong>
          <span className="muted small">Checks when the app opens and every few hours. Updates are signed; anything unsigned is refused.</span>
        </span>
      </label>
      <div className="voice-row">
        <button type="button" className="btn" onClick={check} disabled={state.busy}>
          {state.busy && <span className="spinner" />} Check for updates
        </button>
        {state.words && <span className="muted small update-words">{state.words}</span>}
      </div>
    </div>
  );
}
