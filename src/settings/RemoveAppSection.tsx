/**
 * Remove Keeper from this Mac: stops the memory node Keeper installed (a node you run yourself
 * is never touched) and, unless you keep them, deletes Keeper's folder with your keepers and
 * memories. Two steps, so it is never pressed by accident. Keeper quits afterwards; drag it from
 * Applications to the Trash.
 */
import { useState } from 'react';

import { core, sentence } from '../kernel/ipc';

export function RemoveAppSection() {
  const [asking, setAsking] = useState(false);
  const [keep, setKeep] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!asking) {
    return (
      <button type="button" className="btn btn-ghost remove-keeper" onClick={() => setAsking(true)}>
        Remove Keeper from this Mac…
      </button>
    );
  }
  return (
    <div className="remove-app glass">
      <p>
        <strong>Remove Keeper?</strong> Its memory node stops, so nothing of Keeper keeps running. Then drag Keeper from Applications to the Trash.
      </p>
      <label className="toggle">
        <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
        <span>
          <strong>Keep my keepers and memories</strong>
          <span className="muted small">{keep ? 'Installing Keeper again brings everything back.' : 'Every keeper, memory and key Keeper holds is deleted from this Mac. This cannot be undone.'}</span>
        </span>
      </label>
      <div className="row">
        <button type="button" className="btn" onClick={() => setAsking(false)}>
          Cancel
        </button>
        <button type="button" className={`btn ${keep ? 'btn-primary' : 'btn-danger'}`} onClick={() => core.removeApp(keep).catch((e) => setError(sentence(e)))}>
          {keep ? 'Stop and quit' : 'Delete everything and quit'}
        </button>
      </div>
      {error && <p className="error-line">{error}</p>}
    </div>
  );
}
