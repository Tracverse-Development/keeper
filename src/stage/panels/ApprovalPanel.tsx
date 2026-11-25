/**
 * An approval panel: the keeper's PLAN before it acts on the computer. The summary, then numbered
 * steps (the action verb, the target as path breadcrumbs when it is a path, the detail), with
 * destructive steps (delete, remove, overwrite, move to trash, send, pay) in the danger colour.
 * "Approve and do it" / "Don't" report `{ type: 'approve' | 'deny', token }` once; then the
 * buttons lock and the panel shows the choice.
 */
import { useState } from 'react';

import { detailKind } from '../activity.ts';
import { Breadcrumbs } from '../Breadcrumbs.tsx';
import { Icon } from '../icons.tsx';
import { isDestructive } from '../plan.ts';
import { stagger } from '../stagger.ts';
import type { ActingPanelProps } from './panel-props.ts';

export function ApprovalPanel({ panel, onAction }: ActingPanelProps<'approval'>) {
  const [choice, setChoice] = useState<'approve' | 'deny' | null>(null);
  const risky = panel.steps.filter((s) => isDestructive(s.action, s.detail)).length;
  const choose = (type: 'approve' | 'deny') => {
    if (choice) return;
    setChoice(type);
    onAction({ type, token: panel.token });
  };

  return (
    <div className={choice ? `approval is-${choice}` : 'approval'}>
      <p className="approval-summary selectable">{panel.summary}</p>
      {risky > 0 && (
        <p className="approval-warning"><Icon name="delete" size={14} /> {risky === 1 ? 'One step' : `${risky} steps`} cannot be undone. Read them before you approve.</p>
      )}
      <ol className="plan">
        {panel.steps.map((step, i) => {
          const danger = isDestructive(step.action, step.detail);
          return (
            <li key={i} className={danger ? 'plan-step is-danger' : 'plan-step'} style={stagger(i)}>
              <span className="plan-num">{i + 1}</span>
              <span className="plan-body">
                <span className="plan-line">
                  <span className="plan-verb">{step.action}</span>
                  {detailKind(step.target) === 'path' ? <Breadcrumbs path={step.target} /> : <span className="plan-target">{step.target}</span>}
                </span>
                {step.detail && <span className="plan-detail">{step.detail}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {choice ? (
        <p className={`approval-result is-${choice}`} role="status">
          <Icon name={choice === 'approve' ? 'shield' : 'cross'} size={17} />
          {choice === 'approve' ? 'Approved. The keeper is doing it now.' : 'Not done. Nothing on your computer was changed.'}
        </p>
      ) : (
        <div className="approval-actions">
          <button type="button" className="btn approval-deny" onClick={() => choose('deny')}>Don't</button>
          <button type="button" className={risky ? 'btn btn-primary approval-go is-risky' : 'btn btn-primary approval-go'} onClick={() => choose('approve')}>
            <Icon name="check" size={16} /> Approve and do it
          </button>
        </div>
      )}
    </div>
  );
}
