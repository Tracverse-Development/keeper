/**
 * A timeline panel: a gold line with a dot per event. Up to five events run across (each a card
 * under its dot); more run down the left. Events slide in in order and the line grows with them;
 * clicking an event asks about that moment.
 */
import type { CSSProperties } from 'react';

import { momentWhat } from '../focus.ts';
import { timelineOrientation } from '../shape.ts';
import { stagger } from '../stagger.ts';
import type { PanelProps } from './panel-props.ts';

export function TimelinePanel({ panel, onPick }: PanelProps<'timeline'>) {
  const orientation = timelineOrientation(panel.events.length);
  return (
    <ol className={`timeline is-${orientation}`} style={{ '--n': panel.events.length } as CSSProperties}>
      {panel.events.map((event, i) => (
        <li key={i} className="moment" style={stagger(i)}>
          <button type="button" className="moment-button" onClick={() => onPick(momentWhat(event.title, event.when))}>
            <span className="moment-dot" aria-hidden="true" />
            <span className="moment-when">{event.when}</span>
            <span className="moment-title">{event.title}</span>
            {event.detail && <span className="moment-detail">{event.detail}</span>}
          </button>
        </li>
      ))}
    </ol>
  );
}
