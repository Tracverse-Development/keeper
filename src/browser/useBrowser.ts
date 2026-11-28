/**
 * Keeper's browser as the window sees it (core `browser`): whether a page is open and its address,
 * kept up to date from `browser://state`, plus the actions the toolbar needs. While a page is
 * open the address is also re-read every `ADDRESS_EVERY_MS`: sites like YouTube and Gmail change
 * their address without loading a new page, which sends no event.
 */
import { useEffect, useState } from 'react';

import { core, EVENTS, on, type BrowserState } from '../kernel/ipc';

/** How often an open page's address is re-read. */
const ADDRESS_EVERY_MS = 1500;

export function useBrowser() {
  const [state, setState] = useState<BrowserState>({ open: false, url: '' });
  useEffect(() => {
    core.browserState().then(setState).catch(() => undefined);
    return on<BrowserState>(EVENTS.browserState, setState);
  }, []);
  useEffect(() => {
    if (!state.open) return undefined;
    const timer = window.setInterval(() => {
      core
        .browserState()
        .then((now) => setState((was) => (was.open === now.open && was.url === now.url ? was : now)))
        .catch(() => undefined);
    }, ADDRESS_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [state.open]);
  return {
    ...state,
    open_: (url: string) => core.browserOpen(url).then(setState),
    go: (how: 'back' | 'forward' | 'reload') => core.browserGo(how),
    out: () => core.browserOut(),
    close: () => core.browserClose().then(setState),
  };
}

export type Browser = ReturnType<typeof useBrowser>;
