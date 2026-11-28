/**
 * How the keeper reacts to what happens, for the stage to draw: a happy spell (`celebrate`, until
 * `happyUntil`), one-shot emotes (`play('nod')`, each call plays once), and `stir` when someone is
 * busy with it (typing, reading the conversation) so it does not doze off in front of them.
 */
import { useCallback, useRef, useState } from 'react';

import type { Emote } from '../character';
import { HAPPY_MS } from './useDashboardEvents';

/** At most one stir every this many ms (a keystroke stream needs only one). */
const STIR_GAP_MS = 2000;

export function useReactions() {
  const [happyUntil, setHappyUntil] = useState(0);
  const [emote, setEmote] = useState<{ name: Emote; n: number }>({ name: 'wave', n: 0 });
  const [stirs, setStirs] = useState(0);
  const lastStir = useRef(0);
  const celebrate = useCallback(() => setHappyUntil(Date.now() + HAPPY_MS), []);
  const play = useCallback((name: Emote) => setEmote((e) => ({ name, n: e.n + 1 })), []);
  const stir = useCallback(() => {
    const now = Date.now();
    if (now - lastStir.current < STIR_GAP_MS) return;
    lastStir.current = now;
    setStirs((n) => n + 1);
  }, []);
  return { happyUntil, celebrate, emote, play, stirs, stir };
}
