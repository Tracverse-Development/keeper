/**
 * Settings, in five tabs with a search that finds a section wherever it lives (`settings-map`):
 * Health (is everything working), This keeper (name, soul, role, body, brain), How it works
 * (showing, spending, voice, the keeper button, the phone), Your data (share, backup, child
 * profile) and This Mac (updates, removing). Each section saves on change; a keeper answers a
 * brain change in its own voice (the dashboard speaks it).
 */
import { useEffect, useState } from 'react';

import { core, sentence, type Imported, type KeeperChange, type KeeperProfile, type KitCatalog, type Settings, type SettingsChange } from '../kernel/ipc';
import { ShareSection } from '../keepers/ShareSection';
import { BackupSection } from './BackupSection';
import { ChildSection } from './ChildSection';
import { HealthSection } from './HealthSection';
import { ReadingSection } from './ReadingSection';
import { RemindersSection } from './RemindersSection';
import { RemoveAppSection } from './RemoveAppSection';
import { ShowingSection } from './ShowingSection';
import { SpendingSection } from './SpendingSection';
import { EnginePicker } from './EnginePicker';
import { KeeperNameField } from './KeeperNameField';
import { LookSection } from './LookSection';
import { PhoneSection } from './PhoneSection';
import { ShortcutSection } from './ShortcutSection';
import { UpdatesSection } from './UpdatesSection';
import { VoiceSection } from './VoiceSection';
import { useEscape } from '../kernel/use-escape';
import { GROUPS, shown, type GroupId } from './settings-map';

interface Props {
  open: boolean;
  settings: Settings;
  keeper: KeeperProfile;
  kit: KitCatalog | null;
  /** A soul was saved or a pack imported: reload the kit and the keepers. */
  onKitChanged: (imported?: Imported) => void;
  /** Open the Studio (the wardrobe, look, habits, voice, level and marketplace live there). */
  onOpenStudio: () => void;
  onClose: () => void;
  onSaved: (settings: Settings) => void;
  onKeeperChange: (change: KeeperChange) => void;
  /** Present when there is more than one keeper. */
  onRemoveKeeper?: () => void;
  /** Open with this search already typed ("backup"), so the sheet lands on that section. */
  find?: string;
}

export function SettingsSheet({ open, settings, keeper, kit, onKitChanged, onOpenStudio, onClose, onSaved, onKeeperChange, onRemoveKeeper, find = '' }: Props) {
  useEscape(open, onClose);
  const [error, setError] = useState<string | null>(null);
  // The tab on show, and a search that finds a section in any tab.
  const [group, setGroup] = useState<GroupId>('health');
  const [query, setQuery] = useState('');
  // Each time it opens: the Health tab, or the section that was asked for.
  useEffect(() => {
    if (!open) return;
    setGroup('health');
    setQuery(find);
  }, [open, find]);
  const see = shown(group, query);
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
        <input className="field field-small" type="search" placeholder="Search settings" aria-label="Search settings" value={query} onChange={(e) => setQuery(e.target.value)} />
        {query.trim() === '' && (
          <div className="tabs" role="tablist" aria-label="Settings">
            {GROUPS.map((g) => (
              <button key={g.id} type="button" role="tab" aria-selected={group === g.id} className={group === g.id ? 'is-on' : ''} onClick={() => setGroup(g.id)}>
                {g.title}
              </button>
            ))}
          </div>
        )}
        {error && <p className="error-line">{error}</p>}
        {see.size === 0 && <p className="muted">No setting matches that. Try another word, or clear the search.</p>}

        {see.has('health') && <p className="eyebrow">Is everything working?</p>}
        {see.has('health') && open && <HealthSection onFind={setQuery} />}

        {see.has('name') && <p className="eyebrow">This keeper</p>}
        {see.has('name') && <KeeperNameField key={keeper.id} name={keeper.name} onSave={(name) => onKeeperChange({ name })} />}
        {see.has('name') && (
          <p className="muted small">
            Memory graph <span className="mono selectable">{keeper.graphId}</span>: what it has experienced.
          </p>
        )}

        {see.has('soul') && <p className="eyebrow">Soul: who {keeper.name} is</p>}
        {see.has('soul') && <button type="button" className="btn btn-ghost" onClick={onOpenStudio}>Soul and modes are in the Studio</button>}

        {see.has('role') && <p className="eyebrow">Role: what {keeper.name} can do</p>}
        {see.has('role') && kit && (
          <div className="looks" role="radiogroup" aria-label="Role">
            {kit.roles.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={keeper.role === r.id} className={`mind look ${keeper.role === r.id ? 'is-on' : ''}`} onClick={() => onKeeperChange({ role: r.id })}>
                <strong>{r.title}</strong>
                <span className="mind-body">{r.blurb}</span>
              </button>
            ))}
          </div>
        )}

        {see.has('body') && <p className="eyebrow">Body</p>}
        {see.has('body') && <LookSection value={keeper.skin} onPick={(skin) => onKeeperChange({ skin })} />}

        {see.has('studio') && <p className="eyebrow">Look, inventory and mods</p>}
        {see.has('studio') && (
          <button type="button" className="btn" onClick={onOpenStudio}>
            Open {keeper.name}'s Studio
          </button>
        )}

        {see.has('brain') && <p className="eyebrow">{keeper.name}'s brain</p>}
        {see.has('brain') && open && <EnginePicker value={keeper.brain} model={keeper.model} onPick={(brain, model) => onKeeperChange(brain === keeper.brain ? { model } : { brain, model })} />}
        {see.has('brain') && (
          <label className="toggle">
            <input type="checkbox" checked={settings.agentActions} onChange={(e) => save({ agentActions: e.target.checked })} />
            <span>
              <strong>Let my keepers act on this computer</strong>
              <span className="muted small">
                Agent engines (Claude Code, Codex, Gemini, Hermes) may then run commands, open and edit files, and work in your apps when you ask. They won't do anything destructive unless you ask for exactly that, and every action is recorded in the keeper's DKG memory. Off: they only talk.
              </span>
            </span>
          </label>
        )}
        {see.has('brain') && settings.agentActions && (
          <label className="toggle">
            <input type="checkbox" checked={settings.askBeforeActing} onChange={(e) => save({ askBeforeActing: e.target.checked })} />
            <span>
              <strong>Show me the plan first</strong>
              <span className="muted small">Before touching anything, the keeper shows the exact steps it would take and waits for you to press Approve.</span>
            </span>
          </label>
        )}

        {see.has('reading') && <p className="eyebrow">Reading</p>}
        {see.has('reading') && <ReadingSection />}

        {see.has('showing') && <p className="eyebrow">Showing things</p>}
        {see.has('showing') && <ShowingSection settings={settings} save={save} />}

        {see.has('reminders') && <p className="eyebrow">Reminders and calendar</p>}
        {see.has('reminders') && <RemindersSection settings={settings} save={save} />}

        {see.has('spending') && <p className="eyebrow">Spending</p>}
        {see.has('spending') && open && <SpendingSection settings={settings} save={save} />}

        {see.has('voice') && <p className="eyebrow">Voice</p>}
        {see.has('voice') && open && <VoiceSection settings={settings} name={keeper.name} save={save} />}

        {see.has('button') && <p className="eyebrow">Keeper button</p>}
        {see.has('button') && open && <ShortcutSection value={settings.talkShortcut} save={save} />}

        {see.has('phone') && <p className="eyebrow">Your phone</p>}
        {see.has('phone') && open && <PhoneSection name={keeper.name} />}

        {see.has('share') && <p className="eyebrow">Share</p>}
        {see.has('share') && kit && <ShareSection keeper={keeper} soulName={kit.souls.find((s) => s.id === keeper.soul)?.name ?? keeper.soul} onImported={onKitChanged} />}

        {see.has('backup') && <p className="eyebrow">Backup</p>}
        {see.has('backup') && <BackupSection onRestored={() => onKitChanged()} />}

        {see.has('child') && <p className="eyebrow">Child profile</p>}
        {see.has('child') && open && <ChildSection onChanged={() => core.settings().then(onSaved).catch(() => undefined)} />}

        {see.has('updates') && <p className="eyebrow">Updates</p>}
        {see.has('updates') && open && <UpdatesSection autoUpdate={settings.autoUpdate} onToggle={(autoUpdate) => save({ autoUpdate })} />}

        {see.has('remove') && <p className="eyebrow">Remove</p>}
        {see.has('remove') && onRemoveKeeper && (
          <button type="button" className="btn btn-ghost remove-keeper" onClick={onRemoveKeeper}>
            Remove {keeper.name} from this computer
          </button>
        )}
        {see.has('remove') && (
          <p className="muted small">
            Node folder <span className="mono selectable">{settings.nodeHome}</span>. Removing a keeper keeps its graph on the node.
          </p>
        )}
        {see.has('remove') && <RemoveAppSection />}
      </section>
    </div>
  );
}
