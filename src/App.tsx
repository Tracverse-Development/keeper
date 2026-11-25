/**
 * The window's root: first run shows the installer, every run after shows the dashboard.
 * The decision comes from the core's saved settings (never from browser storage).
 */
import { useEffect, useState } from 'react';

import { Dashboard } from './dashboard/Dashboard';
import { InstallerScreen } from './installer/InstallerScreen';
import { core, sentence, type Settings } from './kernel/ipc';

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => core.settings().then(setSettings).catch((e) => setError(sentence(e)));
  useEffect(() => {
    load();
  }, []);

  if (error) return <div className="boot-error">{error}</div>;
  if (!settings) return null;
  return (
    <>
      <div className="drag-strip" />
      {settings.setupComplete ? <Dashboard initial={settings} /> : <InstallerScreen onDone={load} />}
    </>
  );
}
