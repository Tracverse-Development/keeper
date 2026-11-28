/**
 * The working card's controls (inside `ActivityPanel` while a keeper works): Pause / Resume,
 * Change course (a small box for a correction such as "leave the heading alone"), Stop, and
 * how long it has worked (corrections it took appear in the step list, where they happened).
 * Driven by `useWorkControl`.
 */
import { useState } from 'react';

import type { WorkControl } from '../conversation/useWorkControl.ts';

export function WorkControls({ control, keeperName }: { control: WorkControl; keeperName: string }) {
  const [changing, setChanging] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const sent = await control.redirect(text);
    setSending(false);
    if (sent) {
      setText('');
      setChanging(false);
    }
  };

  return (
    <div className="work-controls">
      {changing && (
        <form
          className="work-change"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            className="field work-change-field"
            placeholder={`What should ${keeperName} do differently?`}
            aria-label="Change course"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setChanging(false);
              }
            }}
            maxLength={2000}
            autoFocus
          />
          <button type="submit" className="btn btn-primary btn-small" disabled={!text.trim() || sending}>
            {sending ? <span className="spinner" aria-hidden="true" /> : 'Change course'}
          </button>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setChanging(false)}>
            Cancel
          </button>
          <p className="work-change-hint muted small">{keeperName} starts again from what it has already done, with your change.</p>
        </form>
      )}
      {control.error && <p className="error-line small">{control.error}</p>}
      <div className="work-buttons">
        {control.paused ? (
          <button type="button" className="btn btn-primary btn-small" onClick={control.resume}>
            <PlayIcon /> Resume
          </button>
        ) : (
          <button type="button" className="btn btn-small" onClick={control.pause}>
            <PauseIcon /> Pause
          </button>
        )}
        {!changing && (
          <button type="button" className="btn btn-small" onClick={() => setChanging(true)}>
            Change course
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-small" onClick={control.stop} title="Stop (Esc)">
          Stop
        </button>
      </div>
    </div>
  );
}

export function PauseIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} aria-hidden="true">
      <rect x="2" y="1.5" width="3" height="9" rx="1" fill="currentColor" />
      <rect x="7" y="1.5" width="3" height="9" rx="1" fill="currentColor" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
      <path d="M3 1.8v8.4a.6.6 0 0 0 .9.5l6.6-4.2a.6.6 0 0 0 0-1L3.9 1.3a.6.6 0 0 0-.9.5Z" fill="currentColor" />
    </svg>
  );
}
