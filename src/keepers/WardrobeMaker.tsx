/**
 * Make your own wardrobe item: a part from the catalogue with every one of its effects set by
 * hand (colours with a picker, numbers such as spin speed with a slider), a name, and whether it
 * is one of a kind (a single physical thing only one keeper wears at a time) or a design anyone
 * can wear. While it is open the keeper tries it on live (`onTry`). The core validates it and
 * saves it to your kit on the DKG.
 */
import { useEffect, useState } from 'react';

import { PARTS } from '../character';
import type { NewWardrobeItem, WornPart } from '../kernel/ipc';

interface Props {
  /** Start with a part for this slot. */
  slot: string;
  busy: boolean;
  onSave: (item: NewWardrobeItem) => Promise<boolean>;
  /** The item as it is being made, to try on (null when the maker closes). */
  onTry?: (item: WornPart | null) => void;
}

type Effects = Record<string, number | string>;

const defaultsOf = (partId: string): Effects => Object.fromEntries(Object.entries(PARTS.find((p) => p.id === partId)?.effects ?? {}).map(([key, spec]) => [key, spec.default]));

export function WardrobeMaker({ slot, busy, onSave, onTry }: Props) {
  const [open, setOpen] = useState(false);
  const [part, setPart] = useState<string>(PARTS.find((p) => p.slot === slot)?.id ?? PARTS[0].id);
  const [name, setName] = useState('');
  const [effects, setEffects] = useState<Effects>(() => defaultsOf(part));
  const [oneOfAKind, setOneOfAKind] = useState(false);
  const info = PARTS.find((p) => p.id === part);
  const effectsKey = JSON.stringify(effects);

  // The keeper wears it as it is made; closing the maker takes it off again.
  useEffect(() => {
    if (!open) return;
    onTry?.({ part, effects: JSON.parse(effectsKey) as Effects });
    return () => onTry?.(null);
  }, [open, part, effectsKey]);

  if (!open) {
    return (
      <button type="button" className="link wardrobe-make-open" onClick={() => setOpen(true)}>
        Make your own…
      </button>
    );
  }
  const pick = (id: string) => {
    setPart(id);
    setEffects(defaultsOf(id));
  };
  const save = () =>
    void onSave({ name, part, effects, oneOfAKind }).then((ok) => {
      if (!ok) return;
      setOpen(false);
      setName('');
    });
  const specs = Object.entries(info?.effects ?? {});
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
        {specs.flatMap(([key, spec]) =>
          spec.kind === 'colour'
            ? [
                <label key={key} className="wardrobe-colour">
                  <input type="color" value={String(effects[key] ?? spec.default)} onChange={(e) => setEffects({ ...effects, [key]: e.target.value })} />
                  <span className="small">{spec.label}</span>
                </label>,
              ]
            : [],
        )}
      </div>
      {specs.flatMap(([key, spec]) =>
        spec.kind === 'number'
          ? [
              <label key={key} className="wardrobe-dial">
                <span className="small">{spec.label}</span>
                <input type="range" min={spec.min} max={spec.max} step={spec.step ?? (spec.max - spec.min) / 40} value={Number(effects[key] ?? spec.default)} onChange={(e) => setEffects({ ...effects, [key]: Number(e.target.value) })} />
              </label>,
            ]
          : [],
      )}
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
