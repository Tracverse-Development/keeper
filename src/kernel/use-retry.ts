/**
 * Try again while it keeps failing: a screen that read the memory node while it was still
 * starting (the first half-minute after the Mac starts) reads again every `everyMs` while it is
 * open and its last read failed, up to `limit` times, instead of showing the failure for good.
 * Pass `active` = open && the last READ failed (a refused change is the person's to retry).
 */
import { useEffect, useRef } from 'react';

/** Every 4 s, for about two minutes: long enough for a node that is starting. */
export const RETRY_EVERY_MS = 4000;
export const RETRY_LIMIT = 30;

export function useRetry(active: boolean, retry: () => void, everyMs = RETRY_EVERY_MS, limit = RETRY_LIMIT) {
  const latest = useRef(retry);
  latest.current = retry;
  useEffect(() => {
    if (!active) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (tries > limit) return window.clearInterval(timer);
      latest.current();
    }, everyMs);
    return () => window.clearInterval(timer);
  }, [active, everyMs, limit]);
}
