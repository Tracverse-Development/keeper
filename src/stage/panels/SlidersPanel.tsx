/**
 * A what-if panel: one slider per variable and the panel's `expression` worked out LIVE as they
 * move, by the safe evaluator in `../expression.ts` (never eval). The result is set large and
 * counts smoothly to each new value (instantly under reduced motion); an expression the
 * evaluator refuses shows "can't calculate this". "Ask why" asks the keeper about the result at
 * the current values.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { evaluate } from '../expression.ts';
import { slidersWhat } from '../focus.ts';
import { Icon } from '../icons.tsx';
import { formatResult, formatValue } from '../shape.ts';
import { stagger } from '../stagger.ts';
import type { PanelProps } from './panel-props.ts';

/** How long the big number takes to count to a new value. */
const COUNT_MS = 420;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** The shown number eases toward `target` (requestAnimationFrame; jumps under reduced motion). */
function useCountTo(target: number | null): number | null {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (target === null || from.current === null || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      const value = origin + (target - origin) * (1 - (1 - t) ** 3);
      from.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}

export function SlidersPanel({ panel, onPick }: PanelProps<'sliders'>) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(panel.variables.map((v) => [v.name, clamp(v.value, v.min, v.max)])));
  const result = useMemo(() => evaluate(panel.expression, values), [panel.expression, values]);
  const shown = useCountTo(result.ok ? result.value : null);
  const unit = panel.unit ?? '';
  const ask = () => {
    if (!result.ok) return;
    const at = panel.variables.map((v) => ({ label: v.label, value: values[v.name] ?? v.value }));
    onPick(slidersWhat(panel.resultLabel, `${formatResult(result.value)}${unit}`, panel.expression, at));
  };

  return (
    <div className="whatif">
      <div className={result.ok ? 'whatif-result' : 'whatif-result is-refused'} aria-live="polite">
        <span className="whatif-label">{panel.resultLabel}</span>
        {result.ok
          ? <span className="whatif-number">{formatResult(shown ?? result.value)}<span className="whatif-unit">{unit}</span></span>
          : <span className="whatif-number is-error">can't calculate this</span>}
        <span className="whatif-expr">{panel.expression}</span>
      </div>
      <div className="whatif-sliders">
        {panel.variables.map((v, i) => {
          const value = values[v.name] ?? v.value;
          const fill = v.max > v.min ? ((value - v.min) / (v.max - v.min)) * 100 : 0;
          return (
            <label key={v.name} className="slider" style={{ ...stagger(i), '--fill': `${fill}%` } as CSSProperties}>
              <span className="slider-head">
                <span className="slider-label">{v.label}</span>
                <span className="slider-value">{formatValue(value)}</span>
              </span>
              <input type="range" min={v.min} max={v.max} step={v.step > 0 ? v.step : 'any'} value={value}
                onChange={(e) => setValues((prev) => ({ ...prev, [v.name]: Number(e.target.value) }))} />
              <span className="slider-range"><span>{formatValue(v.min)}</span><span>{formatValue(v.max)}</span></span>
            </label>
          );
        })}
      </div>
      <div className="whatif-foot">
        <button type="button" className="btn stage-small-btn" disabled={!result.ok} onClick={ask}>
          <Icon name="ask" size={15} /> Ask why
        </button>
      </div>
    </div>
  );
}
