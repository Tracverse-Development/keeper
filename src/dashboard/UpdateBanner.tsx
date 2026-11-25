/** Shown after a newer version installed itself: one button restarts into it. */
import { useState } from 'react';

import { core, sentence } from '../kernel/ipc';

export function UpdateBanner({ version }: { version: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="update-banner glass" role="status">
      <span>Umoja Desk {version} is ready.</span>
      <button type="button" className="btn btn-primary" onClick={() => core.restart().catch((e) => setError(sentence(e)))}>
        Restart now
      </button>
      {error && <span className="error-line">{error}</span>}
    </div>
  );
}
