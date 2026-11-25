/**
 * Share and receive: export this keeper (soul, role, body and outfit; never its memories) or its
 * soul as a `.keeper.json` pack in Downloads, or import a pack someone gave you.
 */
import { useState } from 'react';

import { core, sentence, type Imported, type KeeperProfile } from '../kernel/ipc';
import { PackImport } from './PackImport';

export function ShareSection({ keeper, soulName, onImported }: { keeper: KeeperProfile; soulName: string; onImported: (i: Imported) => void }) {
  const [note, setNote] = useState<string | null>(null);
  const share = (kind: 'keeper' | 'soul', id: string) =>
    core
      .exportPack(kind, id)
      .then((path) => setNote(`Saved ${path.split('/').pop()} in Downloads.`))
      .catch((e) => setNote(sentence(e)));

  return (
    <div className="section">
      <div className="voice-row">
        <button type="button" className="btn" onClick={() => share('keeper', keeper.id)}>
          Share {keeper.name}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => share('soul', keeper.soul)}>
          Share the soul ({soulName})
        </button>
      </div>
      <PackImport onImported={onImported} />
      {note && <p className="muted small">{note}</p>}
      <p className="muted small">Packs carry who a keeper is and how it looks, never what it remembers.</p>
    </div>
  );
}
