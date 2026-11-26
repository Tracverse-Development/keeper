/**
 * Feelings: the keeper's SIMULATED mood, shown honestly. Its mood (a word and three bars:
 * pleasure, energy, confidence, each with the soul's resting point), what it is feeling now and
 * why (every change has a cause), Reset, and the switch to turn feelings off. A mood exists only in
 * modes that allow one (Companion by default; never where the keeper looks at or changes your
 * computer). It never changes facts or answers, never pressures you, and is never aimed at you
 * (docs/design/keeper-feelings.md).
 */
import { useEffect, useState } from 'react';

import { core, sentence, type FeelingsInfo, type KeeperProfile, type Pad } from '../kernel/ipc';

const AXES: { key: keyof Pad; name: string; low: string; high: string }[] = [
  { key: 'p', name: 'Pleasure', low: 'quiet', high: 'bright' },
  { key: 'a', name: 'Energy', low: 'sleepy', high: 'lively' },
  { key: 'd', name: 'Confidence', low: 'gentle', high: 'sure' },
];

/** Where -1..1 sits on a bar, as a percentage. */
const at = (v: number) => `${((Math.max(-1, Math.min(1, v)) + 1) / 2) * 100}%`;

export function FeelingsTab({ keeper, onToggle }: { keeper: KeeperProfile; onToggle: (off: boolean) => void }) {
  const [info, setInfo] = useState<FeelingsInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () => core.keeperFeelings(keeper.id).then(setInfo).catch((e) => setError(sentence(e)));
    load();
    const every = window.setInterval(load, 15000);
    return () => window.clearInterval(every);
  }, [keeper.id, keeper.feelingsOff]);

  const v = info?.view;
  return (
    <div className="studio-tab">
      <label className="toggle">
        <input type="checkbox" checked={!keeper.feelingsOff} onChange={(e) => onToggle(!e.target.checked)} />
        <span>
          {keeper.name} has feelings
          <span className="muted small"> · a simulated mood in {info?.modesWithMood.length ? info.modesWithMood.join(', ') : 'Companion'} mode, for warmth</span>
        </span>
      </label>
      {error && <p className="error-line small">{error}</p>}
      {keeper.feelingsOff ? (
        <p className="muted">Feelings are off: {keeper.name} answers plainly in every mode.</p>
      ) : v ? (
        <>
          <div className="feel-now">
            <span className="feel-word">{v.steppedAside ? 'set aside' : v.label}</span>
            <span className="muted small">{v.steppedAside ? 'You seemed to be going through something hard, so feelings stepped aside.' : 'right now'}</span>
          </div>
          <ul className="feel-axes">
            {AXES.map((ax) => (
              <li key={ax.key}>
                <span className="feel-axis-name">{ax.name}</span>
                <span className="feel-bar">
                  <span className="feel-rest" style={{ left: at(v.baseline[ax.key]) }} title="its resting point (from its soul)" />
                  <span className="feel-dot" style={{ left: at(v.mood[ax.key]) }} />
                </span>
                <span className="muted small feel-ends">{ax.low} · {ax.high}</span>
              </li>
            ))}
          </ul>
          {v.emotions.length > 0 && (
            <div className="studio-chips">
              {v.emotions.map((e) => (
                <span key={e.kind} className="studio-chip" style={{ opacity: 0.45 + e.intensity * 0.55 }}>{e.kind}</span>
              ))}
            </div>
          )}
          <p className="eyebrow">Why</p>
          {v.causes.length ? (
            <ol className="feel-causes">
              {v.causes.map((c, i) => (
                <li key={i}>{c.what}{c.emotion ? <span className="muted"> → {c.emotion}</span> : null}</li>
              ))}
            </ol>
          ) : (
            <p className="muted small">Nothing has stirred it yet: it is at its soul's resting mood.</p>
          )}
          <button type="button" className="btn btn-ghost btn-small" onClick={() => core.feelingsReset(keeper.id).then(setInfo).catch((e) => setError(sentence(e)))}>
            Reset to calm
          </button>
        </>
      ) : null}
      <p className="muted small">
        These feelings are a simulation that colours how {keeper.name} talks. They never change its facts or answers, never pressure you or make you feel guilty, and are never aimed at you. Ask it and it will say so.
      </p>
    </div>
  );
}
