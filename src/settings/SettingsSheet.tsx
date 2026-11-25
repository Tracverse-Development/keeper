/**
 * Settings: the engine (and whether it may act on this computer), the character's look, the
 * voice, the phone link and updates. Each section saves on change; the assistant answers an
 * engine change in its own voice (the parent speaks `announcement`).
 */
import { useState } from 'react';

import { core, sentence, type Saved, type Settings, type SettingsChange } from '../kernel/ipc';
import { EnginePicker } from './EnginePicker';
import { LookSection } from './LookSection';
import { PhoneSection } from './PhoneSection';
import { UpdatesSection } from './UpdatesSection';
import { VoiceSection } from './VoiceSection';

interface Props {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onSaved: (saved: Saved) => void;
}

export function SettingsSheet({ open, settings, onClose, onSaved }: Props) {
  const [error, setError] = useState<string | null>(null);
  const save = (change: SettingsChange) =>
    core
      .saveSettings(change)
      .then((saved) => {
        setError(null);
        onSaved(saved);
      })
      .catch((e) => setError(sentence(e)));

  return (
    <div className={`sheet-backdrop ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden={!open}>
      <section className="sheet glass" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <div className="drawer-head">
          <h3>Settings</h3>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </div>
        {error && <p className="error-line">{error}</p>}

        <p className="eyebrow">Brain</p>
        {open && <EnginePicker value={settings.brain} model={settings.ollamaModel} onPick={(brain, ollamaModel) => save({ brain, ollamaModel })} />}
        <label className="toggle">
          <input type="checkbox" checked={settings.agentActions} onChange={(e) => save({ agentActions: e.target.checked })} />
          <span>
            <strong>Let my assistant act on this computer</strong>
            <span className="muted small">
              Agent engines (Claude Code, Codex, Gemini, Hermes) may then run commands, open and edit files, and work in your apps when you ask. It won't do anything destructive unless you ask for exactly that, and every action is recorded in your DKG memory. Off: it only talks.
            </span>
          </span>
        </label>

        <p className="eyebrow">Look</p>
        <LookSection value={settings.skin} onPick={(skin) => save({ skin })} />

        <p className="eyebrow">Voice</p>
        {open && <VoiceSection settings={settings} save={save} />}

        <p className="eyebrow">Your phone</p>
        {open && <PhoneSection name={settings.assistantName} />}

        <p className="eyebrow">Updates</p>
        {open && <UpdatesSection autoUpdate={settings.autoUpdate} onToggle={(autoUpdate) => save({ autoUpdate })} />}

        <p className="muted small">
          Memory graph <span className="mono selectable">{settings.graphId}</span> on the node in <span className="mono selectable">{settings.nodeHome}</span>.
        </p>
      </section>
    </div>
  );
}
