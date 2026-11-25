/**
 * A chart panel: bars grow in one after another, show their value on hover, and clicking a bar
 * asks about it. Heights come from `barScale` (the tallest bar fills the plot).
 */
import { barWhat } from '../focus.ts';
import { barScale, formatValue } from '../shape.ts';
import { stagger } from '../stagger.ts';
import type { PanelProps } from './panel-props.ts';

export function ChartPanel({ panel, onPick }: PanelProps<'chart'>) {
  const heights = barScale(panel.values);
  const unit = panel.unit ?? '';
  return (
    <div className="chart">
      <div className="chart-plot" role="list">
        <span className="chart-grid" aria-hidden="true"><i /><i /><i /><i /></span>
        {panel.labels.map((label, i) => {
          const value = panel.values[i] ?? 0;
          return (
            <button key={i} type="button" role="listitem" className="chart-col" style={stagger(i)}
              aria-label={`${label}: ${formatValue(value)}${unit}`} onClick={() => onPick(barWhat(label, value, unit))}>
              <span className="chart-bar" style={{ height: `${Math.max(heights[i] ?? 0, 0.015) * 100}%` }}>
                <span className="chart-value">{formatValue(value)}{unit}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="chart-labels" aria-hidden="true">
        {panel.labels.map((label, i) => <span key={i}>{label}</span>)}
      </div>
    </div>
  );
}
