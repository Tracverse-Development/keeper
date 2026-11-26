/**
 * Is everything working? Every check is run for real when Settings opens (and on "Check again"):
 * the memory node, this keeper's memory, anything waiting to be saved, the keeper's mind, the
 * voice, the calendar and the spending limit. Each says what it found in plain words and, where
 * Keeper can do something about it, offers one fix.
 */
import { useEffect, useState } from 'react';

import { core, sentence, type HealthCheck } from '../kernel/ipc';
import { problemsFirst, summaryLine, worst } from './health-view';

export function HealthSection() {
  const [checks, setChecks] = useState<HealthCheck[] | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = (id: string, call: () => Promise<HealthCheck[]>) => {
    setBusy(id);
    setError(null);
    call()
      .then(setChecks)
      .catch((e) => setError(sentence(e)))
      .finally(() => setBusy(''));
  };
  useEffect(() => run('all', core.healthCheck), []);

  // The report holds the version, the system, these checks and Keeper's recent problems: no
  // conversation, fact or key. Copied, or shown to copy by hand when the clipboard says no.
  const [copied, setCopied] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const copyReport = async () => {
    setCopied(null);
    try {
      const text = await core.supportReport();
      try {
        await navigator.clipboard.writeText(text);
        setCopied('Copied. Paste it into a message to support.');
        setReport(null);
      } catch {
        setReport(text);
        setCopied('Select it below and copy it.');
      }
    } catch (e) {
      setError(sentence(e));
    }
  };

  if (!checks) return <p className="muted small">{error ?? 'Checking…'}</p>;
  return (
    <div className="health">
      <div className="health-summary">
        <span className={`dot ${worst(checks) === 'ok' ? 'ok' : worst(checks) === 'warn' ? 'warn' : 'off'}`} />
        <strong>{summaryLine(checks)}</strong>
        <button type="button" className="btn btn-ghost btn-small" disabled={busy !== ''} onClick={() => run('all', core.healthCheck)}>
          {busy === 'all' ? 'Checking…' : 'Check again'}
        </button>
      </div>
      <ul className="health-list">
        {problemsFirst(checks).map((c) => (
          <li key={c.id} className={`is-${c.level}`}>
            <span className={`dot ${c.level === 'ok' ? 'ok' : c.level === 'warn' ? 'warn' : 'off'}`} />
            <span className="health-words">
              <strong>{c.name}</strong>
              <span className="muted small selectable">{c.detail}</span>
            </span>
            {c.fix && (
              <button type="button" className="btn btn-small" disabled={busy !== ''} onClick={() => run(c.id, () => core.healthFix(c.id))}>
                {busy === c.id ? 'Working…' : c.fix}
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="health-support">
        <button type="button" className="btn btn-ghost btn-small" disabled={busy !== ''} onClick={() => void copyReport()}>
          Copy a report for support
        </button>
        {copied && <span className="muted small">{copied}</span>}
      </div>
      {report && <textarea className="field health-report" readOnly value={report} aria-label="Report for support" onFocus={(e) => e.currentTarget.select()} />}
      {error && <p className="error-line">{error}</p>}
    </div>
  );
}
