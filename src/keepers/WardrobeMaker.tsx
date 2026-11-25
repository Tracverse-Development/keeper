/**
 * Make your own wardrobe item: a part from the catalogue in your colours, with a name, and
 * whether it is one of a kind (a single physical thing only one keeper wears at a time) or a
 * design anyone can wear. The core validates it and saves it to your kit on the DKG.
 */
import { useState } from 'react';

import { PARTS } from '../character';
import type { NewWardrobeItem } from '../kernel/ipc';

interface Props {
  /** Start with a part for this slot. */
  slot: string;
  busy: boolean;
  onSave: (item: NewWardrobeItem) => Promise<boolean>;
}

const defaultsOf = (partId: string): Record<string, string> =>
  Object.fromEntries(Object.entries(PARTS.find((p) => p.id === partId)?.effects ?? {}).flatMap(([key, spec]) => (spec.kind === 'colour' ? [[key, spec.default]] : [])));

export function WardrobeMaker({ slot, busy, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [part, setPart] = useState<string>(PARTS.find((p) => p.slot === slot)?.id ?? PARTS[0].id);
  const [name, setName] = useState('');
  const [colours, setColours] = useState<Record<string, string>>(() => defaultsOf(part));
  const [oneOfAKind, setOneOfAKind] = useState(false);
  const info = PARTS.find((p) => p.id === part);

  if (!open) {
    return (
      <button type="button" className="link wardrobe-make-open" onClick={() => setOpen(true)}>
        Make your own…
      </button>
    );
  }
  const pick = (id: string) => {
    setPart(id);
    setColours(defaultsOf(id));
  };
  const save = () =>
    void onSave({ name, part, effects: colours, oneOfAKind }).then((ok) => {
      if (!ok) return;
      setOpen(false);
      setName('');
    });
  return (
    <div className="wardrobe-make">
      <input className="field" placeholder="Name it (e.g. Trini Boi's Jacket)" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      <select className="field" aria-label="Part" value={part} onChange={(e) => pick(e.target.value)}>
        {PARTS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <div className="wardrobe-colours">
        {Object.entries(info?.effects ?? {}).flatMap(([key, spec]) =>
          spec.kind === 'colour'
            ? [
                <label key={key} className="wardrobe-colour">
                  <input type="color" value={colours[key] ?? spec.default} onChange={(e) => setColours({ ...colours, [key]: e.target.value })} />
                  <span className="small">{spec.label}</span>
                </label>,
              ]
            : [],
        )}
      </div>
      <label className="toggle">
        <input type="checkbox" checked={oneOfAKind} onChange={(e) => setOneOfAKind(e.target.checked)} />
        <span>
          <strong>One of a kind</strong>
          <span className="muted small">Only one keeper wears it at a time; giving it moves it. Otherwise it's a design every keeper can wear.</span>
        </span>
      </label>
      <div className="wardrobe-actions">
        <button type="button" className="btn btn-primary btn-small" disabled={busy || !name.trim()} onClick={save}>
          Add to my wardrobe
        </button>
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
