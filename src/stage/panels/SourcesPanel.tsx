/** The sources a research answer cites, numbered as the answer cites them ([1], [2]…); each opens in the browser. */
import { core } from '../../kernel/ipc';
import { urlHost } from '../activity.ts';
import type { PanelProps } from './panel-props.ts';

export function SourcesPanel({ panel }: PanelProps<'sources'>) {
  return (
    <ol className="sources">
      {panel.items.map((s, i) => (
        <li key={s.url}>
          <span className="source-num">{i + 1}</span>
          <span className="source-body">
            <button type="button" className="link source-title" onClick={() => void core.stageOpen(s.url)}>{s.title}</button>
            <span className="muted small">{urlHost(s.url)}{s.note ? ` · ${s.note}` : ''}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
