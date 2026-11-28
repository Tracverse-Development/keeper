/**
 * Reminders and calendar: how long before each calendar event the keeper gives a heads-up (a
 * notification and a line in the window, like a reminder), or off. The core keeps only the
 * offered leads (`sdk/packs/calendar/heads_up.rs` LEADS); an older settings file means 10.
 */
import type { Settings, SettingsChange } from '../kernel/ipc';

/** The leads offered, in minutes (0 = off). */
const LEADS = [0, 5, 10, 15, 30] as const;

export function RemindersSection({ settings, save }: { settings: Settings; save: (c: SettingsChange) => void }) {
  return (
    <>
      <div className="model-row">
        <label className="muted small" htmlFor="heads-up">
          Heads-up before events
        </label>
        <select id="heads-up" className="field field-small" value={settings.headsUpMinutes ?? 10} onChange={(e) => save({ headsUpMinutes: Number(e.target.value) })}>
          {LEADS.map((m) => (
            <option key={m} value={m}>
              {m === 0 ? 'Off' : `${m} minutes before`}
            </option>
          ))}
        </select>
      </div>
      <p className="muted small">Before each event on your calendar today (not all-day ones), your keeper tells you it's coming up. Your calendar is read on this Mac only and never sent anywhere. Focus sessions keep it quiet.</p>
    </>
  );
}
