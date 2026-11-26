/**
 * Design from words: "a neon jacket with gold trim" becomes a real wardrobe item. The helper
 * model picks the part and its colours (`wardrobe_design`, validated like any import: a known
 * part, effects in range); the keeper wears it on the stage; "Keep it" saves it to the wardrobe.
 */
import { useState } from 'react';

import { PARTS } from '../character';
import { core, sentence, type WornPart } from '../kernel/ipc';

export interface Designed {
  name: string;
  part: string;
  effects: Record<string, number | string>;
}

interface Props {
  wearables: WornPart[];
  /** Show this outfit on the stage (null: back to what the keeper wears). */
  onPreview: (wearables: WornPart[] | null, caption: string) => void;
  /** It was kept: the wardrobe reloads. */
  onKept: () => void;
}

/** The outfit with the designed item in its slot (whatever was there comes off). */
export function wearDesigned(wearables: WornPart[], d: Designed): WornPart[] {
  const slot = PARTS.find((p) => p.id === d.part)?.slot;
  return [...wearables.filter((w) => PARTS.find((p) => p.id === w.part)?.slot !== slot), { part: d.part, effects: d.effects }];
}

export function DesignBox({ wearables, onPreview, onKept }: Props) {
  const [words, setWords] = useState('');
  const [designed, setDesigned] = useState<Designed | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const design = async () => {
    setBusy(true);
    setError(null);
    try {
      const d = await core.wardrobeDesign(words);
      setDesigned(d);
      onPreview(wearDesigned(wearables, d), `Trying on the ${d.name}`);
    } catch (e) {
      setError(sentence(e));
    } finally {
      setBusy(false);
    }
  };
  const keep = async () => {
    if (!designed) return;
    setBusy(true);
    try {
      await core.wardrobeAdd({ ...designed, oneOfAKind: false });
      setDesigned(null);
      setWords('');
      onPreview(null, '');
      onKept();
    } catch (e) {
      setError(sentence(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="studio-design">
      <p className="eyebrow">Design from words</p>
      <form className="studio-design-row" onSubmit={(e) => { e.preventDefault(); if (words.trim()) void design(); }}>
        <input className="field" value={words} maxLength={300} placeholder="A neon pink jacket with gold trim…" onChange={(e) => setWords(e.target.value)} aria-label="Describe an item" />
        <button type="submit" className="btn btn-primary btn-small" disabled={busy || words.trim().length < 3}>
          {busy && !designed ? 'Designing…' : 'Design it'}
        </button>
      </form>
      {designed && (
        <div className="studio-design-result">
          <span className="studio-design-swatches" aria-hidden="true">
            {Object.values(designed.effects).filter((v): v is string => typeof v === 'string' && v.startsWith('#')).map((c) => <span key={c} style={{ background: c }} />)}
          </span>
          <strong>{designed.name}</strong>
          <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={() => void keep()}>
            Keep it
          </button>
          <button type="button" className="btn btn-ghost btn-small" disabled={busy} onClick={() => void design()}>
            Try again
          </button>
        </div>
      )}
      {error && <p className="error-line small">{error}</p>}
    </div>
  );
}
