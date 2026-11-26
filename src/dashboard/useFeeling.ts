/**
 * The keeper's simulated mood for its body: read from the core when the keeper or the chat's
 * mode changes, after every turn and touch (`refresh`), and once a minute (a mood drifts on its
 * own: tired late at night). Null where it shows none (feelings off, a work mode, set aside).
 */
import { useCallback, useEffect, useState } from 'react';

import type { Feeling } from '../character';
import { core } from '../kernel/ipc';

const DRIFT_MS = 60_000;

export function useFeeling(keeper: string | null, mode: string): { feeling: Feeling | null; refresh: () => void } {
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [asked, setAsked] = useState(0);
  const refresh = useCallback(() => setAsked((n) => n + 1), []);

  useEffect(() => {
    if (!keeper) {
      setFeeling(null);
      return;
    }
    let current = true;
    const read = () =>
      core
        .keeperFeelings(keeper, mode || undefined)
        .then((info) => {
          if (current) setFeeling(info.shows && info.view ? { pleasure: info.view.mood.p, arousal: info.view.mood.a } : null);
        })
        .catch(() => undefined);
    void read();
    const timer = window.setInterval(read, DRIFT_MS);
    return () => {
      current = false;
      window.clearInterval(timer);
    };
  }, [keeper, mode, asked]);

  return { feeling, refresh };
}
