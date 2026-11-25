/**
 * How the keeper shows things: visually on the Stage (panels, the default) or in words, and how
 * fast: next scenes prepared in the background, and quick follow-ups on a lighter helper model.
 * The person's own words win for one message ("just text", "show me visually").
 */
import type { Settings, SettingsChange } from '../kernel/ipc';

/** Claude Code's model aliases offered for the helper ("" turns it off). */
const HELPERS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'haiku', label: 'Haiku (fastest)' },
  { id: 'sonnet', label: 'Sonnet' },
  { id: '', label: 'Off (always the main brain)' },
];

export function ShowingSection({ settings, save }: { settings: Settings; save: (c: SettingsChange) => void }) {
  return (
    <>
      <label className="toggle">
        <input type="checkbox" checked={settings.visual} onChange={(e) => save({ visual: e.target.checked })} />
        <span>
          <strong>Show answers visually</strong>
          <span className="muted small">Lessons, comparisons and reports appear as panels on the stage. Say "just text" for words only, or "show me visually" when this is off.</span>
        </span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={settings.prefetchScenes} onChange={(e) => save({ prefetchScenes: e.target.checked })} />
        <span>
          <strong>Prepare the next scenes</strong>
          <span className="muted small">While you read a lesson, the keeper quietly prepares each card's scene, so clicking one opens instantly. Uses a little of your Claude Code allowance.</span>
        </span>
      </label>
      <div className="model-row">
        <label className="muted small" htmlFor="helper-model">Quick helper</label>
        <select id="helper-model" className="field" value={settings.fastModel} onChange={(e) => save({ fastModel: e.target.value })}>
          {HELPERS.map((h) => (
            <option key={h.id || 'off'} value={h.id}>
              {h.label}
            </option>
          ))}
        </select>
      </div>
      <p className="muted small">Answers follow-ups on a panel and prepares scenes when a keeper's brain is Claude Code.</p>
    </>
  );
}
