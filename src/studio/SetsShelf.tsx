/**
 * Sets: every official set with where this keeper stands in it ("3 of 5 ready"), its theme, its
 * bonus and its signature piece. Pointing at a set tries the whole set on the big stage (with the
 * set glow once three pieces are on); "Wear the set" puts on every piece the keeper can wear now.
 * Sets its body may not wear are listed after, folded, so the whole collection stays browsable.
 * Each set can be tied to a mode ("Wear in Researcher mode": a loadout, `kit/loadout.rs`), and
 * pieces opened since the person last looked carry a "New" badge (`set-progress.ts`).
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import { sentence, type StudioInfo, type Wardrobe } from '../kernel/ipc';
import { listings, setFor, setViews, type SetView } from './market-view';
import { loadoutChanges, modesWearing, newPieces, readSeen, writeSeen } from './set-progress';
import { rarityOf } from './studio-view';

/** How long the Sets side is open before what it shows counts as seen (ms). */
const SEEN_AFTER = 1500;

interface Props {
  info: StudioInfo;
  keeperId: string;
  keeperName: string;
  wardrobe: Wardrobe;
  busy: boolean;
  onWearSet: (set: string) => void;
  onTrySet: (set: string | null) => void;
  /** The modes, this keeper's loadouts (mode → set), and tying a set to a mode (null: untie). */
  modes: { id: string; title: string }[];
  loadouts: Readonly<Record<string, string>>;
  onLoadout: (mode: string, set: string | null) => Promise<unknown>;
}

/** What a set card needs besides its set. */
interface CardContext {
  info: StudioInfo;
  keeperName: string;
  busy: boolean;
  fresh: ReadonlySet<string>;
  modes: { id: string; title: string }[];
  loadouts: Readonly<Record<string, string>>;
  onWearSet: (set: string) => void;
  onTrySet: (set: string | null) => void;
  onTie: (set: string, mode: string) => void;
}

export function SetsShelf({ info, keeperId, keeperName, wardrobe, busy, onWearSet, onTrySet, modes, loadouts, onLoadout }: Props) {
  const views = useMemo(() => setViews(wardrobe, listings(wardrobe, info, keeperId)), [wardrobe, info, keeperId]);
  const open = useMemo(() => views.flatMap((v) => v.pieces.filter((l) => l.fits && l.locked === null).map((l) => l.item.id)), [views]);
  // Badges are worked out once per opening of the Sets side, then what was shown counts as seen.
  const [fresh] = useState(() => newPieces(open, readSeen(keeperId)));
  useEffect(() => {
    const timer = window.setTimeout(() => writeSeen(keeperId, [...readSeen(keeperId), ...open]), SEEN_AFTER);
    return () => window.clearTimeout(timer);
  }, [keeperId, open]);
  const [note, setNote] = useState<{ words: string; bad: boolean } | null>(null);
  const onTie = (set: string, mode: string) => {
    const changes = loadoutChanges(loadouts, set, mode);
    void changes
      .reduce<Promise<unknown>>((chain, c) => chain.then(() => onLoadout(c.mode, c.set)), Promise.resolve())
      .then(() => {
        const title = modes.find((m) => m.id === mode)?.title;
        setNote({ words: title ? `${keeperName} will wear it in ${title} mode.` : `${keeperName} no longer changes into it.`, bad: false });
      })
      .catch((e) => setNote({ words: sentence(e), bad: true }));
  };
  const context: CardContext = { info, keeperName, busy, fresh, modes, loadouts, onWearSet, onTrySet, onTie };
  const mine = views.filter((v) => v.forThisKeeper);
  const others = views.filter((v) => !v.forThisKeeper);
  if (!views.length) return <p className="muted">This version of Keeper lists no sets yet.</p>;
  return (
    <>
      {note && <p className={note.bad ? 'error-line' : 'ok-text small'} role="status">{note.words}</p>}
      <div className="set-grid">
        {mine.map((v) => <SetCard key={v.set.id} view={v} {...context} />)}
      </div>
      {others.length > 0 && (
        <details className="set-others">
          <summary>{others.length} more sets for other bodies</summary>
          <div className="set-grid">
            {others.map((v) => <SetCard key={v.set.id} view={v} {...context} />)}
          </div>
        </details>
      )}
    </>
  );
}

function SetCard({ view, info, keeperName, busy, fresh, modes, loadouts, onWearSet, onTrySet, onTie }: CardContext & { view: SetView }) {
  const { set, pieces, fits, ready, wearing, reward } = view;
  const tied = modesWearing(loadouts, set.id);
  const rarity = reward ? rarityOf(info, reward.item) : null;
  const total = pieces.length;
  const action = !view.forThisKeeper ? `Not for ${keeperName}` : ready === 0 ? 'Nothing to wear yet' : wearing >= ready ? 'Wearing the set' : `Wear the set (${ready})`;
  return (
    <article className="set-card" style={{ '--rarity': rarity?.color ?? 'var(--gold-500)' } as CSSProperties} onMouseEnter={() => onTrySet(set.id)} onMouseLeave={() => onTrySet(null)} onFocus={() => onTrySet(set.id)} onBlur={() => onTrySet(null)}>
      <header className="set-card-head">
        <strong>{set.name}</strong>
        <span className="muted small">{setFor(set.who)}</span>
      </header>
      <p className="small">{set.theme}</p>
      <div className="studio-bar" role="progressbar" aria-label={`${set.name}: pieces ready`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={ready}>
        <span style={{ width: `${total ? (ready / total) * 100 : 0}%` }} />
      </div>
      <span className="muted small">
        {view.forThisKeeper ? `${ready} of ${total} ready for ${keeperName}${fits < total ? ` (${total - fits} not for this body)` : ''}. Wearing ${wearing}.` : `${total} pieces.`}
      </span>
      <ul className="set-pieces">
        {pieces.map((l) => (
          <li key={l.item.id} className={l.fits && l.locked === null ? '' : 'muted'}>
            <span className="studio-dot" style={{ background: l.rarity.color }} aria-hidden="true" />
            {l.item.name}
            {l.item.id === reward?.item.id && <span className="tag">Reward</span>}
            {l.locked !== null && l.fits && <span className="tag">Level {l.locked}</span>}
            {fresh.has(l.item.id) && <span className="tag tag-new">New</span>}
          </li>
        ))}
      </ul>
      <p className="muted small">{set.bonus}</p>
      {view.forThisKeeper && modes.length > 0 && (
        <label className="set-loadout small">
          <span className="muted">Wear in</span>
          <select className="field field-small" value={tied[0] ?? ''} aria-label={`Mode that wears ${set.name}`} disabled={busy} onChange={(e) => onTie(set.id, e.target.value)}>
            <option value="">No mode</option>
            {modes.map((m) => (
              <option key={m.id} value={m.id}>{m.title} mode</option>
            ))}
          </select>
        </label>
      )}
      <button type="button" className={`btn btn-small btn-block ${ready > wearing ? 'btn-primary' : ''}`} disabled={busy || ready === 0 || wearing >= ready} onClick={() => onWearSet(set.id)}>
        {action}
      </button>
    </article>
  );
}
