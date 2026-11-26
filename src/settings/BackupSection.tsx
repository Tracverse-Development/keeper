/**
 * Backup: save every keeper, its memory and the kit as one file sealed with a passphrase, or
 * bring such a file in (to move to another Mac). Bringing one in adds and merges; it never
 * removes or overwrites what is here. Keys, sign-ins and personal pictures are not in the file.
 */
import { useRef, useState } from 'react';

import { core, sentence } from '../kernel/ipc';
import { passphraseProblem, restoredWords, savedWords, toBase64 } from './backup-view';

type Doing = 'save' | 'restore' | null;

export function BackupSection({ onRestored }: { onRestored: () => void }) {
  const [doing, setDoing] = useState<Doing>(null);
  const [passphrase, setPassphrase] = useState('');
  const [again, setAgain] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const start = (what: Doing) => {
    setDoing(what);
    setPassphrase('');
    setAgain('');
    setFile(null);
    setDone(null);
    setError(null);
  };
  const problem = doing === 'save' ? passphraseProblem(passphrase, again) : passphraseProblem(passphrase);
  const ready = !busy && !problem && (doing === 'save' || file !== null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      if (doing === 'save') {
        setDone(savedWords(await core.backupSave(passphrase)));
      } else if (file) {
        setDone(restoredWords(await core.backupRestore(passphrase, toBase64(new Uint8Array(await file.arrayBuffer())))));
        onRestored();
      }
      setDoing(null);
    } catch (e) {
      setError(sentence(e));
    } finally {
      setBusy(false);
      setPassphrase('');
      setAgain('');
    }
  };

  if (!doing) {
    return (
      <div className="backup">
        <p className="muted small">One file holds your keepers, everything they remember and your kit, locked with a passphrase only you know. Use it to move to another Mac or to keep a copy.</p>
        <div className="row">
          <button type="button" className="btn" onClick={() => start('save')}>
            Save a backup…
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => start('restore')}>
            Bring in a backup…
          </button>
        </div>
        {done && <p className="backup-done">{done}</p>}
      </div>
    );
  }
  return (
    <div className="backup glass">
      <p>
        <strong>{doing === 'save' ? 'Save a backup' : 'Bring in a backup'}</strong>
      </p>
      <p className="muted small">
        {doing === 'save'
          ? 'Choose a passphrase and keep it somewhere safe. It is never stored: a backup cannot be opened without it. Keys, sign-ins and personal pictures are not included.'
          : 'Keepers in the file are added here with their memory. Nothing already on this Mac is removed or changed.'}
      </p>
      {doing === 'restore' && (
        <div className="row">
          <input ref={picker} type="file" accept=".keeperbackup" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button type="button" className="btn btn-small" onClick={() => picker.current?.click()}>
            Choose the file…
          </button>
          <span className="muted small selectable">{file ? file.name : 'No file chosen'}</span>
        </div>
      )}
      <input className="field" type="password" autoComplete="off" placeholder="Passphrase" aria-label="Passphrase" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
      {doing === 'save' && <input className="field" type="password" autoComplete="off" placeholder="The same passphrase again" aria-label="The same passphrase again" value={again} onChange={(e) => setAgain(e.target.value)} />}
      {passphrase && problem && <p className="muted small">{problem}</p>}
      <div className="row">
        <button type="button" className="btn" disabled={busy} onClick={() => setDoing(null)}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" disabled={!ready} onClick={() => void run()}>
          {busy ? <span className="spinner" /> : doing === 'save' ? 'Save the backup' : 'Bring it in'}
        </button>
      </div>
      {error && <p className="error-line">{error}</p>}
    </div>
  );
}
