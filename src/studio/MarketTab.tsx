/**
 * Marketplace. OFFICIAL: the collection Keeper ships, in the order a keeper earns it (common to mythical);
 * each item is worn once the keeper's level reaches its rarity (earned, never bought). COMMUNITY:
 * keepers, souls and items people share as `.keeper.json` packs: receive one (described before it
 * is added) or share this keeper. Packs are data only, checked by the core on the way in, and
 * never carry memories or personal photos. The rules live in `market-view.ts`.
 */
import { useMemo, useState } from 'react';

import { core, sentence, type Imported, type KeeperProfile, type StudioInfo, type Wardrobe } from '../kernel/ipc';
import { ItemCard } from './ItemCard';
import { earningOrder, filtered, listingAction, listings, MARKET_FILTERS, standing, type MarketFilter } from './market-view';
import { PackDrop } from './PackDrop';

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

type Side = 'official' | 'community';

export function MarketTab({ info, keeper, wardrobe, busy, soulName, onWear, onTry, onImported }: Props) {
  const [side, setSide] = useState<Side>('official');
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
        <button type="button" role="tab" aria-selected={side === 'official'} className={side === 'official' ? 'is-on' : ''} onClick={() => setSide('official')}>Official collection</button>
        <button type="button" role="tab" aria-selected={side === 'community'} className={side === 'community' ? 'is-on' : ''} onClick={() => setSide('community')}>Community packs</button>
      </div>

      {side === 'official' && (
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
          <div className="item-grid">
            {earningOrder(info, shown).map((l) => {
              const action = listingAction(l);
              return (
                <ItemCard key={l.item.id} name={l.item.name} rarity={l.rarity} slotName={l.slotName} colours={l.colours} locked={l.locked} worn={l.wearing} line={l.item.blurb} onTry={(on) => onTry(on ? l.item.id : null)}>
                  <button type="button" className={`btn btn-small btn-block ${action.can ? 'btn-primary' : ''}`} disabled={busy || !action.can} onClick={() => onWear(l.item.id)}>{action.label}</button>
                </ItemCard>
              );
            })}
          </div>
        </>
      )}

      {side === 'community' && <Community keeper={keeper} soulName={soulName} onImported={onImported} />}
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
