/**
 * An agenda panel: the day's items in order, each with its time (or "Any time"), an icon for its
 * kind (event, reminder, task) and its detail. Items slide in one after another; clicking one
 * asks about it. A reminder row that carries its id has a small Delete beside it (reported as
 * `{ type: 'reminder-delete', reminderId }`): the row fades and says it is deleted.
 */
import { useState } from 'react';

import { agendaTime } from '../agenda-time.ts';
import { agendaWhat } from '../focus.ts';
import { Icon } from '../icons.tsx';
import { stagger } from '../stagger.ts';
import type { ActingPanelProps } from './panel-props.ts';

const KIND_WORDS = { event: 'Event', reminder: 'Reminder', task: 'Task' } as const;

export function AgendaPanel({ panel, onPick, onAction }: ActingPanelProps<'agenda'>) {
  const [deleted, setDeleted] = useState<Set<string>>(() => new Set());
  const remove = (id: string) => {
    if (deleted.has(id)) return;
    setDeleted((s) => new Set(s).add(id));
    onAction({ type: 'reminder-delete', reminderId: id });
  };
  return (
    <ol className="agenda">
      {panel.items.map((item, i) => {
        const kind = item.kind ?? 'event';
        const time = item.time ? agendaTime(item.time) : null;
        const id = kind === 'reminder' ? item.id : undefined;
        const gone = !!id && deleted.has(id);
        return (
          <li key={i} style={stagger(i)} className={gone ? 'agenda-row is-deleted' : 'agenda-row'}>
            <button type="button" className={`agenda-item is-${kind}`} onClick={() => onPick(agendaWhat(item))} disabled={gone}>
              <span className={time ? 'agenda-time' : 'agenda-time is-any'}>
                {time?.day && <span className="agenda-day">{time.day}</span>}
                {time?.clock ?? 'Any time'}
              </span>
              <span className="agenda-icon" title={KIND_WORDS[kind]}><Icon name={kind} size={16} /></span>
              <span className="agenda-body">
                <span className="agenda-title">{item.title}</span>
                {gone ? <span className="agenda-detail">Deleted. It won't remind you.</span> : item.detail && <span className="agenda-detail">{item.detail}</span>}
              </span>
            </button>
            {id && !gone && (
              <button type="button" className="fact-action is-forget agenda-delete" onClick={() => remove(id)} aria-label={`Delete the reminder: ${item.title}`}>
                <Icon name="forget" size={14} /> Delete
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
