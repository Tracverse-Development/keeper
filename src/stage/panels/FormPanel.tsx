/**
 * A form panel: the keeper asks the person to fill something in. Fields are text, number, a
 * choice (a select) or a date; the button carries the panel's `submit` words. Sending reports the
 * values with `onAction` (type "submit"), then the form locks and says "Sent" (no second send).
 */
import { useState, type FormEvent } from 'react';

import { Icon } from '../icons.tsx';
import { stagger } from '../stagger.ts';
import type { ActingPanelProps } from './panel-props.ts';

export function FormPanel({ panel, onAction }: ActingPanelProps<'form'>) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(panel.fields.map((f) => [f.id, ''])));
  const [sent, setSent] = useState(false);
  const filled = Object.values(values).some((v) => v.trim() !== '');

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (sent || !filled) return;
    setSent(true);
    onAction({ type: 'submit', panelId: panel.id, panelTitle: panel.title, values });
  };
  const set = (id: string, value: string) => setValues((prev) => ({ ...prev, [id]: value }));

  return (
    <form className={sent ? 'stage-form is-sent' : 'stage-form'} onSubmit={send}>
      <fieldset disabled={sent}>
        {panel.fields.map((field, i) => {
          const id = `${panel.id}-${field.id}`;
          return (
            <div key={field.id} className="form-row" style={stagger(i)}>
              <label htmlFor={id}>{field.label}</label>
              {field.kind === 'choice' ? (
                <select id={id} className="field form-field" value={values[field.id] ?? ''} onChange={(e) => set(field.id, e.target.value)}>
                  <option value="">{field.placeholder ?? 'Choose one'}</option>
                  {(field.choices ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input id={id} className="field form-field" type={field.kind} inputMode={field.kind === 'number' ? 'decimal' : undefined}
                  placeholder={field.placeholder} value={values[field.id] ?? ''} onChange={(e) => set(field.id, e.target.value)} />
              )}
            </div>
          );
        })}
      </fieldset>
      <div className="form-foot">
        {sent ? (
          <span className="form-sent" role="status"><Icon name="check" size={16} /> Sent</span>
        ) : (
          <button type="submit" className="btn btn-primary stage-small-btn" disabled={!filled}>
            {panel.submit || 'Send'} <Icon name="next" size={15} />
          </button>
        )}
      </div>
    </form>
  );
}
