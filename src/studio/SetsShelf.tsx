/**
 * Sets: every official set with where this keeper stands in it ("3 of 5 ready"), its theme, its
 * bonus and its signature piece. Pointing at a set tries the whole set on the big stage (with the
 * set glow once three pieces are on); "Wear the set" puts on every piece the keeper can wear now.
 * Sets its body may not wear are listed after, folded, so the whole collection stays browsable.
 */
import type { CSSProperties } from 'react';

import type { StudioInfo, Wardrobe } from '../kernel/ipc';
import { listings, setFor, setViews, type SetView } from './market-view';
import { rarityOf } from './studio-view';

interface Props {
  info: StudioInfo;
  keeperId: string;
  keeperName: string;
  wardrobe: Wardrobe;
  busy: boolean;
  onWearSet: (set: string) => void;
  onTrySet: (set: string | null) => void;
}

export function SetsShelf({ info, keeperId, keeperName, wardrobe, busy, onWearSet, onTrySet }: Props) {
  const views = setViews(wardrobe, listings(wardrobe, info, keeperId));
  const mine = views.filter((v) => v.forThisKeeper);
  const others = views.filter((v) => !v.forThisKeeper);
  if (!views.length) return <p className="muted">This version of Keeper lists no sets yet.</p>;
  return (
    <>
      <div className="set-grid">
        {mine.map((v) => <SetCard key={v.set.id} view={v} info={info} keeperName={keeperName} busy={busy} onWearSet={onWearSet} onTrySet={onTrySet} />)}
      </div>
      {others.length > 0 && (
        <details className="set-others">
          <summary>{others.length} more sets for other bodies</summary>
          <div className="set-grid">
            {others.map((v) => <SetCard key={v.set.id} view={v} info={info} keeperName={keeperName} busy={busy} onWearSet={onWearSet} onTrySet={onTrySet} />)}
          </div>
        </details>
      )}
    </>
  );
}

function SetCard({ view, info, keeperName, busy, onWearSet, onTrySet }: { view: SetView; info: StudioInfo; keeperName: string; busy: boolean; onWearSet: (set: string) => void; onTrySet: (set: string | null) => void }) {
  const { set, pieces, fits, ready, wearing, reward } = view;
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
          </li>
        ))}
      </ul>
      <p className="muted small">{set.bonus}</p>
      <button type="button" className={`btn btn-small btn-block ${ready > wearing ? 'btn-primary' : ''}`} disabled={busy || ready === 0 || wearing >= ready} onClick={() => onWearSet(set.id)}>
        {action}
      </button>
    </article>
  );
}
