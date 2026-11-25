/**
 * Step 5: permissions, all asked up front so nothing interrupts the keeper mid-task later.
 * A checklist: the microphone and on-device speech recognition (the voice helper's own
 * prompt), the Desktop / Documents / Downloads folders the System Administration keeper works
 * in (`core.folders()` reads each one, which makes macOS ask), calendar and contacts (`PimRow`,
 * for the morning brief), and the keeper button (the
 * push-to-talk shortcut). Then the voice: pick one and hear it. Skippable: typing always works.
 */
import { useEffect, useState } from 'react';

import { core, EVENTS, on, sentence, type FolderAccess, type ShortcutStatus, type VoiceEvent } from '../../kernel/ipc';
import { shortcutSymbols } from '../../talk/shortcut';
import type { InstallerChoices } from '../InstallerScreen';
import { PanelActions } from '../InstallerScreen';
import { foldersPermission, voicePermission } from '../steps';
import { PermissionRow } from './PermissionRow';
import { PimRow } from './PimRow';

interface Props {
  choices: InstallerChoices;
  update: (p: Partial<InstallerChoices>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PermissionsPanel({ choices, update, onNext, onBack }: Props) {
  const [auth, setAuth] = useState<{ speech: string; mic: boolean; onDevice: boolean } | null>(null);
  const [voices, setVoices] = useState<string[]>([]);
  const [folders, setFolders] = useState<FolderAccess[] | null>(null);
  const [shortcut, setShortcut] = useState<ShortcutStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<'mic' | 'folders' | null>(null);
  const helper = choices.scan?.voiceHelper ?? false;
  const name = choices.assistantName.trim() || 'Keeper';

  useEffect(
    () =>
      on<VoiceEvent>(EVENTS.voiceEvent, (e) => {
        if (e.type === 'authorized') {
          setAuth(e);
          setAsking(null);
        }
        if (e.type === 'voices') setVoices([...new Set(e.voices.filter((v) => v.language === 'en-US' || v.language === 'en-GB').map((v) => v.name))]);
        if (e.type === 'error') setError(e.message);
      }),
    [],
  );
  useEffect(() => {
    if (helper) core.listVoices().catch((e) => setError(sentence(e)));
  }, [helper]);
  useEffect(() => {
    core.shortcutStatus().then(setShortcut).catch((e) => setError(sentence(e)));
  }, []);

  const allowVoice = () => {
    setAsking('mic');
    setError(null);
    core.voiceAuthorize().catch((e) => {
      setError(sentence(e));
      setAsking(null);
    });
  };
  const allowFolders = async () => {
    setAsking('folders');
    setError(null);
    try {
      setFolders(await core.folders());
    } catch (e) {
      setError(sentence(e));
    } finally {
      setAsking(null);
    }
  };

  const voice = voicePermission(auth);
  const folderStatus = foldersPermission(folders);
  const keys = shortcut ? shortcutSymbols(shortcut.shortcut) : '';
  const allDone = (voice === 'allowed' || !helper) && folderStatus === 'allowed';

  return (
    <>
      <p className="eyebrow">Permissions</p>
      <h2>Let {name} hear you and help with your files.</h2>
      <p className="lead">macOS asks once for each of these. Allow them now and {name} won't stop to ask in the middle of a task.</p>
      <ul className="permissions">
        <PermissionRow icon="mic" title="Microphone and speech recognition" status={helper ? voice : 'denied'} busy={asking === 'mic'}
          why="So you can talk out loud. Speech is recognised on this Mac by Apple's on-device recogniser and is never sent anywhere."
          action={helper && voice !== 'allowed' && (
            <button type="button" className="btn permission-btn" onClick={allowVoice} disabled={asking !== null}>Allow microphone</button>
          )}>
          {!helper && <p className="permission-note">This build has no voice helper. You can still type.</p>}
          {helper && voice === 'allowed' && auth?.onDevice && <p className="permission-note ok-text">Recognised on this device.</p>}
          {helper && voice === 'denied' && (
            <p className="permission-note warn-text">Open System Settings, Privacy & Security, and allow Keeper for Microphone and for Speech Recognition.</p>
          )}
        </PermissionRow>

        <PermissionRow icon="folder" title="Your folders" status={folderStatus} busy={asking === 'folders'}
          why="Desktop, Documents and Downloads, for the System Administration keeper's file work: finding, tidying and reading files when you ask."
          action={folderStatus !== 'allowed' && (
            <button type="button" className="btn permission-btn" onClick={allowFolders} disabled={asking !== null}>{folders ? 'Ask again' : 'Allow folders'}</button>
          )}>
          {folders && (
            <ul className="folder-list">
              {folders.map((f) => (
                <li key={f.folder} className={f.granted ? 'ok-text' : 'warn-text'}>
                  <span className={`dot ${f.granted ? 'ok' : 'warn'}`} /> {f.folder}
                </li>
              ))}
            </ul>
          )}
          {folderStatus === 'denied' && (
            <p className="permission-note warn-text">To allow a folder later: System Settings, Privacy & Security, Files and Folders, then turn it on under Keeper.</p>
          )}
        </PermissionRow>

        <PimRow name={name} onError={setError} />

        <PermissionRow icon="key" title="The keeper button" status={!shortcut ? 'waiting' : shortcut.registered ? 'allowed' : 'denied'}
          why="Hold it anywhere on your Mac to talk to your keeper, and let go when you're done.">
          {shortcut && shortcut.registered && keys && (
            <p className="permission-note">Hold <kbd className="keycap">{keys}</kbd> to talk to your keeper.</p>
          )}
          {shortcut && !shortcut.registered && (
            <p className="permission-note warn-text">
              {keys ? <>The <kbd className="keycap">{keys}</kbd> shortcut isn't working, another app may be using it.</> : 'The keeper button is turned off.'} You can choose another in Settings later.
            </p>
          )}
        </PermissionRow>
      </ul>

      {helper && (
        <>
          <label className="label" htmlFor="voice">Voice</label>
          <div className="voice-row">
            <select id="voice" className="field" value={choices.voice} onChange={(e) => update({ voice: e.target.value })}>
              {(voices.length ? voices : [choices.voice]).map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <button type="button" className="btn" onClick={() => core.speak(`Hello. I'm ${name}, and I'll remember what matters to you.`).catch((e) => setError(sentence(e)))}>
              Hear it
            </button>
          </div>
          <p className="hint">More natural voices: System Settings, Accessibility, Spoken Content, System voice, Manage Voices (the Premium ones). ElevenLabs voices can be added later in Settings, Voice.</p>
        </>
      )}
      {error && <p className="error-line">{error}</p>}
      <PanelActions onBack={onBack} onNext={onNext} nextLabel={allDone ? 'Continue' : 'Continue for now'} />
    </>
  );
}
