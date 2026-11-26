/**
 * The child profile: one switch a parent turns on with a passcode and can only turn off with
 * the same passcode. While it is on the keeper talks as to a child, shows no mood, cannot use
 * the computer or the web, and takes no packs from other people.
 */
import { useEffect, useState } from 'react';

import { core, sentence } from '../kernel/ipc';

/** The shortest passcode the core takes (`kernel::child_lock::MIN_PASSCODE`). */
const MIN_PASSCODE = 4;

export function ChildSection({ onChanged }: { onChanged: () => void }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [asking, setAsking] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    core.childProfile().then(setOn).catch(() => setOn(false));
  }, []);

  const change = async () => {
    setBusy(true);
    setError(null);
    try {
      setOn(await core.childProfileSet(!on, passcode));
      setAsking(false);
      onChanged();
    } catch (e) {
      setError(sentence(e));
    } finally {
      setBusy(false);
      setPasscode('');
    }
  };

  if (on === null) return null;
  return (
    <div className="backup">
      <p className="muted small">
        {on
          ? 'The child profile is on: answers are kept suitable for a child, the keeper shows no mood, it cannot use this computer or the web, and packs from other people are refused.'
          : 'For a child using Keeper: answers kept suitable for a child, no simulated mood, no use of this computer or the web, and no packs from other people. A passcode you choose is needed to turn it off again.'}
      </p>
      {!asking ? (
        <div className="row">
          <button type="button" className="btn" onClick={() => setAsking(true)}>
            {on ? 'Turn the child profile off…' : 'Turn the child profile on…'}
          </button>
        </div>
      ) : (
        <>
          <input className="field" type="password" autoComplete="off" placeholder={on ? 'The passcode' : 'Choose a passcode'} aria-label={on ? 'The passcode' : 'Choose a passcode'} value={passcode} onChange={(e) => setPasscode(e.target.value)} />
          {!on && <p className="muted small">At least {MIN_PASSCODE} characters. Keep it to yourself: it is the only way to turn the child profile off.</p>}
          <div className="row">
            <button type="button" className="btn" disabled={busy} onClick={() => setAsking(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={busy || [...passcode].length < MIN_PASSCODE} onClick={() => void change()}>
              {on ? 'Turn it off' : 'Turn it on'}
            </button>
          </div>
        </>
      )}
      {error && <p className="error-line">{error}</p>}
    </div>
  );
}
