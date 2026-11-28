/**
 * Keeps the sides fitting the window at all times, not only when a button is pressed: at start
 * (the Transcript is remembered open) and when the window narrows, a keepers list and a right-side
 * panel that no longer fit together fold the list to its rail (`side-layout`).
 */
import { useEffect } from 'react';

import { keepersBeside } from './side-layout.ts';

export function useSideFit(keepersOpen: boolean, rightOpen: boolean, foldKeepers: () => void) {
  useEffect(() => {
    if (!keepersOpen || !rightOpen) return;
    const fit = () => {
      if (!keepersBeside(true, window.innerWidth)) foldKeepers();
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [keepersOpen, rightOpen, foldKeepers]);
}
