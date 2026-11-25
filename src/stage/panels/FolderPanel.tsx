/**
 * A folder panel: a live view of one folder while (or after) the keeper works in it. The path
 * is breadcrumbs, a summary counts the changes, and entries land one by one like a running
 * process: added in green, removed struck through in red, moved with an arrow to where it went,
 * kept muted. Clicking an entry asks about it.
 */
import { Breadcrumbs } from '../Breadcrumbs.tsx';
import { folderEntryWhat } from '../focus.ts';
import { Icon } from '../icons.tsx';
import { stagger } from '../stagger.ts';
import type { PanelProps } from './panel-props.ts';

const CHANGE_WORDS = { added: 'Added', removed: 'Removed', moved: 'Moved', kept: 'Kept' } as const;

export function FolderPanel({ panel, onPick }: PanelProps<'folder'>) {
  const counts = (['added', 'moved', 'removed', 'kept'] as const)
    .map((change) => ({ change, n: panel.entries.filter((e) => (e.change ?? 'kept') === change).length }))
    .filter((c) => c.n > 0);

  return (
    <div className="folder">
      <div className="folder-head">
        <span className="folder-root"><Icon name="folder" size={16} /></span>
        <Breadcrumbs path={panel.path} max={5} />
        <span className="folder-counts">
          {counts.map((c) => <span key={c.change} className={`change-badge is-${c.change}`}>{c.n} {CHANGE_WORDS[c.change].toLowerCase()}</span>)}
        </span>
      </div>
      <ul className="folder-list">
        {panel.entries.map((entry, i) => {
          const change = entry.change ?? 'kept';
          return (
            <li key={`${entry.name}-${i}`} style={stagger(i)}>
              <button type="button" className={`entry is-${change}`} onClick={() => onPick(folderEntryWhat(entry, panel.path))}>
                <span className={`entry-icon is-${entry.kind}`}><Icon name={entry.kind === 'folder' ? 'folder' : 'file'} size={16} /></span>
                <span className="entry-name">{entry.name}</span>
                {change === 'moved' && entry.to && (
                  <span className="entry-to"><Icon name="move" size={14} /><Breadcrumbs path={entry.to} max={3} /></span>
                )}
                <span className={`change-badge is-${change}`}>{CHANGE_WORDS[change]}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
