/**
 * The memory drawer: what the person's DKG graph holds, read live with the same bounded
 * queries the assistant uses. Facts can be forgotten here (a retraction is written; DKG writes
 * are additive, so nothing is silently deleted).
 */
import { useEffect, useState } from 'react';

import { core, sentence, type Overview } from '../kernel/ipc';

const TABS = ['Facts', 'Actions', 'Reminders', 'Queries'] as const;
type Tab = (typeof TABS)[number];

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function MemoryDrawer({ open, onClose, refreshKey }: { open: boolean; onClose: () => void; refreshKey: number }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('Facts');

  const load = () =>
    core
      .overview()
      .then((o) => {
        setData(o);
        setError(null);
      })
      .catch((e) => setError(sentence(e)));
  useEffect(() => {
    if (open) load();
  }, [open, refreshKey]);

  const forget = async (id: string) => {
    try {
      await core.forgetFact(id);
      load();
    } catch (e) {
      setError(sentence(e));
    }
  };

  return (
    <aside className={`drawer glass ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="drawer-head">
        <div>
          <p className="eyebrow">Your memory graph</p>
          <h3 className="mono selectable">{data?.graphId ?? '…'}</h3>
        </div>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close memory">
          ✕
        </button>
      </div>
      {data && (
        <div className="counts">
          <div><strong>{data.counts.facts}</strong><span>facts</span></div>
          <div><strong>{data.counts.turns}</strong><span>conversations</span></div>
          <div><strong>{data.counts.actions}</strong><span>actions</span></div>
          <div><strong>{data.counts.reminders}</strong><span>reminders</span></div>
        </div>
      )}
      {data && data.counts.waiting > 0 && <p className="warn-text small">{data.counts.waiting} memories are waiting for the node and will be written when it answers.</p>}
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'is-on' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="drawer-body">
        {error && <p className="error-line">{error}</p>}
        {!data && !error && <span className="spinner" />}
        {data && tab === 'Facts' && (data.facts.length === 0 ? <p className="muted">Nothing yet. Tell your assistant about yourself.</p> : (
          <ul className="records">
            {data.facts.map((f) => (
              <li key={f.id}>
                <div>
                  <p className="selectable">{f.text}</p>
                  <span className="muted small">{f.category || 'general'} · {when(f.at)} · <span className="mono">desk-fact-{f.id}</span></span>
                </div>
                <button type="button" className="link small" onClick={() => forget(f.id)}>Forget</button>
              </li>
            ))}
          </ul>
        ))}
        {data && tab === 'Actions' && (data.actions.length === 0 ? <p className="muted">No actions yet.</p> : (
          <ul className="records">
            {data.actions.map((a) => (
              <li key={a.id}>
                <div>
                  <p>{a.outcome}</p>
                  <span className="muted small">{a.skill} · {when(a.at)} · {a.succeeded ? 'done' : 'did not work'}</span>
                </div>
              </li>
            ))}
          </ul>
        ))}
        {data && tab === 'Reminders' && (data.reminders.length === 0 ? <p className="muted">No reminders coming up.</p> : (
          <ul className="records">
            {data.reminders.map((r) => (
              <li key={r.id}>
                <div>
                  <p>{r.text}</p>
                  <span className="muted small">{when(r.dueAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        ))}
        {data && tab === 'Queries' && (
          <ul className="records">
            {data.traces.map((t) => (
              <li key={t.label} className="query">
                <div>
                  <p><strong>{t.label}</strong> <span className="muted small">{t.rows} rows · {t.ms} ms · {t.layer}</span></p>
                  <code className="mono selectable">{t.sparql.replace(/PREFIX \S+: <[^>]+> /g, '')}</code>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
