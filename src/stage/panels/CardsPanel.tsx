/** A cards panel: each card lifts and flips on hover to show its body; clicking asks about it. */
import { cardWhat } from '../focus.ts';
import { stagger } from '../stagger.ts';
import type { PanelProps } from './panel-props.ts';

export function CardsPanel({ panel, onPick }: PanelProps<'cards'>) {
  return (
    <div className="cards">
      {panel.cards.map((card, i) => (
        <button key={i} type="button" className="flip-card" style={stagger(i)}
          onClick={() => onPick(cardWhat(card.title))}>
          <span className="flip-inner">
            <span className="flip-face flip-front">
              {card.emoji && <span className="card-emoji" aria-hidden="true">{card.emoji}</span>}
              <span className="card-title">{card.title}</span>
            </span>
            <span className="flip-face flip-back">
              <span className="card-title small-title">{card.title}</span>
              <span className="card-body">{card.body}</span>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
