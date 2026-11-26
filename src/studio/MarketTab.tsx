/**
 * Marketplace. OFFICIAL: the collection Keeper ships, by rarity from common to mythical, each
 * item worn once the keeper's level reaches its rarity (earned, not bought). COMMUNITY: keepers,
 * souls and items people share as `.keeper.json` packs: import one, or share this keeper. Packs
 * are data only (checked on the way in) and never carry memories or personal photos.
 */
import type { CSSProperties } from 'react';

import type { Imported, KeeperProfile, StudioInfo, Wardrobe } from '../kernel/ipc';
import { ShareSection } from '../keepers/ShareSection';
import { byRarity, lockedUntil } from './studio-view';

interface Props {
  info: StudioInfo;
  keeper: KeeperProfile;
  wardrobe: Wardrobe | null;
  busy: boolean;
  soulName: string;
  onWear: (item: string) => void;
  onTry: (item: string | null) => void;
  onImported: (i: Imported) => void;
}

export function MarketTab({ info, keeper, wardrobe, busy, soulName, onWear, onTry, onImported }: Props) {
  const official = (wardrobe?.items ?? []).filter((i) => i.source === 'official');
  const slots = new Set(wardrobe?.keepers.find((k) => k.id === keeper.id)?.slots ?? []);
  return (
    <div className="studio-tab">
      <p className="eyebrow">Official collection</p>
      <p className="muted small">Made by Keeper. Each item is earned: it unlocks when {keeper.name} reaches its level.</p>
      {!wardrobe && <p className="muted">Opening the collection…</p>}
      {byRarity(info, official).map(({ rarity, items }) => (
        <section key={rarity.id} className="market-group" style={{ '--rarity': rarity.color } as CSSProperties}>
          <h3 className="market-rarity">
            {rarity.name} <span className="muted small">level {rarity.level}</span>
          </h3>
          <div className="market-grid">
            {items.map((item) => {
              const locked = lockedUntil(rarity, info.experience.level);
              const fits = slots.has(item.slot);
              const wearing = item.wornBy.includes(keeper.id);
              const colours = Object.values(item.effects).filter((v): v is string => typeof v === 'string' && v.startsWith('#'));
              return (
                <article key={item.id} className={`market-item rarity-${rarity.id} ${locked ? 'is-locked' : ''}`} onMouseEnter={() => onTry(item.id)} onMouseLeave={() => onTry(null)} onFocus={() => onTry(item.id)}>
                  <span className="wardrobe-swatches" aria-hidden="true">
                    {colours.map((c) => <span key={c} className="wardrobe-swatch" style={{ background: c }} />)}
                  </span>
                  <strong>{item.name}</strong>
                  <span className="muted small">{item.blurb}</span>
                  <button type="button" className="btn btn-primary btn-small" disabled={busy || locked !== null || !fits || wearing} onClick={() => onWear(item.id)}>
                    {wearing ? 'Wearing' : locked !== null ? `Unlocks at level ${locked}` : fits ? 'Wear' : `Needs a ${item.slot}`}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      <p className="eyebrow">Community</p>
      <p className="muted small">Keepers, souls and items people share as files. Opening one checks it first: data only, never code, never memories.</p>
      <div className="market-community">
        <ShareSection keeper={keeper} soulName={soulName} onImported={onImported} />
      </div>
    </div>
  );
}
