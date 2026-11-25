/**
 * The keeper button: a global shortcut held to talk (push to talk). The core checks it parses
 * and is not taken by another app before saving.
 */
import { useEffect, useState } from 'react';

import { core, type SettingsChange, type ShortcutStatus } from '../kernel/ipc';

const SUGGESTED = ['Alt+Space', 'Control+Space', 'Alt+Shift+K', 'F5'];

export function ShortcutSection({ value, save }: { value: string; save: (c: SettingsChange) => Promise<void> }) {
  const [status, setStatus] = useState<ShortcutStatus | null>(null);
  const [draft, setDraft] = useState(value);

  const refresh = () => core.shortcutStatus().then(setStatus).catch(() => setStatus(null));
  useEffect(() => {
    refresh();
  }, [value]);

  const apply = (s: string) => save({ talkShortcut: s }).then(refresh);

  return (
    <div className="section">
      <div className="voice-row">
        <input className="field" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && apply(draft.trim())} placeholder="Alt+Space" aria-label="Push-to-talk shortcut" spellCheck={false} />
        <button type="button" className="btn" onClick={() => apply(draft.trim())}>
          Use it
        </button>
      </div>
      <div className="voice-row">
        {SUGGESTED.map((s) => (
          <button key={s} type="button" className="pill pill-button" onClick={() => { setDraft(s); apply(s); }}>
            {s}
          </button>
        ))}
      </div>
      <p className="muted small">
        {status?.registered ? `Hold ${status.shortcut} anywhere to talk to your keeper; let go when you're done.` : value ? 'This shortcut is not active (another app may use it). Try another.' : 'Off.'}
      </p>
    </div>
  );
}
