/**
 * Keeper's browser in the Stage area: a toolbar (Back, Forward, Reload, the address to read or
 * type over, Open in my browser, Close) and the frame the real page is drawn in. The page itself
 * is a webview the core places over `.browser-frame` (`browser_place`), measured whenever the frame
 * moves or changes size, and hidden (size 0) when the pane goes away.
 */
import { useEffect, useRef, useState } from 'react';

import { core } from '../kernel/ipc';
import { hostOf } from './browser-view.ts';
import { PasswordRow } from './PasswordRow';
import type { Browser } from './useBrowser';

export function BrowserPane({ browser }: { browser: Browser }) {
  const frame = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState<string | null>(null);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const report = () => {
      const r = el.getBoundingClientRect();
      void core.browserPlace(r.left, r.top, r.width, r.height).catch(() => undefined);
    };
    report();
    const watch = new ResizeObserver(report);
    watch.observe(el);
    window.addEventListener('resize', report);
    return () => {
      watch.disconnect();
      window.removeEventListener('resize', report);
      void core.browserPlace(0, 0, 0, 0).catch(() => undefined);
    };
  }, []);

  return (
    <section className="browser" aria-label="Keeper's browser">
      <form
        className="browser-bar"
        onSubmit={(e) => {
          e.preventDefault();
          if (typed?.trim()) void browser.open_(typed.trim()).finally(() => setTyped(null));
        }}
      >
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => void browser.go('back')} aria-label="Back">‹</button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => void browser.go('forward')} aria-label="Forward">›</button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => void browser.go('reload')} aria-label="Reload">↻</button>
        <input
          className="field browser-address"
          value={typed ?? browser.url}
          onFocus={(e) => { setTyped(browser.url); e.currentTarget.select(); }}
          onChange={(e) => setTyped(e.target.value)}
          onBlur={() => setTyped(null)}
          aria-label="Address"
          spellCheck={false}
          autoCorrect="off"
        />
        <span className="browser-host muted small">{hostOf(browser.url)}</span>
        <button type="button" className="btn btn-small" onClick={() => void browser.out()} title="Open this page in your own browser">
          Open in my browser
        </button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => void browser.close()} aria-label="Close the browser">✕</button>
      </form>
      <PasswordRow />
      <div className="browser-frame" ref={frame}>
        <p className="muted small">Opening the page…</p>
      </div>
    </section>
  );
}
