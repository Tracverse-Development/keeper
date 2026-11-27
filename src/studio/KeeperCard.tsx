/**
 * Save a card of this keeper (the Level tab): a picture of it as it looks on the Studio's stage
 * with its name, level and soul, saved by photo mode (`take-photo.ts`) to ~/Pictures/Keeper as a
 * PNG the person can post. Nothing is uploaded anywhere.
 */
import { useState } from 'react';

import { sentence } from '../kernel/ipc';
import type { CardFacts } from './keeper-card';
import { savedWords } from './photo-mode';
import { takePhoto, type TakeStill } from './take-photo';

export function KeeperCard({ keeperId, facts, still }: { keeperId: string; facts: CardFacts; still: TakeStill }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);

  const save = async () => {
    setBusy(true);
    setNote(null);
    try {
      const saved = await takePhoto('card', still, keeperId, facts);
      setNote({ text: savedWords('card', saved.shown), bad: false });
    } catch (e) {
      setNote({ text: sentence(e), bad: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-card keeper-card">
      <div>
        <strong>A card of {facts.name}</strong>
        <p className="muted small">A picture of {facts.name} as it looks now, with its name, level and soul{facts.outfit ? ', and what it wears that is worth showing off' : ''}. It is saved on this Mac, in Pictures/Keeper; you choose where it goes.</p>
      </div>
      <button type="button" className="btn btn-small" disabled={busy} onClick={() => void save()}>
        {busy ? 'Saving…' : 'Save the card'}
      </button>
      {note && <p className={note.bad ? 'error-line' : 'muted small'}>{note.text}</p>}
    </div>
  );
}
