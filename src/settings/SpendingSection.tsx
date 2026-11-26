/**
 * Spending: what the cloud minds cost this month (as the engine reports it, at its own prices)
 * and a monthly limit. Once the limit is reached, answers stay on this Mac (a local model when
 * one is installed, else the built-in mind) until the next month or a higher limit.
 */
import { useEffect, useState } from 'react';

import { core, type Settings, type SettingsChange, type Spending } from '../kernel/ipc';
import { costWords } from '../conversation/speed-words';

/** The limits offered (dollars a month; 0 = none). */
const LIMITS = [0, 5, 10, 20, 50, 100] as const;

export function SpendingSection({ settings, save }: { settings: Settings; save: (c: SettingsChange) => void }) {
  const [spending, setSpending] = useState<Spending | null>(null);
  const cap = settings.monthlyCapUsd ?? 0;
  useEffect(() => {
    core.usageMonth().then(setSpending).catch(() => undefined);
  }, [cap]);

  return (
    <div className="spending">
      <p className="spending-now">
        <strong>{spending ? (spending.usd > 0 ? costWords(spending.usd).replace(/^about /, '') : 'Nothing') : '…'}</strong>
        <span className="muted small">
          {spending ? ` this month, over ${spending.calls.toLocaleString('en-US')} ${spending.calls === 1 ? 'call' : 'calls'}.` : ''} Counted at the engine's own prices; with a Claude plan it is covered by the plan, not billed again.
        </span>
      </p>
      <div className="model-row">
        <label className="muted small" htmlFor="monthly-cap">
          Monthly limit
        </label>
        <select id="monthly-cap" className="field field-small" value={cap} onChange={(e) => save({ monthlyCapUsd: Number(e.target.value) })}>
          {LIMITS.map((v) => (
            <option key={v} value={v}>
              {v === 0 ? 'No limit' : `$${v} a month`}
            </option>
          ))}
        </select>
      </div>
      {spending?.reached && <p className="trail-note">The limit is reached: answers stay on this Mac until next month, or until you raise it.</p>}
    </div>
  );
}
