/**
 * Marketplace. SHOP: the official collection, one shelf per set (the sets this keeper may wear
 * first), each shelf in the order a keeper earns it (common to mythical); each item is worn once
 * the keeper's level reaches its rarity (earned, never bought). SETS: every set with this keeper's
 * progress, its bonus and its reward, worn whole in one press (`SetsShelf`). KEEPERS: the starter
 * keepers, added in one press (`StarterShelf`). COMMUNITY:
 * keepers, souls and items people share as `.keeper.json` packs: receive one (described before it
 * is added) or share this keeper. Packs are data only, checked by the core on the way in, and
 * never carry memories or personal photos. THIS SEASON: a small set open for a few weeks, each
 * item earned by a quest (`SeasonShelf`). The rules live in `market-view.ts`.
 */
import { useMemo, useState } from 'react';

import { core, sentence, type Imported, type KeeperProfile, type Starter, type StudioInfo, type Wardrobe, type WornPart } from '../kernel/ipc';
import { ItemCard } from './ItemCard';
import { earningOrder, filtered, listingAction, listings, MARKET_FILTERS, shopShelves, standing, type MarketFilter } from './market-view';
import { MakerFields } from './MakerFields';
import { PackDrop } from './PackDrop';
import { SeasonShelf } from './SeasonShelf';
import { SetsShelf } from './SetsShelf';
import { StarterShelf } from './StarterShelf';

interface Props {
  info: StudioInfo;
  keeper: KeeperProfile;
  wardrobe: Wardrobe | null;
  busy: boolean;
  soulName: string;
  onWear: (item: string) => void;
  onTry: (item: string | null) => void;
  onImported: (i: Imported) => void;
  /** Try a season item on the stage (null: stop), and reload the wardrobe after one was claimed. */
  onSeasonTry: (item: WornPart | null, name: string) => void;
  onClaimed: () => void;
  /** Put on, or try on the stage (null: stop), every piece of a set. */
  onWearSet: (set: string) => void;
  onTrySet: (set: string | null) => void;
  /** The names of the person's keepers, and showing or adding a starter keeper. */
  keeperNames: string[];
  /** The modes, and tying a set to one (null: untie); resolves when saved. */
  modes: { id: string; title: string }[];
  onLoadout: (mode: string, set: string | null) => Promise<unknown>;
  onTryStarter: (starter: Starter | null) => void;
  onStarterAdded: () => void;
}

type Side = 'shop' | 'sets' | 'season' | 'community' | 'keepers';

const SIDES: { id: Side; name: string }[] = [
  { id: 'shop', name: 'Shop' },
  { id: 'sets', name: 'Sets' },
  { id: 'season', name: 'This season' },
  { id: 'community', name: 'Community' },
  { id: 'keepers', name: 'Keepers' },
];

export function MarketTab({ info, keeper, wardrobe, busy, soulName, onWear, onTry, onImported, onSeasonTry, onClaimed, onWearSet, onTrySet, keeperNames, onTryStarter, onStarterAdded, modes, onLoadout }: Props) {
  const [side, setSide] = useState<Side>('shop');
  const [filter, setFilter] = useState<MarketFilter>('all');
  const [search, setSearch] = useState('');
  const all = useMemo(() => (wardrobe ? listings(wardrobe, info, keeper.id) : []), [wardrobe, info, keeper.id]);
  const shown = useMemo(() => (wardrobe ? filtered(all, wardrobe, filter, search) : []), [all, wardrobe, filter, search]);
  const stand = standing(info, all);
  const level = Math.max(1, info.experience.level);

  return (
    <div className="studio-tab market">
      <div className="market-standing">
        <div className="market-standing-words">
          <strong>{stand.open} of {stand.total} items open to {keeper.name}</strong>
          <span className="muted small">
            {stand.next ? `${stand.next.name} items open at level ${stand.next.level}. ${keeper.name} is level ${level}.` : `${keeper.name} has opened every rarity.`}
          </span>
        </div>
        <div className="studio-bar market-standing-bar" role="progressbar" aria-label="Items open" aria-valuemin={0} aria-valuemax={stand.total} aria-valuenow={stand.open}>
          <span style={{ width: `${stand.total ? (stand.open / stand.total) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="segmented market-sides" role="tablist" aria-label="Marketplace">
        {SIDES.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={side === x.id} className={side === x.id ? 'is-on' : ''} onClick={() => setSide(x.id)}>{x.name}</button>
        ))}
      </div>

      {side === 'season' && <SeasonShelf info={info} keeper={keeper} onTry={onSeasonTry} onClaimed={onClaimed} />}

      {side === 'shop' && (
        <>
          <div className="toolbar">
            <div className="studio-chips" role="group" aria-label="Show">
              {MARKET_FILTERS.map((f) => (
                <button key={f.id} type="button" aria-pressed={filter === f.id} className={`studio-chip ${filter === f.id ? 'is-on' : ''}`} onClick={() => setFilter(f.id)}>{f.name}</button>
              ))}
            </div>
            <input className="field field-small toolbar-search" value={search} placeholder="Search the collection" aria-label="Search the collection" onChange={(e) => setSearch(e.target.value)} />
          </div>
          {!wardrobe && <p className="muted">Opening the collection…</p>}
          {wardrobe && shown.length === 0 && (
            <div className="empty">
              <strong>Nothing matches</strong>
              <span className="muted small">Try another filter or a shorter search.</span>
              <button type="button" className="btn btn-small" onClick={() => { setFilter('all'); setSearch(''); }}>Show everything</button>
            </div>
          )}
          {wardrobe &&
            shopShelves(wardrobe, shown).map((shelf) => (
              <section key={shelf.id} className="market-shelf" aria-label={shelf.title}>
                <div className="market-shelf-head">
                  <h3 className="panel-card-title">{shelf.title}</h3>
                  <span className="muted small">{shelf.sub}</span>
                </div>
                <div className="item-grid">
                  {earningOrder(info, shelf.items).map((l) => {
                    const action = listingAction(l);
                    return (
                      <ItemCard key={l.item.id} name={l.item.name} rarity={l.rarity} slotName={l.slotName} colours={l.colours} locked={l.locked} worn={l.wearing} line={l.item.blurb} onTry={(on) => onTry(on ? l.item.id : null)}>
                        <button type="button" className={`btn btn-small btn-block ${action.can ? 'btn-primary' : ''}`} disabled={busy || !action.can} onClick={() => onWear(l.item.id)}>{action.label}</button>
                      </ItemCard>
                    );
                  })}
                </div>
              </section>
            ))}
        </>
      )}

      {side === 'sets' && wardrobe && <SetsShelf info={info} keeperId={keeper.id} keeperName={keeper.name} wardrobe={wardrobe} busy={busy} onWearSet={onWearSet} onTrySet={onTrySet} modes={modes} loadouts={keeper.loadouts ?? {}} onLoadout={onLoadout} />}

      {side === 'community' && <Community keeper={keeper} soulName={soulName} onImported={onImported} />}

      {side === 'keepers' && <StarterShelf info={info} names={keeperNames} onTry={onTryStarter} onAdded={onStarterAdded} />}
    </div>
  );
}

/** Receive a pack, or share this keeper or its soul as one. */
function Community({ keeper, soulName, onImported }: { keeper: KeeperProfile; soulName: string; onImported: (i: Imported) => void }) {
  const [note, setNote] = useState<{ words: string; bad: boolean } | null>(null);
  const share = (kind: 'keeper' | 'soul', id: string) =>
    core
      .exportPack(kind, id)
      .then((path) => setNote({ words: `Saved ${path.split('/').pop()} in your Downloads folder.`, bad: false }))
      .catch((e) => setNote({ words: sentence(e), bad: true }));
  return (
    <>
      <div className="market-community">
        <section className="panel-card">
          <h3 className="panel-card-title">Receive a pack</h3>
          <p className="muted small">Keepers, souls and items that people share as files. You see what a pack carries before it is added.</p>
          <PackDrop onImported={onImported} />
        </section>
        <section className="panel-card">
          <h3 className="panel-card-title">Share yours</h3>
          <p className="muted small">Saves a file in Downloads that you can send to anyone with Keeper.</p>
          <div className="stack">
            <button type="button" className="btn btn-block" onClick={() => void share('keeper', keeper.id)}>Share {keeper.name}</button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => void share('soul', keeper.soul)}>Share only its soul ({soulName})</button>
          </div>
          <MakerFields />
          {note && <p className={note.bad ? 'error-line' : 'ok-text small'} role="status">{note.words}</p>}
        </section>
      </div>
      <ul className="facts">
        <li><strong>Data only.</strong> <span className="muted">A pack is a description. It can never run anything on your computer.</span></li>
        <li><strong>Checked first.</strong> <span className="muted">Keeper reads the whole file and refuses anything it does not know.</span></li>
        <li><strong>No memories.</strong> <span className="muted">A pack carries who a keeper is and how it looks, never what it remembers or your photos.</span></li>
      </ul>
    </>
  );
}
