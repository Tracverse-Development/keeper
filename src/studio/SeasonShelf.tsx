/**
 * The season: a small official set open for a few weeks. Each item has a quest about something
 * useful done with the keeper (focus sessions finished, quiz answers right, lessons taken); the
 * core counts the progress from the keeper's own graph. A finished quest can be claimed, and a
 * claimed item stays in the inventory after the season ends. Nothing here is bought, and no
 * quest counts time spent.
 */
import { useEffect, useState } from 'react';

import { core, sentence, type KeeperProfile, type SeasonNow, type StudioInfo, type WornPart } from '../kernel/ipc';
import { ItemCard } from './ItemCard';
import { coloursOf } from './market-view';
import { daysLeftWords, questAction, questLine, questProgress } from './season-view';

interface Props {
  info: StudioInfo;
  keeper: KeeperProfile;
  /** Try an item on the stage (null: stop trying). */
  onTry: (item: WornPart | null, name: string) => void;
  /** An item was claimed: the wardrobe has a new item. */
  onClaimed: () => void;
}

export function SeasonShelf({ info, keeper, onTry, onClaimed }: Props) {
  const [season, setSeason] = useState<SeasonNow | null | undefined>(undefined);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setSeason(undefined);
    core
      .seasonNow(keeper.id)
      .then((s) => current && setSeason(s))
      .catch((e) => {
        if (!current) return;
        setSeason(null);
        setError(sentence(e));
      });
    return () => {
      current = false;
    };
  }, [keeper.id]);

  const claim = async (item: string) => {
    setBusy(item);
    setError(null);
    try {
      setSeason(await core.seasonClaim(keeper.id, item));
      onClaimed();
    } catch (e) {
      setError(sentence(e));
    } finally {
      setBusy('');
    }
  };

  if (season === undefined) return <p className="muted small">Reading the season…</p>;
  if (!season) {
    return (
      <div className="empty">
        <strong>{error ? "The season couldn't be read" : 'No season is open right now'}</strong>
        <span className="muted small">{error ?? 'A season is a small set that opens for a few weeks. Its items are earned by things you do with your keeper, never bought.'}</span>
      </div>
    );
  }
  return (
    <>
      <div className="market-standing">
        <div className="market-standing-words">
          <strong>{season.name}</strong>
          <span className="muted small">
            {daysLeftWords(season.daysLeft)}. Each item is earned by something {keeper.name} and you do together; what you claim is yours to keep.
          </span>
        </div>
      </div>
      <div className="item-grid">
        {season.items.map((q) => {
          const action = questAction(q);
          const rarity = info.rarities.find((r) => r.id === info.partRarity[q.part]) ?? info.rarities[0];
          return (
            <ItemCard key={q.id} name={q.name} rarity={rarity} slotName={q.slot} colours={coloursOf(q)} locked={null} worn={false} tags={['Season']} line={q.blurb} onTry={(on) => onTry(on ? { part: q.part, effects: q.effects } : null, q.name)}>
              <span className="season-quest">
                <span className="small">{questLine(q)}</span>
                {!q.claimed && (
                  <span className="studio-bar" role="progressbar" aria-label={q.quest} aria-valuemin={0} aria-valuemax={q.goal} aria-valuenow={q.done}>
                    <span style={{ width: `${questProgress(q) * 100}%` }} />
                  </span>
                )}
              </span>
              <button type="button" className={`btn btn-small ${action.can ? 'btn-primary' : ''}`} disabled={!action.can || busy === q.id} onClick={() => void claim(q.id)}>
                {busy === q.id ? 'Claiming…' : action.label}
              </button>
            </ItemCard>
          );
        })}
      </div>
      {error && <p className="error-line">{error}</p>}
    </>
  );
}
