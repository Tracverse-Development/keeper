/**
 * The phone link: turn it on, scan the QR code with the phone's camera, and talk to the
 * assistant from the phone (same Wi-Fi). Turning it off, or on again, makes the old code stop
 * working.
 */
import { useEffect, useState } from 'react';

import { core, sentence, type PhoneStatus } from '../kernel/ipc';

export function PhoneSection({ name }: { name: string }) {
  const [status, setStatus] = useState<PhoneStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    core.phoneStatus().then(setStatus).catch((e) => setError(sentence(e)));
  }, []);

  const toggle = (on: boolean) => {
    setError(null);
    (on ? core.phoneStart() : core.phoneStop()).then(setStatus).catch((e) => setError(sentence(e)));
  };

  return (
    <div className="section">
      <label className="toggle">
        <input type="checkbox" checked={Boolean(status?.on)} onChange={(e) => toggle(e.target.checked)} />
        <span>
          <strong>Talk to {name} from your phone</strong>
          <span className="muted small">Your phone must be on the same Wi-Fi. The link works only while this is on, and a new code is made each time.</span>
        </span>
      </label>
      {status?.on && (
        <div className="phone">
          <img src={status.qr} width={200} height={200} alt="QR code for the phone link" />
          <div>
            <p>Open your phone's camera and point it at the code.</p>
            <p className="muted small">On your phone, use the keyboard's microphone to speak. The phone reads replies aloud.</p>
          </div>
        </div>
      )}
      {error && <p className="error-line">{error}</p>}
    </div>
  );
}
