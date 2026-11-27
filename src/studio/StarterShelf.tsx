/**
 * Keepers: the starter keepers (`kit/starters.rs`), each a body, a mode, a soul and its first
 * piece, added in one press as a new keeper of the person's own. Pointing at one shows it on the
 * big stage. A starter already added (a keeper with that name) says so instead.
 */
import { useState } from 'react';

import { core, sentence, type Starter, type StudioInfo } from '../kernel/ipc';
import { SKINS } from '../character';

interface Props {
  info: StudioInfo;
  /** The names of the keepers the person already has. */
  names: string[];
  onTry: (starter: Starter | null) => void;
  onAdded: () => void;
}

export function StarterShelf({ info, names, onTry, onAdded }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ words: string; bad: boolean } | null>(null);
  const starters = info.starters ?? [];
  if (!starters.length) return <p className="muted">This version of Keeper lists no starter keepers.</p>;
  const add = (s: Starter) => {
    setBusy(s.id);
    core
      .createKeeper({ name: s.name, skin: s.skin, role: s.role, soul: s.soul, starter: s.id })
      .then(() => {
        setNote({ words: `${s.name} joined your keepers. Pick ${s.name} in the sidebar to talk to them.`, bad: false });
        onAdded();
      })
      .catch((e) => setNote({ words: sentence(e), bad: true }))
      .finally(() => setBusy(null));
  };
  return (
    <>
      <div className="set-grid">
        {starters.map((s) => {
          const have = names.some((n) => n.toLowerCase() === s.name.toLowerCase());
          return (
            <article key={s.id} className="set-card" onMouseEnter={() => onTry(s)} onMouseLeave={() => onTry(null)} onFocus={() => onTry(s)} onBlur={() => onTry(null)}>
              <header className="set-card-head">
                <strong>{s.name}</strong>
                <span className="muted small">{SKINS.find((k) => k.id === s.skin)?.name ?? s.skin}</span>
              </header>
              <p className="small">{s.blurb}</p>
              <button type="button" className={`btn btn-small btn-block ${have ? '' : 'btn-primary'}`} disabled={have || busy !== null} onClick={() => add(s)}>
                {have ? `${s.name} is already yours` : busy === s.id ? 'Adding…' : `Add ${s.name}`}
              </button>
            </article>
          );
        })}
      </div>
      {note && <p className={note.bad ? 'error-line' : 'ok-text small'} role="status">{note.words}</p>}
      <p className="muted small">A new keeper starts with its own memory, at level 1, wearing its starter piece. Up to 12 keepers fit on one computer.</p>
    </>
  );
}
