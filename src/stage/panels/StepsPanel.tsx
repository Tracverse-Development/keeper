/**
 * A steps panel: steps reveal one at a time (on their own every few seconds, or with "Next
 * step"), math lines set large in the serif, and clicking a step asks about it.
 */
import { useEffect, useState } from 'react';

import { stepWhat } from '../focus.ts';
import { Icon } from '../icons.tsx';
import type { PanelProps } from './panel-props.ts';

/** How long each revealed step stays alone before the next one joins it. */
const AUTO_REVEAL_MS = 2600;

export function StepsPanel({ panel, onPick }: PanelProps<'steps'>) {
  const total = panel.steps.length;
  const [shown, setShown] = useState(Math.min(1, total));

  useEffect(() => {
    if (shown >= total) return;
    const timer = window.setTimeout(() => setShown((n) => Math.min(n + 1, total)), AUTO_REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [shown, total]);

  return (
    <div className="steps">
      <ol className="steps-list">
        {panel.steps.slice(0, shown).map((step, i) => (
          <li key={i} className={i === shown - 1 ? 'step is-latest' : 'step'}>
            <button type="button" className="step-button" onClick={() => onPick(stepWhat(i, step.label))}>
              <span className="step-num">{i + 1}</span>
              <span className="step-body">
                <span className="step-label">{step.label}</span>
                {step.math && <span className="step-math">{step.math}</span>}
                {step.detail && <span className="step-detail">{step.detail}</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div className="steps-foot">
        <span className="steps-progress" aria-label={`${shown} of ${total} steps`}>
          {panel.steps.map((_, i) => <span key={i} className={i < shown ? 'pip is-on' : 'pip'} />)}
        </span>
        {shown < total ? (
          <span className="steps-actions">
            <button type="button" className="link" onClick={() => setShown(total)}>Show all</button>
            <button type="button" className="btn btn-primary stage-small-btn" onClick={() => setShown((n) => n + 1)}>
              Next step <Icon name="next" size={15} />
            </button>
          </span>
        ) : (
          <button type="button" className="link" onClick={() => setShown(Math.min(1, total))}>Replay</button>
        )}
      </div>
    </div>
  );
}
