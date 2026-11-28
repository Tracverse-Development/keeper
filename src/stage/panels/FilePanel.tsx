/** A file the keeper made or found: its name and folder, Open (in Keeper's file viewer), and Show in Finder. */
import { useState } from 'react';

import { core, sentence } from '../../kernel/ipc';
import { openInFiles } from '../../files';
import { breadcrumbs } from '../activity.ts';
import type { PanelProps } from './panel-props.ts';

export function FilePanel({ panel }: PanelProps<'file'>) {
  const [error, setError] = useState<string | null>(null);
  const crumbs = breadcrumbs(panel.path, 4);
  const go = (how: 'open' | 'reveal') => (how === 'open' ? Promise.resolve(openInFiles(panel.path)) : core.stageOpen(panel.path, how)).catch((e) => setError(sentence(e)));
  return (
    <div className="file-card">
      <strong className="file-name">{crumbs[crumbs.length - 1]}</strong>
      <span className="muted small">{crumbs.slice(0, -1).join(' / ')}</span>
      {panel.note && <p className="selectable">{panel.note}</p>}
      <span className="inv-actions">
        <button type="button" className="btn btn-primary btn-small" onClick={() => void go('open')}>Open</button>
        <button type="button" className="btn btn-small" onClick={() => void go('reveal')}>Show in Finder</button>
      </span>
      {error && <p className="error-line small">{error}</p>}
    </div>
  );
}
