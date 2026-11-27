/**
 * Dress for the job: whenever the mode on screen changes (picked by the person, switched by a turn,
 * a chat in another mode opened, the keeper's default changed), the keeper changes into that mode's
 * loadout, or back into what it wore before (`keeper_wear_mode`; rules in `kit/loadout.rs`). Only
 * keepers with a loadout (or an outfit kept from one) ask. Failing quietly keeps the outfit as it is.
 */
import { useEffect } from 'react';

import { core, type KeeperProfile } from '../kernel/ipc';

export function useModeOutfit(keeper: KeeperProfile | null | undefined, chatMode: string, reload: () => unknown): void {
  const mode = keeper ? chatMode || keeper.role : '';
  const loadouts = JSON.stringify(keeper?.loadouts ?? {});
  const kept = (keeper?.homeOutfit?.length ?? 0) > 0;
  useEffect(() => {
    if (!keeper || !mode || (loadouts === '{}' && !kept)) return;
    void core
      .wearMode(keeper.id, mode)
      .then((changed) => {
        if (changed) void reload();
      })
      .catch(() => undefined);
    // Keyed on what decides the outfit, not on every new keeper object from a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keeper?.id, mode, loadouts, kept]);
}
