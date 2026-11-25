/**
 * An agenda panel: the day's items in order, each with its time (or "Any time"), an icon for its
 * kind (event, reminder, task) and its detail. Items slide in one after another; clicking one
 * asks about it.
 */
import { agendaWhat } from '../focus.ts';
import { Icon } from '../icons.tsx';
import { stagger } from '../stagger.ts';
import type { PanelProps } from './panel-props.ts';

const KIND_WORDS = { event: 'Event', reminder: 'Reminder', task: 'Task' } as const;

export function AgendaPanel({ panel, onPick }: PanelProps<'agenda'>) {
  return (
    <ol className="agenda">
      {panel.items.map((item, i) => {
        const kind = item.kind ?? 'event';
        return (
          <li key={i} style={stagger(i)}>
            <button type="button" className={`agenda-item is-${kind}`} onClick={() => onPick(agendaWhat(item))}>
              <span className={item.time ? 'agenda-time' : 'agenda-time is-any'}>{item.time ?? 'Any time'}</span>
              <span className="agenda-icon" title={KIND_WORDS[kind]}><Icon name={kind} size={16} /></span>
              <span className="agenda-body">
                <span className="agenda-title">{item.title}</span>
                {item.detail && <span className="agenda-detail">{item.detail}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
