/**
 * A files panel: what was done to which files, one row each, with an icon per action, the path
 * as breadcrumb chips and, for a move, an arrow to where it went. Clicking a row opens it in
 * Keeper's file viewer (a deleted one asks about it).
 */
import { openInFiles } from '../../files';
import { Breadcrumbs } from '../Breadcrumbs.tsx';
import { fileWhat } from '../focus.ts';
import { Icon } from '../icons.tsx';
import { stagger } from '../stagger.ts';
import type { PanelProps } from './panel-props.ts';

const ACTION_WORDS: Record<string, string> = {
  open: 'Opened', create: 'Created', move: 'Moved', edit: 'Edited', delete: 'Deleted', find: 'Found',
};

export function FilesPanel({ panel, onPick }: PanelProps<'files'>) {
  return (
    <ul className="files">
      {panel.items.map((item, i) => (
        <li key={i} style={stagger(i)}>
          <button type="button" className={`file-row is-${item.action}`} onClick={() => (item.action === 'delete' ? onPick(fileWhat(item.action, item.path)) : openInFiles(item.to ?? item.path))}>
            <span className="file-icon"><Icon name={item.action} size={17} /></span>
            <span className="file-action">{ACTION_WORDS[item.action] ?? item.action}</span>
            <span className="file-paths">
              <Breadcrumbs path={item.path} />
              {item.to && (
                <>
                  <span className="file-arrow" aria-label="to"><Icon name="move" size={15} /></span>
                  <Breadcrumbs path={item.to} />
                </>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
