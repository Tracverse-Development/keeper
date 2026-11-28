/**
 * An email the keeper wrote and opened in the person's own mail app (never sent by Keeper): who
 * it is to, its subject and its words with their line breaks, and Copy for those who write in a
 * browser. Plain text only.
 */
import { useState } from 'react';

import type { PanelProps } from './panel-props.ts';

export function EmailPanel({ panel }: PanelProps<'email'>) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const text = panel.subject ? `${panel.subject}\n\n${panel.body}` : panel.body;
    void navigator.clipboard.writeText(text).then(() => setCopied(true)).catch(() => setCopied(false));
  };
  return (
    <div className="email-card">
      <dl className="email-head">
        <dt>To</dt>
        <dd className="selectable">{panel.to.length ? panel.to.join(', ') : 'Not filled in yet'}</dd>
        {panel.subject && (
          <>
            <dt>Subject</dt>
            <dd className="selectable">{panel.subject}</dd>
          </>
        )}
      </dl>
      <p className="email-body selectable">{panel.body}</p>
      <button type="button" className="btn btn-small" onClick={copy}>
        {copied ? 'Copied' : 'Copy the email'}
      </button>
    </div>
  );
}
