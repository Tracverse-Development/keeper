/**
 * Shown when a newer version has installed itself. While the keeper is idle it restarts into the
 * new version after a short countdown (fast updates, nothing to click); "Later" stops the
 * countdown, and "Restart now" goes at once. A busy keeper (thinking, speaking) is never cut off.
 */
import { useEffect, useState } from 'react';

import { core, sentence } from '../kernel/ipc';

const COUNTDOWN_S = 15;

export function UpdateBanner({ version, idle }: { version: string; idle: boolean }) {
  const [left, setLeft] = useState(COUNTDOWN_S);
  const [later, setLater] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restart = () => core.restart().catch((e) => setError(sentence(e)));

  useEffect(() => {
    if (later || !idle) return;
    if (left <= 0) {
      restart();
      return;
    }
    const t = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left, later, idle]);

  return (
    <div className="update-banner glass" role="status">
      <span>
        Keeper {version} is ready.{!later && idle ? ` Restarting in ${left} s.` : ''}
      </span>
      {!later && (
        <button type="button" className="btn btn-ghost" onClick={() => setLater(true)}>
          Later
        </button>
      )}
      <button type="button" className="btn btn-primary" onClick={restart}>
        Restart now
      </button>
      {error && <span className="error-line">{error}</span>}
    </div>
  );
}
