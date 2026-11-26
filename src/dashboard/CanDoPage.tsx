/**
 * "What I can do": every ability as an example to press. Pressing one says it to the keeper (or
 * opens the place it lives in) and closes the page, so the first try of anything is one click.
 * Opened from the "?" in the top bar, the command palette, or Escape to leave. The list is
 * `can-do.ts`.
 */
import { useEffect, useRef, useState } from 'react';

import { matching, type Example, type Place } from './can-do';

interface Props {
  open: boolean;
  keeperName: string;
  onSay: (words: string) => void;
  onOpen: (place: Place) => void;
  onClose: () => void;
}

export function CanDoPage({ open, keeperName, onSay, onOpen, onClose }: Props) {
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    search.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  const groups = matching(query);
  const press = (e: Example) => {
    if (e.say) onSay(e.say);
    else if (e.open) onOpen(e.open);
    else return;
    onClose();
  };

  return (
    <div className="sheet-backdrop is-open" onClick={onClose}>
      <section className="cando glass" role="dialog" aria-label={`What ${keeperName} can do`} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <p className="eyebrow">What I can do</p>
            <h3>Press one to try it with {keeperName}</h3>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <input ref={search} className="field field-small" type="search" placeholder="Search what I can do" aria-label="Search what I can do" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="cando-groups">
          {groups.map((g) => (
            <div key={g.id} className="cando-group">
              <p className="eyebrow">{g.title}</p>
              <ul>
                {g.examples.map((e) => (
                  <li key={e.title}>
                    <button type="button" className="cando-example" onClick={() => press(e)} disabled={!e.say && !e.open}>
                      <strong>{e.title}</strong>
                      <span className="muted small">
                        {e.hint}
                        {e.needs ? ` ${e.needs}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {groups.length === 0 && <p className="muted">Nothing matches that. You can also just ask {keeperName} in your own words.</p>}
        </div>
      </section>
    </div>
  );
}
