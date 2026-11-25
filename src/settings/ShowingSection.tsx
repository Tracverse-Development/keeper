/**
 * How the keeper shows things: visually on the Stage (panels, the default) or in words. Either
 * way the person's own words win for one message ("just text", "show me visually").
 */
import type { SettingsChange } from '../kernel/ipc';

export function ShowingSection({ visual, save }: { visual: boolean; save: (c: SettingsChange) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={visual} onChange={(e) => save({ visual: e.target.checked })} />
      <span>
        <strong>Show answers visually</strong>
        <span className="muted small">Lessons, comparisons and reports appear as panels on the stage. Say "just text" for words only, or "show me visually" when this is off.</span>
      </span>
    </label>
  );
}
