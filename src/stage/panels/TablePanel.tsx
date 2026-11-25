/**
 * A table panel: hovering a cell lights its row and column (a crosshair), highlighted cells glow
 * gold, and clicking a cell asks about it ("row 7, column 8: 56"). The first column and the
 * header row read as headers.
 */
import { useState } from 'react';

import { tableCellWhat } from '../focus.ts';
import { stagger } from '../stagger.ts';
import type { PanelProps } from './panel-props.ts';

export function TablePanel({ panel, onPick }: PanelProps<'table'>) {
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const glowing = new Set((panel.highlight ?? []).map((h) => `${h.row}:${h.col}`));

  const cellClass = (row: number, col: number) => {
    const names = ['table-cell'];
    if (col === 0) names.push('is-rowhead');
    if (hover && (hover.row === row || hover.col === col)) names.push('is-cross');
    if (hover && hover.row === row && hover.col === col) names.push('is-hover');
    if (glowing.has(`${row}:${col}`)) names.push('is-glow');
    return names.join(' ');
  };

  return (
    <div className="table-wrap" onMouseLeave={() => setHover(null)}>
      <table className="stage-table">
        {panel.caption && <caption>{panel.caption}</caption>}
        <thead>
          <tr>
            {panel.columns.map((c, col) => (
              <th key={col} scope="col" className={hover?.col === col ? 'is-cross' : undefined}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {panel.rows.map((cells, row) => (
            <tr key={row} style={stagger(row)}>
              {cells.map((value, col) => (
                <td key={col} className={cellClass(row, col)}>
                  <button type="button" className="cell-button"
                    onMouseEnter={() => setHover({ row, col })} onFocus={() => setHover({ row, col })}
                    onClick={() => onPick(tableCellWhat(panel.columns, panel.rows, row, col))}>
                    {value}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
