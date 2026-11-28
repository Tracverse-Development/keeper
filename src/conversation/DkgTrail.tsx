/**
 * "What I looked up": the SPARQL queries a turn ran on the person's graph and the Knowledge
 * Assets it wrote, so every answer shows that it came from the DKG.
 */
import { trailWords } from './trail-words.ts';
import { useState } from 'react';

import type { TurnResult } from '../kernel/ipc';
import { fellBackWords } from './speed-words';

export function DkgTrail({ result }: { result: TurnResult }) {
  const [open, setOpen] = useState(false);
  const rows = result.traces.reduce((n, t) => n + t.rows, 0);
  const wrote = result.writes.length;
  return (
    <div className="trail">
      <button type="button" className="trail-chip" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={`dot ${result.memoryOffline ? 'off' : 'ok'}`} />
        {result.memoryOffline ? 'Memory node offline' : trailWords(result.traces.length, rows, wrote)}
        <span className="trail-mind">{result.mind.label}</span>
      </button>
      {result.mind.fellBack && <p className="trail-note">{fellBackWords(result.mind.fellBack)}</p>}
      {open && (
        <div className="trail-body selectable">
          {result.traces.map((t) => (
            <div key={t.label} className="trail-query">
              <div className="trail-head">
                <strong>{t.label}</strong>
                <span className="muted">
                  {t.rows} rows · {t.ms} ms · {t.layer}
                </span>
              </div>
              <code className="mono">{t.sparql.replace(/PREFIX \S+: <[^>]+> /g, '')}</code>
            </div>
          ))}
          {result.writes.map((w) => (
            <div key={w.name} className="trail-write">
              <span className={`dot ${w.queued ? 'warn' : 'ok'}`} />
              <span className="mono">{w.name}</span>
              <span className="muted mono">{w.queued ? 'waiting for the node' : w.ual || w.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
