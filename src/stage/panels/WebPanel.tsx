/** A page to visit: its address, what it is, and Open (in your browser). */
import { core } from '../../kernel/ipc';
import { urlHost } from '../activity.ts';
import type { PanelProps } from './panel-props.ts';

export function WebPanel({ panel }: PanelProps<'web'>) {
  return (
    <div className="web-card">
      <span className="web-host">{urlHost(panel.url)}</span>
      {panel.summary && <p className="selectable">{panel.summary}</p>}
      <button type="button" className="btn btn-primary btn-small" onClick={() => void core.stageOpen(panel.url)}>
        Open the page
      </button>
    </div>
  );
}
