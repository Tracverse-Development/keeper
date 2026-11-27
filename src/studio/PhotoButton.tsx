/**
 * The Photo button on the Studio's stage: choose Portrait (the keeper framed whole on its stage)
 * or Card (the keeper card), and a still in its current stage mood, outfit and pose is saved to
 * ~/Pictures/Keeper on this Mac (`take-photo.ts`). A line under the button says where it went.
 */
import { useEffect, useRef, useState } from 'react';

import { sentence } from '../kernel/ipc';
import type { CardFacts } from './keeper-card';
import { PHOTO_KINDS, savedWords, type PhotoKind } from './photo-mode';
import { takePhoto, type TakeStill } from './take-photo';
import './photo.css';

/** How long the confirmation stays (ms). */
const NOTE_MS = 6000;

interface Props {
  keeperId: string;
  facts: CardFacts;
  /** Takes a still of the stage (`CharacterStage` `photoRef`). */
  still: TakeStill;
}

export function PhotoButton({ keeperId, facts, still }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  const hideNote = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(hideNote.current), []);

  const take = async (kind: PhotoKind) => {
    setOpen(false);
    setBusy(true);
    setNote(null);
    window.clearTimeout(hideNote.current);
    try {
      const saved = await takePhoto(kind, still, keeperId, facts);
      setNote({ text: savedWords(kind, saved.shown), bad: false });
    } catch (e) {
      setNote({ text: sentence(e), bad: true });
    } finally {
      setBusy(false);
      hideNote.current = window.setTimeout(() => setNote(null), NOTE_MS);
    }
  };

  return (
    <div className="studio-photo">
      <button type="button" className="btn btn-small studio-photo-btn" aria-expanded={open} aria-haspopup="menu" disabled={busy} onClick={() => setOpen((o) => !o)} title="Save a picture of your keeper on this Mac">
        {busy ? 'Saving…' : 'Photo'}
      </button>
      {open && (
        <div className="studio-photo-menu" role="menu" aria-label="Photo">
          {PHOTO_KINDS.map((k) => (
            <button key={k.id} type="button" role="menuitem" className="studio-photo-item" onClick={() => void take(k.id)}>
              <strong>{k.name}</strong>
              <span className="muted small">{k.about}</span>
            </button>
          ))}
          <p className="muted small studio-photo-where">Saved in Pictures/Keeper on this Mac. Nothing is uploaded.</p>
        </div>
      )}
      {note && (
        <p className={`studio-photo-note ${note.bad ? 'is-bad' : ''}`} role="status">
          {note.text}
        </p>
      )}
    </div>
  );
}
