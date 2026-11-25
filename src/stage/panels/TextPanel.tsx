/** A text panel: paragraphs (split on blank lines) and gold-marked bullets. */
import { paragraphs } from '../shape.ts';
import { stagger } from '../stagger.ts';
import type { PanelProps } from './panel-props.ts';

export function TextPanel({ panel }: PanelProps<'text'>) {
  return (
    <div className="text-panel selectable">
      {paragraphs(panel.body).map((p, i) => (
        <p key={i} className="text-para" style={stagger(i)}>{p}</p>
      ))}
      {panel.bullets && panel.bullets.length > 0 && (
        <ul className="text-bullets">
          {panel.bullets.map((b, i) => <li key={i} style={stagger(i)}>{b}</li>)}
        </ul>
      )}
    </div>
  );
}
