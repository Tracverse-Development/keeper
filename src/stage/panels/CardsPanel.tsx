/**
 * A cards panel: each card shows its title and its text together (long text trimmed to a few
 * lines, the whole of it on hover); a card lifts on hover and clicking asks the keeper about it.
 */
import { cardWhat } from '../focus.ts';
import { stagger } from '../stagger.ts';
import type { PanelProps } from './panel-props.ts';

export function CardsPanel({ panel, onPick }: PanelProps<'cards'>) {
  return (
    <div className="cards">
      {panel.cards.map((card, i) => (
        <button key={i} type="button" className="idea-card" style={stagger(i)} title={card.body} onClick={() => onPick(cardWhat(card.title))}>
          <span className="idea-head">
            {card.emoji && <span className="card-emoji" aria-hidden="true">{card.emoji}</span>}
            <span className="card-title">{card.title}</span>
          </span>
          {card.body && <span className="card-body">{card.body}</span>}
          <span className="idea-ask" aria-hidden="true">Ask about this ›</span>
        </button>
      ))}
    </div>
  );
}
