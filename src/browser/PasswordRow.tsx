/**
 * Keeper's own secure box for a page's password (asked by the keeper's `ask-password`): a row
 * under the browser's toolbar (never over the page, which is drawn above Keeper's window). The
 * typed password goes once, straight into that one password field of the page
 * (`browser_password`); it is never logged, kept or shown to the keeper's mind, and the box is
 * emptied at once.
 */
import { useEffect, useRef, useState } from 'react';

import { core, EVENTS, on, sentence } from '../kernel/ipc';

interface Wanted {
  field: string;
  label: string;
  host: string;
}

export function PasswordRow() {
  const [wanted, setWanted] = useState<Wanted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => on<Wanted>(EVENTS.browserPassword, (w) => {
    setError(null);
    setWanted(w);
  }), []);
  useEffect(() => {
    if (wanted) box.current?.focus();
  }, [wanted]);

  if (!wanted) return null;
  const give = () => {
    const field = box.current;
    if (!field || !field.value) return;
    const value = field.value;
    field.value = '';
    core
      .browserPassword(wanted.field, value)
      .then(() => setWanted(null))
      .catch((e) => setError(sentence(e)));
  };
  return (
    <form className="browser-password" onSubmit={(e) => { e.preventDefault(); give(); }}>
      <span className="browser-password-lock" aria-hidden>🔒</span>
      <label className="browser-password-words">
        Your password for <strong>{wanted.host || 'this page'}</strong>
        <input ref={box} type="password" className="field" autoComplete="current-password" aria-label={`Password for ${wanted.host}`} />
      </label>
      <button type="submit" className="btn btn-primary btn-small">Put it in</button>
      <button type="button" className="btn btn-ghost btn-small" onClick={() => setWanted(null)}>Not now</button>
      <span className="muted small browser-password-note">{error ?? 'Goes straight into the page. Keeper never sees or keeps it.'}</span>
    </form>
  );
}
