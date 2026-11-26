/**
 * Your maker name: the name (and an optional https link) written on every pack you share, so
 * the person receiving it sees who made it before adding it. Saved when you leave a field; an
 * empty name means your packs carry no maker.
 */
import { useEffect, useState } from 'react';

import { core, sentence } from '../kernel/ipc';

export function MakerFields() {
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);

  useEffect(() => {
    core
      .settings()
      .then((s) => {
        setName(s.makerName ?? '');
        setLink(s.makerLink ?? '');
      })
      .catch(() => undefined);
  }, []);

  const save = () =>
    core
      .saveSettings({ maker: [name, link] })
      .then((s) => {
        // The core keeps the cleaned name, and a link only when it is a plain https address.
        const dropped = link.trim() !== '' && !s.makerLink;
        setName(s.makerName ?? '');
        setLink(s.makerLink ?? '');
        setNote(dropped ? { text: 'The link was left out: it has to start with https://.', bad: true } : s.makerName ? { text: `Your packs will say "Made by ${s.makerName}".`, bad: false } : null);
      })
      .catch((e) => setNote({ text: sentence(e), bad: true }));

  return (
    <div className="stack">
      <input className="field field-small" placeholder="Your maker name (optional)" aria-label="Your maker name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} onBlur={save} />
      <input className="field field-small" placeholder="A link to you, https://… (optional)" aria-label="A link to you" maxLength={200} value={link} onChange={(e) => setLink(e.target.value)} onBlur={save} />
      {note && <p className={note.bad ? 'error-line' : 'muted small'}>{note.text}</p>}
    </div>
  );
}
