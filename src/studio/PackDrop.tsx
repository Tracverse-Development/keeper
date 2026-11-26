/**
 * Receive a pack in the Marketplace: drop a `.keeper.json` file (or choose one), read what it
 * says it carries, then add it or not. Nothing is saved until "Add" is pressed, and the core
 * validates the whole file again on the way in (data only, never code, never memories).
 */
import { useRef, useState, type DragEvent } from 'react';

import { core, sentence, type Imported } from '../kernel/ipc';
import { PACK_MAX_BYTES, packPreview, type PackPreview } from './market-view';

export function PackDrop({ onImported }: { onImported: (i: Imported) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [pending, setPending] = useState<{ text: string; preview: Extract<PackPreview, { ok: true }> } | null>(null);
  const [note, setNote] = useState<{ words: string; bad: boolean } | null>(null);
  const [adding, setAdding] = useState(false);

  const read = async (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!file) return;
    setPending(null);
    if (file.size > PACK_MAX_BYTES) {
      setNote({ words: 'That file is too big to be a keeper pack.', bad: true });
      return;
    }
    const text = await file.text();
    const preview = packPreview(text);
    if (!preview.ok) {
      setNote({ words: preview.why, bad: true });
      return;
    }
    setNote(null);
    setPending({ text, preview });
  };

  const add = async () => {
    if (!pending) return;
    setAdding(true);
    try {
      const done = await core.importPack(pending.text);
      setNote({ words: done.kind === 'keeper' ? `${done.name} joined your keepers.` : `${done.name} is in your kit.`, bad: false });
      setPending(null);
      onImported(done);
    } catch (e) {
      setNote({ words: sentence(e), bad: true });
    } finally {
      setAdding(false);
    }
  };

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void read(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="pack-drop-wrap">
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={(e) => void read(e.target.files?.[0])} />
      {!pending && (
        <div className={`pack-drop ${over ? 'is-over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
          <strong>Drop a pack file here</strong>
          <span className="muted small">A file ending in .keeper.json that someone shared with you.</span>
          <button type="button" className="btn btn-small" onClick={() => input.current?.click()}>Choose a file…</button>
        </div>
      )}
      {pending && (
        <div className="pack-preview" role="group" aria-label="The pack you chose">
          <span className="tag">{pending.preview.title}</span>
          <strong className="pack-preview-name">{pending.preview.name}</strong>
          <ul className="pack-carries">
            {pending.preview.carries.map((c) => <li key={c}>{c}</li>)}
            <li className="muted">No memories, no code</li>
          </ul>
          <div className="item-actions">
            <button type="button" className="btn btn-primary btn-small" disabled={adding} onClick={() => void add()}>{adding ? 'Adding…' : pending.preview.kind === 'keeper' ? 'Add this keeper' : 'Add to my kit'}</button>
            <button type="button" className="btn btn-ghost btn-small" disabled={adding} onClick={() => setPending(null)}>Not now</button>
          </div>
        </div>
      )}
      {note && <p className={note.bad ? 'error-line' : 'ok-text small'} role="status">{note.words}</p>}
    </div>
  );
}
