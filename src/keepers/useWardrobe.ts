/**
 * The person's wardrobe as the window sees it, and the four things you can do with it: put an
 * item on a keeper, take it off, give it to another keeper (move or share), make your own. Every
 * change comes back as the whole wardrobe (who wears what), and `onChanged` reloads the keepers so
 * the character on the stage is redressed at once. Loads when `open` turns true.
 */
import { useCallback, useEffect, useState } from 'react';

import { core, sentence, type GiveMode, type NewWardrobeItem, type Wardrobe } from '../kernel/ipc';

export function useWardrobe(open: boolean, onChanged: () => void) {
  const [wardrobe, setWardrobe] = useState<Wardrobe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    core
      .wardrobe()
      .then((w) => {
        setWardrobe(w);
        setError(null);
      })
      .catch((e) => setError(sentence(e)));
  }, [open]);

  const run = useCallback(
    (change: Promise<Wardrobe>): Promise<boolean> => {
      setBusy(true);
      return change
        .then((w) => {
          setWardrobe(w);
          setError(null);
          onChanged();
          return true;
        })
        .catch((e) => {
          setError(sentence(e));
          return false;
        })
        .finally(() => setBusy(false));
    },
    [onChanged],
  );

  return {
    wardrobe,
    error,
    busy,
    wear: (keeper: string, item: string) => run(core.wardrobeWear(keeper, item)),
    takeOff: (keeper: string, item: string) => run(core.wardrobeTakeOff(keeper, item)),
    /** Read the wardrobe again (an item was forged elsewhere). */
    reload: () => run(core.wardrobe()),
    give: (item: string, from: string, to: string, mode: GiveMode) => run(core.wardrobeGive(item, from, to, mode)),
    add: (item: NewWardrobeItem) => run(core.wardrobeAdd(item)),
  };
}
