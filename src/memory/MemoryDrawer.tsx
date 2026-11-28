/**
 * The memory drawer: what one keeper's DKG graph holds, read live with the same bounded
 * queries the assistant uses. Facts can be forgotten here (a retraction is written; DKG writes
 * are additive, so nothing is silently deleted). The Questions tab asks the graph any question
 * from the core's catalog. `keeper` is the active keeper's id; changing it reloads everything.
 */
import { mindName } from '../kernel/mind-words.ts';
import { useEffect, useRef, useState } from 'react';

import { core, sentence, type Overview } from '../kernel/ipc';
import { withoutPrefixes } from './questions';
import { QuestionsTab } from './QuestionsTab';
import { useEscape } from '../kernel/use-escape';

/** How a repeating reminder's rhythm reads in the list. */
const REPEAT_WORDS: Record<string, string> = { daily: 'every day', weekdays: 'every weekday', weekly: 'every week' };

const TABS = ['Conversations', 'Knowledge', 'Actions', 'Reminders', 'Questions', 'Queries'] as const;
type Tab = (typeof TABS)[number];

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function MemoryDrawer({ open, onClose, refreshKey, keeper }: { open: boolean; onClose: () => void; refreshKey: number; keeper: string }) {
  useEscape(open, onClose);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('Conversations');

  // The keeper this drawer shows now: an answer for a keeper switched away from is dropped.
  const current = useRef(keeper);
  current.current = keeper;
  const load = () => {
    const asked = keeper;
    return core
      .overview(asked)
      .then((o) => {
        if (current.current !== asked) return;
        setData(o);
        setError(null);
      })
      .catch((e) => {
        if (current.current === asked) setError(sentence(e));
      });
  };
  // Another keeper is another graph: drop the last one's records before reading the new one.
  useEffect(() => {
    setData(null);
    setError(null);
  }, [keeper]);
  useEffect(() => {
    if (open) load();
  }, [open, refreshKey, keeper]);

  const cancelReminder = async (id: string) => {
    try {
      await core.reminderCancel(id, keeper ?? undefined);
      load();
    } catch (e) {
      setError(sentence(e));
    }
  };

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
          <div><strong>{data.counts.facts}</strong><span>{data.counts.facts === 1 ? 'thing known' : 'things known'}</span></div>
          <div><strong>{data.counts.turns}</strong><span>{data.counts.turns === 1 ? 'conversation' : 'conversations'}</span></div>
          <div><strong>{data.counts.actions}</strong><span>{data.counts.actions === 1 ? 'action' : 'actions'}</span></div>
          <div><strong>{data.counts.reminders}</strong><span>{data.counts.reminders === 1 ? 'reminder' : 'reminders'}</span></div>
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
        {tab !== 'Questions' && error && <p className="error-line">{error}</p>}
        {tab !== 'Questions' && !data && !error && <span className="spinner" />}
        {data && tab === 'Conversations' && (data.turns.length === 0 ? <p className="muted">No conversations yet. Say hello.</p> : (
          <ul className="records history">
            {data.turns.map((t) => (
              <li key={t.id}>
                <div>
                  <p className="selectable said">{t.said}</p>
                  <p className="selectable replied">{t.replied}</p>
                  <span className="muted small" title={`Saved in memory as desk-turn-${t.id}`}>{when(t.at)} · {mindName(t.mind || 'reflex')}</span>
                </div>
              </li>
            ))}
          </ul>
        ))}
        {data && tab === 'Knowledge' && (data.facts.length === 0 ? <p className="muted">Nothing yet. Tell your assistant about yourself.</p> : (
          <ul className="records">
            {data.facts.map((f) => (
              <li key={f.id}>
                <div>
                  <p className="selectable">{f.text}</p>
                  <span className="muted small" title={`Saved in memory as desk-fact-${f.id}`}>{f.category || 'general'} · {when(f.at)}</span>
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
            {/* Soonest first, as a day is lived (FIX-0054: 5:30 PM was listed above 9:00 AM). */}
            {[...data.reminders].sort((a, b) => a.dueAt.localeCompare(b.dueAt)).map((r) => (
              <li key={r.id}>
                <div>
                  <p>{r.text}</p>
                  <span className="muted small">
                    {when(r.dueAt)}
                    {r.repeat ? ` · ${REPEAT_WORDS[r.repeat] ?? r.repeat}` : ''}
                  </span>
                </div>
                <button type="button" className="btn btn-ghost btn-small" onClick={() => void cancelReminder(r.id)} aria-label={`Delete the reminder: ${r.text}`}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ))}
        {tab === 'Questions' && <QuestionsTab keeper={keeper} open={open} />}
        {data && tab === 'Queries' && (
          <ul className="records">
            {data.traces.map((t) => (
              <li key={t.label} className="query">
                <div>
                  <p><strong>{t.label}</strong> <span className="muted small">{t.rows} rows · {t.ms} ms · {t.layer}</span></p>
                  <code className="mono selectable">{withoutPrefixes(t.sparql)}</code>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
