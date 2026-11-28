/**
 * What's new: once, after Keeper updates, the changelog entries of the versions installed since
 * the person last looked (built into the app from CHANGELOG.md, so it says exactly what was
 * released). "Got it" marks them seen; they can always be read again in the changelog.
 */
import { useCallback, useEffect, useState } from 'react';

import { core, type ChangeEntry } from '../kernel/ipc';
import { useEscape } from '../kernel/use-escape';
import { changeLine } from './whats-new-text.ts';

export function WhatsNew() {
  const [entries, setEntries] = useState<ChangeEntry[]>([]);

  useEffect(() => {
    core.whatsNew().then(setEntries).catch(() => undefined);
  }, []);

  const close = useCallback(() => {
    setEntries([]);
    void core.whatsNewSeen().catch(() => undefined);
  }, []);
  useEscape(entries.length > 0, close);
  if (entries.length === 0) return null;
  return (
    <div className="sheet-backdrop is-open" onClick={close}>
      <section className="whats-new glass" role="dialog" aria-modal="true" aria-label="What's new in Keeper" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <p className="eyebrow">What's new</p>
            <h3>Keeper {entries[0].version}</h3>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="whats-new-body">
          {entries.map((e) => (
            <div key={e.version} className="whats-new-version">
              {entries.length > 1 && <p className="eyebrow">Version {e.version}</p>}
              {e.sections.map(([title, items]) => (
                <div key={title}>
                  <strong className="whats-new-title">{title}</strong>
                  <ul>
                    {items.map((item) => (
                      <li key={item}>{changeLine(item).map((run, i) => (run.bold ? <strong key={i}>{run.text}</strong> : <span key={i}>{run.text}</span>))}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="row">
          {/* Focus starts here, so typing while it is open never reaches the message box behind it. */}
          <button type="button" className="btn btn-primary" onClick={close} autoFocus>
            Got it
          </button>
        </div>
      </section>
    </div>
  );
}
