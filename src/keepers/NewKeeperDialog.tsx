/**
 * Add a keeper: a name (its wake word), a look and a domain. The core creates its Context Graph
 * and profile asset on the node, then it becomes the active keeper.
 */
import { useState } from 'react';

import { SKINS } from '../character';
import { sentence, type DomainInfo } from '../kernel/ipc';

interface Props {
  domains: DomainInfo[];
  onClose: () => void;
  onCreate: (k: { name: string; skin: string; domain: string }) => Promise<unknown>;
}

export function NewKeeperDialog({ domains, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [skin, setSkin] = useState<string>(SKINS[1]?.id ?? SKINS[0].id);
  const [domain, setDomain] = useState(domains[1]?.id ?? domains[0]?.id ?? 'system');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^[\p{L}\p{N} -]{1,24}$/u.test(name.trim());

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), skin, domain });
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
        <p className="muted small">Each keeper has its own memory graph on your DKG node, its own look and its own job.</p>
        <label className="label" htmlFor="keeper-name">
          Name (you can say "Hey {name.trim() || '…'}" to it)
        </label>
        <input id="keeper-name" className="field" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} autoFocus autoCorrect="off" spellCheck={false} />
        <p className="eyebrow">Look</p>
        <div className="looks">
          {SKINS.map((s) => (
            <button key={s.id} type="button" className={`mind look ${skin === s.id ? 'is-on' : ''}`} onClick={() => setSkin(s.id)}>
              <strong>{s.name}</strong>
              <span className="mind-body">{s.description}</span>
            </button>
          ))}
        </div>
        <p className="eyebrow">What it keeps</p>
        <div className="minds">
          {domains.map((d) => (
            <button key={d.id} type="button" className={`mind look ${domain === d.id ? 'is-on' : ''}`} onClick={() => setDomain(d.id)}>
              <strong>{d.title}</strong>
              <span className="mind-body">{d.blurb}</span>
            </button>
          ))}
        </div>
        {error && <p className="error-line">{error}</p>}
        <div className="panel-actions">
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
