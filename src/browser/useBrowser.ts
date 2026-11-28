/**
 * Keeper's browser as the window sees it (core `browser`): whether a page is open and its address,
 * kept up to date from `browser://state`, plus the actions the toolbar needs.
 */
import { useEffect, useState } from 'react';

import { core, EVENTS, on, type BrowserState } from '../kernel/ipc';

export function useBrowser() {
  const [state, setState] = useState<BrowserState>({ open: false, url: '' });
  useEffect(() => {
    core.browserState().then(setState).catch(() => undefined);
    return on<BrowserState>(EVENTS.browserState, setState);
  }, []);
  return {
    ...state,
    open_: (url: string) => core.browserOpen(url).then(setState),
    go: (how: 'back' | 'forward' | 'reload') => core.browserGo(how),
    out: () => core.browserOut(),
    close: () => core.browserClose().then(setState),
  };
}

export type Browser = ReturnType<typeof useBrowser>;
