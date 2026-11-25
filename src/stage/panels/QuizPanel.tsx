/**
 * A quiz panel: the person picks an answer, it is checked here (the panel carries `answer`), a
 * right answer bursts gold and a wrong one shakes; then the explanation, "Try again" and "Why?"
 * (which asks the keeper why the right answer is right).
 */
import { useState } from 'react';

import { quizWhyWhat } from '../focus.ts';
import { Icon } from '../icons.tsx';
import { stagger } from '../stagger.ts';
import type { PanelProps } from './panel-props.ts';

const LETTERS = 'ABCDEFGHIJ';

export function QuizPanel({ panel, onPick }: PanelProps<'quiz'>) {
  const [chosen, setChosen] = useState<number | null>(null);
  const done = chosen !== null;
  const right = chosen === panel.answer;

  const choiceClass = (i: number) => {
    if (!done) return 'quiz-choice';
    if (i === panel.answer) return 'quiz-choice is-right';
    return i === chosen ? 'quiz-choice is-wrong' : 'quiz-choice is-faded';
  };

  return (
    <div className={done ? (right ? 'quiz is-won' : 'quiz is-missed') : 'quiz'}>
      <p className="quiz-question selectable">{panel.question}</p>
      <div className="quiz-choices">
        {panel.choices.map((choice, i) => (
          <button key={i} type="button" className={choiceClass(i)} style={stagger(i)} disabled={done}
            onClick={() => setChosen(i)}>
            <span className="quiz-letter">{LETTERS[i] ?? i + 1}</span>
            <span className="quiz-text">{choice}</span>
            {done && i === panel.answer && <span className="quiz-mark"><Icon name="check" size={16} /></span>}
            {done && i === chosen && !right && <span className="quiz-mark"><Icon name="cross" size={16} /></span>}
          </button>
        ))}
      </div>
      {done && (
        <div className="quiz-result" role="status">
          {right && <span className="quiz-burst" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} style={stagger(i)} />)}</span>}
          <p className="quiz-verdict">{right ? 'Exactly right.' : `Not quite. It's ${panel.choices[panel.answer] ?? ''}.`}</p>
          <p className="quiz-explain selectable">{panel.explain}</p>
          <div className="quiz-actions">
            <button type="button" className="link" onClick={() => setChosen(null)}>Try again</button>
            <button type="button" className="btn stage-small-btn"
              onClick={() => onPick(quizWhyWhat(panel.question, panel.choices, panel.answer))}>
              <Icon name="ask" size={15} /> Why?
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
