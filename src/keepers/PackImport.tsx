/**
 * Import a `.keeper.json` pack (a keeper, a soul or a part variant). The file is read here as
 * text and handed to the core, which validates everything before anything is saved (data only,
 * never code); the result is said in plain words.
 */
import { useRef, useState } from 'react';

import { core, sentence, type Imported } from '../kernel/ipc';

const MAX_BYTES = 64 * 1024;

export function PackImport({ onImported, label = 'Import a pack…' }: { onImported: (i: Imported) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setNote('That file is too big to be a keeper pack.');
      return;
    }
    try {
      const done = await core.importPack(await file.text());
      setNote(done.kind === 'keeper' ? `${done.name} joined your keepers.` : `${done.name} is in your kit.`);
      onImported(done);
    } catch (e) {
      setNote(sentence(e));
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  return (
    <span className="pack-import">
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <button type="button" className="link small" onClick={() => input.current?.click()}>
        {label}
      </button>
      {note && <span className="muted small">{note}</span>}
    </span>
  );
}
