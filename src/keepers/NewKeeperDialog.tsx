/**
 * Add a keeper from the Kit: a name (its wake word), a body (species), a role (what it can do)
 * and a soul (who it is). The core creates its Context Graph, writes its profile and soul there,
 * and it becomes the active keeper. A keeper pack can be imported instead (`PackImport`).
 */
import { useState } from 'react';

import { SKINS } from '../character';
import { sentence, type RoleInfo, type Soul } from '../kernel/ipc';
import { PackImport } from './PackImport';

interface Props {
  roles: RoleInfo[];
  souls: Soul[];
  onClose: () => void;
  onCreate: (k: { name: string; skin: string; role: string; soul?: string }) => Promise<unknown>;
  onImported: () => void;
}

export function NewKeeperDialog({ roles, souls, onClose, onCreate, onImported }: Props) {
  const [name, setName] = useState('');
  const [skin, setSkin] = useState<string>(SKINS[1]?.id ?? SKINS[0].id);
  const [role, setRole] = useState(roles[1]?.id ?? roles[0]?.id ?? 'system');
  const [soul, setSoul] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^[\p{L}\p{N} -]{1,24}$/u.test(name.trim());

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), skin, role, soul: soul || undefined });
      onClose();
    } catch (e) {
      setError(sentence(e));
      setBusy(false);
    }
  };

  return (
    <div className="sheet-backdrop is-open" onClick={onClose}>
      <section className="sheet glass new-keeper" role="dialog" aria-label="Add a keeper" onClick={(e) => e.stopPropagation()}>
        <h3>A new keeper</h3>
        <p className="muted small">Each keeper has its own memory graph on your DKG node, a body, a role (what it can do) and a soul (who it is).</p>
        <label className="label" htmlFor="keeper-name">
          Name (you can say "Hey {name.trim() || '…'}" to it)
        </label>
        <input id="keeper-name" className="field" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} autoFocus autoCorrect="off" spellCheck={false} />
        <p className="eyebrow">Body</p>
        <div className="looks">
          {SKINS.map((s) => (
            <button key={s.id} type="button" className={`mind look ${skin === s.id ? 'is-on' : ''}`} onClick={() => setSkin(s.id)}>
              <strong>{s.name}</strong>
              <span className="mind-body">{s.description}</span>
            </button>
          ))}
        </div>
        <p className="eyebrow">Role</p>
        <div className="looks">
          {roles.map((r) => (
            <button key={r.id} type="button" className={`mind look ${role === r.id ? 'is-on' : ''}`} onClick={() => setRole(r.id)}>
              <strong>{r.title}</strong>
              <span className="mind-body">{r.blurb}</span>
            </button>
          ))}
        </div>
        <p className="eyebrow">Soul</p>
        <select className="field" value={soul} onChange={(e) => setSoul(e.target.value)} aria-label="Soul">
          <option value="">The role's usual soul</option>
          {souls.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}: {s.summary}
            </option>
          ))}
        </select>
        {error && <p className="error-line">{error}</p>}
        <div className="panel-actions">
          <PackImport onImported={() => { onImported(); onClose(); }} label="Import a keeper pack…" />
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={create} disabled={!valid || busy}>
            {busy && <span className="spinner" />} Create keeper
          </button>
        </div>
      </section>
    </div>
  );
}
