/**
 * The Studio's data for one keeper (`keeper_studio`): its level and unlocks, paint zones,
 * materials, habits and rarities. Reloaded when the keeper changes or after a save; a failure is
 * shown, never an empty Studio, and read again while the Studio is open (`useRetry`: the memory
 * node may still be starting).
 */
import { useCallback, useEffect, useState } from 'react';

import { core, sentence, type StudioInfo } from '../kernel/ipc';
import { useRetry } from '../kernel/use-retry';

export function useStudio(keeper: string, open: boolean) {
  const [info, setInfo] = useState<StudioInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    core
      .keeperStudio(keeper)
      .then((i) => {
        setInfo(i);
        setError(null);
      })
      .catch((e) => setError(sentence(e)));
  }, [keeper]);

  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  useRetry(open && error !== null, reload);

  return { info, error, reload };
}
