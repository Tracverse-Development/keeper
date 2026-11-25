/**
 * The person's keepers as the window sees them: the list, the active one, and the changes
 * (create, switch, edit, remove). The core owns the truth (settings + each keeper's graph);
 * this hook only mirrors its answers.
 */
import { useCallback, useEffect, useState } from 'react';

import { core, sentence, type KeeperChange, type KeeperList, type KeeperProfile } from '../kernel/ipc';

export function useKeepers() {
  const [list, setList] = useState<KeeperList | null>(null);
  const [error, setError] = useState<string | null>(null);

  const take = (l: KeeperList) => {
    setList(l);
    setError(null);
    return l;
  };
  const fail = (e: unknown): never => {
    setError(sentence(e));
    throw e;
  };

  useEffect(() => {
    core.keepers().then(take).catch((e) => setError(sentence(e)));
  }, []);

  const active: KeeperProfile | null = list?.keepers.find((k) => k.id === list.active) ?? list?.keepers[0] ?? null;

  return {
    list,
    active,
    error,
    activate: useCallback((id: string) => core.activateKeeper(id).then(take).catch(fail), []),
    create: useCallback((k: { name: string; skin: string; domain: string }) => core.createKeeper(k).then(take).catch(fail), []),
    remove: useCallback((id: string) => core.removeKeeper(id).then(take).catch(fail), []),
    /** Edit a keeper; resolves with what it says about the change (its new brain), if anything. */
    update: useCallback(
      (id: string, change: KeeperChange) =>
        core
          .updateKeeper(id, change)
          .then((saved) => {
            take(saved.list);
            return saved.announcement;
          })
          .catch(fail),
      [],
    ),
  };
}
