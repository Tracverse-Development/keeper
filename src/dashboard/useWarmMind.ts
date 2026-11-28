/**
 * The next turn's engine starts before the person speaks: on opening, on switching keeper, and
 * whenever the window comes back to the front (a spare retires after 20 minutes).
 */
import { useEffect } from 'react';

import { core } from '../kernel/ipc';

export function useWarmMind(keeper: string | undefined) {
  useEffect(() => {
    const warm = () => void core.warm(keeper).catch(() => undefined);
    warm();
    window.addEventListener('focus', warm);
    return () => window.removeEventListener('focus', warm);
  }, [keeper]);
}
