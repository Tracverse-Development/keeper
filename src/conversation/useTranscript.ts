/**
 * Whether the Transcript is open, remembered on this computer (a per-viewer convenience: if the
 * browser storage is unavailable it simply starts closed). Opening a past chat opens it.
 */
import { useCallback, useState } from 'react';

const KEY = 'keeper.transcriptOpen';

/** Narrower than this (px), the keepers list folds to its rail when the Transcript opens, so the keeper keeps room. */
export const WIDE_ENOUGH_FOR_BOTH = 1240;

function remembered(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function useTranscript() {
  const [open, setOpenState] = useState(remembered);
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    try {
      window.localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      // Storage refused (private window): it is only remembered for this session.
    }
  }, []);
  return { open, setOpen };
}
