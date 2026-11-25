/**
 * A formula panel: the expression large and centred; each part chip (symbol + meaning) lights
 * its symbol inside the expression on hover, and clicking a chip (or the symbol) asks about it.
 */
import { useState } from 'react';

import { formulaPartWhat } from '../focus.ts';
import { splitExpression } from '../shape.ts';
import { stagger } from '../stagger.ts';
import type { PanelProps } from './panel-props.ts';

export function FormulaPanel({ panel, onPick }: PanelProps<'formula'>) {
  const [lit, setLit] = useState<number | null>(null);
  const pieces = splitExpression(panel.expression, panel.parts.map((p) => p.symbol));
  const pick = (part: number) => {
    const p = panel.parts[part];
    if (p) onPick(formulaPartWhat(p.symbol, panel.expression, p.meaning));
  };

  return (
    <div className="formula" onMouseLeave={() => setLit(null)}>
      <div className="formula-expr" aria-label={panel.expression}>
        {pieces.map((piece, i) =>
          piece.part === undefined ? (
            <span key={i} className="formula-plain">{piece.text}</span>
          ) : (
            <button key={i} type="button" className={lit === piece.part ? 'formula-sym is-lit' : 'formula-sym'}
              onMouseEnter={() => setLit(piece.part ?? null)} onClick={() => pick(piece.part ?? -1)}>
              {piece.text}
            </button>
          ),
        )}
      </div>
      <div className="formula-parts">
        {panel.parts.map((p, i) => (
          <button key={i} type="button" className={lit === i ? 'part-chip is-lit' : 'part-chip'}
            style={stagger(i)}
            onMouseEnter={() => setLit(i)} onFocus={() => setLit(i)} onBlur={() => setLit(null)} onClick={() => pick(i)}>
            <span className="part-sym">{p.symbol}</span>
            <span className="part-meaning">{p.meaning}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
