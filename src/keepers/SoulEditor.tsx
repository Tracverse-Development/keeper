/**
 * Make or edit a soul: name, who it is, how it talks, humour and formality, catchphrases, greeting,
 * what it says when poked or patted, style rules. Lists are one item per line. The core cleans and
 * caps everything and saves it to your kit graph on the DKG.
 */
import { useState } from 'react';

import { core, sentence, type Soul } from '../kernel/ipc';
import { useEscape } from '../kernel/use-escape';

const BLANK: Soul = { id: '', name: '', summary: '', traits: [], tone: '', humor: 5, formality: 3, emoji: false, catchphrases: [], greeting: '', pokeLines: [], patLines: [], rules: [], builtin: false };
const lines = (v: string) => v.split('\n').map((l) => l.trim()).filter(Boolean);
const idFrom = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function SoulEditor({ start, onClose, onSaved }: { start: Soul | null; onClose: () => void; onSaved: (s: Soul) => void }) {
  const [soul, setSoul] = useState<Soul>(start ?? BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Soul>) => setSoul((s) => ({ ...s, ...patch }));
  const list = (key: 'traits' | 'catchphrases' | 'pokeLines' | 'patLines' | 'rules', label: string, hint: string) => (
    <label className="soul-field">
      <span className="label">{label}</span>
      <textarea className="field area" rows={3} placeholder={hint} defaultValue={soul[key].join('\n')} onChange={(e) => set({ [key]: lines(e.target.value) } as Partial<Soul>)} data-text-assist="on" />
    </label>
  );

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await core.saveSoul({ ...soul, id: start?.id ?? idFrom(soul.name) }));
    } catch (e) {
      setError(sentence(e));
      setBusy(false);
    }
  };

  useEscape(true, onClose);
  return (
    <div className="sheet-backdrop is-open" onClick={onClose}>
      <section className="sheet glass soul-editor" role="dialog" aria-label="Soul" onClick={(e) => e.stopPropagation()}>
        <h3>{start ? `Edit ${start.name}` : 'A new soul'}</h3>
        <p className="muted small">A soul is who your keeper is: its personality. Its memories stay its own.</p>
        <label className="soul-field">
          <span className="label">Name</span>
          <input className="field" value={soul.name} maxLength={40} disabled={Boolean(start)} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="soul-field">
          <span className="label">Who it is, in one line</span>
          <input className="field" value={soul.summary} maxLength={200} onChange={(e) => set({ summary: e.target.value })} placeholder="Warm Caribbean banter, always on your side." />
        </label>
        <label className="soul-field">
          <span className="label">How it talks</span>
          <input className="field" value={soul.tone} maxLength={160} onChange={(e) => set({ tone: e.target.value })} placeholder="relaxed, cheeky, kind" />
        </label>
        <div className="soul-sliders">
          <label>
            <span className="label">Humour {soul.humor}/10</span>
            <input type="range" min={0} max={10} value={soul.humor} onChange={(e) => set({ humor: Number(e.target.value) })} />
          </label>
          <label>
            <span className="label">Formality {soul.formality}/10</span>
            <input type="range" min={0} max={10} value={soul.formality} onChange={(e) => set({ formality: Number(e.target.value) })} />
          </label>
          <label className="toggle-inline">
            <input type="checkbox" checked={soul.emoji} onChange={(e) => set({ emoji: e.target.checked })} /> Emoji
          </label>
        </div>
        <label className="soul-field">
          <span className="label">Greeting</span>
          <input className="field" value={soul.greeting} maxLength={160} onChange={(e) => set({ greeting: e.target.value })} />
        </label>
        {list('traits', 'Traits', 'friendly\nplayful')}
        {list('catchphrases', 'Catchphrases', 'Leh we go!')}
        {list('pokeLines', 'When you click it', 'Ey! What you need, {you}?')}
        {list('patLines', 'When you pat it', 'Hehe, that tickles!')}
        {list('rules', 'Style rules', 'never mock the person')}
        {error && <p className="error-line">{error}</p>}
        <div className="panel-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !soul.name.trim()}>
            {busy && <span className="spinner" />} Save soul
          </button>
        </div>
      </section>
    </div>
  );
}
