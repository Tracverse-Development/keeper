/**
 * Settings: THIS keeper (its name, soul, role, body, wardrobe, brain and model) and everything shared (acting on the
 * computer, voice, the keeper button, the phone link, updates). Each section saves on change; a
 * keeper answers a brain change in its own voice (the dashboard speaks it).
 */
import { useState } from 'react';

import { core, sentence, type Imported, type KeeperChange, type KeeperProfile, type KitCatalog, type Settings, type SettingsChange } from '../kernel/ipc';
import { ShareSection } from '../keepers/ShareSection';
import { ShowingSection } from './ShowingSection';
import { SoulSection } from '../keepers/SoulSection';
import { WardrobeSection } from '../keepers/WardrobeSection';
import { EnginePicker } from './EnginePicker';
import { KeeperNameField } from './KeeperNameField';
import { LookSection } from './LookSection';
import { PhoneSection } from './PhoneSection';
import { ShortcutSection } from './ShortcutSection';
import { UpdatesSection } from './UpdatesSection';
import { VoiceSection } from './VoiceSection';

interface Props {
  open: boolean;
  settings: Settings;
  keeper: KeeperProfile;
  kit: KitCatalog | null;
  /** A soul was saved or a pack imported: reload the kit and the keepers. */
  onKitChanged: (imported?: Imported) => void;
  onClose: () => void;
  onSaved: (settings: Settings) => void;
  onKeeperChange: (change: KeeperChange) => void;
  /** Present when there is more than one keeper. */
  onRemoveKeeper?: () => void;
}

export function SettingsSheet({ open, settings, keeper, kit, onKitChanged, onClose, onSaved, onKeeperChange, onRemoveKeeper }: Props) {
  const [error, setError] = useState<string | null>(null);
  const save = (change: SettingsChange) =>
    core
      .saveSettings(change)
      .then((s) => {
        setError(null);
        onSaved(s);
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

        <p className="eyebrow">This keeper</p>
        <KeeperNameField key={keeper.id} name={keeper.name} onSave={(name) => onKeeperChange({ name })} />
        <p className="muted small">
          Memory graph <span className="mono selectable">{keeper.graphId}</span>: what it has experienced.
        </p>

        <p className="eyebrow">Soul: who {keeper.name} is</p>
        {kit && <SoulSection value={keeper.soul} souls={kit.souls} onPick={(soul) => onKeeperChange({ soul })} onSaved={(s) => { onKitChanged(); onKeeperChange({ soul: s.id }); }} />}

        <p className="eyebrow">Role: what {keeper.name} can do</p>
        {kit && (
          <div className="looks" role="radiogroup" aria-label="Role">
            {kit.roles.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={keeper.role === r.id} className={`mind look ${keeper.role === r.id ? 'is-on' : ''}`} onClick={() => onKeeperChange({ role: r.id })}>
                <strong>{r.title}</strong>
                <span className="mind-body">{r.blurb}</span>
              </button>
            ))}
          </div>
        )}

        <p className="eyebrow">Body</p>
        <LookSection value={keeper.skin} onPick={(skin) => onKeeperChange({ skin })} />

        <p className="eyebrow">Wardrobe: what {keeper.name} wears</p>
        <WardrobeSection open={open} keeper={keeper} onChanged={() => onKitChanged()} />

        <p className="eyebrow">{keeper.name}'s brain</p>
        {open && <EnginePicker value={keeper.brain} model={keeper.model} onPick={(brain, model) => onKeeperChange(brain === keeper.brain ? { model } : { brain, model })} />}
        <label className="toggle">
          <input type="checkbox" checked={settings.agentActions} onChange={(e) => save({ agentActions: e.target.checked })} />
          <span>
            <strong>Let my keepers act on this computer</strong>
            <span className="muted small">
              Agent engines (Claude Code, Codex, Gemini, Hermes) may then run commands, open and edit files, and work in your apps when you ask. They won't do anything destructive unless you ask for exactly that, and every action is recorded in the keeper's DKG memory. Off: they only talk.
            </span>
          </span>
        </label>
        {settings.agentActions && (
          <label className="toggle">
            <input type="checkbox" checked={settings.askBeforeActing} onChange={(e) => save({ askBeforeActing: e.target.checked })} />
            <span>
              <strong>Show me the plan first</strong>
              <span className="muted small">Before touching anything, the keeper shows the exact steps it would take and waits for you to press Approve.</span>
            </span>
          </label>
        )}

        <p className="eyebrow">Showing things</p>
        <ShowingSection settings={settings} save={save} />

        <p className="eyebrow">Voice</p>
        {open && <VoiceSection settings={settings} name={keeper.name} save={save} />}

        <p className="eyebrow">Keeper button</p>
        {open && <ShortcutSection value={settings.talkShortcut} save={save} />}

        <p className="eyebrow">Your phone</p>
        {open && <PhoneSection name={keeper.name} />}

        <p className="eyebrow">Share</p>
        {kit && <ShareSection keeper={keeper} soulName={kit.souls.find((s) => s.id === keeper.soul)?.name ?? keeper.soul} onImported={onKitChanged} />}

        <p className="eyebrow">Updates</p>
        {open && <UpdatesSection autoUpdate={settings.autoUpdate} onToggle={(autoUpdate) => save({ autoUpdate })} />}

        {onRemoveKeeper && (
          <button type="button" className="btn btn-ghost remove-keeper" onClick={onRemoveKeeper}>
            Remove {keeper.name} from this computer
          </button>
        )}
        <p className="muted small">Node folder <span className="mono selectable">{settings.nodeHome}</span>. Removing a keeper keeps its graph on the node.</p>
      </section>
    </div>
  );
}
