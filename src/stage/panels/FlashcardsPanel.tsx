/**
 * A flashcards panel: one card at a time. Clicking turns it over (a 2D squash-and-swap, not a
 * 3D flip: WebKit flattens preserve-3d under the stage's masked scroller). With the back showing,
 * "I knew it" / "Not yet" report the card with `onAction` (type "card") and move on. Progress dots
 * fill green or gold; at the end a small celebration, the score, and a round of the missed ones.
 */
import { useState } from 'react';

import { Icon } from '../icons.tsx';
import type { ActingPanelProps } from './panel-props.ts';
import { Celebration } from './Celebration.tsx';

/** Half a turn: the card squashes to an edge, swaps its face, and opens again. */
const HALF_TURN_MS = 170;

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function FlashcardsPanel({ panel, onAction }: ActingPanelProps<'flashcards'>) {
  const [deck, setDeck] = useState(() => panel.cards.map((_, i) => i));
  const [at, setAt] = useState(0);
  const [back, setBack] = useState(false);
  const [turning, setTurning] = useState(false);
  const [known, setKnown] = useState<Record<number, boolean>>({});

  const card = panel.cards[deck[at] ?? -1];
  const finished = at >= deck.length;

  const turn = () => {
    if (turning || !card) return;
    const half = reducedMotion() ? 0 : HALF_TURN_MS;
    setTurning(true);
    window.setTimeout(() => { setBack((b) => !b); window.setTimeout(() => setTurning(false), half); }, half);
  };
  const mark = (knewIt: boolean) => {
    if (!card) return;
    onAction({ type: 'card', panelId: panel.id, front: card.front, known: knewIt });
    setKnown((k) => ({ ...k, [deck[at]]: knewIt }));
    setBack(false);
    setAt((n) => n + 1);
  };
  const again = (onlyMissed: boolean) => {
    setDeck(onlyMissed ? deck.filter((i) => known[i] === false) : panel.cards.map((_, i) => i));
    setKnown({});
    setAt(0);
    setBack(false);
  };

  const knewCount = deck.filter((i) => known[i]).length;
  return (
    <div className="flash">
      <div className="flash-dots" aria-label={`Card ${Math.min(at + 1, deck.length)} of ${deck.length}`}>
        {deck.map((i, n) => <span key={i} className={n === at ? 'flash-dot is-now' : known[i] === undefined ? 'flash-dot' : known[i] ? 'flash-dot is-known' : 'flash-dot is-missed'} />)}
      </div>
      {finished ? (
        <div className="flash-done">
          <Celebration title={knewCount === deck.length ? 'You knew every one.' : `You knew ${knewCount} of ${deck.length}.`}
            detail={knewCount === deck.length ? 'That deck is yours.' : 'One more round on the rest makes them stick.'} />
          <div className="flash-actions">
            <button type="button" className="link" onClick={() => again(false)}>Start over</button>
            {knewCount < deck.length && (
              <button type="button" className="btn btn-primary stage-small-btn" onClick={() => again(true)}>
                Practise the {deck.length - knewCount} missed
              </button>
            )}
          </div>
        </div>
      ) : card && (
        <>
          <button type="button" key={at} className={`flash-card${back ? ' is-back' : ''}${turning ? ' is-turning' : ''}`} onClick={turn}
            aria-label={back ? `Answer: ${card.back}. Click to see the question.` : `${card.front}. Click to see the answer.`}>
            <span className="flash-side">{back ? 'Answer' : 'Question'}</span>
            <span className="flash-text">{back ? card.back : card.front}</span>
            <span className="flash-hint">{back ? 'Did you know it?' : 'Click to turn over'}</span>
          </button>
          <div className={back ? 'flash-actions is-on' : 'flash-actions'}>
            <button type="button" className="btn stage-small-btn flash-no" disabled={!back} onClick={() => mark(false)}>
              <Icon name="back" size={15} /> Not yet
            </button>
            <button type="button" className="btn btn-primary stage-small-btn" disabled={!back} onClick={() => mark(true)}>
              <Icon name="check" size={15} /> I knew it
            </button>
          </div>
        </>
      )}
    </div>
  );
}
