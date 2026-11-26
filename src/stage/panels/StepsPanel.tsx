/**
 * A steps panel: every step shows at once (a quick staggered fade, never a wait: founder
 * 2026-11-25, the old one-step-every-2.6-s reveal looked like slow answers). "Walk me through
 * it" plays them one at a time on request, with "Next step" or on their own. Math lines are set
 * large in the serif; clicking a step asks about it.
 */
import { useEffect, useState } from 'react';

import { stepWhat } from '../focus.ts';
import { Icon } from '../icons.tsx';
import { stagger } from '../stagger.ts';
import type { PanelProps } from './panel-props.ts';

/** In a walk-through, how long each step stays alone before the next joins it. */
const WALK_STEP_MS = 2600;

export function StepsPanel({ panel, onPick }: PanelProps<'steps'>) {
  const total = panel.steps.length;
  const [shown, setShown] = useState(total);
  const [walking, setWalking] = useState(false);

  useEffect(() => {
    if (!walking) return;
    if (shown >= total) {
      setWalking(false);
      return;
    }
    const timer = window.setTimeout(() => setShown((n) => Math.min(n + 1, total)), WALK_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [walking, shown, total]);

  return (
    <div className="steps">
      <ol className="steps-list">
        {panel.steps.slice(0, shown).map((step, i) => (
          <li key={i} className={walking && i === shown - 1 ? 'step is-latest' : 'step'} style={walking ? undefined : stagger(i)}>
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
            <button type="button" className="link" onClick={() => { setWalking(false); setShown(total); }}>Show all</button>
            <button type="button" className="btn btn-primary stage-small-btn" onClick={() => setShown((n) => n + 1)}>
              Next step <Icon name="next" size={15} />
            </button>
          </span>
        ) : (
          total > 1 && (
            <button type="button" className="link" onClick={() => { setShown(1); setWalking(true); }}>
              Walk me through it
            </button>
          )
        )}
      </div>
    </div>
  );
}
