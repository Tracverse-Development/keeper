/**
 * Level ups: the core tells the window when a keeper reaches a new level (after a message is
 * written); the dashboard celebrates, and the keeper says what opened.
 */
import { useEffect, useRef } from 'react';

import { EVENTS, on, type Unlock } from '../kernel/ipc';

export function useLevelUp(keeper: string | null, onLevelUp: (level: number, unlocked: Unlock[]) => void) {
  const ref = useRef(onLevelUp);
  ref.current = onLevelUp;
  useEffect(
    () =>
      on<{ keeper: string; level: number; unlocked: Unlock[] }>(EVENTS.levelUp, (e) => {
        if (e.keeper === keeper) ref.current(e.level, e.unlocked);
      }),
    [keeper],
  );
}
