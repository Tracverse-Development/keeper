/**
 * Inventory: every mod this person owns, in one place (outfit, floating parts, effects, the ones
 * they forged), rarest first. Each mod shows its rarity, who wears it, and what to do: equip it
 * on this keeper (swapping out whatever was in that slot), take it off, give it to another keeper,
 * or share it as a pack file. Hovering a mod tries it on the big stage. Locked mods say the level.
 */
import { useMemo, useState } from 'react';

import { core, sentence, type KeeperProfile, type StudioInfo, type Wardrobe, type WardrobeItem } from '../kernel/ipc';
import { FILTERS, inventory, type InventoryFilter } from './inventory-view';
import { ItemCard } from './ItemCard';
import { coloursOf } from './market-view';
import { lockedUntil, rarityOf } from './studio-view';

interface Props {
  info: StudioInfo;
  keeper: KeeperProfile;
  wardrobe: Wardrobe | null;
  busy: boolean;
  onWear: (item: string) => void;
  onTakeOff: (item: string) => void;
  onGive: (item: string, to: string, mode: 'move' | 'share') => void;
  onTry: (item: WardrobeItem | null) => void;
}

export function InventoryTab({ info, keeper, wardrobe, busy, onWear, onTakeOff, onGive, onTry }: Props) {
  const [filter, setFilter] = useState<InventoryFilter>('all');
  const [search, setSearch] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const items = useMemo(() => (wardrobe ? inventory(wardrobe, keeper.id, filter, search, (i) => rarityOf(info, i).id) : []), [wardrobe, keeper.id, filter, search, info]);
  const slots = new Set(wardrobe?.keepers.find((k) => k.id === keeper.id)?.slots ?? []);
  const others = (wardrobe?.keepers ?? []).filter((k) => k.id !== keeper.id);
  const share = (item: WardrobeItem) =>
    core
      .wardrobeShare(item.id)
      .then((path) => setNote(`Saved ${path.split('/').pop()} in Downloads.`))
      .catch((e) => setNote(sentence(e)));

  return (
    <div className="studio-tab">
      <div className="toolbar">
        <div className="studio-chips" role="tablist" aria-label="Show">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className={`studio-chip ${filter === f.id ? 'is-on' : ''}`} onClick={() => setFilter(f.id)}>
              {f.name}
            </button>
          ))}
        </div>
        <input className="field field-small toolbar-search" value={search} placeholder="Search your mods" onChange={(e) => setSearch(e.target.value)} aria-label="Search your mods" />
      </div>
      {note && <p className="muted small">{note}</p>}
      {!wardrobe && <p className="muted">Opening your inventory…</p>}
      {wardrobe && items.length === 0 && (
        <div className="empty">
          <strong>Nothing here yet</strong>
          <span className="muted small">Forge an item, or find one in the Marketplace.</span>
        </div>
      )}
      <div className="item-grid">
        {items.map((item) => {
          const rarity = rarityOf(info, item);
          const locked = lockedUntil(rarity, info.experience.level);
          const wearing = item.wornBy.includes(keeper.id);
          const fits = slots.has(item.slot);
          const slotName = wardrobe?.slots.find((s) => s.id === item.slot)?.name ?? item.slot;
          const wornElsewhere = item.wornBy.filter((id) => id !== keeper.id).map((id) => wardrobe?.keepers.find((k) => k.id === id)?.name).filter(Boolean);
          return (
            <ItemCard
              key={item.id}
              name={item.name}
              rarity={rarity}
              slotName={slotName}
              colours={coloursOf(item)}
              locked={locked}
              worn={wearing}
              tags={item.source === 'yours' ? ['Forged'] : []}
              line={wearing ? `${keeper.name} is wearing it` : wornElsewhere.length ? `Worn by ${wornElsewhere.join(', ')}` : fits ? 'In your inventory' : `${keeper.name} has no ${slotName.toLowerCase()}`}
              onTry={(on) => onTry(on ? item : null)}
            >
              {wearing ? (
                <button type="button" className="btn btn-small" disabled={busy} onClick={() => onTakeOff(item.id)}>Take off</button>
              ) : (
                <button type="button" className="btn btn-primary btn-small" disabled={busy || !fits || locked !== null} onClick={() => onWear(item.id)}>
                  {locked !== null ? `Level ${locked}` : 'Equip'}
                </button>
              )}
              {wearing && others.length > 0 && (
                <select className="field field-small inv-give" aria-label={`Give the ${item.name}`} value="" onChange={(e) => { const [to, mode] = e.target.value.split('|'); if (to) onGive(item.id, to, mode as 'move' | 'share'); }}>
                  <option value="">Give…</option>
                  {others.map((k) => (
                    <option key={`${k.id}-m`} value={`${k.id}|move`}>Move to {k.name}</option>
                  ))}
                  {!item.oneOfAKind && others.map((k) => (
                    <option key={`${k.id}-s`} value={`${k.id}|share`}>Share with {k.name}</option>
                  ))}
                </select>
              )}
              <button type="button" className="link small" onClick={() => void share(item)}>Share file</button>
            </ItemCard>
          );
        })}
      </div>
    </div>
  );
}
