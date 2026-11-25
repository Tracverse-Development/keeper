/**
 * The Keeper Kit catalog as the window sees it: species, parts, roles, souls (built in + the
 * person's own from the DKG) and part variants. `refresh` after saving a soul or importing a pack.
 */
import { useCallback, useEffect, useState } from 'react';

import { core, sentence, type KitCatalog, type Soul } from '../kernel/ipc';

export function useKit() {
  const [kit, setKit] = useState<KitCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    core
      .kit()
      .then((k) => {
        setKit(k);
        setError(null);
      })
      .catch((e) => setError(sentence(e)));
  }, []);

  useEffect(refresh, [refresh]);

  const soul = useCallback((id: string): Soul | undefined => kit?.souls.find((s) => s.id === id), [kit]);
  return { kit, error, refresh, soul };
}
