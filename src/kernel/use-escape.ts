/**
 * Close on Esc: a sheet or drawer that is open listens for Escape and closes (Back and Close must
 * work both ways: CLAUDE.md §1). Ignored while a palette or dialog above it handles its own keys.
 */
import { useEffect } from 'react';

export function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('.palette-veil')) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
}
